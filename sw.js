const CACHE_NAME = 'hanyu-v1.11';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Notification scheduling
let notifSettings = {};
let dailyTimer = null;
let streakTimer = null;

self.addEventListener('message', e => {
  if (e.data.type === 'SCHEDULE_NOTIFS') {
    notifSettings = e.data.settings;
    scheduleAll();
  }
});

function scheduleAll() {
  clearTimeout(dailyTimer);
  clearTimeout(streakTimer);

  const now = new Date();
  const [h, m] = (notifSettings.time || '19:00').split(':').map(Number);

  // Daily reminder
  if (notifSettings.daily) {
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const ms = target - now;
    dailyTimer = setTimeout(() => {
      showNotif('漢語 · Study reminder', 'Time for your daily Chinese practice.');
      scheduleAll(); // reschedule for tomorrow
    }, ms);
  }

  // Streak alert (2h before midnight)
  if (notifSettings.streak) {
    const midnight = new Date(now);
    midnight.setHours(22, 0, 0, 0);
    if (midnight > now) {
      const ms = midnight - now;
      streakTimer = setTimeout(() => {
        showNotif('漢語 · Streak at risk', 'Complete a session before midnight to keep your streak.');
      }, ms);
    }
  }

  // SRS due alert
  if (notifSettings.srs && (notifSettings.dueCount || 0) >= 10) {
    showNotif('漢語 · Items due for review', `${notifSettings.dueCount} items are ready for review.`);
  }
}

function showNotif(title, body) {
  if (Notification.permission === 'granted') {
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'hanyu-reminder',
      renotify: true,
      data: { url: '/' }
    });
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cls => {
      if (cls.length > 0) cls[0].focus();
      else clients.openWindow('/');
    })
  );
});
