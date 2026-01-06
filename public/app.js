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
  writeBatch,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let activeLeagueId = null;
let currentLeagueSettings = null;
let currentGameForBonus = null;
// GOOGLE SHEETS INTEGRATION - UPPFÆRT MEÐ LEIT OG PAGINATION
const SHEET_ID = '15LQbx0CbACqEgtPpb5IC_EK3aJRavGoKgv7BFo7t9bA';
const SHEET_NAME = 'Sheet1';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

let availableGamesFromSheet = [];
let filteredGamesFromSheet = [];
let displayedGamesCount = 0;
const GAMES_PER_PAGE = 5;

// Sækja leiki úr Google Sheets - LAGAÐ FYRIR DATE OBJECTS
async function fetchGamesFromSheet() {
  try {
    const response = await fetch(SHEET_URL);
    const text = await response.text();
    
    const jsonString = text.substring(47).slice(0, -2);
    const json = JSON.parse(jsonString);
    
    const rows = json.table.rows;
    const games = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].c;
      
      if (!row[0] || !row[1] || !row[2]) continue;
      
      const homeTeam = row[0]?.v || '';
      const awayTeam = row[1]?.v || '';
      const gameTimeRaw = row[2]?.v || '';
      const competition = row[3]?.v || 'EM Handbolta';
      
      // Parse dagsetninguna - Google Sheets skilar Date(YYYY,M,D,H,M,S) format
      let gameTimeStr = gameTimeRaw;
      
      // Athuga hvort þetta er Date() format frá Google
      if (typeof gameTimeRaw === 'string' && gameTimeRaw.startsWith('Date(')) {
        try {
          // Extract tölurnar úr Date(2026,0,16,17,0,0)
          const match = gameTimeRaw.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
          if (match) {
            const year = match[1];
            const month = String(parseInt(match[2]) + 1).padStart(2, '0'); // Google notar 0-indexed mánuði
            const day = String(match[3]).padStart(2, '0');
            const hour = String(match[4]).padStart(2, '0');
            const minute = String(match[5]).padStart(2, '0');
            
            // Búa til lesanlegt format
            gameTimeStr = `${year}-${month}-${day} ${hour}:${minute}`;
          }
        } catch (e) {
          console.error('Gat ekki parsed Date format:', gameTimeRaw);
        }
      }
      
      if (homeTeam && awayTeam && gameTimeStr) {
        games.push({
          homeTeam,
          awayTeam,
          gameTime: gameTimeStr,
          gameTimeRaw: gameTimeRaw, // Vista upprunalega fyrir debug
          competition
        });
      }
    }
    
    availableGamesFromSheet = games;
    filteredGamesFromSheet = games;
    return games;
  } catch (error) {
    console.error("Villa við að sækja leiki úr Google Sheets:", error);
    return [];
  }
}

// Leita í leikjum
function searchGamesFromSheet(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  
  if (term === '') {
    filteredGamesFromSheet = [...availableGamesFromSheet];
  } else {
    filteredGamesFromSheet = availableGamesFromSheet.filter(game => {
      return (
        game.homeTeam.toLowerCase().includes(term) ||
        game.awayTeam.toLowerCase().includes(term) ||
        game.gameTime.toLowerCase().includes(term) ||
        game.competition.toLowerCase().includes(term)
      );
    });
  }
  
  displayedGamesCount = 0;
  displayGamesFromSheet();
}

