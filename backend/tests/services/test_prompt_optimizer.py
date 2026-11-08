"""Unit tests for Dynamic Prompt Optimizer & Query Reformulation Engine (Chương 4 & 5).

Runnable with:
docker exec kl-backend-1 python -m unittest discover -s /app/backend/tests/services -p test_prompt_optimizer.py
"""

import unittest
import pandas as pd

from app.services.prompt_optimizer_service import (
    BENCHMARK_EVALUATION_METRICS,
    prompt_optimizer_service,
)


class TestPromptOptimizerService(unittest.TestCase):
    def test_benchmark_metrics_integrity(self):
        """Kiểm tra tính toàn vẹn của số liệu thực nghiệm 500 lượt trên 50 bộ dữ liệu (Chương 5)."""
        metrics = BENCHMARK_EVALUATION_METRICS
        self.assertEqual(metrics["total_files"], 50)
        self.assertEqual(metrics["total_runs"], 500)

        p1 = metrics["prompts"]["P1"]
        p2 = metrics["prompts"]["P2"]
        p3 = metrics["prompts"]["P3"]
        p4 = metrics["prompts"]["P4"]
        p5 = metrics["prompts"]["P5"]

        self.assertEqual(p1["success_rate"], 84.0)
        self.assertEqual(p1["key_error"], 6)

        # P2 đạt độ tin cậy thực thi cao nhất
        self.assertEqual(p2["success_rate"], 99.0)
        self.assertEqual(p2["key_error"], 0)
        self.assertEqual(p2["missing_chart"], 0)

        self.assertEqual(p3["success_rate"], 82.0)
        self.assertEqual(p4["success_rate"], 81.0)
        self.assertEqual(p5["success_rate"], 89.0)

    def test_is_prompt_inquiry_detection(self):
        """Kiểm tra khả năng nhận diện câu hỏi liên quan đến tối ưu prompt và số liệu thực nghiệm."""
        positive_queries = [
            "Hệ thống tối ưu prompt như thế nào?",
            "Prompt tối ưu của hệ thống là gì?",
            "Cho tôi xem số liệu thực nghiệm 5 prompt",
            "Đánh giá prompt trong Chương 5 ra sao?",
            "Tại sao hệ thống lại vẽ biểu đồ chuẩn xác như vậy?",
            "Cơ chế chuyển hóa prompt hoạt động thế nào?",
            "Kết quả thử nghiệm few-shot và zero-shot",
        ]
        for q in positive_queries:
            self.assertTrue(
                prompt_optimizer_service.is_prompt_inquiry(q),
                f"Query should be recognized as prompt inquiry: {q}",
            )

        negative_queries = [
            "Tính tổng doanh thu năm 2025",
            "Vẽ biểu đồ hình cột",
            "Top 10 khách hàng mua nhiều nhất",
            "Lọc các dòng có trạng thái thành công",
        ]
        for q in negative_queries:
            self.assertFalse(
                prompt_optimizer_service.is_prompt_inquiry(q),
                f"Query should NOT be recognized as prompt inquiry: {q}",
            )

    def test_get_benchmark_explanation(self):
        """Kiểm tra nội dung báo cáo thực nghiệm Chương 5 được sinh ra đầy đủ số liệu."""
        explanation = prompt_optimizer_service.get_benchmark_explanation()
        self.assertIn("BÁO CÁO KẾT QUẢ THỰC NGHIỆM ĐỐI SÁNH 5 CHIẾN LƯỢC PROMPT", explanation)
        self.assertIn("99.0%", explanation)
        self.assertIn("Few-Shot", explanation)
        self.assertIn("Role-Based", explanation)
        self.assertIn("Constraint Guardrails", explanation)
        self.assertIn("Dynamic Query Reformulation Engine", explanation)

    def test_synthesize_optimal_prompt(self):
        """Kiểm tra khả năng chuyển hóa câu hỏi thô thành Prompt tối ưu lai ghép (P2 + P4 + P5)."""
        df = pd.DataFrame({
            "Chi_Nhanh": ["Hà Nội", "Đà Nẵng", "TP.HCM", "Cần Thơ"],
            "Doanh_Thu": ["120000000", "85000000", "210000000", "65000000"],
            "Ghi_Chu": ["Tốt", "Bình thường", "Rất tốt", "Đạt"],
        })

        raw_query = "vẽ biểu đồ so sánh doanh thu giữa các chi nhánh"
        result = prompt_optimizer_service.synthesize_optimal_prompt(raw_query, df)

        self.assertEqual(result["detected_x"], "Chi_Nhanh")
        self.assertEqual(result["detected_y"], "Doanh_Thu")
        self.assertEqual(result["chart_type"], "bar")

        # Kiểm tra mẫu mã nguồn nạp vào Few-Shot
        sample_code = result["sample_code"]
        self.assertIn("matplotlib.use('Agg')", sample_code)
        self.assertIn("pd.to_numeric", sample_code)
        self.assertIn("groupby('Chi_Nhanh'", sample_code)
        self.assertIn("head(10)", sample_code)
        self.assertIn("plt.savefig('output.png'", sample_code)
        self.assertIn("plt.close('all')", sample_code)

        # Kiểm tra prompt tối ưu
        opt_prompt = result["optimized_prompt"]
        self.assertIn("CHUYÊN GIA BI & DATA STORYTELLING", opt_prompt)
        self.assertIn("MẪU CODE CHUẨN MỰC BẮT BUỘC HỌC THEO", opt_prompt)
        self.assertIn("99.0%", opt_prompt)


if __name__ == "__main__":
    unittest.main()
