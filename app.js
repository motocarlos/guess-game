let currentUser = null;
let currentGroup = null;

// LOGIN
function register() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");
  const username = prompt("Username:");

  auth.createUserWithEmailAndPassword(email, pass)
    .then(res => {
      currentUser = res.user;

      db.collection("users").doc(currentUser.uid).set({
        username,
        group: null,
        points: 0
      });
    });
}

function login() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.signInWithEmailAndPassword(email, pass)
    .then(res => {
      currentUser = res.user;
      loadUser();
    });
}

async function loadUser() {
  const doc = await db.collection("users").doc(currentUser.uid).get();
  currentGroup = doc.data().group;
  render();
}

// GRUPPE
function joinGroup() {
  const code = prompt("Gruppen-Code:");
  currentGroup = code;

  db.collection("users").doc(currentUser.uid).update({
    group: code
  });

  render();
}

// EVENT ERSTELLEN
function createEvent() {
  const title = document.getElementById("title").value;

  db.collection("events").add({
    title,
    creator: currentUser.uid,
    group: currentGroup,
    closed: false,
    createdAt: Date.now()
  });
}

// TIPP (1x erlaubt)
async function guess(eventId) {
  const value = parseInt(prompt("Minuten:"));

  const ref = db.collection("events")
    .doc(eventId)
    .collection("guesses")
    .doc(currentUser.uid);

  const doc = await ref.get();

  if (doc.exists) {
    alert("Schon getippt!");
    return;
  }

  await ref.set({ value });
}

// EVENT BEENDEN
async function closeEvent(eventId) {
  const real = parseInt(prompt("Echter Wert:"));

  const guesses = await db.collection("events")
    .doc(eventId)
    .collection("guesses")
    .get();

  let best = null;
  let bestDiff = 999;

  guesses.forEach(doc => {
    const diff = Math.abs(doc.data().value - real);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = doc.id;
    }
  });

  const points = Math.max(10 - bestDiff, 0);

  if (best) {
    db.collection("users").doc(best).update({
      points: firebase.firestore.FieldValue.increment(points)
    });
  }

  await db.collection("events").doc(eventId).update({
    closed: true,
    result: real
  });
}

// RENDER
function render() {
  const content = document.getElementById("content");

  content.innerHTML = "<h2>Events</h2>";

  db.collection("events")
    .where("group", "==", currentGroup)
    .onSnapshot(snapshot => {
      content.innerHTML = "";

      snapshot.forEach(doc => {
        const e = doc.data();

        let div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `<b>${e.title}</b><br>`;

        if (!e.closed) {
          let btn = document.createElement("button");
          btn.innerText = "Tippen";
          btn.onclick = () => guess(doc.id);
          div.appendChild(btn);

          if (e.creator === currentUser.uid) {
            let closeBtn = document.createElement("button");
            closeBtn.innerText = "Beenden";
            closeBtn.onclick = () => closeEvent(doc.id);
            div.appendChild(closeBtn);
          }
        }

        content.appendChild(div);
      });
    });

  loadLeaderboard();
}

// LEADERBOARD
function loadLeaderboard() {
  const lb = document.getElementById("leaderboard");

  db.collection("users")
    .where("group", "==", currentGroup)
    .onSnapshot(snapshot => {
      lb.innerHTML = "";

      let arr = [];

      snapshot.forEach(doc => {
        arr.push(doc.data());
      });

      arr.sort((a,b) => b.points - a.points);

      arr.forEach(u => {
        lb.innerHTML += `${u.username}: ${u.points}<br>`;
      });
    });
}
