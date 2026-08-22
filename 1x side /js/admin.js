/**
 * Admin Panel Interactive Logic & Live Preview Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginAlert = document.getElementById('loginAlert');
  const toggleLoginPassBtn = document.getElementById('toggleLoginPass');
  const logoutBtn = document.getElementById('logoutBtn');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Check login session
  function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('wz_admin_logged_in') === 'true' || localStorage.getItem('wz_admin_remember') === 'true';
    if (isLoggedIn) {
      loginOverlay.classList.add('hidden');
    } else {
      loginOverlay.classList.remove('hidden');
    }
  }

  // Toggle Password Visibility
  if (toggleLoginPassBtn) {
    toggleLoginPassBtn.addEventListener('click', () => {
      const isPass = loginPassword.type === 'password';
      loginPassword.type = isPass ? 'text' : 'password';
    });
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = loginEmail.value.trim();
      const pass = loginPassword.value;
      const remember = document.getElementById('rememberMe')?.checked;

      if (SiteConfig.verifyLogin(email, pass)) {
        sessionStorage.setItem('wz_admin_logged_in', 'true');
        if (remember) {
          localStorage.setItem('wz_admin_remember', 'true');
        }
        loginAlert.classList.remove('show');
        loginOverlay.classList.add('hidden');
        showToast('Login successful! Welcome to Admin Panel.', 'success');
      } else {
        loginAlert.textContent = 'Invalid Admin ID or Password. Please try again.';
        loginAlert.classList.add('show');
      }
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('wz_admin_logged_in');
      localStorage.removeItem('wz_admin_remember');
      loginOverlay.classList.remove('hidden');
      showToast('Logged out successfully.', 'success');
    });
  }

  // Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute('data-tab');
      if (!targetTab) return;

      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      item.classList.add('active');
      const content = document.getElementById(targetTab);
      if (content) content.classList.add('active');
    });
  });

  // Load Form Data from SiteConfig
  function loadFormData() {
    const config = SiteConfig.getConfig();
    const stats = SiteConfig.getStats();

    // Stats
    const statVisits = document.getElementById('statVisits');
    const statClicks = document.getElementById('statClicks');
    const statTargetUrl = document.getElementById('statTargetUrl');
    if (statVisits) statVisits.textContent = stats.visits || 0;
    if (statClicks) statClicks.textContent = stats.clicks || 0;
    if (statTargetUrl) statTargetUrl.textContent = config.targetUrl || 'Not set';

    // Basic & Branding
    setVal('cfgBrandName', config.brandName);
    setVal('cfgBrandSubtitle', config.brandSubtitle);
    setVal('cfgPageTitle', config.pageTitle);
    setVal('cfgMetaDescription', config.metaDescription);
    setVal('cfgFaviconUrl', config.faviconUrl);
    setChecked('cfgShowVerifiedBadge', config.showVerifiedBadge);
    setVal('cfgVerifiedBadgeColor', config.verifiedBadgeColor || '#25D366');

    // Images & Media
    setVal('cfgAvatarImage', config.avatarImage);
    const avatarPreview = document.getElementById('avatarImgPreview');
    if (avatarPreview && config.avatarImage) avatarPreview.src = config.avatarImage;

    setVal('cfgHeaderLogoType', config.headerLogoType || 'whatsapp');
    setVal('cfgCustomHeaderLogo', config.customHeaderLogo || '');

    // WhatsApp Links & Text
    setVal('cfgTargetUrl', config.targetUrl);
    setVal('cfgPrefilledLabel', config.prefilledLabel);
    setVal('cfgPrefilledMessage', config.prefilledMessage);
    setVal('cfgSliderLabel', config.sliderLabel);
    setVal('cfgButtonMode', config.buttonMode || 'slider');

    // Auto Redirect
    setChecked('cfgAutoRedirectEnabled', config.autoRedirectEnabled);
    setVal('cfgAutoRedirectDelay', config.autoRedirectDelay);
    const delayDisplay = document.getElementById('delayDisplay');
    if (delayDisplay) delayDisplay.textContent = `${config.autoRedirectDelay}s`;

    // Tracking & Pixels
    setVal('cfgPixelId', config.pixelId);
    setVal('cfgPixelEvent', config.pixelEvent);
    setVal('cfgCustomPixelEvent', config.customPixelEvent);
    setVal('cfgCustomHeadScript', config.customHeadScript);

    // Theme & Colors
    setVal('cfgPrimaryColor', config.primaryColor);
    setVal('cfgDarkGreenColor', config.darkGreenColor);
    setVal('cfgTealColor', config.tealColor);
    setVal('cfgPageBgColor', config.pageBgColor);
    setVal('cfgCardBgColor', config.cardBgColor);
    setVal('cfgTextColor', config.textColor);

    // Footer
    setVal('cfgFooterCopyright', config.footerCopyright);
    setChecked('cfgShowFooter', config.showFooter !== false);

    // Security Settings
    const auth = SiteConfig.getAuth();
    setVal('cfgAdminEmail', auth.email);

    updateLiveMockup();
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  }

  function setChecked(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(checked);
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function getChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }

  // Gather current form data
  function gatherFormData() {
    return {
      brandName: getVal('cfgBrandName'),
      brandSubtitle: getVal('cfgBrandSubtitle'),
      pageTitle: getVal('cfgPageTitle'),
      metaDescription: getVal('cfgMetaDescription'),
      faviconUrl: getVal('cfgFaviconUrl'),
      showVerifiedBadge: getChecked('cfgShowVerifiedBadge'),
      verifiedBadgeColor: getVal('cfgVerifiedBadgeColor'),
      avatarImage: getVal('cfgAvatarImage'),
      headerLogoType: getVal('cfgHeaderLogoType'),
      customHeaderLogo: getVal('cfgCustomHeaderLogo'),
      targetUrl: getVal('cfgTargetUrl'),
      prefilledLabel: getVal('cfgPrefilledLabel'),
      prefilledMessage: getVal('cfgPrefilledMessage'),
      sliderLabel: getVal('cfgSliderLabel'),
      buttonMode: getVal('cfgButtonMode'),
      autoRedirectEnabled: getChecked('cfgAutoRedirectEnabled'),
      autoRedirectDelay: parseInt(getVal('cfgAutoRedirectDelay'), 10) || 6,
      pixelId: getVal('cfgPixelId'),
      pixelEvent: getVal('cfgPixelEvent'),
      customPixelEvent: getVal('cfgCustomPixelEvent'),
      customHeadScript: getVal('cfgCustomHeadScript'),
      primaryColor: getVal('cfgPrimaryColor'),
      darkGreenColor: getVal('cfgDarkGreenColor'),
      tealColor: getVal('cfgTealColor'),
      pageBgColor: getVal('cfgPageBgColor'),
      cardBgColor: getVal('cfgCardBgColor'),
      textColor: getVal('cfgTextColor'),
      footerCopyright: getVal('cfgFooterCopyright'),
      showFooter: getChecked('cfgShowFooter')
    };
  }

  // Update Live Phone Mockup in real-time
  function updateLiveMockup() {
    const data = gatherFormData();

    const mockTitle = document.getElementById('mockTitle');
    const mockSubtitle = document.getElementById('mockSubtitle');
    const mockAvatar = document.getElementById('mockAvatar');
    const mockBadge = document.getElementById('mockBadge');
    const mockBadgeSvg = document.getElementById('mockBadgeSvg');
    const mockBubbleLabel = document.getElementById('mockBubbleLabel');
    const mockBubbleText = document.getElementById('mockBubbleText');
    const mockSliderText = document.getElementById('mockSliderText');
    const mockScreen = document.getElementById('mockScreen');
    const mockCard = document.getElementById('mockCard');
    const mockSliderThumb = document.getElementById('mockSliderThumb');

    if (mockTitle) mockTitle.textContent = data.brandName || 'WhatsApp Contact';
    if (mockSubtitle) mockSubtitle.textContent = data.brandSubtitle || '';
    if (mockAvatar && data.avatarImage) mockAvatar.src = data.avatarImage;
    if (mockBadge) mockBadge.style.display = data.showVerifiedBadge ? 'block' : 'none';
    if (mockBadgeSvg && data.verifiedBadgeColor) mockBadgeSvg.setAttribute('fill', data.verifiedBadgeColor);

    if (mockBubbleLabel) mockBubbleLabel.textContent = data.prefilledLabel || 'Prefilled Message';
    if (mockBubbleText) mockBubbleText.textContent = data.prefilledMessage || 'I want ID';
    if (mockSliderText) {
      mockSliderText.textContent = data.sliderLabel || 'Start WhatsApp Chat ›';
      if (data.darkGreenColor) mockSliderText.style.color = data.darkGreenColor;
    }

    if (mockScreen && data.pageBgColor) mockScreen.style.backgroundColor = data.pageBgColor;
    if (mockCard && data.cardBgColor) mockCard.style.backgroundColor = data.cardBgColor;
    if (mockSliderThumb && data.primaryColor) mockSliderThumb.style.backgroundColor = data.primaryColor;
  }

  // Live input change listeners
  const allInputs = document.querySelectorAll('.form-control, input[type="checkbox"], input[type="color"], input[type="range"]');
  allInputs.forEach(input => {
    input.addEventListener('input', () => {
      if (input.id === 'cfgAutoRedirectDelay') {
        const delayDisplay = document.getElementById('delayDisplay');
        if (delayDisplay) delayDisplay.textContent = `${input.value}s`;
      }
      updateLiveMockup();
    });
  });

  // Avatar File Upload Handling
  const avatarFileInput = document.getElementById('avatarFileInput');
  const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
  if (uploadAvatarBtn && avatarFileInput) {
    uploadAvatarBtn.addEventListener('click', () => avatarFileInput.click());
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          showToast('Image size is larger than 2MB. Please select a smaller image.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
          const dataUrl = evt.target.result;
          setVal('cfgAvatarImage', dataUrl);
          const avatarPreview = document.getElementById('avatarImgPreview');
          if (avatarPreview) avatarPreview.src = dataUrl;
          updateLiveMockup();
          showToast('Avatar image loaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Custom Logo File Upload
  const logoFileInput = document.getElementById('logoFileInput');
  const uploadLogoBtn = document.getElementById('uploadLogoBtn');
  if (uploadLogoBtn && logoFileInput) {
    uploadLogoBtn.addEventListener('click', () => logoFileInput.click());
    logoFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          setVal('cfgCustomHeaderLogo', evt.target.result);
          setVal('cfgHeaderLogoType', 'custom');
          showToast('Custom Logo uploaded!', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // WhatsApp Link Generator Tool
  const generateWaLinkBtn = document.getElementById('generateWaLinkBtn');
  if (generateWaLinkBtn) {
    generateWaLinkBtn.addEventListener('click', () => {
      const phoneInput = prompt('Enter Phone number with country code (e.g. 919876543210):');
      if (phoneInput) {
        const cleaned = phoneInput.replace(/[^0-9]/g, '');
        const msg = getVal('cfgPrefilledMessage') || 'Hi';
        const generated = `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
        setVal('cfgTargetUrl', generated);
        updateLiveMockup();
        showToast(`Target link set to ${generated}`, 'success');
      }
    });
  }

  // Save All Settings
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', () => {
      const newConfig = gatherFormData();
      const success = SiteConfig.saveConfig(newConfig);
      if (success) {
        showToast('All changes saved successfully! Live site updated.', 'success');
        // Update stats card target URL
        const statTargetUrl = document.getElementById('statTargetUrl');
        if (statTargetUrl) statTargetUrl.textContent = newConfig.targetUrl || 'Not set';
      } else {
        showToast('Failed to save settings. Please check console.', 'error');
      }
    });
  }

  // Reset to Default
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all landing page settings to factory defaults?')) {
        SiteConfig.resetToDefault();
        loadFormData();
        showToast('Settings restored to factory defaults!', 'success');
      }
    });
  }

  // Reset Stats
  const resetStatsBtn = document.getElementById('resetStatsBtn');
  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      if (confirm('Reset visit and click statistics to zero?')) {
        SiteConfig.resetStats();
        loadFormData();
        showToast('Statistics reset to 0.', 'success');
      }
    });
  }

  // Export Backup JSON
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const config = SiteConfig.getConfig();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `wz_site_settings_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Configuration exported as JSON file.', 'success');
    });
  }

  // Import Backup JSON
  const importJsonInput = document.getElementById('importJsonInput');
  const importJsonBtn = document.getElementById('importJsonBtn');
  if (importJsonBtn && importJsonInput) {
    importJsonBtn.addEventListener('click', () => importJsonInput.click());
    importJsonInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const parsed = JSON.parse(evt.target.result);
            SiteConfig.saveConfig(parsed);
            loadFormData();
            showToast('Configuration imported successfully!', 'success');
          } catch (err) {
            showToast('Invalid JSON file.', 'error');
          }
        };
        reader.readAsText(file);
      }
    });
  }

  // Change Admin Credentials
  const changeAuthForm = document.getElementById('changeAuthForm');
  if (changeAuthForm) {
    changeAuthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newEmail = document.getElementById('cfgAdminEmail').value.trim();
      const currentPass = document.getElementById('cfgCurrentPass').value;
      const newPass = document.getElementById('cfgNewPass').value;

      if (!SiteConfig.verifyLogin(SiteConfig.getAuth().email, currentPass)) {
        showToast('Current password incorrect!', 'error');
        return;
      }

      if (newPass.length < 4) {
        showToast('New password must be at least 4 characters.', 'error');
        return;
      }

      SiteConfig.saveAuth({ email: newEmail, password: newPass });
      document.getElementById('cfgCurrentPass').value = '';
      document.getElementById('cfgNewPass').value = '';
      showToast('Admin email & password updated successfully!', 'success');
    });
  }

  // Toast Notification System
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconSvg = type === 'success' ? 
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` :
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.9)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Initialize
  checkAuth();
  loadFormData();
});
