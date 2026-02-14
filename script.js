// /script.js
"use strict";

/**
 * Doylu V1
 * - Navigation par hash (#home/#promos/#guide/#contact/#admin) => 1 section visible
 * - Offres en mémoire + persistance (localStorage si dispo) => admin modifie => accueil voit
 * - Filtres : budget, usage, validité, opérateur
 * - Classement : Top choix + gain calculé UNIQUEMENT sur offres PUBLIC
 * - Offres spé (student/corporate/special) visibles après, jamais #1
 */

const ADMIN_PASSWORD = "doylu123"; // change-le
const WHATSAPP_NUMBER = "221770000000"; // change-le (format international sans +)

// ---------- Safe storage ----------
const memoryStore = new Map();

function storageAvailable() {
  try {
    const k = "__doylu_test__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const canUseLS = storageAvailable();

function getStore(key) {
  const raw = canUseLS ? window.localStorage.getItem(key) : memoryStore.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStore(key, value) {
  const raw = JSON.stringify(value);
  if (canUseLS) window.localStorage.setItem(key, raw);
  else memoryStore.set(key, raw);
}

function delStore(key) {
  if (canUseLS) window.localStorage.removeItem(key);
  else memoryStore.delete(key);
}

// ---------- Data model ----------
function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function clampNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mbFromGo(go) {
  return Math.round(go * 1024);
}

const DEFAULT_OFFERS = [
  // Orange (sources USSD / app screenshots)
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Jour 300Mo",
    price_fcfa: 200,
    type_usage: "data",
    data_mb: 300,
    minutes: null,
    sms: null,
    validity_days: 1,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Jour > 300Mo",
    status: "active",
    confidence_score: 85,
    is_verified: true,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Jour 1,5Go",
    price_fcfa: 500,
    type_usage: "data",
    data_mb: mbFromGo(1.5),
    minutes: null,
    sms: null,
    validity_days: 1,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Jour > 1,5Go",
    status: "active",
    confidence_score: 82,
    is_verified: true,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Jour 5Go",
    price_fcfa: 1000,
    type_usage: "data",
    data_mb: mbFromGo(5),
    minutes: null,
    sms: null,
    validity_days: 1,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Jour > 5Go",
    status: "active",
    confidence_score: 80,
    is_verified: true,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Nuit 5Go",
    price_fcfa: 500,
    type_usage: "data",
    data_mb: mbFromGo(5),
    minutes: null,
    sms: null,
    validity_days: 1,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Nuit > 5Go",
    status: "active",
    confidence_score: 78,
    is_verified: false,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Semaine 600Mo",
    price_fcfa: 500,
    type_usage: "data",
    data_mb: 600,
    minutes: null,
    sms: null,
    validity_days: 7,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Semaine > 600Mo",
    status: "active",
    confidence_score: 75,
    is_verified: false,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Semaine 2Go",
    price_fcfa: 1000,
    type_usage: "data",
    data_mb: mbFromGo(2),
    minutes: null,
    sms: null,
    validity_days: 7,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Semaine > 2Go",
    status: "active",
    confidence_score: 77,
    is_verified: false,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Semaine 10Go",
    price_fcfa: 2500,
    type_usage: "data",
    data_mb: mbFromGo(10),
    minutes: null,
    sms: null,
    validity_days: 7,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Semaine > 10Go",
    status: "active",
    confidence_score: 79,
    is_verified: false,
    is_promo: false,
    eligibility_type: "public",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },

  // Offres sous conditions / special (ne doivent pas être #1)
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Pass Éducation 1Go",
    price_fcfa: 100,
    type_usage: "data",
    data_mb: mbFromGo(1),
    minutes: null,
    sms: null,
    validity_days: 7,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Semaine > Éducation",
    status: "active",
    confidence_score: 70,
    is_verified: false,
    is_promo: false,
    eligibility_type: "student",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    offer_id: uid(),
    country: "SN",
    operator: "Orange",
    name: "Promo 10Go à 2000F (OM)",
    price_fcfa: 2000,
    type_usage: "data",
    data_mb: mbFromGo(10),
    minutes: null,
    sms: null,
    validity_days: 30,
    ussd_code: "*1234#",
    activation_path: "*1234# > Internet > Mois > Promo OM",
    status: "active",
    confidence_score: 72,
    is_verified: false,
    is_promo: true,
    eligibility_type: "special",
    source_label: "Source officielle",
    last_seen_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  },
];

const STORE_KEY = "doylu_offers_v1";
const META_KEY = "doylu_meta_v1";
const ADMIN_SESSION_KEY = "doylu_admin_ok";

// ---------- App state ----------
const state = {
  budget: 1000,
  usage: "data", // data | mixte | appels
  validity: "all", // all | 1 | 7 | 30
  operator: "all", // all | Orange | Free | Expresso | Lebara
  view: "home",
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

const offersGrid = $("offersGrid");
const promosGrid = $("promosGrid");

const budgetInput = $("budgetInput");
const searchBtn = $("searchBtn");
const searchBtnText = $("searchBtnText");
const budgetHint = $("budgetHint");
const lastUpdate = $("lastUpdate");

const bestBanner = $("bestBanner");
const bestTitle = $("bestTitle");
const bestGain = $("bestGain");
const bestHint = $("bestHint");

const resultsHead = $("resultsHead");
const resultsCount = $("resultsCount");
const emptyState = $("emptyState");

const toast = $("toast");

const modal = $("modal");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const modalClose = $("modalClose");

const hamburger = $("hamburger");
const nav = $("nav");

// Admin dom
const adminLogin = $("adminLogin");
const adminPanel = $("adminPanel");
const adminPass = $("adminPass");
const adminLoginBtn = $("adminLoginBtn");
const adminCount = $("adminCount");
const adminList = $("adminList");
const exportJsonBtn = $("exportJsonBtn");
const importJsonInput = $("importJsonInput");
const resetBtn = $("resetBtn");

const saveOfferBtn = $("saveOfferBtn");
const clearFormBtn = $("clearFormBtn");

// Contact
const reportSend = $("reportSend");
const smsSend = $("smsSend");
const bizMail = $("bizMail");
const bizWA = $("bizWA");

// ---------- Load / save offers ----------
function loadOffers() {
  const existing = getStore(STORE_KEY);
  if (Array.isArray(existing) && existing.length) return existing;
  setStore(STORE_KEY, DEFAULT_OFFERS);
  setStore(META_KEY, { last_update: nowISO() });
  return DEFAULT_OFFERS.slice();
}

function saveOffers(offers) {
  setStore(STORE_KEY, offers);
  const meta = getStore(META_KEY) || {};
  meta.last_update = nowISO();
  setStore(META_KEY, meta);
}

function getMeta() {
  return getStore(META_KEY) || { last_update: null };
}

let offers = loadOffers();

// ---------- Utilities ----------
function formatMoney(x) {
  return `${x} FCFA`;
}

function formatValidity(days) {
  if (!days) return "Inconnu";
  if (days === 1) return "24h";
  return `${days} jours`;
}

function formatDataMB(mb) {
  if (!mb || !Number.isFinite(mb)) return "Inconnu";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace(".0", "")} Go`;
  return `${Math.round(mb)} Mo`;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 1600);
}

function openModal(title, html) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.showModal();
}

function closeModal() {
  if (modal.open) modal.close();
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  const rect = modal.getBoundingClientRect();
  const inside =
    rect.top <= e.clientY &&
    e.clientY <= rect.bottom &&
    rect.left <= e.clientX &&
    e.clientX <= rect.right;
  if (!inside) closeModal();
});

// ---------- Navigation / Views ----------
function setActiveNav(view) {
  document.querySelectorAll(".nav__link").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === view);
  });
}

function showView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((v) => {
    const isTarget = v.dataset.view === view;
    v.hidden = !isTarget;
    v.setAttribute("aria-hidden", String(!isTarget));
  });

  setActiveNav(view === "admin" ? "home" : view);
  if (hamburger && nav) {
    nav.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  }

  if (view === "admin") initAdminUI();
  if (view === "promos") renderPromos();
}

function routeFromHash() {
  const hash = (window.location.hash || "#home").replace("#", "");
  const allowed = new Set(["home", "promos", "guide", "contact", "admin"]);
  return allowed.has(hash) ? hash : "home";
}

window.addEventListener("hashchange", () => {
  showView(routeFromHash());
});

hamburger?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", String(isOpen));
});

// ---------- Filters UI ----------
function bindChipGroup(containerId, onPick) {
  const el = $(containerId);
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    onPick(btn);
  });
}

function setChipActive(containerId, predicate) {
  const el = $(containerId);
  el.querySelectorAll(".chip").forEach((b) => b.classList.toggle("chip--active", predicate(b)));
}

bindChipGroup("budgetChips", (btn) => {
  const b = Number(btn.dataset.budget);
  if (!Number.isFinite(b)) return;
  budgetInput.value = String(b);
  state.budget = b;
  runSearch(true);
});

bindChipGroup("usageChips", (btn) => {
  state.usage = btn.dataset.usage;
  setChipActive("usageChips", (b) => b.dataset.usage === state.usage);
  runSearch(false);
});

bindChipGroup("validityChips", (btn) => {
  state.validity = btn.dataset.validity;
  setChipActive("validityChips", (b) => b.dataset.validity === state.validity);
  runSearch(false);
});

bindChipGroup("operatorChips", (btn) => {
  state.operator = btn.dataset.operator;
  setChipActive("operatorChips", (b) => b.dataset.operator === state.operator);
  runSearch(false);
});

bindChipGroup("promosOperatorChips", (btn) => {
  setChipActive("promosOperatorChips", (b) => b.dataset.operator === btn.dataset.operator);
  renderPromos();
});
bindChipGroup("promosUsageChips", (btn) => {
  setChipActive("promosUsageChips", (b) => b.dataset.usage === btn.dataset.usage);
  renderPromos();
});

// Empty suggestions
emptyState.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-suggest]");
  const u = e.target.closest("button[data-suggest-usage]");
  if (b) {
    budgetInput.value = b.dataset.suggest;
    state.budget = Number(b.dataset.suggest);
    runSearch(true);
  }
  if (u) {
    state.usage = u.dataset.suggestUsage;
    setChipActive("usageChips", (x) => x.dataset.usage === state.usage);
    runSearch(false);
  }
});

// ---------- Trust / verify modal ----------
function howVerifyHtml() {
  return `
    <ul>
      <li>On collecte des offres via <strong>SMS</strong>, <strong>USSD</strong> et annonces publiques.</li>
      <li>On vérifie la cohérence (prix, volume, validité) et on retire les offres expirées.</li>
      <li>Le badge “Vérifié” apparaît quand l’offre est confirmée par plusieurs preuves récentes.</li>
    </ul>
  `;
}
$("howVerifyBtn").addEventListener("click", () => openModal("Comment on vérifie ?", howVerifyHtml()));
$("howVerifyBtn2").addEventListener("click", () => openModal("Comment on vérifie ?", howVerifyHtml()));

// ---------- WhatsApp setup ----------
function waLink(text) {
  const msg = encodeURIComponent(text);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}
$("waSubscribe").href = waLink("Salut ! Je veux recevoir les bons plans Doylu (1 message/jour max).");

// ---------- Ranking / scoring ----------
function valuePerFcfa(offer, usage) {
  const price = offer.price_fcfa || 1;
  if (usage === "data") return (offer.data_mb || 0) / price;
  if (usage === "appels") return (offer.minutes || 0) / price;
  // mixte: pondération simple V1
  return ((offer.data_mb || 0) / price) * 0.7 + ((offer.minutes || 0) / price) * 0.3;
}

function bonusValidity(offer) {
  const d = offer.validity_days || 0;
  if (d >= 30) return 0.15;
  if (d >= 7) return 0.08;
  if (d >= 1) return 0.03;
  return 0;
}

function bonusVerified(offer) {
  return offer.is_verified ? 0.1 : 0;
}

function scoreOffer(offer, usage) {
  return valuePerFcfa(offer, usage) + bonusValidity(offer) + bonusVerified(offer);
}

// Gain formatting rules (data): MB -> (Mo < 1Go rounded 50Mo) OR (Go >=1 rounded 0.5Go)
function formatGainDataMB(diffMB) {
  if (!Number.isFinite(diffMB) || diffMB <= 0) return null;
  if (diffMB < 1024) {
    const rounded = Math.round(diffMB / 50) * 50;
    return `+${rounded} Mo`;
  }
  const go = diffMB / 1024;
  const roundedGo = Math.round(go / 0.5) * 0.5;
  const txt = String(roundedGo).endsWith(".0") ? String(roundedGo).slice(0, -2) : String(roundedGo);
  return `+${txt} Go`;
}

// Hint simple V1 selon validité + volume
function bestHintText(offer) {
  const d = offer.validity_days || 0;
  const mb = offer.data_mb || 0;
  if (d === 1 && mb >= 3000) return "Bon pour 24h intensif.";
  if (d === 1) return "Idéal pour la journée.";
  if (d === 7) return "Bon pour 7 jours.";
  if (d >= 30) return "Bon pour le mois.";
  return "Bon plan à comparer.";
}

// Eligibility labels
function eligibilityBadge(offer) {
  if (offer.eligibility_type === "student") return { text: "🎓 Réservé aux étudiants", kind: "special" };
  if (offer.eligibility_type === "corporate") return { text: "🔒 Offre corporate", kind: "special" };
  if (offer.eligibility_type === "special") return { text: "🔒 Sous conditions", kind: "special" };
  return null;
}

// ---------- Filtering ----------
function matchesFilters(offer) {
  if (offer.status !== "active") return false;
  if (offer.price_fcfa > state.budget) return false;

  if (state.operator !== "all" && offer.operator !== state.operator) return false;

  if (state.usage && offer.type_usage !== state.usage) {
    // Si mixte demandé, on garde mixte uniquement (V1 strict)
    return false;
  }

  if (state.validity !== "all") {
    const days = Number(state.validity);
    if (!Number.isFinite(days)) return true;
    if ((offer.validity_days || 0) !== days) return false;
  }

  return true;
}

function splitPublicSpecial(list) {
  const pub = [];
  const special = [];
  for (const o of list) {
    if (!o.eligibility_type || o.eligibility_type === "public") pub.push(o);
    else special.push(o);
  }
  return { pub, special };
}

// ---------- Rendering cards ----------
function renderOfferCard(offer, opts = {}) {
  const opLetter = (offer.operator || "?").slice(0, 1).toUpperCase();
  const dataLine = offer.type_usage === "data" ? `📱 ${formatDataMB(offer.data_mb)}` : "";
  const minLine = offer.type_usage === "appels" ? `📞 ${offer.minutes ?? "—"} min` : "";
  const mixLine =
    offer.type_usage === "mixte"
      ? `📱 ${formatDataMB(offer.data_mb)} • 📞 ${offer.minutes ?? "—"} min`
      : "";
  const validity = `⏱ ${formatValidity(offer.validity_days)}`;

  const sourceText = offer.source_label || (offer.is_verified ? "Vérifié" : "Source");
  const badge = eligibilityBadge(offer);

  const topChoice = opts.isTopChoice
    ? `<div class="topChoice"><span class="trophy">🏆</span> TOP CHOIX</div>`
    : "";

  const badgeHtml = badge ? `<span class="specialBadge">${badge.text}</span>` : "";
  const promoHtml = offer.is_promo ? `<span class="specialBadge">Promo limitée</span>` : "";

  const ussd = offer.ussd_code || "*1234#";
  const cardId = offer.offer_id;

  return `
    <article class="card" data-offer-id="${cardId}">
      ${topChoice}
      <div class="cardTop">
        <div style="display:flex;gap:10px;align-items:center">
          <div class="opBadge">${opLetter}</div>
          <div style="font-weight:950">${offer.operator}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${promoHtml}
          ${badgeHtml}
          <span class="sourceBadge">${sourceText}</span>
        </div>
      </div>

      <div class="cardTitle">${offer.operator} — ${offer.name}</div>
      <div class="price">${offer.price_fcfa} FCFA</div>

      <div class="meta">
        ${mixLine || dataLine || minLine} • ${validity}
      </div>

      <div class="actions">
        <button class="btnWide" data-action="reveal">👁 Afficher le code</button>
        <div class="ussd" see data-ussd>${ussd}</div>

        <div class="rowBtns">
          <button class="btn btnCopy" data-action="copy">📋 Copier</button>
          <button class="btn btnShare" data-action="share">🟢 Partager WhatsApp</button>
        </div>
      </div>

      ${
        badge
          ? `<div class="meta" style="margin-top:10px">Peut nécessiter un justificatif selon l’opérateur.</div>`
          : ""
      }
    </article>
  `;
}

// Offer actions (reveal/copy/share)
function bindOfferActions(container) {
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = e.target.closest(".card");
    if (!card) return;

    const offerId = card.dataset.offerId;
    const offer = offers.find((o) => o.offer_id === offerId);
    if (!offer) return;

    const ussdBox = card.querySelector(".ussd");
    const ussd = offer.ussd_code || "*1234#";

    if (btn.dataset.action === "reveal") {
      ussdBox.classList.toggle("show");
      showToast("Code affiché ✅");
      return;
    }

    if (btn.dataset.action === "copy") {
      try {
        await navigator.clipboard.writeText(ussd);
        showToast("Code copié ✅");
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = ussd;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        showToast("Code copié ✅");
      }
      return;
    }

    if (btn.dataset.action === "share") {
      const msg = `Doylu: ${offer.operator} — ${offer.name}\nPrix: ${offer.price_fcfa} FCFA\nCode: ${ussd}\nValidité: ${formatValidity(
        offer.validity_days
      )}`;
      window.open(waLink(msg), "_blank", "noreferrer");
      return;
    }
  });
}

bindOfferActions(offersGrid);
bindOfferActions(promosGrid);

// ---------- Search ----------
function setLastUpdateUI() {
  const meta = getMeta();
  if (!meta.last_update) {
    lastUpdate.textContent = "—";
    return;
  }
  const d = new Date(meta.last_update);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  lastUpdate.textContent = `aujourd’hui ${hh}:${mm}`;
}

function setBudgetHint(count) {
  budgetHint.textContent = `${count} offre(s) disponible(s)`;
}

function runSearch(scrollToResults) {
  // keep budget state from input
  const b = clampNum(budgetInput.value, state.budget);
  state.budget = b;
  budgetInput.value = String(b);

  // set actives
  setChipActive("usageChips", (x) => x.dataset.usage === state.usage);
  setChipActive("validityChips", (x) => x.dataset.validity === state.validity);
  setChipActive("operatorChips", (x) => x.dataset.operator === state.operator);

  // loader micro feedback
  searchBtnText.textContent = "Recherche…";
  searchBtn.disabled = true;

  setTimeout(() => {
    const filtered = offers.filter(matchesFilters);
    const { pub, special } = splitPublicSpecial(filtered);

    // Score only public for top and gain
    const pubSorted = pub
      .slice()
      .sort((a, b2) => scoreOffer(b2, state.usage) - scoreOffer(a, state.usage));

    const specialSorted = special
      .slice()
      .sort((a, b2) => scoreOffer(b2, state.usage) - scoreOffer(a, state.usage));

    const finalList = [...pubSorted, ...specialSorted];

    // Update UI
    setBudgetHint(finalList.length);
    resultsHead.hidden = false;
    resultsCount.textContent = `${finalList.length} offre(s) ≤ ${state.budget} FCFA`;

    // best banner
    renderBestBanner(pubSorted);

    // list
    if (!finalList.length) {
      offersGrid.innerHTML = "";
      emptyState.hidden = false;
      bestBanner.hidden = true;
    } else {
      emptyState.hidden = true;
      offersGrid.innerHTML = finalList
        .map((o, idx) => renderOfferCard(o, { isTopChoice: idx === 0 && pubSorted[0]?.offer_id === o.offer_id }))
        .join("");
    }

    if (scrollToResults) {
      bestBanner.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    searchBtnText.textContent = "Voir les offres";
    searchBtn.disabled = false;
  }, 450);
}

function renderBestBanner(pubSorted) {
  if (!pubSorted.length) {
    bestBanner.hidden = true;
    return;
  }

  const top = pubSorted[0];
  const titleUsage = state.usage === "data" ? "data" : state.usage === "appels" ? "appels" : "mixte";

  bestBanner.hidden = false;
  bestTitle.textContent = `🔥 Meilleure valeur pour ${state.budget} FCFA (${titleUsage})`;

  // Gain : uniquement sur PUBLIC, uniquement data si usage=data
  bestGain.hidden = true;
  bestGain.textContent = "";

  if (state.usage === "data" && pubSorted.length >= 2) {
    const second = pubSorted[1];
    const diff = (top.data_mb || 0) - (second.data_mb || 0);
    const g = formatGainDataMB(diff);
    if (g) {
      bestGain.hidden = false;
      bestGain.textContent = `${g} de plus que l’offre publique suivante`;
    }
  }

  bestHint.textContent = `${top.operator} — ${top.name} • 📱 ${formatDataMB(top.data_mb)} • ⏱ ${formatValidity(
    top.validity_days
  )} • ${top.price_fcfa} FCFA — ${pubSorted.length} offre(s) publique(s)`;
}

searchBtn.addEventListener("click", () => runSearch(true));
budgetInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch(true);
});

// ---------- Promos page ----------
function renderPromos() {
  const opPick = document.querySelector("#promosOperatorChips .chip--active")?.dataset.operator || "all";
  const usagePick = document.querySelector("#promosUsageChips .chip--active")?.dataset.usage || "all";

  const list = offers
    .filter((o) => o.status === "active" && o.is_promo)
    .filter((o) => (opPick === "all" ? true : o.operator === opPick))
    .filter((o) => (usagePick === "all" ? true : o.type_usage === usagePick))
    .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

  promosGrid.innerHTML = list.length
    ? list.map((o) => renderOfferCard(o, { isTopChoice: false })).join("")
    : `<div class="empty"><div class="empty__title">Pas de promos publiées pour l’instant.</div><div class="muted">Ajoute une promo via Admin (#admin).</div></div>`;
}

// ---------- Contact actions (WhatsApp V1) ----------
function sendWA(text) {
  window.open(waLink(text), "_blank", "noreferrer");
}

reportSend.addEventListener("click", () => {
  const op = $("reportOperator").value;
  const txt = $("reportText").value.trim();
  if (!txt) return showToast("Écris un message d’abord.");
  sendWA(`Doylu - Signalement offre\nOpérateur: ${op}\n\n${txt}`);
});

smsSend.addEventListener("click", () => {
  const op = $("smsOperator").value;
  const txt = $("smsText").value.trim();
  if (!txt) return showToast("Colle le SMS d’abord.");
  sendWA(`Doylu - Promo reçue par SMS\nOpérateur: ${op}\n\n${txt}`);
});

bizMail.addEventListener("click", () => {
  window.location.href = `mailto:contact@doylu.sn?subject=${encodeURIComponent("Partenariat / Pub - Doylu")}`;
});
bizWA.addEventListener("click", () => sendWA("Doylu - Partenariat / Pub"));

// ---------- Admin ----------
function isAdminOK() {
  return getStore(ADMIN_SESSION_KEY) === true;
}

function setAdminOK(v) {
  setStore(ADMIN_SESSION_KEY, Boolean(v));
}

function initAdminUI() {
  const ok = isAdminOK();
  adminLogin.hidden = ok;
  adminPanel.hidden = !ok;

  if (ok) renderAdminList();
}

adminLoginBtn.addEventListener("click", () => {
  const pass = adminPass.value.trim();
  if (pass !== ADMIN_PASSWORD) return showToast("Mot de passe incorrect.");
  setAdminOK(true);
  adminPass.value = "";
  initAdminUI();
  showToast("Admin connecté ✅");
});

function readAdminForm() {
  const operator = $("fOperator").value;
  const name = $("fName").value.trim();
  const price_fcfa = clampNum($("fPrice").value, null);
  const type_usage = $("fUsage").value;

  const data_mb = clampNum($("fData").value, null);
  const minutes = clampNum($("fMinutes").value, null);
  const validity_days = clampNum($("fValidity").value, null);

  const ussd_code = $("fUssd").value.trim() || null;
  const is_promo = $("fPromo").value === "true";
  const eligibility_type = $("fEligibility").value;
  const source_label =
    $("fSource").value === "official"
      ? "Source officielle"
      : $("fSource").value === "sms"
      ? "Source SMS"
      : "Utilisateur";

  if (!name || !price_fcfa || !Number.isFinite(price_fcfa)) return { error: "Nom + prix requis." };
  if (type_usage === "data" && (data_mb == null || !Number.isFinite(data_mb))) {
    return { error: "Pour une offre Data, renseigne Data (MB)." };
  }

  return {
    offer: {
      operator,
      name,
      price_fcfa,
      type_usage,
      data_mb: data_mb ?? null,
      minutes: minutes ?? null,
      sms: null,
      validity_days: validity_days ?? null,
      ussd_code,
      activation_path: null,
      status: "active",
      confidence_score: 0,
      is_verified: false,
      is_promo,
      eligibility_type,
      source_label,
      last_seen_at: nowISO(),
      updated_at: nowISO(),
    },
  };
}

function clearAdminForm() {
  $("fOperator").value = "Orange";
  $("fName").value = "";
  $("fPrice").value = "";
  $("fUsage").value = "data";
  $("fData").value = "";
  $("fMinutes").value = "";
  $("fValidity").value = "";
  $("fUssd").value = "";
  $("fPromo").value = "false";
  $("fEligibility").value = "public";
  $("fSource").value = "official";
  delStore("doylu_editing_offer_id");
}

clearFormBtn.addEventListener("click", clearAdminForm);

saveOfferBtn.addEventListener("click", () => {
  const editingId = getStore("doylu_editing_offer_id");
  const { offer, error } = readAdminForm();
  if (error) return showToast(error);

  if (editingId) {
    offers = offers.map((o) => (o.offer_id === editingId ? { ...o, ...offer, offer_id: editingId } : o));
    delStore("doylu_editing_offer_id");
    showToast("Offre modifiée ✅");
  } else {
    offers = [
      {
        offer_id: uid(),
        country: "SN",
        created_at: nowISO(),
        ...offer,
      },
      ...offers,
    ];
    showToast("Offre ajoutée ✅");
  }

  saveOffers(offers);
  setLastUpdateUI();
  renderAdminList();
  runSearch(false);
  clearAdminForm();
});

function renderAdminList() {
  adminCount.textContent = String(offers.length);

  const items = offers
    .slice()
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
    .map((o) => {
      return `
      <div class="adminItem" data-id="${o.offer_id}">
        <div>
          <strong>${o.operator}</strong> — ${o.name}
          <div class="muted">${o.price_fcfa} FCFA • ${o.type_usage} • ${formatValidity(o.validity_days)} • ${
        o.eligibility_type || "public"
      } ${o.is_promo ? "• promo" : ""}</div>
        </div>
        <div class="adminItemBtns">
          <button class="btn smallBtn" data-act="edit">Modifier</button>
          <button class="btn smallBtn btn--danger" data-act="del">Supprimer</button>
        </div>
      </div>
    `;
    })
    .join("");

  adminList.innerHTML = items || `<div class="muted">Aucune offre.</div>`;
}

adminList.addEventListener("click", (e) => {
  const row = e.target.closest(".adminItem");
  const btn = e.target.closest("button[data-act]");
  if (!row || !btn) return;

  const id = row.dataset.id;
  const act = btn.dataset.act;
  const offer = offers.find((o) => o.offer_id === id);
  if (!offer) return;

  if (act === "del") {
    offers = offers.filter((o) => o.offer_id !== id);
    saveOffers(offers);
    setLastUpdateUI();
    renderAdminList();
    runSearch(false);
    showToast("Offre supprimée ✅");
    return;
  }

  if (act === "edit") {
    setStore("doylu_editing_offer_id", id);
    $("fOperator").value = offer.operator;
    $("fName").value = offer.name;
    $("fPrice").value = String(offer.price_fcfa);
    $("fUsage").value = offer.type_usage;
    $("fData").value = offer.data_mb != null ? String(offer.data_mb) : "";
    $("fMinutes").value = offer.minutes != null ? String(offer.minutes) : "";
    $("fValidity").value = offer.validity_days != null ? String(offer.validity_days) : "";
    $("fUssd").value = offer.ussd_code || "";
    $("fPromo").value = offer.is_promo ? "true" : "false";
    $("fEligibility").value = offer.eligibility_type || "public";
    $("fSource").value =
      offer.source_label === "Source SMS" ? "sms" : offer.source_label === "Utilisateur" ? "user" : "official";
    showToast("Mode édition ✅");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// Export / import JSON
exportJsonBtn.addEventListener("click", () => {
  const payload = {
    meta: getMeta(),
    offers,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doylu_offers_export_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importJsonInput.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  try {
    const text = await f.text();
    const json = JSON.parse(text);

    const incoming = Array.isArray(json) ? json : json.offers;
    if (!Array.isArray(incoming)) throw new Error("JSON invalide (attendu: {offers:[...]}).");

    // normalisation minimale
    const normalized = incoming.map((o) => ({
      offer_id: o.offer_id || uid(),
      country: o.country || "SN",
      operator: o.operator || "Orange",
      name: o.name || "Offre",
      price_fcfa: Number(o.price_fcfa || 0),
      type_usage: o.type_usage || "data",
      data_mb: o.data_mb != null ? Number(o.data_mb) : null,
      minutes: o.minutes != null ? Number(o.minutes) : null,
      sms: o.sms != null ? Number(o.sms) : null,
      validity_days: o.validity_days != null ? Number(o.validity_days) : null,
      ussd_code: o.ussd_code || null,
      activation_path: o.activation_path || null,
      status: o.status || "active",
      confidence_score: Number(o.confidence_score || 0),
      is_verified: Boolean(o.is_verified),
      is_promo: Boolean(o.is_promo),
      eligibility_type: o.eligibility_type || "public",
      source_label: o.source_label || "Utilisateur",
      last_seen_at: o.last_seen_at || nowISO(),
      created_at: o.created_at || nowISO(),
      updated_at: nowISO(),
    }));

    offers = normalized;
    saveOffers(offers);
    setLastUpdateUI();
    renderAdminList();
    runSearch(false);
    showToast("Import OK ✅");
  } catch (err) {
    showToast(`Import KO: ${err.message}`);
  } finally {
    e.target.value = "";
  }
});

resetBtn.addEventListener("click", () => {
  offers = DEFAULT_OFFERS.slice();
  saveOffers(offers);
  setLastUpdateUI();
  renderAdminList();
  runSearch(false);
  showToast("Reset OK ✅");
});

// ---------- Init ----------
function init() {
  // nav route
  showView(routeFromHash());

  // last update
  setLastUpdateUI();

  // default budget
  budgetInput.value = String(state.budget);

  // budget hint initial
  setBudgetHint(offers.filter((o) => o.status === "active").length);

  // initial render (home)
  runSearch(false);
}

init();
