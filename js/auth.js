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
            // 不在此处显示通知，交由 UI 层处理
            throw e;
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
            // 不在此处显示通知，交由 UI 层处理
            throw e;
        }
    }

    // 登出
    async logout() {
        // --- 修复：退出前强制同步数据 ---
        // 防止用户在产生数据后立即退出（少于防抖时间），导致数据未上传
        if (this.isLoggedIn) {
            const btn = document.getElementById('authButton');
            if (btn) btn.innerHTML = '<span class="text-xs">同步中...</span>';
            await this.pushSync(); // 强制等待同步完成
        }

        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(USER_INFO_KEY);

        // --- 修复：登出时清理所有用户敏感数据，防止隐私泄露 ---
        localStorage.removeItem('viewingHistory');
        localStorage.removeItem('searchHistory');
        localStorage.removeItem('favorites');
        localStorage.removeItem('settings');

        this.token = null;
        this.user = null;
        this.isLoggedIn = false;

        this.updateAuthUI(); // 更新UI状态
        showToast('已退出登录', 'info');
        location.reload();
    }

    saveSession(token, user) {
        this.token = token;
        this.user = user;
        this.isLoggedIn = true;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
        this.updateAuthUI(); // 更新UI状态
    }

    // 更新右上角按钮UI
    updateAuthUI() {
        const btn = document.getElementById('authButton');
        if (!btn) return;

        if (this.isLoggedIn && this.user && this.user.username) {
            const firstChar = this.user.username[0].toUpperCase();
            // 显示头像状态
            btn.innerHTML = `
                <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-md">
                    ${firstChar}
                </div>
            `;
            btn.classList.add('p-0'); // Remove padding to fit avatar nicely
        } else {
            // 显示默认图标状态
            btn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
            `;
            btn.classList.remove('p-0');
        }
    }

    // 推送数据到云端 (添加 debounce 逻辑)
    async pushSync() {
        if (!this.isLoggedIn) return;
        // 如果正在从云端拉取数据，暂停推送，防止覆盖
        if (this.isPulling) return;

        // 获取最新的本地数据
        const syncData = {
            viewing_history: localStorage.getItem('viewingHistory') || '[]',
            search_history: localStorage.getItem('searchHistory') || '[]',
            favorites: localStorage.getItem('favorites') || '[]',
            settings: localStorage.getItem('settings') || '{}'
        };

        try {
            const response = await fetch('/api/user/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(syncData)
            });
            const result = await response.json();

            // 检查用户不存在错误
            if (result.code === 'USER_NOT_FOUND') {
                console.log('检测到用户已被删除，自动登出');
                this.logout();
                alert('您的账号已被删除或不存在，请重新注册');
                return;
            }

            if (result.success) {
                // console.log('数据已成功同步至云端');
            } else if (result.error) {
                alert('云端同步失败: ' + result.error);
            }
        } catch (e) {
            console.error('云端同步失败:', e);
        }
    }

    // 从云端拉取数据
    async pullSync() {
        if (!this.isLoggedIn) return;

        // 设置拉取状态锁
        this.isPulling = true;

        try {
            const response = await fetch('/api/user/sync', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json();

            // 检查用户不存在错误
            if (data.code === 'USER_NOT_FOUND') {
                console.log('检测到用户已被删除，自动登出');
                this.logout();
                alert('您的账号已被删除或不存在，请重新注册');
                return;
            }

            if (data.error) {
                alert('从云端拉取数据失败: ' + data.error);
                return;
            }

            // 如果拉取成功
            if (data.viewing_history) {
                localStorage.setItem('viewingHistory', data.viewing_history);
            }
            if (data.search_history) {
                localStorage.setItem('searchHistory', data.search_history);
            }
            if (data.favorites) {
                localStorage.setItem('favorites', data.favorites);
            }
            if (data.settings) {
                localStorage.setItem('settings', data.settings);
            }

            // 重新刷新 UI 以展示新数据
            if (typeof loadViewingHistory === 'function') loadViewingHistory();
            if (typeof renderSearchHistory === 'function') renderSearchHistory();
            if (window.FavoritesService && typeof window.FavoritesService.updateUI === 'function') {
                window.FavoritesService.updateUI();
            }

        } catch (e) {
            console.error('拉取云端数据失败:', e);
        } finally {
            // 释放锁，允许后续变动触发推送
            setTimeout(() => {
                this.isPulling = false;
            }, 500); // 延迟释放，确保 UI 更新引发的变动不触发推送
        }
    }

    // 显示登录对话框
    showAuthModal() {
        // 如果已经登录，显示个人信息
        if (this.isLoggedIn) {
            // 双重检查 user 对象是否存在
            if (!this.user || !this.user.username) {
                // 异常状态：有 token 但无 user info，强制登出
                this.logout();
                return;
            }
            this.showUserPanel();
            return;
        }

        const modalHtml = `
            <div id="authModal" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                <div class="w-[90%] max-w-md p-8 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl relative overflow-hidden">
                    <div class="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[100px] rounded-full"></div>
                    
                    <button onclick="document.getElementById('authModal').remove()" class="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    <h2 id="authTitle" class="text-2xl font-bold text-white mb-2 text-center">欢迎回来</h2>
                    <p id="authSub" class="text-gray-400 text-sm mb-6 text-center">登录以同步您的播放记录和收藏夹</p>

                    <div class="space-y-4">
                        <div class="relative group">
                            <input type="text" id="authUsername" placeholder="用户名" class="w-full bg-gray-800 border-gray-700 text-white rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none">
                        </div>
                        <div class="relative group">
                            <input type="password" id="authPassword" placeholder="密码" class="w-full bg-gray-800 border-gray-700 text-white rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none">
                        </div>
                        
                        <div id="authError" class="hidden my-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center"></div>

                        <button id="authBtn" onclick="handleAuthSubmit()" class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20">
                            立即登录
                        </button>
                    </div>

                    <div class="mt-6 text-center">
                        <button id="authToggle" onclick="toggleAuthMode()" class="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                            第一次来？点击注册账号
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    showUserPanel() {
        const username = this.user.username || 'User';
        const firstChar = username[0].toUpperCase();
        const isAdmin = this.user.role === 'admin';

        const adminBadge = isAdmin
            ? `<span class="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-0.5 rounded border border-yellow-500/30 ml-2 align-middle">ADMIN</span>`
            : '';

        const adminButton = isAdmin
            ? `<button onclick="window.location.href='/admin.html'" class="w-full bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-500/30 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mb-3">
                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                 管理后台 (Overseer)
               </button>`
            : '';

        const userHtml = `
            <div id="authModal" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                <div class="w-[90%] max-w-sm p-8 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl relative">
                    <button onclick="document.getElementById('authModal').remove()" class="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    <div class="text-center">
                        <div class="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                            <span class="text-3xl font-bold text-white">${firstChar}</span>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-1">
                            ${username}
                            ${adminBadge}
                        </h3>
                        <p class="text-gray-500 text-xs mb-6">云端数据已同步</p>

                        <div class="space-y-3">
                            ${adminButton}
                            <button onclick="if(typeof toggleFavorites === 'function') toggleFavorites(event); document.getElementById('authModal').remove();" class="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                我的收藏
                            </button>
                             <button onclick="if(typeof toggleHistory === 'function') toggleHistory(event); document.getElementById('authModal').remove();" class="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                观看历史
                            </button>
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
window.authService = authService;
// 初始化时更新UI
authService.updateAuthUI();

// 全局提交函数
let isRegisterMode = false;
async function handleAuthSubmit() {
    const u = document.getElementById('authUsername').value;
    const p = document.getElementById('authPassword').value;

    if (!u || !p) return showToast('请填写完整！', 'warning');

    const btn = document.getElementById('authBtn');
    btn.disabled = true;
    btn.innerText = '请稍候...';

    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const success = isRegisterMode
            ? await authService.register(u, p)
            : await authService.login(u, p);

        if (success) {
            if (isRegisterMode) {
                toggleAuthMode(); // 切换回登录
            } else {
                document.getElementById('authModal').remove();
                // 登录成功后自动刷新页面，重置所有组件状态（特别是播放器拦截）
                location.reload();
            }
        }
    } catch (e) {
        // 捕获 AuthService 抛出的错误，并在窗口内显示
        if (errorEl) {
            errorEl.innerText = e.message || (isRegisterMode ? '注册失败' : '登录失败');
            errorEl.classList.remove('hidden');
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
        sub.innerText = '登录以同步您的播放记录和收藏夹';
        btn.innerText = '立即登录';
        toggle.innerText = '第一次来？点击注册账号';
    }
}

// 自动同步钩子
window.addEventListener('load', () => {
    // 再次尝试更新UI，确保DOM已加载
    if (authService && authService.updateAuthUI) {
        authService.updateAuthUI();
    }

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
