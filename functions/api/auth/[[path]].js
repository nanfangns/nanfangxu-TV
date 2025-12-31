const JWT_ALGO = { name: "HMAC", hash: "SHA-256" };

// 工具函数：生成密码哈希
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// 工具函数：创建 JWT
async function createToken(user, secret) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
        id: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7天过期
    }));

    const tokenBase = `${header}.${payload}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, JWT_ALGO, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenBase));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    return `${tokenBase}.${signature}`;
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
        console.log("Initializing database tables...");
        // 逐条执行 SQL，避免 db.exec 多语句兼容性问题
        for (const sql of INIT_SQL) {
            await db.prepare(sql).run();
        }
        console.log("Database initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize database:", e);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    if (!env.DB) {
        return new Response(JSON.stringify({ error: "数据库未绑定，请检查 CF 配置" }), { status: 500 });
    }

    // 处理请求体
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: "无效的 JSON 请求" }), { status: 400 });
    }
    const { username, password } = body;

    if (!username || !password) {
        return new Response(JSON.stringify({ error: "用户名或密码不能为空" }), { status: 400 });
    }

    async function handleRequest(isRetry = false) {
        try {
            // 1. 注册逻辑
            if (path.endsWith("/register")) {
                const passwordHash = await hashPassword(password);
                try {
                    const { success } = await env.DB.prepare(
                        "INSERT INTO users (username, password_hash) VALUES (?, ?)"
                    ).bind(username, passwordHash).run();

                    if (success) {
                        // 初始化用户数据表
                        const user = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
                        await env.DB.prepare("INSERT INTO user_data (user_id) VALUES (?)").bind(user.id).run();
                        return new Response(JSON.stringify({ message: "注册成功" }), { status: 201 });
                    }
                } catch (e) {
                    if (e.message.includes("UNIQUE")) {
                        return new Response(JSON.stringify({ error: "用户名已存在" }), { status: 400 });
                    }
                    throw e; // 抛出其他错误以便捕获
                }
            }

            // 2. 登录逻辑
            if (path.endsWith("/login")) {
                const passwordHash = await hashPassword(password);
                const user = await env.DB.prepare(
                    "SELECT id, username FROM users WHERE username = ? AND password_hash = ?"
                ).bind(username, passwordHash).first();

                if (!user) {
                    return new Response(JSON.stringify({ error: "用户名或密码错误" }), { status: 401 });
                }

                const token = await createToken(user, env.JWT_SECRET || "default_secret");
                return new Response(JSON.stringify({ token, user: { id: user.id, username: user.username } }));
            }

            return new Response("Not Found", { status: 404 });

        } catch (e) {
            // 捕获 "no such table" 错误并尝试修复
            if (!isRetry && e.message && (e.message.includes("no such table") || e.message.includes("SQLITE_ERROR"))) {
                console.log("Table missing detected. Attempting to initialize DB...");
                await ensureTables(env.DB);
                return handleRequest(true); // 重试一次
            }
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    return handleRequest();
}
