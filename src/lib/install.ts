let deferredPrompt: any = null;
let listeners: Array<(b: boolean) => void> = [];
let inited = false;

export function initInstallCapture() {
  if (inited) return;
  inited = true;
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach(fn => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach(fn => fn(false));
  });
}

export function canInstall() { return !!deferredPrompt; }

export async function promptInstall() {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach(fn => fn(false));
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

export function onCanInstallChange(cb: (b: boolean) => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(x => x !== cb); };
}
