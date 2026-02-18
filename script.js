(() => {
"use strict";

/* ========= STATE ========= */
let state = {
  budget:1000,
  usage:"data",
  operator:"Tous",
  validity:"Toutes",
  sort:"valeur"
};

/* ========= HELPERS ========= */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const formatFcfa = n => `${n} FCFA`;

const costPerGo = o => {
  if(!o.data_mb) return null;
  const go = o.data_mb/1024;
  return Math.round(o.price_fcfa/go);
};

/* ========= OFFERS ========= */
let OFFERS = JSON.parse(localStorage.getItem("doylu_offers_v1")) || [];

/* ========= FILTER ========= */
function filterOffers(){
  return OFFERS
    .filter(o => o.status === "active")
    .filter(o => o.price_fcfa >= state.budget && o.price_fcfa <= state.budget*1.2)
    .filter(o => state.operator==="Tous" ? true : o.operator===state.operator)
    .filter(o => state.usage==="data" ? o.data_mb : true)
    .filter(o => o.eligibility_type==="public");
}

/* ========= RECOMMANDATION ========= */
function renderBest(offers){
  const banner = $("#bestBanner");
  if(!offers.length){
    banner.style.display="none";
    return;
  }

  const sorted = [...offers].sort((a,b)=> (b.data_mb||0)-(a.data_mb||0));
  const best = sorted[0];

  banner.style.display="block";
  banner.innerHTML = `
    <h3>🔥 Meilleur choix pour ${state.budget} FCFA</h3>
    <div class="line">${best.operator} — ${best.name}</div>
    <div class="line">${(best.data_mb/1024).toFixed(1)} Go • ${best.validity_days} jours</div>
    ${costPerGo(best)? `<div class="line">💰 ${costPerGo(best)} FCFA / Go</div>`:""}
    <div class="badge">🏆 Meilleure valeur</div>
  `;
}

/* ========= RENDER ========= */
function render(){
  const offers = filterOffers();
  renderBest(offers);

  const grid = $("#offersGrid");
  grid.innerHTML="";

  offers.forEach(o=>{
    const card = document.createElement("div");
    card.className="offer-card";
    card.innerHTML=`
      <div>${o.operator}</div>
      <div class="offer-price">${formatFcfa(o.price_fcfa)}</div>
      <div class="offer-meta">${(o.data_mb/1024).toFixed(1)} Go • ${o.validity_days} jours</div>
      <div class="offer-actions">
        <button class="btn-primary">Afficher le code</button>
        <button class="btn-light">Copier</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ========= FILTER TOGGLE ========= */
$("#filtersToggle")?.addEventListener("click",()=>{
  $("#filtersPanel").classList.toggle("active");
});

/* ========= INIT ========= */
render();

})();
