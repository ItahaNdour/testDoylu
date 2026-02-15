// script.js
"use strict";

/**
 * Doylu V1 — Static HTML/CSS/JS
 * - Routing hash: #/accueil | #/promos | #/guide | #/contact | #/admin
 * - Offline: offers + meta saved in localStorage
 * - Best offer + gain computed ONLY on public offers
 * - Filters: budget, usage, operator, validity
 * - Admin: login, add/update/delete, export/import JSON
 */

const STORAGE_OFFERS = "doylu_offers_v1";
const STORAGE_META = "doylu_meta_v1";
const STORAGE_ADMIN = "doylu_admin_session_v1";

const ADMIN_PASSWORD = "doylu123";
const OPERATORS_SN = ["Orange", "Free", "Expresso"];
const USAGE_TYPES = ["data", "mixte", "appels"];

const $ = (id) => document.getElementById(id);

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function toInt(v, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mbToHuman(mb) {
  const v = Number(mb);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1024) {
    const go = v / 1024;
    const rounded = Math.round(go * 10) / 10;
    return `${rounded} Go`;
  }
  const rounded = Math.round(v / 50) * 50;
  return `${rounded} Mo`;
}

function formatMinutes(min) {
  const v = Number(min);
  if (!Number.isFinite(v) || v <= 0) return null;
  return `${v} min`;
}

function validityLabel(offer) {
  const t = String(offer.validity_type || "inconnu");
  if (t === "24h") return "24h";
  if (t === "7j") return "7 jours";
  if (t === "30j") return "30 jours";
  const d = Number(offer.validity_days);
  if (Number.isFinite(d) && d > 0) return `${d} jours`;
  return "Inconnu";
}

function normalizeOffer(o) {
  const iso = nowIso();
  return {
    offer_id: String(o.offer_id || "").trim() || `offer_${Math.random().toString(16).slice(2)}`,
    country: "SN",
    operator: OPERATORS_SN.includes(o.operator) ? o.operator : "Orange",
    name: String(o.name || "Offre"),
    price_fcfa: toInt(o.price_fcfa, 0),
    type_usage: USAGE_TYPES.includes(o.type_usage) ? o.type_usage : "data",
    data_mb: Number.isFinite(Number(o.data_mb)) ? toInt(o.data_mb, null) : null,
    minutes: Number.isFinite(Number(o.minutes)) ? toInt(o.minutes, null) : null,
    validity_type: ["24h", "7j", "30j", "inconnu"].includes(o.validity_type) ? o.validity_type : "inconnu",
    validity_days: Number.isFinite(Number(o.validity_days)) ? toInt(o.validity_days, null) : null,
    ussd_code: o.ussd_code ? String(o.ussd_code) : null,
    activation_path: o.activation_path ? String(o.activation_path) : null,
    status: ["active", "a_confirmer", "expired"].includes(o.status) ? o.status : "active",
    confidence_score: toInt(o.confidence_score, 0),
    is_verified: Boolean(o.is_verified),
    is_promo: Boolean(o.is_promo),
    source_type: ["sms", "official", "website", "user_submit"].includes(o.source_type) ? o.source_type : "user_submit",
    eligibility_type: ["public", "student", "corporate", "special"].includes(o.eligibility_type)
      ? o.eligibility_type
      : "public",
    last_seen_at: o.last_seen_at || iso,
    created_at: o.created_at || iso,
    updated_at: iso,
  };
}

