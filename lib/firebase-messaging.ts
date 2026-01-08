"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

// Register service worker for FCM
async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      // Setup navigation listener for all service worker messages
      setupServiceWorkerNavigationListener();
      
      // Check if service worker is already registered
      const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      if (existing) {
        return existing;
      }

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/",
      });
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      throw error;
    }
  }
  throw new Error("Service Worker not supported");
}

// Track if listener is already setup to avoid duplicates
let navigationListenerSetup = false;

// Setup listener for service worker navigation messages
export function setupServiceWorkerNavigationListener() {
  if (navigationListenerSetup) return;
  
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NOTIFICATION_CLICK" && event.data?.url) {
        // Navigate to the URL sent from service worker
        window.location.href = event.data.url;
      }
    });
    navigationListenerSetup = true;
  }
}

// registering FCM token for the logged-in user
export async function registerFcmToken() {
  try {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      throw new Error("Notifications not supported in this browser");
    }

    // Register service worker first and wait for it to be ready
    const registration = await registerServiceWorker();
    
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

    // Validate VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error("VAPID key not configured");
    }

    let fcmToken;
    try {
      fcmToken = await getToken(messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch (tokenError: any) {
      // Specific error handling for push service errors
      if (tokenError.code === 'messaging/failed-service-worker-registration' || 
          tokenError.message?.includes('push service error')) {
        throw new Error(
          "Push notifications are not available in this browser. " +
          "This can happen due to browser settings or network restrictions. " +
          "Please try Chrome or Firefox, or check your browser's notification settings."
        );
      }
      
      throw tokenError;
    }

    if (!fcmToken) {
      throw new Error("Failed to get FCM token - empty token returned");
    }

    const idToken = await auth.currentUser.getIdToken();

    // Get device info
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };

    const response = await fetch("/api/fcm/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ 
        userId: auth.currentUser.uid,
        token: fcmToken,
        deviceInfo 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save FCM token: ${response.status} - ${errorText}`);
    }

    return fcmToken;
  } catch (error) {
    throw error;
  }
}
