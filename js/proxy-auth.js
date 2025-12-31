/**
 * 代理请求鉴权模块 (已停用旧版密码鉴权)
 */

async function addAuthToProxyUrl(url) {
    if (!url) return url;
    // 如果已经是代理 URL 或本地 URL，则不处理
    if (url.startsWith('/proxy/') || url.startsWith('/') || url.startsWith(window.location.origin)) {
        return url;
    }
    // 转发外部 URL 到代理端
    return `/proxy/${url}`;
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
