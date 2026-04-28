let currentUser = localStorage.getItem("username") || prompt("Dein Name?");
if (currentUser) localStorage.setItem("username", currentUser);

const userInfo = document.getElementById("userInfo");
userInfo.textContent = currentUser ? `Angemeldet als: ${currentUser}` : "";

async function createEvent() {
  const title = document.getElementById("eventTitle").value.trim();
  if (!title) return alert("Bitte Titel eingeben.");

  await db.collection("events").add({
    title,
    creator: currentUser,
    guesses: {},
    result: null,
    closed: false,
    createdAt: Date.now()
  });

  document.getElementById("eventTitle").value = "";
}

async function submitGuess(eventId) {
  const value = parseInt(prompt("Dein Tipp:"), 10);
  if (Number.isNaN(value)) return alert("Bitte eine Zahl eingeben.");

  const ref = db.collection("events").doc(eventId);
  const doc = await ref.get();
  const data = doc.data();

  if (data.guesses && data.guesses[currentUser] !== undefined) {
    return alert("Du hast schon getippt!");
  }

  await ref.update({
    [`guesses.${currentUser}`]: value
  });
}

async function closeEvent(eventId) {
  const realValue = parseInt(prompt("Echter Wert:"), 10);
  if (Number.isNaN(realValue)) return alert("Bitte eine Zahl eingeben.");

  const ref = db.collection("events").doc(eventId);
  const doc = await ref.get();
  const data = doc.data();

  let bestUser = null;
  let bestDiff = Infinity;

  Object.entries(data.guesses || {}).forEach(([user, guess]) => {
    const diff = Math.abs(guess - realValue);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestUser = user;
    }
  });

  if (bestUser) {
    const points = Math.max(10 - bestDiff, 0);
    await db.collection("scores").doc(bestUser).set({
      points: firebase.firestore.FieldValue.increment(points)
    }, { merge: true });
  }

  await ref.update({
    closed: true,
    result: realValue
  });
}

function renderEvents(events) {
  const container = document.getElementById("events");
  container.innerHTML = "";

  events.forEach(({ id, ...e }) => {
    const div = document.createElement("div");
    div.className = "event";

    div.innerHTML = `
      <b>${e.title}</b><br>
      <div>Status: ${e.closed ? `Beendet – Wert: ${e.result}` : "Offen"}</div>
      <div>Erstellt von: ${e.creator || "-"}</div>
    `;

    if (!e.closed) {
      const guessBtn = document.createElement("button");
      guessBtn.textContent = "Tippen";
      guessBtn.onclick = () => submitGuess(id);
      div.appendChild(guessBtn);
    }

    if (e.creator === currentUser && !e.closed) {
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Auflösen";
      closeBtn.onclick = () => closeEvent(id);
      div.appendChild(closeBtn);
    }

    container.appendChild(div);
  });
}

function renderLeaderboard(scores) {
  const container = document.getElementById("leaderboard");
  container.innerHTML = "";

  scores.forEach(([name, data]) => {
    const row = document.createElement("div");
    row.className = "event";
    row.textContent = `${name}: ${data.points || 0} Punkte`;
    container.appendChild(row);
  });
}

db.collection("events").orderBy("createdAt", "desc").onSnapshot(snapshot => {
  const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderEvents(events);
});

db.collection("scores").onSnapshot(snapshot => {
  const scores = snapshot.docs
    .map(doc => [doc.id, doc.data()])
    .sort((a, b) => (b[1].points || 0) - (a[1].points || 0));

  renderLeaderboard(scores);
});
