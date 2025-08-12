// app.js - vollständige App (Charts, CRUD, Exporte, Themes, Payday, Saved)
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const KEY = 'budget_planner_v3_full';
  const fmtCHF = v => `CHF ${Number(v||0).toFixed(2)}`;
  const normalizeSharpS = s => String(s||'').replace(/ß/g,'ss');

  // default state
  let state = {
    name: '',
    budget: 0,
    transactions: [], // {id,desc,amount,category,date}
    theme: 'standard',
    payday: 1,
    savedRecords: [] // {periodLabel, startDate, endDate, savedAmount}
  };

  // load / save
  function loadState(){
    try{ const raw = localStorage.getItem(KEY); if(raw) state = Object.assign(state, JSON.parse(raw)); }catch(e){console.warn(e)}
  }
  function saveState(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){console.warn(e)} }

  // utilities
  function uid(p='') { return p + Math.random().toString(36).slice(2,9); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

  // charts
  let categoryChart = null, percentageChart = null;
  function createCharts(){
    const cat = $('#categoryChart'); const pct = $('#percentageChart');
    if(!cat || !pct) return;
    if(categoryChart) categoryChart.destroy();
    if(percentageChart) percentageChart.destroy();
    categoryChart = new Chart(cat.getContext('2d'), {
      type:'bar',
      data:{ labels:[], datasets:[{ label:'Betrag', data:[], backgroundColor:[] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
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

  // header + quote
  const quotes = ['Kleine Schritte, grosse Wirkung.','Spare heute, geniesse morgen.','Kenne deine Ausgaben, meistere dein Leben.','Jeder Franken zählt.','Bewusst leben, bewusst sparen.'];
  function dailyQuote(){
    const now = new Date();
    return quotes[now.getDate() % quotes.length];
  }
  function updateHeader(){
    const name = state.name || '';
    const now = new Date();
    const month = now.toLocaleString('de-DE',{month:'long'}); const year = now.getFullYear();
    $('#greeting') && ($('#greeting').textContent = name ? `Hallo ${normalizeSharpS(name)}` : 'Hallo');
    $('#monthRange') && ($('#monthRange').innerHTML = `<span id="budgetWord" style="background:var(--accent-gradient);-webkit-background-clip:text;color:transparent;font-weight:900">Budget</span> <span id="monthLabel">für ${month} ${year}</span>`);
    $('#currentDate') && ($('#currentDate').textContent = now.toLocaleString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}));
    $('#dailyQuote') && ($('#dailyQuote').textContent = dailyQuote());
    // quote marks colored via CSS using --accent-contrast
  }

  // summary update (low remaining <200 CHF highlight)
  function updateSummary(){
    const spent = state.transactions.reduce((s,t)=> s + Number(t.amount||0), 0);
    const remaining = Math.max(0, (Number(state.budget||0) - spent));
    $('#spent') && ($('#spent').textContent = fmtCHF(spent));
    const remEl = $('#remaining');
    if(remEl){
      remEl.textContent = fmtCHF(remaining);
      if(remaining < 200) remEl.classList.add('low-remaining'); else remEl.classList.remove('low-remaining');
    }
  }

  // render history & list
  function renderHistory(){
    const cont = $('#historyList'); if(!cont) return; cont.innerHTML = '';
    const items = state.transactions.slice().reverse();
    if(!items.length){ const e=document.createElement('div'); e.className='muted'; e.textContent='Keine Einträge.'; cont.appendChild(e); return; }
    items.forEach(tx => {
      const d = document.createElement('div'); d.className='panel';
      d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:800">${escapeHtml(tx.desc)}</div><div style="font-size:12px;color:rgba(6,22,36,0.45)">${new Date(tx.date).toLocaleString()}</div></div>
        <div style="text-align:right"><div style="font-weight:900">${fmtCHF(tx.amount)}</div><div style="margin-top:6px"><button class="btn btn-danger btn-small" data-delete="${tx.id}">Löschen</button></div></div>
      </div>`;
      cont.appendChild(d);
    });
  }

  function renderAllList(filterText='', filterCategory=''){
    const all = $('#allList'); if(!all) return; all.innerHTML='';
    const filtered = state.transactions.filter(t=>{
      const qc = !filterCategory || t.category === filterCategory;
      const q = (filterText||'').toLowerCase();
      const qt = !q || (t.desc||'').toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q);
      return qc && qt;
    });
    if(!filtered.length){ const e=document.createElement('div'); e.className='muted'; e.textContent='Keine Einträge.'; all.appendChild(e); return; }
    filtered.forEach(t=>{
      const it=document.createElement('div'); it.className='panel';
      it.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${escapeHtml(t.category)} — ${escapeHtml(t.desc)}</div><div style="font-weight:900">${fmtCHF(t.amount)}</div></div>`;
      all.appendChild(it);
    });
  }

  // category select refresh
  function refreshCategorySelect(){
    const sel = $('#txCategory'); const filt = $('#filterCategory'); if(!sel||!filt) return;
    const defaults = ['Handyabo','Fonds','Eltern','Verpflegung','Frisör','Sparen','Geschenke','Sonstiges'];
    const cats = Array.from(new Set([...defaults, ...state.transactions.map(t=>t.category)])).sort();
    sel.innerHTML=''; cats.forEach(c=>{ const o=document.createElement('option'); o.value=o.textContent=c; sel.appendChild(o); });
    // filterCategory
    filt.innerHTML = '<option value="">Alle Kategorien</option>'; cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; filt.appendChild(o); });
  }

  // add / delete tx
  function addTransaction(desc, amount, category){
    const t = { id: uid('t_'), desc: desc || '—', amount: Number(amount), category: category || 'Sonstiges', date: new Date().toISOString() };
    state.transactions.push(t); saveState(); updateSummary(); renderHistory(); renderAllList(); refreshCategorySelect(); updateCharts();
  }
  function deleteTransaction(id){
    state.transactions = state.transactions.filter(t=>t.id!==id); saveState(); updateSummary(); renderHistory(); renderAllList(); refreshCategorySelect(); updateCharts();
  }

  // export CSV
  function exportCSV(){
    if(!state.transactions.length){ alert('Keine Daten zum Exportieren'); return; }
    const rows=[['Kategorie','Beschreibung','Betrag','Datum']];
    state.transactions.forEach(t=>rows.push([t.category,t.desc,t.amount,t.date]));
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`verlauf_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  // export Word (.doc as HTML) sorted by category with subtotal per category + total
  function exportWord(){
    if(!state.transactions.length){ alert('Keine Daten zum Exportieren'); return; }
    // group by category
    const groups = {};
    state.transactions.forEach(t=>{
      if(!groups[t.category]) groups[t.category]=[];
      groups[t.category].push(t);
    });
    // build HTML table
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Verlauf</title></head><body><h2>Verlauf</h2>`;
    html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Nunito, sans-serif;">`;
    html += `<thead><tr><th>Kategorie</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody>`;
    let grandTotal = 0;
    Object.keys(groups).sort().forEach(cat=>{
      const items = groups[cat];
      let subtotal = 0;
      items.forEach(it=>{
        html += `<tr><td>${escapeHtml(cat)}</td><td>${escapeHtml(it.desc)}</td><td style="text-align:right">${Number(it.amount).toFixed(2)}</td></tr>`;
        subtotal += Number(it.amount);
      });
      html += `<tr style="font-weight:700;background:#f4f4f4"><td colspan="2">Total ${escapeHtml(cat)}</td><td style="text-align:right">${subtotal.toFixed(2)}</td></tr>`;
      grandTotal += subtotal;
    });
    html += `<tr style="font-weight:900;background:#e9f7ef"><td colspan="2">Gesamt</td><td style="text-align:right">${grandTotal.toFixed(2)}</td></tr>`;
    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `verlauf_${new Date().toISOString().slice(0,10)}.doc`; a.click(); URL.revokeObjectURL(url);
  }

  // export chart as PNG (image)
  function exportChartPNG(){
    try{
      if(!categoryChart){ alert('Kein Diagramm verfügbar'); return; }
      const url = categoryChart.toBase64Image();
      const a = document.createElement('a'); a.href = url; a.download = `diagramm_${new Date().toISOString().slice(0,10)}.png`; a.click();
    }catch(e){ console.warn(e); alert('Diagramm-Export fehlgeschlagen'); }
  }

  // calculate saved per period (period defined by payday)
  function computeSavedRecords(){
    // determine transactions by period boundaries using payday
    // We'll produce periods for months that have transactions or current month
    const payday = Number(state.payday) || 1;
    const txs = state.transactions.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
    const periods = []; // {start:Date,end:Date,label}
    // determine a reasonable range: from earliest tx (or current month -1) to now
    const now = new Date();
    let startRef = txs.length ? new Date(txs[0].date) : new Date();
    // set startRef to the period start containing earliest tx
    startRef = periodStartForDate(startRef, payday);
    // go until current period
    let curStart = startRef;
    while(curStart <= now){
      const curEnd = new Date(curStart); curEnd.setMonth(curEnd.getMonth()+1); curEnd.setDate(payday); curEnd.setHours(0,0,0,0); curEnd.setDate(curEnd.getDate()-1); // end is day before next payday
      const label = `${curStart.toLocaleString('de-DE',{month:'short', year:'numeric'})}`;
      periods.push({ start: new Date(curStart), end: new Date(curEnd), label });
      curStart = new Date(curStart); curStart.setMonth(curStart.getMonth()+1);
    }
    // compute saved for each period
    const records = periods.map(p=>{
      const spent = state.transactions.filter(t=> new Date(t.date) >= p.start && new Date(t.date) <= p.end ).reduce((s,t)=> s + Number(t.amount||0), 0);
      const saved = (Number(state.budget || 0) - spent);
      return { periodLabel: p.label, startDate: p.start.toISOString(), endDate: p.end.toISOString(), savedAmount: saved };
    });
    state.savedRecords = records;
    saveState();
    renderSavedList();
  }

  function periodStartForDate(d, payday){
    // returns Date that is the start-of-period (this period's payday day) containing date d
    const day = Number(payday) || 1;
    const y = d.getFullYear();
    const m = d.getMonth();
    const candidate = new Date(y, m, day, 0,0,0,0);
    if(d >= candidate) return candidate;
    // otherwise previous month payday
    const prev = new Date(y, m-1, day,0,0,0,0);
    return prev;
  }

  function renderSavedList(){
    const out = $('#savedList'); if(!out) return; out.innerHTML='';
    if(!state.savedRecords.length){ const e=document.createElement('div'); e.className='muted'; e.textContent='Keine Daten.'; out.appendChild(e); return; }
    state.savedRecords.slice().reverse().forEach(r=>{
      const d=document.createElement('div'); d.className='panel';
      d.innerHTML = `<div style="display:flex;justify-content:space-between"><div style="font-weight:700">${escapeHtml(r.periodLabel)}</div><div style="font-weight:900">${fmtCHF(r.savedAmount)}</div></div>`;
      out.appendChild(d);
    });
  }

  // UI wiring
  function wireUI(){
    // tabs
    $$('.nav-btn').forEach(btn=>{
      btn.addEventListener('click', ()=> {
        $$('.nav-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        $$('.tab').forEach(t => {
          t.style.display = (t.id === `tab-${tab}`) ? 'block' : 'none';
        });
        // if saved tab selected, ensure compute records
        if(tab === 'saved'){ computeSavedRecords(); }
      });
    });

    // save budget
    $('#saveBudget') && $('#saveBudget').addEventListener('click', ()=>{
      const v = Number($('#totalBudget').value) || 0;
      state.budget = v; saveState(); updateSummary(); computeSavedRecords();
      alert('Budget gespeichert');
    });

    // add tx
    $('#addTx') && $('#addTx').addEventListener('click', ()=>{
      const desc = ($('#txDesc').value || '').trim() || '—';
      const amount = parseFloat($('#txAmount').value);
      const category = ($('#txCategory').value || '').trim() || 'Sonstiges';
      if(!amount || isNaN(amount)){ alert('Bitte gültigen Betrag eingeben'); return; }
      addTransaction(desc, amount, category);
    });

    // delete via delegation
    $('#historyList') && $('#historyList').addEventListener('click', (e)=>{
      const d = e.target.closest('[data-delete]');
      if(d){ const id = d.getAttribute('data-delete'); if(confirm('Eintrag wirklich löschen?')) deleteTransaction(id); }
    });

    // exports
    $('#exportCSV') && $('#exportCSV').addEventListener('click', exportCSV);
    $('#exportWord') && $('#exportWord').addEventListener('click', exportWord);
    $('#exportChart') && $('#exportChart').addEventListener('click', exportChartPNG);

    // settings exports
    $('#settingsExportCSV') && $('#settingsExportCSV').addEventListener('click', exportCSV);
    $('#settingsExportWord') && $('#settingsExportWord').addEventListener('click', exportWord);
    $('#settingsExportChart') && $('#settingsExportChart').addEventListener('click', exportChartPNG);

    // reset
    $('#resetHistory') && $('#resetHistory').addEventListener('click', ()=>{
      if(!confirm('Verlauf wirklich löschen?')) return;
      state.transactions = []; saveState(); updateSummary(); renderHistory(); renderAllList(); refreshCategorySelect(); updateCharts(); computeSavedRecords();
    });

    // save name -> open info modal then payday modal
    $('#saveName') && $('#saveName').addEventListener('click', ()=>{
      const nameVal = normalizeSharpS($('#userName').value || '').trim();
      if(!nameVal){ alert('Bitte Namen eingeben'); return; }
      state.name = nameVal; saveState(); updateHeader();
      // show info modal
      $('#infoModal').setAttribute('aria-hidden','false');
    });

    // welcome modal save -> then info modal
    $('#welcomeSave') && $('#welcomeSave').addEventListener('click', ()=>{
      const v = normalizeSharpS($('#welcomeName').value||'').trim();
      if(!v){ alert('Bitte Namen eingeben'); return; }
      state.name = v; saveState(); updateHeader();
      $('#welcomeModal').setAttribute('aria-hidden','true');
      $('#infoModal').setAttribute('aria-hidden','false');
    });

    // info next -> payday modal
    $('#infoNext') && $('#infoNext').addEventListener('click', ()=>{
      $('#infoModal').setAttribute('aria-hidden','true');
      $('#paydayModal').setAttribute('aria-hidden','false');
    });

    // save payday
    $('#savePayday') && $('#savePayday').addEventListener('click', ()=>{
      const d = parseInt($('#paydayInput').value,10);
      if(!d || d < 1 || d > 28){ alert('Bitte Tag zwischen 1 und 28 eingeben'); return; }
      state.payday = d; saveState();
      $('#paydayModal').setAttribute('aria-hidden','true');
      computeSavedRecords();
      alert('Zahltag gespeichert');
    });

    // theme buttons
    $$('[data-theme-select]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const t = b.getAttribute('data-theme-select');
        applyTheme(t);
      });
    });

    // search & filter in list
    $('#searchHistory') && $('#searchHistory').addEventListener('input', ()=>{
      renderAllList($('#searchHistory').value||'', $('#filterCategory').value||'');
    });
    $('#filterCategory') && $('#filterCategory').addEventListener('change', ()=> renderAllList($('#searchHistory').value||'', $('#filterCategory').value||''));

    // allList delete delegation not needed (read-only)

    // keyboard enter shortcuts
    ['totalBudget','txAmount','txDesc','userName','welcomeName','paydayInput'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){ e.preventDefault();
          if(id === 'totalBudget') $('#saveBudget') && $('#saveBudget').click();
          else if(id === 'txAmount' || id === 'txDesc') $('#addTx') && $('#addTx').click();
          else if(id === 'userName') $('#saveName') && $('#saveName').click();
          else if(id === 'welcomeName') $('#welcomeSave') && $('#welcomeSave').click();
          else if(id === 'paydayInput') $('#savePayday') && $('#savePayday').click();
        }
      });
    });

    // history delete (allList optional)
    $('#allList') && $('#allList').addEventListener('click',(e)=>{
      const d = e.target.closest('[data-delete]');
      if(d){ const id=d.getAttribute('data-delete'); if(confirm('Eintrag wirklich löschen?')) deleteTransaction(id); }
    });

    // resize charts
    window.addEventListener('resize', ()=> { try{ categoryChart?.resize(); percentageChart?.resize(); }catch(e){} }, { passive:true });
  }

  // theme apply
  function applyTheme(theme){
    state.theme = theme || 'standard'; saveState();
    document.documentElement.setAttribute('data-theme', state.theme);
    // ensure budgetWord updated color via header update
    updateHeader();
    // mark active buttons
    $$('[data-theme-select]').forEach(b=> b.classList.toggle('active', b.dataset.themeSelect === state.theme));
  }

  // initial UI fill
  function initUI(){
    // set inputs
    $('#totalBudget') && ($('#totalBudget').value = state.budget || '');
    $('#userName') && ($('#userName').value = state.name || '');
    $('#paydayInput') && ($('#paydayInput').value = state.payday || 1);
    // categories
    refreshCategorySelect();
    // apply theme
    document.documentElement.setAttribute('data-theme', state.theme || 'standard');
    // show welcome/info if needed
    if(!state.name){
      $('#welcomeModal') && $('#welcomeModal').setAttribute('aria-hidden','false');
    } else {
      // nothing
    }
  }

  // refreshCategorySelect reuse
  function refreshCategorySelect(){
    const sel = $('#txCategory'); const filt = $('#filterCategory'); if(!sel||!filt) return;
    const defaults = ['Handyabo','Fonds','Eltern','Verpflegung','Frisör','Sparen','Geschenke','Sonstiges'];
    const cats = Array.from(new Set([...defaults, ...state.transactions.map(t=>t.category)])).sort();
    sel.innerHTML = ''; cats.forEach(c=>{ const o=document.createElement('option'); o.value=o.textContent=c; sel.appendChild(o); });
    filt.innerHTML = '<option value="">Alle Kategorien</option>'; cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; filt.appendChild(o); });
  }

  // init (load & render)
  function init(){
    loadState();
    state = Object.assign({ name:'', budget:0, transactions:[], theme:'standard', payday:1, savedRecords:[] }, state);
    createCharts();
    wireUI();
    initUI();
    updateHeader();
    updateSummary();
    renderHistory();
    renderAllList();
    refreshCategorySelect();
    updateCharts();
    computeSavedRecords();
  }

  // expose for debugging
  window.__bp_full = { state, addTransaction, deleteTransaction, exportCSV, exportWord, exportChartPNG: exportChartPNG };

  // start
  init();

})();