// Sýna leiki með pagination
function displayGamesFromSheet() {
  const container = document.getElementById('availableGamesList');
  if (!container) return;
  
  if (displayedGamesCount === 0) {
    container.innerHTML = '';
  }
  
  const gamesToShow = filteredGamesFromSheet.slice(
    displayedGamesCount,
    displayedGamesCount + GAMES_PER_PAGE
  );
  
  if (gamesToShow.length === 0 && displayedGamesCount === 0) {
    container.innerHTML = "<p style='padding: 15px; text-align: center; color: #666;'>Engir leikir fundust</p>";
    return;
  }
  
  for (let i = 0; i < gamesToShow.length; i++) {
    const game = gamesToShow[i];
    
    const div = document.createElement("div");
    div.style.cssText = `
      background: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 2px solid var(--border);
      transition: all 0.3s ease;
      cursor: pointer;
    `;
    
    const displayDate = game.gameTime;
    
    div.innerHTML = `
      <div style="flex: 1;">
        <strong style="font-size: 1.05rem; color: var(--dark);">${game.homeTeam} vs ${game.awayTeam}</strong><br>
        <small style="color: #666;">📅 ${displayDate}</small><br>
        <small style="color: #667eea;">📋 ${game.competition}</small>
      </div>
      <button onclick="addGameFromSheet(${availableGamesFromSheet.indexOf(game)})" 
        style="padding: 10px 20px; margin: 0; white-space: nowrap;">
        ➕ Bæta við
      </button>
    `;
    
    div.onmouseover = () => {
      div.style.borderColor = 'var(--primary)';
      div.style.transform = 'translateX(5px)';
      div.style.boxShadow = 'var(--shadow)';
    };
    
    div.onmouseout = () => {
      div.style.borderColor = 'var(--border)';
      div.style.transform = 'translateX(0)';
      div.style.boxShadow = 'none';
    };
    
    container.appendChild(div);
  }
  
  displayedGamesCount += gamesToShow.length;
  
  if (displayedGamesCount < filteredGamesFromSheet.length) {
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.id = 'loadMoreIndicator';
    loadMoreDiv.style.cssText = `
      text-align: center;
      padding: 15px;
      color: #667eea;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    loadMoreDiv.innerHTML = `
      👇 Skrollaðu niður til að sjá fleiri leiki 
      <br><small style="color: #666;">(Sýni ${displayedGamesCount} af ${filteredGamesFromSheet.length})</small>
    `;
    
    loadMoreDiv.onclick = () => {
      displayGamesFromSheet();
    };
    
    container.appendChild(loadMoreDiv);
  }
}

// Infinite scroll
function setupInfiniteScrollForGames() {
  const container = document.getElementById('availableGamesContainer');
  if (!container) return;
  
  container.addEventListener('scroll', () => {
    const scrollPosition = container.scrollTop + container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    if (scrollPosition >= scrollHeight - 50) {
      if (displayedGamesCount < filteredGamesFromSheet.length) {
        const loadMoreIndicator = document.getElementById('loadMoreIndicator');
        if (loadMoreIndicator) {
          loadMoreIndicator.remove();
        }
        displayGamesFromSheet();
      }
    }
  });
}

// Sýna leiki frá Google Sheets
async function showAvailableGames() {
  const container = document.getElementById('availableGamesList');
  const outerContainer = document.getElementById('availableGamesContainer');
  
  if (!container || !outerContainer) return;
  
  container.innerHTML = "<p style='padding: 15px; text-align: center;'>Hleð leikjum úr Google Sheets...</p>";
  outerContainer.style.display = 'block';
  
  try {
    const games = await fetchGamesFromSheet();
    
    if (games.length === 0) {
      container.innerHTML = "<p style='padding: 15px; text-align: center; color: #666;'>Engir leikir fundust í Google Sheet</p>";
      return;
    }
    
    displayedGamesCount = 0;
    filteredGamesFromSheet = [...games];
    
    displayGamesFromSheet();
    setupInfiniteScrollForGames();
    
  } catch (error) {
    handleError(error, "Villa við að sýna leiki");
    container.innerHTML = "<p style='padding: 15px; text-align: center; color: #dc3545;'>Villa við að hlaða leikjum</p>";
  }
}

// Bæta leik við deild úr Google Sheet - LAGAÐ FYRIR DATE OBJECTS
window.addGameFromSheet = async (index) => {
  const game = availableGamesFromSheet[index];
  if (!game) return alert("Leikur fannst ekki!");
  
  showLoading(true);
  try {
    let gameDate;
    const gameTimeStr = game.gameTime.trim();
    
    console.log('Reyni að parse:', gameTimeStr);
    
    // Ef þetta er Date() format frá Google
    if (game.gameTimeRaw && game.gameTimeRaw.startsWith('Date(')) {
      const match = game.gameTimeRaw.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
      if (match) {
        gameDate = new Date(
          parseInt(match[1]), // year
          parseInt(match[2]), // month (Google notar 0-indexed)
          parseInt(match[3]), // day
          parseInt(match[4]), // hour
          parseInt(match[5]), // minute
          parseInt(match[6])  // second
        );
      }
    }
    
    // Fallback: Reyna að parse streng
    if (!gameDate || isNaN(gameDate.getTime())) {
      if (gameTimeStr.includes('/')) {
        const parts = gameTimeStr.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        
        const dateParts = datePart.split('/');
        const timeParts = timePart.split(':');
        
        gameDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2]),
          parseInt(timeParts[0]),
          parseInt(timeParts[1])
        );
      } else if (gameTimeStr.includes('-')) {
        const parts = gameTimeStr.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        
        const dateParts = datePart.split('-');
        const timeParts = timePart.split(':');
        
        gameDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2]),
          parseInt(timeParts[0]),
          parseInt(timeParts[1])
        );
      } else {
        gameDate = new Date(gameTimeStr);
      }
    }
    
    console.log('Parsed date:', gameDate);
    
    if (isNaN(gameDate.getTime())) {
      alert(`Villa: Gat ekki lesið dagsetningu: "${gameTimeStr}"`);
      console.error('Raw:', game.gameTimeRaw);
      showLoading(false);
      return;
    }
    
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
    console.error("Full error:", error);
    console.error("Game data:", game);
    handleError(error, "Villa við að bæta leik við");
  } finally {
    showLoading(false);
  }
};
// Event listener fyrir leitarreit
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('gameSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchGamesFromSheet(e.target.value);
    });
  }
});

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
   CHAT SYSTEM
========================= */
let chatListener = null;
const MESSAGE_LIMIT = 50;

// Import onSnapshot fyrir real-time
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Send message
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  if (!activeLeagueId || !auth.currentUser) return alert("Þú verður að vera í deild!");
  
  const username = document.getElementById("username")?.value || "Óþekktur";
  
  // Rate limiting - max 10 messages per minute
  const oneMinuteAgo = Timestamp.fromMillis(Date.now() - 60000);
  const userMessages = await getDocs(query(
    collection(db, "messages"),
    where("userId", "==", auth.currentUser.uid),
    where("leagueId", "==", activeLeagueId),
    where("timestamp", ">", oneMinuteAgo)
  ));
  
  if (userMessages.size >= 10) {
    return alert("Of mörg skilaboð! Bíddu aðeins.");
  }
  
  try {
    // Optimistic UI - sýna skilaboðið strax
    const tempMsg = {
      username: username,
      message: message,
      timestamp: Timestamp.now(),
      userId: auth.currentUser.uid,
      optimistic: true
    };
    
    appendMessage(tempMsg);
    input.value = "";
    updateCharCount();
    
    // Send to Firestore
    await addDoc(collection(db, "messages"), {
      leagueId: activeLeagueId,
      userId: auth.currentUser.uid,
      username: username,
      message: message,
      timestamp: Timestamp.now()
    });
    
  } catch (error) {
    handleError(error, "Villa við að senda skilaboð");
  }
}

// Load and listen to messages
function loadChatMessages() {
  if (!activeLeagueId) {
    document.getElementById('chatCard').style.display = 'none';
    return;
  }
  
  // Unsubscribe eldri listener
  if (chatListener) {
    chatListener();
  }
  
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  container.innerHTML = '<p style="text-align: center; color: #666;">Hleð skilaboðum...</p>';
  
  // Query fyrir nýjustu skilaboðin
  const q = query(
    collection(db, "messages"),
    where("leagueId", "==", activeLeagueId),
    orderBy("timestamp", "desc"),
    limit(MESSAGE_LIMIT)
  );
  
  // Real-time listener
  chatListener = onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #666;">Engin skilaboð ennþá. Vertu fyrstur til að skrifa! 👋</p>';
      document.getElementById('messageCount').textContent = "0";
      return;
    }
    
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    
    // Reverse til að fá elstu efst
    messages.reverse();
    
    messages.forEach(msg => {
      if (!msg.optimistic) { // Skip optimistic messages (already shown)
        appendMessage(msg);
      }
    });
    
    document.getElementById('messageCount').textContent = messages.length;
    
    // Scroll niður að nýjasta skilaboði
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
    
  }, (error) => {
    console.error("Villa við að hlaða skilaboðum:", error);
    container.innerHTML = '<p style="text-align: center; color: #dc3545;">Villa við að hlaða skilaboð</p>';
  });
}

// Append single message to UI
function appendMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const isOwnMessage = msg.userId === auth.currentUser.uid;
  
  const div = document.createElement('div');
  div.style.cssText = `
    padding: 10px 14px;
    margin: 8px 0;
    border-radius: 16px;
    background: ${isOwnMessage ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
    color: ${isOwnMessage ? 'white' : '#1f2937'};
    box-shadow: var(--shadow-sm);
    max-width: 75%;
    ${isOwnMessage ? 'margin-left: auto;' : 'margin-right: auto;'}
    word-wrap: break-word;
    opacity: ${msg.optimistic ? '0.6' : '1'};
    transition: opacity 0.3s ease;
    animation: fadeIn 0.3s ease;
  `;
  
  const time = msg.timestamp ? formatChatTime(msg.timestamp.toDate()) : 'Núna';
  
  div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
      <strong style="font-size: 0.9rem;">${escapeHtml(msg.username)}</strong>
      <small style="opacity: 0.7; font-size: 0.75rem;">${time}</small>
    </div>
    <div style="font-size: 0.95rem; line-height: 1.4;">${escapeHtml(msg.message)}</div>
  `;
  
  container.appendChild(div);
}

// Format time for chat
function formatChatTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Núna';
  if (diffMins < 60) return `${diffMins} mín`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} klst`;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}.${month} ${hours}:${mins}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update character count
function updateCharCount() {
  const input = document.getElementById('chatInput');
  const counter = document.getElementById('chatCharCount');
  if (input && counter) {
    counter.textContent = input.value.length;
    
    // Change color when approaching limit
    if (input.value.length > 450) {
      counter.style.color = '#ef4444';
      counter.style.fontWeight = 'bold';
    } else if (input.value.length > 400) {
      counter.style.color = '#f59e0b';
      counter.style.fontWeight = '600';
    } else {
      counter.style.color = '#666';
      counter.style.fontWeight = 'normal';
    }
  }
}

// Event listeners
document.getElementById('sendMessageBtn')?.addEventListener('click', sendChatMessage);

document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

document.getElementById('chatInput')?.addEventListener('input', updateCharCount);

// Cleanup when switching leagues or logging out
function cleanupChat() {
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
  
  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = '<p style="text-align: center; color: #666;">Engin skilaboð ennþá...</p>';
  }
  
  document.getElementById('chatCard').style.display = 'none';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (chatListener) {
    chatListener();
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
      cleanupChat(); // BÆTA VIÐ
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
        cleanupChat(); // BÆTA VIÐ ÞESSARI LÍNU
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
  
  // BÆTA VIÐ ÞESSUM LÍNUM:
  document.getElementById('chatCard').style.display = 'block';
  loadChatMessages();
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
    
    // BÆTA VIÐ ÞESSARI LÍNU:
    if (isAdmin) {
      await showAvailableGames();
    }
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
        
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-weight: 600; color: #667eea; font-size: 0.9rem;">${game.homeTeam}:</label>
            <input id="tipHome_${game.id}" type="number" 
              value="${homeValue}" 
              min="0" 
              max="99"
              style="width: 80px; font-size: 1.1rem; font-weight: 600; text-align: center; padding: 10px;" 
              ${!canUserTip ? 'disabled' : ''}>
          </div>
          
          <span style="font-size: 1.5rem; font-weight: bold; color: #667eea;">-</span>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-weight: 600; color: #667eea; font-size: 0.9rem;">${game.awayTeam}:</label>
            <input id="tipAway_${game.id}" type="number" 
              value="${awayValue}" 
              min="0" 
              max="99"
              style="width: 80px; font-size: 1.1rem; font-weight: 600; text-align: center; padding: 10px;" 
              ${!canUserTip ? 'disabled' : ''}>
          </div>
          
          <button id="tipBtn_${game.id}" 
            style="padding: 10px 20px; margin: 0;"
            ${!canUserTip ? 'disabled' : ''}>${buttonText}</button>
        </div>
        
        ${!canUserTip ? '<div style="margin-top: 8px;"><span style="color: #ef4444; font-weight: 600;">⏰ Of seint að tippa</span></div>' : ''}
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
// GOOGLE SHEETS INTEGRATION - UPPFÆRT MEÐ LEIT OG PAGINATION
const SHEET_ID = '15LQbx0CbACqEgtPpb5IC_EK3aJRavGoKgv7BFo7t9bA';
const SHEET_NAME = 'Sheet1';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

let availableGamesFromSheet = [];
let filteredGamesFromSheet = [];
let displayedGamesCount = 0;
const GAMES_PER_PAGE = 5;

// Sækja leiki úr Google Sheets - LAGAÐ FYRIR DATE OBJECTS
async function fetchGamesFromSheet() {
  try {
    const response = await fetch(SHEET_URL);
    const text = await response.text();
    
    const jsonString = text.substring(47).slice(0, -2);
    const json = JSON.parse(jsonString);
    
    const rows = json.table.rows;
    const games = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].c;
      
      if (!row[0] || !row[1] || !row[2]) continue;
      
      const homeTeam = row[0]?.v || '';
      const awayTeam = row[1]?.v || '';
      const gameTimeRaw = row[2]?.v || '';
      const competition = row[3]?.v || 'EM Handbolta';
      
      // Parse dagsetninguna - Google Sheets skilar Date(YYYY,M,D,H,M,S) format
      let gameTimeStr = gameTimeRaw;
      
      // Athuga hvort þetta er Date() format frá Google
      if (typeof gameTimeRaw === 'string' && gameTimeRaw.startsWith('Date(')) {
        try {
          // Extract tölurnar úr Date(2026,0,16,17,0,0)
          const match = gameTimeRaw.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
          if (match) {
            const year = match[1];
            const month = String(parseInt(match[2]) + 1).padStart(2, '0'); // Google notar 0-indexed mánuði
            const day = String(match[3]).padStart(2, '0');
            const hour = String(match[4]).padStart(2, '0');
            const minute = String(match[5]).padStart(2, '0');
            
            // Búa til lesanlegt format
            gameTimeStr = `${year}-${month}-${day} ${hour}:${minute}`;
          }
        } catch (e) {
          console.error('Gat ekki parsed Date format:', gameTimeRaw);
        }
      }
      
      if (homeTeam && awayTeam && gameTimeStr) {
        games.push({
          homeTeam,
          awayTeam,
          gameTime: gameTimeStr,
          gameTimeRaw: gameTimeRaw, // Vista upprunalega fyrir debug
          competition
        });
      }
    }
    
    availableGamesFromSheet = games;
    filteredGamesFromSheet = games;
    return games;
  } catch (error) {
    console.error("Villa við að sækja leiki úr Google Sheets:", error);
    return [];
  }
}

// Leita í leikjum
function searchGamesFromSheet(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  
  if (term === '') {
    filteredGamesFromSheet = [...availableGamesFromSheet];
  } else {
    filteredGamesFromSheet = availableGamesFromSheet.filter(game => {
      return (
        game.homeTeam.toLowerCase().includes(term) ||
        game.awayTeam.toLowerCase().includes(term) ||
        game.gameTime.toLowerCase().includes(term) ||
        game.competition.toLowerCase().includes(term)
      );
    });
  }
  
  displayedGamesCount = 0;
  displayGamesFromSheet();
}

// Sýna leiki með pagination
function displayGamesFromSheet() {
  const container = document.getElementById('availableGamesList');
  if (!container) return;
  
  if (displayedGamesCount === 0) {
    container.innerHTML = '';
  }
  
  const gamesToShow = filteredGamesFromSheet.slice(
    displayedGamesCount,
    displayedGamesCount + GAMES_PER_PAGE
  );
  
  if (gamesToShow.length === 0 && displayedGamesCount === 0) {
    container.innerHTML = "<p style='padding: 15px; text-align: center; color: #666;'>Engir leikir fundust</p>";
    return;
  }
  
  for (let i = 0; i < gamesToShow.length; i++) {
    const game = gamesToShow[i];
    
    const div = document.createElement("div");
    div.style.cssText = `
      background: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 2px solid var(--border);
      transition: all 0.3s ease;
      cursor: pointer;
    `;
    
    const displayDate = game.gameTime;
    
    div.innerHTML = `
      <div style="flex: 1;">
        <strong style="font-size: 1.05rem; color: var(--dark);">${game.homeTeam} vs ${game.awayTeam}</strong><br>
        <small style="color: #666;">📅 ${displayDate}</small><br>
        <small style="color: #667eea;">📋 ${game.competition}</small>
      </div>
      <button onclick="addGameFromSheet(${availableGamesFromSheet.indexOf(game)})" 
        style="padding: 10px 20px; margin: 0; white-space: nowrap;">
        ➕ Bæta við
      </button>
    `;
    
    div.onmouseover = () => {
      div.style.borderColor = 'var(--primary)';
      div.style.transform = 'translateX(5px)';
      div.style.boxShadow = 'var(--shadow)';
    };
    
    div.onmouseout = () => {
      div.style.borderColor = 'var(--border)';
      div.style.transform = 'translateX(0)';
      div.style.boxShadow = 'none';
    };
    
    container.appendChild(div);
  }
  
  displayedGamesCount += gamesToShow.length;
  
  if (displayedGamesCount < filteredGamesFromSheet.length) {
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.id = 'loadMoreIndicator';
    loadMoreDiv.style.cssText = `
      text-align: center;
      padding: 15px;
      color: #667eea;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    loadMoreDiv.innerHTML = `
      👇 Skrollaðu niður til að sjá fleiri leiki 
      <br><small style="color: #666;">(Sýni ${displayedGamesCount} af ${filteredGamesFromSheet.length})</small>
    `;
    
    loadMoreDiv.onclick = () => {
      displayGamesFromSheet();
    };
    
    container.appendChild(loadMoreDiv);
  }
}

// Infinite scroll
function setupInfiniteScrollForGames() {
  const container = document.getElementById('availableGamesContainer');
  if (!container) return;
  
  container.addEventListener('scroll', () => {
    const scrollPosition = container.scrollTop + container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    if (scrollPosition >= scrollHeight - 50) {
      if (displayedGamesCount < filteredGamesFromSheet.length) {
        const loadMoreIndicator = document.getElementById('loadMoreIndicator');
        if (loadMoreIndicator) {
          loadMoreIndicator.remove();
        }
        displayGamesFromSheet();
      }
    }
  });
}

// Sýna leiki frá Google Sheets
async function showAvailableGames() {
  const container = document.getElementById('availableGamesList');
  const outerContainer = document.getElementById('availableGamesContainer');
  
  if (!container || !outerContainer) return;
  
  container.innerHTML = "<p style='padding: 15px; text-align: center;'>Hleð leikjum úr Google Sheets...</p>";
  outerContainer.style.display = 'block';
  
  try {
    const games = await fetchGamesFromSheet();
    
    if (games.length === 0) {
      container.innerHTML = "<p style='padding: 15px; text-align: center; color: #666;'>Engir leikir fundust í Google Sheet</p>";
      return;
    }
    
    displayedGamesCount = 0;
    filteredGamesFromSheet = [...games];
    
    displayGamesFromSheet();
    setupInfiniteScrollForGames();
    
  } catch (error) {
    handleError(error, "Villa við að sýna leiki");
    container.innerHTML = "<p style='padding: 15px; text-align: center; color: #dc3545;'>Villa við að hlaða leikjum</p>";
  }
}

// Bæta leik við deild úr Google Sheet - LAGAÐ FYRIR DATE OBJECTS
window.addGameFromSheet = async (index) => {
  const game = availableGamesFromSheet[index];
  if (!game) return alert("Leikur fannst ekki!");
  
  showLoading(true);
  try {
    let gameDate;
    const gameTimeStr = game.gameTime.trim();
    
    console.log('Reyni að parse:', gameTimeStr);
    
    // Ef þetta er Date() format frá Google
    if (game.gameTimeRaw && game.gameTimeRaw.startsWith('Date(')) {
      const match = game.gameTimeRaw.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
      if (match) {
        gameDate = new Date(
          parseInt(match[1]), // year
          parseInt(match[2]), // month (Google notar 0-indexed)
          parseInt(match[3]), // day
          parseInt(match[4]), // hour
          parseInt(match[5]), // minute
          parseInt(match[6])  // second
        );
      }
    }
    
    // Fallback: Reyna að parse streng
    if (!gameDate || isNaN(gameDate.getTime())) {
      if (gameTimeStr.includes('/')) {
        const parts = gameTimeStr.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        
        const dateParts = datePart.split('/');
        const timeParts = timePart.split(':');
        
        gameDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2]),
          parseInt(timeParts[0]),
          parseInt(timeParts[1])
        );
      } else if (gameTimeStr.includes('-')) {
        const parts = gameTimeStr.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        
        const dateParts = datePart.split('-');
        const timeParts = timePart.split(':');
        
        gameDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2]),
          parseInt(timeParts[0]),
          parseInt(timeParts[1])
        );
      } else {
        gameDate = new Date(gameTimeStr);
      }
    }
    
    console.log('Parsed date:', gameDate);
    
    if (isNaN(gameDate.getTime())) {
      alert(`Villa: Gat ekki lesið dagsetningu: "${gameTimeStr}"`);
      console.error('Raw:', game.gameTimeRaw);
      showLoading(false);
      return;
    }
    
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
    console.error("Full error:", error);
    console.error("Game data:", game);
    handleError(error, "Villa við að bæta leik við");
  } finally {
    showLoading(false);
  }
};
// Event listener fyrir leitarreit
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('gameSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchGamesFromSheet(e.target.value);
    });
  }
});

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
   CHAT SYSTEM
========================= */
let chatListener = null;
const MESSAGE_LIMIT = 50;

// Import onSnapshot fyrir real-time
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Send message
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  if (!activeLeagueId || !auth.currentUser) return alert("Þú verður að vera í deild!");
  
  const username = document.getElementById("username")?.value || "Óþekktur";
  
  // Rate limiting - max 10 messages per minute
  const oneMinuteAgo = Timestamp.fromMillis(Date.now() - 60000);
  const userMessages = await getDocs(query(
    collection(db, "messages"),
    where("userId", "==", auth.currentUser.uid),
    where("leagueId", "==", activeLeagueId),
    where("timestamp", ">", oneMinuteAgo)
  ));
  
  if (userMessages.size >= 10) {
    return alert("Of mörg skilaboð! Bíddu aðeins.");
  }
  
  try {
    // Optimistic UI - sýna skilaboðið strax
    const tempMsg = {
      username: username,
      message: message,
      timestamp: Timestamp.now(),
      userId: auth.currentUser.uid,
      optimistic: true
    };
    
    appendMessage(tempMsg);
    input.value = "";
    updateCharCount();
    
    // Send to Firestore
    await addDoc(collection(db, "messages"), {
      leagueId: activeLeagueId,
      userId: auth.currentUser.uid,
      username: username,
      message: message,
      timestamp: Timestamp.now()
    });
    
  } catch (error) {
    handleError(error, "Villa við að senda skilaboð");
  }
}

// Load and listen to messages
function loadChatMessages() {
  if (!activeLeagueId) {
    document.getElementById('chatCard').style.display = 'none';
    return;
  }
  
  // Unsubscribe eldri listener
  if (chatListener) {
    chatListener();
  }
  
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  container.innerHTML = '<p style="text-align: center; color: #666;">Hleð skilaboðum...</p>';
  
  // Query fyrir nýjustu skilaboðin
  const q = query(
    collection(db, "messages"),
    where("leagueId", "==", activeLeagueId),
    orderBy("timestamp", "desc"),
    limit(MESSAGE_LIMIT)
  );
  
  // Real-time listener
  chatListener = onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #666;">Engin skilaboð ennþá. Vertu fyrstur til að skrifa! 👋</p>';
      document.getElementById('messageCount').textContent = "0";
      return;
    }
    
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    
    // Reverse til að fá elstu efst
    messages.reverse();
    
    messages.forEach(msg => {
      if (!msg.optimistic) { // Skip optimistic messages (already shown)
        appendMessage(msg);
      }
    });
    
    document.getElementById('messageCount').textContent = messages.length;
    
    // Scroll niður að nýjasta skilaboði
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
    
  }, (error) => {
    console.error("Villa við að hlaða skilaboðum:", error);
    container.innerHTML = '<p style="text-align: center; color: #dc3545;">Villa við að hlaða skilaboð</p>';
  });
}

// Append single message to UI
function appendMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const isOwnMessage = msg.userId === auth.currentUser.uid;
  
  const div = document.createElement('div');
  div.style.cssText = `
    padding: 10px 14px;
    margin: 8px 0;
    border-radius: 16px;
    background: ${isOwnMessage ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
    color: ${isOwnMessage ? 'white' : '#1f2937'};
    box-shadow: var(--shadow-sm);
    max-width: 75%;
    ${isOwnMessage ? 'margin-left: auto;' : 'margin-right: auto;'}
    word-wrap: break-word;
    opacity: ${msg.optimistic ? '0.6' : '1'};
    transition: opacity 0.3s ease;
    animation: fadeIn 0.3s ease;
  `;
  
  const time = msg.timestamp ? formatChatTime(msg.timestamp.toDate()) : 'Núna';
  
  div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
      <strong style="font-size: 0.9rem;">${escapeHtml(msg.username)}</strong>
      <small style="opacity: 0.7; font-size: 0.75rem;">${time}</small>
    </div>
    <div style="font-size: 0.95rem; line-height: 1.4;">${escapeHtml(msg.message)}</div>
  `;
  
  container.appendChild(div);
}

// Format time for chat
function formatChatTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Núna';
  if (diffMins < 60) return `${diffMins} mín`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} klst`;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}.${month} ${hours}:${mins}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update character count
function updateCharCount() {
  const input = document.getElementById('chatInput');
  const counter = document.getElementById('chatCharCount');
  if (input && counter) {
    counter.textContent = input.value.length;
    
    // Change color when approaching limit
    if (input.value.length > 450) {
      counter.style.color = '#ef4444';
      counter.style.fontWeight = 'bold';
    } else if (input.value.length > 400) {
      counter.style.color = '#f59e0b';
      counter.style.fontWeight = '600';
    } else {
      counter.style.color = '#666';
      counter.style.fontWeight = 'normal';
    }
  }
}

// Event listeners
document.getElementById('sendMessageBtn')?.addEventListener('click', sendChatMessage);

document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

document.getElementById('chatInput')?.addEventListener('input', updateCharCount);

// Cleanup when switching leagues or logging out
function cleanupChat() {
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
  
  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = '<p style="text-align: center; color: #666;">Engin skilaboð ennþá...</p>';
  }
  
  document.getElementById('chatCard').style.display = 'none';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (chatListener) {
    chatListener();
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
      cleanupChat(); // BÆTA VIÐ
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
        cleanupChat(); // BÆTA VIÐ ÞESSARI LÍNU
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
  
  // BÆTA VIÐ ÞESSUM LÍNUM:
  document.getElementById('chatCard').style.display = 'block';
  loadChatMessages();
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
    
    // BÆTA VIÐ ÞESSARI LÍNU:
    if (isAdmin) {
      await showAvailableGames();
    }
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
        
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-weight: 600; color: #667eea; font-size: 0.9rem;">${game.homeTeam}:</label>
            <input id="tipHome_${game.id}" type="number" 
              value="${homeValue}" 
              min="0" 
              max="99"
              style="width: 80px; font-size: 1.1rem; font-weight: 600; text-align: center; padding: 10px;" 
              ${!canUserTip ? 'disabled' : ''}>
          </div>
          
          <span style="font-size: 1.5rem; font-weight: bold; color: #667eea;">-</span>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-weight: 600; color: #667eea; font-size: 0.9rem;">${game.awayTeam}:</label>
            <input id="tipAway_${game.id}" type="number" 
              value="${awayValue}" 
              min="0" 
              max="99"
              style="width: 80px; font-size: 1.1rem; font-weight: 600; text-align: center; padding: 10px;" 
              ${!canUserTip ? 'disabled' : ''}>
          </div>
          
          <button id="tipBtn_${game.id}" 
            style="padding: 10px 20px; margin: 0;"
            ${!canUserTip ? 'disabled' : ''}>${buttonText}</button>
        </div>
        
        ${!canUserTip ? '<div style="margin-top: 8px;"><span style="color: #ef4444; font-weight: 600;">⏰ Of seint að tippa</span></div>' : ''}
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