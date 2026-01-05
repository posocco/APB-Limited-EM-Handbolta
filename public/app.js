// OPTIMIZED ÚTGÁFA MEÐ CACHE OG BETRI PERFORMANCE

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
  writeBatch
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let activeLeagueId = null;
let currentLeagueSettings = null;
let currentGameForBonus = null;
// GOOGLE SHEETS INTEGRATION
const SHEET_ID = '15LQbx0CbACqEgtPpb5IC_EK3aJRavGoKgv7BFo7t9bA';
const SHEET_NAME = 'Sheet1'; // Breyttu þessu ef sheetið þitt heitir eitthvað annað
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

let availableGamesFromSheet = [];

// Sækja leiki úr Google Sheets
async function fetchGamesFromSheet() {
  try {
    const response = await fetch(SHEET_URL);
    const text = await response.text();
    
    // Google returnerar JSONP, þurfum að parse-a það
    const jsonString = text.substring(47).slice(0, -2);
    const json = JSON.parse(jsonString);
    
    const rows = json.table.rows;
    const games = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].c;
      
      // Skip ef röð er tóm
      if (!row[0] || !row[1] || !row[2]) continue;
      
      const homeTeam = row[0]?.v || '';
      const awayTeam = row[1]?.v || '';
      const gameTimeStr = row[2]?.v || '';
      const competition = row[3]?.v || 'EM Handbolta';
      
      if (homeTeam && awayTeam && gameTimeStr) {
        games.push({
          homeTeam,
          awayTeam,
          gameTime: gameTimeStr,
          competition
        });
      }
    }
    
    availableGamesFromSheet = games;
    return games;
  } catch (error) {
    console.error("Villa við að sækja leiki úr Google Sheets:", error);
    return [];
  }
}

// Sýna leiki frá Google Sheets
async function showAvailableGames() {
  const container = document.getElementById('availableGamesList');
  if (!container) return;
  
  container.innerHTML = "<p>Hleð leikjum úr Google Sheets...</p>";
  
  try {
    const games = await fetchGamesFromSheet();
    
    if (games.length === 0) {
      container.innerHTML = "<p>Engir leikir fundust í Google Sheet</p>";
      return;
    }
    
    container.innerHTML = "<p style='margin-bottom: 15px; color: #666; font-weight: 500;'>Veldu leiki til að bæta við deildina:</p>";
    
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const div = document.createElement("div");
      div.style.cssText = "background: white; padding: 15px; margin: 10px 0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 2px solid var(--border); transition: all 0.2s;";
      
      div.innerHTML = `
        <div>
          <strong style="font-size: 1.05rem;">${game.homeTeam} vs ${game.awayTeam}</strong><br>
          <small style="color: #666;">${game.gameTime}</small>
          <small style="color: #667eea; margin-left: 10px;">📋 ${game.competition}</small>
        </div>
        <button onclick="addGameFromSheet(${i})" style="padding: 10px 20px; margin: 0;">➕ Bæta við</button>
      `;
      
      div.onmouseover = () => {
        div.style.borderColor = 'var(--primary)';
        div.style.transform = 'translateX(5px)';
      };
      div.onmouseout = () => {
        div.style.borderColor = 'var(--border)';
        div.style.transform = 'translateX(0)';
      };
      
      container.appendChild(div);
    }
  } catch (error) {
    handleError(error, "Villa við að sýna leiki");
    container.innerHTML = "<p>Villa við að hlaða leikjum</p>";
  }
}

// Bæta leik við deild úr Google Sheet
window.addGameFromSheet = async (index) => {
  const game = availableGamesFromSheet[index];
  if (!game) return alert("Leikur fannst ekki!");
  
  showLoading(true);
  try {
    // Parse datetime string
    const dateTimeParts = game.gameTime.split(' ');
    const dateParts = dateTimeParts[0].split('-');
    const timeParts = dateTimeParts[1].split(':');
    
    const gameDate = new Date(
      parseInt(dateParts[0]), // year
      parseInt(dateParts[1]) - 1, // month (0-indexed)
      parseInt(dateParts[2]), // day
      parseInt(timeParts[0]), // hours
      parseInt(timeParts[1]) // minutes
    );
    
    const gameTime = Timestamp.fromDate(gameDate);

    await addDoc(collection(db, "games"), {
      leagueId: activeLeagueId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      gameTime: gameTime,
      competition: game.competition,
      result: null,
      createdAt: Timestamp.now()
    });

    clearCache();
    await loadAllLeagueData();
    alert(`✅ Leikur bætt við: ${game.homeTeam} vs ${game.awayTeam}`);
  } catch (error) {
    handleError(error, "Villa við að bæta leik við");
  } finally {
    showLoading(false);
  }
};

// Refresh leiki úr Google Sheets
document.getElementById("refreshGamesBtn")?.addEventListener("click", async () => {
  showLoading(true);
  try {
    await showAvailableGames();
    alert("✅ Leikir uppfærðir!");
  } catch (error) {
    handleError(error, "Villa við að uppfæra leiki");
  } finally {
    showLoading(false);
  }
});
/* =========================
   CACHE FYRIR GÖGN
========================= */
const cache = {
  leagues: new Map(),
  members: new Map(),
  games: new Map(),
  tips: new Map(),
  bonusQuestions: new Map(),
  bonusAnswers: new Map(),
  lastFetch: {}
};

const CACHE_DURATION = 30000; // 30 sekúndur

function isCacheValid(key) {
  return cache.lastFetch[key] && (Date.now() - cache.lastFetch[key] < CACHE_DURATION);
}

function setCacheTimestamp(key) {
  cache.lastFetch[key] = Date.now();
}

function clearCache() {
  cache.leagues.clear();
  cache.members.clear();
  cache.games.clear();
  cache.tips.clear();
  cache.bonusQuestions.clear();
  cache.bonusAnswers.clear();
  cache.lastFetch = {};
}

/* =========================
   LOCALSTORAGE FYRIR STATE
========================= */
function saveActiveLeague(leagueId) {
  if (leagueId) {
    localStorage.setItem('activeLeagueId', leagueId);
  } else {
    localStorage.removeItem('activeLeagueId');
  }
}

function loadActiveLeague() {
  return localStorage.getItem('activeLeagueId');
}

/* =========================
   ERROR HANDLING HELPER
========================= */
function handleError(error, userMessage = "Villa kom upp") {
  console.error("Error:", error);
  
  if (error.code === 'permission-denied') {
    alert("Þú hefur ekki heimild til þessarar aðgerðar");
  } else if (error.code === 'not-found') {
    alert("Gögn fundust ekki");
  } else if (error.code === 'already-exists') {
    alert("Þessi færsla er þegar til");
  } else if (error.message) {
    alert(`${userMessage}: ${error.message}`);
  } else {
    alert(userMessage);
  }
}

