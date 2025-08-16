/**
 * A custom event type for the 'beforeinstallprompt' event.
 * Standard TypeScript libs don't always include this, so we define it ourselves.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Manages the PWA installation prompt lifecycle.
 * This class encapsulates the state and logic for capturing, showing,
 * and handling the app installation prompt.
 */
class InstallManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private listeners: Set<(canInstall: boolean) => void> = new Set();
  private isInitialized = false;

  /**
   * Initializes the event listeners. Should be called only once.
   */
  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener(
      'beforeinstallprompt',
      this.handleBeforeInstallPrompt
    );
    window.addEventListener('appinstalled', this.handleAppInstalled);
  }

  /**
   * Checks if an installation prompt is available.
   * @returns True if the app can be installed.
   */
  public canInstall = (): boolean => {
    return !!this.deferredPrompt;
  };

  /**
   * Shows the installation prompt to the user.
   * @returns A boolean indicating whether the user accepted the prompt.
   */
  public promptInstall = async (): Promise<boolean> => {
    if (!this.deferredPrompt) {
      console.warn('Installation prompt requested but not available.');
      return false;
    }
    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.reset();
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error during installation prompt:', error);
      this.reset();
      return false;
    }
  };

  /**
   * Subscribes to changes in the installation availability state.
   * @param callback The function to call when the state changes.
   * @returns An unsubscribe function.
   */
  public onCanInstallChange = (callback: (canInstall: boolean) => void): (() => void) => {
    this.listeners.add(callback);
    // Immediately notify the new listener with the current state.
    callback(this.canInstall());
    
    return () => {
      this.listeners.delete(callback);
    };
  };

  /**
   * Handles the 'beforeinstallprompt' event by capturing the prompt.
   */
  private handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    this.deferredPrompt = e as BeforeInstallPromptEvent;
    this.notifyListeners();
  };

  /**
   * Handles the 'appinstalled' event by clearing the prompt.
   */
  private handleAppInstalled = () => {
    this.reset();
  };

  /**
   * Notifies all subscribed listeners of the current installation state.
   */
  private notifyListeners = () => {
    const canInstall = this.canInstall();
    this.listeners.forEach(listener => listener(canInstall));
  };

  /**
   * Resets the state and notifies listeners.
   */
  private reset = () => {
    if (this.deferredPrompt) {
      this.deferredPrompt = null;
      this.notifyListeners();
    }
  };
}

// Create a singleton instance to be used throughout the app.
const installService = new InstallManager();

// Export public methods for easy access.
export const initInstallCapture = installService.init.bind(installService);
export const canInstall = installService.canInstall.bind(installService);
export const promptInstall = installService.promptInstall.bind(installService);
export const onCanInstallChange = installService.onCanInstallChange.bind(installService);
