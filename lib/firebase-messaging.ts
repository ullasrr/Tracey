"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

// Register service worker for FCM
async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      return registration;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      throw error;
    }
  }
  throw new Error("Service Worker not supported");
}

// registering FCM token for the logged-in user
export async function registerFcmToken() {
  try {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      throw new Error("Notifications not supported in this browser");
    }

    // Register service worker first
    await registerServiceWorker();

    // Request permission - this will show the browser prompt
    let permission = Notification.permission;
    
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }

    // Check if user is authenticated
    if (!auth.currentUser) {
      throw new Error("No authenticated user found");
    }

    const messaging = getMessaging(app);

    const fcmToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (!fcmToken) {
      throw new Error("Failed to get FCM token");
    }

    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch("/api/save-fcm-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fcmToken }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save FCM token: ${response.status}`);
    }
  } catch (error) {
    console.error("Error registering FCM token:", error);
    throw error;
  }
}
