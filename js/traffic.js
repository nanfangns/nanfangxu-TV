/**
 * Real-Time Visitor Counter (whos.amung.us JSONP)
 * Injects a Premium Glassmorphism Widget and fetches real-time "Right Now" users.
 */

/**
 * Real-Time Visitor Counter (whos.amung.us JSONP)
 * Tracks current CONCURRENT users (Online Right Now).
 */

(function () {
    const WIDGET_ID = 'live-visitor-widget';
    const COUNT_ID = 'live-visitor-count';
    const REFRESH_INTERVAL = 10000; // Check every 10s
    const API_BASE = '//whos.amung.us/pingjs/';

    // Fixed Global Key for this site
    const SITE_KEY = 'g7lb20xp48sq';

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
                <span class="live-label">当前在线人数</span>
                <span id="${COUNT_ID}" class="live-count">...</span>
            </div>
        `;
        document.body.appendChild(widget);
    }

    // JSONP Callback
    window.whos = function (data) {
        if (window.trafficTimer) clearTimeout(window.trafficTimer);
        console.log('[Traffic] Data received:', data);

        const el = document.getElementById(COUNT_ID);
        if (el && data && data.count) {
            // WHOS.AMUNG.US returns count string "1,234"
            const count = data.count.toString().replace(/,/g, '');
            updateDisplay(el, count);
        }
    };

    function updateDisplay(element, newValue) {
        if (element.innerText !== newValue) {
            element.innerText = newValue;
            element.classList.remove('update-flash');
            void element.offsetWidth;
            element.classList.add('update-flash');
        }
    }

    function fetchCount() {
        // Fallback for timeout
        window.trafficTimer = setTimeout(() => {
            console.warn('[Traffic] Request timed out');
            // Keep existing value or show 1 if empty
            const el = document.getElementById(COUNT_ID);
            if (el && el.innerText === '...') el.innerText = '1';
        }, 5000);

        const script = document.createElement('script');
        script.src = `${API_BASE}?k=${SITE_KEY}&t=${Date.now()}`; // No cache
        script.async = true;

        script.onerror = () => {
            console.error('[Traffic] Script load blocked');
            if (window.trafficTimer) clearTimeout(window.trafficTimer);
        }

        document.head.appendChild(script);
        script.onload = () => setTimeout(() => script.remove(), 1000);
    }

    function init() {
        createWidget();
        fetchCount();
        setInterval(fetchCount, REFRESH_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
