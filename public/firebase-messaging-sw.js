importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAHQ5b4FcXZ_BFAhsb-SJaJqIv9KVegoUU",
  authDomain: "tracey-849f2.firebaseapp.com",
  projectId: "tracey-849f2",
  messagingSenderId: "301674807484",
  appId: "1:301674807484:web:20ed8499840d72855cd0b9",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Tracey";
  const body =
    payload.notification?.body || "We found an item that may belong to you.";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
  });
});
