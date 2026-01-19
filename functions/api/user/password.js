const JWT_ALGO = { name: "HMAC", hash: "SHA-256" };

// 工具函数：生成密码哈希 (Copy from auth/[[path]].js)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// 工具函数：验证 JWT 并返回 payload (Copy from user/sync.js)
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

export async function onRequestPost(context) {
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

    // 处理请求体
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: "无效的 JSON 请求" }), { status: 400 });
    }
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
        return new Response(JSON.stringify({ error: "旧密码和新密码不能为空" }), { status: 400 });
    }

    if (newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "新密码长度至少需要6位" }), { status: 400 });
    }

    try {
        // 验证旧密码
        const oldHash = await hashPassword(oldPassword);
        const dbUser = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? AND password_hash = ?"
        ).bind(user.id, oldHash).first();

        if (!dbUser) {
            return new Response(JSON.stringify({ error: "旧密码错误" }), { status: 403 });
        }

        // 更新新密码
        const newHash = await hashPassword(newPassword);
        const { success } = await env.DB.prepare(
            "UPDATE users SET password_hash = ? WHERE id = ?"
        ).bind(newHash, user.id).run();

        if (success) {
            return new Response(JSON.stringify({ message: "密码修改成功" }), { status: 200 });
        } else {
            return new Response(JSON.stringify({ error: "密码更新失败" }), { status: 500 });
        }

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message || "Database Error" }), { status: 500 });
    }
}
