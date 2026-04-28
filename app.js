// State Management
const State = {
    user: localStorage.getItem('guess_user'),
    group: JSON.parse(localStorage.getItem('guess_group')),
    activeTab: 'home'
};

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    switchTab('home');
    
    // Zoom-Sperre via JS (zusätzlich zu CSS)
    document.addEventListener('touchmove', (e) => {
        if (e.scale !== 1) e.preventDefault();
    }, { passive: false });
});

// Login Funktion
function login() {
    const nameInput = document.getElementById('username-input');
    if (nameInput.value.trim() !== "") {
        State.user = nameInput.value;
        localStorage.setItem('guess_user', State.user);
        checkAuth();
    }
}

// Auth-UI Update
function checkAuth() {
    const welcomeMsg = document.getElementById('welcome-msg');
    const authUI = document.getElementById('auth-ui');
    const gameUI = document.getElementById('game-ui');

    if (State.user) {
        welcomeMsg.innerHTML = `Willkommen, <span class="neon-text">${State.user}</span>!`;
        if(authUI) authUI.style.display = 'none';
        if(gameUI) gameUI.style.display = 'block';
    } else {
        welcomeMsg.innerText = "Guess Game v1.2-beta";
        if(authUI) authUI.style.display = 'flex';
        if(gameUI) gameUI.style.display = 'none';
    }
}

// Tab-Navigation
function switchTab(tab) {
    State.activeTab = tab;
    
    // UI-Highlighting der Knöpfe
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const content = document.getElementById('tab-content');
    renderContent(tab, content);
}

// Content Rendering
function renderContent(tab, container) {
    if (!State.user && tab !== 'home') {
        container.innerHTML = `<p style="text-align:center; margin-top:50px;">Bitte logge dich zuerst ein.</p>`;
        return;
    }

    switch(tab) {
        case 'home':
            container.innerHTML = `
                <div class="game-area">
                    <h2 style="text-align:center">Rate die Zahl</h2>
                    <input type="number" class="input-glass" style="width:100%" placeholder="Deine Zahl (1-100)">
                    <button class="btn-liquid btn-primary">Tipp abgeben</button>
                </div>
            `;
            break;
            
        case 'leaderboard':
            container.innerHTML = `
                <h2>Leaderboard</h2>
                <div class="list-item"><span>1. Carlos</span> <span>2.500 Pkt.</span></div>
                <div class="list-item"><span>2. Player2</span> <span>1.800 Pkt.</span></div>
                <hr style="border: 0.5px solid var(--glass-border); margin: 20px 0;">
                <h3>Deine Stats</h3>
                <div class="list-item" style="border-left-color: var(--neon-cyan)">
                    <span>Aktuelle Streak</span> <span style="color:var(--neon-cyan)">🔥 5 Tage</span>
                </div>
            `;
            break;

        case 'groups':
            if (!State.group) {
                container.innerHTML = `
                    <h2>Gruppen</h2>
                    <input id="new-group-name" class="input-glass" style="width:100%" placeholder="Name der neuen Gruppe">
                    <button onclick="createGroup()" class="btn-liquid btn-primary">Gruppe erstellen</button>
                    <p style="text-align:center">oder</p>
                    <input id="join-code" class="input-glass" style="width:100%" placeholder="Einladungscode">
                    <button onclick="joinGroup()" class="btn-liquid">Beitreten</button>
                `;
            } else {
                container.innerHTML = `
                    <h2>Deine Gruppe</h2>
                    <div class="btn-liquid" style="text-align:center; border-color: var(--neon-cyan)">
                        <small>Name:</small><br><strong>${State.group.name}</strong>
                    </div>
                    <div class="btn-liquid" onclick="copyCode('${State.group.code}')">
                        <small>Einladungscode (Klick zum Kopieren):</small><br>
                        <strong style="color: var(--neon-cyan)">${State.group.code}</strong>
                    </div>
                    <button onclick="leaveGroup()" style="background:none; border:none; color:grey; width:100%; margin-top:20px;">Gruppe verlassen</button>
                `;
            }
            break;
    }
}

// Gruppen-Logik
function createGroup() {
    const name = document.getElementById('new-group-name').value;
    if(!name) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    State.group = { name, code };
    localStorage.setItem('guess_group', JSON.stringify(State.group));
    switchTab('groups');
}

function joinGroup() {
    const code = document.getElementById('join-code').value;
    if(code.length < 4) return;
    State.group = { name: "Beigetretene Gruppe", code: code.toUpperCase() };
    localStorage.setItem('guess_group', JSON.stringify(State.group));
    switchTab('groups');
}

function leaveGroup() {
    State.group = null;
    localStorage.removeItem('guess_group');
    switchTab('groups');
}

function copyCode(code) {
    navigator.clipboard.writeText(code);
    alert("Code kopiert: " + code);
}
