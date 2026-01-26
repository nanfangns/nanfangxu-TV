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
    const POSITION_STORAGE_KEY = 'nanfangxutv_live_widget_position';
    const EDGE_MARGIN = 20;

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
        setupDraggable(widget);
    }

    function setupDraggable(widget) {
        const saved = readSavedPosition();
        applySavedPosition(widget, saved);

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        const onPointerMove = (event) => {
            if (!dragging) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            const nextLeft = startLeft + dx;
            const nextTop = startTop + dy;
            const clamped = clampToViewport(widget, nextLeft, nextTop);
            widget.style.left = `${clamped.left}px`;
            widget.style.top = `${clamped.top}px`;
        };

        const onPointerUp = () => {
            if (!dragging) return;
            dragging = false;
            widget.classList.remove('is-dragging');
            widget.releasePointerCapture?.(pointerId);
            snapToEdge(widget);
            savePosition(widget);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        let pointerId = null;
        widget.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            dragging = true;
            pointerId = event.pointerId;
            widget.setPointerCapture?.(pointerId);
            widget.classList.add('is-dragging');
            const rect = widget.getBoundingClientRect();
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            widget.style.right = 'auto';
            widget.style.bottom = 'auto';
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });

        window.addEventListener('resize', () => {
            const current = readSavedPosition();
            applySavedPosition(widget, current);
        });
    }

    function clampToViewport(widget, left, top) {
        const rect = widget.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - EDGE_MARGIN;
        const maxTop = window.innerHeight - rect.height - EDGE_MARGIN;
        return {
            left: Math.min(Math.max(left, EDGE_MARGIN), Math.max(EDGE_MARGIN, maxLeft)),
            top: Math.min(Math.max(top, EDGE_MARGIN), Math.max(EDGE_MARGIN, maxTop))
        };
    }

    function snapToEdge(widget) {
        const rect = widget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const side = centerX <= window.innerWidth / 2 ? 'left' : 'right';
        const targetLeft = side === 'left'
            ? EDGE_MARGIN
            : window.innerWidth - rect.width - EDGE_MARGIN;
        const clamped = clampToViewport(widget, targetLeft, rect.top);
        widget.style.left = `${clamped.left}px`;
        widget.style.top = `${clamped.top}px`;
        widget.style.right = 'auto';
        widget.classList.toggle('is-snap-left', side === 'left');
        widget.classList.toggle('is-snap-right', side === 'right');
    }

    function savePosition(widget) {
        const rect = widget.getBoundingClientRect();
        const side = rect.left + rect.width / 2 <= window.innerWidth / 2 ? 'left' : 'right';
        const payload = {
            side,
            top: rect.top
        };
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(payload));
    }

    function readSavedPosition() {
        const raw = localStorage.getItem(POSITION_STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    function applySavedPosition(widget, saved) {
        if (!saved) return;
        const rect = widget.getBoundingClientRect();
        const side = saved.side === 'left' ? 'left' : 'right';
        const targetLeft = side === 'left'
            ? EDGE_MARGIN
            : window.innerWidth - rect.width - EDGE_MARGIN;
        const clamped = clampToViewport(widget, targetLeft, Number(saved.top) || rect.top);
        widget.style.left = `${clamped.left}px`;
        widget.style.top = `${clamped.top}px`;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        widget.classList.toggle('is-snap-left', side === 'left');
        widget.classList.toggle('is-snap-right', side === 'right');
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

    function isInIframe() {
        return window.self !== window.top;
    }

    function init() {
        if (isInIframe()) return;
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
