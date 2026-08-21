// Service Worker for Commu Background Web Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

const firebaseConfig = {
  apiKey: "AIzaSyAl2wH3Jpt1letxUV_kpf5-WNUL9makFUc",
  authDomain: "commu-app-web.firebaseapp.com",
  projectId: "commu-app-web",
  storageBucket: "commu-app-web.firebasestorage.app",
  messagingSenderId: "647670082656",
  appId: "1:647670082656:web:b9ec3aa51b82f0df01a705",
}

firebase.initializeApp(firebaseConfig)

let messaging
try {
  messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload)

    const notificationTitle = payload.notification?.title || payload.data?.title || 'ข้อความใหม่จาก COMMU'
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'คุณมีข้อความใหม่',
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      data: {
        url: payload.data?.url || '/',
      },
    }

    self.registration.showNotification(notificationTitle, notificationOptions)
  })
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Firebase messaging failed to initialize:', err)
}

// Notification click event: open or focus existing chat window
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(targetUrl))
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
