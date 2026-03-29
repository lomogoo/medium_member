const CACHE_VERSION = "v3";
const CACHE_NAME = `medium-member-${CACHE_VERSION}`;
const ASSETS = [
  "/medium_member/",
  "/medium_member/index.html",
  "/medium_member/logo.svg",
  "/medium_member/apple-touch-icon.png",
  "/medium_member/manifest.json",
];

// インストール時: 全アセットをキャッシュ & 即時アクティベート
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// アクティベート時: 古いキャッシュを削除 & 即時制御
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ: HTMLはネットワーク優先（最新版を取得）、それ以外はキャッシュ優先
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 同一オリジン以外はスルー
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // ナビゲーション（HTMLページ）: ネットワーク優先 → 失敗時はキャッシュ
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // その他のアセット: キャッシュ優先 → なければネットワーク
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
