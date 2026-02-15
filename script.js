/* /script.js
   Doylu V1 — comparateur offline-first (HTML/CSS/JS only)

   Ce script gère :
   - Navigation par onglets (hash routing)
   - Filtrage (budget, usage, validité, opérateur)
   - Classement (score simple + séparation Public vs Sous conditions)
   - Bandeau "Meilleure valeur" + gain dynamique (Go/Mo ou minutes) + économie FCFA (si cohérente)
   - Cartes offres (Afficher code -> Copier, Partager WhatsApp)
   - Admin (via #admin) : ajouter/modifier/supprimer, import/export JSON
   - Persistance locale (localStorage avec fallback si sandbox)
*/
(() => {
  "use strict";

  /* -----------------------------
   * Safe storage (sandbox-friendly)
   * ----------------------------- */
  const STORAGE_KEY = "doylu_v1_state";
  const safeStorage = {
    get() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };

  /* -----------------------------
   * Constants / helpers
   * ----------------------------- */
  const OPERATORS_SN = ["Orange", "Free", "Expresso"];
  const USAGE_TYPES = ["data", "mixte", "appels"];
  const VALIDITY_FILTERS = ["toutes", "24h", "7j", "30j"];

  const nowIso = () => new Date().toISOString();

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const clampInt = (n, min, max) => {
    const v = Number.parseInt(String(n), 10);
    if (!Number.isFinite(v)) return null;
    return Math.min(Math.max(v, min), max);
  };

  const fmtFcfa = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
  };

  const fmtData = (mb) => {
    const v = Number(mb);
    if (!Number.isFinite(v) || v <= 0) return "—";
    if (v >= 1024) {
      const go = v / 1024;
      const rounded = Math.round(go * 10) / 10;
      return `${rounded} Go`;
    }
    const rounded = Math.round(v / 50) * 50;
    return `${rounded} Mo`;
  };

  const fmtMinutes = (min) => {
    const v = Number(min);
    if (!Number.isFinite(v) || v <= 0) return "—";
    return `${v} min`;
  };

  const normalizeValidityDays = (offer) => {
    // Priorité: validity_days sinon validity_type
    if (Number.isFinite(offer.validity_days)) return offer.validity_days;
    switch (offer.validity_type) {
      case "24h":
        return 1;
      case "7j":
        return 7;
      case "30j":
        return 30;
      case "mois":
        return 30;
      case "illimite":
        return 365;
      default:
        return null;
    }
  };

  const validityLabel = (offer) => {
    if (offer.validity_type && offer.validity_type !== "inconnu") {
      if (offer.validity_type === "7j") return "7 jours";
      if (offer.validity_type === "30j") return "30 jours";
      return offer.validity_type;
    }
    const d = normalizeValidityDays(offer);
    if (!Number.isFinite(d)) return "Inconnu";
    if (d === 1) return "24h";
    return `${d} jours`;
  };

  const offerBadge = (offer) => {
    // 1 badge max (V1)
    if (offer.is_verified) return { text: "Vérifié", kind: "verified" };
    if (offer.eligibility_type && offer.eligibility_type !== "public")
      return { text: "Sous conditions", kind: "special" };
    if (offer.source_type === "sms") return { text: "Source SMS", kind: "sms" };
    if (offer.source_type === "official") return { text: "Source officielle", kind: "official" };
    return null;
  };

  const computeValueDataPerFcfa = (offer) => {
    const mb = Number(offer.data_mb);
    const price = Number(offer.price_fcfa);
    if (!Number.isFinite(mb) || !Number.isFinite(price) || price <= 0) return 0;
    return mb / price; // MB per FCFA
  };

  const computeValueMinPerFcfa = (offer) => {
    const min = Number(offer.minutes);
    const price = Number(offer.price_fcfa);
    if (!Number.isFinite(min) || !Number.isFinite(price) || price <= 0) return 0;
    return min / price; // min per FCFA
  };

  const computeScore = (offer, usage) => {
    // V1 simple, modifiable plus tard via config.
    // Tri principal = valeur réelle + bonus validité + bonus vérifié
    const vd = computeValueDataPerFcfa(offer);
    const vm = computeValueMinPerFcfa(offer);
    const days = normalizeValidityDays(offer);
    const bonusValidity = Number.isFinite(days) ? Math.min(days, 30) / 30 : 0; // 0..1
    const bonusVerified = offer.is_verified ? 0.5 : 0;

    let wData = 0.6;
    let wMin = 0.4;
    if (usage === "data") {
      wData = 0.85;
      wMin = 0.15;
    } else if (usage === "appels") {
      wData = 0.15;
      wMin = 0.85;
    }

    // Score scale: value terms can be small, we rescale
    const score = vd * wData * 1000 + vm * wMin * 100 + bonusValidity + bonusVerified;
    return Number.isFinite(score) ? score : 0;
  };

  const isActiveOffer = (offer) => {
    if (!offer) return false;
    if (offer.status && offer.status !== "active") return false;
    if (offer.actif === false) return false;
    if (offer.date_expiration) {
      const exp = new Date(offer.date_expiration).getTime();
      if (Number.isFinite(exp) && exp < Date.now()) return false;
    }
    return true;
  };

  const matchesUsage = (offer, usage) => {
    if (!usage || usage === "tous") return true;
    if (!offer.type_usage) return false;
    if (offer.type_usage === usage) return true;
    // tolérance : une offre "mixte" peut matcher data/appels si besoin
    if (offer.type_usage === "mixte" && (usage === "data" || usage === "appels")) return true;
    return false;
  };

  const matchesValidityFilter = (offer, validityFilter) => {
    if (!validityFilter || validityFilter === "toutes") return true;
    // compare sur validity_type en priorité
    if (offer.validity_type) {
      if (validityFilter === "24h" && offer.validity_type === "24h") return true;
      if (validityFilter === "7j" && offer.validity_type === "7j") return true;
      if (validityFilter === "30j" && (offer.validity_type === "30j" || offer.validity_type === "mois"))
        return true;
      // si inconnu, on laisse tomber
      return false;
    }
    const d = normalizeValidityDays(offer);
    if (!Number.isFinite(d)) return false;
    if (validityFilter === "24h") return d <= 1;
    if (validityFilter === "7j") return d <= 7;
    if (validityFilter === "30j") return d <= 30;
    return true;
  };

  const matchesOperator = (offer, operator) => {
    if (!operator || operator === "Tous") return true;
    return offer.operator === operator;
  };

  const filterOffers = (offers, filters) => {
    const budget = Number(filters.budget_fcfa);
    const operator = filters.operator;
    const usage = filters.usage;
    const validity = filters.validity;

    return offers
      .filter(isActiveOffer)
      .filter((o) => Number.isFinite(Number(o.price_fcfa)) && Number(o.price_fcfa) <= budget)
      .filter((o) => matchesOperator(o, operator))
      .filter((o) => matchesUsage(o, usage))
      .filter((o) => matchesValidityFilter(o, validity));
  };

  /* -----------------------------
   * Gain logic (dynamic)
   * ----------------------------- */
  const roundToNearest = (value, step) => Math.round(value / step) * step;

  const formatGainDataMb = (gainMb) => {
    if (!Number.isFinite(gainMb) || gainMb <= 0) return null;
    if (gainMb < 1024) {
      const rounded = roundToNearest(gainMb, 50);
      return `+${rounded} Mo de plus que l’offre publique suivante`;
    }
    const go = gainMb / 1024;
    const roundedGo = roundToNearest(go, 0.5);
    const display = roundedGo.toFixed(roundedGo % 1 === 0 ? 0 : 1);
    return `+${display} Go de plus que l’offre publique suivante`;
  };

  const formatGainMinutes = (gainMin) => {
    if (!Number.isFinite(gainMin) || gainMin <= 0) return null;
    const rounded = roundToNearest(gainMin, 5);
    return `+${rounded} min de plus que l’offre publique suivante`;
  };

  const formatGainFcfa = (economyFcfa) => {
    if (!Number.isFinite(economyFcfa) || economyFcfa <= 0) return null;
    return `💰 Économise ${economyFcfa} FCFA vs l’offre publique suivante`;
  };

  const computeEconomyFcfa = (best, second, usage) => {
    if (!best || !second) return null;
    const p1 = Number(best.price_fcfa);
    const p2 = Number(second.price_fcfa);
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) return null;
    if (p1 >= p2) return null;

    // économie honnête: seulement si #1 >= #2 sur métrique principale
    if (usage === "data") {
      if (!Number.isFinite(best.data_mb) || !Number.isFinite(second.data_mb)) return null;
      if (best.data_mb < second.data_mb) return null;
      return p2 - p1;
    }
    if (usage === "appels") {
      if (!Number.isFinite(best.minutes) || !Number.isFinite(second.minutes)) return null;
      if (best.minutes < second.minutes) return null;
      return p2 - p1;
    }
    // mixte: privilégie data puis minutes
    if (Number.isFinite(best.data_mb) && Number.isFinite(second.data_mb)) {
      if (best.data_mb < second.data_mb) return null;
      return p2 - p1;
    }
    if (Number.isFinite(best.minutes) && Number.isFinite(second.minutes)) {
      if (best.minutes < second.minutes) return null;
      return p2 - p1;
    }
    return null;
  };

  const bestHint = (offer, usage) => {
    const days = normalizeValidityDays(offer);
    if (usage === "data") {
      if (Number.isFinite(days) && days <= 1) return "✅ Bon pour 24h intensif";
      if (Number.isFinite(days) && days <= 7) return "✅ Idéal pour la semaine";
      if (Number.isFinite(days) && days >= 30) return "✅ Bon plan mensuel";
      return "✅ Idéal pour usage quotidien";
    }
    if (usage === "appels") {
      if (Number.isFinite(days) && days <= 1) return "✅ Pratique pour aujourd’hui";
      if (Number.isFinite(days) && days <= 7) return "✅ Bon pour la semaine";
      return "✅ Appels au meilleur prix";
    }
    // mixte
    if (Number.isFinite(days) && days <= 1) return "✅ Mixte 24h";
    if (Number.isFinite(days) && days <= 7) return "✅ Mixte semaine";
    return "✅ Mixte équilibré";
  };

  /* -----------------------------
   * Default offers (Orange)
   * ----------------------------- */
  const makeId = () => crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  const DEFAULT_OFFERS = [
    // Orange - USSD menu: #1234# (offline)
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Jour > 300Mo",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "official",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Jour > 1,5Go",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "official",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Jour > 5Go",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "official",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Nuit > 5Go",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "sms",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Semaine > 600Mo",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "official",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Semaine > 2Go",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "official",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      offer_id: makeId(),
      country: "SN",
      operator: "Orange",
      name: "Pass Mois 10Go Promo",
      price_fcfa: 2000,
      type_usage: "data",
      data_mb: 10240,
      minutes: null,
      sms: null,
      validity_type: "30j",
      validity_days: 30,
      ussd_code: "#1234#",
      activation_path: "#1234# > Internet > Mois > 10Go",
      status: "active",
      eligibility_type: "public",
      is_verified: false,
      source_type: "sms",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    // Offre spéciale (ex: éducation / étudiants) — visible mais jamais #1 par défaut
    {
      offer_id: makeId(),
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
      activation_path: "#1234# > Internet > Semaine > Éducation 1Go",
      status: "active",
      eligibility_type: "student",
      is_verified: false,
      source_type: "official",
      last_seen_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  /* -----------------------------
   * App state
   * ----------------------------- */
  const state = {
    offers: [],
    ui: {
      budget_fcfa: 1000,
      usage: "data", // data | mixte | appels
      validity: "toutes", // toutes | 24h | 7j | 30j
      operator: "Tous", // Tous | Orange | Free | Expresso
      last_updated_iso: null,
      admin_authed: false,
    },
    promos: [], // reserved (if you later want promos-only)
  };

  const loadState = () => {
    const saved = safeStorage.get();
    if (saved?.offers && Array.isArray(saved.offers)) {
      state.offers = saved.offers;
      state.ui = { ...state.ui, ...(saved.ui ?? {}) };
      state.promos = Array.isArray(saved.promos) ? saved.promos : [];
      return;
    }
    state.offers = DEFAULT_OFFERS;
    state.ui.last_updated_iso = nowIso();
    persistState();
  };

  const persistState = () => {
    if (!state.ui.last_updated_iso) state.ui.last_updated_iso = nowIso();
    safeStorage.set({
      offers: state.offers,
      ui: state.ui,
      promos: state.promos,
    });
  };

  /* -----------------------------
   * DOM getters (defensive)
   * ----------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const dom = {
    // pages
    pageHome: () => $("#page-accueil"),
    pagePromos: () => $("#page-promos"),
    pageGuide: () => $("#page-guide"),
    pageContact: () => $("#page-contact"),
    pageAdmin: () => $("#page-admin"),

    // nav
    navLinks: () => $$(".navLink"),
    burgerBtn: () => $("#burgerBtn"),
    mobileMenu: () => $("#mobileMenu"),

    // filters
    budgetInput: () => $("#budgetInput"),
    budgetBtn: () => $("#budgetBtn"),
    budgetCount: () => $("#budgetCount"),
    budgetQuickBtns: () => $$(".budgetQuick"),
    usageChips: () => $$(".chipUsage"),
    validityChips: () => $$(".chipValidity"),
    operatorChips: () => $$(".chipOperator"),
    lastUpdated: () => $("#lastUpdated"),

    // results
    bestBanner: () => $("#bestBanner"),
    bestTitle: () => $("#bestTitle"),
    bestGain: () => $("#bestGain"),
    bestHint: () => $("#bestHint"),
    bestMeta: () => $("#bestMeta"),
    resultsCount: () => $("#resultsCount"),
    resultsGrid: () => $("#resultsGrid"),
    emptyState: () => $("#emptyState"),

    // modals
    modalVerify: () => $("#modalVerify"),
    openVerifyBtns: () => $$(".openVerify"),
    closeModalBtns: () => $$(".closeModal"),

    // admin access
    adminLinkTop: () => $("#adminLinkTop"),

    // admin
    adminLoginWrap: () => $("#adminLoginWrap"),
    adminPanelWrap: () => $("#adminPanelWrap"),
    adminPassInput: () => $("#adminPass"),
    adminLoginBtn: () => $("#adminLoginBtn"),
    adminLogoutBtn: () => $("#adminLogoutBtn"),
    adminList: () => $("#adminOfferList"),
    adminForm: () => $("#adminOfferForm"),
    adminJsonExportBtn: () => $("#adminExportBtn"),
    adminJsonImportInput: () => $("#adminImportInput"),
    adminResetBtn: () => $("#adminResetBtn"),

    toast: () => $("#toast"),
  };

  /* -----------------------------
   * Routing (fix: pages separated)
   * ----------------------------- */
  const showOnlyPage = (pageId) => {
    const pages = [
      { id: "accueil", el: dom.pageHome() },
      { id: "promos", el: dom.pagePromos() },
      { id: "guide", el: dom.pageGuide() },
      { id: "contact", el: dom.pageContact() },
      { id: "admin", el: dom.pageAdmin() },
    ];

    pages.forEach((p) => {
      if (!p.el) return;
      p.el.style.display = p.id === pageId ? "" : "none";
    });

    // active link
    dom.navLinks().forEach((a) => {
      const target = a.getAttribute("href")?.replace("#", "") || "";
      a.classList.toggle("active", target === pageId);
    });
  };

  const getRoute = () => {
    const hash = (window.location.hash || "#accueil").replace("#", "").trim();
    if (["accueil", "promos", "guide", "contact", "admin"].includes(hash)) return hash;
    return "accueil";
  };

  const handleRoute = () => {
    const route = getRoute();

    // Admin invisible au public : on n'affiche pas le lien, mais #admin marche.
    const adminLink = dom.adminLinkTop();
    if (adminLink) adminLink.style.display = "none";

    showOnlyPage(route);

    // Fermer menu mobile si ouvert
    const mm = dom.mobileMenu();
    if (mm) mm.classList.remove("open");

    if (route === "admin") {
      renderAdmin();
    }
  };

  /* -----------------------------
   * UI chips (selected state)
   * ----------------------------- */
  const setSelectedChip = (chips, predicate) => {
    chips.forEach((c) => {
      c.classList.toggle("active", predicate(c));
      c.setAttribute("aria-pressed", c.classList.contains("active") ? "true" : "false");
    });
  };

  const updateChipsUI = () => {
    setSelectedChip(dom.usageChips(), (c) => c.dataset.value === state.ui.usage);
    setSelectedChip(dom.validityChips(), (c) => c.dataset.value === state.ui.validity);
    setSelectedChip(dom.operatorChips(), (c) => c.dataset.value === state.ui.operator);

    // quick budget active
    dom.budgetQuickBtns().forEach((b) => {
      const v = Number(b.dataset.value);
      b.classList.toggle("active", Number.isFinite(v) && v === Number(state.ui.budget_fcfa));
    });

    // last updated
    const lu = dom.lastUpdated();
    if (lu) {
      const d = state.ui.last_updated_iso ? new Date(state.ui.last_updated_iso) : new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      lu.textContent = `Dernière MAJ : aujourd’hui ${hh}:${mm}`;
    }
  };

  /* -----------------------------
   * Render: best banner + list
   * ----------------------------- */
  const toast = (msg) => {
    const t = dom.toast();
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    window.setTimeout(() => t.classList.remove("show"), 2000);
  };

  const buildShareUrl = (offer) => {
    const text = [
      `📱 ${offer.operator} — ${offer.name}`,
      `💰 ${offer.price_fcfa} FCFA`,
      offer.data_mb ? `📶 ${fmtData(offer.data_mb)}` : null,
      offer.minutes ? `📞 ${fmtMinutes(offer.minutes)}` : null,
      `⏱ ${validityLabel(offer)}`,
      offer.ussd_code ? `Code: ${offer.ussd_code}` : null,
      `via Doylu`,
    ]
      .filter(Boolean)
      .join(" • ");
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const cardTemplate = (offer, rankLabel) => {
    const badge = offerBadge(offer);
    const data = offer.data_mb ? fmtData(offer.data_mb) : null;
    const mins = offer.minutes ? fmtMinutes(offer.minutes) : null;

    const badgeHtml = badge
      ? `<span class="badge badge-${badge.kind}">${escapeHtml(badge.text)}</span>`
      : "";

    const rankHtml = rankLabel
      ? `<div class="rankPill">${escapeHtml(rankLabel)}</div>`
      : "";

    const eligibility =
      offer.eligibility_type && offer.eligibility_type !== "public"
        ? `<div class="eligibilityNote">Peut nécessiter un justificatif selon l’opérateur.</div>`
        : "";

    const ussdBtnLabel = offer.ussd_code ? "👁️ Afficher le code" : "👁️ Détails";
    const ussdBlock = offer.ussd_code
      ? `<div class="ussdReveal" data-offer="${escapeHtml(offer.offer_id)}" hidden>
            <div class="ussdCode">${escapeHtml(offer.ussd_code)}</div>
            <div class="ussdActions">
              <button class="btn btn-light btnCopy" data-offer="${escapeHtml(offer.offer_id)}">📋 Copier</button>
              <a class="btn btn-green btnShare" href="${buildShareUrl(offer)}" target="_blank" rel="noreferrer">🟢 Partager WhatsApp</a>
            </div>
         </div>`
      : "";

    const specialPill =
      offer.eligibility_type && offer.eligibility_type !== "public"
        ? `<span class="pillSpecial">🔒 Sous conditions</span>`
        : "";

    return `
      <article class="offerCard" data-id="${escapeHtml(offer.offer_id)}">
        <div class="cardTop">
          <div class="opLeft">
            <div class="opIcon">${escapeHtml(offer.operator?.slice(0, 1) ?? "?")}</div>
            <div class="opMeta">
              <div class="opName">${escapeHtml(offer.operator)}</div>
              <div class="opTitle">${escapeHtml(offer.name)}</div>
            </div>
          </div>
          <div class="opRight">
            ${rankHtml}
            ${badgeHtml}
          </div>
        </div>

        <div class="cardPrice">${escapeHtml(String(offer.price_fcfa))} FCFA</div>

        <div class="cardLine">
          ${data ? `<span>📶 ${escapeHtml(data)}</span>` : ""}
          ${mins ? `<span>📞 ${escapeHtml(mins)}</span>` : ""}
          <span>⏱ ${escapeHtml(validityLabel(offer))}</span>
          ${specialPill}
        </div>

        <div class="cardActions">
          <button class="btn btn-orange btnReveal" data-offer="${escapeHtml(offer.offer_id)}">${ussdBtnLabel}</button>
          <a class="btn btn-light btnShareSecondary" href="${buildShareUrl(offer)}" target="_blank" rel="noreferrer">Partager</a>
        </div>

        ${ussdBlock}
        ${eligibility}
      </article>
    `;
  };

  const splitPublicSpecial = (offers) => {
    const pub = [];
    const special = [];
    for (const o of offers) {
      const e = o.eligibility_type ?? "public";
      if (e === "public") pub.push(o);
      else special.push(o);
    }
    return { pub, special };
  };

  const sortOffers = (offers, usage) => {
    return [...offers].sort((a, b) => {
      const sa = computeScore(a, usage);
      const sb = computeScore(b, usage);
      if (sb !== sa) return sb - sa;

      // tie-breaker: higher validity, then lower price
      const da = normalizeValidityDays(a) ?? 0;
      const db = normalizeValidityDays(b) ?? 0;
      if (db !== da) return db - da;

      const pa = Number(a.price_fcfa) || 0;
      const pb = Number(b.price_fcfa) || 0;
      return pa - pb;
    });
  };

  const renderBestBanner = (filteredOffers) => {
    const banner = dom.bestBanner();
    const titleEl = dom.bestTitle();
    const gainEl = dom.bestGain();
    const hintEl = dom.bestHint();
    const metaEl = dom.bestMeta();
    if (!banner || !titleEl || !gainEl || !hintEl || !metaEl) return;

    const { pub, special } = splitPublicSpecial(filteredOffers);
    const usage = state.ui.usage;
    const sortedPub = sortOffers(pub, usage);
    const best = sortedPub[0] ?? null;
    const second = sortedPub[1] ?? null;

    const budget = Number(state.ui.budget_fcfa);
    titleEl.textContent = `🔥 Meilleure valeur pour ${budget} FCFA (${usage})`;

    // Gain dynamique : priorité ressource (Go/min), sinon économie FCFA
    let gainLine = null;
    let econLine = null;

    if (best && second) {
      if (usage === "data") {
        if (Number.isFinite(best.data_mb) && Number.isFinite(second.data_mb)) {
          gainLine = formatGainDataMb(best.data_mb - second.data_mb);
        }
      } else if (usage === "appels") {
        if (Number.isFinite(best.minutes) && Number.isFinite(second.minutes)) {
          gainLine = formatGainMinutes(best.minutes - second.minutes);
        }
      } else {
        if (Number.isFinite(best.data_mb) && Number.isFinite(second.data_mb)) {
          gainLine = formatGainDataMb(best.data_mb - second.data_mb);
        } else if (Number.isFinite(best.minutes) && Number.isFinite(second.minutes)) {
          gainLine = formatGainMinutes(best.minutes - second.minutes);
        }
      }

      const eco = computeEconomyFcfa(best, second, usage);
      econLine = formatGainFcfa(eco);
    }

    // On n'affiche pas une ligne vide / incohérente
    gainEl.textContent = gainLine || econLine || "";

    // Hint simple (V1)
    hintEl.textContent = best ? bestHint(best, usage) : "";

    const pubCount = pub.length;
    const specCount = special.length;

    metaEl.textContent = best
      ? `${best.operator} — ${best.name} • ${
          best.data_mb ? `📶 ${fmtData(best.data_mb)} • ` : ""
        }${best.minutes ? `📞 ${fmtMinutes(best.minutes)} • ` : ""}⏱ ${validityLabel(best)} • ${
          best.price_fcfa
        } FCFA — ${pubCount} offre(s) publique(s)${specCount ? ` • ${specCount} sous conditions` : ""}`
      : `Aucune offre trouvée pour ${budget} FCFA.`;

    banner.style.display = "";
  };

  const renderOffers = () => {
    updateChipsUI();

    const budgetInput = dom.budgetInput();
    if (budgetInput && String(budgetInput.value).trim() === "") {
      budgetInput.value = String(state.ui.budget_fcfa);
    }

    const filtered = filterOffers(state.offers, state.ui);

    // update count top right in budget card
    const cnt = dom.budgetCount();
    if (cnt) cnt.textContent = `${filtered.length} offre(s) disponible(s)`;

    renderBestBanner(filtered);

    // list
    const grid = dom.resultsGrid();
    const count = dom.resultsCount();
    const empty = dom.emptyState();
    if (!grid || !count || !empty) return;

    const usage = state.ui.usage;
    const { pub, special } = splitPublicSpecial(filtered);

    const sortedPub = sortOffers(pub, usage);
    const sortedSpecial = sortOffers(special, usage);

    const all = [...sortedPub, ...sortedSpecial];

    count.textContent = `${all.length} offre(s) ≤ ${state.ui.budget_fcfa} FCFA`;

    if (all.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";

    const bestId = sortedPub[0]?.offer_id ?? null;

    grid.innerHTML = all
      .map((o) => {
        const isBest = bestId && o.offer_id === bestId;
        const rank = isBest ? "🏆 TOP CHOIX" : null;
        return cardTemplate(o, rank);
      })
      .join("");

    // events: reveal/copy
    $$(".btnReveal").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.offer;
        const block = $(`.ussdReveal[data-offer="${CSS.escape(id)}"]`);
        const offer = state.offers.find((x) => x.offer_id === id);
        if (!offer) return;

        if (!block) {
          // no ussd: show activation path if any
          const text = offer.activation_path ? `Chemin: ${offer.activation_path}` : "Pas de code USSD.";
          toast(text);
          return;
        }

        const isHidden = block.hasAttribute("hidden");
        if (isHidden) {
          block.removeAttribute("hidden");
          btn.textContent = "👁️ Code affiché";
        } else {
          // second tap = copy if possible
          copyUssd(id);
        }
      });
    });

    $$(".btnCopy").forEach((btn) => {
      btn.addEventListener("click", () => copyUssd(btn.dataset.offer));
    });
  };

  const copyUssd = async (offerId) => {
    const offer = state.offers.find((x) => x.offer_id === offerId);
    if (!offer?.ussd_code) return;

    const code = String(offer.ussd_code);
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copié ✅ Compose-le maintenant.");
    } catch {
      // fallback: prompt
      window.prompt("Copie le code :", code);
    }
  };

  /* -----------------------------
   * Filters wiring
   * ----------------------------- */
  const applyBudget = (v) => {
    const budget = clampInt(v, 0, 200000);
    if (!budget) return;
    state.ui.budget_fcfa = budget;
    state.ui.last_updated_iso = state.ui.last_updated_iso || nowIso();
    persistState();
    renderOffers();

    // scroll to results
    const banner = dom.bestBanner();
    if (banner) banner.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const wireFilters = () => {
    const budgetInput = dom.budgetInput();
    const budgetBtn = dom.budgetBtn();
    if (budgetInput) {
      budgetInput.value = String(state.ui.budget_fcfa);
      budgetInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyBudget(budgetInput.value);
      });
      budgetInput.addEventListener("input", () => {
        // lightweight feedback (optional)
        const v = clampInt(budgetInput.value, 0, 200000);
        if (!v) return;
        state.ui.budget_fcfa = v;
        persistState();
      });
    }
    if (budgetBtn) budgetBtn.addEventListener("click", () => applyBudget(budgetInput?.value));

    dom.budgetQuickBtns().forEach((b) => {
      b.addEventListener("click", () => {
        const v = Number(b.dataset.value);
        if (!Number.isFinite(v)) return;
        if (budgetInput) budgetInput.value = String(v);
        applyBudget(v);
      });
    });

    dom.usageChips().forEach((c) => {
      c.addEventListener("click", () => {
        const v = c.dataset.value;
        if (!USAGE_TYPES.includes(v)) return;
        state.ui.usage = v;
        persistState();
        renderOffers();
      });
    });

    dom.validityChips().forEach((c) => {
      c.addEventListener("click", () => {
        const v = c.dataset.value;
        if (!VALIDITY_FILTERS.includes(v)) return;
        state.ui.validity = v;
        persistState();
        renderOffers();
      });
    });

    dom.operatorChips().forEach((c) => {
      c.addEventListener("click", () => {
        const v = c.dataset.value;
        if (v !== "Tous" && !OPERATORS_SN.includes(v)) return;
        state.ui.operator = v;
        persistState();
        renderOffers();
      });
    });

    // verify modal open/close
    dom.openVerifyBtns().forEach((b) => {
      b.addEventListener("click", () => {
        const m = dom.modalVerify();
        if (m) m.classList.add("open");
      });
    });
    dom.closeModalBtns().forEach((b) => {
      b.addEventListener("click", () => {
        const m = b.closest(".modal");
        if (m) m.classList.remove("open");
      });
    });

    // burger menu
    const burger = dom.burgerBtn();
    const mm = dom.mobileMenu();
    if (burger && mm) {
      burger.addEventListener("click", () => mm.classList.toggle("open"));
    }
  };

  /* -----------------------------
   * Admin (simple)
   * ----------------------------- */
  const ADMIN_PASS_KEY = "doylu_admin_pass"; // stored hash-like (light)
  const DEFAULT_ADMIN_PASS = "doylu123"; // change later if you want

  const hashPass = async (pass) => {
    // light hashing (still client-side) – enough for V1 demo
    const data = new TextEncoder().encode(`doylu::${pass}`);
    if (!crypto?.subtle) return `plain:${pass}`;
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const ensureAdminPass = async () => {
    const saved = safeStorage.get() || {};
    if (!saved?.ui) saved.ui = state.ui;

    // We keep admin auth only in memory, not in storage
    // We store only the hashed password in storage for login
    let passHash;
    try {
      passHash = window.localStorage.getItem(ADMIN_PASS_KEY);
    } catch {
      passHash = null;
    }
    if (!passHash) {
      const h = await hashPass(DEFAULT_ADMIN_PASS);
      try {
        window.localStorage.setItem(ADMIN_PASS_KEY, h);
      } catch {
        // ignore
      }
    }
  };

  const isAdminAuthed = () => state.ui.admin_authed === true;

  const setAdminAuthed = (v) => {
    state.ui.admin_authed = v;
    persistState();
  };

  const renderAdmin = () => {
    const loginWrap = dom.adminLoginWrap();
    const panelWrap = dom.adminPanelWrap();
    if (!loginWrap || !panelWrap) return;

    if (!isAdminAuthed()) {
      loginWrap.style.display = "";
      panelWrap.style.display = "none";
    } else {
      loginWrap.style.display = "none";
      panelWrap.style.display = "";
      renderAdminList();
    }

    wireAdminEventsOnce();
  };

  let adminEventsWired = false;

  const wireAdminEventsOnce = () => {
    if (adminEventsWired) return;
    adminEventsWired = true;

    const loginBtn = dom.adminLoginBtn();
    const logoutBtn = dom.adminLogoutBtn();
    const passInput = dom.adminPassInput();

    if (loginBtn && passInput) {
      loginBtn.addEventListener("click", async () => {
        const pass = String(passInput.value || "");
        if (!pass) return;

        let storedHash = null;
        try {
          storedHash = window.localStorage.getItem(ADMIN_PASS_KEY);
        } catch {
          storedHash = null;
        }

        const inputHash = await hashPass(pass);
        if (storedHash && inputHash === storedHash) {
          setAdminAuthed(true);
          passInput.value = "";
          toast("Admin connecté ✅");
          renderAdmin();
          return;
        }
        toast("Mot de passe incorrect");
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        setAdminAuthed(false);
        toast("Déconnecté");
        window.location.hash = "#accueil";
      });
    }

    const form = dom.adminForm();
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!isAdminAuthed()) return;

        const fd = new FormData(form);
        const offer_id = String(fd.get("offer_id") || "").trim() || makeId();
        const operator = String(fd.get("operator") || "Orange");
        const eligibility_type = String(fd.get("eligibility_type") || "public");
        const type_usage = String(fd.get("type_usage") || "data");
        const validity_type = String(fd.get("validity_type") || "inconnu");
        const price_fcfa = clampInt(fd.get("price_fcfa"), 0, 200000) ?? 0;

        const data_mb = fd.get("data_mb") ? clampInt(fd.get("data_mb"), 0, 500000) : null;
        const minutes = fd.get("minutes") ? clampInt(fd.get("minutes"), 0, 100000) : null;

        const updated = {
          offer_id,
          country: "SN",
          operator: OPERATORS_SN.includes(operator) ? operator : "Orange",
          name: String(fd.get("name") || "").trim() || "Nouvelle offre",
          price_fcfa,
          type_usage: USAGE_TYPES.includes(type_usage) ? type_usage : "data",
          data_mb: Number.isFinite(Number(data_mb)) ? Number(data_mb) : null,
          minutes: Number.isFinite(Number(minutes)) ? Number(minutes) : null,
          sms: null,
          validity_type,
          validity_days: normalizeValidityDays({ validity_type }),
          ussd_code: String(fd.get("ussd_code") || "").trim() || null,
          activation_path: String(fd.get("activation_path") || "").trim() || null,
          status: "active",
          eligibility_type,
          is_verified: Boolean(fd.get("is_verified")),
          source_type: String(fd.get("source_type") || "sms"),
          last_seen_at: nowIso(),
          created_at: nowIso(),
          updated_at: nowIso(),
        };

        const idx = state.offers.findIndex((o) => o.offer_id === offer_id);
        if (idx >= 0) {
          updated.created_at = state.offers[idx].created_at || updated.created_at;
          state.offers[idx] = { ...state.offers[idx], ...updated, updated_at: nowIso() };
        } else {
          state.offers.push(updated);
        }

        state.ui.last_updated_iso = nowIso();
        persistState();
        renderAdminList();
        renderOffers();
        toast("Offre enregistrée ✅");
        form.reset();
      });
    }

    const exportBtn = dom.adminJsonExportBtn();
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (!isAdminAuthed()) return;
        const payload = {
          exported_at: nowIso(),
          offers: state.offers,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "doylu-offers.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast("Export JSON prêt ✅");
      });
    }

    const importInput = dom.adminJsonImportInput();
    if (importInput) {
      importInput.addEventListener("change", async () => {
        if (!isAdminAuthed()) return;
        const file = importInput.files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const offers = Array.isArray(parsed?.offers) ? parsed.offers : Array.isArray(parsed) ? parsed : null;
          if (!offers) throw new Error("Format JSON invalide");

          // sanitize + merge by offer_id
          for (const o of offers) {
            if (!o.offer_id) o.offer_id = makeId();
            if (!o.operator || !OPERATORS_SN.includes(o.operator)) continue;
            o.country = "SN";
            o.status = o.status || "active";
            o.eligibility_type = o.eligibility_type || "public";
            o.updated_at = nowIso();
            o.created_at = o.created_at || nowIso();
          }

          const byId = new Map(state.offers.map((o) => [o.offer_id, o]));
          for (const o of offers) {
            if (!o.operator || !OPERATORS_SN.includes(o.operator)) continue;
            byId.set(o.offer_id, { ...(byId.get(o.offer_id) || {}), ...o });
          }
          state.offers = Array.from(byId.values());
          state.ui.last_updated_iso = nowIso();
          persistState();
          renderAdminList();
          renderOffers();
          toast("Import JSON OK ✅");
        } catch (e) {
          toast("Import JSON échoué");
          console.error(e);
        } finally {
          importInput.value = "";
        }
      });
    }

    const resetBtn = dom.adminResetBtn();
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (!isAdminAuthed()) return;
        const ok = window.confirm("Réinitialiser les offres (démo) ?");
        if (!ok) return;
        state.offers = [...DEFAULT_OFFERS];
        state.ui.last_updated_iso = nowIso();
        persistState();
        renderAdminList();
        renderOffers();
        toast("Réinitialisé ✅");
      });
    }
  };

  const renderAdminList = () => {
    const list = dom.adminList();
    if (!list) return;

    const rows = [...state.offers]
      .filter((o) => o.country === "SN")
      .sort((a, b) => (a.operator || "").localeCompare(b.operator || "") || (a.price_fcfa || 0) - (b.price_fcfa || 0))
      .map((o) => {
        const special = o.eligibility_type && o.eligibility_type !== "public";
        return `
          <div class="adminRow">
            <div class="adminRowMain">
              <div class="adminRowTitle">${escapeHtml(o.operator)} — ${escapeHtml(o.name)}</div>
              <div class="adminRowMeta">
                <span>${escapeHtml(fmtFcfa(o.price_fcfa))}</span>
                ${o.data_mb ? `<span>📶 ${escapeHtml(fmtData(o.data_mb))}</span>` : ""}
                ${o.minutes ? `<span>📞 ${escapeHtml(fmtMinutes(o.minutes))}</span>` : ""}
                <span>⏱ ${escapeHtml(validityLabel(o))}</span>
                ${special ? `<span class="adminSpecial">Sous conditions</span>` : ""}
              </div>
            </div>
            <div class="adminRowActions">
              <button class="btn btn-light adminEdit" data-id="${escapeHtml(o.offer_id)}">Modifier</button>
              <button class="btn btn-danger adminDel" data-id="${escapeHtml(o.offer_id)}">Supprimer</button>
            </div>
          </div>
        `;
      })
      .join("");

    list.innerHTML = rows || `<div class="adminEmpty">Aucune offre.</div>`;

    $$(".adminEdit").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const o = state.offers.find((x) => x.offer_id === id);
        if (!o) return;
        const form = dom.adminForm();
        if (!form) return;

        // map to form fields
        form.querySelector('[name="offer_id"]').value = o.offer_id;
        form.querySelector('[name="operator"]').value = o.operator;
        form.querySelector('[name="name"]').value = o.name;
        form.querySelector('[name="price_fcfa"]').value = o.price_fcfa;
        form.querySelector('[name="type_usage"]').value = o.type_usage || "data";
        form.querySelector('[name="data_mb"]').value = o.data_mb ?? "";
        form.querySelector('[name="minutes"]').value = o.minutes ?? "";
        form.querySelector('[name="validity_type"]').value = o.validity_type || "inconnu";
        form.querySelector('[name="ussd_code"]').value = o.ussd_code ?? "";
        form.querySelector('[name="activation_path"]').value = o.activation_path ?? "";
        form.querySelector('[name="eligibility_type"]').value = o.eligibility_type || "public";
        form.querySelector('[name="source_type"]').value = o.source_type || "sms";
        form.querySelector('[name="is_verified"]').checked = Boolean(o.is_verified);

        toast("Mode édition ✅");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    $$(".adminDel").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const o = state.offers.find((x) => x.offer_id === id);
        if (!o) return;
        const ok = window.confirm(`Supprimer "${o.name}" ?`);
        if (!ok) return;
        state.offers = state.offers.filter((x) => x.offer_id !== id);
        state.ui.last_updated_iso = nowIso();
        persistState();
        renderAdminList();
        renderOffers();
        toast("Supprimé ✅");
      });
    });
  };

  /* -----------------------------
   * Init
   * ----------------------------- */
  const init = async () => {
    loadState();

    // Force operators list (remove Lebara etc if present)
    state.offers = state.offers.filter((o) => !o.operator || OPERATORS_SN.includes(o.operator));
    persistState();

    await ensureAdminPass();

    wireFilters();
    handleRoute();
    renderOffers();

    window.addEventListener("hashchange", handleRoute);

    // Ensure nav links only change hash (avoid full reload)
    dom.navLinks().forEach((a) => {
      a.addEventListener("click", () => {
        // nothing; hashchange will handle
      });
    });
  };

  document.addEventListener("DOMContentLoaded", init);
})();
