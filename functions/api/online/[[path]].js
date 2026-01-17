const JWT_ALGO = { name: "HMAC", hash: "SHA-256" };
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const INIT_SQL = [
    `CREATE TABLE IF NOT EXISTS user_presence (
        user_id INTEGER PRIMARY KEY,
        last_seen INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen)`
];

async function ensureTables(db) {
    for (const sql of INIT_SQL) {
        await db.prepare(sql).run();
    }
}

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

async function cleanupStalePresence(db, cutoff) {
    await db.prepare("DELETE FROM user_presence WHERE last_seen < ?").bind(cutoff).run();
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    if (!env || !env.DB) {
        return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500 });
    }

    try {
        await ensureTables(env.DB);
    } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to initialize tables" }), { status: 500 });
    }

    if (path.endsWith("/ping") && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        const user = await verifyToken(token, env.JWT_SECRET || "default_secret");
        if (!user) {
            return new Response(JSON.stringify({ error: "Token 无效或已过期" }), { status: 401 });
        }

        const now = Date.now();
        const cutoff = now - ACTIVE_WINDOW_MS;
        await cleanupStalePresence(env.DB, cutoff);
        await env.DB.prepare(
            `INSERT INTO user_presence (user_id, last_seen)
             VALUES (?, ?)
             ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen`
        ).bind(user.id, now).run();

        return new Response(JSON.stringify({ ok: true, last_seen: now }));
    }

    if (path.endsWith("/count") && request.method === "GET") {
        const now = Date.now();
        const cutoff = now - ACTIVE_WINDOW_MS;
        await cleanupStalePresence(env.DB, cutoff);
        const row = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM user_presence WHERE last_seen >= ?"
        ).bind(cutoff).first();

        return new Response(JSON.stringify({ count: row ? row.count : 0 }));
    }

    return new Response("Not Found", { status: 404 });
}
