const CACHE_NAME = 'el-punto-cache-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Estrategia: Network First (Red primero, luego Cache)
    // Esto evita que se sirvan versiones viejas/rotas del index.html o bundles
    event.respondWith(
        fetch(event.request)
            .then((fetchRes) => {
                // Si la red responde, actualizamos el cache y devolvemos la respuesta
                return caches.open(CACHE_NAME).then((cache) => {
                    // Solo cachear recursos de nuestro propio dominio y no de Firebase/Google
                    const url = event.request.url;
                    if (url.startsWith(self.location.origin) &&
                        !url.includes('firestore') &&
                        !url.includes('googleapis')) {
                        cache.put(event.request, fetchRes.clone());
                    }
                    return fetchRes;
                });
            })
            .catch(() => {
                // Si falla la red (offline), buscamos en el cache
                return caches.match(event.request).then((cacheRes) => {
                    if (cacheRes) return cacheRes;

                    // Si es una navegación (página principal), devolver index.html del cache
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

