// PWA Installation Handler
let deferredPrompt;
let installButton;

// Initialize PWA features
function initPWA() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    });
  }

  // Handle install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('💾 Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });

  // Handle successful installation
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    hideInstallPromotion();
    deferredPrompt = null;
    
    // Show success message
    if (typeof showToast === 'function') {
      showToast('ติดตั้งแอปสำเร็จ! 🎉', 'success');
    }
  });

  // Create install button in header (if not exists)
  createInstallButton();
}

// Create install button
function createInstallButton() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Check if button already exists
  if (document.getElementById('pwa-install-btn')) return;

  installButton = document.createElement('button');
  installButton.id = 'pwa-install-btn';
  installButton.className = 'btn btn-primary btn-sm';
  installButton.innerHTML = '📱 ติดตั้งแอป';
  installButton.style.display = 'none';
  installButton.onclick = installPWA;

  headerRight.insertBefore(installButton, headerRight.firstChild);
}

// Show install promotion
function showInstallPromotion() {
  if (installButton) {
    installButton.style.display = 'inline-flex';
  }

  // Show install banner (optional)
  showInstallBanner();
}

// Hide install promotion
function hideInstallPromotion() {
  if (installButton) {
    installButton.style.display = 'none';
  }
  hideInstallBanner();
}

// Install PWA
async function installPWA() {
  if (!deferredPrompt) {
    console.log('Install prompt not available');
    return;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user's response
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User response: ${outcome}`);

  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  } else {
    console.log('User dismissed the install prompt');
  }

  // Clear the deferred prompt
  deferredPrompt = null;
  hideInstallPromotion();
}

// Show install banner
function showInstallBanner() {
  // Check if banner was dismissed recently
  const dismissed = localStorage.getItem('pwa-banner-dismissed');
  if (dismissed) {
    const dismissedTime = parseInt(dismissed);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) {
      return; // Don't show banner if dismissed within last 7 days
    }
  }

  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return; // Already installed
  }

  // Create banner
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-banner-content">
      <div class="pwa-banner-icon">📱</div>
      <div class="pwa-banner-text">
        <div class="pwa-banner-title">ติดตั้งแอปบนหน้าจอหลัก</div>
        <div class="pwa-banner-desc">เข้าถึงได้เร็วขึ้น ใช้งานได้แม้ไม่มีเน็ต</div>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-banner-btn pwa-install" onclick="installPWA()">ติดตั้ง</button>
        <button class="pwa-banner-btn pwa-dismiss" onclick="dismissInstallBanner()">ไว้ทีหลัง</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .pwa-install-banner {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,.2);
      padding: 16px 20px;
      max-width: 500px;
      width: calc(100% - 40px);
      z-index: 1000;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    .pwa-banner-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pwa-banner-icon {
      font-size: 32px;
      flex-shrink: 0;
    }
    .pwa-banner-text {
      flex: 1;
      min-width: 0;
    }
    .pwa-banner-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--gray-800);
      margin-bottom: 2px;
    }
    .pwa-banner-desc {
      font-size: 12px;
      color: var(--gray-500);
    }
    .pwa-banner-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .pwa-banner-btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .pwa-banner-btn.pwa-install {
      background: var(--primary);
      color: white;
    }
    .pwa-banner-btn.pwa-install:hover {
      background: var(--primary-dark);
    }
    .pwa-banner-btn.pwa-dismiss {
      background: var(--gray-100);
      color: var(--gray-600);
    }
    .pwa-banner-btn.pwa-dismiss:hover {
      background: var(--gray-200);
    }
    @media (max-width: 480px) {
      .pwa-install-banner {
        bottom: 10px;
        width: calc(100% - 20px);
      }
      .pwa-banner-content {
        flex-wrap: wrap;
      }
      .pwa-banner-actions {
        width: 100%;
        margin-top: 8px;
      }
      .pwa-banner-btn {
        flex: 1;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(banner);
}

// Dismiss install banner
function dismissInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  }
  localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
}

// Hide install banner
function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.remove();
  }
}

// Check if running as PWA
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Show PWA status in console
function logPWAStatus() {
  if (isPWA()) {
    console.log('🎉 Running as PWA (standalone mode)');
  } else {
    console.log('🌐 Running in browser');
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initPWA();
    logPWAStatus();
  });
} else {
  initPWA();
  logPWAStatus();
}

// Export functions for global use
window.installPWA = installPWA;
window.dismissInstallBanner = dismissInstallBanner;
window.isPWA = isPWA;
