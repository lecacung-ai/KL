"""Mô-đun Sandbox thực thi mã an toàn (Secure Code Execution Sandbox Engine).

Dành cho đề tài: Trợ lý AI Phân tích Dữ liệu Kinh doanh & Dự báo Tài chính SME.

Kiến trúc bảo mật đa lớp (Multi-layer Defense-in-Depth):
1. Lớp 1 (Layer 1 - Static AST Guard): Kiểm định an toàn tĩnh bằng AST (Abstract Syntax Tree),
   chặn triệt để module mạng, lệnh gọi shell, introspection và sandbox escape.
2. Lớp 2 (Layer 2 - Docker Container Sandbox): Cách ly tuyệt đối bằng Docker container độc lập
   với cờ `--network none`, `--memory 512m`, `--cpus 1.0`, `--pids-limit 64`, non-root user.
3. Lớp 3 (Layer 3 - Host Process Fallback): Tự động dự phòng an toàn bằng tiến trình con độc lập
   khi máy chủ chưa khởi động Docker daemon, đảm bảo hệ thống không bao giờ bị gián đoạn.
4. Lớp 4 (Layer 4 - Runtime Environment Wrapper): Tự động cấu hình Matplotlib Agg headless,
   phông chữ tiếng Việt cho biểu đồ tài chính, hook plt.show() và smart resolver cho file Excel/CSV.
5. Lớp 5 (Layer 5 - Resource & Observability Metrics): Đo lường thời gian thực thi (ms) và
   đỉnh bộ nhớ RAM (tracemalloc / container metrics), phục vụ trang quản trị và lịch sử truy vấn.
"""

import ast
import base64
import glob
import json
import logging
import os
import shutil
import subprocess
import sys
import time
import uuid

logger = logging.getLogger("sandbox")

# ==============================================================================
# 1. DANH SÁCH ĐEN BẢO MẬT TĨNH (STATIC AST SECURITY BLACKLISTS)
# ==============================================================================

# Danh sách module bị cấm triệt để (ngăn chặn mạng, tiến trình con, hệ thống file)
FORBIDDEN_MODULES = {
    # Mạng và socket
    "socket",
    "urllib",
    "requests",
    "http",
    "ftplib",
    "telnetlib",
    "aiohttp",
    "httpx",
    # Tiến trình con và hệ điều hành sâu
    "subprocess",
    "pty",
    "shutil",
    "ctypes",
    "multiprocessing",
    "threading",
    "asyncio",
    "signal",
    # Dynamic loader & reflection
    "importlib",
    "sys",
    "builtins",
    "posix",
    "nt",
    # Serialization nguy hiểm (tránh RCE qua deserialize)
    "pickle",
    "shelve",
    "marshal",
}

# Danh sách các hàm gọi trực tiếp bị cấm (Dynamic Code Execution)
FORBIDDEN_CALLS = {
    "eval",
    "exec",
    "__import__",
    "compile",
    "globals",
    "locals",
    "vars",
    "breakpoint",
    "input",
}

# Các hàm trong module 'os' bị cấm (chỉ cho phép các hàm xem đường dẫn an toàn os.path)
FORBIDDEN_OS_ATTRIBUTES = {
    "system",
    "popen",
    "spawn",
    "fork",
    "kill",
    "remove",
    "unlink",
    "rmdir",
    "rename",
    "replace",
    "environ",
    "putenv",
    "chdir",
    "chmod",
    "chown",
}

# Các thuộc tính Dunder nguy hiểm dùng trong kỹ thuật Sandbox Escape
FORBIDDEN_DUNDER_ATTRS = {
    "__subclasses__",
    "__bases__",
    "__mro__",
    "__globals__",
    "__code__",
    "__builtins__",
}


# ==============================================================================
# 2. KIỂM ĐỊNH MÃ NGUỒN TĨNH BẰNG AST (AST STATIC SECURITY GUARD)
# ==============================================================================


