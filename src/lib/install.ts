
let deferredPrompt: any = null;
let listeners: Array<(canInstall: boolean) => void> = [];

export function initInstallCapture() {
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

export function canInstall(): boolean {
  return !!deferredPrompt;
}

export async function promptInstall(): Promise<boolean> {
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

export function onCanInstallChange(cb: (can: boolean)=>void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter(x => x !== cb);
  };
}
