/* Ilé web push service worker.
 * Registers only when VAPID public key is configured on the backend.
 * Safe no-op for clients that never call registration.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let title = "Ilé"
  let body = "You have a new update"
  let data = {}

  try {
    if (event.data) {
      const payload = event.data.json()
      title = payload.title || title
      body = payload.body || body
      data = payload.data || payload || {}
    }
  } catch (_) {
    try {
      body = event.data ? event.data.text() : body
    } catch (_) {
      // keep defaults
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
      icon: "/logo.png",
      badge: "/logo.png",
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const deepLink =
    (event.notification.data && event.notification.data.deepLink) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(deepLink)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLink)
      }
      return undefined
    })
  )
})
