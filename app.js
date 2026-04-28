let user = null;
let userData = null;
let currentTab = "events";

// ----------------
// AUTH STATE
// ----------------
auth.onAuthStateChanged(async (u) => {
  user = u;

  if (!user) {
    document.getElementById("userStatus").innerText = "Nicht eingeloggt";
    document.getElementById("bottom-nav").style.display = "none"; // Tabbar verstecken
    render();
    return;
  }

  const ref = db.collection("users").doc(user.uid);
  let doc = await ref.get();

  if (!doc.exists) {
    const username = prompt("Username:"); // Bleibt fürs allererste Erstellen
    await ref.set({
      username,
      group: null,
      points: 0,
      isAdmin: false,
      streak: 1 // Initiale Streak
    });
    doc = await ref.get();
  }

  userData = doc.data();

  document.getElementById("userStatus").innerText = "👤 " + userData.username;
  document.getElementById("bottom-nav").style.display = "flex"; // Tabbar zeigen

  // Tab-Highlighting sofort setzen
  switchTab(currentTab);
});

// ----------------
// LOGIN / REGISTER (UI statt Prompts)
// ----------------
function login() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;
  if (!email || !pass) return alert("Bitte alles ausfüllen");

  auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function register() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;
  if (!email || !pass) return alert("Bitte alles ausfüllen");

  auth.createUserWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

