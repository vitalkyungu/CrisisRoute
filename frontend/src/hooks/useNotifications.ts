import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, getFcmToken, requestNotificationPermission } from "../lib/firebase";

async function persistToken(userId: string, token: string | null) {
  if (!token) return null;
  await updateDoc(doc(db, "volunteers", userId), { fcm_token: token });
  return token;
}

export function useNotifications() {
  /** Safe on page load — only syncs if permission was already granted. */
  const syncFcmTokenIfGranted = useCallback(async (uid?: string) => {
    const userId = uid || auth.currentUser?.uid;
    if (!userId || Notification.permission !== "granted") return null;

    try {
      const token = await getFcmToken();
      return await persistToken(userId, token);
    } catch (e) {
      console.warn("Failed to sync FCM token:", e);
      return null;
    }
  }, []);

  /** Call from a button click or form submit — prompts for permission if needed. */
  const enableNotifications = useCallback(async (uid?: string) => {
    const userId = uid || auth.currentUser?.uid;
    if (!userId) return null;

    try {
      const token = await requestNotificationPermission();
      return await persistToken(userId, token);
    } catch (e) {
      console.warn("Failed to enable notifications:", e);
      return null;
    }
  }, []);

  return { syncFcmTokenIfGranted, enableNotifications };
}