function seedOffers() {
  const iso = nowIso();
  return [
    // Orange (captures)
    normalizeOffer({
      offer_id: "orange_jour_300mb_200",
      operator: "Orange",
      name: "Pass Jour 300Mo",
      price_fcfa: 200,
      type_usage: "data",
      data_mb: 300,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Jour > 300Mo",
      status: "active",
      is_verified: true,
      confidence_score: 85,
      source_type: "official",
      eligibility_type: "public",
      created_at: iso,
    }),
    normalizeOffer({
      offer_id: "orange_jour_15go_500",
      operator: "Orange",
      name: "Pass Jour 1,5Go",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 1536,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Jour > 1,5Go",
      status: "active",
      is_verified: true,
      confidence_score: 80,
      source_type: "official",
      eligibility_type: "public",
      created_at: iso,
    }),
    normalizeOffer({
      offer_id: "orange_jour_5go_1000",
      operator: "Orange",
      name: "Pass Jour 5Go",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 5120,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Jour > 5Go",
      status: "active",
      is_verified: true,
      confidence_score: 80,
      source_type: "official",
      eligibility_type: "public",
      created_at: iso,
    }),
    normalizeOffer({
      offer_id: "orange_nuit_5go_500",
      operator: "Orange",
      name: "Pass Nuit 5Go",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 5120,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Nuit > 5Go",
      status: "active",
      is_verified: false,
      confidence_score: 75,
      source_type: "sms",
      eligibility_type: "public",
      created_at: iso,
    }),
    normalizeOffer({
      offer_id: "orange_semaine_600mb_500",
      operator: "Orange",
      name: "Pass Semaine 600Mo",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 600,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Semaine > 600Mo",
      status: "active",
      is_verified: false,
      confidence_score: 70,
      source_type: "official",
      eligibility_type: "public",
      created_at: iso,
    }),
    normalizeOffer({
      offer_id: "orange_semaine_2go_1000",
      operator: "Orange",
      name: "Pass Semaine 2Go",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 2048,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Semaine > 2Go",
      status: "active",
      is_verified: false,
      confidence_score: 70,
      source_type: "official",
      eligibility_type: "public",
      created_at: iso,
    }),
    normalizeOffer({
      offer_id: "orange_mois_10go_promo_2000",
      operator: "Orange",
      name: "Pass Mois 10Go (Promo)",
      price_fcfa: 2000,
      type_usage: "data",
      data_mb: 10240,
      validity_type: "30j",
      validity_days: 30,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Mois > 10Go",
      status: "active",
      is_verified: false,
      confidence_score: 75,
      source_type: "sms",
      eligibility_type: "public",
      is_promo: true,
      created_at: iso,
    }),
    // Offer special: visible but never #1
    normalizeOffer({
      offer_id: "orange_education_1go_100",
      operator: "Orange",
      name: "Pass Éducation 1Go",
      price_fcfa: 100,
      type_usage: "data",
      data_mb: 1024,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Éducation",
      status: "active",
      is_verified: false,
      confidence_score: 60,
      source_type: "official",
      eligibility_type: "student",
      created_at: iso,
    }),
  ];
}

function getMeta() {
  const raw = localStorage.getItem(STORAGE_META);
  const meta = safeJsonParse(raw, {});
  return {
    lastUpdateISO: meta.lastUpdateISO || null,
    waLink: meta.waLink || "https://wa.me/?text=",
  };
}

function setMeta(patch) {
  const meta = { ...getMeta(), ...patch };
  localStorage.setItem(STORAGE_META, JSON.stringify(meta));
  return meta;
}

function loadOffers() {
  const raw = localStorage.getItem(STORAGE_OFFERS);
  const offers = safeJsonParse(raw, null);
  if (Array.isArray(offers) && offers.length) {
    return offers.map(normalizeOffer).filter((o) => OPERATORS_SN.includes(o.operator));
  }
  const seeded = seedOffers();
  localStorage.setItem(STORAGE_OFFERS, JSON.stringify(seeded));
  setMeta({ lastUpdateISO: nowIso() });
  return seeded;
}

function saveOffers(offers) {
  const clean = offers.map(normalizeOffer).filter((o) => OPERATORS_SN.includes(o.operator));
  localStorage.setItem(STORAGE_OFFERS, JSON.stringify(clean));
  setMeta({ lastUpdateISO: nowIso() });
  return clean;
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => (el.hidden = true), 1600);
}

function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").hidden = false;
}
function closeModal() {
  $("modal").hidden = true;
}

function routeName() {
  const h = (location.hash || "#/accueil").trim();
  const p = h.startsWith("#/") ? h.slice(2) : "accueil";
  const route = p.split("?")[0];
  return ["accueil", "promos", "guide", "contact", "admin"].includes(route) ? route : "accueil";
}

