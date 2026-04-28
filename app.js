let currentUser = null;
let currentGroup = null;
let currentUsername = null;
let currentTab = "events";

// AUTH STATE
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;

    const doc = await db.collection("users").doc(user.uid).get();

    if (!doc.exists) {
      const username = prompt("Username wählen:");
      await db.collection("users").doc(user.uid).set({
        username,
        group: null,
        points: 0,
        isAdmin: false
      });
      currentUsername = username;
    } else {
      const data = doc.data();
      currentUsername = data.username;
      currentGroup = data.group;
    }

    document.getElementById("userStatus").innerText =
      "👤 " + currentUsername;

    render();
  } else {
    document.getElementById("userStatus").innerText =
      "Nicht eingeloggt";
  }
});

// LOGIN
function login() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.signInWithEmailAndPassword(email, pass)
    .catch(() => alert("Login fehlgeschlagen"));
}

// REGISTER
function register() {
  const email = prompt("Email:");
  const pass = prompt("Passwort:");

  auth.createUserWithEmailAndPassword(email, pass)
    .catch(() => alert("Registrierung fehlgeschlagen"));
}

// -------------------
// 👥 GRUPPEN SYSTEM
// -------------------

// Gruppe erstellen
async function createGroup() {
  const name = prompt("Gruppenname:");

  const code = Math.random().toString(36).substring(2,8);

  await db.collection("groups").doc(code).set({
    name,
    creator: currentUser.uid
  });

  await db.collection("users").doc(currentUser.uid).update({
    group: code,
    isAdmin: true
  });

  currentGroup = code;

  alert("Code: " + code + " (teilen!)");

  render();
}

// Gruppe beitreten
async function joinGroup() {
  const code = prompt("Code eingeben:");

  const group = await db.collection("groups").doc(code).get();

  if (!group.exists) {
    alert("Gruppe existiert nicht");
    return;
  }

  await db.collection("users").doc(currentUser.uid).update({
    group: code,
    isAdmin: false
  });

  currentGroup = code;
  render();
}

// -------------------
// 🎮 EVENTS
// -------------------

async function createEvent() {
  if (!currentGroup) {
    alert("Du bist in keiner Gruppe!");
    return;
  }

  const title = document.getElementById("title").value;

  if (!title) return;

  await db.collection("events").add({
    title,
    group: currentGroup,
    creator: currentUser.uid,
    closed: false,
    createdAt: Date.now()
  });

  document.getElementById("title").value = "";
}

// Tipp
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

// Event beenden
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
    await db.collection("users").doc(best).update({
      points: firebase.firestore.FieldValue.increment(points)
    });
  }

  await db.collection("events").doc(eventId).update({
    closed: true,
    result: real
  });
}

// -------------------
// 📱 NAVIGATION
// -------------------

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".tabbar button").forEach(btn =>
    btn.classList.remove("active")
  );

  event.target.classList.add("active");

  render();
}

// -------------------
// 🎨 RENDER
// -------------------

function render() {
  const el = document.getElementById("content");

  if (!currentUser) {
    el.innerHTML = `
      <button onclick="login()">Login</button>
      <button onclick="register()">Register</button>
    `;
    return;
  }

  if (currentTab === "events") {
    renderEvents(el);
  }

  if (currentTab === "create") {
    renderCreate(el);
  }

  if (currentTab === "leaderboard") {
    renderLeaderboard(el);
  }

  if (currentTab === "groups") {
    renderGroups(el);
  }
}

// EVENTS VIEW
function renderEvents(el) {
  el.innerHTML = "<h2>Aktuelle Wetten</h2>";

  if (!currentGroup) {
    el.innerHTML += "Keine Gruppe";
    return;
  }

  db.collection("events")
    .where("group", "==", currentGroup)
    .onSnapshot(snapshot => {
      el.innerHTML = "<h2>Aktuelle Wetten</h2>";

      snapshot.forEach(doc => {
        const e = doc.data();

        let div = document.createElement("div");
        div.className = "card fade";

        div.innerHTML = `<b>${e.title}</b><br>`;

        if (!e.closed) {
          div.innerHTML += `<button onclick="guess('${doc.id}')">Tippen</button>`;

          if (e.creator === currentUser.uid) {
            div.innerHTML += `<button onclick="closeEvent('${doc.id}')">Beenden</button>`;
          }
        } else {
          div.innerHTML += `Ergebnis: ${e.result}`;
        }

        el.appendChild(div);
      });
    });
}

// CREATE VIEW
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
    .where("group", "==", currentGroup)
    .onSnapshot(snapshot => {
      let arr = [];

      snapshot.forEach(doc => arr.push(doc.data()));

      arr.sort((a,b) => b.points - a.points);

      arr.forEach(u => {
        el.innerHTML += `
          <div class="card">${u.username}: ${u.points}</div>
        `;
      });
    });
}

// GROUPS VIEW
function renderGroups(el) {
  el.innerHTML = `
    <h2>Gruppen</h2>
    <button onclick="createGroup()">Neue Gruppe</button>
    <button onclick="joinGroup()">Beitreten</button>
    <p>Aktuelle Gruppe: ${currentGroup || "Keine"}</p>
  `;
}
