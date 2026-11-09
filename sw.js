
const CACHE = "infoauto-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

// Instalarea aplicației
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Curățarea versiunilor vechi
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })
  );
});

// Cache pentru fișierele aplicației
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      return (
        (await caches.match(event.request)) ||
        (event.request.mode === "navigate"
          ? await caches.match("./index.html")
          : Response.error())
      );
    })
  );
});

// Primirea notificărilor push
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "InfoAuto",
      body: "Ai o notificare nouă."
    };
  }

  const options = {
    body: data.body || "Verifică documentele mașinii.",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: data.tag || "infoauto",
    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "InfoAuto",
      options
    )
  );
});

// Deschiderea aplicației la apăsarea notificării
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.openWindow(
      event.notification.data?.url || "./"
    )
  );
});
