/**
 * Lightweight SW bootstrap + version-aware update nudges.
 * - Registers VitePWA service worker (registerType: 'autoUpdate')
 * - Busts cache via BUILD_VERSION (optional)
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // Optional build version; can be set via <script>window.BUILD_VERSION="v123"</script>
  var buildVersion = (window.BUILD_VERSION || '').toString();

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      // Listen for waiting worker and auto-swap to reduce "stuck old version"
      function tryActivate(registration) {
        if (registration.waiting) {
          // send skipWaiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      if (reg.waiting) tryActivate(reg);
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed') {
            tryActivate(reg);
            // Dispatch a custom event for UI to react (e.g., toast)
            window.dispatchEvent(new CustomEvent('pwa:update-ready', { detail: { buildVersion: buildVersion } }));
          }
        });
      });

      // Periodic checks
      setInterval(function () {
        reg.update().catch(function (){});
      }, 60 * 1000);

      // Claim immediately when controller changes
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        // Force refresh once to get the new SW-managed resources
        if (!window.__pwa_refreshed__) {
          window.__pwa_refreshed__ = true;
          window.location.reload();
        }
      });
    }).catch(function (err) {
      console.warn('[PWA] SW register failed:', err);
    });
  });
})();
