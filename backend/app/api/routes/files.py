from fastapi import APIRouter, UploadFile, HTTPException, Form
from app.api.deps import CurrentUser  # Dùng để kiểm tra quyền đăng nhập
import shutil
import os
import pandas as pd
import google.generativeai as genai

router = APIRouter()

# Thư mục chứa tệp tạm thời
UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Truy cập qua API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

@router.post("/upload")
async def upload_data_file(
    current_user: CurrentUser, # Bắt buộc phải đăng nhập (Có thẻ Token)
    file: UploadFile,
    query: str = Form(default="")
):
    # 1. Kiểm tra định dạng
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tệp định dạng .csv hoặc .xlsx")

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    # 2. Lưu file an toàn
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Đọc dữ liệu mẫu (Schema)
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=5)
        else:
            df = pd.read_excel(file_path, nrows=5)
            
        columns = df.columns.tolist()
        schema_info = f"Các cột trong dữ liệu gồm: {', '.join(columns)}. Dữ liệu mẫu 5 dòng đầu tiên:\n{df.head().to_string()}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể đọc dữ liệu: {str(e)}")

    # 4. TRÁI TIM CỦA HỆ THỐNG: GỌI AI ĐỂ PHÂN TÍCH (Nếu người dùng có đặt câu hỏi)
    ai_generated_code = ""
    if query:
        if not GEMINI_API_KEY:
            ai_generated_code = "Lỗi: Hệ thống chưa được cấu hình API Key của AI."
        else:
            try:
                # Chọn model Gemini Pro
                model = genai.GenerativeModel('gemini-1.5-pro')
                
                # Cấu hình Prompt (Lời nhắc)
                prompt = f"""
                Bạn là một trợ lý ảo chuyên phân tích dữ liệu bằng Python.
                Tôi có một tệp dữ liệu đã được tải lên máy chủ tại đường dẫn: '{file_path}'.
                
                Đây là cấu trúc của tệp dữ liệu đó:
                {schema_info}

                Người dùng đang yêu cầu: "{query}"
                
                Nhiệm vụ của bạn: Dựa vào cấu trúc dữ liệu trên, hãy viết ra MÃ NGUỒN PYTHON (sử dụng thư viện pandas và matplotlib nếu cần vẽ biểu đồ) để xử lý đúng yêu cầu của người dùng.
                Lưu ý: Chỉ trả về mã Python nằm trong khối ```python ... ```, tuyệt đối không giải thích bằng văn bản. Không sử dụng hàm input(). Nếu có biểu đồ, hãy lưu lại thành tệp 'output.png'.
                """
                
                # Gửi yêu cầu qua API và nhận kết quả
                response = model.generate_content(prompt)
                ai_generated_code = response.text
                
            except Exception as e:
                ai_generated_code = f"Lỗi trong quá trình gọi AI: {str(e)}"

    # 5. Trả kết quả về cho Frontend
    return {
        "message": "Xử lý thành công",
        "file_name": file.filename,
        "columns": columns,
        "ai_code": ai_generated_code # Đây là mã code do AI viết
    }
