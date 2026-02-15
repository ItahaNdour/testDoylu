const offers = [
  { operator: "Orange", name: "Pass 5Go", price: 1000, data: 5120, minutes: null, validity: 1, eligibility_type: "public" },
  { operator: "Orange", name: "Pass 10Go", price: 2000, data: 10240, minutes: null, validity: 7, eligibility_type: "public" },
  { operator: "Free", name: "Free 8Go", price: 2000, data: 8192, minutes: null, validity: 7, eligibility_type: "public" },
  { operator: "Expresso", name: "Appels 300min", price: 2000, data: null, minutes: 300, validity: 7, eligibility_type: "public" },
  { operator: "Orange", name: "Étudiant 1Go", price: 100, data: 1024, minutes: null, validity: 7, eligibility_type: "restricted" }
];

const budgetInput = document.getElementById("budgetInput");
const searchBtn = document.getElementById("searchBtn");
const operatorFilter = document.getElementById("operatorFilter");
const usageFilter = document.getElementById("usageFilter");

searchBtn.addEventListener("click", runEngine);
operatorFilter.addEventListener("change", runEngine);
usageFilter.addEventListener("change", runEngine);

function runEngine() {

  const budget = parseInt(budgetInput.value);
  const operator = operatorFilter.value;
  const usage = usageFilter.value;

  if (!budget) return;

  const max = budget * 1.2;

  let filtered = offers.filter(o =>
    o.price >= budget &&
    o.price <= max
  );

  if (operator !== "all") {
    filtered = filtered.filter(o => o.operator === operator);
  }

  const publicOffers = filtered.filter(o => o.eligibility_type === "public");
  const restrictedOffers = filtered.filter(o => o.eligibility_type === "restricted");

  if (publicOffers.length === 0) {
    document.getElementById("resultsTitle").innerText =
      `Aucune offre proche de ${budget} FCFA.`;
    document.getElementById("offersContainer").innerHTML = "";
    return;
  }

  document.getElementById("resultsTitle").innerText =
    `${publicOffers.length} offres proches de ${budget} FCFA`;

  renderTop(publicOffers, usage);
  renderOffers(publicOffers, "offersContainer");
  renderRestricted(restrictedOffers);
}

function renderTop(list, usage) {

  let bestData = null;
  let bestDuration = null;

  if (usage === "data" || usage === "mixte") {
    bestData = list
      .filter(o => o.data)
      .sort((a,b)=>b.data - a.data)[0];
  }

  bestDuration = list
    .sort((a,b)=>b.validity - a.validity)[0];

  let html = "";

  if (bestData) {
    html += `<div class="top-block">
      <strong>🏆 Meilleur Data</strong><br>
      ${bestData.name} – ${(bestData.data/1024).toFixed(1)} Go
      ${computeGain(list, bestData, usage)}
    </div>`;
  }

  if (bestDuration) {
    html += `<div class="top-block">
      <strong>⏳ Meilleure Durée</strong><br>
      ${bestDuration.name} – ${bestDuration.validity} jours
    </div>`;
  }

  document.getElementById("topRecommendations").innerHTML = html;
}

function computeGain(list, topOffer, usage) {

  const sorted = [...list].sort((a,b)=>b.data - a.data);
  if (sorted.length < 2) return "";

  const second = sorted[1];

  if (!topOffer.data || !second.data) return "";

  const diff = topOffer.data - second.data;

  if (diff <= 0) return "";

  if (diff >= 1024) {
    return `<br><strong>+${(diff/1024).toFixed(1)} Go</strong>`;
  } else {
    return `<br><strong>+${diff} Mo</strong>`;
  }
}

function renderOffers(list, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  list.forEach(o=>{
    container.innerHTML += `
      <div class="offer-card">
        <strong>${o.name}</strong><br>
        ${o.data ? (o.data/1024).toFixed(1)+" Go" : ""}
        ${o.minutes ? o.minutes+" min" : ""}
        <br>${o.price} FCFA
      </div>
    `;
  });
}

function renderRestricted(list) {
  const section = document.getElementById("restrictedSection");
  const container = document.getElementById("restrictedContainer");

  if (list.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  container.innerHTML = "";

  list.forEach(o=>{
    container.innerHTML += `
      <div class="offer-card">
        ${o.name} – ${o.price} FCFA (Sous conditions)
      </div>
    `;
  });
}
