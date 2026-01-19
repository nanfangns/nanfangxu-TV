// 豆瓣热门电影电视剧推荐功能

// 豆瓣标签列表 - 修改为默认标签
let defaultMovieTags = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动作', '喜剧', '日综', '爱情', '科幻', '悬疑', '恐怖', '治愈'];
let defaultTvTags = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];

// 用户标签列表 - 存储用户实际使用的标签（包含保留的系统标签和用户添加的自定义标签）
let movieTags = [];
let tvTags = [];

// 加载用户标签
function loadUserTags() {
    try {
        // 尝试从本地存储加载用户保存的标签
        const savedMovieTags = localStorage.getItem('userMovieTags');
        const savedTvTags = localStorage.getItem('userTvTags');

        // 如果本地存储中有标签数据，则使用它
        if (savedMovieTags) {
            movieTags = JSON.parse(savedMovieTags);
        } else {
            // 否则使用默认标签
            movieTags = [...defaultMovieTags];
        }

        if (savedTvTags) {
            tvTags = JSON.parse(savedTvTags);
        } else {
            // 否则使用默认标签
            tvTags = [...defaultTvTags];
        }
    } catch (e) {
        console.error('加载标签失败：', e);
        // 初始化为默认值，防止错误
        movieTags = [...defaultMovieTags];
        tvTags = [...defaultTvTags];
    }
}

// 保存用户标签
function saveUserTags() {
    try {
        localStorage.setItem('userMovieTags', JSON.stringify(movieTags));
        localStorage.setItem('userTvTags', JSON.stringify(tvTags));
    } catch (e) {
        console.error('保存标签失败：', e);
        showToast('保存标签失败', 'error');
    }
}

let doubanMovieTvCurrentSwitch = 'movie';
let doubanCurrentTag = '热门';
let doubanPageStart = 0;
const doubanPageSize = 20; // 瀑布流建议页大小稍微大一点保证铺满
let isDoubanLoading = false; // 加载锁
let hasMoreDouban = true; // 是否还有更多数据
let doubanObserver = null; // 滚动观察器

// 初始化豆瓣功能
let isDoubanInitialized = false;
function initDouban() {
    if (isDoubanInitialized) return;
    isDoubanInitialized = true;
    // 设置豆瓣开关的初始状态
    const doubanToggle = document.getElementById('doubanToggle');
    if (doubanToggle) {
        const isEnabled = localStorage.getItem('doubanEnabled') === 'true';
        doubanToggle.checked = isEnabled;

        // 设置开关外观
        const toggleBg = doubanToggle.nextElementSibling;
        const toggleDot = toggleBg.nextElementSibling;
        if (isEnabled) {
            toggleBg.classList.add('google-bg-active');
            toggleDot.classList.add('translate-x-6');
        }

        // 添加事件监听
        doubanToggle.addEventListener('change', function (e) {
            const isChecked = e.target.checked;
            localStorage.setItem('doubanEnabled', isChecked);

            // 更新开关外观
            if (isChecked) {
                toggleBg.classList.add('google-bg-active');
                toggleDot.classList.add('translate-x-6');
            } else {
                toggleBg.classList.remove('google-bg-active');
                toggleDot.classList.remove('translate-x-6');
            }

            // 更新显示状态
            updateDoubanVisibility();
        });

        // 初始更新显示状态
        updateDoubanVisibility();

        // 滚动到页面顶部
        window.scrollTo(0, 0);
    }

    // 加载用户标签
    loadUserTags();

    // 渲染电影/电视剧切换
    renderDoubanMovieTvSwitch();

    // 渲染豆瓣标签
    renderDoubanTags();

    // 换一批按钮保留（点击则重置瀑布流）
    setupDoubanRefreshBtn();

    // 启动无限滚动观察
    initInfiniteScroll();

    // 初始加载热门内容
    if (localStorage.getItem('doubanEnabled') === 'true') {
        renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
    }
}

