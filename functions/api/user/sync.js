const JWT_ALGO = { name: "HMAC", hash: "SHA-256" };

// 工具函数：验证 JWT 并返回 payload
async function verifyToken(token, secret) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const [header, payload, signature] = parts;
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey("raw", keyData, JWT_ALGO, false, ["verify"]);

        const tokenBase = `${header}.${payload}`;
        const sigData = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

        const isValid = await crypto.subtle.verify("HMAC", key, sigData, encoder.encode(tokenBase));
        if (!isValid) return null;

        const decodedPayload = JSON.parse(atob(payload));
        if (decodedPayload.exp < Math.floor(Date.now() / 1000)) return null;

        return decodedPayload;
    } catch (e) {
        return null;
    }
}

const INIT_SQL = [
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_data (
        user_id INTEGER PRIMARY KEY,
        viewing_history TEXT,
        search_history TEXT,
        favorites TEXT,
        settings TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`
];

async function ensureTables(db) {
    try {
        for (const sql of INIT_SQL) {
            await db.prepare(sql).run();
        }
    } catch (e) {
        console.error("Failed to initialize database:", e);
    }
}

export async function onRequest(context) {
    const { request, env } = context;

    // 0. 数据库绑定检查
    if (!env || !env.DB) {
        return new Response(JSON.stringify({ error: "数据库未绑定 (env.DB is missing)" }), { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyToken(token, env.JWT_SECRET || "default_secret");

    if (!user) {
        return new Response(JSON.stringify({ error: "Token 无效或已过期" }), { status: 401 });
    }

    // 定义内部处理函数以支持重试
    async function handleRequest(isRetry = false) {
        try {
            // 1. 获取同步数据 (GET)
            if (request.method === "GET") {
                const data = await env.DB.prepare(
                    "SELECT viewing_history, search_history, favorites, settings FROM user_data WHERE user_id = ?"
                ).bind(user.id).first();

                return new Response(JSON.stringify(data || {}));
            }

            // 2. 保存同步数据 (POST)
            if (request.method === "POST") {
                const { viewing_history, search_history, favorites, settings } = await request.json();

                // 使用 Upsert (INSERT ON CONFLICT)
                const { success } = await env.DB.prepare(
                    `INSERT INTO user_data (user_id, viewing_history, search_history, favorites, settings, updated_at)
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(user_id) DO UPDATE SET
                     viewing_history = COALESCE(excluded.viewing_history, viewing_history),
                     search_history = COALESCE(excluded.search_history, search_history),
                     favorites = COALESCE(excluded.favorites, favorites),
                     settings = COALESCE(excluded.settings, settings),
                     updated_at = CURRENT_TIMESTAMP`
                ).bind(
                    user.id,
                    viewing_history || null,
                    search_history || null,
                    favorites || null,
                    settings || null
                ).run();

                return new Response(JSON.stringify({ success }));
            }

            return new Response("Method Not Allowed", { status: 405 });

        } catch (e) {
            // 自动修复逻辑
            if (!isRetry && e.message && (e.message.includes("no such table") || e.message.includes("SQLITE_ERROR"))) {
                console.log("Datatabase table missing detected in user.js. Auto-healing...");
                await ensureTables(env.DB);
                return handleRequest(true); // Retry once
            }
            return new Response(JSON.stringify({ error: e.message || "Unknown DB Error" }), { status: 500 });
        }
    }

    return handleRequest();
}
