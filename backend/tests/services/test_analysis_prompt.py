"""Synthetic, offline prompt regressions; runnable with unittest without DB fixtures.

From backend: python -m unittest discover -s tests/services -p test_analysis_prompt.py
"""

import json
import unittest

import pandas as pd

from app.services.analysis_prompt import (
    MAX_CONTEXT_CHARS,
    build_analysis_prompt,
    build_data_context,
    build_repair_prompt,
)


class AnalysisPromptTests(unittest.TestCase):
    def test_small_table_includes_spending_after_first_five_rows(self):
        frame = pd.DataFrame({
            "Nhãn": ["Thu", "Lương", "Thưởng", "Khác", "Ghi chú", "Chi tiêu"],
            "Đơn vị": ["VNĐ"] * 6,
            "Tháng 1": [45, 25, 20, None, None, 24.5],
        })
        context = json.loads(build_data_context(frame, "vẽ Chi tiêu"))
        self.assertFalse(context["sample_is_partial"])
        self.assertEqual(context["sample_rows"][5]["values"], ["Chi tiêu", "VNĐ", "24.5"])

    def test_label_lookup_samples_reordered_middle_row(self):
        frame = pd.DataFrame({"Nhãn": [f"Mục {i}" for i in range(100)], "Giá trị": range(100)})
        frame.loc[65, "Nhãn"] = "Chi tiêu"
        context = json.loads(build_data_context(frame, "vẽ biểu đồ Chi tiêu"))
        self.assertTrue(context["sample_is_partial"])
        self.assertIn(65, [row["position"] for row in context["sample_rows"]])

    def test_context_limits_and_no_hidden_columns(self):
        scoped = pd.DataFrame({f"c{i}": ["x" * 1000] * 80 for i in range(50)})
        result = build_data_context(scoped, "vẽ")
        self.assertLessEqual(len(result), MAX_CONTEXT_CHARS)
        self.assertTrue(json.loads(result)["sample_is_partial"])
        frame = pd.DataFrame({"allowed": [1], "private": ["not-authorized"]})
        self.assertNotIn("not-authorized", build_data_context(frame[["allowed"]], "vẽ"))

    def test_prompt_and_repair_keep_original_request_and_scope(self):
        prompt = build_analysis_prompt(
            file_path="/tmp/test's.csv", context="source-context",
            columns=["Nhãn", "Tháng 1"], query="Vẽ Chi tiêu, không lấy Thu",
        )
        repaired = build_repair_prompt(prompt, "original-code", "original-error")
        self.assertTrue(repaired.startswith(prompt))
        for expected in ["source-context", "Vẽ Chi tiêu, không lấy Thu", "original-code", "original-error"]:
            self.assertIn(expected, repaired)
        self.assertIn("df = df[['Nhãn', 'Tháng 1']].copy()", prompt)


if __name__ == "__main__":
    unittest.main()
