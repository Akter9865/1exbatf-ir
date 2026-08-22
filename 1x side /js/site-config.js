/**
 * Site Configuration & State Management Engine
 * Handles default settings, localStorage persistence, and live DOM updates.
 */

const WZ_CONFIG_KEY = 'wz_admin_site_config';
const WZ_AUTH_KEY = 'wz_admin_auth_credentials';
const WZ_STATS_KEY = 'wz_admin_stats';

const DEFAULT_CONFIG = {
  // Page Meta
  pageTitle: "Winzing247 - WhatsApp Chat",
  metaDescription: "Business Account",
  faviconUrl: "images/FJbTMJqMap7.svg",
  
  // Branding & Profile
  brandName: "Winzing247",
  brandSubtitle: "WhatsApp Contact Account",
  avatarImage: "images/WIN-Logo.png",
  showVerifiedBadge: true,
  verifiedBadgeColor: "#25D366",
  
  // WhatsApp & Action Link
  targetUrl: "https://wa.link/wzmark2",
  prefilledLabel: "Prefilled Message",
  prefilledMessage: "I want ID",
  sliderLabel: "Start WhatsApp Chat ›",
  buttonMode: "slider", // 'slider' | 'button' | 'pulse'
  
  // Redirect & Timing
  autoRedirectEnabled: true,
  autoRedirectDelay: 6, // in seconds
  
  // Tracking & Pixels
  pixelId: "1740160693928093",
  pixelEvent: "Lead",
  customPixelEvent: "WZMARK2",
  customHeadScript: "",
  
  // Theme & Appearance
  primaryColor: "#25D366",
  darkGreenColor: "#008069",
  tealColor: "#128c7e",
  pageBgColor: "#f0f2f5",
  cardBgColor: "#ffffff",
  textColor: "#111b21",
  headerLogoType: "whatsapp", // 'whatsapp' | 'custom'
  customHeaderLogo: "",
  
  // Footer
  footerCopyright: "2025-2026 © WhatsApp LLC",
  showFooter: true
};

const DEFAULT_AUTH = {
  email: "adim@support.com",
  password: "admin@123"
};

