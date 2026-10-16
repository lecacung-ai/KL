import ast
import base64
import glob
import os
import shutil
import subprocess
import time
import uuid

# Danh sách các module bị cấm triệt để trong môi trường Sandbox
FORBIDDEN_MODULES = {
    "subprocess",
    "socket",
    "urllib",
    "requests",
    "http",
    "ftplib",
    "telnetlib",
    "pty",
    "shutil",
}

# Danh sách các hàm / phương thức nguy hại bị chặn
FORBIDDEN_CALLS = {
    "eval",
    "exec",
    "__import__",
    "compile",
}

# Các hàm trong os bị cấm (chỉ cho phép các hàm xem thông tin an toàn nếu cần)
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
}


def clean_python_code(raw_code: str) -> str:
    """
    Trích xuất mã Python thuần túy, loại bỏ các khối markdown ```python ... ```
    """
    code = raw_code.strip()
    if "```python" in code:
        parts = code.split("```python")
        code = parts[1].split("```")[0]
    elif "```" in code:
        parts = code.split("```")
        code = parts[1].split("```")[0] if len(parts) > 1 else code
    return code.strip()


def inspect_code_security(code: str) -> tuple[bool, str | None]:
    """
    Chức năng 6: Kiểm định an toàn mã nguồn bằng AST (Abstract Syntax Tree)
    - Phát hiện sớm các lệnh gọi shell hệ thống nguy hại
    - Chặn truy cập socket mạng ra ngoài
    - Chặn các hàm thực thi chuỗi động nguy hiểm (eval, exec, __import__)
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Lỗi cú pháp mã nguồn (SyntaxError): {str(e)}"

    for node in ast.walk(tree):
        # 1. Bắt các lệnh import module bị cấm
        if isinstance(node, ast.Import):
            for alias in node.names:
                root_module = alias.name.split(".")[0]
                if root_module in FORBIDDEN_MODULES:
                    return False, f"Cảnh báo Sandbox: Phát hiện cố gắng nhập thư viện bị cấm '{alias.name}'. Lệnh đã bị chặn."

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                root_module = node.module.split(".")[0]
                if root_module in FORBIDDEN_MODULES:
                    return False, f"Cảnh báo Sandbox: Phát hiện cố gắng nhập module bị cấm 'from {node.module}'. Lệnh đã bị chặn."

        # 2. Bắt các hàm gọi nguy hiểm trực tiếp (eval, exec, __import__)
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                if node.func.id in FORBIDDEN_CALLS:
                    return False, f"Cảnh báo Sandbox: Phát hiện hàm thực thi không an toàn '{node.func.id}()'. Lệnh đã bị chặn."

            # 3. Bắt các phương thức nguy hiểm (os.system, os.popen, os.remove...)
            elif isinstance(node.func, ast.Attribute):
                attr_name = node.func.attr
                if attr_name in FORBIDDEN_OS_ATTRIBUTES:
                    if isinstance(node.func.value, ast.Name) and node.func.value.id == "os":
                        return False, f"Cảnh báo Sandbox: Phát hiện lệnh can thiệp hệ thống 'os.{attr_name}()'. Lệnh đã bị chặn."

    return True, None


def execute_in_sandbox(code: str, file_path: str, timeout: int = 15) -> dict:
    """
    Chức năng 6: Bộ thực thi mã an toàn (Sandbox Engine)
    - Kiểm định tĩnh AST trước khi chạy
    - Cách ly môi trường thực thi trong thư mục tạm độc lập
    - Giới hạn thời gian (Timeout 15 giây) chống treo CPU / vòng lặp vô tận
    - Cấu hình Matplotlib Agg headless
    - Đo lường thời gian thực thi (Execution Time)
    - Trích xuất biểu đồ thành Base64 và thu thập stdout/stderr
    """
    start_time = time.time()
    cleaned = clean_python_code(code)

    # 1. Kiểm tra an toàn tĩnh (AST Security Guard)
    is_safe, security_error = inspect_code_security(cleaned)
    if not is_safe:
        return {
            "success": False,
            "stdout": "",
            "stderr": security_error or "Vi phạm chính sách bảo mật Sandbox.",
            "chart_image": None,
            "cleaned_code": cleaned,
            "execution_time_ms": round((time.time() - start_time) * 1000, 1),
            "security_status": "blocked",
        }

    # 2. Tạo môi trường cách ly (Isolated Sandbox Directory)
    run_id = uuid.uuid4().hex[:8]
    sandbox_dir = f"/tmp/sandbox_{run_id}"
    os.makedirs(sandbox_dir, exist_ok=True)

    filename = os.path.basename(file_path)
    try:
        shutil.copy2(file_path, os.path.join(sandbox_dir, filename))
    except Exception:
        pass

    # Wrapper script với Matplotlib Agg headless
    wrapper_code = f"""import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

FILE_PATH = "{file_path}"
LOCAL_FILE = "{filename}"

# --- MÃ NGUỒN PHÂN TÍCH DO AI SINH RA ---
{cleaned}

# Tự động xuất biểu đồ nếu mã có vẽ hình mà chưa lưu
try:
    if plt.get_fignums() and not os.path.exists("output.png"):
        plt.savefig("output.png", bbox_inches='tight', dpi=150)
        plt.close('all')
except Exception:
    pass
"""
    script_path = os.path.join(sandbox_dir, "run_script.py")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(wrapper_code)

    chart_base64 = None
    stdout_text = ""
    stderr_text = ""
    success = False

    try:
        proc = subprocess.run(
            ["python", "run_script.py"],
            cwd=sandbox_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        stdout_text = proc.stdout.strip()
        stderr_text = proc.stderr.strip()
        success = (proc.returncode == 0)

        # Quét tìm ảnh biểu đồ được sinh ra trong sandbox
        image_files = glob.glob(os.path.join(sandbox_dir, "*.png")) + glob.glob(os.path.join(sandbox_dir, "*.jpg"))
        if image_files:
            target_img = next((img for img in image_files if "output.png" in img), image_files[0])
            with open(target_img, "rb") as img_f:
                b64_content = base64.b64encode(img_f.read()).decode("utf-8")
                chart_base64 = f"data:image/png;base64,{b64_content}"

    except subprocess.TimeoutExpired:
        stderr_text = f"Thời gian thực thi mã vượt quá giới hạn an toàn ({timeout} giây). Sandbox đã chủ động ngắt tiến trình để bảo vệ tài nguyên máy chủ."
        success = False
    except Exception as e:
        stderr_text = f"Lỗi trong quá trình chạy Sandbox: {str(e)}"
        success = False
    finally:
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
        "security_status": "passed",
    }
