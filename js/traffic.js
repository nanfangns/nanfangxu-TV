/**
 * Real-Time Visitor Counter (whos.amung.us JSONP)
 * Injects a Premium Glassmorphism Widget and fetches real-time "Right Now" users.
 */

(function () {
    // Configuration
    const WIDGET_ID = 'live-visitor-widget';
    const COUNT_ID = 'live-visitor-count';
    const REFRESH_INTERVAL = 10000; // 10 seconds
    // 使用固定的 key 以保持全站统一，或者让服务自动生成
    // 这里使用一个通用的 key 或随机生成的 key (以此域名的名字为种子的 key 会更好，但 whos.amung.us 通常是基于 key 的)
    // 为了简化，我们让它第一次运行时生成一个 key 存入 localStorage，或者直接不传 key 让它 fallback 到 referer
    // whos.amung.us 的经典用法是直接引用，它会自动识别域名。
    // jsonp url: //whos.amung.us/pingjs/?k=[KEY] 
    // 文档没公开 key 获取方式，通常是从 widget 代码里拿。
    // 我们可以试着用 "k=custom_key" 但如果不生效，就直接用 embed 方式获取数据？
    // 经过调研，直接调用 //whos.amung.us/pingjs/ 会返回 window.whos({...})，不需要 key，它基于 Referer。

    const API_URL = '//whos.amung.us/pingjs/';

    // 1. Create and Inject Widget HTML
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
                <span class="live-label">LIVE VIEWERS</span>
                <span id="${COUNT_ID}" class="live-count">...</span>
            </div>
        `;
        document.body.appendChild(widget);
    }

    // 2. Define Callback Function
    window.whos = function (data) {
        // data looks like: { count: "123", ... }
        const countElement = document.getElementById(COUNT_ID);
        if (countElement && data && data.count) {
            updateCount(countElement, data.count);
        }
    };

    // 3. Animation Logic
    function updateCount(element, newValue) {
        const current = parseInt(element.innerText) || 0;
        const target = parseInt(newValue);

        if (current !== target) {
            // Simple text update for now, can be sophisticated animation if needed
            element.innerText = target;

            // Trigger a flash effect
            element.classList.remove('update-flash');
            void element.offsetWidth; // trigger reflow
            element.classList.add('update-flash');
        } else {
            element.innerText = target;
        }
    }

    // 4. Fetch Function (JSONP Injection)
    function fetchCount() {
        const script = document.createElement('script');
        // 添加随机数防止缓存
        script.src = `${API_URL}?t=${Date.now()}`;
        script.async = true;

        // Error handling
        script.onerror = function () {
            console.warn('Visitor count fetch failed.');
            const el = document.getElementById(COUNT_ID);
            if (el && el.innerText === '...') el.innerText = '-';
        };

        document.head.appendChild(script);

        // Clean up script tag after it runs to avoid clutter
        script.onload = function () {
            setTimeout(() => {
                script.remove();
            }, 1000);
        };
    }

    // Initialize
    function init() {
        createWidget();
        fetchCount();
        setInterval(fetchCount, REFRESH_INTERVAL);
    }

    // Helper to ensure DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
