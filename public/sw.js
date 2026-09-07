self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'Moje apartmány', {
    body: data.body || 'Máte nový plán úklidu.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'cleaning-plan',
    data: { url: data.url || './' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const openWindow = windows.find((windowClient) => 'focus' in windowClient)
    return openWindow ? openWindow.focus() : clients.openWindow(event.notification.data.url)
  }))
})
