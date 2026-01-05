<!-- Í adminPanel, fyrir ofan "Búa til leik" -->
<div style="margin-bottom: 20px;">
  <h3>📋 Leikir úr Google Sheets</h3>
  <p style="color: #666; margin-bottom: 10px; font-weight: 500;">Sækja leiki beint úr Google Sheet</p>
  
  <!-- Leitarreitur -->
  <input 
    type="text" 
    id="gameSearchInput" 
    placeholder="🔍 Leita að liði, dagsetningu eða keppni..." 
    style="margin-bottom: 10px; width: 100%; max-width: 100%;">
  
  <button id="refreshGamesBtn" style="background: var(--success);">🔄 Sækja leiki</button>
  
  <!-- Leikjalisti með skrun -->
  <div id="availableGamesContainer" style="
    margin-top: 15px; 
    max-height: 500px; 
    overflow-y: auto; 
    border: 2px solid var(--border); 
    border-radius: 12px; 
    padding: 12px;
    background: #f9fafb;
    display: none;">
    <div id="availableGamesList"></div>
  </div>
</div>

<div style="border-top: 2px solid var(--border); padding-top: 20px; margin: 20px 0;"></div>