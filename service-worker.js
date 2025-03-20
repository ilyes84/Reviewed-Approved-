// Service Worker لتحسين الأداء وتمكين العمل دون اتصال
const CACHE_NAME = 'my-links-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  // تنشيط Service Worker الجديد فوراً دون انتظار
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // محاولة تخزين الملفات الأساسية
        return Promise.allSettled(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.log('Non-critical error caching ' + url, err);
            });
          })
        );
      })
  );
});

// استراتيجية التخزين المؤقت
self.addEventListener('fetch', event => {
  // تجاهل طلبات POST وطلبات أخرى غير GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // تجاهل طلبات Firebase وطلبات أخرى غير مهمة للتخزين المؤقت
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('google-analytics') ||
      event.request.url.includes('imgbb') ||
      event.request.url.includes('api.')) {
    return;
  }
  
  event.respondWith(
    // استراتيجية الشبكة أولاً مع التخزين المؤقت كاحتياطي
    fetch(event.request)
      .then(response => {
        // تخزين الاستجابة في ذاكرة التخزين المؤقت إذا كانت ناجحة
        if (response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => {
              console.log('Error caching response', err);
            });
        }
        
        return response;
      })
      .catch(() => {
        // إذا فشل الاتصال بالشبكة، استخدم النسخة المخزنة مؤقتًا
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // إذا كان الطلب لصفحة HTML وفشل، قم بإرجاع صفحة الخطأ
            if (event.request.headers.get('accept') && 
                event.request.headers.get('accept').includes('text/html')) {
              return new Response(
                '<html><body dir="rtl" style="font-family: Arial; text-align: center; padding: 50px; background-color: #f5f5f5;">' +
                '<h1 style="color: #e74c3c;">لا يوجد اتصال بالإنترنت</h1>' +
                '<p>يرجى التحقق من اتصالك والمحاولة مرة أخرى.</p>' +
                '<button style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;" onclick="window.location.reload()">إعادة المحاولة</button>' +
                '</body></html>',
                {
                  headers: { 'Content-Type': 'text/html; charset=UTF-8' }
                }
              );
            }
            
            // إذا لم يكن هناك نسخة مخزنة مؤقتًا، أرجع رسالة خطأ
            return new Response('Network error', { status: 408 });
          });
      })
  );
});

// تنظيف ذاكرة التخزين المؤقت القديمة
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  // تنشيط Service Worker الجديد فوراً
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    })
  );
}); 