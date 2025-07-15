const CACHE_NAME = 'monkiguessr-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css', 
  '/script.js',
  '/manifest.json',
  '/favicon.png',
  '/monki.png',
  '/zdjecie.jpeg',
  'https://fonts.googleapis.com/css2?family=Titan+One&family=Roboto:wght@300;400;500&display=swap',
  'https://maps.googleapis.com/maps/api/js?key=AIzaSyCdkQl6u3sPiV5-yNrB-wXJBRQRP5cVZes'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Instalacja');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache otwarty');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Wszystkie pliki zapisane w cache');
        self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Aktywacja');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Usuwanie starego cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignoruj żądania do WebSocket i zewnętrznych API
  if (event.request.url.includes('socket.io') || 
      event.request.url.includes('/api/') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Zwróć z cache jeśli jest dostępne
        if (response) {
          console.log('Service Worker: Serwuje z cache', event.request.url);
          return response;
        }

        // Pobierz z sieci i zapisz w cache
        return fetch(event.request)
          .then(response => {
            // Sprawdź czy odpowiedź jest prawidłowa
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Offline fallback
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Powiadomienia push (dla przyszłych funkcji)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nowe wyzwanie w MońkiGuessr!',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Otwórz grę',
        icon: '/favicon.png'
      },
      {
        action: 'close',
        title: 'Zamknij'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('MońkiGuessr', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
