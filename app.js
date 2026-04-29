let user = null;
let userData = null;
let currentTab = "events";

// AUTH STATE
auth.onAuthStateChanged(async (u) => {
  user = u;

  if (!user) {
    userData = null;
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
      totalDiff: 0,
      bestDiff: 999999
    });
    doc = await ref.get();
  }

  userData = doc.data();

  document.getElementById("welcome").innerText =
    `Willkommen beim Guess Game, ${userData.username}!`;

  render();
});

// LOGIN
function login() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.signInWithEmailAndPassword(email, pass)
    .catch(e => alert(e.message));
}

// REGISTER
function register() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.createUserWithEmailAndPassword(email, pass)
    .catch(e => alert(e.message));
}

// GROUPS
async function createGroup() {
  const name = prompt("Gruppenname:");
  if (!name) return;

  const code = Math.random().toString(36).substring(2,8);

  await db.collection("groups").doc(code).set({
    name,
    creator: user.uid
  });

  await db.collection("users").doc(user.uid).update({
    group: code
  });

  userData.group = code;

  alert("Code: " + code);
  render();
}

async function joinGroup() {
  const code = prompt("Code:");
  const g = await db.collection("groups").doc(code).get();

  if (!g.exists) {
    alert("Ungültiger Code");
    return;
  }

  await db.collection("users").doc(user.uid).update({
    group: code
  });

  userData.group = code;
  alert("Beigetreten!");
  render();
}

// EVENTS
async function createEvent() {
  const title = document.getElementById("title").value;

  if (!userData.group) {
    alert("Erst Gruppe beitreten!");
    return;
  }

  if (!title) return;

  await db.collection("events").add({
    title,
    group: userData.group,
    creator: user.uid,
    closed: false,
    createdAt: Date.now()
  });

  document.getElementById("title").value = "";
}

async function guess(eventId) {
  const val = parseInt(prompt("Minuten:"));
  if (isNaN(val)) return;

  const ref = db.collection("events")
    .doc(eventId)
    .collection("guesses")
    .doc(user.uid);

  if ((await ref.get()).exists) {
    alert("Schon getippt");
    return;
  }

  await ref.set({ value: val });
}

// CLOSE EVENT (MIT NEUER LOGIK)
async function closeEvent(eventId) {

  const real = parseInt(prompt("Echter Wert:"));
  if (isNaN(real) || real <= 0) return;

  const snap = await db.collection("events")
    .doc(eventId)
    .collection("guesses")
    .get();

  let results = [];

  snap.forEach(doc => {
    const guess = doc.data().value;
    const diff = Math.abs(guess - real);

    const score = Math.max(0, Math.round(100 * (1 - diff / real)));

    results.push({
      uid: doc.id,
      diff,
      score
    });
  });

  // Punkte + Stats
  for (let r of results) {

    await db.collection("users").doc(r.uid).update({
      points: firebase.firestore.FieldValue.increment(r.score),
      games: firebase.firestore.FieldValue.increment(1),
      totalDiff: firebase.firestore.FieldValue.increment(r.diff),
      bestDiff: firebase.firestore.FieldValue.increment(0) // wird unten korrigiert
    });

    // best guess prüfen
    const uDoc = await db.collection("users").doc(r.uid).get();
    const best = uDoc.data().bestDiff;

    if (r.diff < best) {
      await db.collection("users").doc(r.uid).update({
        bestDiff: r.diff
      });
    }
  }

  // Gewinner
  if (results.length > 0) {
    results.sort((a,b)=>a.diff-b.diff);

    await db.collection("users").doc(results[0].uid).update({
      wins: firebase.firestore.FieldValue.increment(1)
    });
  }

  await db.collection("events").doc(eventId).update({
    closed: true,
    result: real
  });
}

// NAV
function switchTab(tab, el) {
  currentTab = tab;

  document.querySelectorAll(".tabbar button")
    .forEach(b => b.classList.remove("active"));

  el.classList.add("active");

  render();
}

// RENDER
function render() {
  const el = document.getElementById("content");

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
        div.className = "card";

        div.innerHTML = `<b>${e.title}</b><br>`;

        if (!e.closed) {
          div.innerHTML += `<button onclick="guess('${doc.id}')">Tippen</button>`;
          if (e.creator === user.uid) {
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

        let avgDiff = u.games > 0
          ? Math.round(u.totalDiff / u.games)
          : 0;

        el.innerHTML += `
          <div class="card">
            <b>${u.username}</b><br>
            Punkte: ${u.points}<br>
            Trefferquote: ${accuracy}%<br>
            Ø Abweichung: ${avgDiff}<br>
            Bester Tipp: ${u.bestDiff}
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
      Aktuelle Gruppe:<br><b>${userData.group || "-"}</b>
    </div>

    <div class="card">
      <button onclick="createGroup()">Neue Gruppe</button>
      <button onclick="joinGroup()">Beitreten</button>
    </div>
  `;
}
