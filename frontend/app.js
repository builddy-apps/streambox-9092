// Shared app state
const AppState = {
  currentUser: null,
  currentPage: 'home',
  isLoading: false,
  dPadEnabled: true,
  focusableElements: [],
  currentFocusIndex: -1
};

// Dark mode management
function initDarkMode() {
  const savedMode = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = savedMode === 'true' || (savedMode === null && prefersDark);
  
  document.documentElement.classList.toggle('dark', shouldBeDark);
  document.body.style.backgroundColor = shouldBeDark ? '#000000' : '#f8fafc';
  
  return shouldBeDark;
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
  document.body.style.backgroundColor = isDark ? '#000000' : '#f8fafc';
  
  const toggleBtn = document.getElementById('darkModeToggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = isDark 
      ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>'
      : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';
  }
}

// API helper functions with error handling and auth
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('accessToken');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });
    
    if (response.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
      throw new Error('Session expired');
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// Toast notification system
const Toast = {
  container: null,
  
  init() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(this.container);
  },
  
  show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();
    
    const id = Date.now();
    const toast = document.createElement('div');
    toast.id = `toast-${id}`;
    toast.className = `pointer-events-auto max-w-sm px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0 ${
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'warning' ? 'bg-yellow-500 text-black' :
      'bg-slate-800 text-white dark:bg-white dark:text-black'
    }`;
    
    toast.innerHTML = `
      <div class="flex items-center gap-3">
        ${type === 'error' ? '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' :
          type === 'success' ? '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
          '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'}
        <span class="text-sm font-medium">${message}</span>
        <button onclick="Toast.hide(${id})" class="ml-auto opacity-60 hover:opacity-100 transition-opacity">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    `;
    
    this.container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    });
    
    if (duration > 0) {
      setTimeout(() => this.hide(id), duration);
    }
    
    return id;
  },
  
  hide(id) {
    const toast = document.getElementById(`toast-${id}`);
    if (!toast) return;
    
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  },
  
  error(message, duration = 6000) {
    return this.show(message, 'error', duration);
  },
  
  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  },
  
  warning(message, duration = 4000) {
    return this.show(message, 'warning', duration);
  }
};

// Page navigation system with cinematic transitions
const Navigation = {
  currentPage: null,
  
  init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
    this.initTransitions();
  },
  
  handleHashChange() {
    const hash = window.location.hash.slice(1) || 'home';
    const pageMap = {
      '': 'home',
      'home': 'home',
      'search': 'search',
      'library': 'library',
      'detail': 'detail',
      'player': 'player'
    };
    
    this.navigateTo(pageMap[hash] || 'home', false);
  },
  
  navigateTo(page, updateHash = true) {
    if (this.currentPage === page) return;
    
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    const oldPage = this.currentPage;
    this.currentPage = page;
    AppState.currentPage = page;
    
    if (oldPage) {
      mainContent.classList.add('opacity-0', 'scale-95', 'blur-sm');
      mainContent.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }
    
    setTimeout(async () => {
      try {
        const pageUrl = page === 'home' ? 'home.html' : `${page}.html`;
        const response = await fetch(pageUrl);
        if (!response.ok) throw new Error('Page not found');
        
        const html = await response.text();
        mainContent.innerHTML = html;
        
        if (updateHash) {
          window.history.pushState(null, '', `#${page}`);
        }
        
        window.scrollTo(0, 0);
        
        requestAnimationFrame(() => {
          mainContent.classList.remove('opacity-0', 'scale-95', 'blur-sm');
          this.animatePageElements();
        });
      } catch (error) {
        console.error('Navigation error:', error);
        mainContent.innerHTML = `
          <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div class="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h2 class="text-2xl font-bold mb-2 dark:text-white">Page Not Found</h2>
            <p class="text-slate-500 dark:text-slate-400 mb-6">The page you're looking for doesn't exist.</p>
            <button onclick="Navigation.navigateTo('home')" class="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors">
              Go Home
            </button>
          </div>
        `;
        mainContent.classList.remove('opacity-0', 'scale-95', 'blur-sm');
      }
    }, oldPage ? 400 : 0);
  },
  
  initTransitions() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.style.transition = 'opacity 0.4s ease, transform 0.4s ease, filter 0.4s ease';
    }
  },
  
  animatePageElements() {
    const elements = document.querySelectorAll('.animate-in, [data-animate]');
    elements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }
};