/* =========================
   LOADING INDICATOR
========================= */
function showLoading(show = true) {
  const loader = document.getElementById("loadingIndicator");
  if (loader) {
    loader.style.display = show ? "block" : "none";
  }
}

/* =========================
   SJÁLFGEFIN STIGASTILLINGAR
========================= */
const DEFAULT_POINTS = {
  exactScore: 5,
  homeTeamScore: 3,
  awayTeamScore: 3,
  correctOutcome: 2
};

/* =========================
   OPTIMIZED BATCH FETCHING
========================= */
async function fetchLeagueData(leagueId) {
  const cacheKey = `league_${leagueId}`;
  
  if (isCacheValid(cacheKey)) {
    return {
      league: cache.leagues.get(leagueId),
      members: Array.from(cache.members.values()).filter(m => m.leagueId === leagueId),
      games: Array.from(cache.games.values()).filter(g => g.leagueId === leagueId),
      tips: Array.from(cache.tips.values()).filter(t => t.leagueId === leagueId),
      bonusQuestions: Array.from(cache.bonusQuestions.values()).filter(q => q.leagueId === leagueId),
      bonusAnswers: Array.from(cache.bonusAnswers.values()).filter(a => a.leagueId === leagueId)
    };
  }

  // Sækja allt samhliða
  const [leagueSnap, membersSnap, gamesSnap, tipsSnap, bonusQSnap, bonusASnap] = await Promise.all([
    getDoc(doc(db, "leagues", leagueId)),
    getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", leagueId))),
    getDocs(query(collection(db, "games"), where("leagueId", "==", leagueId))),
    getDocs(query(collection(db, "tips"), where("leagueId", "==", leagueId))),
    getDocs(query(collection(db, "bonusQuestions"), where("leagueId", "==", leagueId))),
    getDocs(query(collection(db, "bonusAnswers"), where("leagueId", "==", leagueId)))
  ]);

  // Vista í cache
  const league = leagueSnap.exists() ? { id: leagueId, ...leagueSnap.data() } : null;
  if (league) cache.leagues.set(leagueId, league);

  const members = [];
  membersSnap.forEach(docSnap => {
    const data = { id: docSnap.id, ...docSnap.data() };
    cache.members.set(docSnap.id, data);
    members.push(data);
  });

  const games = [];
  gamesSnap.forEach(docSnap => {
    const data = { id: docSnap.id, ...docSnap.data() };
    cache.games.set(docSnap.id, data);
    games.push(data);
  });

  const tips = [];
  tipsSnap.forEach(docSnap => {
    const data = { id: docSnap.id, ...docSnap.data() };
    cache.tips.set(docSnap.id, data);
    tips.push(data);
  });

  const bonusQuestions = [];
  bonusQSnap.forEach(docSnap => {
    const data = { id: docSnap.id, ...docSnap.data() };
    cache.bonusQuestions.set(docSnap.id, data);
    bonusQuestions.push(data);
  });

  const bonusAnswers = [];
  bonusASnap.forEach(docSnap => {
    const data = { id: docSnap.id, ...docSnap.data() };
    cache.bonusAnswers.set(docSnap.id, data);
    bonusAnswers.push(data);
  });

  setCacheTimestamp(cacheKey);

  return { league, members, games, tips, bonusQuestions, bonusAnswers };
}

/* =========================
   PUSH NOTIFICATIONS
========================= */
async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Vafrinn styður ekki tilkynningar");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("Villa við að biðja um tilkynningaleyfi:", error);
      return false;
    }
  }
  
  return false;
}

function sendNotification(title, body) {
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: body,
        icon: "⚽",
        badge: "🏆"
      });
    } catch (error) {
      console.error("Villa við að senda tilkynningu:", error);
    }
  }
}

async function checkUpcomingGames() {
  if (!activeLeagueId || !auth.currentUser) return;
  
  try {
    const data = await fetchLeagueData(activeLeagueId);
    const now = new Date();
    
    for (let game of data.games) {
      if (!game.gameTime) continue;
      
      const gameTime = game.gameTime.toDate();
      const minutesUntil = (gameTime - now) / (1000 * 60);
      
      const hasTipped = data.tips.some(tip => 
        tip.gameId === game.id && tip.userId === auth.currentUser.uid
      );
      
      if (minutesUntil > 15 && minutesUntil <= 30 && !hasTipped) {
        sendNotification(
          "⏰ Ekki gleyma að tippa!",
          `${game.homeTeam} vs ${game.awayTeam} byrjar eftir ${Math.floor(minutesUntil)} mínútur`
        );
      }
      
      if (minutesUntil >= 0 && minutesUntil <= 2) {
        sendNotification(
          "🔴 Leikur byrjar núna!",
          `${game.homeTeam} vs ${game.awayTeam}`
        );
      }
    }
  } catch (error) {
    console.error("Villa við að athuga leiki:", error);
  }
}

let notificationInterval = null;

function startNotificationChecks() {
  if (notificationInterval) clearInterval(notificationInterval);
  checkUpcomingGames();
  notificationInterval = setInterval(checkUpcomingGames, 5 * 60 * 1000);
}

function stopNotificationChecks() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

/* =========================
   INNSKRÁNING
========================= */
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const username = document.getElementById("username")?.value;

  if (!email || !password) return alert("Settu netfang og lykilorð!");
  if (!username || username.trim() === "") return alert("Settu notendanafn!");

  showLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (loginError) {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (createError) {
      handleError(createError, "Villa við innskráningu");
    }
  } finally {
    showLoading(false);
  }
});

document.getElementById("googleLoginBtn")?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  
  showLoading(true);
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.log("Popup blocked, using redirect instead");
      await signInWithRedirect(auth, provider);
    } else if (error.code !== 'auth/popup-closed-by-user') {
      handleError(error, "Villa við Google innskráningu");
    }
  } finally {
    showLoading(false);
  }
});

getRedirectResult(auth)
  .then(async (result) => {
    if (result && result.user) {
      // onAuthStateChanged sér um restina
    }
  })
  .catch((error) => {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error("Google redirect error:", error);
    }
  });

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await auth.signOut();
    saveActiveLeague(null);
    activeLeagueId = null;
    clearCache();
    location.reload();
  } catch (error) {
    handleError(error, "Villa við útskráningu");
  }
});

/* =========================
   DEILDIR
========================= */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