// 初始化无限滚动观察器
function initInfiniteScroll() {
    const loaderAnchor = document.getElementById('douban-load-more');
    if (!loaderAnchor) return;

    // 如果已存在观察器则断开
    if (doubanObserver) doubanObserver.disconnect();

    doubanObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        // 如果启用豆瓣 且 露出底部 且 不在加载中 且 还有更多数据
        if (entry.isIntersecting &&
            localStorage.getItem('doubanEnabled') === 'true' &&
            !isDoubanLoading &&
            hasMoreDouban &&
            document.getElementById('doubanArea') &&
            !document.getElementById('doubanArea').classList.contains('hidden')) {

            loadNextDoubanPage();
        }
    }, {
        rootMargin: '100px', // 适度提前触发
        threshold: 0 // 只要露出一点就触发
    });

    doubanObserver.observe(loaderAnchor);
}

// 加载下一页的统一入口
function loadNextDoubanPage() {
    if (isDoubanLoading || !hasMoreDouban) return;

    console.log('瀑布流触底，加载下一页...');
    doubanPageStart += doubanPageSize;

    // 豆瓣 API 硬限制通常在 100-200 左右
    if (doubanPageStart < 200) {
        renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart, true);
    } else {
        hasMoreDouban = false;
        const infiniteLoader = document.querySelector('#douban-load-more .douban-loader-tech');
        if (infiniteLoader) infiniteLoader.innerHTML = '<span class="text-gray-500 text-xs py-4">已到底部 - 核心数据库同步完毕</span>';
    }
}

// 根据设置更新豆瓣区域的显示状态
function updateDoubanVisibility() {
    const doubanArea = document.getElementById('doubanArea');
    if (!doubanArea) return;

    const isEnabled = localStorage.getItem('doubanEnabled') === 'true';
    const isSearching = document.getElementById('resultsArea') &&
        !document.getElementById('resultsArea').classList.contains('hidden');

    // 只有在启用且没有搜索结果显示时才显示豆瓣区域
    if (isEnabled && !isSearching) {
        doubanArea.classList.remove('hidden');
        // 如果豆瓣结果为空，重新加载
        const resultsContainer = document.getElementById('douban-results');
        if (resultsContainer && resultsContainer.children.length === 0) {
            doubanPageStart = 0;
            renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
        }
    } else {
        doubanArea.classList.add('hidden');
    }
}

// 只填充搜索框，不执行搜索，让用户自主决定搜索时机
function fillSearchInput(title) {
    if (!title) return;

    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;

        // 聚焦搜索框，便于用户立即使用键盘操作
        input.focus();

        // 显示一个提示，告知用户点击搜索按钮进行搜索
        showToast('已填充搜索内容，点击搜索按钮开始搜索', 'info');
    }
}

// 填充搜索框并执行搜索
function fillAndSearch(title) {
    if (!title) return;

    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        search(); // 使用已有的search函数执行搜索
    }
}

// 填充搜索框，确保豆瓣资源API被选中，然后执行搜索
async function fillAndSearchWithDouban(title) {
    if (!title) return;

    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // 确保豆瓣资源API被选中
    if (typeof selectedAPIs !== 'undefined' && !selectedAPIs.includes('dbzy')) {
        // 在设置中勾选豆瓣资源API复选框
        const doubanCheckbox = document.querySelector('input[id="api_dbzy"]');
        if (doubanCheckbox) {
            doubanCheckbox.checked = true;

            // 触发updateSelectedAPIs函数以更新状态
            if (typeof updateSelectedAPIs === 'function') {
                updateSelectedAPIs();
            } else {
                // 如果函数不可用，则手动添加到selectedAPIs
                selectedAPIs.push('dbzy');
                localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

                // 更新选中API计数（如果有这个元素）
                const countEl = document.getElementById('selectedAPICount');
                if (countEl) {
                    countEl.textContent = selectedAPIs.length;
                }
            }

            showToast('已自动选择豆瓣资源API', 'info');
        }
    }

    // 填充搜索框并执行搜索
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        await search(); // 使用已有的search函数执行搜索

        if (window.innerWidth <= 768) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }
}

