const firebaseConfig = {
  apiKey: "AIzaSyAp36fmoecKjmgmVfewJBdCdoyoRsLm8Pw",
  authDomain: "guess-game-f2e58.firebaseapp.com",
  projectId: "guess-game-f2e58",
  storageBucket: "guess-game-f2e58.firebasestorage.app",
  messagingSenderId: "656174317689",
  appId: "1:656174317689:web:84eab9003149a050eed4a8",
  measurementId: "G-L9GMJGWPS9"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const messaging = firebase.messaging();
