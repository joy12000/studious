const VERSION = 'sw-v11'; // Version updated to ensure SW update
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

// Listen for fetch events
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If the request is a POST to /capture, handle it
  if (event.request.method === 'POST' && url.pathname === '/capture') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const file = formData.get('file');

      if (file) {
        // Get the client and send the file
        const clients = await self.clients.matchAll({ type: 'window' });
        if (clients.length > 0) {
          // Focus the client and then send the message
          await clients[0].focus();
          clients[0].postMessage({ file });
        }
      }
      
      // Redirect to the root page after handling the share
      return Response.redirect('/', 303);
    })());
  }
});