// 渲染电影/电视剧切换器
function renderDoubanMovieTvSwitch() {
    // 获取切换按钮元素
    const movieToggle = document.getElementById('douban-movie-toggle');
    const tvToggle = document.getElementById('douban-tv-toggle');

    if (!movieToggle || !tvToggle) return;

    movieToggle.addEventListener('click', function () {
        if (doubanMovieTvCurrentSwitch !== 'movie') {
            // 更新按钮样式
            movieToggle.classList.add('google-bg-active', 'text-white');
            movieToggle.classList.remove('text-gray-300');

            tvToggle.classList.remove('google-bg-active', 'text-white');
            tvToggle.classList.add('text-gray-300');

            doubanMovieTvCurrentSwitch = 'movie';
            doubanCurrentTag = '热门';
            doubanPageStart = 0;
            hasMoreDouban = true;

            // 重新加载豆瓣内容
            renderDoubanTags(movieTags);

            // 换一批按钮事件监听
            setupDoubanRefreshBtn();

            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
            }
        }
    });

    // 电视剧按钮点击事件
    tvToggle.addEventListener('click', function () {
        if (doubanMovieTvCurrentSwitch !== 'tv') {
            // 更新按钮样式
            tvToggle.classList.add('google-bg-active', 'text-white');
            tvToggle.classList.remove('text-gray-300');

            movieToggle.classList.remove('google-bg-active', 'text-white');
            movieToggle.classList.add('text-gray-300');

            doubanMovieTvCurrentSwitch = 'tv';
            doubanCurrentTag = '热门';
            doubanPageStart = 0;
            hasMoreDouban = true;

            // 重新加载豆瓣内容
            renderDoubanTags(tvTags);

            // 换一批按钮事件监听
            setupDoubanRefreshBtn();

            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
            }
        }
    });
}

// 渲染豆瓣标签选择器
function renderDoubanTags(tags) {
    const tagContainer = document.getElementById('douban-tags');
    if (!tagContainer) return;

    // 确定当前应该使用的标签列表
    const currentTags = doubanMovieTvCurrentSwitch === 'movie' ? movieTags : tvTags;

    // 清空标签容器
    tagContainer.innerHTML = '';

    // 先添加标签管理按钮
    const manageBtn = document.createElement('button');
    manageBtn.className = 'douban-tag flex items-center gap-1';
    manageBtn.innerHTML = '<span class="flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>管理</span>';
    manageBtn.onclick = function () {
        showTagManageModal();
    };
    tagContainer.appendChild(manageBtn);

    // 添加所有标签
    currentTags.forEach(tag => {
        const btn = document.createElement('button');

        // 设置样式
        let btnClass = 'douban-tag ';

        // 当前选中的标签使用高亮样式
        if (tag === doubanCurrentTag) {
            btnClass += 'active';
        }

        btn.className = btnClass;
        btn.textContent = tag;

        btn.onclick = function () {
            if (doubanCurrentTag !== tag) {
                doubanCurrentTag = tag;
                doubanPageStart = 0;
                hasMoreDouban = true;
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
                renderDoubanTags();
            }
        };

        tagContainer.appendChild(btn);
    });
}

