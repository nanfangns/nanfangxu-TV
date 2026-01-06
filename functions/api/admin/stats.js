const JWT_ALGO = { name: "HMAC", hash: "SHA-256" };

// 复用验证逻辑
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

    if (!env || !env.DB) {
        return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500 });
    }

    // 1. 鉴权
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyToken(token, env.JWT_SECRET || "default_secret");

    // 2. Admin 权限检查
    if (!user || user.role !== 'admin') {
        return new Response(JSON.stringify({ error: "Forbidden: Admin Access Only" }), { status: 403 });
    }

    try {
        // 3. 统计数据
        // 总用户数
        const totalUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();

        // 数据节点数 (user_data 行数)
        const totalNodes = await env.DB.prepare("SELECT COUNT(*) as count FROM user_data").first();

        // 近期活跃用户 (过去 7 天有数据更新对应的行)
        // 注意：SQLite 的 datetime 计算可能依赖特定格式，这里简化处理，直接用 updated_at 不为 null 的数量作为活跃基数
        // 为了更精确，这里先只返回总存储量

        return new Response(JSON.stringify({
            total_users: totalUsers.count,
            total_nodes: totalNodes.count,
            system_status: "NOMINAL",
            timestamp: Date.now()
        }));

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
