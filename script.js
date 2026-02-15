// /script.js
"use strict";

/**
 * Doylu V1 (client-only)
 * - Hash router (#/accueil, #/promos, #/guide, #/contact, #/admin)
 * - Offers store in localStorage (persist + admin sync)
 * - Best offer + gain computed only on PUBLIC offers
 */

const STORAGE_KEY = "doylu_offers_v1";
const META_KEY = "doylu_meta_v1";
const ADMIN_SESSION_KEY = "doylu_admin_session_v1";

// Change if you want (simple V1)
const ADMIN_PASSWORD = "doylu123";

const OPERATORS_SN = ["Orange", "Free", "Expresso"];

const DEFAULT_META = {
  lastUpdateISO: null,
  waLink: "https://wa.me/?text=" + encodeURIComponent("Doylu — Compare ton pass ici : ") // user can paste site url
};

const seedOffers = () => {
  const now = new Date().toISOString();

  // OFFRES ORANGE (extraits de tes captures)
  // NOTE: ussd_code est souvent un "catalogue" (#1234#) car le choix est dans le menu USSD.
  // On reste comparateur: on affiche et on prépare le "chemin d'activation" plus tard.
  return [
    {
      offer_id: "orange_jour_300mb_200",
      country: "SN",
      operator: "Orange",
      name: "Pass Jour 300Mo",
      price_fcfa: 200,
      type_usage: "data",
      data_mb: 300,
      minutes: null,
      sms: null,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Jour > 300Mo",
      status: "active",
      confidence_score: 85,
      is_verified: true,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "public"
    },
    {
      offer_id: "orange_jour_15go_500",
      country: "SN",
      operator: "Orange",
      name: "Pass Jour 1,5Go",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 1536,
      minutes: null,
      sms: null,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Jour > 1,5Go",
      status: "active",
      confidence_score: 80,
      is_verified: true,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "public"
    },
    {
      offer_id: "orange_jour_5go_1000",
      country: "SN",
      operator: "Orange",
      name: "Pass Jour 5Go",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 5120,
      minutes: null,
      sms: null,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Jour > 5Go",
      status: "active",
      confidence_score: 80,
      is_verified: true,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "public"
    },
    {
      offer_id: "orange_nuit_5go_500",
      country: "SN",
      operator: "Orange",
      name: "Pass Nuit 5Go",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 5120,
      minutes: null,
      sms: null,
      validity_type: "24h",
      validity_days: 1,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Nuit > 5Go (23h–6h)",
      status: "active",
      confidence_score: 75,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "sms",
      eligibility_type: "public"
    },
    {
      offer_id: "orange_semaine_600mb_500",
      country: "SN",
      operator: "Orange",
      name: "Pass Semaine 600Mo",
      price_fcfa: 500,
      type_usage: "data",
      data_mb: 600,
      minutes: null,
      sms: null,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Semaine > 600Mo",
      status: "active",
      confidence_score: 70,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "public"
    },
    {
      offer_id: "orange_semaine_2go_1000",
      country: "SN",
      operator: "Orange",
      name: "Pass Semaine 2Go",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 2048,
      minutes: null,
      sms: null,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Semaine > 2Go",
      status: "active",
      confidence_score: 70,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "public"
    },
    {
      offer_id: "orange_semaine_10go_2500",
      country: "SN",
      operator: "Orange",
      name: "Pass Semaine 10Go",
      price_fcfa: 2500,
      type_usage: "data",
      data_mb: 10240,
      minutes: null,
      sms: null,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Semaine > 10Go",
      status: "active",
      confidence_score: 75,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "public"
    },

    // Offre "sous condition" (ex: éducation/étudiant) => visible mais jamais #1
    {
      offer_id: "orange_education_1go_100",
      country: "SN",
      operator: "Orange",
      name: "Pass Éducation 1Go",
      price_fcfa: 100,
      type_usage: "data",
      data_mb: 1024,
      minutes: null,
      sms: null,
      validity_type: "7j",
      validity_days: 7,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Semaine > Education",
      status: "active",
      confidence_score: 60,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "official",
      eligibility_type: "student"
    },

    // Promo exemple (mois)
    {
      offer_id: "orange_mois_10go_promo_2000",
      country: "SN",
      operator: "Orange",
      name: "Pass Mois 10Go (Promo)",
      price_fcfa: 2000,
      type_usage: "data",
      data_mb: 10240,
      minutes: null,
      sms: null,
      validity_type: "30j",
      validity_days: 30,
      ussd_code: "#1234#",
      activation_path: "Catalogue > Mois > 10Go promo",
      status: "active",
      confidence_score: 75,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: true,
      source_type: "sms",
      eligibility_type: "public"
    },

    // Placeholders Free/Expresso (neutres)
    {
      offer_id: "free_placeholder_1000",
      country: "SN",
      operator: "Free",
      name: "Offre Free (placeholder)",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 0,
      minutes: null,
      sms: null,
      validity_type: "inconnu",
      validity_days: null,
      ussd_code: null,
      activation_path: null,
      status: "a_confirmer",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "user_submit",
      eligibility_type: "public"
    },
    {
      offer_id: "expresso_placeholder_1000",
      country: "SN",
      operator: "Expresso",
      name: "Offre Expresso (placeholder)",
      price_fcfa: 1000,
      type_usage: "data",
      data_mb: 0,
      minutes: null,
      sms: null,
      validity_type: "inconnu",
      validity_days: null,
      ussd_code: null,
      activation_path: null,
      status: "a_confirmer",
      confidence_score: 0,
      is_verified: false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      is_promo: false,
      source_type: "user_submit",
      eligibility_type: "public"
    }
  ];
};

