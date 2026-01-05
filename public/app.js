// GOOGLE SHEETS INTEGRATION - UPPFÆRT MEÐ LEIT OG PAGINATION
const SHEET_ID = '15LQbx0CbACqEgtPpb5IC_EK3aJRavGoKgv7BFo7t9bA';
const SHEET_NAME = 'Sheet1';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

let availableGamesFromSheet = [];
let filteredGamesFromSheet = [];
let displayedGamesCount = 0;
const GAMES_PER_PAGE = 5;

// Sækja leiki úr Google Sheets
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
  
  // Ef þetta er fyrsta skiptið, hreinsa listann
  if (displayedGamesCount === 0) {
    container.innerHTML = '';
  }
  
  // Sækja næstu N leiki
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
    const globalIndex = displayedGamesCount + i;
    
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
    
    // Parse dagsetning fyrir betri birtingu
    let displayDate = game.gameTime;
    try {
      const dateTimeParts = game.gameTime.split('/');
      if (dateTimeParts.length >= 3) {
        const datePart = `${dateTimeParts[2]}.${dateTimeParts[1]}.${dateTimeParts[0].substring(2)}`;
        const timePart = dateTimeParts[3] || '';
        displayDate = `${datePart} kl. ${timePart}`;
      }
    } catch (e) {
      // Nota upprunalega dagsetninguna ef parsing mistekst
    }
    
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
    
    // Hover effects
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
  
  // Sýna "hlaða meira" skilaboð ef það eru fleiri leikir
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
    
    loadMoreDiv.onmouseover = () => {
      loadMoreDiv.style.color = 'var(--secondary)';
    };
    
    loadMoreDiv.onmouseout = () => {
      loadMoreDiv.style.color = 'var(--primary)';
    };
    
    container.appendChild(loadMoreDiv);
  }
}

// Infinite scroll fyrir leikjalista
function setupInfiniteScrollForGames() {
  const container = document.getElementById('availableGamesContainer');
  if (!container) return;
  
  container.addEventListener('scroll', () => {
    const scrollPosition = container.scrollTop + container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    // Ef notandi er kominn næstum neðst
    if (scrollPosition >= scrollHeight - 50) {
      if (displayedGamesCount < filteredGamesFromSheet.length) {
        // Fjarlægja "load more" indicator ef til staðar
        const loadMoreIndicator = document.getElementById('loadMoreIndicator');
        if (loadMoreIndicator) {
          loadMoreIndicator.remove();
        }
        displayGamesFromSheet();
      }
    }
  });
}

// Sýna leiki frá Google Sheets - UPPFÆRT
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
    
    // Núllstilla teljarar
    displayedGamesCount = 0;
    filteredGamesFromSheet = [...games];
    
    // Sýna fyrstu leikina
    displayGamesFromSheet();
    
    // Setja upp scroll event listener
    setupInfiniteScrollForGames();
    
  } catch (error) {
    handleError(error, "Villa við að sýna leiki");
    container.innerHTML = "<p style='padding: 15px; text-align: center; color: #dc3545;'>Villa við að hlaða leikjum</p>";
  }
}

// Bæta leik við deild úr Google Sheet - SAMA OG ÁÐUR
window.addGameFromSheet = async (index) => {
  const game = availableGamesFromSheet[index];
  if (!game) return alert("Leikur fannst ekki!");
  
  showLoading(true);
  try {
    const dateTimeParts = game.gameTime.split('/');
    const dateParts = dateTimeParts[0].split('-');
    const timeParts = dateTimeParts[1].split(':');
    
    const gameDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeParts[0]),
      parseInt(timeParts[1])
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

// Event listener fyrir leitarreit
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('gameSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchGamesFromSheet(e.target.value);
    });
  }
});

// Refresh leiki úr Google Sheets - UPPFÆRT
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