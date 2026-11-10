-- =============================================================================
-- KHÓA LUẬN TỐT NGHIỆP
-- ĐỀ TÀI: TRỢ LÝ AI PHÂN TÍCH DỮ LIỆU VÀ DỰ BÁO TÀI CHÍNH DOANH NGHIỆP
-- SCRIPT KHỞI TẠO CƠ SỞ DỮ LIỆU (POSTGRESQL) - CHỈ CHỨA LƯỢC ĐỒ (SCHEMA) & TÀI KHOẢN ADMIN
-- (Không chứa dữ liệu nghiên cứu / dữ liệu rác thử nghiệm)
-- File: Script.sql
-- =============================================================================

-- 1. BẬT TIỆN ÍCH MỞ RỘNG (EXTENSIONS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TẠO BẢNG NGƯỜI DÙNG (USER)
-- Lưu trữ thông tin tài khoản, mật khẩu mã hóa và phân quyền hệ thống (Admin / Normal User)
CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    full_name VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_user_email ON "user" (email);

-- 3. TẠO BẢNG MỤC (ITEM)
-- Lưu trữ các mục công việc / dữ liệu cá nhân liên kết với người dùng
CREATE TABLE IF NOT EXISTS item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_owner FOREIGN KEY (owner_id) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_item_owner_id ON item (owner_id);

-- 4. TẠO BẢNG TẬP DỮ LIỆU (DATASET)
-- Quản lý kho dữ liệu kinh doanh tải lên (CSV, Excel), siêu dữ liệu, lược đồ và đường dẫn file
CREATE TABLE IF NOT EXISTS dataset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'csv',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'ready',
    description VARCHAR(500),
    schema_info TEXT,
    sample_data TEXT,
    file_path VARCHAR(500) NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dataset_owner FOREIGN KEY (owner_id) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_dataset_owner_id ON dataset (owner_id);
CREATE INDEX IF NOT EXISTS ix_dataset_status ON dataset (status);

-- 5. TẠO BẢNG LỊCH SỬ PHÂN TÍCH (ANALYSIS_HISTORY)
-- Giám sát truy vấn tự nhiên, mã Python sinh bởi AI, log thực thi Sandbox, tài nguyên và biểu đồ
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name VARCHAR(255) NOT NULL,
    query VARCHAR(1000) NOT NULL,
    ai_code TEXT,
    stdout TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    error_message TEXT,
    execution_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    memory_mb DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    chart_image TEXT,
    scope_columns VARCHAR(500),
    user_id UUID NOT NULL,
    dataset_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_history_user FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE,
    CONSTRAINT fk_analysis_history_dataset FOREIGN KEY (dataset_id) REFERENCES dataset (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_analysis_history_user_id ON analysis_history (user_id);
CREATE INDEX IF NOT EXISTS ix_analysis_history_dataset_id ON analysis_history (dataset_id);

-- 6. TẠO BẢNG THEO DÕI PHIÊN BẢN MIGRATION (ALEMBIC_VERSION)
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);

INSERT INTO alembic_version (version_num)
SELECT 'fe56fa70289e'
WHERE NOT EXISTS (SELECT 1 FROM alembic_version WHERE version_num = 'fe56fa70289e');

-- 7. TÀI KHOẢN QUẢN TRỊ VIÊN HỆ THỐNG MẶC ĐỊNH (SYSTEM ADMINISTRATOR)
-- Email: admin@example.com
-- Mật khẩu: changethis (đã mã hóa bảo mật Bcrypt)
INSERT INTO "user" (id, email, hashed_password, is_active, is_superuser, full_name, created_at)
SELECT
    '11111111-1111-1111-1111-111111111111'::uuid,
    'admin@example.com',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    TRUE,
    TRUE,
    'System Administrator',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "user" WHERE email = 'admin@example.com'
);