function safeParseJSON(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function getMeta() {
  const raw = localStorage.getItem(META_KEY);
  const meta = safeParseJSON(raw, DEFAULT_META);
  return { ...DEFAULT_META, ...meta };
}

function setMeta(patch) {
  const meta = { ...getMeta(), ...patch };
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  return meta;
}

function loadOffers() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = safeParseJSON(raw, null);
  if (Array.isArray(data) && data.length) return sanitizeOffers(data);

  const seeded = sanitizeOffers(seedOffers());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));

  const meta = getMeta();
  if (!meta.lastUpdateISO) setMeta({ lastUpdateISO: new Date().toISOString() });
  return seeded;
}

function saveOffers(offers) {
  const clean = sanitizeOffers(offers);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  setMeta({ lastUpdateISO: new Date().toISOString() });
  return clean;
}

function sanitizeOffers(offers) {
  return offers
    .filter((o) => o && typeof o === "object")
    .map((o) => ({
      offer_id: String(o.offer_id || "").trim() || `offer_${Math.random().toString(16).slice(2)}`,
      country: o.country || "SN",
      operator: OPERATORS_SN.includes(o.operator) ? o.operator : "Orange",
      name: String(o.name || "").trim() || "Offre",
      price_fcfa: toInt(o.price_fcfa),
      type_usage: ["data", "appels", "mixte"].includes(o.type_usage) ? o.type_usage : "data",
      data_mb: isFiniteNumber(o.data_mb) ? toInt(o.data_mb) : null,
      minutes: isFiniteNumber(o.minutes) ? toInt(o.minutes) : null,
      sms: isFiniteNumber(o.sms) ? toInt(o.sms) : null,
      validity_type: ["24h", "7j", "30j", "inconnu"].includes(o.validity_type) ? o.validity_type : "inconnu",
      validity_days: isFiniteNumber(o.validity_days) ? toInt(o.validity_days) : null,
      ussd_code: o.ussd_code ? String(o.ussd_code) : null,
      activation_path: o.activation_path ? String(o.activation_path) : null,
      status: ["active", "a_confirmer", "expired"].includes(o.status) ? o.status : "active",
      confidence_score: isFiniteNumber(o.confidence_score) ? toInt(o.confidence_score) : 0,
      is_verified: Boolean(o.is_verified),
      last_seen_at: o.last_seen_at || new Date().toISOString(),
      created_at: o.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_promo: Boolean(o.is_promo),
      source_type: ["sms", "official", "website", "user_submit"].includes(o.source_type) ? o.source_type : "user_submit",
      eligibility_type: ["public", "student", "corporate", "special"].includes(o.eligibility_type)
        ? o.eligibility_type
        : "public"
    }))
    .filter((o) => o.price_fcfa >= 0);
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function isFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n);
}

const state = {
  offers: loadOffers(),
  budget: 1000,
  usage: "data",
  operator: "all",
  validity: "all"
};

function qs(id) {
  return document.getElementById(id);
}

function showToast(text) {
  const el = qs("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (el.hidden = true), 1600);
}

function openModal(title, html) {
  qs("modalTitle").textContent = title;
  qs("modalBody").innerHTML = html;
  qs("modal").hidden = false;
}
function closeModal() {
  qs("modal").hidden = true;
}

function setActiveChip(container, predicate) {
  container.querySelectorAll(".chip").forEach((b) => {
    const active = predicate(b);
    b.classList.toggle("chip--active", active);
  });
}

function setActiveNav(route) {
  document.querySelectorAll(".nav__link").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.nav === route);
  });
}

function route() {
  const hash = location.hash || "#/accueil";
  const path = hash.replace("#/", "").split("?")[0];

  const pages = ["accueil", "promos", "guide", "contact", "admin"];
  for (const p of pages) {
    qs(`page-${p}`).hidden = p !== path;
  }
  if (pages.includes(path)) setActiveNav(path);

  // close mobile nav
