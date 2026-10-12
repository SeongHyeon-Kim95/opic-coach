// 오프라인 지원: 온라인이면 항상 최신 파일(network-first), 오프라인이면 마지막으로 받은 파일
const CACHE = 'opic-daily-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/gemini.js', 'js/prompts.js', 'js/audio.js', 'js/tts.js', 'js/srs.js',
  'js/plan.js', 'js/install.js', 'js/feedback-view.js', 'js/data/topics.js', 'js/data/seed-vocab.js',
  'js/screens/home.js', 'js/screens/speak.js', 'js/screens/review.js', 'js/screens/notes.js', 'js/screens/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('googleapis.com')) return; // AI 호출은 캐시하지 않음
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
