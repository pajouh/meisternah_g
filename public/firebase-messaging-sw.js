importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// This is the background service worker.
// It must be at the root of your public folder.

firebase.initializeApp({
  apiKey: "AIzaSyAOU31dmhSUtTUsAFh8CF6pL7S3UrS4peQ",
  authDomain: "n8nschmalkalden.firebaseapp.com",
  projectId: "n8nschmalkalden",
  storageBucket: "n8nschmalkalden.firebasestorage.app",
  messagingSenderId: "974938966013",
  appId: "1:974938966013:web:03748c6bfc23ce0e523b94"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png' // Make sure you have an icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
