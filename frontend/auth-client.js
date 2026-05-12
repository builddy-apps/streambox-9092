const Auth = {
    KEYS: {
        ACCESS: 'accessToken',
        REFRESH: 'refreshToken',
        USER: 'userData'
    },

    async login(email, password) {
        try {
            const response = await window.StreamBox.API.post('/api/auth/login', { email, password });
            
            if (response.success) {
                this.storeTokens(response.data);
                window.StreamBox.Toast.show('Welcome back!', 'success');
                return { success: true };
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (error) {
            window.StreamBox.Toast.show(error.message || 'Invalid credentials', 'error');
            return { success: false, error: error.message };
        }
    },

    async register(email, password, name) {
        try {
            const response = await window.StreamBox.API.post('/api/auth/register', { email, password, name });
            
            if (response.success) {
                this.storeTokens(response.data);
                window.StreamBox.Toast.show('Account created successfully!', 'success');
                return { success: true };
            } else {
                throw new Error(response.error || 'Registration failed');
            }
        } catch (error) {
            window.StreamBox.Toast.show(error.message || 'Failed to create account', 'error');
            return { success: false, error: error.message };
        }
    },

    logout() {
        localStorage.removeItem(this.KEYS.ACCESS);
        localStorage.removeItem(this.KEYS.REFRESH);
        localStorage.removeItem(this.KEYS.USER);
        window.StreamBox.Toast.show('Logged out successfully', 'info');
        window.location.href = '/login.html';
    },

    storeTokens(data) {
        if (data.accessToken) {
            localStorage.setItem(this.KEYS.ACCESS, data.accessToken);
        }
        if (data.refreshToken) {
            localStorage.setItem(this.KEYS.REFRESH, data.refreshToken);
        }
        if (data.userId || data.email || data.name) {
            const userData = {
                userId: data.userId,
                email: data.email,
                name: data.name
            };
            localStorage.setItem(this.KEYS.USER, JSON.stringify(userData));
        }
    },

    getAccessToken() {
        return localStorage.getItem(this.KEYS.ACCESS);
    },

    getRefreshToken() {
        return localStorage.getItem(this.KEYS.REFRESH);
    },

    getUser() {
        const userData = localStorage.getItem(this.KEYS.USER);
        return userData ? JSON.parse(userData) : null;
    },

    isAuthenticated() {
        return !!this.getAccessToken();
    },

    init() {
        const publicPages = ['/login.html', '/index.html'];
        const currentPath = window.location.pathname;
        const isPublicPage = publicPages.some(path => currentPath.endsWith(path)) || currentPath === '/';

        if (!this.isAuthenticated() && !isPublicPage) {
            window.location.href = '/login.html';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.StreamBox = window.StreamBox || {};
    window.StreamBox.Auth = Auth;
    Auth.init();
});