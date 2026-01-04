// FULLKLÁRAÐUR APP.JS MEÐ BÓNUSSPURNINGUM

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
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let activeLeagueId = null;
let currentLeagueSettings = null;
let currentGameForBonus = null;

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
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

function sendNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: "⚽",
      badge: "🏆"
    });
  }
}

async function checkUpcomingGames() {
  if (!activeLeagueId || !auth.currentUser) return;
  
  const gamesSnap = await getDocs(query(collection(db, "games"), where("leagueId", "==", activeLeagueId)));
  const now = new Date();
  
  for (let gameDoc of gamesSnap.docs) {
    const game = gameDoc.data();
    if (!game.gameTime) continue;
    
    const gameTime = game.gameTime.toDate();
    const minutesUntil = (gameTime - now) / (1000 * 60);
    
    // Athuga hvort notandi hafi tippað
    const tipDoc = await getDoc(doc(db, "tips", `${gameDoc.id}_${auth.currentUser.uid}`));
    const hasTipped = tipDoc.exists();
    
    // Senda tilkynningu ef 30 mín til leiks og hefur ekki tippað
    if (minutesUntil > 15 && minutesUntil <= 30 && !hasTipped) {
      sendNotification(
        "⏰ Ekki gleyma að tippa!",
        `${game.homeTeam} vs ${game.awayTeam} byrjar eftir ${Math.floor(minutesUntil)} mínútur`
      );
    }
    
    // Senda tilkynningu þegar leikur byrjar
    if (minutesUntil >= 0 && minutesUntil <= 2) {
      sendNotification(
        "🔴 Leikur byrjar núna!",
        `${game.homeTeam} vs ${game.awayTeam}`
      );
    }
  }
}

// Athuga á 5 mín fresti
let notificationInterval = null;

function startNotificationChecks() {
  if (notificationInterval) clearInterval(notificationInterval);
  checkUpcomingGames(); // Athuga strax
  notificationInterval = setInterval(checkUpcomingGames, 5 * 60 * 1000); // Á 5 mín fresti
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

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Skráður inn");
  } catch {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Aðgangur búinn til");
    } catch (error) {
      alert("Villa: " + error.message);
    }
  }
});

document.getElementById("googleLoginBtn")?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  
  try {
    // Prófa popup fyrst
    await signInWithPopup(auth, provider);
    // Ekki þarf alert - onAuthStateChanged sér um UI uppfærslu
    
  } catch (error) {
    // Ef popup virkar ekki (blocked), nota redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.log("Popup blocked, using redirect instead");
      await signInWithRedirect(auth, provider);
    } else if (error.code !== 'auth/popup-closed-by-user') {
      alert("Villa við Google innskráningu: " + error.message);
    }
  }
});

// Check for redirect result on page load
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
  await auth.signOut();
  alert("Útskráður");
  location.reload();
});

/* =========================
   DEILDIR
========================= */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

document.getElementById("createLeagueBtn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const username = document.getElementById("username")?.value;
  const name = document.getElementById("leagueName").value;
  
  if (!name) return alert("Settu nafn deildar");
  if (!username || username.trim() === "") return alert("Settu notendanafn fyrst!");

  const leagueRef = await addDoc(collection(db, "leagues"), {
    name,
    ownerId: user.uid,
    code: generateCode(),
    pointSettings: DEFAULT_POINTS
  });

  await setDoc(doc(db, "leagueMembers", `${leagueRef.id}_${user.uid}`), {
    leagueId: leagueRef.id,
    userId: user.uid,
    username: username.trim(),
    points: 0
  });

  loadUserLeagues();
});

