// app.js - komplette, einsatzbereite App
// - Chart.js (deferred) wird erwartet
// - index.html & styles.css wie geliefert

(() => {
  'use strict';

  // Helpers
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const KEY = 'bp_v2_state';
  const fmtCHF = v => `CHF ${Number(v||0).toFixed(2)}`;
  const normalizeSharpS = s => String(s||'').replace(/ß/g,'ss');

  // Initial state
  let state = {
    name: '',
    budget: 0,
    transactions: [], // {id,desc,amount,category,date}
    theme: 'standard',
    payday: 1 // default day of month
  };

  // Load / Save
  function loadState(){
    try{
      const raw = localStorage.getItem(KEY);
      if(raw) state = Object.assign(state, JSON.parse(raw));
    }catch(e){ console.warn('load error', e); }
  }
  function saveState(){
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ console.warn('save error', e); }
  }

  // Elements
  const refs = {
    greeting:'#greeting', monthRange:'#monthRange', monthLabel:'#monthLabel', currentDate:'#currentDate',
    totalBudget:'#totalBudget', saveBudget:'#saveBudget', remaining:'#remaining', spent:'#spent',
    txDesc:'#txDesc', txAmount:'#txAmount', txCategory:'#txCategory', addTx:'#addTx',
    categoryChart:'#categoryChart', percentageChart:'#percentageChart',
    historyList:'#historyList', allList:'#allList', filterCategory:'#filterCategory', searchHistory:'#searchHistory',
    exportCSV:'#exportCSV', exportWord:'#exportWord', exportChart:'#exportChart', resetHistory:'#resetHistory',
    settingsExportCSV:'#settingsExportCSV', settingsExportWord:'#settingsExportWord', settingsExportChart:'#settingsExportChart',
    welcomeModal:'#welcomeModal', welcomeName:'#welcomeName', welcomeSave:'#welcomeSave',
    infoModal:'#infoModal', infoNext:'#infoNext',
    paydayModal:'#paydayModal', paydayInput:'#paydayInput', savePayday:'#savePayday',
    userName:'#userName', saveName:'#saveName',
    themeBtns:'[data-theme-select]',
    themeGrid:'.theme-grid',
    savedList:'#savedList'
  };

  // Chart instances
  let categoryChart = null, percentageChart = null;

  // Utility
  function uid(prefix='') { return prefix + Math.random().toString(36).slice(2,9); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

  // Header + quote rotation
  const quotes = [
    'Kleine Schritte, grosse Wirkung.',
    'Spare heute, geniesse morgen.',
    'Kenne deine Ausgaben, meistere dein Leben.',
    'Jeder Franken zählt.',
    'Bewusst leben, bewusst sparen.'
  ];
  function dailyQuote(){
    const now = new Date();
    return quotes[now.getDate() % quotes.length];
  }

  function updateHeader(){
    const name = state.name || '';
    const now = new Date();
    const monthName = now.toLocaleString('de-DE',{month:'long'});
    const year = now.getFullYear();
    $('#greeting') && ($('#greeting').textContent = name ? `Hallo ${normalizeSharpS(name)}` : 'Hallo');
    // budget word gets gradient via CSS variable
    $('#monthRange') && ($('#monthRange').innerHTML = `<span id="budgetWord" style="background:var(--accent-gradient);-webkit-background-clip:text;color:transparent;font-weight:900">Budget</span> <span id="monthLabel">für ${monthName} ${year}</span>`);
    $('#currentDate') && ($('#currentDate').textContent = now.toLocaleString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}));
    // quote
    $('#dailyQuote') && ($('#dailyQuote').textContent = `"${dailyQuote()}"`.replace(/"/g,''));
    // set color of quote marks to theme contrast via CSS
  }

  // Charts creation/update
  function createCharts(){
    const cat = $(refs.categoryChart);
    const pct = $(refs.percentageChart);
    if(!cat || !pct) return;
    if(categoryChart) categoryChart.destroy();
    if(percentageChart) percentageChart.destroy();
    categoryChart = new Chart(cat.getContext('2d'), {
      type:'bar',
      data:{ labels:[], datasets:[{ label:'Betrag CHF', data:[], backgroundColor:[] }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
    percentageChart = new Chart(pct.getContext('2d'), {
      type:'doughnut',
      data:{ labels:[], datasets:[{ data:[], backgroundColor:[] }] },
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }

  function updateCharts(){
    if(!categoryChart || !percentageChart) return;
    const sums = {};
    state.transactions.forEach(t => sums[t.category] = (sums[t.category]||0) + Number(t.amount||0));
    const labels = Object.keys(sums);
    const data = labels.map(l => sums[l]);
    const colors = labels.map((_,i)=>`hsl(${(i*55)%360} 78% 55%)`);
    categoryChart.data.labels = labels; categoryChart.data.datasets[0].data = data; categoryChart.data.datasets[0].backgroundColor = colors; categoryChart.update();
    percentageChart.data.labels = labels; percentageChart.data.datasets[0].data = data; percentageChart.data.datasets[0].backgroundColor = colors; percentageChart.update();
  }

  // Summary + low remaining highlight (<200 CHF)
  function updateSummary(){
    const spent = state.transactions.reduce((s,t)=>s + Number(t.amount||0),0);
    const remaining = Math.max(0, (Number(state.budget||0) - spent));
    $('#spent') && ($('#spent').textContent = fmtCHF(spent));
    const remEl = $('#remaining');
    if(remEl){
     
