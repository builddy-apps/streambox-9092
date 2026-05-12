const ACCESS_TOKEN_KEY = 'streambox_access_token';
const REFRESH_TOKEN_KEY = 'streambox_refresh_token';
const USER_KEY = 'streambox_user';

export function storeTokens(accessToken, refreshToken, user) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getAccessToken();
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    if (data.success && data.data) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
      }
      return data.data.accessToken;
    }

    throw new Error('Invalid response from refresh endpoint');
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearAuth();
    throw error;
  }
}

export function redirectToLogin(returnUrl = null) {
  const currentPath = window.location.pathname;
  const redirect = returnUrl || (currentPath.includes('login') ? '/index.html' : currentPath);
  window.location.href = `/login.html?redirect=${encodeURIComponent(redirect)}`;
}

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(accessToken) {
  refreshSubscribers.forEach(callback => callback(accessToken));
  refreshSubscribers = [];
}

export async function authFetch(url, options = {}) {
  const accessToken = getAccessToken();
  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
    }
  };

  try {
    let response = await fetch(url, authOptions);

    if (response.status === 401 && getRefreshToken()) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newAccessToken = await refreshAccessToken();
          isRefreshing = false;
          onTokenRefreshed(newAccessToken);
        } catch (refreshError) {
          isRefreshing = false;
          clearAuth();
          redirectToLogin();
          throw new Error('Session expired');
        }
      } else {
        await new Promise(resolve => {
          subscribeTokenRefresh(token => {
            authOptions.headers['Authorization'] = `Bearer ${token}`;
            resolve();
          });
        });
      }

      response = await fetch(url, authOptions);
    }

    return response;
  } catch (error) {
    if (error.message === 'Session expired') {
      throw error;
    }
    console.error('Auth fetch error:', error);
    throw error;
  }
}

export function checkAuthStatus() {
  const accessToken = getAccessToken();
  const user = getUser();

  if (window.location.pathname.includes('login') && accessToken && user) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect') || '/index.html';
    window.location.href = redirectPath;
    return;
  }

  const publicPaths = ['/login.html', '/login'];
  const isPublicPath = publicPaths.some(path => window.location.pathname.includes(path));
  
  if (!accessToken && !isPublicPath) {
    redirectToLogin();
    return;
  }
}

export function initAuth() {
  checkAuthStatus();
}

export default {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  getUser,
  clearAuth,
  isAuthenticated,
  authFetch,
  redirectToLogin,
  checkAuthStatus,
  initAuth
};