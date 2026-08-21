/* ============================================
   THEME SWITCHER JAVASCRIPT
   ============================================ */

(function () {
    'use strict';

    // Theme Switcher
    const ThemeSwitcher = {
        init: function () {
            this.loadTheme();
            this.bindEvents();
        },

        loadTheme: function () {
            // Get saved theme or default to dark
            const savedTheme = localStorage.getItem('adminTheme') || 'dark';
            this.setTheme(savedTheme, false);
        },

        setTheme: function (theme, save = true) {
            // Set data-theme attribute on html element
            document.documentElement.setAttribute('data-theme', theme);
            document.body.setAttribute('data-theme', theme);

            // Save to localStorage
            if (save) {
                localStorage.setItem('adminTheme', theme);
            }

            // Update toggle button icon
            this.updateToggleIcon(theme);

            // Dispatch custom event
            const event = new CustomEvent('themeChanged', { detail: { theme: theme } });
            document.dispatchEvent(event);
        },

        toggleTheme: function () {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
        },

        updateToggleIcon: function (theme) {
            const toggleBtn = document.getElementById('theme-toggle');
            if (!toggleBtn) return;

            const icon = toggleBtn.querySelector('i');
            if (!icon) return;

            if (theme === 'dark') {
                icon.className = 'mdi mdi-white-balance-sunny noti-icon';
                toggleBtn.setAttribute('title', 'Switch to Light Mode');
            } else {
                icon.className = 'mdi mdi-moon-waning-crescent noti-icon';
                toggleBtn.setAttribute('title', 'Switch to Dark Mode');
            }
        },

        bindEvents: function () {
            const self = this;

            // Wait for DOM to be ready
            document.addEventListener('DOMContentLoaded', function () {
                const toggleBtn = document.getElementById('theme-toggle');

                if (toggleBtn) {
                    toggleBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        self.toggleTheme();
                    });
                }
            });
        }
    };

    // Initialize theme switcher
    ThemeSwitcher.init();

    // Expose to window for external access if needed
    window.ThemeSwitcher = ThemeSwitcher;

})();
