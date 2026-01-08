// Tracey FCM Service Worker v4 - handles notification + data payloads
// IMPORTANT: Update version when making changes to force browser to re-fetch
const SW_VERSION = "4.0.0";

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBzxukT_Lgm7GiJhzibwe0MOcop-yHz7-8",
  authDomain: "tracey-4e989.firebaseapp.com",
  projectId: "tracey-4e989",
  storageBucket: "tracey-4e989.firebasestorage.app",
  messagingSenderId: "753030575212",
  appId: "1:753030575212:web:9a6317ac862a761562d449",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // If notification payload exists, FCM already shows the notification
  // We only need to handle data-only messages (fallback for web)
  if (payload.notification) {
    // FCM will auto-display this, skip manual notification
    // But we can still log it for debugging
    console.log("[SW] FCM auto-displayed notification:", payload.notification.title);
    return;
  }

  // Handle data-only messages (legacy/fallback)
  const title = payload.data?.title || "Tracey";
  const body = payload.data?.body || "We found an item that may belong to you.";
  
  const matchId = payload.data?.matchId;
  const notificationType = payload.data?.type || "general";
  const timestamp = payload.data?.timestamp || Date.now().toString();
  
  const notificationUrl = matchId 
    ? `${self.location.origin}/matches/${matchId}`
    : `${self.location.origin}/matches`;

  // Create a unique tag for each notification to prevent collapsing/caching issues
  // Each matchId gets its own notification, general notifications use timestamp
  const notificationTag = matchId 
    ? `tracey-match-${matchId}` 
    : `tracey-${notificationType}-${timestamp}`;

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: notificationTag, // Unique tag prevents notification collapsing
    renotify: true, // Show notification even if same tag exists (updates it)
    data: {
      url: notificationUrl,
      matchId: matchId,
      type: notificationType,
      timestamp: timestamp,
    },
    requireInteraction: true, // Keep notification visible until user interacts
    actions: [
      { action: "view", title: "View Match" },
      { action: "close", title: "Dismiss" }
    ]
  });
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  const notificationData = event.notification.data || {};
  const matchId = notificationData.matchId;

  event.notification.close();

  // Only open if user clicked "view" or the notification body (not dismiss)
  if (event.action === "close") {
    return;
  }

  // Build URL from notification data - prefer matchId over stored url to avoid stale data
  const urlToOpen = matchId 
    ? `${self.location.origin}/matches/${matchId}`
    : (notificationData.url || `${self.location.origin}/matches`);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          // Navigate to the match and focus
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // If app not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
