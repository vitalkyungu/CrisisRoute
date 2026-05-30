import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

let messaging: ReturnType<typeof getMessaging> | null = null;

export function getMessagingInstance() {
  if (!messaging && "serviceWorker" in navigator) {
    messaging = getMessaging(app);
  }
  return messaging;
}

export async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    registration.active?.postMessage({
      type: "FIREBASE_CONFIG",
      config: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      },
    });
    navigator.serviceWorker.ready.then((ready) => {
      ready.active?.postMessage({
        type: "FIREBASE_CONFIG",
        config: {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        },
      });
    });
    return registration;
  } catch (e) {
    console.warn("FCM service worker registration failed:", e);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  const msg = getMessagingInstance();
  if (!msg) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await registerMessagingServiceWorker();

  const token = await getToken(msg, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    ...(registration ? { serviceWorkerRegistration: registration } : {}),
  });
  return token;
}

export function onForegroundMessage(callback: (payload: unknown) => void) {
  const msg = getMessagingInstance();
  if (msg) {
    onMessage(msg, callback);
  }
}
