function getSearchPageParam(apiId) {
    const defaultParam = API_CONFIG.search.defaultPageParam || 'pg';

    if (apiId.startsWith('custom_')) {
        const customIndex = apiId.replace('custom_', '');
        const customApi = getCustomApiInfo(customIndex);
        return customApi?.pageParam || customApi?.page_param || defaultParam;
    }

    return API_SITES[apiId]?.pageParam || defaultParam;
}

function buildSearchPageUrl(apiBaseUrl, query, page, pageParam) {
    return apiBaseUrl + API_CONFIG.search.pagePath
        .replace('{query}', encodeURIComponent(query))
        .replace('{page}', page)
        .replace('{pageParam}', pageParam);
}

function normalizePageCount(data) {
    const rawCount = data?.pagecount ?? data?.pageCount ?? data?.page_total ?? data?.pageCountAll ?? 1;
    const count = parseInt(rawCount, 10);
    return Number.isNaN(count) || count < 1 ? 1 : count;
}

async function fetchSearchPageData(apiUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ?
            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
            PROXY_URL + encodeURIComponent(apiUrl);

        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function searchByAPIAndKeyWord(apiId, query, page = 1) {
    try {
        let apiName;
        let apiBaseUrl;

        // 处理自定义API
        if (apiId.startsWith('custom_')) {
            const customIndex = apiId.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) return { results: [], pageCount: 1 };

            apiBaseUrl = customApi.url;
            apiName = customApi.name;
        } else {
            // 内置API
            if (!API_SITES[apiId]) return { results: [], pageCount: 1 };
            apiBaseUrl = API_SITES[apiId].api;
            apiName = API_SITES[apiId].name;
        }

        const pageParam = getSearchPageParam(apiId);
        const apiUrl = buildSearchPageUrl(apiBaseUrl, query, page, pageParam);

        let data = await fetchSearchPageData(apiUrl);

        if (!data || !Array.isArray(data.list)) {
            data = null;
        }

        const shouldFallback = !data || data.list.length === 0;
        if (shouldFallback && pageParam === 'pg') {
            const fallbackUrl = buildSearchPageUrl(apiBaseUrl, query, page, 'page');
            const fallbackData = await fetchSearchPageData(fallbackUrl).catch(() => null);
            if (fallbackData && Array.isArray(fallbackData.list)) {
                data = fallbackData;
            }
        } else if (shouldFallback && pageParam === 'page') {
            const fallbackUrl = buildSearchPageUrl(apiBaseUrl, query, page, 'pg');
            const fallbackData = await fetchSearchPageData(fallbackUrl).catch(() => null);
            if (fallbackData && Array.isArray(fallbackData.list)) {
                data = fallbackData;
            }
        }

        if (!data || !Array.isArray(data.list) || data.list.length === 0) {
            return { results: [], pageCount: normalizePageCount(data) };
        }

        const pageCount = normalizePageCount(data);
        const apiUrlForMeta = apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined;

        const results = data.list.map(item => ({
            ...item,
            source_name: apiName,
            source_code: apiId,
            api_url: apiUrlForMeta
        }));

        return { results, pageCount };
    } catch (error) {
        console.warn(`API ${apiId} 搜索失败:`, error);
        return { results: [], pageCount: 1 };
    }
}
