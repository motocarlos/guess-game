const firebaseConfig = {
  apiKey: "DEIN_API_KEY",
  authDomain: "guess-game.firebaseapp.com",
  projectId: "guess-game-f2e58",
  storageBucket: "guess-game.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const messaging = firebase.messaging();
