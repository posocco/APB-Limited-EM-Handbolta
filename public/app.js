// BÆTT ÚTGÁFA MEÐ ERROR HANDLING OG LOCALSTORAGE

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
  
  // Sérstakar Firebase villur
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
      
      // Senda tilkynningu ef 15-30 mín til leiks og hefur ekki tippað
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
    // onAuthStateChanged sér um restina
  } catch (loginError) {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged sér um restina
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
    // Nota transaction til að tryggja að báðar aðgerðir gangi upp
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
    
    // Athuga hvort notandi sé þegar í deildinni
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
   SÝNA DEILDIR MEÐ KÓÐA
========================= */
async function loadUserLeagues() {
  const ul = document.getElementById("userLeagues");
  ul.innerHTML = "<li>Hleð deildum...</li>";

  try {
    const snap = await getDocs(query(collection(db, "leagueMembers"), where("userId", "==", auth.currentUser.uid)));
    
    if (snap.empty) {
      ul.innerHTML = "<li>Þú ert ekki í neinum deildum enn</li>";
      return;
    }

    ul.innerHTML = "";
    const leagueIds = snap.docs.map(d => d.data().leagueId);
    
    // Sækja allar deildir í einu
    const leaguesSnap = await getDocs(collection(db, "leagues"));
    const leaguesMap = {};
    leaguesSnap.docs.forEach(doc => {
      leaguesMap[doc.id] = doc.data();
    });

    for (let d of snap.docs) {
      const leagueId = d.data().leagueId;
      const leagueData = leaguesMap[leagueId];
      
      if (!leagueData) continue;
      
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${leagueData.name}</strong><br>
        <small style="color: #666;">Kóði: <strong style="color: #667eea;">${leagueData.code}</strong></small>
      `;
      li.style.cursor = "pointer";
      
      // Merkja virka deild
      if (leagueId === activeLeagueId) {
        li.style.background = "#e8eaf6";
        li.style.borderLeft = "4px solid #667eea";
      }

      li.onclick = async () => {
        activeLeagueId = leagueId;
        saveActiveLeague(leagueId);
        
        showLoading(true);
        try {
          await loadLeagueSettings();
          await loadGames();
          await loadScores();
          await checkAdmin();
          await checkUpcomingGames();
          
          // Uppfæra UI
          await loadUserLeagues(); // Refresh til að sýna active deild
        } catch (error) {
          handleError(error, "Villa við að hlaða deild");
        } finally {
          showLoading(false);
        }
      };

      ul.appendChild(li);
    }
    
    // Ef við höfum vistað deild, hlaða henni sjálfkrafa
    if (!activeLeagueId) {
      const savedLeagueId = loadActiveLeague();
      if (savedLeagueId && leagueIds.includes(savedLeagueId)) {
        const savedLi = Array.from(ul.children).find(li => 
          li.onclick && li.textContent.includes(leaguesMap[savedLeagueId]?.name)
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
   HLAÐA STIGASTILLINGUM
========================= */
async function loadLeagueSettings() {
  try {
    const leagueDoc = await getDoc(doc(db, "leagues", activeLeagueId));
    if (leagueDoc.exists()) {
      currentLeagueSettings = leagueDoc.data().pointSettings || DEFAULT_POINTS;
    } else {
      currentLeagueSettings = DEFAULT_POINTS;
    }
  } catch (error) {
    console.error("Villa við að hlaða stillingum:", error);
    currentLeagueSettings = DEFAULT_POINTS;
  }
}

/* =========================
   ADMIN CHECK + VISTA STILLINGAR
========================= */
async function checkAdmin() {
  const panel = document.getElementById("adminPanel");
  const settingsPanel = document.getElementById("pointSettingsPanel");
  
  try {
    const leagueDoc = await getDoc(doc(db, "leagues", activeLeagueId));
    const isAdmin = leagueDoc.exists() && leagueDoc.data().ownerId === auth.currentUser.uid;
    
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
   REIKNA STIG MEÐ NÝJU KERFI
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
    const snap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
    
    if (snap.empty) {
      container.innerHTML = "<p>Engar bónusspurningar fyrir þennan leik</p>";
      return;
    }
    
    container.innerHTML = "";
    
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
    // Eyða öllum svorunum við spurningunni
    const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", questionId)));
    
    // Nota batch til að eyða mörgum í einu
    const batch = writeBatch(db);
    answersSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(doc(db, "bonusQuestions", questionId));
    await batch.commit();
    
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
    const questionsSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
    
    const batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 500; // Firestore limit
    
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
        
        batch.update(doc(db, "bonusAnswers", aDoc.id), { points });
        batchCount++;
        
        // Ef við náum Firestore limitinu, commit og byrja nýjan batch
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    await recalculateAllPoints();
  } catch (error) {
    console.error("Villa við að uppfæra bónusstig:", error);
    throw error;
  }
}

async function recalculateAllPoints() {
  try {
    const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
    
    const batch = writeBatch(db);
    
    for (let m of membersSnap.docs) {
      const userId = m.data().userId;
      
      const tipsSnap = await getDocs(query(
        collection(db, "tips"), 
        where("userId", "==", userId), 
        where("leagueId", "==", activeLeagueId)
      ));
      let totalPoints = 0;
      tipsSnap.forEach(tip => totalPoints += (tip.data().points || 0));
      
      const bonusSnap = await getDocs(query(
        collection(db, "bonusAnswers"), 
        where("userId", "==", userId), 
        where("leagueId", "==", activeLeagueId)
      ));
      bonusSnap.forEach(bonus => totalPoints += (bonus.data().points || 0));
      
      batch.update(doc(db, "leagueMembers", m.id), { 
        points: totalPoints,
        lastUpdated: Timestamp.now()
      });
    }
    
    await batch.commit();
    await loadScores();
  } catch (error) {
    console.error("Villa við að endurreikna stig:", error);
    throw error;
  }
}

/* =========================
   LEIKIR + BÓNUSSPURNINGAR
========================= */
async function loadGames() {
  const list = document.getElementById("gamesList");
  const resultSelect = document.getElementById("resultGameSelect");
  const bonusSelect = document.getElementById("bonusGameSelect");
  const deleteSelect = document.getElementById("deleteGameSelect");
  
  list.innerHTML = "<li>Hleð leikjum...</li>";
  resultSelect.innerHTML = '<option value="">Veldu leik</option>';
  bonusSelect.innerHTML = '<option value="">Veldu leik</option>';
  deleteSelect.innerHTML = '<option value="">Veldu leik til að eyða</option>';

  try {
    const snap = await getDocs(query(collection(db, "games"), where("leagueId", "==", activeLeagueId)));
    
    if (snap.empty) {
      list.innerHTML = "<li>Engir leikir í þessari deild</li>";
      return;
    }
    
    // Raða leikjum eftir gameTime
    const games = snap.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
    
    games.sort((a, b) => {
      // Ef annar eða báðir hafa ekki gameTime, setja þá aftast
      if (!a.data.gameTime && !b.data.gameTime) return 0;
      if (!a.data.gameTime) return 1;
      if (!b.data.gameTime) return -1;
      
      // Raða eftir gameTime (elstu fyrst)
      return a.data.gameTime.toMillis() - b.data.gameTime.toMillis();
    });
    
    list.innerHTML = "";
    
    let hasShownUpcomingHeader = false;
    let hasShownPastHeader = false;
    const now = new Date();

    for (let gameObj of games) {
      const gameId = gameObj.id;
      const game = gameObj.data;
      const canUserTip = canTip(game.gameTime);
      const gameStarted = hasGameStarted(game.gameTime);
      const timeInfo = game.gameTime ? getTimeUntilGame(game.gameTime) : "";
      
      // Bæta við header fyrir komandi leiki
      if (!gameStarted && !hasShownUpcomingHeader && game.gameTime) {
        const headerLi = document.createElement("li");
        headerLi.style.cssText = "background: #4CAF50; color: white; font-weight: bold; padding: 10px; margin: 20px 0 10px 0; border-radius: 5px; text-align: center;";
        headerLi.innerHTML = "⚽ KOMANDI LEIKIR";
        list.appendChild(headerLi);
        hasShownUpcomingHeader = true;
      }
      
      // Bæta við header fyrir liðna leiki
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
        // Athuga hvort notandi hafi þegar tippað
        const existingTipDoc = await getDoc(doc(db, "tips", `${gameId}_${auth.currentUser.uid}`));
        const existingTip = existingTipDoc.exists() ? existingTipDoc.data() : null;
        
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
            <input id="tipHome_${gameId}" type="number" placeholder="${game.homeTeam}" 
              value="${homeValue}" style="width: 60px;" ${!canUserTip ? 'disabled' : ''}>
            <span style="margin: 0 5px;">-</span>
            <input id="tipAway_${gameId}" type="number" placeholder="${game.awayTeam}" 
              value="${awayValue}" style="width: 60px;" ${!canUserTip ? 'disabled' : ''}>
            <button id="tipBtn_${gameId}" ${!canUserTip ? 'disabled' : ''}>${buttonText}</button>
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
      const dateStr = game.gameTime ? formatDateTime(game.gameTime).split(' kl.')[0] : 'Engin tími';
      opt.textContent = `${dateStr} - ${game.homeTeam} vs ${game.awayTeam}`;
      resultSelect.appendChild(opt);
      bonusSelect.appendChild(opt.cloneNode(true));
      deleteSelect.appendChild(opt.cloneNode(true));
    }
  } catch (error) {
    handleError(error, "Villa við að hlaða leikjum");
    list.innerHTML = "<li>Villa við að hlaða leiki</li>";
  }
}

async function loadBonusQuestionsForGame(gameId, canAnswer) {
  try {
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
  } catch (error) {
    console.error("Villa við að hlaða bónusspurningum:", error);
    return "";
  }
}

async function loadBonusAnswersForGame(gameId, gameStarted) {
  if (!gameStarted) return "";
  
  try {
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
  } catch (error) {
    console.error("Villa við að hlaða bónussvar:", error);
    return "";
  }
}

async function attachBonusEventListeners(gameId) {
  try {
    const questionsSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
    
    for (let qDoc of questionsSnap.docs) {
      const qId = qDoc.id;
      const btn = document.getElementById(`bonusBtn_${qId}`);
      if (btn) {
        btn.addEventListener('click', () => submitBonusAnswer(qId, gameId));
      }
    }
  } catch (error) {
    console.error("Villa við að tengja event listeners:", error);
  }
}

async function submitBonusAnswer(questionId, gameId) {
  const input = document.getElementById(`bonus_${questionId}`);
  if (!input) return;
  
  const answer = input.value.trim();
  if (!answer) return alert("Settu inn svar!");
  
  showLoading(true);
  try {
    const gameDoc = await getDoc(doc(db, "games", gameId));
    if (gameDoc.exists() && !canTip(gameDoc.data().gameTime)) {
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
    
    alert("Svar vistað!");
    await loadGames();
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
    const gameDoc = await getDoc(doc(db, "games", gameId));
    if (gameDoc.exists() && !canTip(gameDoc.data().gameTime)) {
      alert("Of seint að tippa á þennan leik!");
      return;
    }
    
    // Athuga hvort þetta er uppfærsla eða nýtt tip
    const existingTipDoc = await getDoc(doc(db, "tips", `${gameId}_${auth.currentUser.uid}`));
    const isUpdate = existingTipDoc.exists();

    await setDoc(doc(db, "tips", `${gameId}_${auth.currentUser.uid}`), {
      gameId,
      leagueId: activeLeagueId,
      userId: auth.currentUser.uid,
      prediction,
      points: 0,
      tippedAt: Timestamp.now()
    });

    alert(isUpdate ? "Tip uppfært! ✓" : "Tip skráð! ✓");
    await loadGames();
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
    
    await loadGames();
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
    
    // Eyða öllum tippum
    const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
    tipsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eyða öllum bónusspurningum og svorunum
    const bonusQSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
    for (let qDoc of bonusQSnap.docs) {
      const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
      answersSnap.docs.forEach(doc => batch.delete(doc.ref));
      batch.delete(qDoc.ref);
    }
    
    // Eyða leiknum
    batch.delete(doc(db, "games", gameId));
    
    await batch.commit();
    
    // Uppfæra stig
    await recalculateAllPoints();
    
    alert("Leik eytt!");
    await loadGames();
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
    const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
    const leagueSnap = await getDoc(doc(db, "leagues", activeLeagueId));
    
    if (!leagueSnap.exists()) {
      container.innerHTML = "<p>Deild fannst ekki</p>";
      return;
    }
    
    const ownerId = leagueSnap.data().ownerId;
    
    if (membersSnap.empty) {
      container.innerHTML = "<p>Engir notendur í deild</p>";
      return;
    }
    
    container.innerHTML = "";
    
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
    
    // Eyða öllum tippum
    const tipsSnap = await getDocs(query(
      collection(db, "tips"),
      where("userId", "==", userId),
      where("leagueId", "==", activeLeagueId)
    ));
    tipsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eyða öllum bónussvorunum
    const answersSnap = await getDocs(query(
      collection(db, "bonusAnswers"),
      where("userId", "==", userId),
      where("leagueId", "==", activeLeagueId)
    ));
    answersSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eyða notandanum
    batch.delete(doc(db, "leagueMembers", memberId));
    
    await batch.commit();
    
    alert(`${username} hefur verið fjarlægður úr deildinni`);
    
    document.getElementById("viewMembersBtn").click();
    await loadScores();
  } catch (error) {
    handleError(error, "Villa við að fjarlægja notanda");
  } finally {
    showLoading(false);
  }
};

document.getElementById("deleteLeagueBtn")?.addEventListener("click", async () => {
  const leagueDoc = await getDoc(doc(db, "leagues", activeLeagueId));
  if (!leagueDoc.exists()) {
    alert("Deild fannst ekki");
    return;
  }
  
  const leagueName = leagueDoc.data().name;
  
  const confirmation = prompt(`VIÐVÖRUN: Þetta eyðir ÖLLU í deildinni "${leagueName}".\n\nSkrifaðu "EYÐA" til að staðfesta:`);
  
  if (confirmation !== "EYÐA") {
    alert("Hætt við");
    return;
  }
  
  showLoading(true);
  try {
    // Eyða öllum leikjum og tengdum gögnum
    const gamesSnap = await getDocs(query(collection(db, "games"), where("leagueId", "==", activeLeagueId)));
    
    for (let gameDoc of gamesSnap.docs) {
      const gameId = gameDoc.id;
      
      const batch = writeBatch(db);
      let batchCount = 0;
      
      // Eyða tippum
      const tipsSnap = await getDocs(query(collection(db, "tips"), where("gameId", "==", gameId)));
      tipsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
        batchCount++;
      });
      
      // Eyða bónusspurningum og svorunum
      const bonusQSnap = await getDocs(query(collection(db, "bonusQuestions"), where("gameId", "==", gameId)));
      for (let qDoc of bonusQSnap.docs) {
        const answersSnap = await getDocs(query(collection(db, "bonusAnswers"), where("questionId", "==", qDoc.id)));
        answersSnap.docs.forEach(doc => {
          batch.delete(doc.ref);
          batchCount++;
        });
        batch.delete(qDoc.ref);
        batchCount++;
      }
      
      // Eyða leiknum
      batch.delete(gameDoc.ref);
      batchCount++;
      
      if (batchCount > 0) {
        await batch.commit();
      }
    }
    
    // Eyða öllum notendum
    const batch = writeBatch(db);
    const membersSnap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
    membersSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eyða deildinni
    batch.delete(doc(db, "leagues", activeLeagueId));
    
    await batch.commit();
    
    alert(`Deild "${leagueName}" hefur verið eytt`);
    
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
   STIGATAFLA
========================= */
async function loadScores() {
  const ul = document.getElementById("leagueScores");
  ul.innerHTML = "<li>Hleð stigatöflu...</li>";

  try {
    const snap = await getDocs(query(collection(db, "leagueMembers"), where("leagueId", "==", activeLeagueId)));
    
    if (snap.empty) {
      ul.innerHTML = "<li>Engir notendur í deild</li>";
      return;
    }
    
    let members = snap.docs.map(d => d.data());
    members.sort((a,b) => b.points - a.points);

    ul.innerHTML = "";
    
    for (let data of members) {
      const li = document.createElement("li");
      li.textContent = `${data.username} – ${data.points} stig`;
      ul.appendChild(li);
    }
  } catch (error) {
    handleError(error, "Villa við að hlaða stigatöflu");
    ul.innerHTML = "<li>Villa við að hlaða stigatöflu</li>";
  }
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