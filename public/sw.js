const CACHE_NAME = 'el-punto-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

self.addEventListener('install', (event) => {
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
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then((cacheRes) => {
            return (
                cacheRes ||
                fetch(event.request).then((fetchRes) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        if (event.request.url.indexOf('firestore') === -1 && event.request.url.indexOf('googleapis') === -1) {
                            cache.put(event.request.url, fetchRes.clone());
                        }
                        return fetchRes;
                    });
                })
            );
        }).catch(() => {
            if (event.request.url.indexOf('.html') > -1) {
                return caches.match('/index.html');
            }
        })
    );
});