// 设置换一批按钮点击重置到第一页
function setupDoubanRefreshBtn() {
    const btn = document.getElementById('douban-refresh');
    if (!btn) return;

    btn.onclick = function () {
        doubanPageStart = 0;
        hasMoreDouban = true;
        // 滚动回顶部
        const doubanArea = document.getElementById('doubanArea');
        if (doubanArea) {
            doubanArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
    };
}

function fetchDoubanTags() {
    const movieTagsTarget = `https://movie.douban.com/j/search_tags?type=movie`
    fetchDoubanData(movieTagsTarget)
        .then(data => {
            movieTags = data.tags;
            if (doubanMovieTvCurrentSwitch === 'movie') {
                renderDoubanTags(movieTags);
            }
        })
        .catch(error => {
            console.error("获取豆瓣热门电影标签失败：", error);
        });
    const tvTagsTarget = `https://movie.douban.com/j/search_tags?type=tv`
    fetchDoubanData(tvTagsTarget)
        .then(data => {
            tvTags = data.tags;
            if (doubanMovieTvCurrentSwitch === 'tv') {
                renderDoubanTags(tvTags);
            }
        })
        .catch(error => {
            console.error("获取豆瓣热门电视剧标签失败：", error);
        });
}

// 渲染热门推荐内容
function renderRecommend(tag, pageLimit, pageStart, isAppend = false) {
    const container = document.getElementById("douban-results");
    const infiniteLoader = document.querySelector('#douban-load-more .douban-loader-tech');
    if (!container) return;

    if (isDoubanLoading) return;
    isDoubanLoading = true;

    // 显示加载状态
    if (!isAppend) {
        container.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center">
                <div class="bouncing-loader mb-4">
                    <div class="bouncing-ball ball-1"></div>
                    <div class="bouncing-ball ball-2"></div>
                    <div class="bouncing-ball ball-3"></div>
                    <div class="bouncing-ball ball-4"></div>
                </div>
                <span class="loading-text-tech">SYNCHRONIZING_DATABASE</span>
            </div>
        `;
    } else if (infiniteLoader) {
        infiniteLoader.classList.remove('hidden');
    }

    const target = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

    fetchDoubanData(target)
        .then(data => {
            if (infiniteLoader) infiniteLoader.classList.add('hidden');

            // 判断是否还有更多内容
            if (!data.subjects || data.subjects.length < doubanPageSize) {
                hasMoreDouban = false;
                if (isAppend && infiniteLoader) {
                    infiniteLoader.parentElement.innerHTML = '<span class="text-gray-500 text-xs py-4">到底了 - 没有更多数据了</span>';
                }
            }

            renderDoubanCards(data, container, isAppend);
            isDoubanLoading = false;

            // 关键修复：渲染完成后检查锚点，如果还在视口内且还有更多，则继续加载下一页
            // 解决首屏太长或加载数据太少无法再次触发 IntersectionObserver 的问题
            if (hasMoreDouban) {
                setTimeout(() => {
                    const loaderAnchor = document.getElementById('douban-load-more');
                    if (loaderAnchor) {
                        const rect = loaderAnchor.getBoundingClientRect();
                        if (rect.top < window.innerHeight + 100) {
                            loadNextDoubanPage();
                        }
                    }
                }, 500); // 留出布局渲染缓冲时间
            }
        })
        .catch(error => {
            isDoubanLoading = false;
            console.error("获取豆瓣数据失败：", error);
            if (infiniteLoader) infiniteLoader.classList.add('hidden');
            if (!isAppend) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <div class="text-red-400">❌ 数据链路中断，请检查网络或代理</div>
                    </div>
                `;
            }
        });
}

async function fetchDoubanData(url) {
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    // 设置请求选项，包括信号和头部
    const fetchOptions = {
        signal: controller.signal,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': 'https://movie.douban.com/',
            'Accept': 'application/json, text/plain, */*',
        }
    };

    try {
        // 添加鉴权参数到代理URL
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ?
            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(url)) :
            PROXY_URL + encodeURIComponent(url);

        // 尝试直接访问（豆瓣API可能允许部分CORS请求）
        const response = await fetch(proxiedUrl, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error("豆瓣 API 请求失败（直接代理）：", err);

        // 失败后尝试备用方法：作为备选
        const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

        try {
            const fallbackResponse = await fetch(fallbackUrl);

            if (!fallbackResponse.ok) {
                throw new Error(`备用API请求失败! 状态: ${fallbackResponse.status}`);
            }

            const data = await fallbackResponse.json();

            // 解析原始内容
            if (data && data.contents) {
                return JSON.parse(data.contents);
            } else {
                throw new Error("无法获取有效数据");
            }
        } catch (fallbackErr) {
            console.error("豆瓣 API 备用请求也失败：", fallbackErr);
            throw fallbackErr; // 向上抛出错误，让调用者处理
        }
    }
}

