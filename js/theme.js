(() => {
    const THEME_STORAGE_KEY = 'siteTheme';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const getStoredTheme = () => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return stored === 'dark' || stored === 'light' ? stored : null;
    };

    const getPreferredTheme = () => {
        const stored = getStoredTheme();
        if (stored) return stored;
        return mediaQuery.matches ? 'dark' : 'light';
    };

    const updateToggles = (theme) => {
        document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
            if (toggle.type === 'checkbox') {
                toggle.checked = theme === 'dark';
                return;
            }
            toggle.setAttribute('aria-pressed', theme === 'dark');
            toggle.dataset.themeState = theme;
        });

        document.querySelectorAll('[data-theme-status]').forEach((status) => {
            status.textContent = theme === 'dark' ? '夜间' : '白天';
        });
    };

    const applyTheme = (theme, persist = false) => {
        const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', resolvedTheme);
        document.documentElement.style.colorScheme = resolvedTheme;
        if (persist) {
            localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
        }
        updateToggles(resolvedTheme);
    };

    const handleToggle = (event) => {
        const target = event.currentTarget;
        const nextTheme = target.type === 'checkbox'
            ? (target.checked ? 'dark' : 'light')
            : (document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        applyTheme(nextTheme, true);
    };

    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(getPreferredTheme());
        document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
            if (toggle.type === 'checkbox') {
                toggle.addEventListener('change', handleToggle);
            } else {
                toggle.addEventListener('click', handleToggle);
            }
        });
    });

    if (mediaQuery) {
        mediaQuery.addEventListener('change', (event) => {
            if (!getStoredTheme()) {
                applyTheme(event.matches ? 'dark' : 'light');
            }
        });
    }

    window.setTheme = (theme) => applyTheme(theme, true);
})();