document.getElementById("joinLeagueBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("leagueCode").value;
  const user = auth.currentUser;
  if (!user) return;
  const username = document.getElementById("username")?.value;

  if (!code) return alert("Settu deildar kóða!");
  if (!username || username.trim() === "") return alert("Settu notendanafn fyrst!");

  const q = query(collection(db, "leagues"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return alert("Engin deild fannst");

  const league = snap.docs[0];

  await setDoc(doc(db, "leagueMembers", `${league.id}_${user.uid}`), {
    leagueId: league.id,
    userId: user.uid,
    username: username.trim(),
    points: 0
  });

  loadUserLeagues();
});

/* =========================
   SÝNA DEILDIR MEÐ KÓÐA
========================= */
async function loadUserLeagues() {
  const ul = document.getElementById("userLeagues");
  ul.innerHTML = "";

  const snap = await getDocs(query(collection(db, "leagueMembers"), where("userId", "==", auth.currentUser.uid)));

  for (let d of snap.docs) {
    const leagueId = d.data().leagueId;
    const leagueSnap = await getDocs(query(collection(db, "leagues")));
    const leagueDoc = leagueSnap.docs.find(doc => doc.id === leagueId);
    
    const li = document.createElement("li");
    if (leagueDoc) {
      const leagueData = leagueDoc.data();
      li.innerHTML = `
        <strong>${leagueData.name}</strong><br>
        <small style="color: #666;">Kóði: <strong style="color: #667eea;">${leagueData.code}</strong></small>
      `;
    } else {
      li.textContent = leagueId;
    }
    li.style.cursor = "pointer";

    li.onclick = async () => {
      activeLeagueId = leagueId;
      await loadLeagueSettings();
      await loadGames();
      await loadScores();
      await checkAdmin();
      checkUpcomingGames(); // Athuga leiki strax þegar deild er valin
    };

    ul.appendChild(li);
  }
}

/* =========================
   HLAÐA STIGASTILLINGUM
========================= */
async function loadLeagueSettings() {
  const leagueDoc = await getDoc(doc(db, "leagues", activeLeagueId));
  if (leagueDoc.exists()) {
    currentLeagueSettings = leagueDoc.data().pointSettings || DEFAULT_POINTS;
  } else {
    currentLeagueSettings = DEFAULT_POINTS;
  }
}

/* =========================
   ADMIN CHECK + VISTA STILLINGAR
========================= */
async function checkAdmin() {
  const panel = document.getElementById("adminPanel");
  const settingsPanel = document.getElementById("pointSettingsPanel");
  const snap = await getDocs(query(collection(db, "leagues"), where("ownerId", "==", auth.currentUser.uid)));
  const isAdmin = snap.docs.some(d => d.id === activeLeagueId);
  
  panel.style.display = isAdmin ? "block" : "none";
  settingsPanel.style.display = isAdmin ? "block" : "none";
  
  if (isAdmin && currentLeagueSettings) {
    document.getElementById("pointExactScore").value = currentLeagueSettings.exactScore;
    document.getElementById("pointHomeScore").value = currentLeagueSettings.homeTeamScore;
    document.getElementById("pointAwayScore").value = currentLeagueSettings.awayTeamScore;
    document.getElementById("pointOutcome").value = currentLeagueSettings.correctOutcome;
  }
}

document.getElementById("savePointSettingsBtn")?.addEventListener("click", async () => {
  const settings = {
    exactScore: parseInt(document.getElementById("pointExactScore").value) || 5,
    homeTeamScore: parseInt(document.getElementById("pointHomeScore").value) || 3,
    awayTeamScore: parseInt(document.getElementById("pointAwayScore").value) || 3,
    correctOutcome: parseInt(document.getElementById("pointOutcome").value) || 2
  };
  
  await updateDoc(doc(db, "leagues", activeLeagueId), {
    pointSettings: settings
  });
  
  currentLeagueSettings = settings;
  alert("Stigastillingar vistaðar!");
});

/* =========================
   HJÁLPAR FÖLL FYRIR TÍMA
========================= */
function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} kl. ${hours}:${minutes}`;
}

function canTip(gameTime) {
  if (!gameTime) return true;
  const now = new Date();
  const game = gameTime.toDate();
  const diffMinutes = (game - now) / (1000 * 60);
  return diffMinutes > 15;
}

function hasGameStarted(gameTime) {
  if (!gameTime) return false;
  const now = new Date();
  const game = gameTime.toDate();
  return now >= game;
}

function getTimeUntilGame(gameTime) {
  if (!gameTime) return "";
  const now = new Date();
  const game = gameTime.toDate();
  const diffMinutes = Math.floor((game - now) / (1000 * 60));
  
  if (diffMinutes < 0) return "Leikur hafinn";
  if (diffMinutes < 60) return `${diffMinutes} mín til leiks`;
  
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}klst ${mins}mín til leiks`;
}