// 渲染豆瓣卡片 - Masonry Layout Optimization version
function renderDoubanCards(data, container, isAppend = false) {
    // 1. 确保容器初始化为 Masonry 结构
    initMasonryStructure(container);

    if (!data.subjects || data.subjects.length === 0) {
        if (!isAppend) {
            // 如果是初始空状态，需要清空 Masonry 容器内的列内容，而不是 Masonry 容器本身
            masonryColumns.forEach(col => col.innerHTML = '');
            // 或者显示一个全宽的空状态提示（需要绝对定位或特殊处理，简单起见我们放在容器前或者用特制元素）
            // 这里简单处理：如果完全没数据，就重置容器显示提示
            container.innerHTML = `
                <div class="col-span-full w-full text-center py-20 text-gray-500 flex flex-col items-center">
                    <div class="mb-4 text-4xl opacity-30">📭</div>
                    <span>暂无更多推荐内容</span>
                </div>
            `;
        }
        return;
    }

    // 2. 准备卡片 DOM 数组
    const newCards = data.subjects.map((item, index) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "douban-card-glass mb-4 bg-[#111] hover:bg-[#222] transition-all duration-300 rounded-xl overflow-hidden flex flex-col transform hover:scale-[1.03] shadow-lg group pointer-events-auto masonry-item-enter";
        // 添加动画延迟，实现瀑布流式进场
        cardDiv.style.animationDelay = `${index * 50}ms`;

        const safeTitle = (item.title || "").replace(/"/g, '&quot;');
        const safeRate = item.rate || "暂无";
        const originalCoverUrl = item.cover;
        const proxiedCoverUrl = PROXY_URL + encodeURIComponent(originalCoverUrl);

        // 高度微扰优化：随机 padding-bottom (0.6rem ~ 1.4rem)
        const randomPb = (0.6 + Math.random() * 0.8).toFixed(2);

        cardDiv.innerHTML = `
            <div class="relative w-full aspect-[2/3] cursor-pointer bg-[#1a1c22] skeleton overflow-hidden" onclick="fillAndSearchWithDouban('${safeTitle}')">
                <img src="${originalCoverUrl}" alt="${safeTitle}" 
                    class="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105 smooth-img"
                    onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');"
                    onerror="this.onerror=null; this.src='${proxiedCoverUrl}';"
                    loading="lazy" referrerpolicy="no-referrer">
                
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div class="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full border border-white/5">
                    <span class="text-yellow-400 text-xs">★</span> ${safeRate}
                </div>
                
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                       class="w-7 h-7 flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/20 transition-colors"
                       onclick="event.stopPropagation();">
                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>
            <div class="px-2.5 pt-2.5 text-center" style="padding-bottom: ${randomPb}rem">
                <button onclick="fillAndSearchWithDouban('${safeTitle}')" 
                        class="text-xs sm:text-sm font-bold text-gray-200 truncate w-full group-hover:text-cyan-400 transition-colors duration-300"
                        title="${safeTitle}">
                    ${safeTitle}
                </button>
            </div>
        `;
        return cardDiv;
    });

    // 3. 将卡片分配到最短的列
    newCards.forEach(card => {
        // 寻找当前高度最小的列
        let shortestCol = masonryColumns[0];
        let minHeight = shortestCol.offsetHeight;

        for (let i = 1; i < masonryColumns.length; i++) {
            const h = masonryColumns[i].offsetHeight;
            if (h < minHeight) {
                minHeight = h;
                shortestCol = masonryColumns[i];
            }
        }
        shortestCol.appendChild(card);
    });
}

// Masonry 布局状态管理
let masonryColumns = [];
let masonryResizeTimer = null;

// 获取当前断点对应的列数
function getMasonryColumnCount() {
    const w = window.innerWidth;
    if (w >= 1280) return 8; // xl
    if (w >= 1024) return 6; // lg
    if (w >= 768) return 4;  // md
    if (w >= 640) return 3;  // sm
    return 2;                // default
}

