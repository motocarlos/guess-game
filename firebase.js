const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
