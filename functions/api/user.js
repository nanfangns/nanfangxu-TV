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

export async function onRequest(context) {
    const { request, env } = context;
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyToken(token, env.JWT_SECRET || "default_secret");

    if (!user) {
        return new Response(JSON.stringify({ error: "Token 无效或已过期" }), { status: 401 });
    }

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

        const { success } = await env.DB.prepare(
            `UPDATE user_data SET
             viewing_history = COALESCE(?, viewing_history),
             search_history = COALESCE(?, search_history),
             favorites = COALESCE(?, favorites),
             settings = COALESCE(?, settings),
             updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`
        ).bind(
            viewing_history ? JSON.stringify(viewing_history) : null,
            search_history ? JSON.stringify(search_history) : null,
            favorites ? JSON.stringify(favorites) : null,
            settings ? JSON.stringify(settings) : null,
            user.id
        ).run();

        return new Response(JSON.stringify({ success }));
    }

    return new Response("Method Not Allowed", { status: 405 });
}