// 初始化或重置 Masonry 结构
function initMasonryStructure(container, forceRebuild = false) {
    const targetCount = getMasonryColumnCount();
    const existingContainer = container.querySelector('.masonry-container');

    // 如果已有结构且列数符合，不需要做任何事
    if (!forceRebuild && existingContainer && masonryColumns.length === targetCount) {
        return;
    }

    // 需要重建
    // 1. 收集现有卡片（如果是 Rebuild 的情况）
    const existingCards = [];
    if (existingContainer) {
        container.querySelectorAll('.douban-card-glass').forEach(card => {
            // 移除旧的动画类以避免重播（或者保留看效果？）建议移除以免乱跳
            card.classList.remove('masonry-item-enter');
            card.style.animationDelay = '0s';
            existingCards.push(card);
        });
    } else {
        // 可能是第一次运行，容器里可能有非 Masonry 结构的旧内容，也清空
        container.innerHTML = '';
    }

    // 2. 清空主容器并建立 Column 结构
    container.innerHTML = '';
    // 移除旧的 CSS 兼容类
    container.classList.remove('columns-2', 'sm:columns-3', 'md:columns-4', 'lg:columns-6', 'xl:columns-8');

    const mContainer = document.createElement('div');
    mContainer.className = 'masonry-container';

    masonryColumns = [];
    for (let i = 0; i < targetCount; i++) {
        const col = document.createElement('div');
        // 错落布局优化：偶数列下沉
        const staggerClass = (i % 2 === 1) ? ' mt-12' : '';
        col.className = 'masonry-column' + staggerClass;
        mContainer.appendChild(col);
        masonryColumns.push(col);
    }

    container.appendChild(mContainer);

    // 3. 如果有旧卡片，重新分配
    // 注意：这里重排会导致卡片瞬间移动，对于 Resize 是预期的
    existingCards.forEach(card => {
        let shortestCol = masonryColumns[0];
        let minHeight = shortestCol.offsetHeight;
        for (let i = 1; i < masonryColumns.length; i++) {
            const h = masonryColumns[i].offsetHeight;
            if (h < minHeight) {
                minHeight = h;
                shortestCol = masonryColumns[i];
            }
        }
        shortestCol.appendChild(card);
    });
}

// 监听窗口大小变化以重排
window.addEventListener('resize', () => {
    // 简单的防抖
    if (masonryResizeTimer) clearTimeout(masonryResizeTimer);
    masonryResizeTimer = setTimeout(() => {
        const container = document.getElementById('douban-results');
        if (container && container.offsetParent !== null) { // 只有可见时才处理
            // 检查列数是否改变
            const currentCount = masonryColumns.length;
            const targetCount = getMasonryColumnCount();
            if (currentCount !== targetCount) {
                // 列数变了，强制重排
                initMasonryStructure(container, true);
            }
        }
    }, 200);
});


// 重置到首页
function resetToHome() {
    resetSearchArea();
    updateDoubanVisibility();
}

// 加载豆瓣首页内容
document.addEventListener('DOMContentLoaded', initDouban);