function showRoute(route) {
  ["accueil", "promos", "guide", "contact", "admin"].forEach((r) => {
    const el = $(`page-${r}`);
    if (el) el.hidden = r !== route;
  });

  document.querySelectorAll(".nav__link").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.nav === route);
  });

  const mobile = $("mobileNav");
  if (mobile) mobile.hidden = true;
}

function setChipActive(containerId, predicate) {
  const root = $(containerId);
  if (!root) return;
  root.querySelectorAll(".chip").forEach((b) => b.classList.toggle("chip--active", predicate(b)));
}

function computeScore(offer, usage) {
  const price = Number(offer.price_fcfa);
  if (!Number.isFinite(price) || price <= 0) return -Infinity;

  const data = Number(offer.data_mb);
  const mins = Number(offer.minutes);
  const days = Number(offer.validity_days);

  const dataValue = Number.isFinite(data) && data > 0 ? data / price : 0; // MB/FCFA
  const minsValue = Number.isFinite(mins) && mins > 0 ? mins / price : 0; // min/FCFA
  const validityBonus = Number.isFinite(days) ? Math.min(days, 30) / 30 : 0;
  const verifiedBonus = offer.is_verified ? 0.5 : 0;

  let wData = 0.85, wMin = 0.15;
  if (usage === "appels") { wData = 0.15; wMin = 0.85; }
  if (usage === "mixte") { wData = 0.65; wMin = 0.35; }

  return dataValue * wData * 1000 + minsValue * wMin * 100 + validityBonus + verifiedBonus;
}

function matchesOffer(offer, filters) {
  if (!offer || offer.status === "expired") return false;
  if (offer.status !== "active" && offer.status !== "a_confirmer") return false;

  const price = Number(offer.price_fcfa);
  if (!Number.isFinite(price)) return false;
  if (price > filters.budget) return false;

  if (filters.operator !== "all" && offer.operator !== filters.operator) return false;

  if (filters.validity !== "all") {
    if ((offer.validity_type || "inconnu") !== filters.validity) return false;
  }

  if (filters.usage === "data") {
    // Accept data and mixte
    if (!(offer.type_usage === "data" || offer.type_usage === "mixte")) return false;
  } else if (filters.usage === "appels") {
    if (!(offer.type_usage === "appels" || offer.type_usage === "mixte")) return false;
  } else {
    // mixte -> accept all (data/appels/mixte)
    if (!USAGE_TYPES.includes(offer.type_usage)) return false;
  }

  return true;
}

function splitPublicSpecial(list) {
  const pub = [];
  const special = [];
  for (const o of list) {
    const e = o.eligibility_type || "public";
    if (e === "public") pub.push(o);
    else special.push(o);
  }
  return { pub, special };
}

// gain rules
function formatGainDataMb(gainMb) {
  if (!Number.isFinite(gainMb) || gainMb <= 0) return null;
  if (gainMb < 1024) {
    const rounded = Math.round(gainMb / 50) * 50;
    if (rounded <= 0) return null;
    return `+${rounded} Mo de plus que l’offre publique suivante`;
  }
  const go = gainMb / 1024;
  const roundedGo = Math.round(go * 2) / 2; // 0.5
  if (roundedGo <= 0) return null;
  const txt = roundedGo % 1 === 0 ? roundedGo.toFixed(0) : roundedGo.toFixed(1);
  return `+${txt} Go de plus que l’offre publique suivante`;
}

function formatGainMinutes(gainMin) {
  if (!Number.isFinite(gainMin) || gainMin <= 0) return null;
  const rounded = Math.round(gainMin / 5) * 5;
  if (rounded <= 0) return null;
  return `+${rounded} min de plus que l’offre publique suivante`;
}

