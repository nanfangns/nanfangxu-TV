var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-jmEjBh/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/pages-kLXbzu/functionsWorker-0.17134186471681967.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var urls2 = /* @__PURE__ */ new Set();
function checkURL2(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls2.has(url.toString())) {
      urls2.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL2, "checkURL");
__name2(checkURL2, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL2(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});
var JWT_ALGO = { name: "HMAC", hash: "SHA-256" };
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
__name2(hashPassword, "hashPassword");
async function createToken(user, secret) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    id: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
    // 7天过期
  }));
  const tokenBase = `${header}.${payload}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, JWT_ALGO, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenBase));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${tokenBase}.${signature}`;
}
__name(createToken, "createToken");
__name2(createToken, "createToken");
var INIT_SQL = [
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
    for (const sql of INIT_SQL) {
      await db.prepare(sql).run();
    }
    console.log("Database initialized successfully.");
  } catch (e) {
    console.error("Failed to initialize database:", e);
  }
}
__name(ensureTables, "ensureTables");
__name2(ensureTables, "ensureTables");
async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A\uFF0C\u8BF7\u68C0\u67E5 CF \u914D\u7F6E" }), { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "\u65E0\u6548\u7684 JSON \u8BF7\u6C42" }), { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }), { status: 400 });
  }
  async function handleRequest(isRetry = false) {
    try {
      if (path.endsWith("/register")) {
        const passwordHash = await hashPassword(password);
        try {
          const { success } = await env.DB.prepare(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)"
          ).bind(username, passwordHash).run();
          if (success) {
            const user = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
            await env.DB.prepare("INSERT INTO user_data (user_id) VALUES (?)").bind(user.id).run();
            return new Response(JSON.stringify({ message: "\u6CE8\u518C\u6210\u529F" }), { status: 201 });
          }
        } catch (e) {
          if (e.message.includes("UNIQUE")) {
            return new Response(JSON.stringify({ error: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" }), { status: 400 });
          }
          throw e;
        }
      }
      if (path.endsWith("/login")) {
        const passwordHash = await hashPassword(password);
        const user = await env.DB.prepare(
          "SELECT id, username FROM users WHERE username = ? AND password_hash = ?"
        ).bind(username, passwordHash).first();
        if (!user) {
          return new Response(JSON.stringify({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }), { status: 401 });
        }
        const token = await createToken(user, env.JWT_SECRET || "default_secret");
        return new Response(JSON.stringify({ token, user: { id: user.id, username: user.username } }));
      }
      return new Response("Not Found", { status: 404 });
    } catch (e) {
      if (!isRetry && e.message && (e.message.includes("no such table") || e.message.includes("SQLITE_ERROR"))) {
        console.log("Table missing detected. Attempting to initialize DB...");
        await ensureTables(env.DB);
        return handleRequest(true);
      }
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  __name(handleRequest, "handleRequest");
  __name2(handleRequest, "handleRequest");
  return handleRequest();
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
var JWT_ALGO2 = { name: "HMAC", hash: "SHA-256" };
async function verifyToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, JWT_ALGO2, false, ["verify"]);
    const tokenBase = `${header}.${payload}`;
    const sigData = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify("HMAC", key, sigData, encoder.encode(tokenBase));
    if (!isValid) return null;
    const decodedPayload = JSON.parse(atob(payload));
    if (decodedPayload.exp < Math.floor(Date.now() / 1e3)) return null;
    return decodedPayload;
  } catch (e) {
    return null;
  }
}
__name(verifyToken, "verifyToken");
__name2(verifyToken, "verifyToken");
async function onRequest(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "\u672A\u6388\u6743" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const user = await verifyToken(token, env.JWT_SECRET || "default_secret");
  if (!user) {
    return new Response(JSON.stringify({ error: "Token \u65E0\u6548\u6216\u5DF2\u8FC7\u671F" }), { status: 401 });
  }
  if (request.method === "GET") {
    const data = await env.DB.prepare(
      "SELECT viewing_history, search_history, favorites, settings FROM user_data WHERE user_id = ?"
    ).bind(user.id).first();
    return new Response(JSON.stringify(data || {}));
  }
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
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
var MEDIA_FILE_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".f4v",
  ".m4v",
  ".3gp",
  ".3g2",
  ".ts",
  ".mts",
  ".m2ts",
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".m4a",
  ".flac",
  ".wma",
  ".alac",
  ".aiff",
  ".opus",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
  ".svg",
  ".avif",
  ".heic"
];
var MEDIA_CONTENT_TYPES = ["video/", "audio/", "image/"];
async function onRequest2(context) {
  const { request, env, next, waitUntil } = context;
  const url = new URL(request.url);
  const DEBUG_ENABLED = env.DEBUG === "true";
  const CACHE_TTL = parseInt(env.CACHE_TTL || "86400");
  const MAX_RECURSION = parseInt(env.MAX_RECURSION || "5");
  let USER_AGENTS = [
    // 提供一个基础的默认值
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];
  try {
    const agentsJson = env.USER_AGENTS_JSON;
    if (agentsJson) {
      const parsedAgents = JSON.parse(agentsJson);
      if (Array.isArray(parsedAgents) && parsedAgents.length > 0) {
        USER_AGENTS = parsedAgents;
      } else {
        logDebug("\u73AF\u5883\u53D8\u91CF USER_AGENTS_JSON \u683C\u5F0F\u65E0\u6548\u6216\u4E3A\u7A7A\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u503C");
      }
    }
  } catch (e) {
    logDebug(`\u89E3\u6790\u73AF\u5883\u53D8\u91CF USER_AGENTS_JSON \u5931\u8D25: ${e.message}\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u503C`);
  }
  function logDebug(message) {
    if (DEBUG_ENABLED) {
      console.log(`[Proxy Func] ${message}`);
    }
  }
  __name(logDebug, "logDebug");
  __name2(logDebug, "logDebug");
  function getTargetUrlFromPath(pathname) {
    const encodedUrl = pathname.replace(/^\/proxy\//, "");
    if (!encodedUrl) return null;
    try {
      let decodedUrl = decodeURIComponent(encodedUrl);
      if (!decodedUrl.match(/^https?:\/\//i)) {
        if (encodedUrl.match(/^https?:\/\//i)) {
          decodedUrl = encodedUrl;
          logDebug(`Warning: Path was not encoded but looks like URL: ${decodedUrl}`);
        } else {
          logDebug(`\u65E0\u6548\u7684\u76EE\u6807URL\u683C\u5F0F (\u89E3\u7801\u540E): ${decodedUrl}`);
          return null;
        }
      }
      return decodedUrl;
    } catch (e) {
      logDebug(`\u89E3\u7801\u76EE\u6807URL\u65F6\u51FA\u9519: ${encodedUrl} - ${e.message}`);
      return null;
    }
  }
  __name(getTargetUrlFromPath, "getTargetUrlFromPath");
  __name2(getTargetUrlFromPath, "getTargetUrlFromPath");
  function createResponse(body, status = 200, headers = {}) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        // No Content
        headers: responseHeaders
        // 包含上面设置的 CORS 头
      });
    }
    return new Response(body, { status, headers: responseHeaders });
  }
  __name(createResponse, "createResponse");
  __name2(createResponse, "createResponse");
  function createM3u8Response(content) {
    return createResponse(content, 200, {
      "Content-Type": "application/vnd.apple.mpegurl",
      // M3U8 的标准 MIME 类型
      "Cache-Control": `public, max-age=${CACHE_TTL}`
      // 允许浏览器和CDN缓存
    });
  }
  __name(createM3u8Response, "createM3u8Response");
  __name2(createM3u8Response, "createM3u8Response");
  function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }
  __name(getRandomUserAgent, "getRandomUserAgent");
  __name2(getRandomUserAgent, "getRandomUserAgent");
  function getBaseUrl(urlStr) {
    try {
      const parsedUrl = new URL(urlStr);
      if (!parsedUrl.pathname || parsedUrl.pathname === "/") {
        return `${parsedUrl.origin}/`;
      }
      const pathParts = parsedUrl.pathname.split("/");
      pathParts.pop();
      return `${parsedUrl.origin}${pathParts.join("/")}/`;
    } catch (e) {
      logDebug(`\u83B7\u53D6 BaseUrl \u65F6\u51FA\u9519: ${urlStr} - ${e.message}`);
      const lastSlashIndex = urlStr.lastIndexOf("/");
      return lastSlashIndex > urlStr.indexOf("://") + 2 ? urlStr.substring(0, lastSlashIndex + 1) : urlStr + "/";
    }
  }
  __name(getBaseUrl, "getBaseUrl");
  __name2(getBaseUrl, "getBaseUrl");
  function resolveUrl(baseUrl, relativeUrl) {
    if (relativeUrl.match(/^https?:\/\//i)) {
      return relativeUrl;
    }
    try {
      return new URL(relativeUrl, baseUrl).toString();
    } catch (e) {
      logDebug(`\u89E3\u6790 URL \u5931\u8D25: baseUrl=${baseUrl}, relativeUrl=${relativeUrl}, error=${e.message}`);
      if (relativeUrl.startsWith("/")) {
        const urlObj = new URL(baseUrl);
        return `${urlObj.origin}${relativeUrl}`;
      }
      return `${baseUrl.replace(/\/[^/]*$/, "/")}${relativeUrl}`;
    }
  }
  __name(resolveUrl, "resolveUrl");
  __name2(resolveUrl, "resolveUrl");
  function rewriteUrlToProxy(targetUrl) {
    try {
      const urlObj = new URL(targetUrl);
      const port = urlObj.port;
      if (port) {
        const supportedPorts = [
          "80",
          "8080",
          "8880",
          "2052",
          "2082",
          "2086",
          "2095",
          "443",
          "2053",
          "2083",
          "2087",
          "2096",
          "8443"
        ];
        if (!supportedPorts.includes(port)) {
          logDebug(`\u76EE\u6807 URL \u7AEF\u53E3 ${port} \u4E0D\u53D7 Cloudflare \u652F\u6301\uFF0C\u8DF3\u8FC7\u4EE3\u7406\u91CD\u5199: ${targetUrl}`);
          return targetUrl;
        }
      }
    } catch (e) {
    }
    return `/proxy/${encodeURIComponent(targetUrl)}`;
  }
  __name(rewriteUrlToProxy, "rewriteUrlToProxy");
  __name2(rewriteUrlToProxy, "rewriteUrlToProxy");
  async function fetchContentWithType(targetUrl) {
    const targetOrigin = new URL(targetUrl).origin;
    const headers = new Headers({
      "User-Agent": getRandomUserAgent(),
      "Accept": "*/*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Referer": targetOrigin,
      "Origin": targetOrigin
    });
    try {
      logDebug(`\u5F00\u59CB\u76F4\u63A5\u8BF7\u6C42: ${targetUrl}`);
      const response = await fetch(targetUrl, { headers, redirect: "follow" });
      if (!response.ok) {
        logDebug(`\u4E0A\u6E38\u8FD4\u56DE\u975E 200 \u72B6\u6001: ${response.status} ${response.statusText} - ${targetUrl}`);
      }
      const contentType = response.headers.get("Content-Type") || "";
      logDebug(`\u8BF7\u6C42\u7ED3\u675F: ${targetUrl}, Status: ${response.status}, Content-Type: ${contentType}`);
      return { response, contentType, responseHeaders: response.headers };
    } catch (error) {
      logDebug(`\u8BF7\u6C42\u7F51\u7EDC\u5F02\u5E38: ${targetUrl}: ${error.message}`);
      throw new Error(`\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25 ${targetUrl}: ${error.message}`);
    }
  }
  __name(fetchContentWithType, "fetchContentWithType");
  __name2(fetchContentWithType, "fetchContentWithType");
  function isM3u8Content(content, contentType) {
    if (contentType && (contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("application/x-mpegurl") || contentType.includes("audio/mpegurl"))) {
      return true;
    }
    return content && typeof content === "string" && content.trim().startsWith("#EXTM3U");
  }
  __name(isM3u8Content, "isM3u8Content");
  __name2(isM3u8Content, "isM3u8Content");
  function isMediaFile(url2, contentType) {
    if (contentType) {
      for (const mediaType of MEDIA_CONTENT_TYPES) {
        if (contentType.toLowerCase().startsWith(mediaType)) {
          return true;
        }
      }
    }
    const urlLower = url2.toLowerCase();
    for (const ext of MEDIA_FILE_EXTENSIONS) {
      if (urlLower.endsWith(ext) || urlLower.includes(`${ext}?`)) {
        return true;
      }
    }
    return false;
  }
  __name(isMediaFile, "isMediaFile");
  __name2(isMediaFile, "isMediaFile");
  function processKeyLine(line, baseUrl) {
    return line.replace(/URI="([^"]+)"/, (match2, uri) => {
      const absoluteUri = resolveUrl(baseUrl, uri);
      return `URI="${rewriteUrlToProxy(absoluteUri)}"`;
    });
  }
  __name(processKeyLine, "processKeyLine");
  __name2(processKeyLine, "processKeyLine");
  function processMapLine(line, baseUrl) {
    return line.replace(/URI="([^"]+)"/, (match2, uri) => {
      const absoluteUri = resolveUrl(baseUrl, uri);
      return `URI="${rewriteUrlToProxy(absoluteUri)}"`;
    });
  }
  __name(processMapLine, "processMapLine");
  __name2(processMapLine, "processMapLine");
  function processMediaPlaylist(url2, content) {
    const baseUrl = getBaseUrl(url2);
    const lines = content.split("\n");
    const output = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line && i === lines.length - 1) {
        output.push(line);
        continue;
      }
      if (!line) continue;
      if (line.startsWith("#EXT-X-KEY")) {
        output.push(processKeyLine(line, baseUrl));
        continue;
      }
      if (line.startsWith("#EXT-X-MAP")) {
        output.push(processMapLine(line, baseUrl));
        continue;
      }
      if (line.startsWith("#EXTINF")) {
        output.push(line);
        continue;
      }
      if (!line.startsWith("#")) {
        const absoluteUrl = resolveUrl(baseUrl, line);
        output.push(rewriteUrlToProxy(absoluteUrl));
        continue;
      }
      output.push(line);
    }
    return output.join("\n");
  }
  __name(processMediaPlaylist, "processMediaPlaylist");
  __name2(processMediaPlaylist, "processMediaPlaylist");
  async function processM3u8Content(targetUrl, content, recursionDepth = 0, env2) {
    if (content.includes("#EXT-X-STREAM-INF") || content.includes("#EXT-X-MEDIA:")) {
      logDebug(`\u68C0\u6D4B\u5230\u4E3B\u64AD\u653E\u5217\u8868: ${targetUrl}`);
      return await processMasterPlaylist(targetUrl, content, recursionDepth, env2);
    }
    logDebug(`\u68C0\u6D4B\u5230\u5A92\u4F53\u64AD\u653E\u5217\u8868: ${targetUrl}`);
    return processMediaPlaylist(targetUrl, content);
  }
  __name(processM3u8Content, "processM3u8Content");
  __name2(processM3u8Content, "processM3u8Content");
  async function processMasterPlaylist(url2, content, recursionDepth, env2) {
    if (recursionDepth > MAX_RECURSION) {
      throw new Error(`\u5904\u7406\u4E3B\u5217\u8868\u65F6\u9012\u5F52\u5C42\u6570\u8FC7\u591A (${MAX_RECURSION}): ${url2}`);
    }
    const baseUrl = getBaseUrl(url2);
    const lines = content.split("\n");
    let highestBandwidth = -1;
    let bestVariantUrl = "";
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
        const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
        const currentBandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
        let variantUriLine = "";
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j].trim();
          if (line && !line.startsWith("#")) {
            variantUriLine = line;
            i = j;
            break;
          }
        }
        if (variantUriLine && currentBandwidth >= highestBandwidth) {
          highestBandwidth = currentBandwidth;
          bestVariantUrl = resolveUrl(baseUrl, variantUriLine);
        }
      }
    }
    if (!bestVariantUrl) {
      logDebug(`\u4E3B\u5217\u8868\u4E2D\u672A\u627E\u5230 BANDWIDTH \u6216 STREAM-INF\uFF0C\u5C1D\u8BD5\u67E5\u627E\u7B2C\u4E00\u4E2A\u5B50\u5217\u8868\u5F15\u7528: ${url2}`);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith("#") && (line.endsWith(".m3u8") || line.includes(".m3u8?"))) {
          bestVariantUrl = resolveUrl(baseUrl, line);
          logDebug(`\u5907\u9009\u65B9\u6848\uFF1A\u627E\u5230\u7B2C\u4E00\u4E2A\u5B50\u5217\u8868\u5F15\u7528: ${bestVariantUrl}`);
          break;
        }
      }
    }
    if (!bestVariantUrl) {
      logDebug(`\u5728\u4E3B\u5217\u8868 ${url2} \u4E2D\u672A\u627E\u5230\u4EFB\u4F55\u6709\u6548\u7684\u5B50\u64AD\u653E\u5217\u8868 URL\u3002\u53EF\u80FD\u683C\u5F0F\u6709\u95EE\u9898\u6216\u4EC5\u5305\u542B\u97F3\u9891/\u5B57\u5E55\u3002\u5C06\u5C1D\u8BD5\u6309\u5A92\u4F53\u5217\u8868\u5904\u7406\u539F\u59CB\u5185\u5BB9\u3002`);
      return processMediaPlaylist(url2, content);
    }
    const cacheKey = `m3u8_processed:${bestVariantUrl}`;
    let kvNamespace = null;
    try {
      kvNamespace = env2.LIBRETV_PROXY_KV;
      if (!kvNamespace) throw new Error("KV \u547D\u540D\u7A7A\u95F4\u672A\u7ED1\u5B9A");
    } catch (e) {
      logDebug(`KV \u547D\u540D\u7A7A\u95F4 'LIBRETV_PROXY_KV' \u8BBF\u95EE\u51FA\u9519\u6216\u672A\u7ED1\u5B9A: ${e.message}`);
      kvNamespace = null;
    }
    if (kvNamespace) {
      try {
        const cachedContent = await kvNamespace.get(cacheKey);
        if (cachedContent) {
          logDebug(`[\u7F13\u5B58\u547D\u4E2D] \u4E3B\u5217\u8868\u7684\u5B50\u5217\u8868: ${bestVariantUrl}`);
          return cachedContent;
        } else {
          logDebug(`[\u7F13\u5B58\u672A\u547D\u4E2D] \u4E3B\u5217\u8868\u7684\u5B50\u5217\u8868: ${bestVariantUrl}`);
        }
      } catch (kvError) {
        logDebug(`\u4ECE KV \u8BFB\u53D6\u7F13\u5B58\u5931\u8D25 (${cacheKey}): ${kvError.message}`);
      }
    }
    logDebug(`\u9009\u62E9\u7684\u5B50\u5217\u8868 (\u5E26\u5BBD: ${highestBandwidth}): ${bestVariantUrl}`);
    const { response: variantResp, contentType: variantContentType } = await fetchContentWithType(bestVariantUrl);
    const variantContent = await variantResp.text();
    if (!isM3u8Content(variantContent, variantContentType)) {
      logDebug(`\u83B7\u53D6\u5230\u7684\u5B50\u5217\u8868 ${bestVariantUrl} \u4E0D\u662F M3U8 \u5185\u5BB9 (\u7C7B\u578B: ${variantContentType})\u3002\u53EF\u80FD\u76F4\u63A5\u662F\u5A92\u4F53\u6587\u4EF6\uFF0C\u8FD4\u56DE\u539F\u59CB\u5185\u5BB9\u3002`);
      return processMediaPlaylist(bestVariantUrl, variantContent);
    }
    const processedVariant = await processM3u8Content(bestVariantUrl, variantContent, recursionDepth + 1, env2);
    if (kvNamespace) {
      try {
        waitUntil(kvNamespace.put(cacheKey, processedVariant, { expirationTtl: CACHE_TTL }));
        logDebug(`\u5DF2\u5C06\u5904\u7406\u540E\u7684\u5B50\u5217\u8868\u5199\u5165\u7F13\u5B58: ${bestVariantUrl}`);
      } catch (kvError) {
        logDebug(`\u5411 KV \u5199\u5165\u7F13\u5B58\u5931\u8D25 (${cacheKey}): ${kvError.message}`);
      }
    }
    return processedVariant;
  }
  __name(processMasterPlaylist, "processMasterPlaylist");
  __name2(processMasterPlaylist, "processMasterPlaylist");
  try {
    const targetUrl = getTargetUrlFromPath(url.pathname);
    if (!targetUrl) {
      logDebug(`\u65E0\u6548\u7684\u4EE3\u7406\u8BF7\u6C42\u8DEF\u5F84: ${url.pathname}`);
      return createResponse("\u65E0\u6548\u7684\u4EE3\u7406\u8BF7\u6C42\u3002\u8DEF\u5F84\u5E94\u4E3A /proxy/<\u7ECF\u8FC7\u7F16\u7801\u7684URL>", 400);
    }
    logDebug(`\u6536\u5230\u4EE3\u7406\u8BF7\u6C42: ${targetUrl}`);
    const cacheKey = `proxy_raw:${targetUrl}`;
    let kvNamespace = null;
    try {
      kvNamespace = env.NANFANGXU_PROXY_KV;
      if (!kvNamespace) throw new Error("KV \u547D\u540D\u7A7A\u95F4\u672A\u7ED1\u5B9A");
    } catch (e) {
      logDebug(`KV \u547D\u540D\u7A7A\u95F4 'LIBRETV_PROXY_KV' \u8BBF\u95EE\u51FA\u9519\u6216\u672A\u7ED1\u5B9A: ${e.message}`);
      kvNamespace = null;
    }
    if (kvNamespace) {
      try {
        const cachedDataJson = await kvNamespace.get(cacheKey);
        if (cachedDataJson) {
          logDebug(`[\u7F13\u5B58\u547D\u4E2D] \u539F\u59CB\u5185\u5BB9: ${targetUrl}`);
          const cachedData = JSON.parse(cachedDataJson);
          const content = cachedData.body;
          let headers = {};
          try {
            headers = JSON.parse(cachedData.headers);
          } catch (e) {
          }
          const contentType2 = headers["content-type"] || headers["Content-Type"] || "";
          if (isM3u8Content(content, contentType2)) {
            logDebug(`\u7F13\u5B58\u5185\u5BB9\u662F M3U8\uFF0C\u91CD\u65B0\u5904\u7406: ${targetUrl}`);
            const processedM3u8 = await processM3u8Content(targetUrl, content, 0, env);
            return createM3u8Response(processedM3u8);
          } else {
            logDebug(`\u4ECE\u7F13\u5B58\u8FD4\u56DE\u975E M3U8 \u5185\u5BB9: ${targetUrl}`);
            return createResponse(content, 200, new Headers(headers));
          }
        } else {
          logDebug(`[\u7F13\u5B58\u672A\u547D\u4E2D] \u539F\u59CB\u5185\u5BB9: ${targetUrl}`);
        }
      } catch (kvError) {
        logDebug(`\u4ECE KV \u8BFB\u53D6\u6216\u89E3\u6790\u7F13\u5B58\u5931\u8D25 (${cacheKey}): ${kvError.message}`);
      }
    }
    const { response: targetResp, contentType, responseHeaders } = await fetchContentWithType(targetUrl);
    if (isM3u8Content("", contentType)) {
      const content = await targetResp.text();
      logDebug(`\u5185\u5BB9\u662F M3U8\uFF0C\u5F00\u59CB\u5904\u7406: ${targetUrl}`);
      if (kvNamespace) {
        const headersToCache = {};
        responseHeaders.forEach((v, k) => {
          headersToCache[k.toLowerCase()] = v;
        });
        waitUntil(kvNamespace.put(cacheKey, JSON.stringify({ body: content, headers: JSON.stringify(headersToCache) }), { expirationTtl: CACHE_TTL }));
      }
      const processedM3u8 = await processM3u8Content(targetUrl, content, 0, env);
      return createM3u8Response(processedM3u8);
    } else {
      logDebug(`\u5185\u5BB9\u4E3A\u4E8C\u8FDB\u5236\u6D41\u6216\u975E M3U8 (\u7C7B\u578B: ${contentType})\uFF0C\u5F00\u59CB\u900F\u4F20: ${targetUrl}`);
      const finalHeaders = new Headers(responseHeaders);
      finalHeaders.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
      finalHeaders.set("Access-Control-Allow-Origin", "*");
      finalHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      finalHeaders.set("Access-Control-Allow-Headers", "*");
      return new Response(targetResp.body, {
        status: targetResp.status,
        headers: finalHeaders
      });
    }
  } catch (error) {
    logDebug(`\u5904\u7406\u4EE3\u7406\u8BF7\u6C42\u65F6\u53D1\u751F\u4E25\u91CD\u9519\u8BEF: ${error.message} 
 ${error.stack}`);
    return createResponse(`\u4EE3\u7406\u5904\u7406\u9519\u8BEF: ${error.message}`, 500);
  }
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest");
async function onRequest3(context) {
  return await context.next();
}
__name(onRequest3, "onRequest3");
__name2(onRequest3, "onRequest");
var routes = [
  {
    routePath: "/api/auth/:path*",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/user",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/proxy/:path*",
    mountPath: "/proxy",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest3],
    modules: []
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-jmEjBh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-jmEjBh/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.17134186471681967.js.map
