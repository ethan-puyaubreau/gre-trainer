/** Offline support: the service worker in public/sw.js. Production builds only (it would cache the dev server's modules). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Unsupported or blocked (private mode): the app works online as before.
    });
  });
}