// ----------------
// GROUPS
// ----------------
async function createGroup() {
  const name = document.getElementById("newGroupName").value;
  if (!name) return;

  const code = Math.random().toString(36).substring(2,8).toUpperCase();

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
  const code = document.getElementById("joinGroupCode").value.toUpperCase();
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
// EVENTS & GUESSING (Deine Original-Logik)
// ----------------
async function createEvent() {
  const title = document.getElementById("title").value;
  if (!userData.group) return alert("Erst Gruppe beitreten!");
  if (!title) return alert("Titel fehlt");

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
  const val = parseInt(prompt("Dein Tipp (in Minuten):"));
  if (isNaN(val)) return;

  const ref = db.collection("events").doc(eventId).collection("guesses").doc(user.uid);
  const doc = await ref.get();

  if (doc.exists) return alert("Du hast schon getippt!");
  await ref.set({ value: val });
}

async function closeEvent(eventId) {
  if (!userData.isAdmin) return alert("Nur Admin!");
  const real = parseInt(prompt("Echter Wert (Minuten):"));
  if (isNaN(real)) return;

  const snap = await db.collection("events").doc(eventId).collection("guesses").get();
  let results = [];

  snap.forEach(doc => {
    results.push({ uid: doc.id, diff: Math.abs(doc.data().value - real) });
  });

  results.sort((a,b) => a.diff - b.diff);
  const rewards = [10,6,3];

  for (let i=0; i<results.length && i<3; i++) {
    const r = results[i];
    await db.collection("users").doc(r.uid).update({
      points: firebase.firestore.FieldValue.increment(rewards[i])
    });
  }

  await db.collection("events").doc(eventId).update({
    closed: true,
    result: real
  });
}

// ----------------
// NAVIGATION (Mit Fehlerbehebung)
// ----------------
function switchTab(tab) {
  currentTab = tab;

  // Alle Buttons zurücksetzen
  document.querySelectorAll(".tabbar button").forEach(b => {
    b.classList.remove("active");
    // Den aktiven Button anhand des 'onclick' Attributs finden und hervorheben
    if(b.getAttribute("onclick").includes(tab)) {
      b.classList.add("active");
    }
  });

  render();
}

// ----------------
// RENDER VIEWS
// ----------------
function render() {
  const el = document.getElementById("content");

  // Wenn nicht eingeloggt: Login Screen (Keine Prompts mehr!)
  if (!user) {
    el.innerHTML = `
      <div class="card fade" style="margin-top: 40px;">
        <h2>Login</h2>
        <input id="authEmail" type="email" placeholder="Email">
        <input id="authPass" type="password" placeholder="Passwort">
        <button onclick="login()">Einloggen</button>
        <button onclick="register()" class="btn-secondary">Registrieren</button>
      </div>
    `;
    return;
  }

  if (currentTab === "events") renderEvents(el);
  if (currentTab === "create") renderCreate(el);
  if (currentTab === "leaderboard") renderLeaderboard(el);
  if (currentTab === "groups") renderGroups(el);
}

// EVENTS VIEW (Mit Willkommens-Nachricht)
function renderEvents(el) {
  if (!userData.group) {
    el.innerHTML = `
      <h3 class="neon-text">Willkommen beim Guess Game, ${userData.username}!</h3>
      <div class="card">Bitte trete zuerst einer Gruppe bei (👥).</div>`;
    return;
  }

  db.collection("events").where("group","==",userData.group).onSnapshot(snap => {
    // Willkommensnachricht am oberen Bildschirmrand der Hauptseite
    el.innerHTML = `
      <h3 class="neon-text" style="text-align: center; margin-bottom: 20px;">Willkommen beim Guess Game, ${userData.username}!</h3>
      <h2>Aktuelle Wetten</h2>
    `;

    if(snap.empty) {
       el.innerHTML += `<div class="card fade">Keine aktiven Wetten.</div>`;
    }

    snap.forEach(doc => {
      const e = doc.data();
      let div = document.createElement("div");
      div.className = "card fade";
      div.innerHTML = `<h3 style="margin-top:0">${e.title}</h3>`;

      if (!e.closed) {
        div.innerHTML += `<button onclick="guess('${doc.id}')">Tipp abgeben</button>`;
        if (userData.isAdmin) {
          div.innerHTML += `<button onclick="closeEvent('${doc.id}')" class="btn-secondary">Wette beenden</button>`;
        }
      } else {
        div.innerHTML += `<div style="color:var(--neon-cyan); font-weight:bold;">Ergebnis: ${e.result}</div>`;
      }
      el.appendChild(div);
    });
  });
}

// CREATE VIEW
function renderCreate(el) {
  el.innerHTML = `
    <h2>Neue Wette</h2>
    <div class="card fade">
      <input id="title" placeholder="Titel des Events (z.B. 'Zuspätkommen')">
      <button onclick="createEvent()">Event erstellen</button>
    </div>
  `;
}

// LEADERBOARD VIEW (Mit Stats & Streaks)
function renderLeaderboard(el) {
  db.collection("users").where("group","==",userData.group).onSnapshot(snap => {
    let arr = [];
    snap.forEach(doc => arr.push(doc.data()));
    arr.sort((a,b)=>b.points-a.points);

    let streak = userData.streak || 1; // Fallback falls noch nicht in DB

    let html = `<h2>Leaderboard</h2>`;
    
    // Stats Karte
    html += `
      <div class="card fade" style="border-left: 4px solid var(--neon-cyan);">
        <h3 style="margin-top:0">Deine Statistiken</h3>
        <p>🏆 Punkte gesamt: <b>${userData.points}</b></p>
        <p>🔥 Aktuelle Streak: <b class="neon-text">${streak} Tage</b></p>
      </div>
      <h3>Ranking</h3>
    `;

    // Leaderboard Liste
    arr.forEach((u, index) => {
      let icon = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "▪️";
      html += `
        <div class="card fade" style="display:flex; justify-content:space-between; padding: 15px;">
          <span>${icon} <b>${u.username}</b></span>
          <span class="neon-text"><b>${u.points}</b> Pkt</span>
        </div>`;
    });
    el.innerHTML = html;
  });
}

// GROUPS VIEW (Mit Code zum Kopieren und Name)
function renderGroups(el) {
  if (userData.group) {
    el.innerHTML = `
      <h2>Deine Gruppe</h2>
      <div class="card fade" style="text-align: center;">
        <p>Du bist aktuell in der Gruppe:</p>
        <h1 class="neon-text" style="letter-spacing: 3px; cursor: pointer;" 
            onclick="navigator.clipboard.writeText('${userData.group}'); alert('Code kopiert!')">
            ${userData.group}
        </h1>
        <p style="color: #aaa; font-size: 12px;">(Tippen, um den Einladungscode zu kopieren)</p>
      </div>
    `;
  } else {
    el.innerHTML = `
      <h2>Gruppen</h2>
      <div class="card fade">
        <h3 style="margin-top:0">Neue Gruppe</h3>
        <input id="newGroupName" placeholder="Name der Gruppe">
        <button onclick="createGroup()">Gruppe erstellen</button>
      </div>
      <div class="card fade">
        <h3 style="margin-top:0">Beitreten</h3>
        <input id="joinGroupCode" placeholder="Einladungscode" style="text-transform: uppercase;">
        <button onclick="joinGroup()" class="btn-secondary">Beitreten</button>
      </div>
    `;
  }
}
