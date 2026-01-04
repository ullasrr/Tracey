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
  const title = payload.notification?.title || "Tracey";
  const body =
    payload.notification?.body || "We found an item that may belong to you.";
  
  const matchId = payload.data?.matchId;
  const notificationUrl = matchId 
    ? `${self.location.origin}/matches/${matchId}`
    : `${self.location.origin}/matches`;

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: notificationUrl,
      matchId: matchId,
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
  event.notification.close();

  const urlToOpen = event.notification.data?.url || `${self.location.origin}/matches`;

  // Only open if user clicked "view" or the notification body (not dismiss)
  if (event.action === "close") {
    return;
  }

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