// Economy FCFA only if best cheaper AND >= on main metric
function computeEconomyFcfa(best, second, usage) {
  const p1 = Number(best?.price_fcfa);
  const p2 = Number(second?.price_fcfa);
  if (!Number.isFinite(p1) || !Number.isFinite(p2)) return null;
  if (p1 >= p2) return null;

  if (usage === "data") {
    const d1 = Number(best?.data_mb);
    const d2 = Number(second?.data_mb);
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;
    if (d1 < d2) return null;
    return p2 - p1;
  }
  if (usage === "appels") {
    const m1 = Number(best?.minutes);
    const m2 = Number(second?.minutes);
    if (!Number.isFinite(m1) || !Number.isFinite(m2)) return null;
    if (m1 < m2) return null;
    return p2 - p1;
  }
  // mixte: prefer data else minutes
  const d1 = Number(best?.data_mb);
  const d2 = Number(second?.data_mb);
  if (Number.isFinite(d1) && Number.isFinite(d2)) {
    if (d1 < d2) return null;
    return p2 - p1;
  }
  const m1 = Number(best?.minutes);
  const m2 = Number(second?.minutes);
  if (Number.isFinite(m1) && Number.isFinite(m2)) {
    if (m1 < m2) return null;
    return p2 - p1;
  }
  return null;
}

function renderOfferCard(offer, isTop) {
  const badge = (() => {
    if (isTop) return { text: "🏆 TOP CHOIX", cls: "tag--top" };
    if (offer.is_promo) return { text: "Promo", cls: "tag--promo" };
    if (offer.is_verified) return { text: "Vérifié", cls: "" };
    if ((offer.eligibility_type || "public") !== "public") return { text: "Sous conditions", cls: "tag--special" };
    if (offer.source_type === "sms") return { text: "Source SMS", cls: "tag--sms" };
    if (offer.source_type === "official") return { text: "Source officielle", cls: "" };
    return null;
  })();

  const dataText = mbToHuman(offer.data_mb);
  const minText = formatMinutes(offer.minutes);
  const vText = validityLabel(offer);

  const metaParts = [];
  if (dataText) metaParts.push(`📱 ${dataText}`);
  if (minText) metaParts.push(`📞 ${minText}`);
  metaParts.push(`⏱ ${vText}`);

  const ussd = offer.ussd_code ? String(offer.ussd_code) : "";
  const canCopy = Boolean(ussd);

  return `
    <article class="offerCard" data-id="${escapeHtml(offer.offer_id)}">
      <div class="offerTop">
        <div class="opBadge">
          <div class="opCircle">${escapeHtml((offer.operator || "?").slice(0, 1))}</div>
          <div>
            <div class="offerName">${escapeHtml(offer.operator)} — ${escapeHtml(offer.name)}</div>
            <div class="offerMeta">${metaParts.map((x) => `<span>${escapeHtml(x)}</span>`).join("")}</div>
          </div>
        </div>
        ${badge ? `<span class="tag ${badge.cls}">${escapeHtml(badge.text)}</span>` : ""}
      </div>

      <div class="offerPrice">${escapeHtml(String(offer.price_fcfa))} FCFA</div>

      <div class="offerBtns">
        <button class="btn btn--big" data-action="reveal" type="button">
          Afficher le code
        </button>
        <button class="btn btn--copy" data-action="copy" type="button" ${canCopy ? "" : "disabled"}>
          Copier
        </button>
        <button class="btn btn--share" data-action="share" type="button">
          Partager WhatsApp
        </button>
      </div>

      <div class="reveal" data-role="reveal" hidden>
        ${ussd ? escapeHtml(ussd) : "Code indisponible"}
      </div>
    </article>
  `;
}

