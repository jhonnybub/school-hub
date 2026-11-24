// Service worker for the ט׳3 hub: web push only (+ homework reminder, v2).
// Deliberately NO fetch handler, so data/*.json always comes from the network
// and Daft's daily updates show up right away.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// ---- Homework reminder ("hw-check" push) ----
// The box never sees the homework list. It only sends {type:"hw-check", date,
// subjects:[tomorrow's subjects], fallbackTitle, fallbackBody}. The list lives on
// the phone; the page mirrors it into IndexedDB ("schoolhub"/"kv"/"homework"),
// and we read it here to build the notification. iOS requires every push to
// show a notification, so when nothing is due we show the fallback text.
function hwReadItems() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("schoolhub", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const get = db.transaction("kv", "readonly").objectStore("kv").get("homework");
          get.onsuccess = () => { db.close(); resolve(Array.isArray(get.result) ? get.result : []); };
          get.onerror = () => { db.close(); resolve([]); };
        } catch { db.close(); resolve([]); }
      };
    } catch { resolve([]); }
  });
}
function hwNorm(s) {
  return String(s ?? "").replace(/["׳״']/g, "").replace(/\s+/g, " ").trim();
}
function hwRoot(s) {
  return hwNorm(s).split(" ").filter((w) => w && !/^\d+$/.test(w) && w !== "יח" && w.length > 1).join(" ");
}
function hwSubjectMatch(a, b) {
  const ra = hwRoot(a), rb = hwRoot(b);
  return !!ra && !!rb && (hwNorm(a) === hwNorm(b) || ra === rb);
}
async function hwBuildNotification(payload) {
  const date = String(payload.date || "");
  const subjects = Array.isArray(payload.subjects) ? payload.subjects : [];
  const items = (await hwReadItems()).filter((x) => {
    if (!x || x.done) return false;
    const inDay = subjects.some((s) => hwSubjectMatch(s, x.subject));
    if (x.due) return x.due === date || (x.due < date && inDay);
    return inDay;
  });
  if (items.length) {
    const lines = items.slice(0, 4).map((x) => `☐ ${x.subject}: ${x.short || x.text}`);
    if (items.length > 4) lines.push(`ועוד ${items.length - 4}`);
    return { title: "שיעורי בית למחר", body: lines.join("\n"), tag: "hw-tomorrow", url: "./#homework" };
  }
  return { title: payload.fallbackTitle || "SchoolHub", body: payload.fallbackBody || "אין שיעורי בית פתוחים למחר.", tag: "hw-tomorrow", url: payload.url || "./" };
}
self.hwBuildNotification = hwBuildNotification;

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  if (payload && payload.type === "hw-check") {
    event.waitUntil(hwBuildNotification(payload).then((n) => self.registration.showNotification(n.title, {
      body: n.body,
      icon: new URL("icon-192.png", scope).href,
      badge: new URL("icon-192.png", scope).href,
      lang: "he",
      dir: "rtl",
      tag: n.tag,
      data: { url: new URL(n.url, scope).href },
    })));
    return;
  }
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
