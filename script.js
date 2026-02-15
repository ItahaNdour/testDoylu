/* script.js — Doylu V1 stable (routes séparées, filtres, budget proche, top+gain dynamiques, admin JSON) */
(() => {
  "use strict";

  /**
   * =====================================================
   * 0) CONFIG
   * =====================================================
   */
  const CONFIG = {
    operators: ["Orange", "Free", "Expresso"],
    validityMap: { "Toutes": null, "24h": 1, "7 jours": 7, "30 jours": 30 },
    // Budget rules: exact => [0.8X..X] => [0.7X..X]
    budgetBands: [
      { label: "exact", low: 1.0, high: 1.0 },
      { label: "80", low: 0.8, high: 1.0 },
      { label: "70", low: 0.7, high: 1.0 },
    ],
    // V1 admin pass (change it)
    adminPassword: "doylu2026",
    // WhatsApp (change it to your channel / number)
    whatsappLink: "https://wa.me/?text=",
  };

  /**
   * =====================================================
   * 1) HELPERS
   * =====================================================
   */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safe = (v) => (v == null ? "" : String(v));
  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const clampInt = (v, fallback = 0) => {
    const n = Number.parseInt(String(v || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const formatFcfa = (n) => `${Number(n).toLocaleString("fr-FR")} FCFA`;

  const mbToGo = (mb) => mb / 1024;
  const roundTo = (value, step) => Math.round(value / step) * step;

  const formatGainData = (gainMb) => {
    if (!Number.isFinite(gainMb) || gainMb <= 0) return null;
    if (gainMb < 1024) {
      const rounded = roundTo(gainMb, 50);
      return `+${Math.max(50, rounded)} Mo`;
    }
    const gainGo = mbToGo(gainMb);
    const roundedGo = roundTo(gainGo, 0.5);
    const str = roundedGo % 1 === 0 ? String(roundedGo.toFixed(0)) : String(roundedGo.toFixed(1));
    return `+${str} Go`;
  };

  const formatGainMinutes = (gainMin) => {
    if (!Number.isFinite(gainMin) || gainMin <= 0) return null;
    return `+${Math.round(gainMin)} min`;
  };

  const toast = (msg) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1500);
  };

  const openModal = (title, bodyHtml) => {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;
    $("#modal").classList.remove("hidden");
  };
  const closeModal = () => $("#modal").classList.add("hidden");

  /**
   * =====================================================
   * 2) OFFERS STORAGE (localStorage for GitHub Pages)
   * =====================================================
   */
  const STORAGE_KEY = "doylu_offers_v1";

  const normalizeOffer = (o) => {
    const operator = safe(o.operator).trim();
    return {
      offer_id: safe(o.offer_id || o.id || crypto.randomUUID()),
      operator,
      name: safe(o.name || o.nom_offre || "Offre").trim(),
      price_fcfa: Number(o.price_fcfa ?? o.price ?? 0),
      type_usage: ["data", "appels", "mixte"].includes(String(o.type_usage).toLowerCase())
        ? String(o.type_usage).toLowerCase()
        : "data",
      data_mb: o.data_mb == null || o.data_mb === "" ? null : Number(o.data_mb),
      minutes: o.minutes == null || o.minutes === "" ? null : Number(o.minutes),
      validity_days: o.validity_days == null || o.validity_days === "" ? null : Number(o.validity_days),
      ussd_code: safe(o.ussd_code || "").trim(),
      eligibility_type: ["public", "student", "corporate", "special"].includes(String(o.eligibility_type || "public").toLowerCase())
        ? String(o.eligibility_type || "public").toLowerCase()
        : "public",
      est_promo: Boolean(o.est_promo ?? o.is_promo ?? false),
      source_badge: safe(o.source_badge || "Source SMS").trim(),
      status: safe(o.status || "active").toLowerCase(),
    };
  };

  const defaultOffers = () => {
    // Orange (extraits de tes captures + quelques compléments)
    return [
      // Public
      { operator: "Orange", name: "Pass USSD 3,5Go (24h)", price_fcfa: 700, type_usage: "data", data_mb: 3.5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass Jour 300Mo", price_fcfa: 200, type_usage: "data", data_mb: 300, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass Jour 1,5Go", price_fcfa: 500, type_usage: "data", data_mb: 1536, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass Jour 5Go", price_fcfa: 1000, type_usage: "data", data_mb: 5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass Nuit 5Go (23h-6h)", price_fcfa: 500, type_usage: "data", data_mb: 5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },

      // Semaine
      { operator: "Orange", name: "Pass semaine 600Mo", price_fcfa: 500, type_usage: "data", data_mb: 600, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass semaine 2Go", price_fcfa: 1000, type_usage: "data", data_mb: 2 * 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass semaine 10Go", price_fcfa: 2500, type_usage: "data", data_mb: 10 * 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },

      // Mois
      { operator: "Orange", name: "Pass 5Go (30 jours) Exclusif OM", price_fcfa: 2000, type_usage: "data", data_mb: 5 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Promo 10Go (30 jours) exclusif OM", price_fcfa: 2000, type_usage: "data", data_mb: 10 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active", est_promo: true },
      { operator: "Orange", name: "Pass Mois 12Go", price_fcfa: 3000, type_usage: "data", data_mb: 12 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
      { operator: "Orange", name: "Pass Mois 25Go", price_fcfa: 5000, type_usage: "data", data_mb: 25 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },

      // Sous conditions (ex: éducation / student)
      { operator: "Orange", name: "Pass Éducation 1Go", price_fcfa: 100, type_usage: "data", data_mb: 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "student", source_badge: "Source SMS", status: "active" },
    ].map(normalizeOffer);
  };

  const loadOffers = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultOffers();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return defaultOffers();
      return arr.map(normalizeOffer);
    } catch {
      return defaultOffers();
    }
  };

  const saveOffers = (arr) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    $("#lastUpdate").textContent = `Dernière MAJ : aujourd'hui ${nowHHMM()}`;
  };

  let OFFERS = loadOffers();

  /**
   * =====================================================
   * 3) STATE
   * =====================================================
   */
  const state = {
    route: "accueil",
    budgetX: 1000,
    usage: "data",      // data | appels | mixte
    operator: "Tous",   // Tous | Orange | Free | Expresso
    validity: "Toutes", // Toutes | 24h | 7 jours | 30 jours
    promoOperator: "Tous",
    isAdmin: false,
    editingId: null,
  };

  /**
   * =====================================================
   * 4) FILTER PIPELINE (ORDER OBLIGATOIRE)
   * =====================================================
   */
  const isActive = (o) => safe(o.status).toLowerCase() === "active";
  const isOperatorAllowed = (o) => CONFIG.operators.includes(o.operator);

  const offerHasUsage = (o, usage) => {
    if (!usage) return true;
    if (o.type_usage === usage) return true;
    // V1: mixte match data/appels too
    if (o.type_usage === "mixte" && (usage === "data" || usage === "appels")) return true;
    return false;
  };

  const offerMatchesValidity = (o, validityLabel) => {
    const maxDays = CONFIG.validityMap[validityLabel] ?? null;
    if (!maxDays) return true;
    if (!Number.isFinite(o.validity_days)) return false;
    return o.validity_days <= maxDays;
  };

  const filterByBudgetBand = (list, x) => {
    // Step 1: exact
    const exact = list.filter((o) => o.price_fcfa === x);
    if (exact.length) return exact;

    // Step 2/3 bands
    for (const band of CONFIG.budgetBands.slice(1)) {
      const low = Math.ceil(band.low * x);
      const high = Math.floor(band.high * x);
      const found = list.filter((o) => o.price_fcfa >= low && o.price_fcfa <= high);
      if (found.length) return found;
    }
    return [];
  };

  const computeScore = (o, usage) => {
    if (!Number.isFinite(o.price_fcfa) || o.price_fcfa <= 0) return -Infinity;

    if (usage === "appels") {
      if (!Number.isFinite(o.minutes)) return -Infinity;
      return o.minutes / o.price_fcfa;
    }

    if (usage === "mixte") {
      if (Number.isFinite(o.data_mb)) return o.data_mb / o.price_fcfa;
      if (Number.isFinite(o.minutes)) return o.minutes / o.price_fcfa;
      return -Infinity;
    }

    // data
    if (!Number.isFinite(o.data_mb)) return -Infinity;
    return o.data_mb / o.price_fcfa;
  };

  const computeGain = (top1, top2, usage) => {
    if (!top1 || !top2) return null;

    if (usage === "appels") {
      if (!Number.isFinite(top1.minutes) || !Number.isFinite(top2.minutes)) return null;
      const label = formatGainMinutes(top1.minutes - top2.minutes);
      if (!label) return null;
      return { label, sub: "par rapport à la 2e meilleure offre publique" };
    }

    if (usage === "mixte") {
      if (Number.isFinite(top1.data_mb) && Number.isFinite(top2.data_mb)) {
        const label = formatGainData(top1.data_mb - top2.data_mb);
        if (!label) return null;
        return { label, sub: "par rapport à la 2e meilleure offre publique" };
      }
      if (Number.isFinite(top1.minutes) && Number.isFinite(top2.minutes)) {
        const label = formatGainMinutes(top1.minutes - top2.minutes);
        if (!label) return null;
        return { label, sub: "par rapport à la 2e meilleure offre publique" };
      }
      return null;
    }

    // data
    if (!Number.isFinite(top1.data_mb) || !Number.isFinite(top2.data_mb)) return null;
    const label = formatGainData(top1.data_mb - top2.data_mb);
    if (!label) return null;
    return { label, sub: "par rapport à la 2e meilleure offre publique" };
  };

  const computeRecommendation = (o, usage) => {
    if (!o) return "Recommandation neutre";
    const days = Number.isFinite(o.validity_days) ? o.validity_days : null;
    const dataMb = Number.isFinite(o.data_mb) ? o.data_mb : null;
    const mins = Number.isFinite(o.minutes) ? o.minutes : null;

    if (days === 1) return "Idéal pour 24h";
    if (days && days <= 7) return "Bon pour usage quotidien";
    if (usage === "data" && dataMb && dataMb >= 10 * 1024) return "Meilleur pour gros volume data";
    if (usage === "mixte" && dataMb && mins) return "Bon équilibre data + appels";
    if (days && days >= 30) return "Bon pour le mois";
    return "Recommandation neutre";
  };

  const pipeline = () => {
    const x = state.budgetX;

    let list = OFFERS.slice()
      .map(normalizeOffer)
      .filter(isActive)
      .filter(isOperatorAllowed);

    // 1) Budget band first
    list = filterByBudgetBand(list, x);

    if (!list.length) return { list: [], publicOffers: [], specialOffers: [], scoredPublic: [], top1: null, top2: null, gain: null };

    // 2) Operator
    if (state.operator !== "Tous") list = list.filter((o) => o.operator === state.operator);

    // 3) Usage
    list = list.filter((o) => offerHasUsage(o, state.usage));

    // 4) Validity
    list = list.filter((o) => offerMatchesValidity(o, state.validity));

    const publicOffers = list.filter((o) => o.eligibility_type === "public");
    const specialOffers = list.filter((o) => o.eligibility_type !== "public");

    const scoredPublic = publicOffers
      .map((o) => ({ o, score: computeScore(o, state.usage) }))
      .filter((x) => Number.isFinite(x.score) && x.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o);

    const top1 = scoredPublic[0] || null;
    const top2 = scoredPublic[1] || null;
    const gain = top1 && top2 ? computeGain(top1, top2, state.usage) : null;

    return { list, publicOffers, specialOffers, scoredPublic, top1, top2, gain };
  };

  /**
   * =====================================================
   * 5) RENDER
   * =====================================================
   */
  const renderOfferCard = (o, { isTop = false } = {}) => {
    const isDataMode = state.usage !== "appels";
    const dataLine = Number
