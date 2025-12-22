 const firebaseConfig = {

  apiKey: "AIzaSyA-qQYAR9RMmrPESYkXHcMw1b7OeDwcovk",

  authDomain: "night-vibe-a746b.firebaseapp.com",

  projectId: "night-vibe-a746b",

  storageBucket: "night-vibe-a746b.firebasestorage.app",

  messagingSenderId: "963220391044",

  appId: "1:963220391044:web:d2db0bbb54acb3c4522ed1"

};
// Initialize Firebase if it hasn't been initialized yet
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized from firebase-config.js");
} else {
    console.log("Firebase already initialized");
}

// Make config available globally
window.firebaseConfig = firebaseConfig;