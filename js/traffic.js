/**
 * Real-Time Visitor Counter (whos.amung.us JSONP)
 * Injects a Premium Glassmorphism Widget and fetches real-time "Right Now" users.
 */

/**
 * Real-Time Activity Counter (Busuanzi)
 * Tracks "Real-time Heat" (PV) to provide immediate, satisfying feedback.
 * More robust than IP-based concurrent counters for static sites.
 */

(function () {
    // Configuration
    const WIDGET_ID = 'live-visitor-widget';
    // Busuanzi uses specific IDs to inject data
    const B_CONTAINER_ID = 'busuanzi_container_site_pv';
    const B_VALUE_ID = 'busuanzi_value_site_pv';
    const SCRIPT_URL = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';

    // 1. Create and Inject Widget HTML
    function createWidget() {
        if (document.getElementById(WIDGET_ID)) return;

        const widget = document.createElement('div');
        widget.id = WIDGET_ID;
        widget.className = 'live-viewer-widget';
        // Hide initially until data loads
        widget.style.opacity = '0';

        widget.innerHTML = `
            <div class="live-dot-container">
                <div class="live-dot-pulse"></div>
                <div class="live-dot-center"></div>
            </div>
            <div class="live-text-container" id="${B_CONTAINER_ID}" style="display:flex; flex-direction:column;">
                <span class="live-label">实时热度</span>
                <span class="live-count">
                    <!-- Busuanzi will inject the number here -->
                    <span id="${B_VALUE_ID}">...</span>
                </span>
            </div>
        `;
        document.body.appendChild(widget);
    }

    // 2. Inject Busuanzi Script
    function loadBusuanzi() {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        // Fix for Busuanzi sometimes getting stuck: 
        // We manually observe the element change to trigger our animation
        script.onload = () => {
            watchForUpdates();
        };
        document.head.appendChild(script);
    }

    // 3. Watch for Data Load & Updates
    function watchForUpdates() {
        const valueEl = document.getElementById(B_VALUE_ID);
        const widget = document.getElementById(WIDGET_ID);

        // Polling to check when Busuanzi populates the data
        const checkInterval = setInterval(() => {
            if (valueEl && valueEl.innerText !== '...' && valueEl.innerText.length > 0) {
                // Data Loaded! Show widget
                widget.style.opacity = '1';
                widget.classList.add('fade-in-up'); // Ensure we have this animation or just use transition

                // Add flash effect whenever it changes (optional, but Busuanzi updates on refresh usually)
                valueEl.parentElement.classList.add('update-flash');

                clearInterval(checkInterval);
            }
        }, 500);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createWidget();
            loadBusuanzi();
        });
    } else {
        createWidget();
        loadBusuanzi();
    }

})();
