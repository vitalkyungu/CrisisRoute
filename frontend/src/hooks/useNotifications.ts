import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, requestNotificationPermission } from "../lib/firebase";

export function useNotifications() {
  const saveFcmToken = useCallback(async (uid?: string) => {
    const userId = uid || auth.currentUser?.uid;
    if (!userId) return null;

    try {
      const token = await requestNotificationPermission();
      if (token) {
        await updateDoc(doc(db, "volunteers", userId), { fcm_token: token });
      }
      return token;
    } catch (e) {
      console.warn("Failed to save FCM token:", e);
      return null;
    }
  }, []);

  return { saveFcmToken };
}