/* =========================
   REIKNA STIG MEÐ NÝJU KERFI
========================= */
function calculatePoints(prediction, result, settings) {
  if (!prediction || !result || !prediction.includes("-") || !result.includes("-")) {
    return 0;
  }
  
  const [predHome, predAway] = prediction.split("-").map(Number);
  const [resHome, resAway] = result.split("-").map(Number);
  
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
}

/* =========================
   BÓNUSSPURNINGAR - ADMIN
========================= */
document.getElementById("manageBonusBtn")?.addEventListener("click", async () => {
  const gameId = document.getElementById("bonusGameSelect").value;
  if (!gameId) return alert("Veldu leik!");
  
  currentGameForBonus = gameId;
  await loadBonusQuestions(gameId);
  document.getElementById("bonusQuestionsPanel").style.display = "block";
});

document.getElementById("addBonusQuestionBtn")?.addEventListener("click", async () => {
  const type = document.getElementById("bonusQuestionType").value;
  const question = document.getElementById("bonusQuestionText").value;
  const points = parseInt(document.getElementById("bonusQuestionPoints").value) || 1;
  
  if (!question) return alert("Skrifaðu spurningu!");
  
  const bonusData = {
    gameId: currentGameForBonus,
    leagueId: activeLeagueId,
    type: type,
    question: question,
    points: points
  };
  
  if (type === "multipleChoice") {
    const options = document.getElementById("bonusQuestionOptions").value.split(",").map(o => o.trim());
    if (options.length < 2) return alert("Settu að minnsta kosti 2 valmöguleika, aðskildir með kommu");
    bonusData.options = options;
  }
  
  await addDoc(collection(db, "bonusQuestions"), bonusData);
  
  document.getElementById("bonusQuestionText").value = "";
  document.getElementById("bonusQuestionPoints").value = "1";
  document.getElementById("bonusQuestionOptions").value = "";
  
  await loadBonusQuestions(currentGameForBonus);
  alert("Bónusspurning bætt við!");
});

