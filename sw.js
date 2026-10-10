self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Abaikan permintaan yang menuju ke API Google Gemini agar tidak terganggu cache
  if (e.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(async () => {
      const cachedResponse = await caches.match(e.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      // Mengembalikan Response kosong agar browser tidak melempar TypeError
      return new Response('Network error occurred', {
        status: 488,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});