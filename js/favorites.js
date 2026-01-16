/**
 * 收藏夹管理模块
 * 处理收藏数据的增删改查及 UI 渲染
 */

const FAVORITES_KEY = 'favorites';

const FavoritesService = {
    // 获取所有收藏
    getFavorites() {
        try {
            const data = localStorage.getItem(FAVORITES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('获取收藏失败:', e);
            return [];
        }
    },

    // 保存收藏列表
    saveFavorites(list) {
        try {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
            // 触发自动同步 (如果已登录)
            if (window.authService && window.authService.isLoggedIn) {
                if (window.syncTimer) clearTimeout(window.syncTimer);
                window.syncTimer = setTimeout(() => window.authService.pushSync(), 2000);
            }
        } catch (e) {
            console.error('保存收藏失败:', e);
            showToast('保存收藏失败', 'error');
        }
    },

    // 检查是否已收藏
    isFavorite(vodId) {
        if (!vodId) return false;
        const list = this.getFavorites();
        // 兼容字符串和数字类型的比较
        return list.some(item => String(item.vod_id) === String(vodId));
    },

    // 添加收藏
    addFavorite(videoInfo) {
        if (!videoInfo || !videoInfo.vod_id) {
            showToast('无法收藏：无效的视频信息', 'error');
            return false;
        }

        const list = this.getFavorites();
        if (this.isFavorite(videoInfo.vod_id)) {
            showToast('已在收藏夹中', 'info');
            return true;
        }

        // 构造存储对象，只存必要信息
        const newItem = {
            vod_id: videoInfo.vod_id,
            title: videoInfo.title || '未知标题',
            pic: videoInfo.pic || '',
            url: videoInfo.url || '', // 播放地址或页面地址
            sourceName: videoInfo.sourceName || '',
            sourceCode: videoInfo.sourceCode || videoInfo.sourceName || '', // 同时保存 sourceCode 用于 API 调用
            createTime: Date.now()
        };

        list.unshift(newItem); // 添加到头部
        this.saveFavorites(list);
        showToast('已加入收藏', 'success');
        this.updateUI(); // 更新相关UI
        return true;
    },

    // 移除收藏
    removeFavorite(vodId) {
        if (!vodId) return false;
        let list = this.getFavorites();
        const initialLength = list.length;

        list = list.filter(item => String(item.vod_id) !== String(vodId));

        if (list.length !== initialLength) {
            this.saveFavorites(list);
            showToast('已取消收藏', 'success');
            this.updateUI();
            return true;
        }
        return false;
    },

    // 切换收藏状态
    toggleFavorite(videoInfo) {
        if (this.isFavorite(videoInfo.vod_id)) {
            return !this.removeFavorite(videoInfo.vod_id); // 返回当前状态 (false=未收藏)
        } else {
            return this.addFavorite(videoInfo); // 返回当前状态 (true=已收藏)
        }
    },

    // 更新所有相关的 UI 状态
    updateUI() {
        // 1. 更新播放页的收藏按钮状态
        const btn = document.getElementById('favoriteBtn');
        if (btn) {
            // 需要获取当前视频的 ID，通常在 player.js 的全局变量或 URL 参数中
            // 这里假设通过全局变量或 DOM 属性获取当前 ID
            const currentId = btn.dataset.vodId;
            if (currentId) {
                const isFav = this.isFavorite(currentId);
                updateFavoriteButtonState(btn, isFav);
            }
        }

        // 2. 如果收藏夹面板打开，刷新列表
        const panel = document.getElementById('favoritesPanel');
        if (panel && panel.classList.contains('show')) {
            this.renderFavoritesPanel();
        }
    },

    // 渲染收藏夹面板内容
    // 播放收藏 (类似历史记录的预加载逻辑)
    async playFavorite(vodId) {
        const list = this.getFavorites();
        const item = list.find(i => String(i.vod_id) === String(vodId));
        if (!item) return;

        showToast('正在解析视频资源...', 'info');

        try {
            // 1. 优先使用已保存的 sourceCode，否则用 sourceName
            let sourceCode = item.sourceCode || item.sourceName;

            // 尝试将中文名转换为代码
            if (window.API_SITES) {
                if (!window.API_SITES[sourceCode]) {
                    const matchedKey = Object.keys(window.API_SITES).find(key => window.API_SITES[key].name === sourceCode);
                    if (matchedKey) sourceCode = matchedKey;
                }
            }

            // 2. 请求详情以获取最新 m3u8
            const apiUrl = `/api/detail?id=${encodeURIComponent(item.vod_id)}&source=${encodeURIComponent(sourceCode)}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error('API Error');
            const data = await res.json();

            // 兼容两种 API 格式
            let episodes = [];
            let videoTitle = item.title || '未知视频';

            if (data.episodes && Array.isArray(data.episodes) && data.episodes.length > 0) {
                // 新格式：api.js 返回的 episodes 是纯 URL 数组
                episodes = data.episodes.map((url, i) => ({
                    name: `第${i + 1}集`,
                    url: url
                }));
                videoTitle = data.videoInfo?.title || videoTitle;
            } else if (data.list && data.list.length > 0) {
                // 旧格式：传统采集站 API 返回
                const videoData = data.list[0];
                videoTitle = videoData.vod_name || videoTitle;
                const playUrlStr = videoData.vod_play_url;

                if (playUrlStr) {
                    const sourceGroups = playUrlStr.split('$$$');
                    const currentGroupStr = sourceGroups.find(g => g.includes('m3u8')) || sourceGroups[0];
                    episodes = currentGroupStr.split('#').map(s => {
                        const p = s.split('$');
                        return { name: p.length > 1 ? p[0] : '正片', url: p.length > 1 ? p[1] : p[0] };
                    });
                }
            }

            if (episodes.length === 0) {
                throw new Error('No valid episodes');
            }

            // 更新本地存储
            localStorage.setItem('currentEpisodes', JSON.stringify(episodes));
            localStorage.setItem('currentVideoTitle', videoTitle);

            // 构造完整URL (播放第一集)
            const finalUrl = episodes[0].url;
            // 同时传递 source (用于显示) 和 source_code (用于 API 调用)
            const playPageUrl = `player.html?url=${encodeURIComponent(finalUrl)}&title=${encodeURIComponent(videoTitle)}&index=0&source=${encodeURIComponent(sourceCode)}&source_code=${encodeURIComponent(sourceCode)}&id=${encodeURIComponent(item.vod_id)}`;

            window.location.href = playPageUrl;

        } catch (e) {
            console.error('收藏播放失败:', e);
            // 兜底：直接跳转到 player.html，让 player.js 的 fetchVideoDetailsById 处理
            showToast('无法获取最新资源，尝试直接播放...', 'warning');
            setTimeout(() => {
                // 优先使用 sourceCode，兜底使用 sourceName
                const sourceParam = item.sourceCode || item.sourceName;
                const fallbackUrl = `player.html?id=${encodeURIComponent(item.vod_id)}&source=${encodeURIComponent(sourceParam)}&source_code=${encodeURIComponent(sourceParam)}&title=${encodeURIComponent(item.title || '')}`;
                window.location.href = fallbackUrl;
            }, 1000);
        }
    },

    // 渲染收藏夹面板内容
    renderFavoritesPanel() {
        const container = document.getElementById('favoritesList');
        if (!container) return;

        const list = this.getFavorites();

        if (list.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 py-8">暂无收藏记录</div>`;
            return;
        }

        container.innerHTML = list.map(item => {
            const safeTitle = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeSource = (item.sourceName || '未知').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `
                <div class="history-item cursor-pointer relative group" onclick="FavoritesService.playFavorite('${item.vod_id}')">
                    <button onclick="event.stopPropagation(); FavoritesService.removeFavorite('${item.vod_id}')"
                            class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-gray-800 z-10"
                            title="取消收藏">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                    <div class="flex items-start gap-3">
                        ${item.pic ? `<div class="w-16 h-20 flex-shrink-0 bg-cover bg-center rounded-md border border-gray-800" style="background-image: url('${item.pic}')"></div>` : ''}
                        <div class="history-info flex-1 min-w-0">
                            <div class="history-title truncate text-cyan-50">${safeTitle}</div>
                            <div class="history-meta mt-1">
                                <span class="bg-gray-800 text-gray-400 text-xs px-1.5 py-0.5 rounded">${safeSource}</span>
                            </div>
                            <div class="history-time mt-2 text-xs text-gray-600">${new Date(item.createTime).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
};

// 辅助函数：更新按钮视觉状态
function updateFavoriteButtonState(btn, isFavorite) {
    if (!btn) return;
    const textSpan = btn.querySelector('span');

    if (isFavorite) {
        btn.classList.add('active');
        if (textSpan) textSpan.textContent = '已收藏';
    } else {
        btn.classList.remove('active');
        if (textSpan) textSpan.textContent = '收藏';
    }
}

// 暴露给全局
window.FavoritesService = FavoritesService;

// 侧边栏切换逻辑
function toggleFavorites(e) {
    if (e) e.stopPropagation();

    const panel = document.getElementById('favoritesPanel');
    if (panel) {
        panel.classList.toggle('show');

        // 打开时渲染
        if (panel.classList.contains('show')) {
            FavoritesService.renderFavoritesPanel();
        }

        // 互斥关闭其他面板
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel && settingsPanel.classList.contains('show')) settingsPanel.classList.remove('show');

        const historyPanel = document.getElementById('historyPanel');
        if (historyPanel && historyPanel.classList.contains('show')) historyPanel.classList.remove('show');
    }
}

// 点击外部关闭
document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('click', function (e) {
        const panel = document.getElementById('favoritesPanel');
        // 查找所有可能的触发按钮 (index 和 player 可能不同)
        const btns = document.querySelectorAll('[onclick*="toggleFavorites"]');
        let clickedBtn = false;
        btns.forEach(btn => {
            if (btn.contains(e.target)) clickedBtn = true;
        });

        if (panel && !clickedBtn && !panel.contains(e.target) && panel.classList.contains('show')) {
            panel.classList.remove('show');
        }
    });
});
