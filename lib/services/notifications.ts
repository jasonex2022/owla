/**
 * Browser push notifications - completely anonymous
 * No server storage, all client-side
 */

export interface NotificationPreferences {
  enabled: boolean;
  crewUpdates: boolean;
  dangerAlerts: boolean;
  subscription?: PushSubscription;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Subscribe to push notifications
 * Stores subscription in localStorage only - no server storage
 */
export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Get subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // This is a fake VAPID key - in production you'd generate real ones
      // But since we're not storing subscriptions server-side, it doesn't matter
      applicationServerKey: urlBase64ToUint8Array(
        'BNQVrJHqKR_gEzlFKRtcv5HXgJ1pqueFxbvJqRDLUXvU_9WGg-LTUyqJ8ujAqPjmWKLRm0scPzGELhEFGVzpxYo'
      )
    });

    // Store in localStorage only
    const prefs: NotificationPreferences = {
      enabled: true,
      crewUpdates: true,
      dangerAlerts: true,
      subscription: subscription.toJSON() as any
    };
    
    localStorage.setItem('overwhelm-notifications', JSON.stringify(prefs));
    
    return true;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
    
    localStorage.removeItem('overwhelm-notifications');
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Get notification preferences from localStorage
 */
export function getNotificationPreferences(): NotificationPreferences | null {
  const stored = localStorage.getItem('overwhelm-notifications');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Show local notification (no server involved)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  options?: NotificationOptions
) {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  
  await registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'overwhelm-notification',
    renotify: true,
    ...options
  } as NotificationOptions);
}

/**
 * Check for crew updates and show notification if needed
 * This runs client-side only
 */
export async function checkForCrewUpdates(
  currentZoneId: string,
  newZoneId: string
) {
  const prefs = getNotificationPreferences();
  if (!prefs?.enabled || !prefs.crewUpdates) return;
  
  if (currentZoneId !== newZoneId) {
    await showLocalNotification(
      '📍 TIME TO MOVE',
      `Your crew is moving to a new zone. Check the app for details.`,
      {
        requireInteraction: true
      }
    );
  }
}

/**
 * Check for danger alerts and notify
 */
export async function checkForDangerAlerts(
  policeActivity: Array<{ zone_id: string; severity: string }>
) {
  const prefs = getNotificationPreferences();
  if (!prefs?.enabled || !prefs.dangerAlerts) return;
  
  const criticalAlerts = policeActivity.filter(a => a.severity === 'critical');
  
  if (criticalAlerts.length > 0) {
    await showLocalNotification(
      '⚠️ DANGER ALERT',
      `Heavy police activity reported. Check app for safe zones.`,
      {
        requireInteraction: true
      }
    );
  }
}

/**
 * Helper to convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}