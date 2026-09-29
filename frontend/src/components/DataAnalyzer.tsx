import { useState } from "react";
import axios from "axios";
import React from "react";

export default function DataAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  
  const handleAnalyze = async () => {
    if (!file) {
      alert("Vui lòng chọn tệp Excel/CSV");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("query", query);

    try {
      alert("Đang gửi dữ liệu và yêu cầu AI xử lý, vui lòng đợi vài giây...");
      const token = sessionStorage.getItem("access_token");
      
      const response = await axios.post("http://localhost:8000/api/v1/files/upload", formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const columns = response.data.columns.join(", ");
      const aiCode = response.data.ai_code;
      
      console.log("MÃ PYTHON DO AI SINH RA:\n", aiCode);
      alert(`Thành công!\n\nCác cột nhận diện: ${columns}\n\nĐã nhận được mã code từ Gemini! Hãy nhấn F12 (chọn tab Console) để xem chi tiết.`);
    } catch (error) {
      console.error(error);
      alert("Lỗi kết nối! Hệ thống từ chối truy cập (có thể bạn chưa đăng nhập).");
    }
  }

  return (
    <div className="mt-6 p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
      <h2 className="text-xl font-bold text-blue-500 mb-2">
        🤖 Trợ Lý AI Phân Tích Dữ Liệu
      </h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Tải tệp Excel/CSV kinh doanh lên và đặt câu hỏi cho AI.
      </p>
      
      <div className="flex flex-col gap-5">
        <input 
          type="file" 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files ? e.target.files[0] : null)} 
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-foreground file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input 
          placeholder="VD: Vẽ biểu đồ doanh thu theo từng tháng..." 
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button 
          onClick={handleAnalyze}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
        >
          Gửi dữ liệu & Phân tích
        </button>
      </div>
    </div>
  );
}