// 显示标签管理模态框
function showTagManageModal() {
    // 确保模态框在页面上只有一个实例
    let modal = document.getElementById('tagManageModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    // 创建模态框元素
    modal = document.createElement('div');
    modal.id = 'tagManageModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    // 当前使用的标签类型和默认标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    const defaultTags = isMovie ? defaultMovieTags : defaultTvTags;

    // 模态框内容
    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeTagModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold text-white mb-4">标签管理 (${isMovie ? '电影' : '电视剧'})</h3>
            
            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium text-gray-300">标签列表</h4>
                    <button id="resetTagsBtn" class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">
                        恢复默认标签
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4" id="tagsGrid">
                    ${currentTags.length ? currentTags.map(tag => {
        // "热门"标签不能删除
        const canDelete = tag !== '热门';
        return `
                            <div class="bg-[#1a1a1a] text-gray-300 py-1.5 px-3 rounded text-sm font-medium flex justify-between items-center group">
                                <span>${tag}</span>
                                ${canDelete ?
                `<button class="delete-tag-btn text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                        data-tag="${tag}">✕</button>` :
                `<span class="text-gray-500 text-xs italic opacity-0 group-hover:opacity-100">必需</span>`
            }
                            </div>
                        `;
    }).join('') :
            `<div class="col-span-full text-center py-4 text-gray-500">无标签，请添加或恢复默认</div>`}
                </div>
            </div>
            
            <div class="border-t border-gray-700 pt-4">
                <h4 class="text-lg font-medium text-gray-300 mb-3">添加新标签</h4>
                <form id="addTagForm" class="flex items-center">
                    <input type="text" id="newTagInput" placeholder="输入标签名称..." 
                           class="flex-1 bg-[#222] text-white border border-gray-700 rounded px-3 py-2 focus:outline-none google-input-focus">
                    <button type="submit" class="ml-2 google-bg-active hover:bg-blue-600 text-white px-4 py-2 rounded">添加</button>
                </form>
                <p class="text-xs text-gray-500 mt-2">提示：标签名称不能为空，不能重复，不能包含特殊字符</p>
            </div>
        </div>
    `;

    // 添加模态框到页面
    document.body.appendChild(modal);

    // 焦点放在输入框上
    setTimeout(() => {
        document.getElementById('newTagInput').focus();
    }, 100);

    // 添加事件监听器 - 关闭按钮
    document.getElementById('closeTagModal').addEventListener('click', function () {
        document.body.removeChild(modal);
    });

    // 添加事件监听器 - 点击模态框外部关闭
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // 添加事件监听器 - 恢复默认标签按钮
    document.getElementById('resetTagsBtn').addEventListener('click', function () {
        resetTagsToDefault();
        showTagManageModal(); // 重新加载模态框
    });

    // 添加事件监听器 - 删除标签按钮
    const deleteButtons = document.querySelectorAll('.delete-tag-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const tagToDelete = this.getAttribute('data-tag');
            deleteTag(tagToDelete);
            showTagManageModal(); // 重新加载模态框
        });
    });

    // 添加事件监听器 - 表单提交
    document.getElementById('addTagForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('newTagInput');
        const newTag = input.value.trim();

        if (newTag) {
            addTag(newTag);
            input.value = '';
            showTagManageModal(); // 重新加载模态框
        }
    });
}

// 添加标签
function addTag(tag) {
    // 安全处理标签名，防止XSS
    const safeTag = tag
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;

    // 检查是否已存在（忽略大小写）
    const exists = currentTags.some(
        existingTag => existingTag.toLowerCase() === safeTag.toLowerCase()
    );

    if (exists) {
        showToast('标签已存在', 'warning');
        return;
    }

    // 添加到对应的标签数组
    if (isMovie) {
        movieTags.push(safeTag);
    } else {
        tvTags.push(safeTag);
    }

    // 保存到本地存储
    saveUserTags();

    // 重新渲染标签
    renderDoubanTags();

    showToast('标签添加成功', 'success');
}

// 删除标签
function deleteTag(tag) {
    // 热门标签不能删除
    if (tag === '热门') {
        showToast('热门标签不能删除', 'warning');
        return;
    }

    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;

    // 寻找标签索引
    const index = currentTags.indexOf(tag);

    // 如果找到标签，则删除
    if (index !== -1) {
        currentTags.splice(index, 1);

        // 保存到本地存储
        saveUserTags();

        // 如果当前选中的是被删除的标签，则重置为"热门"
        if (doubanCurrentTag === tag) {
            doubanCurrentTag = '热门';
            doubanPageStart = 0;
            renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
        }

        // 重新渲染标签
        renderDoubanTags();

        showToast('标签删除成功', 'success');
    }
}

// 重置为默认标签
function resetTagsToDefault() {
    // 确定当前使用的是电影还是电视剧
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';

    // 重置为默认标签
    if (isMovie) {
        movieTags = [...defaultMovieTags];
    } else {
        tvTags = [...defaultTvTags];
    }

    // 设置当前标签为热门
    doubanCurrentTag = '热门';
    doubanPageStart = 0;

    // 保存到本地存储
    saveUserTags();

    // 重新渲染标签和内容
    renderDoubanTags();
    renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);

    showToast('已恢复默认标签', 'success');
}
