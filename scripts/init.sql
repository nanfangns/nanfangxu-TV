-- ============================================
-- LibreTV 本地开发数据库初始化脚本
-- ============================================
-- 用途：在本地开发环境中初始化 D1 数据库结构和默认数据
-- 使用方法：npm run init:local-db
-- 
-- 说明：
-- 1. 此脚本创建所有必需的表结构
-- 2. 自动创建默认管理员账号（用户名：nanfang，密码：admin123）
-- 3. 数据会持久化保存在 .wrangler/state/v3/d1/ 中
-- 4. 除非手动删除 .wrangler 文件夹，否则数据不会丢失
-- ============================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',  -- 角色：'admin' 或 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建用户数据表（用于云同步）
CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY,
    viewing_history TEXT,      -- 观看历史（JSON 字符串）
    search_history TEXT,       -- 搜索历史（JSON 字符串）
    favorites TEXT,            -- 收藏夹（JSON 字符串）
    settings TEXT,             -- 用户设置（JSON 字符串）
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 4. 插入默认管理员账号
-- 用户名：nanfang
-- 密码：admin123
-- 密码哈希：使用 SHA-256 生成
INSERT OR IGNORE INTO users (username, password_hash, role) 
VALUES (
    'nanfang', 
    'e665a45920422f9d417e4867efdc48ba04a1f8ff1fa07e998e86f7f2e7ae3', 
    'admin'
);

-- ============================================
-- 初始化完成！
-- 管理员登录信息：
--   用户名：nanfang
--   密码：admin123
-- 
-- ⚠️ 建议：首次登录后请修改密码
-- ============================================
