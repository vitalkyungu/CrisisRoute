/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js");

let messaging = null;

function initFirebase(config) {
  if (!config || firebase.apps.length) return;
  firebase.initializeApp(config);
  messaging = firebase.messaging();
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    initFirebase(event.data.config);
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.notification?.title || "New Mission Assignment";
  const body = data.notification?.body || "You have a new mission briefing.";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/logo-192.png" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/volunteer"));
});