document.getElementById("createLeagueBtn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Þú verður að vera innskráður!");
  
  const username = document.getElementById("username")?.value;
  const name = document.getElementById("leagueName").value;
  
  if (!name || name.trim() === "") return alert("Settu nafn deildar");
  if (!username || username.trim() === "") return alert("Settu notendanafn fyrst!");

  showLoading(true);
  try {
    const leagueRef = doc(collection(db, "leagues"));
    const memberRef = doc(db, "leagueMembers", `${leagueRef.id}_${user.uid}`);
    
    await runTransaction(db, async (transaction) => {
      transaction.set(leagueRef, {
        name: name.trim(),
        ownerId: user.uid,
        code: generateCode(),
        pointSettings: DEFAULT_POINTS,
        createdAt: Timestamp.now()
      });
      
      transaction.set(memberRef, {
        leagueId: leagueRef.id,
        userId: user.uid,
        username: username.trim(),
        points: 0,
        joinedAt: Timestamp.now()
      });
    });

    clearCache();
    alert(`Deild "${name.trim()}" búin til!`);
    document.getElementById("leagueName").value = "";
    await loadUserLeagues();
  } catch (error) {
    handleError(error, "Villa við að búa til deild");
  } finally {
    showLoading(false);
  }
});

document.getElementById("joinLeagueBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("leagueCode").value.trim().toUpperCase();
  const user = auth.currentUser;
  if (!user) return alert("Þú verður að vera innskráður!");
  
  const username = document.getElementById("username")?.value;

  if (!code) return alert("Settu deildar kóða!");
  if (!username || username.trim() === "") return alert("Settu notendanafn fyrst!");

  showLoading(true);
  try {
    const q = query(collection(db, "leagues"), where("code", "==", code));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      alert("Engin deild fannst með þessum kóða");
      return;
    }

    const league = snap.docs[0];
    const leagueId = league.id;
    
    const existingMember = await getDoc(doc(db, "leagueMembers", `${leagueId}_${user.uid}`));
    if (existingMember.exists()) {
      alert("Þú ert þegar í þessari deild!");
      return;
    }

    await setDoc(doc(db, "leagueMembers", `${leagueId}_${user.uid}`), {
      leagueId: leagueId,
      userId: user.uid,
      username: username.trim(),
      points: 0,
      joinedAt: Timestamp.now()
    });

    clearCache();
    alert(`Þú ert núna í deild: ${league.data().name}`);
    document.getElementById("leagueCode").value = "";
    await loadUserLeagues();
  } catch (error) {
    handleError(error, "Villa við að ganga í deild");
  } finally {
    showLoading(false);
  }
});