const SiteConfig = {
  // Get current config with defaults fallback
  getConfig: function() {
    try {
      const stored = localStorage.getItem(WZ_CONFIG_KEY);
      if (stored) {
        return Object.assign({}, DEFAULT_CONFIG, JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not read config from localStorage:", e);
    }
    return Object.assign({}, DEFAULT_CONFIG);
  },

  // Save config to localStorage
  saveConfig: function(newConfig) {
    try {
      const merged = Object.assign({}, this.getConfig(), newConfig);
      localStorage.setItem(WZ_CONFIG_KEY, JSON.stringify(merged));
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent('wz_config_updated', { detail: merged }));
      return true;
    } catch (e) {
      console.error("Failed to save config:", e);
      return false;
    }
  },

  // Reset to default configuration
  resetToDefault: function() {
    try {
      localStorage.removeItem(WZ_CONFIG_KEY);
      window.dispatchEvent(new CustomEvent('wz_config_updated', { detail: DEFAULT_CONFIG }));
      return Object.assign({}, DEFAULT_CONFIG);
    } catch (e) {
      console.error("Failed to reset config:", e);
      return DEFAULT_CONFIG;
    }
  },

  // Admin Auth Credentials Management
  getAuth: function() {
    try {
      const stored = localStorage.getItem(WZ_AUTH_KEY);
      if (stored) {
        return Object.assign({}, DEFAULT_AUTH, JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not read auth from localStorage:", e);
    }
    return Object.assign({}, DEFAULT_AUTH);
  },

  saveAuth: function(authData) {
    try {
      localStorage.setItem(WZ_AUTH_KEY, JSON.stringify(authData));
      return true;
    } catch (e) {
      console.error("Failed to save auth:", e);
      return false;
    }
  },

  // Check login credentials
  verifyLogin: function(email, password) {
    const auth = this.getAuth();
    return (
      auth.email.trim().toLowerCase() === (email || '').trim().toLowerCase() &&
      auth.password === password
    );
  },

  // Visitor / Click Stats Management
  getStats: function() {
    try {
      const stored = localStorage.getItem(WZ_STATS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { visits: 0, clicks: 0, lastVisit: null, lastClick: null };
  },

  recordVisit: function() {
    try {
      const stats = this.getStats();
      stats.visits = (stats.visits || 0) + 1;
      stats.lastVisit = new Date().toISOString();
      localStorage.setItem(WZ_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  },

  recordClick: function() {
    try {
      const stats = this.getStats();
      stats.clicks = (stats.clicks || 0) + 1;
      stats.lastClick = new Date().toISOString();
      localStorage.setItem(WZ_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  },

  resetStats: function() {
    try {
      const initial = { visits: 0, clicks: 0, lastVisit: null, lastClick: null };
      localStorage.setItem(WZ_STATS_KEY, JSON.stringify(initial));
      return initial;
    } catch (e) {}
  },

  // Apply configuration to DOM elements on index.html
  applyToPage: function() {
    const config = this.getConfig();

    // 1. Page Title & Meta
    if (config.pageTitle) {
      document.title = config.pageTitle;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', config.pageTitle);
    }
    if (config.metaDescription) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', config.metaDescription);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', config.metaDescription);
    }
    if (config.faviconUrl) {
      let icon = document.querySelector('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement('link');
        icon.rel = 'icon';
        document.head.appendChild(icon);
      }
      icon.href = config.faviconUrl;
    }

    // 2. Profile Branding
    const titleEl = document.querySelector('.profile-title') || document.getElementById('profileTitle');
    if (titleEl && config.brandName) titleEl.textContent = config.brandName;

    const subtitleEl = document.querySelector('.profile-subtitle') || document.getElementById('profileSubtitle');
    if (subtitleEl && config.brandSubtitle) subtitleEl.textContent = config.brandSubtitle;

    const avatarEl = document.querySelector('.profile-avatar') || document.getElementById('profileAvatar');
    if (avatarEl && config.avatarImage) {
      avatarEl.src = config.avatarImage;
      avatarEl.alt = config.brandName || "Profile Avatar";
    }

    const badgeEl = document.querySelector('.wa-badge-icon') || document.getElementById('profileBadge');
    if (badgeEl) {
      badgeEl.style.display = config.showVerifiedBadge ? 'flex' : 'none';
      const badgeSvg = badgeEl.querySelector('svg');
      if (badgeSvg && config.verifiedBadgeColor) {
        badgeSvg.setAttribute('fill', config.verifiedBadgeColor);
      }
    }

    // 3. Message Bubble
    const labelEl = document.querySelector('.msg-preview-label') || document.getElementById('msgPreviewLabel');
    if (labelEl && config.prefilledLabel) labelEl.textContent = config.prefilledLabel;

    const bubbleEl = document.querySelector('.msg-bubble') || document.getElementById('msgBubble');
    if (bubbleEl && config.prefilledMessage) bubbleEl.textContent = config.prefilledMessage;

    // 4. Slider / Button Label
    const sliderLabelEl = document.getElementById('sliderLabel');
    if (sliderLabelEl && config.sliderLabel) sliderLabelEl.textContent = config.sliderLabel;

    // 5. Colors & Theme CSS Variables
    const root = document.documentElement;
    if (config.primaryColor) root.style.setProperty('--wa-green', config.primaryColor);
    if (config.darkGreenColor) root.style.setProperty('--wa-dark-green', config.darkGreenColor);
    if (config.tealColor) root.style.setProperty('--wa-teal', config.tealColor);
    if (config.pageBgColor) {
      root.style.setProperty('--wa-bg', config.pageBgColor);
      document.body.style.backgroundColor = config.pageBgColor;
    }
    if (config.cardBgColor) root.style.setProperty('--wa-card-bg', config.cardBgColor);
    if (config.textColor) root.style.setProperty('--wa-text-primary', config.textColor);

    // 6. Header Logo
    const headerLogoContainer = document.querySelector('.wa-logo-container');
    if (headerLogoContainer) {
      if (config.headerLogoType === 'custom' && config.customHeaderLogo) {
        headerLogoContainer.innerHTML = `<img src="${config.customHeaderLogo}" alt="Logo" style="max-height: 32px; max-width: 160px; object-fit: contain;">`;
      }
    }

    // 7. Footer
    const footerBottom = document.querySelector('.footer-bottom div:first-child') || document.getElementById('footerCopyright');
    if (footerBottom && config.footerCopyright) {
      footerBottom.textContent = config.footerCopyright;
    }

    const footerEl = document.querySelector('footer.wa-footer');
    if (footerEl) {
      footerEl.style.display = config.showFooter !== false ? 'block' : 'none';
    }

    // 8. Pixel & Custom Script injection if ID changed
    if (config.pixelId && typeof window.fbq === 'function') {
      try {
        window.fbq('init', config.pixelId);
      } catch (e) {}
    }
  }
};

// Export globally
window.SiteConfig = SiteConfig;
window.DEFAULT_CONFIG = DEFAULT_CONFIG;
window.DEFAULT_AUTH = DEFAULT_AUTH;
