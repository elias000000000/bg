document.addEventListener("DOMContentLoaded", () => {
  // ==============================
  // Globale Variablen & Speicher
  // ==============================
  const tabs = document.querySelectorAll(".bottom-nav-btn");
  const sections = document.querySelectorAll(".tab");
  const greeting = document.getElementById("greeting");
  const monthRange = document.getElementById("monthRange");
  const currentDate = document.getElementById("currentDate");
  const quoteEl = document.getElementById("quote");
  const remainingEl = document.getElementById("remaining");
  const paydayInput = document.getElementById("paydaySelect");

  let username = localStorage.getItem("username") || "";
  let payday = parseInt(localStorage.getItem("payday") || "1");
  let budget = parseFloat(localStorage.getItem("budget") || "0");
  let spent = parseFloat(localStorage.getItem("spent") || "0");
  let theme = localStorage.getItem("theme") || "standard";
  let categories = JSON.parse(localStorage.getItem("categories") || "[]");
  let transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
  let archive = JSON.parse(localStorage.getItem("archive") || "[]");

  const quotes = [
    "Spare in der Zeit, dann hast du in der Not.",
    "Ein Euro gespart ist ein Euro verdient.",
    "Wer den Pfennig nicht ehrt, ist des Talers nicht wert.",
    "Kleine Ausgaben summieren sich."
  ];

  // ==============================
  // Initial Setup
  // ==============================
  const today = new Date();
  greeting.textContent = username ? `Hallo ${username}` : "Hallo –";
  monthRange.innerHTML = `<span id="budgetWord">Budget</span> für ${today.toLocaleString("de-DE", { month: "long", year: "numeric" })}`;
  currentDate.textContent = `${today.toLocaleDateString()} ${today.toLocaleTimeString()}`;
  quoteEl.textContent = `"${quotes[today.getDate() % quotes.length]}"`;

  document.body.className = `theme-${theme}`;
  renderCategories();
  renderTransactions();
  updateRemaining();
  renderArchive();

  // ==============================
  // Tab Navigation
  // ==============================
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach(sec => sec.classList.remove("active"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // ==============================
  // Theme wechseln
  // ==============================
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      theme = btn.dataset.themeSelect;
      localStorage.setItem("theme", theme);
      document.body.className = `theme-${theme}`;
    });
  });

  // ==============================
  // Name speichern + Popups
  // ==============================
  document.getElementById("saveName").addEventListener("click", () => {
    username = document.getElementById("userName").value.trim();
    if (!username) return;
    localStorage.setItem("username", username);
    greeting.textContent = `Hallo ${username}`;
    closeModal("welcomeModal");
    openModal("infoModal");
  });

  document.getElementById("closeInfo").addEventListener("click", () => {
    closeModal("infoModal");
    openModal("categoryInfoModal");
  });

  document.getElementById("closeCategoryInfo").addEventListener("click", () => {
    closeModal("categoryInfoModal");
    openModal("paydayModal");
  });

  document.getElementById("savePayday").addEventListener("click", () => {
    payday = parseInt(paydayInput.value) || 1;
    localStorage.setItem("payday", payday);
    closeModal("paydayModal");
  });

  // ==============================
  // Budget setzen
  // ==============================
  document.getElementById("saveBudget").addEventListener("click", () => {
    budget = parseFloat(document.getElementById("totalBudget").value) || 0;
    localStorage.setItem("budget", budget);
    updateRemaining();
  });

  // ==============================
  // Kategorien-Verwaltung
  // ==============================
  document.getElementById("addCategory").addEventListener("click", () => {
    const name = document.getElementById("newCategoryName").value.trim();
    if (!name) return;
    categories.push(name);
    localStorage.setItem("categories", JSON.stringify(categories));
    document.getElementById("newCategoryName").value = "";
    renderCategories();
  });

  function renderCategories() {
    const select = document.getElementById("txCategory");
    select.innerHTML = "";
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });

    const list = document.getElementById("categoriesList");
    if (list) {
      list.innerHTML = categories.map(c => `<div class="panel">${c}</div>`).join("");
    }
  }

  // ==============================
  // Transaktionen
  // ==============================
  document.getElementById("addTx").addEventListener("click", () => {
    const cat = document.getElementById("txCategory").value;
    const desc = document.getElementById("txDesc").value.trim();
    const amt = parseFloat(document.getElementById("txAmount").value) || 0;
    if (!cat || !desc || amt <= 0) return;

    transactions.push({ cat, desc, amt, date: new Date().toISOString() });
    localStorage.setItem("transactions", JSON.stringify(transactions));
    spent += amt;
    localStorage.setItem("spent", spent);
    document.getElementById("txDesc").value = "";
    document.getElementById("txAmount").value = "";
    renderTransactions();
    updateRemaining();
  });

  function renderTransactions() {
    const container = document.getElementById("transactionList");
    if (!container) return;
    container.innerHTML = transactions.map(t =>
      `<div class="panel">
         <strong>${t.cat}</strong>: ${t.desc} – CHF ${t.amt.toFixed(2)}
       </div>`
    ).join("");
  }

  function updateRemaining() {
    let remaining = budget - spent;
    remainingEl.textContent = `CHF ${remaining.toFixed(2)}`;
    if (remaining < 200) {
      remainingEl.classList.add("red-alert");
    } else {
      remainingEl.classList.remove("red-alert");
    }
    document.getElementById("savedAmount").textContent = `CHF ${(remaining > 0 ? remaining : 0).toFixed(2)}`;
  }

  // ==============================
  // Archivierung am Zahltag
  // ==============================
  if (today.getDate() === payday) {
    if (transactions.length > 0) {
      archive.push({
        date: today.toLocaleDateString(),
        transactions,
        budget,
        spent
      });
      localStorage.setItem("archive", JSON.stringify(archive));
      transactions = [];
      spent = 0;
      localStorage.setItem("transactions", "[]");
      localStorage.setItem("spent", "0");
      renderTransactions();
      updateRemaining();
      renderArchive();
    }
  }

  function renderArchive() {
    const container = document.getElementById("archiveList");
    if (!container) return;
    container.innerHTML = archive.map(entry => `
      <div class="panel">
        <h4>${entry.date}</h4>
        <p>Budget: CHF ${entry.budget.toFixed(2)} – Ausgegeben: CHF ${entry.spent.toFixed(2)}</p>
      </div>
    `).join("");
  }

  // ==============================
  // Chart.js – Diagramm
  // ==============================
  const ctx = document.getElementById("expenseChart").getContext("2d");
  let chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: categories.map(cat => {
          return transactions.filter(t => t.cat === cat).reduce((sum, t) => sum + t.amt, 0);
        }),
        backgroundColor: ["#f39c12","#e74c3c","#3498db","#2ecc71","#9b59b6","#1abc9c"]
      }]
    }
  });

  // ==============================
  // Export – Diagramm als PNG
  // ==============================
  document.getElementById("exportChart").addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = chart.toBase64Image("image/png", 1.0);
    link.download = "diagramm.png";
    link.click();
  });

  // ==============================
  // Export – Verlauf als Word
  // ==============================
  document.getElementById("exportWord").addEventListener("click", async () => {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType } = docx;

    const grouped = {};
    transactions.forEach(t => {
      if (!grouped[t.cat]) grouped[t.cat] = [];
      grouped[t.cat].push(t);
    });

    const rows = [];
    for (let cat in grouped) {
      rows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(cat)], columnSpan: 3 })
        ]
      }));
      grouped[cat].forEach(t => {
        rows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(t.cat)] }),
            new TableCell({ children: [new Paragraph(t.desc)] }),
            new TableCell({ children: [new Paragraph(`CHF ${t.amt.toFixed(2)}`)] })
          ]
        }));
      });
      const total = grouped[cat].reduce((sum, t) => sum + t.amt, 0);
      rows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("Total")], columnSpan: 2 }),
          new TableCell({ children: [new Paragraph(`CHF ${total.toFixed(2)}`)] })
        ]
      }));
    }

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows
    });

    const doc = new Document({
      sections: [{ children: [table] }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verlauf.docx";
    a.click();
  });

  // ==============================
  // Modal Helper
  // ==============================
  function openModal(id) {
    document.getElementById(id).setAttribute("aria-hidden", "false");
  }
  function closeModal(id) {
    document.getElementById(id).setAttribute("aria-hidden", "true");
  }

  // ==============================
  // Popups beim ersten Start
  // ==============================
  if (!username) {
    openModal("welcomeModal");
  }
});
