// Dark Mode Manager (AMOLED-optimized)
const DarkMode = {
    init() {
        const saved = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.enabled = saved !== null ? saved === 'true' : prefersDark;
        this.apply();
    },

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('darkMode', this.enabled);
        this.apply();
    },

    apply() {
        if (this.enabled) {
            document.documentElement.classList.add('dark');
            document.body.style.backgroundColor = '#000000';
            document.body.style.color = '#ffffff';
        } else {
            document.documentElement.classList.remove('dark');
            document.body.style.backgroundColor = '#f8fafc';
            document.body.style.color = '#1e293b';
        }
    }
};

// API Helper Functions
const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('accessToken');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };

        try {
            const response = await fetch(endpoint, {
                ...options,
                headers: { ...headers, ...options.headers }
            });

            if (response.status === 401) {
                await this.refreshToken();
                const newToken = localStorage.getItem('accessToken');
                return fetch(endpoint, {
                    ...options,
                    headers: { ...headers, 'Authorization': `Bearer ${newToken}` }
                });
            }

            return response;
        } catch (err) {
            Toast.show('Network error. Please check your connection.', 'error');
            throw err;
        }
    },

    async get(url) {
        const res = await this.request(url);
        if (!res.ok) throw new Error(`GET ${url} failed`);
        return res.json();
    },

    async post(url, data) {
        const res = await this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`POST ${url} failed`);
        return res.json();
    },

    async put(url, data) {
        const res = await this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`PUT ${url} failed`);
        return res.json();
    },

    async delete(url) {
        const res = await this.request(url, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${url} failed`);
        return res.json();
    },

    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');

            const res = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!res.ok) throw new Error('Refresh failed');

            const data = await res.json();
            if (data.success) {
                localStorage.setItem('accessToken', data.data.accessToken);
                localStorage.setItem('refreshToken', data.data.refreshToken);
            }
        } catch (err) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login.html';
        }
    }
};

// Toast Notification System
const Toast = {
    container: null,

    init() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        const bgColor = {
            'info': 'bg-blue-600',
            'success': 'bg-green-600',
            'error': 'bg-red-600',
            'warning': 'bg-yellow-600'
        }[type] || 'bg-gray-600';

        toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0`;
        toast.textContent = message;

        this.container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// D-pad Navigation Manager
const DPadNav = {
    focusableElements: [],
    currentIndex: 0,
    direction: 'horizontal',
    enabled: true,

    init(container = document.body, selector = '[data-focusable]') {
        this.updateFocusable(container, selector);
        if (this.focusableElements.length > 0) {
            this.focus(this.currentIndex);
        }
    },

    updateFocusable(container, selector) {
        this.focusableElements = Array.from(container.querySelectorAll(selector));
    },

    focus(index) {
        if (index < 0 || index >= this.focusableElements.length) return;
        
        this.focusableElements.forEach(el => el.classList.remove('dpad-focused'));
        this.currentIndex = index;
        const element = this.focusableElements[index];
        element.classList.add('dpad-focused');
        
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    },

    moveLeft() {
        if (this.direction === 'horizontal') {
            this.focus(this.currentIndex - 1);
        } else {
            this.focus(Math.max(0, this.currentIndex - this.getRowSize()));
        }
    },

    moveRight() {
        if (this.direction === 'horizontal') {
            this.focus(this.currentIndex + 1);
        } else {
            this.focus(Math.min(this.focusableElements.length - 1, this.currentIndex + this.getRowSize()));
        }
    },

    moveUp() {
        if (this.direction === 'vertical') {
            this.focus(this.currentIndex - 1);
        } else {
            this.focus(Math.max(0, this.currentIndex - this.getRowSize()));
        }
    },

    moveDown() {
        if (this.direction === 'vertical') {
            this.focus(this.currentIndex + 1);
        } else {
            this.focus(Math.min(this.focusableElements.length - 1, this.currentIndex + this.getRowSize()));
        }
    },

    getRowSize() {
        if (this.focusableElements.length === 0) return 1;
        const first = this.focusableElements[0].getBoundingClientRect();
        const second = this.focusableElements[1]?.getBoundingClientRect();
        if (!second) return 1;
        return Math.floor(window.innerWidth / (second.left - first.left));
    },

    select() {
        const element = this.focusableElements[this.currentIndex];
        if (element) {
            element.click();
            element.classList.add('scale-95');
            setTimeout(() => element.classList.remove('scale-95'), 150);
        }
    },

    back() {
        window.history.back();
    },

    handleKey(key) {
        if (!this.enabled) return;

        switch (key) {
            case 'ArrowLeft': this.moveLeft(); break;
            case 'ArrowRight': this.moveRight(); break;
            case 'ArrowUp': this.moveUp(); break;
            case 'ArrowDown': this.moveDown(); break;
            case 'Enter': this.select(); break;
            case 'Backspace': this.back(); break;
        }
    }
};

// Page Transition Manager with Cinemagraphic Effects
const PageTransition = {
    async navigate(url) {
        const currentPage = document.querySelector('main') || document.body;
        
        // Cinemagraphic fade-out with zoom effect
        currentPage.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
        currentPage.style.opacity = '0';
        currentPage.style.transform = 'scale(1.02)';

        await new Promise(resolve => setTimeout(resolve, 400));

        window.location.href = url;
    },

    animateIn() {
        const page = document.querySelector('main') || document.body;
        page.style.opacity = '0';
        page.style.transform = 'scale(0.98) translateY(20px)';
        page.style.transition = 'none';

        requestAnimationFrame(() => {
            page.style.transition = 'opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            page.style.opacity = '1';
            page.style.transform = 'scale(1) translateY(0)';
        });
    }
};

// TV Remote Key Handler
const TVRemote = {
    keyMap: {
        'Left': 'ArrowLeft',
        'Right': 'ArrowRight',
        'Up': 'ArrowUp',
        'Down': 'ArrowDown',
        'Enter': 'Enter',
        'Return': 'Backspace',
        'MediaPlayPause': 'Space',
        'MediaRewind': 'ArrowLeft',
        'MediaFastForward': 'ArrowRight'
    },

    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Samsung Tizen specific
        if (window.tizen) {
            document.addEventListener('tizenkeydown', (e) => {
                const mappedKey = this.keyMap[e.keyName] || e.keyName;
                DPadNav.handleKey(mappedKey);
            });
        }
    },

    handleKeyDown(e) {
        // Allow certain keys to pass through
        if (e.key === 'Tab' || (e.ctrlKey || e.metaKey || e.altKey)) return;

        // Map TV remote keys
        const mappedKey = this.keyMap[e.key] || e.key;
        
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Backspace'].includes(mappedKey)) {
            e.preventDefault();
            DPadNav.handleKey(mappedKey);
        }
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    DarkMode.init();
    Toast.init();
    TVRemote.init();
    PageTransition.animateIn();

    // Add D-pad focus styles
    const style = document.createElement('style');
    style.textContent = `
        [data-focusable] {
            outline: none;
            transition: all 0.2s ease-out;
        }
        .dpad-focused {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
            transform: scale(1.05);
            z-index: 10;
        }
        .dark .dpad-focused {
            box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.5), 0 0 20px rgba(96, 165, 250, 0.3);
        }
    `;
    document.head.appendChild(style);
});

// Export for use in other files
window.StreamBox = {
    DarkMode,
    API,
    Toast,
    DPadNav,
    PageTransition
};