function renderHome(offers, filters) {
  const filtered = offers.filter((o) => matchesOffer(o, filters));
  const { pub, special } = splitPublicSpecial(filtered);

  const sortedPub = [...pub].sort((a, b) => computeScore(b, filters.usage) - computeScore(a, filters.usage));
  const sortedSpecial = [...special].sort((a, b) => computeScore(b, filters.usage) - computeScore(a, filters.usage));

  const best = sortedPub[0] || null;
  const second = sortedPub[1] || null;

  // Banner
  const bestBanner = $("bestBanner");
  const bestTitle = $("bestTitle");
  const bestGain = $("bestGain");
  const bestTip = $("bestTip");
  const bestDesc = $("bestDesc");

  if (best && bestBanner) {
    bestBanner.hidden = false;
    bestTitle.textContent = `🔥 Meilleure valeur pour ${filters.budget} FCFA (${filters.usage})`;

    let gainLine = null;
    if (best && second) {
      if (filters.usage === "data") {
        const d1 = Number(best.data_mb);
        const d2 = Number(second.data_mb);
        if (Number.isFinite(d1) && Number.isFinite(d2)) gainLine = formatGainDataMb(d1 - d2);
      } else if (filters.usage === "appels") {
        const m1 = Number(best.minutes);
        const m2 = Number(second.minutes);
        if (Number.isFinite(m1) && Number.isFinite(m2)) gainLine = formatGainMinutes(m1 - m2);
      } else {
        const d1 = Number(best.data_mb);
        const d2 = Number(second.data_mb);
        if (Number.isFinite(d1) && Number.isFinite(d2)) gainLine = formatGainDataMb(d1 - d2);
        else {
          const m1 = Number(best.minutes);
          const m2 = Number(second.minutes);
          if (Number.isFinite(m1) && Number.isFinite(m2)) gainLine = formatGainMinutes(m1 - m2);
        }
      }

      if (!gainLine) {
        const eco = computeEconomyFcfa(best, second, filters.usage);
        if (Number.isFinite(eco) && eco > 0) gainLine = `💰 Économise ${eco} FCFA vs l’offre publique suivante`;
      }
    }

    bestGain.textContent = gainLine || "";
    bestTip.textContent = "✅ Recommandation neutre";
    const bits = [];
    const d = mbToHuman(best.data_mb);
    const m = formatMinutes(best.minutes);
    if (d) bits.push(`📱 ${d}`);
    if (m) bits.push(`📞 ${m}`);
    bits.push(`⏱ ${validityLabel(best)}`);
    bestDesc.textContent = `${best.operator} — ${best.name} • ${bits.join(" • ")} • ${best.price_fcfa} FCFA`;
  } else if (bestBanner) {
    bestBanner.hidden = true;
  }

  // Count
  $("offersCount").textContent = `${filtered.length} offre(s)`;

  // List
  const grid = $("offersGrid");
  const empty = $("emptyState");
  const subtitle = $("resultsSubtitle");

  const finalList = [...sortedPub, ...sortedSpecial];
  subtitle.textContent = `${finalList.length} offre(s) ≤ ${filters.budget} FCFA`;

  if (!finalList.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const bestId = best?.offer_id || null;
  grid.innerHTML = finalList.map((o) => renderOfferCard(o, o.offer_id === bestId && o.eligibility_type === "public")).join("");
}

function renderPromos(offers) {
  const list = offers.filter((o) => o.is_promo && o.status !== "expired");
  const grid = $("promosGrid");
  grid.innerHTML = list.length
    ? list.map((o) => renderOfferCard(o, false)).join("")
    : `<div class="empty"><strong>Pas de promos pour l’instant.</strong><div class="muted">Ajoute-les via Admin.</div></div>`;
}

function setLastUpdatePill() {
  const meta = getMeta();
  const pill = $("lastUpdatePill");
  if (!pill) return;
  if (!meta.lastUpdateISO) {
    pill.textContent = "🕒 Dernière MAJ : —";
    return;
  }
  const d = new Date(meta.lastUpdateISO);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  pill.textContent = `🕒 Dernière MAJ : aujourd’hui ${hh}:${mm}`;
}

function isAdminLogged() {
  return localStorage.getItem(STORAGE_ADMIN) === "1";
}

function setAdminLogged(val) {
  if (val) localStorage.setItem(STORAGE_ADMIN, "1");
  else localStorage.removeItem(STORAGE_ADMIN);
}

function renderAdmin(offers) {
  const authMsg = $("adminAuthMsg");
  const authCard = $("adminAuthCard");
  const panel = $("adminPanel");

  if (isAdminLogged()) {
    authCard.hidden = true;
    panel.hidden = false;
    authMsg.textContent = "";
  } else {
    authCard.hidden = false;
    panel.hidden = true;
    authMsg.textContent = "Mot de passe requis.";
    return;
  }

  const table = $("adminOffers");
  const rows = offers
    .slice()
    .sort((a, b) => (a.operator || "").localeCompare(b.operator || "") || (a.price_fcfa || 0) - (b.price_fcfa || 0))
    .map((o) => {
      return `
        <div class="adminRow" data-id="${escapeHtml(o.offer_id)}">
          <div>
            <strong>${escapeHtml(o.operator)}</strong> — ${escapeHtml(o.name)}
            <div class="muted">${escapeHtml(String(o.price_fcfa))} FCFA • ${escapeHtml(validityLabel(o))} • ${
        o.eligibility_type !== "public" ? "Sous conditions" : "Public"
      }</div>
          </div>
          <button class="btn" data-admin="edit" type="button">Modifier</button>
          <button class="btn btn--danger" data-admin="del" type="button">Supprimer</button>
        </div>
      `;
    })
    .join("");

  table.innerHTML = rows || `<div class="empty"><strong>Aucune offre.</strong></div>`;
}

function fillAdminForm(offer) {
  $("a_id").value = offer.offer_id || "";
  $("a_operator").value = offer.operator || "Orange";
  $("a_name").value = offer.name || "";
  $("a_price").value = offer.price_fcfa ?? "";
  $("a_usage").value = offer.type_usage || "data";
  $("a_data").value = offer.data_mb ?? "";
  $("a_minutes").value = offer.minutes ?? "";
  $("a_validity").value = offer.validity_type || "inconnu";
  $("a_ussd").value = offer.ussd_code ?? "";
  $("a_eligibility").value = offer.eligibility_type || "public";
  $("a_promo").value = offer.is_promo ? "true" : "false";
  $("a_source").value = offer.source_type || "sms";
}

function readAdminForm() {
  const id = $("a_id").value.trim();
  const operator = $("a_operator").value;
  const name = $("a_name").value.trim();
  const price = toInt($("a_price").value, 0);
  const usage = $("a_usage").value;
  const data = toInt($("a_data").value, null);
  const mins = toInt($("a_minutes").value, null);
  const validity = $("a_validity").value;
  const ussd = $("a_ussd").value.trim();
  const eligibility = $("a_eligibility").value;
  const promo = $("a_promo").value === "true";
  const source = $("a_source").value;

  return normalizeOffer({
    offer_id: id || undefined,
    operator,
    name: name || "Offre",
    price_fcfa: price,
    type_usage: usage,
    data_mb: data,
    minutes: mins,
    validity_type: validity,
    validity_days: null,
    ussd_code: ussd || null,
    eligibility_type: eligibility,
    is_promo: promo,
    source_type: source,
    status: "active",
  });
}

function clearAdminForm() {
  fillAdminForm(normalizeOffer({ operator: "Orange", name: "", price_fcfa: 0, type_usage: "data" }));
  $("a_id").value = "";
  $("adminSaveMsg").textContent = "";
}

function exportJson(offers) {
  const payload = { exported_at: nowIso(), offers };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doylu_offers_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJson(file, offers) {
  const text = await file.text();
  const parsed = safeJsonParse(text, null);
  const arr = Array.isArray(parsed?.offers) ? parsed.offers : Array.isArray(parsed) ? parsed : null;
  if (!arr) throw new Error("Format JSON invalide");

  const merged = new Map(offers.map((o) => [o.offer_id, o]));
  for (const raw of arr) {
    const o = normalizeOffer(raw);
    if (!OPERATORS_SN.includes(o.operator)) continue;
    merged.set(o.offer_id, o);
  }
  return Array.from(merged.values());
}

function buildWhatsappShare(offer) {
  const url = location.href.split("#")[0] + "#/accueil";
  const bits = [];
  bits.push(`Doylu — ${offer.operator} ${offer.name}`);
  bits.push(`${offer.price_fcfa} FCFA`);
  const d = mbToHuman(offer.data_mb);
  const m = formatMinutes(offer.minutes);
  if (d) bits.push(d);
  if (m) bits.push(m);
  bits.push(validityLabel(offer));
  if (offer.ussd_code) bits.push(`Code: ${offer.ussd_code}`);
  bits.push(url);
  return `https://wa.me/?text=${encodeURIComponent(bits.join(" • "))}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  }
}

function tipForBest(best) {
  const days = Number(best.validity_days);
  if (Number.isFinite(days)) {
    if (days <= 1) return "Bon pour 24h intensif";
    if (days <= 7) return "Idéal pour la semaine";
    if (days >= 30) return "Bon plan mensuel";
  }
  const d = Number(best.data_mb);
  if (Number.isFinite(d)) {
    if (d <= 600) return "Bon pour WhatsApp / léger";
    if (d >= 5000) return "Bon pour gros usage";
  }
  return "Bon pour usage quotidien";
}

/* -------------------------
   App bootstrap + events
------------------------- */

const app = {
  offers: [],
  filters: { budget: 1000, usage: "data", operator: "all", validity: "all" },
};

function syncUIChips() {
  setChipActive("usageChips", (b) => b.dataset.usage === app.filters.usage);
  setChipActive("operatorChips", (b) => b.dataset.operator === app.filters.operator);
  setChipActive("validityChips", (b) => b.dataset.validity === app.filters.validity);
  setChipActive("quickBudgets", (b) => b.dataset.budget === String(app.filters.budget));
}

function render() {
  setLastUpdatePill();
  syncUIChips();

  const route = routeName();
  showRoute(route);

  if (route === "accueil") {
    renderHome(app.offers, app.filters);
  } else if (route === "promos") {
    renderPromos(app.offers);
  } else if (route === "admin") {
    renderAdmin(app.offers);
  }
}

function bindEvents() {
  // Burger
  $("burgerBtn").addEventListener("click", () => {
    const mobile = $("mobileNav");
    mobile.hidden = !mobile.hidden;
  });

  // Modal
  $("modalBackdrop").addEventListener("click", closeModal);
  $("modalCloseBtn").addEventListener("click", closeModal);
  $("modalOkBtn").addEventListener("click", closeModal);

  const howVerify = () => {
    openModal(
      "Comment on vérifie ?",
      `<ul class="list">
        <li>On collecte des offres reçues par SMS et/ou des infos visibles via USSD.</li>
        <li>On vérifie la cohérence (prix, volume, validité) et on retire les offres expirées.</li>
        <li>Le badge “Vérifié” apparaît quand l’offre est confirmée par des preuves récentes.</li>
      </ul>`
    );
  };
  $("howVerifyBtn").addEventListener("click", howVerify);
  $("howVerifyBtn2").addEventListener("click", howVerify);

  // Contact (V1 = toast + message local)
  $("sendContact1").addEventListener("click", () => {
    $("contactStatus1").textContent = "Merci ✅ (V1 : message enregistré côté navigateur)";
    toast("Message envoyé ✅");
  });
  $("sendContact2").addEventListener("click", () => {
    $("contactStatus2").textContent = "Merci ✅ (V1 : SMS enregistré côté navigateur)";
    toast("Promo envoyée ✅");
  });
  $("openPartnership").addEventListener("click", () => {
    $("contactStatus3").textContent = "Contacte via WhatsApp / Email (à configurer)";
    toast("OK ✅");
  });

  // Budget input + search
  $("searchBtn").addEventListener("click", () => {
    const v = toInt($("budgetInput").value, app.filters.budget);
    if (v !== null) app.filters.budget = Math.max(0, v);
    render();
    $("bestBanner").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("budgetInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("searchBtn").click();
  });

  // Event delegation for chips + offer cards + admin list
  document.addEventListener("click", async (e) => {
    const t = e.target;

    // Quick budget chips
    const bChip = t.closest("[data-budget]");
    if (bChip && bChip.closest("#quickBudgets")) {
      const v = toInt(bChip.dataset.budget, null);
      if (v !== null) {
        app.filters.budget = v;
        $("budgetInput").value = String(v);
        render();
        $("bestBanner").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    // Usage chip
    const uChip = t.closest("[data-usage]");
    if (uChip && uChip.closest("#usageChips")) {
      app.filters.usage = uChip.dataset.usage;
      render();
      return;
    }

    // Operator chip
    const oChip = t.closest("[data-operator]");
    if (oChip && oChip.closest("#operatorChips")) {
      app.filters.operator = oChip.dataset.operator;
      render();
      return;
    }

    // Validity chip
    const vChip = t.closest("[data-validity]");
    if (vChip && vChip.closest("#validityChips")) {
      app.filters.validity = vChip.dataset.validity;
      render();
      return;
    }

    // Offer card buttons
    const actionBtn = t.closest("[data-action]");
    if (actionBtn) {
      const card = actionBtn.closest(".offerCard");
      const id = card?.dataset.id;
      const offer = app.offers.find((x) => x.offer_id === id);
      if (!offer) return;

      const action = actionBtn.dataset.action;
      const reveal = card.querySelector('[data-role="reveal"]');

      if (action === "reveal") {
        if (reveal) {
          reveal.hidden = false;
          toast("Code affiché ✅");
        }
        return;
      }

      if (action === "copy") {
        if (!offer.ussd_code) return;
        await copyText(String(offer.ussd_code));
        toast("Code copié ✅");
        return;
      }

      if (action === "share") {
        window.open(buildWhatsappShare(offer), "_blank");
        return;
      }
    }

    // Admin table actions
    const adminBtn = t.closest("[data-admin]");
    if (adminBtn) {
      const row = adminBtn.closest(".adminRow");
      const id = row?.dataset.id;
      const offer = app.offers.find((x) => x.offer_id === id);
      if (!offer) return;

      if (adminBtn.dataset.admin === "edit") {
        fillAdminForm(offer);
        toast("Mode édition ✅");
        return;
      }
      if (adminBtn.dataset.admin === "del") {
        if (!confirm("Supprimer cette offre ?")) return;
        app.offers = app.offers.filter((x) => x.offer_id !== id);
        app.offers = saveOffers(app.offers);
        toast("Supprimée ✅");
        render();
      }
    }
  });

  // Admin login / actions
  $("adminLoginBtn").addEventListener("click", () => {
    const pwd = $("adminPass").value;
    if (pwd === ADMIN_PASSWORD) {
      setAdminLogged(true);
      $("adminAuthMsg").textContent = "Connecté ✅";
      toast("Admin connecté ✅");
      render();
      return;
    }
    $("adminAuthMsg").textContent = "Mot de passe incorrect.";
    toast("Mot de passe incorrect");
  });

  $("saveOfferBtn").addEventListener("click", () => {
    if (!isAdminLogged()) return toast("Non autorisé");
    const o = readAdminForm();

    // upsert
    const idx = app.offers.findIndex((x) => x.offer_id === o.offer_id);
    if (idx >= 0) app.offers[idx] = o;
    else app.offers.push(o);

    app.offers = saveOffers(app.offers);
    $("adminSaveMsg").textContent = "Enregistré ✅";
    toast("Enregistré ✅");
    render();
  });

  $("clearFormBtn").addEventListener("click", () => {
    clearAdminForm();
    toast("Form vidé");
  });

  $("exportJsonBtn").addEventListener("click", () => {
    if (!isAdminLogged()) return toast("Non autorisé");
    exportJson(app.offers);
  });

  $("importJsonInput").addEventListener("change", async (e) => {
    if (!isAdminLogged()) return toast("Non autorisé");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const merged = await importJson(file, app.offers);
      app.offers = saveOffers(merged);
      toast("Import OK ✅");
      render();
    } catch {
      toast("Import échoué");
    } finally {
      e.target.value = "";
    }
  });

  $("resetDataBtn").addEventListener("click", () => {
    if (!isAdminLogged()) return toast("Non autorisé");
    if (!confirm("Reset démo ?")) return;
    app.offers = saveOffers(seedOffers());
    toast("Reset OK ✅");
    render();
  });

  // Routing
  window.addEventListener("hashchange", render);
}

function boot() {
  app.offers = loadOffers();

  // Defaults UI
  $("budgetInput").value = String(app.filters.budget);

  // Ensure meta
  const meta = getMeta();
  if (!meta.lastUpdateISO) setMeta({ lastUpdateISO: nowIso() });

  // Admin panel prep
  clearAdminForm();

  bindEvents();
  render();

  // Optional: show tip in banner
  const bestDesc = $("bestDesc");
  if (bestDesc) {
    // nothing
  }
}

document.addEventListener("DOMContentLoaded", boot);