// TV D-pad navigation helper
const DPadNav = {
  init() {
    this.scanFocusableElements();
    this.attachKeyListeners();
    this.highlightActiveNav();
  },
  
  scanFocusableElements() {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '.focusable'
    ];
    
    AppState.focusableElements = Array.from(document.querySelectorAll(selectors.join(', ')));
    AppState.currentFocusIndex = -1;
  },
  
  attachKeyListeners() {
    document.addEventListener('keydown', (e) => {
      if (!AppState.dPadEnabled) return;
      
      const keyMap = {
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'Enter': 'enter',
        'Escape': 'escape'
      };
      
      if (keyMap[e.key]) {
        e.preventDefault();
        this.handleNavigation(keyMap[e.key]);
      }
    });
    
    document.addEventListener('focusin', () => {
      this.updateFocusIndex();
    });
  },
  
  handleNavigation(direction) {
    if (AppState.focusableElements.length === 0) {
      this.scanFocusableElements();
    }
    
    if (direction === 'enter') {
      return;
    }
    
    if (direction === 'escape') {
      const currentElement = AppState.focusableElements[AppState.currentFocusIndex];
      if (currentElement && currentElement.classList.contains('modal-open')) {
        currentElement.click();
      }
      return;
    }
    
    if (AppState.currentFocusIndex === -1) {
      this.focusElement(0);
      return;
    }
    
    const currentElement = AppState.focusableElements[AppState.currentFocusIndex];
    const rect = currentElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let bestIndex = -1;
    let bestDistance = Infinity;
    
    AppState.focusableElements.forEach((el, index) => {
      if (index === AppState.currentFocusIndex) return;
      
      const elRect = el.getBoundingClientRect();
      const elCenterX = elRect.left + elRect.width / 2;
      const elCenterY = elRect.top + elRect.height / 2;
      
      let isCandidate = false;
      let distance = 0;
      
      switch (direction) {
        case 'up':
          isCandidate = elCenterY < centerY - 10 && Math.abs(elCenterX - centerX) < 300;
          distance = Math.abs(elCenterY - centerY) + Math.abs(elCenterX - centerX) * 2;
          break;
        case 'down':
          isCandidate = elCenterY > centerY + 10 && Math.abs(elCenterX - centerX) < 300;
          distance = Math.abs(elCenterY - centerY) + Math.abs(elCenterX - centerX) * 2;
          break;
        case 'left':
          isCandidate = elCenterX < centerX - 10 && Math.abs(elCenterY - centerY) < 200;
          distance = Math.abs(elCenterX - centerX) + Math.abs(elCenterY - centerY) * 2;
          break;
        case 'right':
          isCandidate = elCenterX > centerX + 10 && Math.abs(elCenterY - centerY) < 200;
          distance = Math.abs(elCenterX - centerX) + Math.abs(elCenterY - centerY) * 2;
          break;
      }
      
      if (isCandidate && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    
    if (bestIndex !== -1) {
      this.focusElement(bestIndex);
    }
  },
  
  focusElement(index) {
    if (index < 0 || index >= AppState.focusableElements.length) return;
    
    AppState.currentFocusIndex = index;
    const element = AppState.focusableElements[index];
    
    element.focus();
    this.scrollIntoView(element);
    
    element.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2', 'ring-offset-black');
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2', 'ring-offset-black');
    }, 300);
  },
  
  updateFocusIndex() {
    const activeElement = document.activeElement;
    const index = AppState.focusableElements.indexOf(activeElement);
    if (index !== -1) {
      AppState.currentFocusIndex = index;
    }
  },
  
  scrollIntoView(element) {
    const rect = element.getBoundingClientRect();
    const padding = 100;
    
    if (rect.top < padding) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (rect.bottom > window.innerHeight - padding) {
      element.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  },
  
  highlightActiveNav() {
    const currentPath = window.location.hash.slice(1) || 'home';
    document.querySelectorAll('.nav-link').forEach(link => {
      const isActive = link.getAttribute('href') === `#${currentPath}`;
      link.classList.toggle('text-primary-500', isActive);
      link.classList.toggle('text-slate-600', !isActive);
      link.classList.toggle('dark:text-slate-300', !isActive);
    });
  },
  
  refresh() {
    this.scanFocusableElements();
  }
};

// Quality badge renderer
function getQualityBadge(quality) {
  const badges = {
    '4K': {
      bg: 'bg-amber-500',
      text: 'text-white',
      label: '4K'
    },
    'HD': {
      bg: 'bg-emerald-500',
      text: 'text-white',
      label: 'HD'
    },
    'SD': {
      bg: 'bg-slate-500',
      text: 'text-white',
      label: 'SD'
    }
  };
  
  const badge = badges[quality] || badges['SD'];
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badge.bg} ${badge.text}">${badge.label}</span>`;
}

function getStarRating(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  let stars = '';
  for (let i = 0; i < fullStars; i++) {
    stars += '<svg class="w-4 h-4 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>';
  }
  if (hasHalfStar) {
    stars += '<svg class="w-4 h-4 fill-amber-400" viewBox="0 0 20 20"><defs><linearGradient id="half"><stop offset="50%" stop-color="#fbbf24"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><path fill="url(#half)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
  }
  for (let i = 0; i < emptyStars; i++) {
    stars += '<svg class="w-4 h-4 fill-slate-300 dark:fill-slate-600" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>';
  }
  
  return `<div class="flex items-center gap-1">${stars}<span class="text-xs ml-1 text-slate-600 dark:text-slate-400">${rating.toFixed(1)}</span></div>`;
}

// Format duration helper
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format date helper
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  Toast.init();
  Navigation.init();
  
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }
  
  setTimeout(() => DPadNav.init(), 100);
  
  window.addEventListener('resize', debounce(() => {
    DPadNav.refresh();
  }, 250));
});

// Export for use in other files
window.AppState = AppState;
window.Toast = Toast;
window.Navigation = Navigation;
window.DPadNav = DPadNav;
window.apiRequest = apiRequest;
window.getQualityBadge = getQualityBadge;
window.getStarRating = getStarRating;
window.formatDuration = formatDuration;
window.formatDate = formatDate;
window.debounce = debounce;