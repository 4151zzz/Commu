import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const STORAGE_SERVER_URL = import.meta.env.VITE_STORAGE_SERVER_URL

/**
 * Register Service Worker for Web Push Notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })
    console.log('[Push] Service Worker registered successfully:', registration.scope)
    return registration
  } catch (err) {
    console.warn('[Push] Service Worker registration failed:', err)
    return null
  }
}

/**
 * Request notification permission from the user (Universal iOS & Android support)
 */
export async function requestNotificationPermission(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Check if Notification API exists
  if (!('Notification' in window)) {
    alert('อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับ Web Notification โดยตรง')
    return false
  }

  try {
    await registerServiceWorker()

    // Handle both Promise-based and Callback-based requestPermission (for iOS Safari & old browsers)
    let permission: NotificationPermission
    try {
      permission = await Notification.requestPermission()
    } catch {
      permission = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((p) => resolve(p))
      })
    }

    if (permission === 'granted') {
      try {
        await updateDoc(doc(db, 'users', userId), {
          notificationsEnabled: true,
          lastNotificationEnabledAt: new Date(),
        })
      } catch (e) {
        console.warn('[Push] Failed to update user profile with notification status:', e)
      }
      return true
    } else if (permission === 'denied') {
      alert('การแจ้งเตือนถูกปิดกั้นอยู่ กรุณาไปที่ การตั้งค่าของเบราว์เซอร์ > การอนุญาตเว็บไซต์ > อนุญาตการแจ้งเตือน')
    }

    return false
  } catch (err) {
    console.error('[Push] Error requesting notification permission:', err)
    return false
  }
}

/**
 * Check if the user currently has notifications permitted
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Show a native local notification (works when tab is in background or minimized)
 */
export function showLocalNotification(title: string, options?: NotificationOptions): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          ...options,
        })
      })
    } else {
      new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        ...options,
      })
    }
  } catch (err) {
    console.warn('[Push] Failed to trigger notification:', err)
  }
}

/**
 * Trigger push notification to a recipient
 */
export async function sendPushNotification(
  recipientId: string,
  title: string,
  body: string,
  url = '/chat'
): Promise<void> {
  if (!STORAGE_SERVER_URL) return

  try {
    const endpoint = `${STORAGE_SERVER_URL.replace(/\/$/, '')}/api/send-push`
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId,
        title,
        body,
        url,
      }),
    })
  } catch (err) {
    // Non-blocking fallback
    console.warn('[Push] Failed to relay push notification through server:', err)
  }
}
