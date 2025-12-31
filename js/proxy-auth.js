/**
 * 代理请求鉴权模块 (已停用旧版密码鉴权)
 */

async function addAuthToProxyUrl(url) {
    if (!url) return url;
    // 如果已经是代理 URL 或本地 URL，则不处理
    if (url.startsWith('/proxy/') || url.startsWith('/') || url.startsWith(window.location.origin)) {
        return url;
    }
    // 检查是否为 Cloudflare 支持的端口
    if (!isCloudflareSupportedPort(url)) {
        return url;
    }

    // 转发外部 URL 到代理端
    return `/proxy/${encodeURIComponent(url)}`;
}

// 检查端口是否被 Cloudflare 支持
function isCloudflareSupportedPort(url) {
    try {
        const urlObj = new URL(url);
        const port = urlObj.port;
        // 如果没有显式端口，默认为支持 (80/443)
        if (!port) return true;

        // Cloudflare 支持的端口列表
        // HTTP: 80, 8080, 8880, 2052, 2082, 2086, 2095
        // HTTPS: 443, 2053, 2083, 2087, 2096, 8443
        const supportedPorts = [
            '80', '8080', '8880', '2052', '2082', '2086', '2095',
            '443', '2053', '2083', '2087', '2096', '8443'
        ];

        return supportedPorts.includes(port);
    } catch (e) {
        return true; // 解析失败则默认尝试代理
    }
}


function validateProxyAuth() {
    return true;
}

function clearAuthCache() { }

// 导出函数以保持向下兼容 (不再做任何哈希处理)
window.ProxyAuth = {
    addAuthToProxyUrl,
    validateProxyAuth,
    clearAuthCache,
    getPasswordHash: async () => null
};
