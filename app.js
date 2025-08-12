// ========================
// State & Init
// ========================
let state = {
  name: '',
  budget: 0,
  transactions: [],
  theme: 'standard',
  payday: 1,
  savedRecords: [],
  categories: []
};

const quotes = [
  "Spare in der Zeit, dann hast du in der Not.",
  "Kleine Ausgaben summieren sich zu großen.",
  "Ein Budget ist der Plan für dein Geld.",
  "Gib weniger aus als du verdienst.",
  "Sparen ist der erste Schritt zum Vermögen."
];

function $(sel) { return document.querySelector(sel); }
function saveState() { localStorage.setItem('budgetState', JSON.stringify(state)); }
function loadState() {
  const saved = localStorage.getItem('budgetState');
  if (saved) state = JSON.parse(saved);
}
function ensureCategories() {
  if (!state.categories || !state.categories.length) {
    state.categories = ['Handyabo','Fonds','Eltern','Verpflegung','Frisör','Sparen','Geschenke','Sonstiges'];
  }
}

// ========================
// Init
// ========================
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadState();
  ensureCategories();
  applyTheme(state.theme);
  updateGreeting();
  refreshCategorySelect();
  renderTransactions();
  renderCategoriesList();
  renderSavedAmount();
  renderQuote();

  wireUI();
}

// ========================
// UI Functions
// ========================
function updateGreeting() {
  const now = new Date();
  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  $('#greeting').textContent = `Hallo ${state.name || ''}`;
  $('#monthRange').innerHTML = `<span id="budgetWord">Budget</span> für ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  $('#currentDate').textContent = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
}

function renderQuote() {
  const today = new Date();
  const idx = today.getDate() % quotes.length;
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-gradient');
  $('#quote').innerHTML = `<span style="background:${themeColor};-webkit-background-clip:text;color:transparent;">“</span>${quotes[idx]}<span style="background:${themeColor};-webkit-background-clip:text;color:transparent;">”</span>`;
}

function refreshCategorySelect() {
  const sel = $('#txCategory');
  const filt = $('#filterCategory');
  const cats = state.categories.slice().sort();
  sel.innerHTML = '';
  cats.forEach(c=>{
    const o = document.createElement('option');
    o.value = o.textContent = c;
    sel.appendChild(o);
  });
  if (filt) {
    filt.innerHTML = '<option value="">Alle Kategorien</option>';
    cats.forEach(c=>{
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      filt.appendChild(o);
    });
  }
}

function renderTransactions() {
  const list = $('#historyList');
  if (!list) return;
  list.innerHTML = '';
  state.transactions.forEach(tx=>{
    const div = document.createElement('div');
    div.className = 'panel';
    div.innerHTML = `<strong>${tx.category}</strong> – ${tx.desc} – CHF ${tx.amount.toFixed(2)}`;
    list.appendChild(div);
  });
  updateBudgetSummary();
}

function updateBudgetSummary() {
  const spent = state.transactions.reduce((sum, t)=> sum + t.amount, 0);
  const remaining = state.budget - spent;
  $('#spent').textContent = `CHF ${spent.toFixed(2)}`;
  const remEl = $('#remaining');
  remEl.textContent = `CHF ${remaining.toFixed(2)}`;
  if (remaining < 200) {
    remEl.classList.add('red-alert');
  } else {
    remEl.classList.remove('red-alert');
  }
}

function renderSavedAmount() {
  const spent = state.transactions.reduce((sum, t)=> sum + t.amount, 0);
  const saved = state.budget - spent;
  $('#savedAmount').textContent = `CHF ${saved.toFixed(2)}`;
}

function renderCategoriesList(){
  const list = $('#categoriesList');
  list.innerHTML = '';
  state.categories.forEach(cat=>{
    const row = document.createElement('div');
    row.className = 'panel cat-item';
    row.innerHTML = `
      <div class="cat-name">${cat}</div>
      <div style="display:flex;