/* =========================
   SÝNA DEILDIR
========================= */
async function loadUserLeagues() {
  const ul = document.getElementById("userLeagues");
  ul.innerHTML = "<li>Hleð deildum...</li>";

  try {
    const memberSnap = await getDocs(query(
      collection(db, "leagueMembers"), 
      where("userId", "==", auth.currentUser.uid)
    ));
    
    if (memberSnap.empty) {
      ul.innerHTML = "<li>Þú ert ekki í neinum deildum enn</li>";
      return;
    }

    const leagueIds = memberSnap.docs.map(d => d.data().leagueId);
    
    const leaguesSnap = await getDocs(collection(db, "leagues"));
    const leaguesMap = new Map();
    leaguesSnap.docs.forEach(docSnap => {
      leaguesMap.set(docSnap.id, docSnap.data());
    });

    ul.innerHTML = "";

    for (let d of memberSnap.docs) {
      const leagueId = d.data().leagueId;
      const leagueData = leaguesMap.get(leagueId);
      
      if (!leagueData) continue;
      
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${leagueData.name}</strong><br>
        <small style="color: #666;">Kóði: <strong style="color: #667eea;">${leagueData.code}</strong></small>
      `;
      li.style.cursor = "pointer";
      
      if (leagueId === activeLeagueId) {
        li.style.background = "#e8eaf6";
        li.style.borderLeft = "4px solid #667eea";
      }

      li.onclick = async () => {
        activeLeagueId = leagueId;
        saveActiveLeague(leagueId);
        
        showLoading(true);
        try {
          await loadAllLeagueData();
          await loadUserLeagues();
        } catch (error) {
          handleError(error, "Villa við að hlaða deild");
        } finally {
          showLoading(false);
        }
      };

      ul.appendChild(li);
    }
    
    if (!activeLeagueId) {
      const savedLeagueId = loadActiveLeague();
      if (savedLeagueId && leagueIds.includes(savedLeagueId)) {
        const savedLi = Array.from(ul.children).find(li => 
          li.onclick && li.textContent.includes(leaguesMap.get(savedLeagueId)?.name)
        );
        if (savedLi) {
          savedLi.click();
        }
      }
    }
  } catch (error) {
    handleError(error, "Villa við að hlaða deildum");
    ul.innerHTML = "<li>Villa við að hlaða deildum</li>";
  }
}

/* =========================
   LOAD ALL DATA AT ONCE
========================= */
async function loadAllLeagueData() {
  const data = await fetchLeagueData(activeLeagueId);
  
  if (data.league) {
    currentLeagueSettings = data.league.pointSettings || DEFAULT_POINTS;
  }
  
  await Promise.all([
    renderGames(data),
    renderScores(data),
    checkAdminWithData(data),
    checkUpcomingGames()
  ]);
}

/* =========================
   HLAÐA STIGASTILLINGUM
========================= */
async function loadLeagueSettings() {
  try {
    const data = await fetchLeagueData(activeLeagueId);
    currentLeagueSettings = data.league?.pointSettings || DEFAULT_POINTS;
  } catch (error) {
    console.error("Villa við að hlaða stillingum:", error);
    currentLeagueSettings = DEFAULT_POINTS;
  }
}

/* =========================
   ADMIN CHECK
========================= */
async function checkAdminWithData(data) {
  const panel = document.getElementById("adminPanel");
  const settingsPanel = document.getElementById("pointSettingsPanel");
  
  try {
    const isAdmin = data.league && data.league.ownerId === auth.currentUser.uid;
    
    panel.style.display = isAdmin ? "block" : "none";
    settingsPanel.style.display = isAdmin ? "block" : "none";
    
    if (isAdmin && currentLeagueSettings) {
      document.getElementById("pointExactScore").value = currentLeagueSettings.exactScore;
      document.getElementById("pointHomeScore").value = currentLeagueSettings.homeTeamScore;
      document.getElementById("pointAwayScore").value = currentLeagueSettings.awayTeamScore;
      document.getElementById("pointOutcome").value = currentLeagueSettings.correctOutcome;
    }
  } catch (error) {
    console.error("Villa við að athuga admin réttindi:", error);
    panel.style.display = "none";
    settingsPanel.style.display = "none";
  }
}

async function checkAdmin() {
  const data = await fetchLeagueData(activeLeagueId);
  await checkAdminWithData(data);
}

document.getElementById("savePointSettingsBtn")?.addEventListener("click", async () => {
  const settings = {
    exactScore: parseInt(document.getElementById("pointExactScore").value) || 5,
    homeTeamScore: parseInt(document.getElementById("pointHomeScore").value) || 3,
    awayTeamScore: parseInt(document.getElementById("pointAwayScore").value) || 3,
    correctOutcome: parseInt(document.getElementById("pointOutcome").value) || 2
  };
  
  showLoading(true);
  try {
    await updateDoc(doc(db, "leagues", activeLeagueId), {
      pointSettings: settings
    });
    
    currentLeagueSettings = settings;
    clearCache();
    alert("Stigastillingar vistaðar!");
  } catch (error) {
    handleError(error, "Villa við að vista stillingar");
  } finally {
    showLoading(false);
  }
});

/* =========================
   HJÁLPAR FÖLL FYRIR TÍMA
========================= */
function formatDateTime(timestamp) {
  if (!timestamp) return "";
  try {
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} kl. ${hours}:${minutes}`;
  } catch (error) {
    console.error("Villa við að forsníða tíma:", error);
    return "";
  }
}

function canTip(gameTime) {
  if (!gameTime) return true;
  try {
    const now = new Date();
    const game = gameTime.toDate();
    const diffMinutes = (game - now) / (1000 * 60);
    return diffMinutes > 15;
  } catch (error) {
    console.error("Villa við að athuga hvort hægt er að tippa:", error);
    return false;
  }
}

function hasGameStarted(gameTime) {
  if (!gameTime) return false;
  try {
    const now = new Date();
    const game = gameTime.toDate();
    return now >= game;
  } catch (error) {
    console.error("Villa við að athuga hvort leikur er byrjaður:", error);
    return false;
  }
}

function getTimeUntilGame(gameTime) {
  if (!gameTime) return "";
  try {
    const now = new Date();
    const game = gameTime.toDate();
    const diffMinutes = Math.floor((game - now) / (1000 * 60));
    
    if (diffMinutes < 0) return "Leikur hafinn";
    if (diffMinutes < 60) return `${diffMinutes} mín til leiks`;
    
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}klst ${mins}mín til leiks`;
  } catch (error) {
    console.error("Villa við að reikna tíma:", error);
    return "";
  }
}

/* =========================
   REIKNA STIG
========================= */
function calculatePoints(prediction, result, settings) {
  if (!prediction || !result || !prediction.includes("-") || !result.includes("-")) {
    return 0;
  }
  
  try {
    const [predHome, predAway] = prediction.split("-").map(Number);
    const [resHome, resAway] = result.split("-").map(Number);
    
    if (isNaN(predHome) || isNaN(predAway) || isNaN(resHome) || isNaN(resAway)) {
      return 0;
    }
    
    let points = 0;
    
    if (predHome === resHome && predAway === resAway) {
      points += settings.exactScore;
    }
    
    if (predHome === resHome) {
      points += settings.homeTeamScore;
    }
    
    if (predAway === resAway) {
      points += settings.awayTeamScore;
    }
    
    const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
    const resOutcome = resHome > resAway ? 'home' : resHome < resAway ? 'away' : 'draw';
    
    if (predOutcome === resOutcome) {
      points += settings.correctOutcome;
    }
    
    return points;
  } catch (error) {
    console.error("Villa við að reikna stig:", error);
    return 0;
  }
}

/* =========================
   BÓNUSSPURNINGAR - ADMIN
========================= */
document.getElementById("manageBonusBtn")?.addEventListener("click", async () => {
  const gameId = document.getElementById("bonusGameSelect").value;
  if (!gameId) return alert("Veldu leik!");
  
  currentGameForBonus = gameId;
  
  showLoading(true);
  try {
    await loadBonusQuestions(gameId);
    document.getElementById("bonusQuestionsPanel").style.display = "block";
  } catch (error) {
    handleError(error, "Villa við að hlaða bónusspurningum");
  } finally {
    showLoading(false);
  }
});

document.getElementById("addBonusQuestionBtn")?.addEventListener("click", async () => {
  const type = document.getElementById("bonusQuestionType").value;
  const question = document.getElementById("bonusQuestionText").value.trim();
  const points = parseInt(document.getElementById("bonusQuestionPoints").value) || 1;
  
  if (!question) return alert("Skrifaðu spurningu!");
  if (points < 1 || points > 100) return alert("Stig verða að vera á milli 1 og 100");
  
  const bonusData = {
    gameId: currentGameForBonus,
    leagueId: activeLeagueId,
    type: type,
    question: question,
    points: points,
    createdAt: Timestamp.now()
  };
  
  if (type === "multipleChoice") {
    const optionsText = document.getElementById("bonusQuestionOptions").value;
    const options = optionsText.split(",").map(o => o.trim()).filter(o => o.length > 0);
    if (options.length < 2) return alert("Settu að minnsta kosti 2 valmöguleika, aðskildir með kommu");
    bonusData.options = options;
  }
  
  showLoading(true);
  try {
    await addDoc(collection(db, "bonusQuestions"), bonusData);
    
    document.getElementById("bonusQuestionText").value = "";
    document.getElementById("bonusQuestionPoints").value = "1";
    document.getElementById("bonusQuestionOptions").value = "";
    
    clearCache();
    await loadBonusQuestions(currentGameForBonus);
    alert("Bónusspurning bætt við!");
  } catch (error) {
    handleError(error, "Villa við að bæta við bónusspurningu");
  } finally {
    showLoading(false);
  }
});

async function loadBonusQuestions(gameId) {
  const container = document.getElementById("bonusQuestionsList");
  container.innerHTML = "<p>Hleð spurningum...</p>";
  
  try {
    const data = await fetchLeagueData(activeLeagueId);
    const questions = data.bonusQuestions.filter(q => q.gameId === gameId);
    
    if (questions.length === 0) {
      container.innerHTML = "<p>Engar bónusspurningar fyrir þennan leik</p>";
      return;
    }
    
    container.innerHTML = "";
    
    for (let q of questions) {
      const div = document.createElement("div");
      div.style.cssText = "background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea;";
      
      let typeLabel = {
        text: "Texti",
        yesNo: "Já/Nei",
        number: "Tala",
        multipleChoice: "Fjölval"
      }[q.type];
      
      div.innerHTML = `
        <strong>${q.question}</strong><br>
        <small>Tegund: ${typeLabel} | Stig: ${q.points}</small><br>
        ${q.options ? `<small>Valmöguleikar: ${q.options.join(", ")}</small><br>` : ''}
        ${q.correctAnswer ? `<small style="color: green;">Rétt svar: ${q.correctAnswer}</small><br>` : '<small style="color: orange;">Rétt svar ekki sett</small><br>'}
        <button onclick="setBonusAnswer('${q.id}')">Setja rétt svar</button>
        <button onclick="deleteBonusQuestion('${q.id}')" style="background: #dc3545;">Eyða</button>
      `;
      container.appendChild(div);
    }
  } catch (error) {
    handleError(error, "Villa við að hlaða bónusspurningum");
    container.innerHTML = "<p>Villa við að hlaða spurningar</p>";
  }
}

window.setBonusAnswer = async (questionId) => {
  const answer = prompt("Hvað er rétta svarið?");
  if (!answer) return;
  
  showLoading(true);
  try {
    await updateDoc(doc(db, "bonusQuestions", questionId), {
      correctAnswer: answer.trim()
    });
    
    clearCache();
    await loadBonusQuestions(currentGameForBonus);
    await updateBonusPoints(currentGameForBonus);
    alert("Rétt svar sett og stig uppfærð!");
  } catch (error) {
    handleError(error, "Villa við að setja rétt svar");
  } finally {
    showLoading(false);
  }
};

window.deleteBonusQuestion = async (questionId) => {
  if (!confirm("Ertu viss um að þú viljir eyða þessari spurningu?")) return;
  
  showLoading(true);
  try {
    const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", questionId)));
    
    const batch = writeBatch(db);
    answersSnap.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    batch.delete(doc(db, "bonusQuestions", questionId));
    await batch.commit();
    
    clearCache();
    await loadBonusQuestions(currentGameForBonus);
    await recalculateAllPoints();
    alert("Spurningu eytt!");
  } catch (error) {
    handleError(error, "Villa við að eyða spurningu");
  } finally {
    showLoading(false);
  }
};

async function updateBonusPoints(gameId) {
  try {
    const data = await fetchLeagueData(activeLeagueId);
    const questions = data.bonusQuestions.filter(q => q.gameId === gameId && q.correctAnswer);
    
    const batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 500;
    
    for (let question of questions) {
      const answers = data.bonusAnswers.filter(a => a.questionId === question.id);
      
      for (let answer of answers) {
        let points = 0;
        
        if (question.type === "number") {
          if (parseInt(answer.answer) === parseInt(question.correctAnswer)) {
            points = question.points;
          }
        } else {
          if (answer.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()) {
            points = question.points;
          }
        }
        
        batch.update(doc(db, "bonusAnswers", answer.id), { points });
        batchCount++;
        
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    clearCache();
    await recalculateAllPoints();
  } catch (error) {
    console.error("Villa við að uppfæra bónusstig:", error);
    throw error;
  }
}

async function recalculateAllPoints() {
  try {
    const data = await fetchLeagueData(activeLeagueId);
    
    const batch = writeBatch(db);
    
    for (let member of data.members) {
      const userId = member.userId;
      
      const userTips = data.tips.filter(tip => tip.userId === userId);
      let totalPoints = userTips.reduce((sum, tip) => sum + (tip.points || 0), 0);
      
      const userBonusAnswers = data.bonusAnswers.filter(a => a.userId === userId);
      totalPoints += userBonusAnswers.reduce((sum, a) => sum + (a.points || 0), 0);
      
      batch.update(doc(db, "leagueMembers", member.id), { 
        points: totalPoints,
        lastUpdated: Timestamp.now()
      });
    }
    
    await batch.commit();
    clearCache();
    await loadAllLeagueData();
  } catch (error) {
    console.error("Villa við að endurreikna stig:", error);
    throw error;
  }
}

/* =========================
   RENDER GAMES
========================= */
async function renderGames(data) {
  const list = document.getElementById("gamesList");
  const resultSelect = document.getElementById("resultGameSelect");
  const bonusSelect = document.getElementById("bonusGameSelect");
  const deleteSelect = document.getElementById("deleteGameSelect");
  
  list.innerHTML = "";
  resultSelect.innerHTML = '<option value="">Veldu leik</option>';
  bonusSelect.innerHTML = '<option value="">Veldu leik</option>';
  deleteSelect.innerHTML = '<option value="">Veldu leik til að eyða</option>';

  if (data.games.length === 0) {
    list.innerHTML = "<li>Engir leikir í þessari deild</li>";
    return;
  }
  
  const games = [...data.games].sort((a, b) => {
    if (!a.gameTime && !b.gameTime) return 0;
    if (!a.gameTime) return 1;
    if (!b.gameTime) return -1;
    return a.gameTime.toMillis() - b.gameTime.toMillis();
  });
  
  const tipsMap = new Map();
  data.tips.forEach(tip => {
    const key = `${tip.gameId}_${tip.userId}`;
    tipsMap.set(key, tip);
  });
  
  const membersMap = new Map();
  data.members.forEach(member => {
    membersMap.set(member.userId, member);
  });
  
  const bonusQuestionsMap = new Map();
  data.bonusQuestions.forEach(q => {
    if (!bonusQuestionsMap.has(q.gameId)) {
      bonusQuestionsMap.set(q.gameId, []);
    }
    bonusQuestionsMap.get(q.gameId).push(q);
  });
  
  const bonusAnswersMap = new Map();
  data.bonusAnswers.forEach(a => {
    if (!bonusAnswersMap.has(a.questionId)) {
      bonusAnswersMap.set(a.questionId, []);
    }
    bonusAnswersMap.get(a.questionId).push(a);
  });
  
  let hasShownUpcomingHeader = false;
  let hasShownPastHeader = false;

  for (let game of games) {
    const canUserTip = canTip(game.gameTime);
    const gameStarted = hasGameStarted(game.gameTime);
    const timeInfo = game.gameTime ? getTimeUntilGame(game.gameTime) : "";
    
    if (!gameStarted && !hasShownUpcomingHeader && game.gameTime) {
      const headerLi = document.createElement("li");
      headerLi.style.cssText = "background: #4CAF50; color: white; font-weight: bold; padding: 10px; margin: 20px 0 10px 0; border-radius: 5px; text-align: center;";
      headerLi.innerHTML = "⚽ KOMANDI LEIKIR";
      list.appendChild(headerLi);
      hasShownUpcomingHeader = true;
    }
    
    if (gameStarted && !hasShownPastHeader) {
      const headerLi = document.createElement("li");
      headerLi.style.cssText = "background: #9E9E9E; color: white; font-weight: bold; padding: 10px; margin: 20px 0 10px 0; border-radius: 5px; text-align: center;";
      headerLi.innerHTML = "📋 LIÐNIR LEIKIR";
      list.appendChild(headerLi);
      hasShownPastHeader = true;
    }
    
    const li = document.createElement("li");
    
    let html = `
      <strong>${game.homeTeam} vs ${game.awayTeam}</strong><br>
      ${game.gameTime ? `<small>${formatDateTime(game.gameTime)} (${timeInfo})</small><br>` : ''}
    `;
    
    if (gameStarted) {
      const gameTips = data.tips.filter(tip => tip.gameId === game.id);
      
      if (gameTips.length > 0) {
        html += `<div style="margin-top: 10px; padding: 10px; background: #f0f4ff; border-radius: 5px;">
          <strong>Tipp:</strong><br>`;
        
        for (let tip of gameTips) {
          const member = membersMap.get(tip.userId);
          const username = member ? member.username : "Óþekktur";
          const isCurrentUser = tip.userId === auth.currentUser.uid;
          
          html += `<small style="${isCurrentUser ? 'font-weight: bold; color: #667eea;' : ''}">${username}: ${tip.prediction}${tip.points > 0 ? ` (${tip.points} stig)` : ''}</small><br>`;
        }
        
        html += `</div>`;
      }
      
      if (game.result) {
        html += `<div style="margin-top: 10px;"><strong style="color: green;">Úrslit: ${game.result}</strong></div>`;
      }
      
      html += renderBonusAnswersForGame(game.id, bonusQuestionsMap, bonusAnswersMap, membersMap);
    } else {
      const existingTip = tipsMap.get(`${game.id}_${auth.currentUser.uid}`);
      
      let homeValue = '';
      let awayValue = '';
      let buttonText = 'Tippa';
      
      if (existingTip) {
        const [home, away] = existingTip.prediction.split('-');
        homeValue = home;
        awayValue = away;
        buttonText = 'Uppfæra tip';
      }
      
      html += `
        <div style="margin-top: 10px;">
          ${existingTip ? `<div style="background: #e8f5e9; padding: 8px; border-radius: 5px; margin-bottom: 8px;">
            <strong style="color: #2e7d32;">✓ Þitt tip: ${existingTip.prediction}</strong>
            ${canUserTip ? '<br><small>Þú getur breytt þessu hvenær sem er</small>' : ''}
          </div>` : ''}
          <input id="tipHome_${game.id}" type="number" placeholder="${game.homeTeam}" 
            value="${homeValue}" style="width: 60px;" ${!canUserTip ? 'disabled' : ''}>
          <span style="margin: 0 5px;">-</span>
          <input id="tipAway_${game.id}" type="number" placeholder="${game.awayTeam}" 
            value="${awayValue}" style="width: 60px;" ${!canUserTip ? 'disabled' : ''}>
          <button id="tipBtn_${game.id}" ${!canUserTip ? 'disabled' : ''}>${buttonText}</button>
          ${!canUserTip ? '<br><span style="color: red;">Of seint að tippa</span>' : ''}
        </div>
      `;
      
      html += renderBonusQuestionsForGame(game.id, canUserTip, bonusQuestionsMap, bonusAnswersMap);
    }
    
    li.innerHTML = html;
    list.appendChild(li);
    
    if (!gameStarted) {
      document.getElementById(`tipBtn_${game.id}`)?.addEventListener('click', () => submitTip(game.id));
      attachBonusEventListenersForGame(game.id, bonusQuestionsMap);
    }

    const opt = document.createElement("option");
    opt.value = game.id;
    const dateStr = game.gameTime ? formatDateTime(game.gameTime).split(' kl.')[0] : 'Engin tími';
    opt.textContent = `${dateStr} - ${game.homeTeam} vs ${game.awayTeam}`;
    resultSelect.appendChild(opt);
    bonusSelect.appendChild(opt.cloneNode(true));
    deleteSelect.appendChild(opt.cloneNode(true));
  }
}

async function loadGames() {
  const data = await fetchLeagueData(activeLeagueId);
  await renderGames(data);
}

function renderBonusQuestionsForGame(gameId, canAnswer, bonusQuestionsMap, bonusAnswersMap) {
  const questions = bonusQuestionsMap.get(gameId) || [];
  
  if (questions.length === 0) return "";
  
  let html = `<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
    <strong>🎁 Bónusspurningar:</strong><br><br>`;
  
  for (let q of questions) {
    const userAnswers = (bonusAnswersMap.get(q.id) || []).filter(a => a.userId === auth.currentUser.uid);
    const existingAnswer = userAnswers.length > 0 ? userAnswers[0].answer : "";
    
    html += `<div style="margin-bottom: 15px;">
      <strong>${q.question}</strong> <small>(${q.points} stig)</small><br>`;
    
    if (q.type === "text" || q.type === "number") {
      html += `<input id="bonus_${q.id}" type="${q.type === 'number' ? 'number' : 'text'}" 
        placeholder="Svarið þitt" value="${existingAnswer}" ${!canAnswer ? 'disabled' : ''}>`;
    } else if (q.type === "yesNo") {
      html += `
        <select id="bonus_${q.id}" ${!canAnswer ? 'disabled' : ''}>
          <option value="">Veldu</option>
          <option value="Já" ${existingAnswer === 'Já' ? 'selected' : ''}>Já</option>
          <option value="Nei" ${existingAnswer === 'Nei' ? 'selected' : ''}>Nei</option>
        </select>`;
    } else if (q.type === "multipleChoice" && q.options) {
      html += `<select id="bonus_${q.id}" ${!canAnswer ? 'disabled' : ''}>
        <option value="">Veldu</option>`;
      q.options.forEach(opt => {
        html += `<option value="${opt}" ${existingAnswer === opt ? 'selected' : ''}>${opt}</option>`;
      });
      html += `</select>`;
    }
    
    html += `<button id="bonusBtn_${q.id}" ${!canAnswer ? 'disabled' : ''}>Vista svar</button>
      ${existingAnswer ? `<small style="color: green;"> ✓ Þú hefur svarað: ${existingAnswer}</small>` : ''}
    </div>`;
  }
  
  html += `${!canAnswer ? '<small style="color: red;">Of seint að svara bónusspurningum</small>' : ''}</div>`;
  
  return html;
}

function renderBonusAnswersForGame(gameId, bonusQuestionsMap, bonusAnswersMap, membersMap) {
  const questions = bonusQuestionsMap.get(gameId) || [];
  
  if (questions.length === 0) return "";
  
  let html = `<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
    <strong>🎁 Bónusspurningar:</strong><br><br>`;
  
  for (let q of questions) {
    html += `<div style="margin-bottom: 15px;">
      <strong>${q.question}</strong><br>`;
    
    if (q.correctAnswer) {
      html += `<small style="color: green;">Rétt svar: ${q.correctAnswer}</small><br>`;
    }
    
    const answers = bonusAnswersMap.get(q.id) || [];
    
    if (answers.length > 0) {
      html += `<small>Svör:</small><br>`;
      for (let answer of answers) {
        const member = membersMap.get(answer.userId);
        const username = member ? member.username : "Óþekktur";
        const isCurrentUser = answer.userId === auth.currentUser.uid;
        const isCorrect = q.correctAnswer && answer.answer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
        
        html += `<small style="${isCurrentUser ? 'font-weight: bold; color: #667eea;' : ''}">${username}: ${answer.answer}${isCorrect ? ' ✓' : ''}${answer.points > 0 ? ` (+${answer.points} stig)` : ''}</small><br>`;
      }
    }
    
    html += `</div>`;
  }
  
  html += `</div>`;
  
  return html;
}

function attachBonusEventListenersForGame(gameId, bonusQuestionsMap) {
  const questions = bonusQuestionsMap.get(gameId) || [];
  
  for (let q of questions) {
    const btn = document.getElementById(`bonusBtn_${q.id}`);
    if (btn) {
      btn.addEventListener('click', () => submitBonusAnswer(q.id, gameId));
    }
  }
}

async function submitBonusAnswer(questionId, gameId) {
  const input = document.getElementById(`bonus_${questionId}`);
  if (!input) return;
  
  const answer = input.value.trim();
  if (!answer) return alert("Settu inn svar!");
  
  showLoading(true);
  try {
    const data = await fetchLeagueData(activeLeagueId);
    const game = data.games.find(g => g.id === gameId);
    
    if (game && !canTip(game.gameTime)) {
      alert("Of seint að svara bónusspurningu!");
      return;
    }
    
    const answerId = `${questionId}_${auth.currentUser.uid}`;
    
    await setDoc(doc(db, "bonusAnswers", answerId), {
      questionId: questionId,
      gameId: gameId,
      leagueId: activeLeagueId,
      userId: auth.currentUser.uid,
      answer: answer,
      points: 0,
      answeredAt: Timestamp.now()
    });
    
    clearCache();
    alert("Svar vistað!");
    await loadAllLeagueData();
  } catch (error) {
    handleError(error, "Villa við að vista svar");
  } finally {
    showLoading(false);
  }
}

async function submitTip(gameId) {
  const homeInput = document.getElementById(`tipHome_${gameId}`);
  const awayInput = document.getElementById(`tipAway_${gameId}`);
  
  if (!homeInput || !awayInput) return;
  
  const homeScore = homeInput.value;
  const awayScore = awayInput.value;
  
  if (!homeScore || !awayScore) return alert("Skráðu skor fyrir bæði lið!");
  
  const prediction = `${homeScore}-${awayScore}`;
  
  showLoading(true);
  try {
    const data = await fetchLeagueData(activeLeagueId);
    const game = data.games.find(g => g.id === gameId);
    
    if (game && !canTip(game.gameTime)) {
      alert("Of seint að tippa á þennan leik!");
      return;
    }
    
    const existingTip = data.tips.find(t => t.gameId === gameId && t.userId === auth.currentUser.uid);
    const isUpdate = !!existingTip;

    await setDoc(doc(db, "tips", `${gameId}_${auth.currentUser.uid}`), {
      gameId,
      leagueId: activeLeagueId,
      userId: auth.currentUser.uid,
      prediction,
      points: 0,
      tippedAt: Timestamp.now()
    });

    clearCache();
    alert(isUpdate ? "Tip uppfært! ✓" : "Tip skráð! ✓");
    await loadAllLeagueData();
  } catch (error) {
    handleError(error, "Villa við að skrá tip");
  } finally {
    showLoading(false);
  }
}

/* =========================
   ADMIN ACTIONS
========================= */
document.getElementById("createGameAdminBtn")?.addEventListener("click", async () => {
  const home = document.getElementById("adminHomeTeam").value.trim();
  const away = document.getElementById("adminAwayTeam").value.trim();
  const datetime = document.getElementById("adminGameTime").value;
  
  if (!home || !away) return alert("Settu lið!");
  if (!datetime) return alert("Settu tímasetningu á leik!");
  if (home === away) return alert("Lið geta ekki verið eins!");

  showLoading(true);
  try {
    const gameTime = Timestamp.fromDate(new Date(datetime));

    await addDoc(collection(db, "games"), {
      leagueId: activeLeagueId,
      homeTeam: home,
      awayTeam: away,
      gameTime: gameTime,
      result: null,
      createdAt: Timestamp.now()
    });

    document.getElementById("adminHomeTeam").value = "";
    document.getElementById("adminAwayTeam").value = "";
    document.getElementById("adminGameTime").value = "";
    
    clearCache();
    await loadAllLeagueData();
    alert("Leikur búinn til");
  } catch (error) {
    handleError(error, "Villa við að búa til leik");
  } finally {
    showLoading(false);
  }
});

document.getElementById("deleteGameBtn")?.addEventListener("click", async () => {
  const gameId = document.getElementById("deleteGameSelect").value;
  if (!gameId) return alert("Veldu leik til að eyða!");
  
  if (!confirm("Ertu viss um að þú viljir eyða þessum leik? Öll tipp og bónusspurningar verða einnig eytt.")) return;
  
  showLoading(true);
  try {
    const batch = writeBatch(db);
    
    const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
    tipsSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    
    const bonusQSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
    for (let qDoc of bonusQSnap.docs) {
      const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
      answersSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
      batch.delete(qDoc.ref);
    }
    
    batch.delete(doc(db, "games", gameId));
    
    await batch.commit();
    
    clearCache();
    await recalculateAllPoints();
    
    alert("Leik eytt!");
  } catch (error) {
    handleError(error, "Villa við að eyða leik");
  } finally {
    showLoading(false);
  }
});

document.getElementById("viewMembersBtn")?.addEventListener("click", async () => {
  const container = document.getElementById("membersList");
  container.innerHTML = "<p>Hleð notendum...</p>";
  container.style.display = "block";
  
  try {
    const data = await fetchLeagueData(activeLeagueId);
    
    if (data.members.length === 0) {
      container.innerHTML = "<p>Engir notendur í deild</p>";
      return;
    }
    
    const ownerId = data.league?.ownerId;
    
    container.innerHTML = "";
    
    for (let member of data.members) {
      const isOwner = member.userId === ownerId;
      
      const div = document.createElement("div");
      div.style.cssText = "padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;";
      
      div.innerHTML = `
        <div>
          <strong>${member.username}</strong>
          ${isOwner ? '<span style="color: #ffc107; margin-left: 10px;">👑 Stjórnandi</span>' : ''}
          <br><small style="color: #666;">${member.points} stig</small>
        </div>
        ${!isOwner ? `<button onclick="removeMember('${member.id}', '${member.username}')" style="background: #dc3545; padding: 8px 16px;">Fjarlægja</button>` : ''}
      `;
      
      container.appendChild(div);
    }
  } catch (error) {
    handleError(error, "Villa við að hlaða notendum");
    container.innerHTML = "<p>Villa við að hlaða notendur</p>";
  }
});

window.removeMember = async (memberId, username) => {
  if (!confirm(`Ertu viss um að þú viljir fjarlægja ${username} úr deildinni?`)) return;
  
  showLoading(true);
  try {
    const memberDoc = await getDoc(doc(db, "leagueMembers", memberId));
    if (!memberDoc.exists()) {
      alert("Notandi fannst ekki");
      return;
    }
    
    const userId = memberDoc.data().userId;
    
    const batch = writeBatch(db);
    
    const tipsSnap = await getDocs(query(
      collection(db, "tips"),
      where("userId", "==", userId),
      where("leagueId", "==", activeLeagueId)
    ));
    tipsSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    
    const answersSnap = await getDocs(query(
      collection(db, "bonusAnswers"),
      where("userId", "==", userId),
      where("leagueId", "==", activeLeagueId)
    ));
    answersSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    
    batch.delete(doc(db, "leagueMembers", memberId));
    
    await batch.commit();
    
    clearCache();
    alert(`${username} hefur verið fjarlægður úr deildinni`);
    
    document.getElementById("viewMembersBtn").click();
    await loadAllLeagueData();
  } catch (error) {
    handleError(error, "Villa við að fjarlægja notanda");
  } finally {
    showLoading(false);
  }
};

document.getElementById("deleteLeagueBtn")?.addEventListener("click", async () => {
  const data = await fetchLeagueData(activeLeagueId);
  
  if (!data.league) {
    alert("Deild fannst ekki");
    return;
  }
  
  const leagueName = data.league.name;
  
  const confirmation = prompt(`VIÐVÖRUN: Þetta eyðir ÖLLU í deildinni "${leagueName}".\n\nSkrifaðu "EYÐA" til að staðfesta:`);
  
  if (confirmation !== "EYÐA") {
    alert("Hætt við");
    return;
  }
  
  showLoading(true);
  try {
    for (let game of data.games) {
      const batch = writeBatch(db);
      let batchCount = 0;
      
      const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", game.id)));
      tipsSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        batchCount++;
      });
      
      const bonusQSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", game.id)));
      for (let qDoc of bonusQSnap.docs) {
        const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
        answersSnap.docs.forEach(docSnap => {
          batch.delete(docSnap.ref);
          batchCount++;
        });
        batch.delete(qDoc.ref);
        batchCount++;
      }
      
      batch.delete(doc(db, "games", game.id));
      batchCount++;
      
      if (batchCount > 0) {
        await batch.commit();
      }
    }
    
    const batch = writeBatch(db);
    const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
    membersSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    
    batch.delete(doc(db, "leagues", activeLeagueId));
    
    await batch.commit();
    
    alert(`Deild "${leagueName}" hefur verið eytt`);
    
    clearCache();
    saveActiveLeague(null);
    location.reload();
  } catch (error) {
    handleError(error, "Villa við að eyða deild");
  } finally {
    showLoading(false);
  }
});

document.getElementById("setResultBtn")?.addEventListener("click", async () => {
  const gameId = document.getElementById("resultGameSelect").value;
  const homeScore = document.getElementById("resultScoreHome").value;
  const awayScore = document.getElementById("resultScoreAway").value;
  
  if (!gameId) return alert("Veldu leik!");
  if (!homeScore || !awayScore) return alert("Settu skor fyrir bæði lið!");
  
  const result = `${homeScore}-${awayScore}`;

  showLoading(true);
  try {
    await updateDoc(doc(db, "games", gameId), { 
      result,
      resultSetAt: Timestamp.now()
    });
    
    await loadLeagueSettings();

    const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
    const batch = writeBatch(db);
    
    for (let t of tipsSnap.docs) {
      const tipData = t.data();
      const points = calculatePoints(tipData.prediction, result, currentLeagueSettings);
      batch.update(t.ref, { points });
    }
    
    await batch.commit();

    document.getElementById("resultScoreHome").value = "";
    document.getElementById("resultScoreAway").value = "";

    clearCache();
    await updateBonusPoints(gameId);
    alert("Úrslit og stig uppfærð");
  } catch (error) {
    handleError(error, "Villa við að setja úrslit");
  } finally {
    showLoading(false);
  }
});

document.getElementById("bonusQuestionType")?.addEventListener("change", (e) => {
  const optionsDiv = document.getElementById("bonusOptionsDiv");
  if (optionsDiv) {
    optionsDiv.style.display = e.target.value === "multipleChoice" ? "block" : "none";
  }
});

/* =========================
   RENDER SCORES
========================= */
async function renderScores(data) {
  const ul = document.getElementById("leagueScores");
  
  if (data.members.length === 0) {
    ul.innerHTML = "<li>Engir notendur í deild</li>";
    return;
  }
  
  const sortedMembers = [...data.members].sort((a, b) => b.points - a.points);

  ul.innerHTML = "";
  
  for (let member of sortedMembers) {
    const li = document.createElement("li");
    li.textContent = `${member.username} – ${member.points} stig`;
    ul.appendChild(li);
  }
}

async function loadScores() {
  const data = await fetchLeagueData(activeLeagueId);
  await renderScores(data);
}

/* =========================
   AUTH
========================= */
onAuthStateChanged(auth, async user => { 
  if (user) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("loggedInSection").style.display = "block";
    document.getElementById("loggedInEmail").textContent = user.email;
    
    requestNotificationPermission().then(granted => {
      if (granted) {
        console.log("✅ Tilkynningar virkar");
      }
    });
    
    try {
      const memberSnap = await getDocs(query(collection(db, "leagueMembers"), where("userId", "==", user.uid)));
      
      if (memberSnap.empty) {
        const username = prompt("Veldu notendanafn:") || user.displayName || user.email.split("@")[0];
        document.getElementById("loggedInUsername").textContent = username;
        document.getElementById("username").value = username;
      } else {
        const username = memberSnap.docs[0].data().username;
        document.getElementById("loggedInUsername").textContent = username;
        document.getElementById("username").value = username;
      }
      
      await loadUserLeagues();
      startNotificationChecks();
    } catch (error) {
      handleError(error, "Villa við að hlaða notendaupplýsingum");
    }
  } else {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("loggedInSection").style.display = "none";
    stopNotificationChecks();
  }
});