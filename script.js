"use strict";

/* ================= CONFIG ================= */

const STORAGE_KEY = "doylu_v1";

/* ================= STATE ================= */

let OFFERS = [];
let selectedBudget = null;
let selectedUsage = "data";
let selectedValidity = "any";
let selectedOperator = "any";

/* ================= DATA SEED ================= */

function seedOffers() {
  return [
    { id: "1", operator: "Orange", name: "Pass 300Mo", price: 200, data_mb: 300, minutes: null, days: 1 },
    { id: "2", operator: "Orange", name: "Pass 1,5Go", price: 500, data_mb: 1536, minutes: null, days: 1 },
    { id: "3", operator: "Orange", name: "Pass 5Go", price: 1000, data_mb: 5120, minutes: null, days: 1 },
    { id: "4", operator: "Orange", name: "Pass Nuit 5Go", price: 500, data_mb: 5120, minutes: null, days: 1 },
    { id: "5", operator: "Orange", name: "Pass 2Go", price: 1000, data_mb: 2048, minutes: null, days: 7 },
    { id: "6", operator: "Orange", name: "Promo 10Go", price: 2000, data_mb: 10240, minutes: null, days: 30 },
    { id: "7", operator: "Orange", name: "Pass 25Go", price: 5000, data_mb: 25600, minutes: null, days: 30 }
  ];
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    OFFERS = seedOffers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(OFFERS));
  } else {
    OFFERS = JSON.parse(raw);
  }
}

/* ================= SCORING ================= */

function scoreOffer(o) {
  if (!o.data_mb) return 0;

  let base = o.data_mb / o.price;

  if (o.days === 7) base *= 1.1;
  if (o.days === 30) base *= 1.2;

  if (o.name.toLowerCase().includes("nuit")) base *= 0.8;

  return base;
}

/* ================= GAIN LOGIC ================= */

function formatGoDeltaFromMb(deltaMb) {
  const mb = Number(deltaMb || 0);
  if (!(mb > 0)) return null;

  // < 1 Go → Mo arrondi au 50 Mo
  if (mb < 1024) {
    const roundedMb = Math.round(mb / 50) * 50;
    if (!(roundedMb > 0)) return null;
    return `+${roundedMb} Mo de plus que l’offre suivante`;
  }

  // ≥ 1 Go → Go arrondi au 0,5 Go
  const go = mb / 1024;
  const roundedGo = Math.round(go / 0.5) * 0.5;
  if (!(roundedGo > 0)) return null;

  const label =
    Number.isInteger(roundedGo)
      ? String(roundedGo)
      : String(roundedGo).replace(".", ",");

  return `+${label} Go de plus que l’offre suivante`;
}

/* ================= UI ================= */

function renderResults() {
  if (!selectedBudget) return;

  let filtered = OFFERS.filter(o => o.price <= selectedBudget);

  if (selectedOperator !== "any") {
    filtered = filtered.filter(o => o.operator === selectedOperator);
  }

  filtered.sort((a, b) => scoreOffer(b) - scoreOffer(a));

  const results = document.getElementById("results");
  const bestBlock = document.getElementById("bestPick");

  if (filtered.length === 0) {
    results.innerHTML = "<p>Aucune offre disponible.</p>";
    bestBlock.innerHTML = "";
    return;
  }

  const best = filtered[0];
  let gainText = null;

  if (
    selectedUsage === "data" &&
    filtered.length >= 2 &&
    best.data_mb &&
    filtered[1].data_mb
  ) {
    const delta = best.data_mb - filtered[1].data_mb;
    gainText = formatGoDeltaFromMb(delta);
  }

  bestBlock.innerHTML = `
    <div class="best-card">
      <div class="best-title">
        🔥 Meilleure valeur pour ${selectedBudget} FCFA
      </div>
      ${gainText ? `<div class="best-gain">${gainText}</div>` : ""}
      <div class="best-sub">
        ${best.operator} — ${best.name}
      </div>
    </div>
  `;

  results.innerHTML = filtered.map(o => `
    <div class="offer-card">
      <div class="price">${o.price} FCFA</div>
      <div>${(o.data_mb/1024).toFixed(1)} Go • ${o.days} jour(s)</div>
    </div>
  `).join("");
}

/* ================= INIT ================= */

function init() {
  loadData();

  document.getElementById("findBtn").addEventListener("click", () => {
    selectedBudget = Number(document.getElementById("budgetInput").value);
    renderResults();
  });
}

init();
