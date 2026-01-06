const JWT_ALGO = { name: "HMAC", hash: "SHA-256" };

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

    if (!env || !env.DB) return new Response(JSON.stringify({ error: "DB Error" }), { status: 500 });

    // Auth Guard
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const user = await verifyToken(authHeader.split(" ")[1], env.JWT_SECRET || "default_secret");
    if (!user || user.role !== 'admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    if (request.method === "GET") {
        try {
            // 查询用户列表，包含关联的数据行存在性检查
            // 使用 LEFT JOIN 检查 user_data 是否存在，返回 has_data (boolean)
            const users = await env.DB.prepare(`
                SELECT 
                    u.id, 
                    u.username, 
                    u.role, 
                    u.created_at,
                    CASE WHEN ud.user_id IS NOT NULL THEN 1 ELSE 0 END as has_data
                FROM users u
                LEFT JOIN user_data ud ON u.id = ud.user_id
                ORDER BY u.id DESC
                LIMIT 100
            `).all();

            return new Response(JSON.stringify(users.results));
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    return new Response("Method not allowed", { status: 405 });
}
