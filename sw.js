// Service worker for the ט׳3 hub: web push only.
// Deliberately NO fetch handler, so data/*.json always comes from the network
// and Daft's daily updates show up right away.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  const title = payload.title || "ט׳3";
  const options = {
    body: payload.body || "",
    icon: new URL(payload.icon || "icon-192.png", scope).href,
    badge: new URL("icon-192.png", scope).href,
    lang: "he",
    dir: "rtl",
    tag: payload.tag || undefined,
    data: { url: new URL(payload.url || "./", scope).href },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if (client.url.startsWith(self.registration.scope) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== url) {
          try { await client.navigate(url); } catch {}
        }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
