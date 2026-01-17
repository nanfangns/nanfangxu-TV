/**
 * Real-Time Visitor Counter (Account-based)
 * Tracks current CONCURRENT logged-in users (Online Right Now).
 */

(function () {
    const WIDGET_ID = 'live-visitor-widget';
    const COUNT_ID = 'live-visitor-count';
    const REFRESH_INTERVAL = 10000; // Check every 10s
    const AUTH_TOKEN_KEY = 'nanfangxutv_auth_token';
    const ONLINE_API_BASE = '/api/online';
    const ACTIVE_FALLBACK = '0';

    function createWidget() {
        if (document.getElementById(WIDGET_ID)) return;

        const widget = document.createElement('div');
        widget.id = WIDGET_ID;
        widget.className = 'live-viewer-widget';
        widget.innerHTML = `
            <div class="live-dot-container">
                <div class="live-dot-pulse"></div>
                <div class="live-dot-center"></div>
            </div>
            <div class="live-text-container">
                <span class="live-label">当前在线账号</span>
                <span id="${COUNT_ID}" class="live-count">...</span>
            </div>
        `;
        document.body.appendChild(widget);
    }

    function updateDisplay(element, newValue) {
        if (element.innerText !== newValue) {
            element.innerText = newValue;
            element.classList.remove('update-flash');
            void element.offsetWidth;
            element.classList.add('update-flash');
        }
    }

    function getAuthToken() {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    }

    async function pingOnline() {
        const token = getAuthToken();
        if (!token) return;

        await fetch(`${ONLINE_API_BASE}/ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ t: Date.now() })
        });
    }

    async function fetchCount() {
        const el = document.getElementById(COUNT_ID);
        try {
            const response = await fetch(`${ONLINE_API_BASE}/count`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Invalid response');
            const data = await response.json();
            if (el && typeof data.count === 'number') {
                updateDisplay(el, data.count.toString());
            }
        } catch (error) {
            console.warn('[Traffic] Failed to fetch online count', error);
            if (el && el.innerText === '...') {
                el.innerText = ACTIVE_FALLBACK;
            }
        }
    }

    function init() {
        createWidget();
        const refresh = async () => {
            await pingOnline();
            await fetchCount();
        };
        refresh();
        setInterval(refresh, REFRESH_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
