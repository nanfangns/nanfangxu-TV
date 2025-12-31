-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建用户数据同步表
CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY,
    viewing_history TEXT, -- 存储 JSON 格式的观看历史
    search_history TEXT, -- 存储 JSON 格式的搜索历史
    favorites TEXT, -- 存储 JSON 格式的收藏
    settings TEXT, -- 存储用户偏好设置
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
