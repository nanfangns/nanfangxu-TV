/**
 * LibreTV 前端账号系统逻辑
 * 处理登录、注册及云端同步
 */

const AUTH_TOKEN_KEY = 'libretv_auth_token';
const USER_INFO_KEY = 'libretv_user_info';

class AuthService {
    constructor() {
        this.token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.user = JSON.parse(localStorage.getItem(USER_INFO_KEY) || 'null');
        this.isLoggedIn = !!this.token;
    }

    // 登录
    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            this.saveSession(data.token, data.user);
            showToast('登录成功！', 'success');

            // 登录后尝试同步云端数据到本地
            await this.pullSync();
            return true;
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    }

    // 注册
    async register(username, password) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            showToast('注册成功，请登录', 'success');
            return true;
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    }

    // 登出
    logout() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(USER_INFO_KEY);
        this.token = null;
        this.user = null;
        this.isLoggedIn = false;
        showToast('已退出登录', 'info');
        location.reload();
    }

    saveSession(token, user) {
        this.token = token;
        this.user = user;
        this.isLoggedIn = true;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
    }

    // 推送数据到云端
    async pushSync() {
        if (!this.isLoggedIn) return;

        const syncData = {
            viewing_history: JSON.parse(localStorage.getItem('viewingHistory') || '[]'),
            search_history: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
            favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
            settings: JSON.parse(localStorage.getItem('settings') || '{}')
        };

        try {
            await fetch('/api/user/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(syncData)
            });
        } catch (e) {
            console.error('云端同步失败:', e);
        }
    }

    // 从云端拉取数据
    async pullSync() {
        if (!this.isLoggedIn) return;

        try {
            const response = await fetch('/api/user/sync', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json();

            if (data.viewing_history) {
                const cloudHistory = JSON.parse(data.viewing_history);
                if (cloudHistory.length > 0) {
                    localStorage.setItem('viewingHistory', data.viewing_history);
                }
            }
            if (data.search_history) {
                localStorage.setItem('searchHistory', data.search_history);
            }
            if (data.favorites) {
                localStorage.setItem('favorites', data.favorites);
            }

            // 重新刷新 UI 以展示新历史记录
            if (typeof loadViewingHistory === 'function') loadViewingHistory();
            if (typeof renderSearchHistory === 'function') renderSearchHistory();

        } catch (e) {
            console.error('拉取云端数据失败:', e);
        }
    }

    // 显示登录对话框
    showAuthModal() {
        // 如果已经登录，显示个人信息
        if (this.isLoggedIn) {
            this.showUserPanel();
            return;
        }

        const modalHtml = `
            <div id="authModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                <div class="w-[90%] max-w-md p-8 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl relative overflow-hidden">
                    <div class="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[100px] rounded-full"></div>
                    
                    <button onclick="document.getElementById('authModal').remove()" class="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    <h2 id="authTitle" class="text-2xl font-bold text-white mb-2 text-center">欢迎回来</h2>
                    <p id="authSub" class="text-gray-400 text-sm mb-6 text-center">登录以同步您的播放记录</p>

                    <div class="space-y-4">
                        <div class="relative group">
                            <input type="text" id="authUsername" placeholder="用户名" class="w-full bg-gray-800 border-gray-700 text-white rounded-xl px-4 py-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                        </div>
                        <div class="relative group">
                            <input type="password" id="authPassword" placeholder="密码" class="w-full bg-gray-800 border-gray-700 text-white rounded-xl px-4 py-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                        </div>
                        
                        <button id="authBtn" onclick="handleAuthSubmit()" class="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20">
                            立即登录
                        </button>
                    </div>

                    <div class="mt-6 text-center">
                        <button id="authToggle" onclick="toggleAuthMode()" class="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                            第一次来？点击注册账号
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    showUserPanel() {
        const userHtml = `
            <div id="authModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                <div class="w-[90%] max-w-sm p-8 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl relative">
                    <button onclick="document.getElementById('authModal').remove()" class="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    <div class="text-center">
                        <div class="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                            <span class="text-3xl font-bold text-white">${this.user.username[0].toUpperCase()}</span>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-1">${this.user.username}</h3>
                        <p class="text-gray-500 text-xs mb-6">云端数据已同步</p>

                        <div class="space-y-3">
                            <button onclick="authService.pullSync(); showToast('同步成功', 'success')" class="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                立即手动同步
                            </button>
                            <button onclick="authService.logout()" class="w-full border border-red-500/30 text-red-500 hover:bg-red-500/10 py-2 rounded-lg transition-colors">
                                退出登录
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', userHtml);
    }
}

// 初始化
const authService = new AuthService();

// 全局提交函数
let isRegisterMode = false;
async function handleAuthSubmit() {
    const u = document.getElementById('authUsername').value;
    const p = document.getElementById('authPassword').value;

    if (!u || !p) return showToast('请填写完整！', 'warning');

    const btn = document.getElementById('authBtn');
    btn.disabled = true;
    btn.innerText = '请稍候...';

    const success = isRegisterMode
        ? await authService.register(u, p)
        : await authService.login(u, p);

    if (success) {
        if (isRegisterMode) {
            toggleAuthMode(); // 切换回登录
        } else {
            document.getElementById('authModal').remove();
        }
    }
    btn.disabled = false;
    btn.innerText = isRegisterMode ? '立即注册' : '立即登录';
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSub');
    const btn = document.getElementById('authBtn');
    const toggle = document.getElementById('authToggle');

    if (isRegisterMode) {
        title.innerText = '创建账号';
        sub.innerText = '数据多端同步，追剧不走丢';
        btn.innerText = '立即注册';
        toggle.innerText = '已有账号？点击登录';
    } else {
        title.innerText = '欢迎回来';
        sub.innerText = '登录以同步您的播放记录';
        btn.innerText = '立即登录';
        toggle.innerText = '第一次来？点击注册账号';
    }
}

// 自动同步钩子
window.addEventListener('load', () => {
    if (authService.isLoggedIn) {
        authService.pullSync();
        // 简单拦截 localStorage 变动进行同步（简略实现）
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function (key, value) {
            originalSetItem.apply(this, arguments);
            if (['viewingHistory', 'favorites', 'settings'].includes(key)) {
                // 防抖延迟同步
                if (window.syncTimer) clearTimeout(window.syncTimer);
                window.syncTimer = setTimeout(() => authService.pushSync(), 2000);
            }
        };
    }
});
