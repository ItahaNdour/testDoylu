"use strict";

/**
 * Doylu V1 (3 fichiers)
 * - OFFERS + SOURCES stockés ici (temporaire)
 * - Admin invisible: /#admin (mdp: doyluadmin)
 * - Import JSON par fichier + Coller JSON
 * - Admin forms: ajouter offre / source (plus de prompts)
 */

const ADMIN_PASSWORD = "doyluadmin";
const PAGES = ["home", "promos", "guide", "contact"];
const COUNTRY_DEFAULT = "SN";

const SafeStorage = (() => {
  const memory = new Map();
  function hasLocalStorage() {
    try {
      const k = "__t__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
  const enabled = hasLocalStorage();
  return {
    getItem(key) {
      return enabled ? localStorage.getItem(key) : (memory.get(key) ?? null);
    },
    setItem(key, value) {
      enabled ? localStorage.setItem(key, value) : memory.set(key, String(value));
    },
  };
})();

function $(id) { return document.getElementById(id); }
function pad2(n) { return String(n).padStart(2, "0"); }
function isoNow() { return new Date().toISOString(); }
function nowHHmm() { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function formatMoney(n) {
  try { return new Intl.NumberFormat("fr-FR").format(n); }
  catch { return String(n); }
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}_${pad2(d.getMonth() + 1)}`;
}
function keyOfferSearch(offerId) { return `doylu_offer_search_${monthKey()}_${offerId}`; }
function keyOfferClick(offerId) { return `doylu_offer_click_${monthKey()}_${offerId}`; }
function keyGlobalSearch() { return `doylu_search_${monthKey()}`; }
function getNum(key) { return Number(SafeStorage.getItem(key) || "0"); }
function inc(key, by = 1) { const v = getNum(key) + by; SafeStorage.setItem(key, String(v)); return v; }
function popularityScore(offerId) { return getNum(keyOfferSearch(offerId)) + getNum(keyOfferClick(offerId)) * 3; }

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/* -----------------------
   Data in JS (temporaire)
------------------------ */
let OFFERS = [];
let OFFER_SOURCES = [];

function loadSeedData() {
  const t = isoNow();

  OFFERS = [
    // --- ORANGE (USSD OFFLINE #1234#) — d'après tes captures ---
    {
      offer_id: "off_orange_ussd_300mb_200",
      country: "SN",
      operator: "Orange",
      name: "Pass USSD 300Mo",
      price_fcfa: 200,
      type_usage: "data",
      data_mb: 300,
      minutes: null,
      sms: null,
      validity_type: "inconnu",
      validity_days: null,
      ussd_code: "#1234#",
      activation_path: "#1234# > Je choisis mon pass > 1 (300Mo à 200F)",
      status: "active",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: t,
      created_at: t,
      updated_at: t,
      hidden: false,
      is_sponsored: false,
      popularity_score: 0,
      alternative_offer_id: null,
      habitual_flag: false,
    },
    {
      offer_id: "off_orange_ussd_1_5go_500",
      country: "SN",
      operator: "Orange",
      name: "Pass USSD 1,5Go",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 1536,
      minutes: null,
      sms: null,
      validity_type: "inconnu",
      validity_days: null,
      ussd_code: "#1234#",
      activation_path: "#1234# > Je choisis mon pass > 2 (1,5Go à 500F)",
      status: "active",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: t,
      created_at: t,
      updated_at: t,
      hidden: false,
      is_sponsored: false,
      popularity_score: 0,
      alternative_offer_id: null,
      habitual_flag: true,
    },
    {
      offer_id: "off_orange_ussd_5go_1000",
      country: "SN",
      operator: "Orange",
      name: "Pass USSD 5Go",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 5120,
      minutes: null,
      sms: null,
      validity_type: "inconnu",
      validity_days: null,
      ussd_code: "#1234#",
      activation_path: "#1234# > Je choisis mon pass > 3 (5Go à 1000F)",
      status: "active",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: t,
      created_at: t,
      updated_at: t,
      hidden: false,
      is_sponsored: false,
      popularity_score: 0,
      alternative_offer_id: null,
      habitual_flag: true,
    },
    {
      offer_id: "off_orange_ussd_3_5go_700_24h",
      country: "SN",
      operator: "Orange",
      name: "Pass USSD 3,5Go (24h)",
      price_fcfa: 700,
      type_usage: "data",
      data_mb: 3584,
      minutes: null,
      sms: null,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "#1234# > (menu data) > 3,5Go 24H > payer (OM ou crédit)",
      status: "active",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: t,
      created_at: t,
      updated_at: t,
      hidden: false,
      is_sponsored: false,
      popularity_score: 0,
      alternative_offer_id: null,
      habitual_flag: false,
    },
  ];

  OFFER_SOURCES = [
    {
      source_id: "src_orange_ussd_capture_menu_1",
      offer_id: "off_orange_ussd_300mb_200",
      source_type: "website",
      platform: "ussd",
      source_url: null,
      raw_text: "Je choisis mon pass: 1:300Mo à 200F; 2:1,5Go à 500F; 3:5Go à 1000F",
      media_url: null,
      received_at: t,
      submitted_by: "frere_ussd",
      is_official: true,
      reliability_weight: 0,
      notes: "Capture menu USSD offline (#1234#)",
    },
    {
      source_id: "src_orange_ussd_capture_menu_2",
      offer_id: "off_orange_ussd_1_5go_500",
      source_type: "website",
      platform: "ussd",
      source_url: null,
      raw_text: "Je choisis mon pass: 1:300Mo à 200F; 2:1,5Go à 500F; 3:5Go à 1000F",
      media_url: null,
      received_at: t,
      submitted_by: "frere_ussd",
      is_official: true,
      reliability_weight: 0,
      notes: "Capture menu USSD offline (#1234#)",
    },
    {
      source_id: "src_orange_ussd_capture_menu_3",
      offer_id: "off_orange_ussd_5go_1000",
      source_type: "website",
      platform: "ussd",
      source_url: null,
      raw_text: "Je choisis mon pass: 1:300Mo à 200F; 2:1,5Go à 500F; 3:5Go à 1000F",
      media_url: null,
      received_at: t,
      submitted_by: "frere_ussd",
      is_official: true,
      reliability_weight: 0,
      notes: "Capture menu USSD offline (#1234#)",
    },
    {
      source_id: "src_orange_ussd_capture_3_5go_24h",
      offer_id: "off_orange_ussd_3_5go_700_24h",
      source_type: "website",
      platform: "ussd",
      source_url: null,
      raw_text: "3,5Go valable 24H à 700F. 1: Orange Money 2: crédit",
      media_url: null,
      received_at: t,
      submitted_by: "frere_ussd",
      is_official: true,
      reliability_weight: 0,
      notes: "Capture menu USSD offline (#1234#)",
    },
  ];
}

/* -----------------------
   Confidence + expiration
------------------------ */
const CONF_WEIGHTS = { sms: 60, social_official: 50, website: 45, user_submit: 25 };

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}
function recencyBonus(receivedAt) {
  const age = daysBetween(receivedAt, isoNow());
  if (age <= 7) return 15;
  if (age <= 14) return 10;
  if (age <= 30) return 5;
  return 0;
}
function baseWeightForSource(s) {
  if (s.source_type === "sms") return CONF_WEIGHTS.sms;
  if (s.source_type === "website") return CONF_WEIGHTS.website;
  if (s.source_type === "social") return s.is_official ? CONF_WEIGHTS.social_official : CONF_WEIGHTS.user_submit;
  if (s.source_type === "user_submit") return CONF_WEIGHTS.user_submit;
  return 0;
}
function offerMalus(o) {
  let m = 0;
  if (!o.validity_type || o.validity_type === "inconnu") m -= 10;
  if (!o.ussd_code || String(o.ussd_code).trim() === "") m -= 10;
  if (!o.type_usage) m -= 5;
  return m;
}
function computeConfidenceForOffer(offer) {
  const sources = OFFER_SOURCES.filter((s) => s.offer_id === offer.offer_id);
  if (sources.length === 0) return { score: clamp(0 + offerMalus(offer), 0, 100), topSources: [] };

  const scored = sources
    .map((s) => ({ ...s, _s: baseWeightForSource(s) + recencyBonus(s.received_at) }))
    .sort((a, b) => b._s - a._s);

  const top2 = scored.slice(0, 2);
  const sumTop = top2.reduce((acc, x) => acc + x._s, 0);
  return { score: clamp(sumTop + offerMalus(offer), 0, 100), topSources: top2 };
}
function computeLastSeenAt(offer) {
  const sources = OFFER_SOURCES.filter((s) => s.offer_id === offer.offer_id);
  if (sources.length === 0) return offer.last_seen_at || offer.updated_at || offer.created_at || isoNow();
  return sources.reduce((maxIso, s) => (new Date(s.received_at) > new Date(maxIso) ? s.received_at : maxIso), sources[0].received_at);
}
function computeStatus(lastSeenAt) {
  const age = daysBetween(lastSeenAt, isoNow());
  if (age > 60) return "expired";
  if (age > 30) return "a_confirmer";
  return "active";
}
function canonicalKeyFromOffer(o) {
  const data = Number(o.data_mb || 0);
  const mins = Number(o.minutes || 0);
  const days = Number(o.validity_days || 0);
  return [o.country || COUNTRY_DEFAULT, o.operator, o.type_usage, o.price_fcfa, data ? `d${data}` : "d0", mins ? `m${mins}` : "m0", days ? `v${days}` : "v0"].join("|");
}
function recomputeOfferDerived(offer) {
  offer.canonical_key = canonicalKeyFromOffer(offer);
  offer.last_seen_at = computeLastSeenAt(offer);

  const { score } = computeConfidenceForOffer(offer);
  offer.confidence_score = score;
  offer.is_verified = score >= 80;

  offer.status = computeStatus(offer.last_seen_at);
  offer.popularity_score = popularityScore(offer.offer_id);
  return offer;
}
function recomputeAll() {
  OFFERS = OFFERS.map((o) => recomputeOfferDerived(o));
}

/* -----------------------
   UI
------------------------ */
let selectedBudget = null;
let selectedUsage = "data";
let selectedValidity = "any";

function operatorCode(op) {
  if (op === "Orange") return "O";
  if (op === "Free") return "F";
  if (op === "Expresso") return "E";
  return "L";
}
function validityLabel(o) {
  if (o.validity_type && o.validity_type !== "inconnu") return o.validity_type;
  if (o.validity_days) return `${o.validity_days}j`;
  return "Inconnu";
}
function metaLine(o) {
  const parts = [];
  if (o.data_mb) parts.push(`📱 ${(Number(o.data_mb) / 1024).toFixed(Number(o.data_mb) % 1024 === 0 ? 0 : 1)} Go`);
  if (o.minutes) parts.push(`📞 ${o.minutes} min`);
  parts.push(`⏱ ${validityLabel(o)}`);
  return parts.join(" • ");
}
function oneBadge(offer) {
  if (offer.is_verified) return { cls: "verified", label: "Vérifié" };
  if (offer.is_sponsored) return { cls: "sponsor", label: "Sponsorisé" };
  const { topSources } = computeConfidenceForOffer(offer);
  const top = topSources[0];
  if (top && top.source_type === "sms") return { cls: "official", label: "Confirmé SMS" };
  if (top && (top.source_type === "website" || (top.source_type === "social" && top.is_official))) return { cls: "official", label: "Officiel" };
  return { cls: "neutral", label: "À confirmer" };
}

function toggleLoader(on, text = "Recherche en cours…") {
  $("loaderText").textContent = text;
  $("loader").style.display = on ? "flex" : "none";
}
function showSticky(on) { $("sticky").style.display = on ? "block" : "none"; }
function scrollToResults() { $("results").scrollIntoView({ behavior: "smooth", block: "start" }); }

function setLastUpdate() { $("lastUpdate").textContent = `aujourd’hui ${nowHHmm()}`; }
function renderSocialProof() { $("socialProof").textContent = `+ ${getNum(keyGlobalSearch()).toLocaleString("fr-FR")} recherches ce mois-ci`; }

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (t.style.display = "none"), 2000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

function passesValidity(o) {
  if (selectedValidity === "any") return true;
  const d = Number(selectedValidity);
  const days = Number(o.validity_days || 0);
  if (d === 1) return days <= 1;
  return days >= d;
}
function offerIsDisplayable(o, budget) {
  if (o.hidden) return false;
  if (o.status === "expired") return false;
  return o.price_fcfa <= budget && passesValidity(o);
}
function trackImpressions(list) { for (const o of list) inc(keyOfferSearch(o.offer_id), 1); }

function setBudget(b) {
  selectedBudget = b;
  document.querySelectorAll(".budget-btn").forEach((x) => x.classList.toggle("active", Number(x.dataset.b) === b));

  toggleLoader(true, "Recherche en cours…");
  inc(keyGlobalSearch(), 1);
  renderSocialProof();

  setTimeout(() => {
    recomputeAll();
    renderResults();
    toggleLoader(false);
    scrollToResults();
    showSticky(true);
  }, 500);
}

function renderBudgets() {
  const budgets = [1000, 2000, 3000, 5000];
  $("budgetGrid").innerHTML = budgets
    .map((b) => `<button class="budget-btn" type="button" data-b="${b}">${formatMoney(b)} FCFA</button>`)
    .join("");

  document.querySelectorAll(".budget-btn").forEach((btn) => {
    btn.addEventListener("click", () => setBudget(Number(btn.dataset.b)));
  });
}

function revealCode(offerId) {
  const box = document.getElementById(`ussd_${offerId}`);
  const copyBtn = document.getElementById(`copy_${offerId}`);
  const revealBtn = document.getElementById(`reveal_${offerId}`);
  if (!box || !copyBtn || !revealBtn) return;

  box.style.display = "block";
  copyBtn.style.display = "inline-flex";
  revealBtn.textContent = "✅ Code affiché";
  revealBtn.disabled = true;
}
async function copyUSSD(offerId, code) {
  const ok = await copyText(code);
  if (!ok) return showToast("Copie impossible sur ce navigateur.");

  inc(keyOfferClick(offerId), 1);
  recomputeAll();
  renderPopular();

  showToast("Code copié. Compose-le maintenant.");
  setTimeout(() => {
    const n = document.getElementById(`nudge_${offerId}`);
    if (n) n.style.display = "block";
  }, 2000);
}
function shareWhatsApp(title, price, ussd) {
  const msg = `Bon plan Doylu 🇸🇳\n${title}\nPrix: ${price} FCFA\nCode: ${ussd}\n`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}
function openWhatsAppChannel() {
  window.open(`https://wa.me/?text=${encodeURIComponent("Salut ! Je veux recevoir les bons plans Doylu sur WhatsApp.")}`, "_blank");
}
function openWhatsAppSupport() {
  window.open(`https://wa.me/?text=${encodeURIComponent("Salut Doylu, j’ai une question / un signalement.")}`, "_blank");
}

function renderResults() {
  const container = $("results");
  const usageSec = $("usageSecondary");
  const habit = $("habitMsg");

  if (!selectedBudget) {
    container.innerHTML = "";
    usageSec.style.display = "none";
    habit.style.display = "none";
    showSticky(false);
    return;
  }

  const rows = OFFERS
    .filter((o) => o.type_usage === selectedUsage && offerIsDisplayable(o, selectedBudget))
    .map((o) => ({ ...o }));

  rows.sort((a, b) => {
    if (Boolean(a.is_verified) !== Boolean(b.is_verified)) return a.is_verified ? -1 : 1;
    if (a.confidence_score !== b.confidence_score) return b.confidence_score - a.confidence_score;
    return a.price_fcfa - b.price_fcfa;
  });

  if (rows.length > 1 && rows[0].is_sponsored) {
    const idx = rows.findIndex((x) => !x.is_sponsored);
    if (idx > 0) { const t = rows[0]; rows[0] = rows[idx]; rows[idx] = t; }
  }

  const results = rows.slice(0, 6);
  trackImpressions(results);
  recomputeAll();
  renderPopular();

  if (results.length === 0) {
    container.innerHTML = `
      <div class="offer-card">
        <div class="offer-title">Aucune offre pour ${formatMoney(selectedBudget)} FCFA</div>
        <div class="meta">Essaie un autre budget ou change usage/validité.</div>
      </div>
    `;
  } else {
    container.innerHTML = results.map((o) => {
      const badge = oneBadge(o);
      const title = `${o.operator} — ${o.name}`;
      const ussd = o.ussd_code || "USSD indisponible";

      return `
        <div class="offer-card">
          <div class="top-row">
            <div class="operator">
              <div class="op-logo">${escapeHtml(operatorCode(o.operator))}</div>
              <div class="bold">${escapeHtml(o.operator)}</div>
            </div>
            <span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span>
          </div>

          <div class="offer-title">${escapeHtml(title)}</div>
          <div class="price">${formatMoney(o.price_fcfa)} FCFA</div>
          <div class="meta">${escapeHtml(metaLine(o))}</div>

          <button class="btn cta2" id="reveal_${o.offer_id}" type="button">👁️ Afficher le code</button>
          <div class="ussd-box" id="ussd_${o.offer_id}">${escapeHtml(ussd)}</div>

          <div class="row-actions">
            <button class="btn gray" id="copy_${o.offer_id}" type="button" style="display:none">📋 Copier</button>
            <button class="btn whatsapp" id="share_${o.offer_id}" type="button">🟢 Partager WhatsApp</button>
          </div>

          <div class="inline-nudge" id="nudge_${o.offer_id}">
            Ne rate plus les meilleures offres.
            <span class="meta2">🟢 Gratuit • 1 message/jour max.</span>
            <div style="margin-top:10px">
              <button class="btn whatsapp" id="nudgebtn_${o.offer_id}" type="button">Recevoir sur WhatsApp</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    for (const o of results) {
      const title = `${o.operator} — ${o.name}`;
      const ussd = o.ussd_code || "USSD indisponible";
      document.getElementById(`reveal_${o.offer_id}`)?.addEventListener("click", () => revealCode(o.offer_id));
      document.getElementById(`copy_${o.offer_id}`)?.addEventListener("click", () => copyUSSD(o.offer_id, ussd));
      document.getElementById(`share_${o.offer_id}`)?.addEventListener("click", () => shareWhatsApp(title, Number(o.price_fcfa), ussd));
      document.getElementById(`nudgebtn_${o.offer_id}`)?.addEventListener("click", openWhatsAppChannel);
    }
  }

  usageSec.style.display = "block";
  habit.style.display = "block";
}

function isPromoOffer(o) {
  const { topSources, score } = computeConfidenceForOffer(o);
  const recentSms = topSources.some((s) => s.source_type === "sms" && recencyBonus(s.received_at) >= 15);
  return o.status === "active" && (score >= 80 || recentSms);
}
function renderPromos() {
  const container = $("promoResults");
  const promos = OFFERS
    .filter((o) => !o.hidden && o.status !== "expired")
    .filter(isPromoOffer)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 12);

  if (!promos.length) {
    container.innerHTML = `
      <div class="offer-card">
        <div class="offer-title">Aucune promo pour le moment</div>
        <div class="meta">Ça se remplit dès qu’on ajoute des SMS promos.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = promos.map((o) => {
    const badge = oneBadge(o);
    const title = `${o.operator} — ${o.name}`;
    const ussd = o.ussd_code || "USSD indisponible";

    return `
      <div class="offer-card">
        <div class="top-row">
          <div class="operator">
            <div class="op-logo">${escapeHtml(operatorCode(o.operator))}</div>
            <div class="bold">${escapeHtml(o.operator)}</div>
          </div>
          <span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span>
        </div>

        <div class="offer-title">${escapeHtml(title)}</div>
        <div class="price">${formatMoney(o.price_fcfa)} FCFA</div>
        <div class="meta">${escapeHtml(metaLine(o))}</div>

        <button class="btn cta2" id="reveal_${o.offer_id}" type="button">👁️ Afficher le code</button>
        <div class="ussd-box" id="ussd_${o.offer_id}">${escapeHtml(ussd)}</div>

        <div class="row-actions">
          <button class="btn gray" id="copy_${o.offer_id}" type="button" style="display:none">📋 Copier</button>
          <button class="btn whatsapp" id="share_${o.offer_id}" type="button">🟢 Partager WhatsApp</button>
        </div>
      </div>
    `;
  }).join("");

  for (const o of promos) {
    const title = `${o.operator} — ${o.name}`;
    const ussd = o.ussd_code || "USSD indisponible";
    document.getElementById(`reveal_${o.offer_id}`)?.addEventListener("click", () => revealCode(o.offer_id));
    document.getElementById(`copy_${o.offer_id}`)?.addEventListener("click", () => copyUSSD(o.offer_id, ussd));
    document.getElementById(`share_${o.offer_id}`)?.addEventListener("click", () => shareWhatsApp(title, Number(o.price_fcfa), ussd));
  }
}

function renderPopular() {
  const el = $("popularList");
  const ranked = OFFERS
    .filter((o) => !o.hidden && o.status !== "expired")
    .map((o) => ({ ...o, _p: popularityScore(o.offer_id) }))
    .sort((a, b) => b._p - a._p)
    .slice(0, 3);

  if (!ranked.length || ranked.every((x) => x._p === 0)) {
    el.textContent = "Pas encore de données ce mois-ci. Clique un budget pour démarrer.";
    return;
  }

  el.innerHTML = ranked.map((o, i) => `
    <div style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:${i === 0 ? "0" : "1px solid #f1f5f9"}">
      <div class="bold">${escapeHtml(o.operator)} — ${escapeHtml(o.name)}</div>
      <div class="small-muted">${o._p} pts</div>
    </div>
  `).join("");
}

/* -----------------------
   Modal (FR only)
------------------------ */
function openModal(title, html) {
  $("modalTitle").textContent = title || "Info";
  $("modalBody").innerHTML = html || "<p></p>";
  $("modalBackdrop").style.display = "flex";
}
function closeModal() { $("modalBackdrop").style.display = "none"; }

function openHowVerify() {
  openModal("Comment on vérifie ?", `
    <ul>
      <li>On collecte des offres reçues par SMS et vues dans les menus USSD.</li>
      <li>On vérifie la cohérence (prix, volume, validité) et on retire les expirées.</li>
      <li>Le badge “Vérifié” apparaît quand il y a plusieurs preuves récentes.</li>
    </ul>
  `);
}

/* -----------------------
   Admin: paste JSON
------------------------ */
function applyImportedBundle(bundle) {
  if (!bundle || !Array.isArray(bundle.offers) || !Array.isArray(bundle.sources)) {
    throw new Error("invalid_bundle");
  }
  OFFERS = bundle.offers;
  OFFER_SOURCES = bundle.sources;

  recomputeAll();
  renderAdmin();
  renderPromos();
  renderPopular();
  if (selectedBudget) renderResults();
}

function openPasteImportModal() {
  openModal(
    "Coller un JSON (offers + sources)",
    `
      <p class="muted">Colle un JSON au format: <strong>{ "offers": [...], "sources": [...] }</strong></p>
      <textarea id="pasteJson" class="textarea" placeholder='{"offers":[...],"sources":[...]}'></textarea>
      <div class="modal-actions">
        <button class="btn cta2" type="button" id="pasteImportConfirm">Importer</button>
        <button class="btn gray" type="button" id="pasteImportCancel">Annuler</button>
      </div>
    `
  );

  document.getElementById("pasteImportCancel")?.addEventListener("click", closeModal);

  document.getElementById("pasteImportConfirm")?.addEventListener("click", () => {
    const raw = String(document.getElementById("pasteJson")?.value || "").trim();
    if (!raw) return alert("Colle le JSON d'abord.");

    try {
      const bundle = JSON.parse(raw);
      applyImportedBundle(bundle);
      closeModal();
      showToast("Import collé OK ✅");
    } catch {
      alert('JSON invalide. Format attendu: { "offers": [...], "sources": [...] }');
    }
  });
}

/* -----------------------
   Admin: forms (no prompts)
------------------------ */
function openAddOfferModal() {
  openModal("Ajouter une offre", `
    <div class="form-grid">
      <div>
        <div class="small-muted">Opérateur</div>
        <select id="f_operator">
          <option>Orange</option>
          <option>Free</option>
          <option>Expresso</option>
          <option>Lebara</option>
        </select>
      </div>
      <div>
        <div class="small-muted">Type</div>
        <select id="f_type_usage">
          <option value="data">data</option>
          <option value="appels">appels</option>
          <option value="mixte">mixte</option>
        </select>
      </div>

      <div>
        <div class="small-muted">Nom de l’offre</div>
        <input id="f_name" placeholder="Ex: Pass 1,5Go" />
      </div>
      <div>
        <div class="small-muted">Prix (FCFA)</div>
        <input id="f_price" type="number" placeholder="1000" />
      </div>

      <div>
        <div class="small-muted">Data (MB)</div>
        <input id="f_data_mb" type="number" placeholder="Ex: 1536" />
      </div>
      <div>
        <div class="small-muted">Minutes</div>
        <input id="f_minutes" type="number" placeholder="Ex: 60" />
      </div>

      <div>
        <div class="small-muted">Validité (jours)</div>
        <input id="f_validity_days" type="number" placeholder="Ex: 7" />
      </div>
      <div>
        <div class="small-muted">Validité type</div>
        <select id="f_validity_type">
          <option value="inconnu">inconnu</option>
          <option value="24h">24h</option>
          <option value="7j">7j</option>
          <option value="30j">30j</option>
          <option value="mois">mois</option>
          <option value="illimite">illimite</option>
        </select>
      </div>

      <div>
        <div class="small-muted">Code USSD</div>
        <input id="f_ussd" placeholder="Ex: #1234#" />
      </div>
      <div>
        <div class="small-muted">Sponsorisé</div>
        <select id="f_sponsored">
          <option value="false">non</option>
          <option value="true">oui</option>
        </select>
      </div>
    </div>

    <div class="small-muted" style="margin-top:10px">Chemin d’activation (optionnel)</div>
    <input id="f_activation_path" placeholder="Ex: #1234# > Internet > option 2" />

    <div class="modal-actions">
      <button class="btn cta2" type="button" id="f_save_offer">Enregistrer</button>
      <button class="btn gray" type="button" id="f_cancel_offer">Annuler</button>
    </div>
  `);

  document.getElementById("f_cancel_offer")?.addEventListener("click", closeModal);

  document.getElementById("f_save_offer")?.addEventListener("click", () => {
    const operator = String(document.getElementById("f_operator")?.value || "Orange");
    const type_usage = String(document.getElementById("f_type_usage")?.value || "data");
    const name = String(document.getElementById("f_name")?.value || "").trim();
    const price_fcfa = Number(document.getElementById("f_price")?.value || 0);

    if (!name || !price_fcfa) return alert("Nom + prix obligatoires.");

    const data_mb_raw = String(document.getElementById("f_data_mb")?.value || "").trim();
    const minutes_raw = String(document.getElementById("f_minutes")?.value || "").trim();
    const validity_days_raw = String(document.getElementById("f_validity_days")?.value || "").trim();

    const data_mb = data_mb_raw ? Number(data_mb_raw) : null;
    const minutes = minutes_raw ? Number(minutes_raw) : null;
    const validity_days = validity_days_raw ? Number(validity_days_raw) : null;

    const validity_type = String(document.getElementById("f_validity_type")?.value || "inconnu");
    const ussd_code = String(document.getElementById("f_ussd")?.value || "").trim() || null;
    const activation_path = String(document.getElementById("f_activation_path")?.value || "").trim() || null;
    const is_sponsored = String(document.getElementById("f_sponsored")?.value || "false") === "true";

    const t = isoNow();
    const offer_id = makeId("off");

    const offer = {
      offer_id,
      country: "SN",
      operator,
      name,
      price_fcfa,
      type_usage,
      data_mb,
      minutes,
      sms: null,
      validity_type,
      validity_days,
      ussd_code,
      activation_path,
      status: "active",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: t,
      created_at: t,
      updated_at: t,
      hidden: false,
      is_sponsored,
      popularity_score: 0,
      alternative_offer_id: null,
      habitual_flag: false,
    };

    OFFERS.unshift(recomputeOfferDerived(offer));
    closeModal();
    renderAdmin();
    renderPromos();
    renderPopular();
    if (selectedBudget) renderResults();
    showToast("Offre ajoutée ✅");
  });
}

function openAddSourceModal() {
  const offerOptions = OFFERS.map((o) => `<option value="${escapeHtml(o.offer_id)}">${escapeHtml(o.operator)} — ${escapeHtml(o.name)}</option>`).join("");

  openModal("Ajouter une source (preuve)", `
    <div class="small-muted">Offre</div>
    <select id="s_offer_id">${offerOptions}</select>

    <div class="form-grid" style="margin-top:10px">
      <div>
        <div class="small-muted">Type source</div>
        <select id="s_source_type">
          <option value="sms">sms</option>
          <option value="website">website</option>
          <option value="social">social</option>
          <option value="user_submit">user_submit</option>
        </select>
      </div>
      <div>
        <div class="small-muted">Platform</div>
        <select id="s_platform">
          <option value="whatsapp">whatsapp</option>
          <option value="ussd">ussd</option>
          <option value="facebook">facebook</option>
          <option value="instagram">instagram</option>
          <option value="x">x</option>
          <option value="tiktok">tiktok</option>
          <option value="web">web</option>
          <option value="unknown">unknown</option>
        </select>
      </div>
    </div>

    <div class="form-grid">
      <div>
        <div class="small-muted">Officiel ?</div>
        <select id="s_official">
          <option value="true">oui</option>
          <option value="false">non</option>
        </select>
      </div>
      <div>
        <div class="small-muted">Soumis par</div>
        <input id="s_submitted_by" placeholder="Ex: frere_1 / famille" />
      </div>
    </div>

    <div class="small-muted">Texte brut (SMS / menu / post)</div>
    <textarea id="s_raw_text" placeholder="Colle ici le SMS ou le texte du menu"></textarea>

    <div class="modal-actions">
      <button class="btn cta2" type="button" id="s_save">Enregistrer</button>
      <button class="btn gray" type="button" id="s_cancel">Annuler</button>
    </div>
  `);

  document.getElementById("s_cancel")?.addEventListener("click", closeModal);

  document.getElementById("s_save")?.addEventListener("click", () => {
    const offer_id = String(document.getElementById("s_offer_id")?.value || "").trim();
    const source_type = String(document.getElementById("s_source_type")?.value || "sms");
    const platform = String(document.getElementById("s_platform")?.value || "whatsapp");
    const is_official = String(document.getElementById("s_official")?.value || "true") === "true";
    const submitted_by = String(document.getElementById("s_submitted_by")?.value || "admin").trim() || "admin";
    const raw_text = String(document.getElementById("s_raw_text")?.value || "").trim();

    if (!offer_id) return alert("Choisis une offre.");
    if (!raw_text) return alert("Ajoute le texte brut (SMS/menu/post).");

    const t = isoNow();
    const source = {
      source_id: makeId("src"),
      offer_id,
      source_type,
      platform,
      source_url: null,
      raw_text,
      media_url: null,
      received_at: t,
      submitted_by,
      is_official,
      reliability_weight: 0,
      notes: "",
    };

    OFFER_SOURCES.unshift(source);

    const offer = OFFERS.find((o) => o.offer_id === offer_id);
    if (offer) recomputeOfferDerived(offer);

    closeModal();
    renderAdmin();
    renderPromos();
    renderPopular();
    if (selectedBudget) renderResults();
    showToast("Source ajoutée ✅");
  });
}

/* -----------------------
   Routing + admin invisible
------------------------ */
function toggleMobileMenu(forceClose = false) {
  const menu = $("mobileMenu");
  if (forceClose) { menu.classList.add("hidden"); return; }
  menu.classList.toggle("hidden");
}
function currentPageFromHash() {
  const h = (window.location.hash || "#home").replace("#", "");
  return PAGES.includes(h) ? h : "home";
}
function showPage(page) {
  for (const p of PAGES) {
    $("page_" + p)?.classList.toggle("hidden-page", p !== page);
    $("nav_" + p)?.classList.toggle("active", p === page);
    $("mnav_" + p)?.classList.toggle("active", p === page);
  }
}

function adminAuth() { return prompt("Mot de passe admin ?") === ADMIN_PASSWORD; }
function openAdminIfAllowed() {
  if (!adminAuth()) { window.location.hash = "#home"; return false; }
  $("adminPanel").style.display = "block";
  $("adminPanel").setAttribute("aria-hidden", "false");
  renderAdmin();
  return true;
}
function closeAdmin() {
  $("adminPanel").style.display = "none";
  $("adminPanel").setAttribute("aria-hidden", "true");
}
function handleAdminRoute() {
  if (window.location.hash === "#admin") openAdminIfAllowed();
  else closeAdmin();
}

/* -----------------------
   Admin list + import/export
------------------------ */
function renderAdmin() {
  const list = $("adminList");
  list.innerHTML = OFFERS.map((o) => `
    <div class="admin-item">
      <div class="bold">#${escapeHtml(o.offer_id)} • ${escapeHtml(o.operator)} • ${escapeHtml(o.name)}</div>
      <div class="small-muted">conf: ${o.confidence_score}/100 • status: ${escapeHtml(o.status)} • pop: ${o.popularity_score}</div>
      <div class="hr"></div>

      <select data-offer="${o.offer_id}" data-field="operator">
        <option ${o.operator === "Orange" ? "selected" : ""}>Orange</option>
        <option ${o.operator === "Free" ? "selected" : ""}>Free</option>
        <option ${o.operator === "Expresso" ? "selected" : ""}>Expresso</option>
        <option ${o.operator === "Lebara" ? "selected" : ""}>Lebara</option>
      </select>

      <input data-offer="${o.offer_id}" data-field="name" value="${escapeHtml(o.name)}" />
      <input data-offer="${o.offer_id}" data-field="price_fcfa" type="number" value="${Number(o.price_fcfa)}" />

      <select data-offer="${o.offer_id}" data-field="type_usage">
        <option value="data" ${o.type_usage === "data" ? "selected" : ""}>data</option>
        <option value="mixte" ${o.type_usage === "mixte" ? "selected" : ""}>mixte</option>
        <option value="appels" ${o.type_usage === "appels" ? "selected" : ""}>appels</option>
      </select>

      <input data-offer="${o.offer_id}" data-field="data_mb" type="number" value="${o.data_mb ?? ""}" placeholder="data_mb" />
      <input data-offer="${o.offer_id}" data-field="minutes" type="number" value="${o.minutes ?? ""}" placeholder="minutes" />
      <input data-offer="${o.offer_id}" data-field="validity_days" type="number" value="${o.validity_days ?? ""}" placeholder="validity_days" />
      <input data-offer="${o.offer_id}" data-field="ussd_code" value="${escapeHtml(o.ussd_code ?? "")}" placeholder="ussd_code" />
      <input data-offer="${o.offer_id}" data-field="activation_path" value="${escapeHtml(o.activation_path ?? "")}" placeholder="activation_path" />

      <div class="admin-row">
        <label><input data-offer="${o.offer_id}" data-field="hidden" type="checkbox" ${o.hidden ? "checked" : ""}/> hidden</label>
        <label><input data-offer="${o.offer_id}" data-field="is_sponsored" type="checkbox" ${o.is_sponsored ? "checked" : ""}/> sponsorisé</label>
        <label><input data-offer="${o.offer_id}" data-field="habitual_flag" type="checkbox" ${o.habitual_flag ? "checked" : ""}/> habitual</label>
      </div>

      <div class="admin-actions">
        <button class="save" type="button" data-action="recompute" data-offer="${o.offer_id}">Recalculer</button>
        <button class="danger" type="button" data-action="delete" data-offer="${o.offer_id}">Supprimer</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("input,select,textarea").forEach((el) => {
    el.addEventListener("change", () => {
      const offerId = el.getAttribute("data-offer");
      const field = el.getAttribute("data-field");
      const offer = OFFERS.find((x) => x.offer_id === offerId);
      if (!offer) return;

      let v;
      if (el.type === "checkbox") v = el.checked;
      else v = el.value;

      if (["price_fcfa", "data_mb", "minutes", "validity_days"].includes(field)) v = v === "" ? null : Number(v);

      offer[field] = v;
      offer.updated_at = isoNow();

      recomputeOfferDerived(offer);

      if (selectedBudget) renderResults();
      renderPromos();
      renderPopular();
    });
  });

  list.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const offerId = btn.getAttribute("data-offer");
      if (!offerId) return;

      if (action === "recompute") {
        const offer = OFFERS.find((x) => x.offer_id === offerId);
        if (!offer) return;
        recomputeOfferDerived(offer);
        renderAdmin();
        if (selectedBudget) renderResults();
        renderPopular();
        return;
      }

      if (action === "delete") {
        if (!confirm("Supprimer cette offre + ses sources ?")) return;
        OFFERS = OFFERS.filter((o) => o.offer_id !== offerId);
        OFFER_SOURCES = OFFER_SOURCES.filter((s) => s.offer_id !== offerId);
        renderAdmin();
        if (selectedBudget) renderResults();
        renderPopular();
      }
    });
  });
}

function adminExport() {
  const bundle = { offers: OFFERS, sources: OFFER_SOURCES, exported_at: isoNow() };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doylu_export_${monthKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Export JSON ✅");
}

function adminImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const bundle = JSON.parse(String(reader.result || "{}"));
      applyImportedBundle(bundle);
      showToast("Import fichier OK ✅");
    } catch {
      alert('Import invalide. Format attendu: { "offers": [...], "sources": [...] }');
    }
  };
  reader.readAsText(file);
}

/* -----------------------
   Page events + boot
------------------------ */
function bindEvents() {
  $("brandBtn").addEventListener("click", () => (window.location.hash = "#home"));
  $("brandBtn").addEventListener("keydown", (e) => { if (e.key === "Enter") window.location.hash = "#home"; });

  $("hamburgerBtn").addEventListener("click", () => toggleMobileMenu());
  for (const p of ["home", "promos", "guide", "contact"]) $("mnav_" + p)?.addEventListener("click", () => toggleMobileMenu(true));

  $("howVerifyLink").addEventListener("click", (e) => { e.preventDefault(); openHowVerify(); });

  $("modalBackdrop").addEventListener("click", (e) => { if (e.target?.id === "modalBackdrop") closeModal(); });
  $("modalCloseBtn").addEventListener("click", closeModal);

  $("waOptIn").addEventListener("click", openWhatsAppChannel);
  $("waSupportBtn").addEventListener("click", openWhatsAppSupport);
  $("stickyBtn").addEventListener("click", scrollToResults);

  $("reportBtn").addEventListener("click", () => openModal("Signaler une offre", "<p class='muted'>V1 : envoie ton signalement sur WhatsApp Business.</p>"));
  $("sendPromoBtn").addEventListener("click", () => openModal("Envoyer une promo SMS", "<p class='muted'>V1 : copie-colle le SMS promo dans WhatsApp Business.</p>"));
  $("backHomeBtn").addEventListener("click", () => { window.location.hash = "#home"; setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50); });

  document.querySelectorAll("[data-valid]").forEach((ch) => ch.addEventListener("click", () => {
    const v = ch.getAttribute("data-valid");
    selectedValidity = v === "any" ? "any" : Number(v);
    document.querySelectorAll("[data-valid]").forEach((x) => x.classList.remove("active"));
    ch.classList.add("active");
    if (selectedBudget) setBudget(selectedBudget);
  }));

  document.querySelectorAll(".filter-btn").forEach((btn) => btn.addEventListener("click", () => {
    selectedUsage = btn.getAttribute("data-u");
    document.querySelectorAll(".filter-btn").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    if (selectedBudget) setBudget(selectedBudget);
  }));

  document.querySelectorAll(".acc-head").forEach((h) => h.addEventListener("click", () => {
    const body = h.nextElementSibling;
    if (!body) return;
    body.style.display = body.style.display === "block" ? "none" : "block";
  }));

  // Admin buttons
  $("adminAddOfferBtn").addEventListener("click", openAddOfferModal);
  $("adminAddSourceBtn").addEventListener("click", openAddSourceModal);
  $("adminRecomputeBtn").addEventListener("click", () => { recomputeAll(); renderAdmin(); renderPopular(); if (selectedBudget) renderResults(); showToast("Recalcul OK ✅"); });
  $("adminExportBtn").addEventListener("click", adminExport);
  $("adminImportBtn").addEventListener("click", () => $("adminImportFile").click());
  $("adminPasteBtn").addEventListener("click", openPasteImportModal);
  $("adminImportFile").addEventListener("change", (e) => { const f = e.target.files?.[0]; if (f) adminImport(f); });
}

function boot() {
  loadSeedData();
  recomputeAll();

  bindEvents();
  renderBudgets();
  renderPopular();
  renderPromos();

  setLastUpdate();
  renderSocialProof();
  setInterval(setLastUpdate, 30_000);

  showPage(currentPageFromHash());
  handleAdminRoute();
}

window.addEventListener("hashchange", () => {
  showPage(currentPageFromHash());
  if (currentPageFromHash() === "promos") renderPromos();
  handleAdminRoute();
});

boot();