async function loadBonusQuestions(gameId) {
  const container = document.getElementById("bonusQuestionsList");
  container.innerHTML = "";
  
  const snap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
  
  if (snap.empty) {
    container.innerHTML = "<p>Engar bónusspurningar fyrir þennan leik</p>";
    return;
  }
  
  for (let docSnap of snap.docs) {
    const q = docSnap.data();
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
      <button onclick="setBonusAnswer('${docSnap.id}')">Setja rétt svar</button>
      <button onclick="deleteBonusQuestion('${docSnap.id}')" style="background: #dc3545;">Eyða</button>
    `;
    container.appendChild(div);
  }
}

window.setBonusAnswer = async (questionId) => {
  const answer = prompt("Hvað er rétta svarið?");
  if (!answer) return;
  
  await updateDoc(doc(db, "bonusQuestions", questionId), {
    correctAnswer: answer
  });
  
  await loadBonusQuestions(currentGameForBonus);
  await updateBonusPoints(currentGameForBonus);
  alert("Rétt svar sett og stig uppfærð!");
};

window.deleteBonusQuestion = async (questionId) => {
  if (!confirm("Ertu viss um að þú viljir eyða þessari spurningu?")) return;
  
  await deleteDoc(doc(db, "bonusQuestions", questionId));
  await loadBonusQuestions(currentGameForBonus);
  alert("Spurningu eytt!");
};

async function updateBonusPoints(gameId) {
  const questionsSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
  
  for (let qDoc of questionsSnap.docs) {
    const question = qDoc.data();
    if (!question.correctAnswer) continue;
    
    const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
    
    for (let aDoc of answersSnap.docs) {
      const answer = aDoc.data();
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
      
      await updateDoc(doc(db, "bonusAnswers", aDoc.id), { points });
    }
  }
  
  await recalculateAllPoints();
}

async function recalculateAllPoints() {
  const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
  
  for (let m of membersSnap.docs) {
    const userId = m.data().userId;
    
    const tipsSnap = await getDocs(query(collection(db, "tips"), where("userId", "==", userId), where("leagueId", "==", activeLeagueId)));
    let totalPoints = 0;
    tipsSnap.forEach(tip => totalPoints += tip.data().points);
    
    const bonusSnap = await getDocs(query(collection(db, "bonusAnswers"), where("userId", "==", userId), where("leagueId", "==", activeLeagueId)));
    bonusSnap.forEach(bonus => totalPoints += (bonus.data().points || 0));
    
    await updateDoc(doc(db, "leagueMembers", m.id), { points: totalPoints });
  }
  
  await loadScores();
}

/* =========================
   LEIKIR + BÓNUSSPURNINGAR
========================= */
async function loadGames() {
  const list = document.getElementById("gamesList");
  const resultSelect = document.getElementById("resultGameSelect");
  const bonusSelect = document.getElementById("bonusGameSelect");
  const deleteSelect = document.getElementById("deleteGameSelect");
  
  list.innerHTML = "";
  resultSelect.innerHTML = '<option value="">Veldu leik</option>';
  bonusSelect.innerHTML = '<option value="">Veldu leik</option>';
  deleteSelect.innerHTML = '<option value="">Veldu leik til að eyða</option>';

  const snap = await getDocs(query(collection(db, "games"), where("leagueId", "==", activeLeagueId)));

  for (let docSnap of snap.docs) {
    const game = docSnap.data();
    const gameId = docSnap.id;
    const canUserTip = canTip(game.gameTime);
    const gameStarted = hasGameStarted(game.gameTime);
    const timeInfo = game.gameTime ? getTimeUntilGame(game.gameTime) : "";
    
    const li = document.createElement("li");
    
    let html = `
      <strong>${game.homeTeam} vs ${game.awayTeam}</strong><br>
      ${game.gameTime ? `<small>${formatDateTime(game.gameTime)} (${timeInfo})</small><br>` : ''}
    `;
    
    if (gameStarted) {
      const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
      
      if (!tipsSnap.empty) {
        html += `<div style="margin-top: 10px; padding: 10px; background: #f0f4ff; border-radius: 5px;">
          <strong>Tipp:</strong><br>`;
        
        for (let tipDoc of tipsSnap.docs) {
          const tip = tipDoc.data();
          const memberSnap = await getDocs(query(
            collection(db, "leagueMembers"), 
            where("userId", "==", tip.userId),
            where("leagueId", "==", activeLeagueId)
          ));
          
          const username = memberSnap.empty ? "Óþekktur" : memberSnap.docs[0].data().username;
          const isCurrentUser = tip.userId === auth.currentUser.uid;
          
          html += `<small style="${isCurrentUser ? 'font-weight: bold; color: #667eea;' : ''}">${username}: ${tip.prediction}${tip.points > 0 ? ` (${tip.points} stig)` : ''}</small><br>`;
        }
        
        html += `</div>`;
      }
      
      if (game.result) {
        html += `<div style="margin-top: 10px;"><strong style="color: green;">Úrslit: ${game.result}</strong></div>`;
      }
      
      html += await loadBonusAnswersForGame(gameId, gameStarted);
    } else {
      html += `
        <div style="margin-top: 10px;">
          <input id="tipHome_${gameId}" type="number" placeholder="${game.homeTeam}" 
            style="width: 60px;" ${!canUserTip ? 'disabled' : ''}>
          <span style="margin: 0 5px;">-</span>
          <input id="tipAway_${gameId}" type="number" placeholder="${game.awayTeam}" 
            style="width: 60px;" ${!canUserTip ? 'disabled' : ''}>
          <button id="tipBtn_${gameId}" ${!canUserTip ? 'disabled' : ''}>Tippa</button>
          ${!canUserTip ? '<br><span style="color: red;">Of seint að tippa</span>' : ''}
        </div>
      `;
      
      html += await loadBonusQuestionsForGame(gameId, canUserTip);
    }
    
    li.innerHTML = html;
    list.appendChild(li);
    
    if (!gameStarted) {
      document.getElementById(`tipBtn_${gameId}`)?.addEventListener('click', () => submitTip(gameId));
      await attachBonusEventListeners(gameId);
    }

    const opt = document.createElement("option");
    opt.value = gameId;
    opt.textContent = `${game.homeTeam} vs ${game.awayTeam}`;
    resultSelect.appendChild(opt);
    bonusSelect.appendChild(opt.cloneNode(true));
    deleteSelect.appendChild(opt.cloneNode(true));
  }
}

async function loadBonusQuestionsForGame(gameId, canAnswer) {
  const questionsSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
  
  if (questionsSnap.empty) return "";
  
  let html = `<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
    <strong>🎁 Bónusspurningar:</strong><br><br>`;
  
  for (let qDoc of questionsSnap.docs) {
    const q = qDoc.data();
    const qId = qDoc.id;
    
    const existingAnswerSnap = await getDocs(query(
      collection(db, "bonusAnswers"),
      where("questionId", "==", qId),
      where("userId", "==", auth.currentUser.uid)
    ));
    
    const existingAnswer = existingAnswerSnap.empty ? "" : existingAnswerSnap.docs[0].data().answer;
    
    html += `<div style="margin-bottom: 15px;">
      <strong>${q.question}</strong> <small>(${q.points} stig)</small><br>`;
    
    if (q.type === "text" || q.type === "number") {
      html += `<input id="bonus_${qId}" type="${q.type === 'number' ? 'number' : 'text'}" 
        placeholder="Svarið þitt" value="${existingAnswer}" ${!canAnswer ? 'disabled' : ''}>`;
    } else if (q.type === "yesNo") {
      html += `
        <select id="bonus_${qId}" ${!canAnswer ? 'disabled' : ''}>
          <option value="">Veldu</option>
          <option value="Já" ${existingAnswer === 'Já' ? 'selected' : ''}>Já</option>
          <option value="Nei" ${existingAnswer === 'Nei' ? 'selected' : ''}>Nei</option>
        </select>`;
    } else if (q.type === "multipleChoice" && q.options) {
      html += `<select id="bonus_${qId}" ${!canAnswer ? 'disabled' : ''}>
        <option value="">Veldu</option>`;
      q.options.forEach(opt => {
        html += `<option value="${opt}" ${existingAnswer === opt ? 'selected' : ''}>${opt}</option>`;
      });
      html += `</select>`;
    }
    
    html += `<button id="bonusBtn_${qId}" ${!canAnswer ? 'disabled' : ''}>Vista svar</button>
      ${existingAnswer ? `<small style="color: green;"> ✓ Þú hefur svarað: ${existingAnswer}</small>` : ''}
    </div>`;
  }
  
  html += `${!canAnswer ? '<small style="color: red;">Of seint að svara bónusspurningum</small>' : ''}</div>`;
  
  return html;
}

async function loadBonusAnswersForGame(gameId, gameStarted) {
  if (!gameStarted) return "";
  
  const questionsSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
  
  if (questionsSnap.empty) return "";
  
  let html = `<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
    <strong>🎁 Bónusspurningar:</strong><br><br>`;
  
  for (let qDoc of questionsSnap.docs) {
    const q = qDoc.data();
    const qId = qDoc.id;
    
    html += `<div style="margin-bottom: 15px;">
      <strong>${q.question}</strong><br>`;
    
    if (q.correctAnswer) {
      html += `<small style="color: green;">Rétt svar: ${q.correctAnswer}</small><br>`;
    }
    
    const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qId)));
    
    if (!answersSnap.empty) {
      html += `<small>Svör:</small><br>`;
      for (let aDoc of answersSnap.docs) {
        const answer = aDoc.data();
        const memberSnap = await getDocs(query(
          collection(db, "leagueMembers"),
          where("userId", "==", answer.userId),
          where("leagueId", "==", activeLeagueId)
        ));
        
        const username = memberSnap.empty ? "Óþekktur" : memberSnap.docs[0].data().username;
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

async function attachBonusEventListeners(gameId) {
  const questionsSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
  
  for (let qDoc of questionsSnap.docs) {
    const qId = qDoc.id;
    const btn = document.getElementById(`bonusBtn_${qId}`);
    if (btn) {
      btn.addEventListener('click', () => submitBonusAnswer(qId, gameId));
    }
  }
}

async function submitBonusAnswer(questionId, gameId) {
  const input = document.getElementById(`bonus_${questionId}`);
  if (!input) return;
  
  const answer = input.value;
  if (!answer) return alert("Settu inn svar!");
  
  const gameDoc = await getDoc(doc(db, "games", gameId));
  if (gameDoc.exists() && !canTip(gameDoc.data().gameTime)) {
    return alert("Of seint að svara bónusspurningu!");
  }
  
  const answerId = `${questionId}_${auth.currentUser.uid}`;
  
  await setDoc(doc(db, "bonusAnswers", answerId), {
    questionId: questionId,
    gameId: gameId,
    leagueId: activeLeagueId,
    userId: auth.currentUser.uid,
    answer: answer,
    points: 0
  });
  
  alert("Svar vistað!");
  await loadGames();
}

async function submitTip(gameId) {
  const homeInput = document.getElementById(`tipHome_${gameId}`);
  const awayInput = document.getElementById(`tipAway_${gameId}`);
  
  if (!homeInput || !awayInput) return;
  
  const homeScore = homeInput.value;
  const awayScore = awayInput.value;
  
  if (!homeScore || !awayScore) return alert("Skráðu skor fyrir bæði lið!");
  
  const prediction = `${homeScore}-${awayScore}`;
  
  const gameDoc = await getDoc(doc(db, "games", gameId));
  if (gameDoc.exists() && !canTip(gameDoc.data().gameTime)) {
    return alert("Of seint að tippa á þennan leik!");
  }

  await setDoc(doc(db, "tips", `${gameId}_${auth.currentUser.uid}`), {
    gameId,
    leagueId: activeLeagueId,
    userId: auth.currentUser.uid,
    prediction,
    points: 0
  });

  alert("Tip skráð");
  await loadGames();
}

/* =========================
   ADMIN ACTIONS
========================= */
document.getElementById("createGameAdminBtn")?.addEventListener("click", async () => {
  const home = document.getElementById("adminHomeTeam").value;
  const away = document.getElementById("adminAwayTeam").value;
  const datetime = document.getElementById("adminGameTime").value;
  
  if (!home || !away) return alert("Settu lið!");
  if (!datetime) return alert("Settu tímasetningu á leik!");

  const gameTime = Timestamp.fromDate(new Date(datetime));

  await addDoc(collection(db, "games"), {
    leagueId: activeLeagueId,
    homeTeam: home,
    awayTeam: away,
    gameTime: gameTime,
    result: null
  });

  document.getElementById("adminHomeTeam").value = "";
  document.getElementById("adminAwayTeam").value = "";
  document.getElementById("adminGameTime").value = "";
  
  loadGames();
  alert("Leikur búinn til");
});

document.getElementById("deleteGameBtn")?.addEventListener("click", async () => {
  const gameId = document.getElementById("deleteGameSelect").value;
  if (!gameId) return alert("Veldu leik til að eyða!");
  
  if (!confirm("Ertu viss um að þú viljir eyða þessum leik? Öll tipp og bónusspurningar verða einnig eytt.")) return;
  
  // Eyða öllum tippum fyrir þennan leik
  const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
  for (let tipDoc of tipsSnap.docs) {
    await deleteDoc(doc(db, "tips", tipDoc.id));
  }
  
  // Eyða öllum bónusspurningum
  const bonusQSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
  for (let qDoc of bonusQSnap.docs) {
    // Eyða öllum svorunum við þessari spurningu
    const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
    for (let aDoc of answersSnap.docs) {
      await deleteDoc(doc(db, "bonusAnswers", aDoc.id));
    }
    await deleteDoc(doc(db, "bonusQuestions", qDoc.id));
  }
  
  // Eyða leiknum
  await deleteDoc(doc(db, "games", gameId));
  
  // Uppfæra stig
  await recalculateAllPoints();
  
  alert("Leik eytt!");
  await loadGames();
});

document.getElementById("viewMembersBtn")?.addEventListener("click", async () => {
  const container = document.getElementById("membersList");
  container.innerHTML = "";
  container.style.display = "block";
  
  const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
  const leagueSnap = await getDoc(doc(db, "leagues", activeLeagueId));
  const ownerId = leagueSnap.data().ownerId;
  
  if (membersSnap.empty) {
    container.innerHTML = "<p>Engir notendur í deild</p>";
    return;
  }
  
  for (let memberDoc of membersSnap.docs) {
    const member = memberDoc.data();
    const isOwner = member.userId === ownerId;
    
    const div = document.createElement("div");
    div.style.cssText = "padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;";
    
    div.innerHTML = `
      <div>
        <strong>${member.username}</strong>
        ${isOwner ? '<span style="color: #ffc107; margin-left: 10px;">👑 Stjórnandi</span>' : ''}
        <br><small style="color: #666;">${member.points} stig</small>
      </div>
      ${!isOwner ? `<button onclick="removeMember('${memberDoc.id}', '${member.username}')" style="background: #dc3545; padding: 8px 16px;">Fjarlægja</button>` : ''}
    `;
    
    container.appendChild(div);
  }
});

window.removeMember = async (memberId, username) => {
  if (!confirm(`Ertu viss um að þú viljir fjarlægja ${username} úr deildinni?`)) return;
  
  const memberDoc = await getDoc(doc(db, "leagueMembers", memberId));
  const userId = memberDoc.data().userId;
  
  // Eyða öllum tippum notandans í þessari deild
  const tipsSnap = await getDocs(query(
    collection(db, "tips"),
    where("userId", "==", userId),
    where("leagueId", "==", activeLeagueId)
  ));
  for (let tipDoc of tipsSnap.docs) {
    await deleteDoc(doc(db, "tips", tipDoc.id));
  }
  
  // Eyða öllum bónussvorunum notandans í þessari deild
  const answersSnap = await getDocs(query(
    collection(db, "bonusAnswers"),
    where("userId", "==", userId),
    where("leagueId", "==", activeLeagueId)
  ));
  for (let answerDoc of answersSnap.docs) {
    await deleteDoc(doc(db, "bonusAnswers", answerDoc.id));
  }
  
  // Eyða notandanum úr deildinni
  await deleteDoc(doc(db, "leagueMembers", memberId));
  
  alert(`${username} hefur verið fjarlægður úr deildinni`);
  
  // Uppfæra listann
  document.getElementById("viewMembersBtn").click();
  await loadScores();
};

document.getElementById("deleteLeagueBtn")?.addEventListener("click", async () => {
  const leagueDoc = await getDoc(doc(db, "leagues", activeLeagueId));
  const leagueName = leagueDoc.data().name;
  
  const confirmation = prompt(`VIÐVÖRUN: Þetta eyðir ÖLLU í deildinni "${leagueName}".\n\nSkrifaðu "EYÐA" til að staðfesta:`);
  
  if (confirmation !== "EYÐA") {
    alert("Hætt við");
    return;
  }
  
  // Eyða öllum leikjum og tengdum gögnum
  const gamesSnap = await getDocs(query(collection(db, "games"), where("leagueId", "==", activeLeagueId)));
  for (let gameDoc of gamesSnap.docs) {
    const gameId = gameDoc.id;
    
    // Eyða tippum
    const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
    for (let tipDoc of tipsSnap.docs) {
      await deleteDoc(doc(db, "tips", tipDoc.id));
    }
    
    // Eyða bónusspurningum og svorunum
    const bonusQSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
    for (let qDoc of bonusQSnap.docs) {
      const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
      for (let aDoc of answersSnap.docs) {
        await deleteDoc(doc(db, "bonusAnswers", aDoc.id));
      }
      await deleteDoc(doc(db, "bonusQuestions", qDoc.id));
    }
    
    // Eyða leiknum
    await deleteDoc(doc(db, "games", gameId));
  }
  
  // Eyða öllum notendum í deildinni
  const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
  for (let memberDoc of membersSnap.docs) {
    await deleteDoc(doc(db, "leagueMembers", memberDoc.id));
  }
  
  // Eyða deildinni sjálfri
  await deleteDoc(doc(db, "leagues", activeLeagueId));
  
  alert(`Deild "${leagueName}" hefur verið eytt`);
  
  // Refresh síðuna
  location.reload();
});

document.getElementById("setResultBtn")?.addEventListener("click", async () => {
  const gameId = document.getElementById("resultGameSelect").value;
  const homeScore = document.getElementById("resultScoreHome").value;
  const awayScore = document.getElementById("resultScoreAway").value;
  
  if (!gameId) return alert("Veldu leik!");
  if (!homeScore || !awayScore) return alert("Settu skor fyrir bæði lið!");
  
  const result = `${homeScore}-${awayScore}`;

  await updateDoc(doc(db, "games", gameId), { result });
  await loadLeagueSettings();

  const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
  for (let t of tipsSnap.docs) {
    const tipData = t.data();
    const points = calculatePoints(tipData.prediction, result, currentLeagueSettings);
    await updateDoc(doc(db, "tips", t.id), { points });
  }

  document.getElementById("resultScoreHome").value = "";
  document.getElementById("resultScoreAway").value = "";

  await updateBonusPoints(gameId);
  alert("Úrslit og stig uppfærð");
});

document.getElementById("bonusQuestionType")?.addEventListener("change", (e) => {
  const optionsDiv = document.getElementById("bonusOptionsDiv");
  optionsDiv.style.display = e.target.value === "multipleChoice" ? "block" : "none";
});

/* =========================
   STIGATAFLA
========================= */
async function loadScores() {
  const ul = document.getElementById("leagueScores");
  ul.innerHTML = "";

  const snap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
  let members = snap.docs.map(d => d.data());
  members.sort((a,b) => b.points - a.points);

  for (let data of members) {
    const li = document.createElement("li");
    li.textContent = `${data.username} – ${data.points} stig`;
    ul.appendChild(li);
  }
}

/* =========================
   AUTH
========================= */
onAuthStateChanged(auth, user => { 
  if (user) {
    // Notandi er innskráður
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("loggedInSection").style.display = "block";
    document.getElementById("loggedInEmail").textContent = user.email;
    
    // Biðja um tilkynningaleyfi
    requestNotificationPermission().then(granted => {
      if (granted) {
        console.log("✅ Tilkynningar virkar");
      }
    });
    
    // Sækja notendanafn úr fyrstu deild
    getDocs(query(collection(db, "leagueMembers"), where("userId", "==", user.uid)))
      .then(snap => {
        if (!snap.empty) {
          const username = snap.docs[0].data().username;
          document.getElementById("loggedInUsername").textContent = username;
        } else {
          document.getElementById("loggedInUsername").textContent = user.email;
        }
      });
    
    loadUserLeagues();
    startNotificationChecks(); // Byrja að athuga leiki
  } else {
    // Notandi er EKKI innskráður
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("loggedInSection").style.display = "none";
    stopNotificationChecks(); // Stoppa tilkynningar
  }
});