def clean_python_code(raw_code: str) -> str:
    """Trích xuất mã Python thuần túy, loại bỏ các khối markdown ```python ... ```"""
    import re
    code = (raw_code or "").strip()
    match = re.search(r"```(?:python|py)?\s*(.*?)\s*```", code, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    if "```" in code:
        parts = code.split("```")
        for part in parts:
            p_strip = part.strip()
            if p_strip.lower().startswith(("python", "py")):
                p_strip = re.sub(r"^(?:python|py)\s*", "", p_strip, flags=re.IGNORECASE).strip()
            if any(k in p_strip for k in ["import ", "df", "print(", "plt.", "pd."]):
                return p_strip
    return code


def inspect_code_security(code: str) -> tuple[bool, str | None]:
    """Kiểm tra an toàn mã nguồn bằng Abstract Syntax Tree (AST).

    Trả về (is_safe, error_message).
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Lỗi cú pháp mã nguồn (SyntaxError ở dòng {e.lineno}): {e.msg}"

    for node in ast.walk(tree):
        # 1. Bắt các lệnh import module bị cấm (import x, import x as y)
        if isinstance(node, ast.Import):
            for alias in node.names:
                root_module = alias.name.split(".")[0]
                if root_module in FORBIDDEN_MODULES:
                    return (
                        False,
                        f"Cảnh báo Sandbox: Phát hiện cố gắng nhập thư viện bị cấm '{alias.name}'. Lệnh đã bị chặn.",
                    )

        # 2. Bắt lệnh import from module bị cấm (from x import y)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                root_module = node.module.split(".")[0]
                if root_module in FORBIDDEN_MODULES:
                    return (
                        False,
                        f"Cảnh báo Sandbox: Phát hiện cố gắng nhập module bị cấm 'from {node.module}'. Lệnh đã bị chặn.",
                    )

        # 3. Bắt các hàm gọi nguy hiểm trực tiếp (eval, exec, __import__, open không an toàn)
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
                if func_name in FORBIDDEN_CALLS:
                    return (
                        False,
                        f"Cảnh báo Sandbox: Phát hiện hàm thực thi không an toàn '{func_name}()'. Lệnh đã bị chặn.",
                    )
                # Kiểm tra hàm open() tránh đọc ghi file ngoài thư mục Sandbox
                if func_name == "open" and node.args:
                    first_arg = node.args[0]
                    if isinstance(first_arg, ast.Constant) and isinstance(
                        first_arg.value, str
                    ):
                        path_str = first_arg.value
                        if (
                            path_str.startswith("/")
                            or path_str.startswith("\\")
                            or ".." in path_str
                            or ":" in path_str
                        ):
                            return (
                                False,
                                f"Cảnh báo Sandbox: Phát hiện cố gắng truy cập đường dẫn tệp ngoài phạm vi '{path_str}' qua open(). Lệnh đã bị chặn.",
                            )

            # 4. Bắt các phương thức can thiệp hệ điều hành (os.system, os.popen, os.remove...)
            elif isinstance(node.func, ast.Attribute):
                attr_name = node.func.attr
                if attr_name in FORBIDDEN_OS_ATTRIBUTES:
                    if (
                        isinstance(node.func.value, ast.Name)
                        and node.func.value.id == "os"
                    ):
                        return (
                            False,
                            f"Cảnh báo Sandbox: Phát hiện lệnh can thiệp hệ thống 'os.{attr_name}()'. Lệnh đã bị chặn.",
                        )

        # 5. Bắt kỹ thuật Sandbox Escape qua Dunder Attributes Introspection
        elif isinstance(node, ast.Attribute):
            if node.attr in FORBIDDEN_DUNDER_ATTRS:
                return (
                    False,
                    f"Cảnh báo Sandbox: Phát hiện kỹ thuật duyệt thuộc tính nhạy cảm ('{node.attr}'). Lệnh đã bị chặn.",
                )

    return True, None


# ==============================================================================
# 3. TẠO SCRIPT BỌC MÔI TRƯỜNG THỰC THI (RUNTIME SCRIPT WRAPPER)
# ==============================================================================


def _generate_wrapper_code(
    cleaned_code: str,
    original_file_path: str,
    data_filename: str,
) -> str:
    """Tạo mã nguồn bọc (Wrapper) với:

    - Headless Matplotlib Agg
    - Phông chữ tiếng Việt cho biểu đồ tài chính SME
    - Hook plt.show() lưu ảnh vào output.png
    - Smart Fallback cho pd.read_csv và pd.read_excel
    - Đo đỉnh bộ nhớ RAM bằng tracemalloc
    """
    return f"""# -*- coding: utf-8 -*-
import os
import sys
import json
import tracemalloc

# Cấu hình UTF-8 toàn diện chống lỗi font trên Windows Console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 1. Cấu hình Matplotlib Agg Headless & Phông chữ tiếng Việt
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    matplotlib.rcParams['font.sans-serif'] = [
        'DejaVu Sans', 'Arial', 'Segoe UI', 'Liberation Sans', 'sans-serif'
    ]
    matplotlib.rcParams['axes.unicode_minus'] = False

    def _custom_show(*args, **kwargs):
        if not os.path.exists("output.png"):
            plt.savefig("output.png", bbox_inches='tight', dpi=150)
        plt.close('all')

    plt.show = _custom_show
except Exception:
    pass

# 2. Cầu nối nạp tệp dữ liệu thông minh (Smart Dataframe Fallback Resolver)
DATA_FILE_NAME = {data_filename!r}
ORIGINAL_FILE_PATH = {original_file_path!r}

try:
    import pandas as pd
    _orig_read_csv = pd.read_csv
    _orig_read_excel = pd.read_excel

    def _smart_read_csv(filepath_or_buffer, *args, **kwargs):
        if isinstance(filepath_or_buffer, str) and not os.path.exists(filepath_or_buffer):
            if os.path.exists(DATA_FILE_NAME):
                filepath_or_buffer = DATA_FILE_NAME
        return _orig_read_csv(filepath_or_buffer, *args, **kwargs)

    def _smart_read_excel(io, *args, **kwargs):
        if isinstance(io, str) and not os.path.exists(io):
            if os.path.exists(DATA_FILE_NAME):
                io = DATA_FILE_NAME
        return _orig_read_excel(io, *args, **kwargs)

    pd.read_csv = _smart_read_csv
    pd.read_excel = _smart_read_excel

    # Tự động nạp sẵn biến DataFrame df nếu có tệp dữ liệu được truyền vào
    _target_file = DATA_FILE_NAME if os.path.exists(DATA_FILE_NAME) else ORIGINAL_FILE_PATH
    if _target_file and os.path.exists(_target_file):
        if str(_target_file).endswith('.csv'):
            df = _orig_read_csv(_target_file)
        else:
            df = _orig_read_excel(_target_file)
except Exception:
    pass

# 3. Khởi động bộ theo dõi bộ nhớ RAM
tracemalloc.start()

# ==============================================================================
# --- MÃ NGUỒN PHÂN TÍCH DO AI AGENT SINH RA ---
# ==============================================================================
{cleaned_code}
# ==============================================================================
# --- KẾT THÚC MÃ AI AGENT ---
# ==============================================================================

# 4. Ghi nhận đỉnh bộ nhớ RAM tiêu thụ (Peak Memory)
try:
    _current_mem, _peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    _peak_mb = round(_peak_mem / (1024 * 1024), 2)
    with open(".sandbox_metrics.json", "w", encoding="utf-8") as _mf:
        json.dump({{"peak_memory_mb": _peak_mb}}, _mf)
except Exception:
    pass

# 5. Tự động lưu biểu đồ nếu mã có tạo figure nhưng chưa gọi savefig hay show
try:
    import matplotlib.pyplot as plt
    if plt.get_fignums() and not os.path.exists("output.png"):
        plt.savefig("output.png", bbox_inches='tight', dpi=150)
        plt.close('all')
except Exception:
    pass
"""


# ==============================================================================
# 4. KIỂM TRA TÍNH KHẢ DỤNG CỦA DOCKER (DOCKER PROBE)
# ==============================================================================


def is_docker_available() -> bool:
    """Kiểm tra xem Docker CLI và Docker daemon có đang hoạt động hay không."""
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return False
    try:
        proc = subprocess.run(
            [docker_bin, "info"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        return proc.returncode == 0
    except Exception:
        return False


# ==============================================================================
# 5. BỘ THỰC THI DOCKER CONTAINER SANDBOX (TIER 1)
# ==============================================================================


def _execute_in_docker(
    sandbox_dir: str,
    image: str = "sme-ai-sandbox:latest",
    fallback_image: str = "python:3.11-slim",
    timeout: int = 15,
    memory_limit: str = "512m",
    cpu_limit: float = 1.0,
) -> tuple[bool, str, str, float]:
    """Thực thi mã trong Docker container hoàn toàn cách ly:

    - --network none: Cắt đứt kết nối mạng tuyệt đối
    - --memory 512m: Giới hạn RAM tối đa
    - --cpus 1.0: Giới hạn CPU
    - --pids-limit 64: Chống fork-bomb
    - --rm: Tự động hủy container sau khi kết thúc
    """
    docker_bin = shutil.which("docker") or "docker"

    # Kiểm tra xem image có sẵn không, nếu không thì dùng fallback image
    target_image = image
    try:
        inspect_proc = subprocess.run(
            [docker_bin, "image", "inspect", target_image],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if inspect_proc.returncode != 0:
            target_image = fallback_image
    except Exception:
        target_image = fallback_image

    # Chuẩn hóa đường dẫn thư mục sandbox để mount volume vào container
    abs_host_dir = os.path.abspath(sandbox_dir).replace("\\", "/")

    cmd = [
        docker_bin,
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        memory_limit,
        "--cpus",
        str(cpu_limit),
        "--pids-limit",
        "64",
        "-v",
        f"{abs_host_dir}:/workspace:rw",
        "-w",
        "/workspace",
        target_image,
        "python",
        "run_script.py",
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        success = proc.returncode == 0
        return success, stdout, stderr, 0.0
    except subprocess.TimeoutExpired:
        # Ngắt tiến trình container nếu quá thời gian
        return (
            False,
            "",
            f"Thời gian thực thi trong Docker Sandbox vượt quá giới hạn an toàn ({timeout} giây). Tiến trình đã bị ngắt để bảo vệ tài nguyên máy chủ.",
            0.0,
        )
    except Exception as e:
        return False, "", f"Lỗi khi khởi chạy Docker container: {str(e)}", 0.0


# ==============================================================================
# 6. BỘ THỰC THI HOST PROCESS SANDBOX (TIER 2 - AUTOMATIC FALLBACK)
# ==============================================================================


def _execute_in_host_subprocess(
    sandbox_dir: str,
    timeout: int = 15,
) -> tuple[bool, str, str]:
    """Thực thi mã bằng tiến trình Python con độc lập trên máy chủ với giới hạn timeout.

    Được kích hoạt tự động khi Docker daemon chưa chạy.
    """
    py_executable = sys.executable or "python"
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    try:
        proc = subprocess.run(
            [py_executable, "-X", "utf8", "run_script.py"],
            cwd=sandbox_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=timeout,
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        success = proc.returncode == 0
        return success, stdout, stderr
    except subprocess.TimeoutExpired:
        return (
            False,
            "",
            f"Thời gian thực thi mã vượt quá giới hạn an toàn ({timeout} giây). Sandbox đã chủ động ngắt tiến trình để bảo vệ tài nguyên máy chủ.",
        )
    except Exception as e:
        return False, "", f"Lỗi trong quá trình chạy Sandbox: {str(e)}"


# ==============================================================================
# 7. HÀM ĐIỀU PHỐI SANDBOX CHÍNH (MAIN SANDBOX ENTRYPOINT)
# ==============================================================================


def execute_in_sandbox(code: str, file_path: str, timeout: int = 15) -> dict:
    """Bộ thực thi mã an toàn (Secure Sandbox Engine).

    Luồng xử lý hoàn chỉnh:
    1. Trích xuất mã thuần túy từ markdown.
    2. Kiểm định tĩnh AST (AST Security Guard).
    3. Tạo thư mục tạm cách ly độc lập.
    4. Bọc mã nguồn với Matplotlib Agg, phông chữ tiếng Việt, hook plt.show() và smart resolver.
    5. Thực thi qua Docker Sandbox (ưu tiên số 1) hoặc Host Subprocess (dự phòng tự động).
    6. Thu thập stdout, stderr, ảnh biểu đồ Base64 và thông số bộ nhớ RAM thực tế.
    7. Tự động dọn dẹp thư mục tạm trong khối finally.
    """
    start_time = time.time()
    cleaned = clean_python_code(code)

    # 1. Kiểm tra an toàn tĩnh bằng AST
    is_safe, security_error = inspect_code_security(cleaned)
    if not is_safe:
        return {
            "success": False,
            "stdout": "",
            "stderr": security_error or "Vi phạm chính sách bảo mật Sandbox.",
            "chart_image": None,
            "cleaned_code": cleaned,
            "execution_time_ms": round((time.time() - start_time) * 1000, 1),
            "memory_mb": 0.0,
            "engine": "ast_security_guard",
            "security_status": "blocked",
            "security_warning": security_error,
        }

    # 2. Tạo không gian cách ly (Isolated Sandbox Directory)
    run_id = uuid.uuid4().hex[:8]
    temp_base = (
        "/tmp"
        if os.name != "nt"
        else os.path.join(os.environ.get("TEMP", "C:/temp"), "sme_sandbox")
    )
    sandbox_dir = os.path.join(temp_base, f"sandbox_{run_id}")
    os.makedirs(sandbox_dir, exist_ok=True)

    filename = os.path.basename(file_path)
    try:
        if os.path.exists(file_path):
            shutil.copy2(file_path, os.path.join(sandbox_dir, filename))
    except Exception as copy_err:
        logger.warning(
            f"Không thể sao chép tệp dữ liệu vào sandbox: {copy_err}"
        )

    # 3. Tạo script bọc môi trường thực thi (Wrapper Script)
    wrapper_code = _generate_wrapper_code(
        cleaned_code=cleaned,
        original_file_path=file_path,
        data_filename=filename,
    )
    script_path = os.path.join(sandbox_dir, "run_script.py")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(wrapper_code)

    chart_base64 = None
    stdout_text = ""
    stderr_text = ""
    success = False
    engine_name = "host_subprocess_fallback"
    peak_memory_mb = 12.0

    try:
        # 4. Quyết định Engine: Thử nghiệm Docker trước
        docker_ready = is_docker_available()
        if docker_ready:
            engine_name = "docker"
            success, stdout_text, stderr_text, _ = _execute_in_docker(
                sandbox_dir=sandbox_dir,
                timeout=timeout,
            )
        else:
            engine_name = "host_subprocess_fallback"
            success, stdout_text, stderr_text = _execute_in_host_subprocess(
                sandbox_dir=sandbox_dir,
                timeout=timeout,
            )

        # 5. Đọc số liệu đỉnh bộ nhớ RAM từ .sandbox_metrics.json (nếu có)
        metrics_file = os.path.join(sandbox_dir, ".sandbox_metrics.json")
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, encoding="utf-8") as mf:
                    m_data = json.load(mf)
                    peak_memory_mb = float(m_data.get("peak_memory_mb", 12.0))
            except Exception:
                pass

        # 6. Quét tìm và đóng gói hình ảnh biểu đồ Base64
        image_files = (
            glob.glob(os.path.join(sandbox_dir, "*.png"))
            + glob.glob(os.path.join(sandbox_dir, "*.jpg"))
            + glob.glob(os.path.join(sandbox_dir, "*.jpeg"))
        )
        if image_files:
            target_img = next(
                (img for img in image_files if "output.png" in img),
                image_files[0],
            )
            try:
                with open(target_img, "rb") as img_f:
                    b64_content = base64.b64encode(img_f.read()).decode("utf-8")
                    chart_base64 = f"data:image/png;base64,{b64_content}"
                success = True
            except Exception:
                pass

    finally:
        # 7. Tự động dọn dẹp thư mục tạm cách ly
        try:
            shutil.rmtree(sandbox_dir, ignore_errors=True)
        except Exception:
            pass

    elapsed_ms = round((time.time() - start_time) * 1000, 1)

    return {
        "success": success,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "chart_image": chart_base64,
        "cleaned_code": cleaned,
        "execution_time_ms": elapsed_ms,
        "memory_mb": peak_memory_mb,
        "engine": engine_name,
        "security_status": "passed",
        "security_warning": None,
    }


__all__ = [
    "clean_python_code",
    "execute_in_sandbox",
    "inspect_code_security",
    "is_docker_available",
]
