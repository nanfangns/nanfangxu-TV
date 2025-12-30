/**
 * Real-Time Visitor Counter (whos.amung.us JSONP)
 * Injects a Premium Glassmorphism Widget and fetches real-time "Right Now" users.
 */

/**
 * Real-Time Visitor Counter (whos.amung.us JSONP)
 * Injects a Premium Glassmorphism Widget and fetches real-time "Right Now" users.
 */

(function () {
    // Configuration
    const WIDGET_ID = 'live-visitor-widget';
    const COUNT_ID = 'live-visitor-count';
    const REFRESH_INTERVAL = 15000; // 15 seconds
    const STORAGE_KEY = 'whos_amung_us_key';
    const API_BASE = '//whos.amung.us/pingjs/';

    // Helper: Generate or Get Key
    function getSiteKey() {
        let key = localStorage.getItem(STORAGE_KEY);
        if (!key) {
            // Generate a random 12-char string if no key exists
            key = Math.random().toString(36).substring(2, 14);
            localStorage.setItem(STORAGE_KEY, key);
        }
        return key;
    }

    const SITE_KEY = getSiteKey();

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
    // whos.amung.us returns `whos({ count: "..." })`
    window.whos = function (data) {
        if (window.trafficTimer) clearTimeout(window.trafficTimer);

        const countElement = document.getElementById(COUNT_ID);
        // Valid data: has count
        if (countElement && data && data.count) {
            updateCount(countElement, data.count);
        } else {
            console.warn('Invalid traffic data received:', data);
        }
    };

    // 3. Animation Logic
    function updateCount(element, newValue) {
        // Convert k/m to numbers if needed, practically for small sites it's just int
        // If it's "1,234", parse it
        const numericStr = newValue.toString().replace(/,/g, '');
        const target = parseInt(numericStr) || 1;

        const currentStr = element.innerText === '...' ? '0' : element.innerText.replace(/,/g, '');
        const current = parseInt(currentStr) || 0;

        if (current !== target || element.innerText === '...') {
            element.innerText = target.toLocaleString();

            // Trigger a flash effect
            element.classList.remove('update-flash');
            void element.offsetWidth; // trigger reflow
            element.classList.add('update-flash');
        }
    }

    // 4. Fetch Function (JSONP Injection)
    function fetchCount() {
        // Set a fallback timer: if request hangs (common on localhost), show "1"
        window.trafficTimer = setTimeout(() => {
            const el = document.getElementById(COUNT_ID);
            if (el && (el.innerText === '...' || el.innerText === '-')) {
                // Localhost default: Just YOU are online
                updateCount(el, 1);
            }
        }, 3000);

        const script = document.createElement('script');
        // Use the generated key explicitly
        script.src = `${API_BASE}?k=${SITE_KEY}&t=${Date.now()}`;
        script.async = true;

        script.onerror = function () {
            // On error (blocked?), fallback to 1
            if (window.trafficTimer) clearTimeout(window.trafficTimer);
            const el = document.getElementById(COUNT_ID);
            if (el) updateCount(el, 1);
        };

        document.head.appendChild(script);

        script.onload = function () {
            setTimeout(() => { script.remove(); }, 1000);
        };
    }

    // Initialize
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
