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

export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    if (!env.DB) {
        return new Response(JSON.stringify({ error: "数据库未绑定，请检查 CF 配置" }), { status: 500 });
    }

    const { username, password } = await request.json();

    if (!username || !password) {
        return new Response(JSON.stringify({ error: "用户名或密码不能为空" }), { status: 400 });
    }

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
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
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
}
