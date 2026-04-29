let user = null;
let userData = null;
let currentTab = "events";

// AUTH STATE
auth.onAuthStateChanged(async (u) => {
  user = u;

  if (!user) {
    document.getElementById("welcome").innerText = "Nicht eingeloggt";
    render();
    return;
  }

  const ref = db.collection("users").doc(user.uid);
  let doc = await ref.get();

  if (!doc.exists) {
    const username = prompt("Username:");
    await ref.set({
      username,
      group: null,
      points: 0,
      wins: 0,
      games: 0,
      streak: 0
    });
    doc = await ref.get();
  }

  userData = doc.data();

  document.getElementById("welcome").innerText =
    `Willkommen beim Guess Game, ${userData.username}!`;

  render();
});

// LOGIN / REGISTER
function login() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.signInWithEmailAndPassword(email, pass)
    .catch(e => alert(e.message));
}

function register() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.createUserWithEmailAndPassword(email, pass)
    .catch(e => alert(e.message));
}

// ----------------
// GROUPS
// ----------------

async function createGroup() {
  const name = prompt("Gruppenname:");
  if (!name) return;

  const code = Math.random().toString(36).substring(2,8);

  await db.collection("groups").doc(code).set({
    name,
    creator: user.uid
  });

  await db.collection("users").doc(user.uid).update({
    group: code,
    isAdmin: true
  });

  userData.group = code;
  userData.isAdmin = true;

  alert("Gruppe erstellt!\nCode: " + code);
  render();
}

async function joinGroup() {
  const code = prompt("Code:");
  if (!code) return;

  const group = await db.collection("groups").doc(code).get();

  if (!group.exists) {
    alert("Gruppe existiert nicht");
    return;
  }

  await db.collection("users").doc(user.uid).update({
    group: code,
    isAdmin: false
  });

  userData.group = code;
  userData.isAdmin = false;

  render();
}

// ----------------
// EVENTS
// ----------------

async function createEvent() {
  const title = document.getElementById("title").value;

  if (!userData.group) {
    alert("Erst Gruppe beitreten!");
    return;
  }

  if (!title) {
    alert("Titel fehlt");
    return;
  }

  await db.collection("events").add({
    title,
    group: userData.group,
    creator: user.uid,
    closed: false,
    createdAt: Date.now()
  });

  document.getElementById("title").value = "";
}

// GUESS
async function guess(eventId) {
  const val = parseInt(prompt("Minuten:"));

  if (isNaN(val)) return;

  const ref = db.collection("events")
    .doc(eventId)
    .collection("guesses")
    .doc(user.uid);

  const doc = await ref.get();

  if (doc.exists) {
    alert("Du hast schon getippt!");
    return;
  }

  await ref.set({ value: val });
}

// CLOSE EVENT
async function closeEvent(eventId) {
  if (!userData.isAdmin) {
    alert("Nur Admin!");
    return;
  }

  const real = parseInt(prompt("Echter Wert:"));
  if (isNaN(real)) return;

  const snap = await db.collection("events")
    .doc(eventId)
    .collection("guesses")
    .get();

  let results = [];

  snap.forEach(doc => {
    results.push({
      uid: doc.id,
      diff: Math.abs(doc.data().value - real)
    });
  });

  results.sort((a,b) => a.diff - b.diff);

  const rewards = [10,6,3];

  for (let i=0; i<results.length && i<3; i++) {
    const r = results[i];
    await db.collection("users").doc(r.uid).update({
      points: firebase.firestore.FieldValue.increment(rewards[i])
    });
  }
// 🧠 Stats aktualisieren

// Gewinner
if (results.length > 0) {
  const winner = results[0];

  await db.collection("users").doc(winner.uid).update({
    wins: firebase.firestore.FieldValue.increment(1),
    games: firebase.firestore.FieldValue.increment(1),
    streak: firebase.firestore.FieldValue.increment(1)
  });
}

// Verlierer
for (let i = 1; i < results.length; i++) {
  await db.collection("users").doc(results[i].uid).update({
    games: firebase.firestore.FieldValue.increment(1),
    streak: 0
  });
}
  
  await db.collection("events").doc(eventId).update({
    closed: true,
    result: real
  });
}

// ----------------
// NAVIGATION
// ----------------

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".tabbar button")
    .forEach(b => b.classList.remove("active"));

  event.target.classList.add("active");

  render();
}

// ----------------
// RENDER
// ----------------

function render() {
  const el = document.getElementById("content");

  // 🔐 WICHTIG: Login check
  if (!user) {
    el.innerHTML = `
      <button onclick="login()">Login</button>
      <button onclick="register()">Register</button>
    `;
    return;
  }

  if (currentTab === "events") renderEvents(el);
  if (currentTab === "create") renderCreate(el);
  if (currentTab === "leaderboard") renderLeaderboard(el);
  if (currentTab === "groups") renderGroups(el);
}

// EVENTS VIEW
function renderEvents(el) {
  el.innerHTML = "<h2>Aktuelle Wetten</h2>";

  if (!userData.group) {
    el.innerHTML += "Keine Gruppe";
    return;
  }

  db.collection("events")
    .where("group","==",userData.group)
    .onSnapshot(snap => {
      el.innerHTML = "<h2>Aktuelle Wetten</h2>";

      snap.forEach(doc => {
        const e = doc.data();

        let div = document.createElement("div");
        div.className = "card fade";

        div.innerHTML = `<b>${e.title}</b><br>`;

        if (!e.closed) {
          div.innerHTML += `<button onclick="guess('${doc.id}')">Tippen</button>`;

          if (userData.isAdmin) {
            div.innerHTML += `<button onclick="closeEvent('${doc.id}')">Beenden</button>`;
          }
        } else {
          div.innerHTML += `Ergebnis: ${e.result}`;
        }

        el.appendChild(div);
      });
    });
}

// CREATE
function renderCreate(el) {
  el.innerHTML = `
    <h2>Neue Wette</h2>
    <input id="title" placeholder="Event">
    <button onclick="createEvent()">Erstellen</button>
  `;
}

// LEADERBOARD
function renderLeaderboard(el) {
  el.innerHTML = "<h2>Leaderboard</h2>";

  db.collection("users")
    .where("group","==",userData.group)
    .onSnapshot(snap => {

      let arr = [];
      snap.forEach(doc => arr.push(doc.data()));

      arr.sort((a,b)=>b.points-a.points);

      el.innerHTML = "<h2>Leaderboard</h2>";

      arr.forEach(u => {

        let accuracy = u.games > 0
          ? Math.round((u.wins / u.games) * 100)
          : 0;

        el.innerHTML += `
          <div class="card">
            <b>${u.username}</b><br>
            Punkte: ${u.points}<br>
            Trefferquote: ${accuracy}%<br>
            Streak: ${u.streak}
          </div>
        `;
      });
    });
}

// GROUPS
function renderGroups(el) {
  el.innerHTML = `
    <h2>Gruppen</h2>

    <div class="card">
      <b>Aktuelle Gruppe:</b><br>
      ${userData.group || "Keine"}
    </div>

    <div class="card">
      <button onclick="createGroup()">Neue Gruppe erstellen</button>
      <button onclick="joinGroup()">Gruppe beitreten</button>
    </div>
  `;
}
