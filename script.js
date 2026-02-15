/* Doylu V1 — script.js
   - Routing hash (#/accueil, #/promos, #/guide, #/contact, #/admin)
   - Stockage local robuste (localStorage si possible, sinon fallback)
   - Filtres: budget, usage, opérateur, validité
   - Classement + gain uniquement sur offres public (eligibility_type=public)
   - Offres "special/student/corporate" visibles après + badge
   - Admin: CRUD + import/export JSON (changes instant sur Accueil)
*/

(() => {
  "use strict";

  // ---------------------------
  // Storage (avoid sandbox issues)
  // ---------------------------
  const memoryStore = new Map();

  function canUseLocalStorage() {
    try {
      const k = "__doylu_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  const HAS_LS = canUseLocalStorage();

  const Store = {
    get(key) {
      try {
        if (HAS_LS) return window.localStorage.getItem(key);
        return memoryStore.get(key) ?? null;
      } catch {
        return memoryStore.get(key) ?? null;
      }
    },
    set(key, value) {
      try {
        if (HAS_LS) window.localStorage.setItem(key, value);
        else memoryStore.set(key, value);
      } catch {
        memoryStore.set(key, value);
      }
    },
    remove(key) {
      try {
        if (HAS_LS) window.localStorage.removeItem(key);
        else memoryStore.delete(key);
      } catch {
        memoryStore.delete(key);
      }
    },
  };

  // ---------------------------
  // DOM helpers
  // ---------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c]));
  }

  function nowHuman() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `aujourd’hui ${hh}:${mm}`;
  }

  // ---------------------------
  // Data model
  // ---------------------------
  const DB_KEY = "doylu_offers_v1";
  const META_KEY = "doylu_meta_v1";
  const ADMIN_SESSION_KEY = "doylu_admin_session";
  const ADMIN_PASS = "doylu2026"; // simple V1

  /**
   * Offer schema (local V1)
   * {
   *   id, country:"SN", operator:"Orange|Free|Expresso",
   *   name, price_fcfa:number,
   *   type_usage:"data|appels|mixte",
   *   data_mb:number|null, minutes:number|null,
   *   validity_type:"24h|7j|30j|mois|inconnu",
   *   validity_days:number|null,
   *   ussd_code:string,
   *   source:"official|sms",
   *   is_promo:boolean,
   *   eligibility_type:"public|student|corporate|special",
   *   active:boolean,
   *   updated_at: ISO
   * }
   */

  function seedOffers() {
    // Offres Orange (fiables) d’après captures (structure réutilisable pour Free/Expresso plus tard)
    // Note: "Pass Éducation 1Go" = très probablement sous conditions (student/special) => NOT public.
    const iso = new Date().toISOString();
    return [
      {
        id: "orange_jour_300mb_200",
        country: "SN",
        operator: "Orange",
        name: "Pass Jour 300Mo",
        price_fcfa: 200,
        type_usage: "data",
        data_mb: 300,
        minutes: null,
        validity_type: "24h",
        validity_days: 1,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_jour_15go_500",
        country: "SN",
        operator: "Orange",
        name: "Pass Jour 1,5Go",
        price_fcfa: 500,
        type_usage: "data",
        data_mb: 1536,
        minutes: null,
        validity_type: "24h",
        validity_days: 1,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_jour_5go_1000",
        country: "SN",
        operator: "Orange",
        name: "Pass Jour 5Go",
        price_fcfa: 1000,
        type_usage: "data",
        data_mb: 5120,
        minutes: null,
        validity_type: "24h",
        validity_days: 1,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_nuit_5go_500",
        country: "SN",
        operator: "Orange",
        name: "Pass Nuit 5Go",
        price_fcfa: 500,
        type_usage: "data",
        data_mb: 5120,
        minutes: null,
        validity_type: "24h",
        validity_days: 1,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_semaine_600mb_500",
        country: "SN",
        operator: "Orange",
        name: "Pass Semaine 600Mo",
        price_fcfa: 500,
        type_usage: "data",
        data_mb: 600,
        minutes: null,
        validity_type: "7j",
        validity_days: 7,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_semaine_2go_1000",
        country: "SN",
        operator: "Orange",
        name: "Pass Semaine 2Go",
        price_fcfa: 1000,
        type_usage: "data",
        data_mb: 2048,
        minutes: null,
        validity_type: "7j",
        validity_days: 7,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_semaine_10go_2500",
        country: "SN",
        operator: "Orange",
        name: "Pass Semaine 10Go",
        price_fcfa: 2500,
        type_usage: "data",
        data_mb: 10240,
        minutes: null,
        validity_type: "7j",
        validity_days: 7,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_mois_10go_promo_2000",
        country: "SN",
        operator: "Orange",
        name: "Pass Mois 10Go (Promo OM)",
        price_fcfa: 2000,
        type_usage: "data",
        data_mb: 10240,
        minutes: null,
        validity_type: "30j",
        validity_days: 30,
        ussd_code: "*1234#",
        source: "sms",
        is_promo: true,
        eligibility_type: "special",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_mois_5go_2000",
        country: "SN",
        operator: "Orange",
        name: "Pass 5Go (Exclusif Max it)",
        price_fcfa: 2000,
        type_usage: "data",
        data_mb: 5120,
        minutes: null,
        validity_type: "30j",
        validity_days: 30,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "special",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_mois_12go_3000",
        country: "SN",
        operator: "Orange",
        name: "Pass Mois 12Go (dont 3Go OM)",
        price_fcfa: 3000,
        type_usage: "data",
        data_mb: 12288,
        minutes: null,
        validity_type: "30j",
        validity_days: 30,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_mois_25go_5000",
        country: "SN",
        operator: "Orange",
        name: "Pass Mois 25Go (dont 12,5Go OM)",
        price_fcfa: 5000,
        type_usage: "data",
        data_mb: 25600,
        minutes: null,
        validity_type: "30j",
        validity_days: 30,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_mois_60go_10000",
        country: "SN",
        operator: "Orange",
        name: "Pass Mois 60Go (dont 30Go OM)",
        price_fcfa: 10000,
        type_usage: "data",
        data_mb: 61440,
        minutes: null,
        validity_type: "30j",
        validity_days: 30,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },
      {
        id: "orange_mois_100go_15000",
        country: "SN",
        operator: "Orange",
        name: "Pass Mois 100Go (dont 50Go OM)",
        price_fcfa: 15000,
        type_usage: "data",
        data_mb: 102400,
        minutes: null,
        validity_type: "30j",
        validity_days: 30,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "public",
        active: true,
        updated_at: iso,
      },

      // Offre sous conditions (ex: éducation / étudiant) => jamais #1, jamais comparée pour gain
      {
        id: "orange_edu_1go_100",
        country: "SN",
        operator: "Orange",
        name: "Pass Éducation 1Go",
        price_fcfa: 100,
        type_usage: "data",
        data_mb: 1024,
        minutes: null,
        validity_type: "7j",
        validity_days: 7,
        ussd_code: "*1234#",
        source: "official",
        is_promo: false,
        eligibility_type: "student",
        active: true,
        updated_at: iso,
      },
    ];
  }

  function loadDb() {
    const raw = Store.get(DB_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveDb(offers) {
    Store.set(DB_KEY, JSON.stringify(offers));
    const meta = { last_update_at: new Date().toISOString() };
    Store.set(META_KEY, JSON.stringify(meta));
  }

  function getMeta() {
    const raw = Store.get(META_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function ensureDb() {
    const existing = loadDb();
    if (existing && existing.length) return existing;
    const seeded = seedOffers();
    saveDb(seeded);
    return seeded;
  }

  // ---------------------------
  // Routing / views
  // ---------------------------
  const views = ["accueil", "promos", "guide", "contact", "admin"];

  function getRoute() {
    const hash = window.location.hash || "#/accueil";
    const m = hash.match(/^#\/([a-z]+)$/i);
    const r = (m?.[1] || "accueil").toLowerCase();
    return views.includes(r) ? r : "accueil";
  }

  function showView(route) {
    views.forEach((v) => {
      const el = $(`#view-${v}`);
      if (!el) return;
      el.hidden = v !== route;
    });
    $$(".nav__link").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  }

  // ---------------------------
  // UI state
  // ---------------------------
  const state = {
    budget: 1000,
    usage: "data",
    operator: "Tous",
    validity: "Toutes",
    promosOperator: "Tous",
  };

  // ---------------------------
  // Scoring
  // ---------------------------
  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function valuePerFcfaData(o) {
    const mb = safeNum(o.data_mb);
    const price = safeNum(o.price_fcfa);
    if (!mb || !price || price <= 0) return 0;
    return mb / price; // MB per FCFA
  }

  function valuePerFcfaMinutes(o) {
    const minutes = safeNum(o.minutes);
    const price = safeNum(o.price_fcfa);
    if (!minutes || !price || price <= 0) return 0;
    return minutes / price;
  }

  function validityBonus(o) {
    const d = safeNum(o.validity_days);
    if (!d) return 0;
    // simple V1: favor longer a bit, but not too much
    if (d >= 30) return 0.35;
    if (d >= 7) return 0.20;
    if (d >= 1) return 0.10;
    return 0;
  }

  function sourceBonus(o) {
    // trust proxy (not the full confidence engine yet)
    return o.source === "official" ? 0.10 : 0.05;
  }

  function computeScore(o, usage) {
    const bValid = validityBonus(o);
    const bSource = sourceBonus(o);

    if (usage === "data") {
      const v = valuePerFcfaData(o);
      return (v * 1.0) + bValid + bSource;
    }
    if (usage === "appels") {
      const v = valuePerFcfaMinutes(o);
      return (v * 1.0) + bValid + bSource;
    }
    // mixte (simple V1)
    const vd = valuePerFcfaData(o) * 0.7;
    const vm = valuePerFcfaMinutes(o) * 0.3;
    return vd + vm + bValid + bSource;
  }

  // ---------------------------
  // Gain formatting (data + fcfa)
  // ---------------------------
  function roundToNearest(n, step) {
    return Math.round(n / step) * step;
  }

  function formatDataGain(mbGain) {
    if (!Number.isFinite(mbGain) || mbGain <= 0) return null;

    if (mbGain < 1024) {
      const rounded = roundToNearest(mbGain, 50);
      return `+${rounded} Mo`;
    }

    const go = mbGain / 1024;
    const roundedGo = roundToNearest(go, 0.5);
    // keep one decimal if .5
    const txt = Number.isInteger(roundedGo) ? String(roundedGo) : roundedGo.toFixed(1);
    return `+${txt} Go`;
  }

  function formatFcfaGain(fcfa) {
    if (!Number.isFinite(fcfa) || fcfa <= 0) return null;
    return `Économise ${Math.round(fcfa)} FCFA`;
  }

  // ---------------------------
  // Filtering
  // ---------------------------
  function filterOffers(allOffers, { budget, usage, operator, validity }) {
    const b = Number(budget);
    return allOffers
      .filter((o) => o.active !== false)
      .filter((o) => Number(o.price_fcfa) <= b)
      .filter((o) => operator === "Tous" ? true : o.operator === operator)
      .filter((o) => usage ? o.type_usage === usage : true)
      .filter((o) => {
        if (validity === "Toutes") return true;
        return o.validity_type === validity;
      });
  }

  function splitEligibility(list) {
    const pub = [];
    const special = [];
    for (const o of list) {
      const e = (o.eligibility_type || "public");
      if (e === "public") pub.push(o);
      else special.push(o);
    }
    return { pub, special };
  }

  // ---------------------------
  // Rendering offers
  // ---------------------------
  function fmtMbOrGo(mb) {
    const n = safeNum(mb);
    if (!n) return "—";
    if (n < 1024) return `${Math.round(n)} Mo`;
    const go = n / 1024;
    const txt = go >= 10 ? go.toFixed(0) : go.toFixed(1);
    return `${txt} Go`;
  }

  function fmtValidity(o) {
    const t = o.validity_type || "inconnu";
    if (t === "24h") return "24h";
    if (t === "7j") return "7 jours";
    if (t === "30j") return "30 jours";
    if (t === "mois") return "Mois";
    return "Inconnu";
  }

  function offerTags(o) {
    const tags = [];
    if (o.source === "official") tags.push({ cls: "", text: "Source officielle" });
    else tags.push({ cls: "", text: "Source SMS" });

    if (o.is_promo) tags.push({ cls: "offer__tag--promo", text: "Promo" });

    const e = o.eligibility_type || "public";
    if (e !== "public") {
      const label =
        e === "student" ? "🎓 Réservé étudiants" :
        e === "corporate" ? "🔒 Sous conditions" :
        "🔒 Offre spéciale";
      tags.push({ cls: "offer__tag--special", text: label });
    }
    return tags;
  }

  function renderOfferCard(o, { isTop = false } = {}) {
    const opLetter = (o.operator || "?").slice(0, 1).toUpperCase();
    const dataPart = o.type_usage === "data" || o.type_usage === "mixte"
      ? `📱 ${fmtMbOrGo(o.data_mb)}`
      : null;
    const minPart = o.type_usage === "appels" || o.type_usage === "mixte"
      ? `📞 ${safeNum(o.minutes) ?? "—"} min`
      : null;

    const metaBits = [
      dataPart,
      minPart,
      `⏱ ${fmtValidity(o)}`,
    ].filter(Boolean);

    const tags = offerTags(o);
    const topBadge = isTop ? `<div class="offer__tag" style="background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.3);color:#92400e">🏆 TOP CHOIX</div>` : "";

    return `
      <div class="offer" data-offer-id="${escapeHtml(o.id)}">
        <div class="offer__top">
          <div class="offer__op">
            <div class="offer__badgeOp">${escapeHtml(opLetter)}</div>
            <div>
              <div class="muted" style="font-weight:1000">${escapeHtml(o.operator)}</div>
              <div class="offer__title">${escapeHtml(o.name)}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
            ${topBadge}
            <div class="offer__tag">${escapeHtml(tags[0]?.text || "Source")}</div>
          </div>
        </div>

        <div class="offer__price">${escapeHtml(String(o.price_fcfa))} FCFA</div>

        <div class="offer__meta">
          ${metaBits.map((x) => `<span>${escapeHtml(x)}</span>`).join("")}
        </div>

        <div class="offer__meta" style="margin-top:10px">
          ${tags.slice(1).map((t) => `<span class="offer__tag ${escapeHtml(t.cls)}">${escapeHtml(t.text)}</span>`).join("")}
        </div>

        <div class="offer__actions">
          <button class="btnWide btnWide--code" data-action="reveal">👁️ Afficher le code</button>
          <div class="reveal" data-reveal hidden>${escapeHtml(o.ussd_code || "—")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button class="btnWide btnWide--copy" data-action="copy">📋 Copier</button>
            <button class="btnWide btnWide--wa" data-action="wa">🟢 Partager WhatsApp</button>
          </div>
        </div>
      </div>
    `;
  }

  function computeBannerHint(o, usage) {
    // ultra simple V1: just based on validity + volume
    const v = o.validity_type;
    if (usage === "data") {
      const mb = safeNum(o.data_mb) || 0;
      if (v === "24h" && mb >= 3000) return "✅ Bon pour 24h intensif";
      if (v === "7j") return "✅ Idéal pour la semaine";
      if (v === "30j" || v === "mois") return "✅ Bon pour le mois";
      return "✅ Idéal pour usage quotidien";
    }
    if (usage === "appels") {
      const m = safeNum(o.minutes) || 0;
      if (v === "24h" && m >= 60) return "✅ Bon pour appeler aujourd’hui";
      if (v === "7j") return "✅ Pratique pour la semaine";
      return "✅ Bon plan appels";
    }
    // mixte
    if (v === "7j") return "✅ Mixte pour la semaine";
    if (v === "24h") return "✅ Mixte pour 24h";
    return "✅ Mixte équilibré";
  }

  function renderResults(allOffers) {
    const offersGrid = $("#offersGrid");
    const noOffers = $("#noOffers");
    const bestBanner = $("#bestBanner");
    const bestTitle = $("#bestTitle");
    const bestMeta = $("#bestMeta");
    const bestGain = $("#bestGain");
    const bestHint = $("#bestHint");
    const resultsCount = $("#resultsCount");

    const filtered = filterOffers(allOffers, state);
    const { pub, special } = splitEligibility(filtered);

    // Sort each group by score (usage-dependent)
    pub.sort((a, b) => computeScore(b, state.usage) - computeScore(a, state.usage));
    special.sort((a, b) => computeScore(b, state.usage) - computeScore(a, state.usage));

    const merged = [...pub, ...special];

    resultsCount.textContent = `${merged.length} offre(s) ≤ ${state.budget} FCFA`;

    if (merged.length === 0) {
      offersGrid.innerHTML = "";
      bestBanner.hidden = true;
      noOffers.hidden = false;
      return;
    }

    noOffers.hidden = true;

    // Banner best = top of PUBLIC only
    if (pub.length > 0) {
      const top = pub[0];
      bestBanner.hidden = false;
      bestTitle.textContent = `🔥 Meilleure valeur pour ${state.budget} FCFA (${state.usage})`;

      // Gain rules:
      // - compare only public #1 vs public #2
      // - for data usage => show data gain AND optionally economy (if top cheaper than #2)
      // - for appels usage => show minutes gain AND optionally economy (same idea) [ready for later]
      bestGain.hidden = true;

      let gainParts = [];

      if (pub.length >= 2) {
        const second = pub[1];

        // Data gain
        if (state.usage === "data") {
          const gMb = (safeNum(top.data_mb) ?? 0) - (safeNum(second.data_mb) ?? 0);
          const gTxt = formatDataGain(gMb);
          if (gTxt) gainParts.push(`${gTxt} de plus que l’offre publique suivante`);

          // FCFA economy (only if top is cheaper than #2)
          const econ = (safeNum(second.price_fcfa) ?? 0) - (safeNum(top.price_fcfa) ?? 0);
          const econTxt = formatFcfaGain(econ);
          if (econTxt) gainParts.push(econTxt);
        }

        // Appels gain (future ready)
        if (state.usage === "appels") {
          const gMin = (safeNum(top.minutes) ?? 0) - (safeNum(second.minutes) ?? 0);
          if (Number.isFinite(gMin) && gMin > 0) gainParts.push(`+${Math.round(gMin)} min vs l’offre publique suivante`);

          const econ = (safeNum(second.price_fcfa) ?? 0) - (safeNum(top.price_fcfa) ?? 0);
          const econTxt = formatFcfaGain(econ);
          if (econTxt) gainParts.push(econTxt);
        }

        // Mixte (simple): show data gain if possible, else economy
        if (state.usage === "mixte") {
          const gMb = (safeNum(top.data_mb) ?? 0) - (safeNum(second.data_mb) ?? 0);
          const gTxt = formatDataGain(gMb);
          if (gTxt) gainParts.push(`${gTxt} en plus (public)`);

          const econ = (safeNum(second.price_fcfa) ?? 0) - (safeNum(top.price_fcfa) ?? 0);
          const econTxt = formatFcfaGain(econ);
          if (econTxt) gainParts.push(econTxt);
        }
      }

      if (gainParts.length) {
        bestGain.hidden = false;
        // Make it punchy, not too long
        bestGain.textContent = `✨ ${gainParts.join(" • ")}`;
      }

      bestHint.hidden = false;
      bestHint.textContent = computeBannerHint(top, state.usage);

      const metaBits = [
        `${top.operator} — ${top.name}`,
        top.type_usage === "data" || top.type_usage === "mixte" ? `📱 ${fmtMbOrGo(top.data_mb)}` : null,
        top.type_usage === "appels" || top.type_usage === "mixte" ? `📞 ${safeNum(top.minutes) ?? "—"} min` : null,
        `⏱ ${fmtValidity(top)}`,
        `${top.price_fcfa} FCFA`,
        `${pub.length} offre(s) publique(s)`,
        special.length ? `${special.length} sous conditions` : null,
      ].filter(Boolean);

      bestMeta.textContent = metaBits.join(" • ");
    } else {
      bestBanner.hidden = true;
    }

    // Render cards (two columns responsive)
    const cards = merged.map((o, idx) => renderOfferCard(o, { isTop: idx === 0 && (o.eligibility_type || "public") === "public" }));
    offersGrid.innerHTML = cards.join("");

    bindOfferCardActions(allOffers);
  }

  // ---------------------------
  // Offer card actions
  // ---------------------------
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function bindOfferCardActions(allOffers) {
    $$(".offer").forEach((card) => {
      const id = card.dataset.offerId;
      const revealBtn = $('[data-action="reveal"]', card);
      const copyBtn = $('[data-action="copy"]', card);
      const waBtn = $('[data-action="wa"]', card);
      const revealBox = $('[data-reveal]', card);

      const offer = allOffers.find((x) => x.id === id);
      if (!offer) return;

      revealBtn?.addEventListener("click", () => {
        revealBox.hidden = !revealBox.hidden;
        if (!revealBox.hidden) toast("Code affiché ✅");
      });

      copyBtn?.addEventListener("click", async () => {
        const code = offer.ussd_code || "";
        if (!code) return toast("Aucun code à copier");
        try {
          await navigator.clipboard.writeText(code);
          toast("Code copié ✅");
        } catch {
          // fallback
          const ta = document.createElement("textarea");
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          toast("Code copié ✅");
        }
      });

      waBtn?.addEventListener("click", () => {
        const text = `Doylu — ${offer.operator} : ${offer.name} — ${offer.price_fcfa} FCFA — ${offer.data_mb ? fmtMbOrGo(offer.data_mb) : ""} ${offer.minutes ? `${offer.minutes} min` : ""} — Code: ${offer.ussd_code || ""}`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      });
    });
  }

  // ---------------------------
  // Modal
  // ---------------------------
  function openModal(title, html) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = html;
    $("#modal").hidden = false;
  }
  function closeModal() {
    $("#modal").hidden = true;
  }

  function bindModal() {
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalOk").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", closeModal);
  }

  function howWeVerifyHtml() {
    return `
      <ul>
        <li><strong>On collecte</strong> des offres reçues par SMS et des annonces publiques (USSD / réseaux / site).</li>
        <li><strong>On vérifie</strong> la cohérence (prix, volume, validité) et on retire les offres expirées.</li>
        <li><strong>Le badge “Source officielle / SMS”</strong> indique d’où vient l’info.</li>
      </ul>
      <div class="muted">Si une offre ne marche plus : signale-la via “Contact”.</div>
    `;
  }

  // ---------------------------
  // Admin auth
  // ---------------------------
  function isAdminAuthed() {
    return Store.get(ADMIN_SESSION_KEY) === "1";
  }

  function setAdminAuthed(v) {
    if (v) Store.set(ADMIN_SESSION_KEY, "1");
    else Store.remove(ADMIN_SESSION_KEY);
  }

  function ensureAdminEntry() {
    const adminLink = $("#adminNavLink");
    if (!adminLink) return;
    adminLink.hidden = !isAdminAuthed();
  }

  function guardAdmin(route) {
    if (route !== "admin") return true;
    if (isAdminAuthed()) return true;

    const pass = window.prompt("Mot de passe admin :");
    if (pass === ADMIN_PASS) {
      setAdminAuthed(true);
      ensureAdminEntry();
      return true;
    }
    window.location.hash = "#/accueil";
    toast("Accès refusé");
    return false;
  }

  // ---------------------------
  // Admin UI
  // ---------------------------
  function adminClearForm() {
    $("#a_id").value = "";
    $("#a_operator").value = "Orange";
    $("#a_name").value = "";
    $("#a_price").value = "";
    $("#a_usage").value = "data";
    $("#a_data").value = "";
    $("#a_minutes").value = "";
    $("#a_validity").value = "24h";
    $("#a_ussd").value = "*1234#";
    $("#a_source").value = "official";
    $("#a_promo").value = "false";
    $("#a_eligibility").value = "public";
  }

  function adminFillForm(o) {
    $("#a_id").value = o.id ?? "";
    $("#a_operator").value = o.operator ?? "Orange";
    $("#a_name").value = o.name ?? "";
    $("#a_price").value = o.price_fcfa ?? "";
    $("#a_usage").value = o.type_usage ?? "data";
    $("#a_data").value = o.data_mb ?? "";
    $("#a_minutes").value = o.minutes ?? "";
    $("#a_validity").value = o.validity_type ?? "24h";
    $("#a_ussd").value = o.ussd_code ?? "";
    $("#a_source").value = o.source ?? "official";
    $("#a_promo").value = String(!!o.is_promo);
    $("#a_eligibility").value = o.eligibility_type ?? "public";
  }

  function buildOfferFromForm() {
    const id = ($("#a_id").value || "").trim();
    const operator = $("#a_operator").value;
    const name = ($("#a_name").value || "").trim();
    const price = Number($("#a_price").value);
    const usage = $("#a_usage").value;
    const data_mb = ($("#a_data").value || "").trim() ? Number($("#a_data").value) : null;
    const minutes = ($("#a_minutes").value || "").trim() ? Number($("#a_minutes").value) : null;
    const validity_type = $("#a_validity").value;
    const ussd_code = ($("#a_ussd").value || "").trim();
    const source = $("#a_source").value;
    const is_promo = $("#a_promo").value === "true";
    const eligibility_type = $("#a_eligibility").value;

    if (!name) throw new Error("Nom obligatoire");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Prix invalide");

    const finalId = id || `${operator.toLowerCase()}_${price}_${Math.random().toString(16).slice(2, 8)}`;

    return {
      id: finalId,
      country: "SN",
      operator,
      name,
      price_fcfa: price,
      type_usage: usage,
      data_mb: Number.isFinite(data_mb) ? data_mb : null,
      minutes: Number.isFinite(minutes) ? minutes : null,
      validity_type,
      validity_days: validity_type === "24h" ? 1 : validity_type === "7j" ? 7 : validity_type === "30j" ? 30 : null,
      ussd_code: ussd_code || "*1234#",
      source,
      is_promo,
      eligibility_type: eligibility_type || "public",
      active: true,
      updated_at: new Date().toISOString(),
    };
  }

  function renderAdminList(allOffers) {
    const list = $("#adminOffersList");
    const sorted = [...allOffers].sort((a, b) => (a.operator + a.name).localeCompare(b.operator + b.name));

    list.innerHTML = sorted.map((o) => `
      <div class="adminItem" data-admin-id="${escapeHtml(o.id)}">
        <div>
          <div style="font-weight:1000">${escapeHtml(o.operator)} — ${escapeHtml(o.name)}</div>
          <div class="adminItem__meta">
            ${escapeHtml(String(o.price_fcfa))} FCFA • ${escapeHtml(o.type_usage)} • ${escapeHtml(fmtValidity(o))} • ${escapeHtml(o.eligibility_type || "public")}
          </div>
        </div>
        <div class="adminItem__actions">
          <button class="btn" data-admin-action="edit">Éditer</button>
          <button class="btn btn--danger" data-admin-action="delete">Supprimer</button>
        </div>
      </div>
    `).join("");

    $$(".adminItem").forEach((row) => {
      const id = row.dataset.adminId;
      row.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const action = btn.dataset.adminAction;
        const offers = loadDb() || [];
        const idx = offers.findIndex((x) => x.id === id);
        if (idx < 0) return;

        if (action === "edit") {
          adminFillForm(offers[idx]);
          $("#adminStatus").textContent = `Édition : ${id}`;
        }

        if (action === "delete") {
          if (!confirm("Supprimer cette offre ?")) return;
          offers.splice(idx, 1);
          saveDb(offers);
          $("#adminStatus").textContent = "Offre supprimée ✅";
          renderAdminList(offers);
          // refresh accueil view live
          renderResults(offers);
          updateLastUpdatePill();
        }
      });
    });
  }

  function bindAdmin(allOffers) {
    $("#adminLogout").addEventListener("click", () => {
      setAdminAuthed(false);
      ensureAdminEntry();
      window.location.hash = "#/accueil";
      toast("Déconnecté");
    });

    $("#clearFormBtn").addEventListener("click", () => {
      adminClearForm();
      $("#adminStatus").textContent = "";
    });

    $("#saveOfferBtn").addEventListener("click", () => {
      try {
        const newOffer = buildOfferFromForm();
        const offers = loadDb() || [];
        const idx = offers.findIndex((x) => x.id === newOffer.id);
        if (idx >= 0) offers[idx] = newOffer;
        else offers.push(newOffer);

        saveDb(offers);
        $("#adminStatus").textContent = "Enregistré ✅ (appliqué sur Accueil)";
        renderAdminList(offers);
        renderResults(offers);
        updateLastUpdatePill();
      } catch (err) {
        $("#adminStatus").textContent = `Erreur: ${err.message || err}`;
      }
    });

    $("#exportJsonBtn").addEventListener("click", () => {
      const offers = loadDb() || [];
      const blob = new Blob([JSON.stringify(offers, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doylu_offers_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    $("#importJsonInput").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error("JSON invalide (doit être un tableau d'offres)");
        // minimal validation
        for (const o of data) {
          if (!o.id || !o.operator || !o.name || !o.price_fcfa) {
            throw new Error("Une offre manque id/operator/name/price_fcfa");
          }
          // enforce SN operators list (no Lebara)
          if (!["Orange", "Free", "Expresso"].includes(o.operator)) {
            throw new Error(`Opérateur invalide: ${o.operator} (SN = Orange/Free/Expresso)`);
          }
        }
        saveDb(data);
        $("#adminStatus").textContent = "Import OK ✅";
        renderAdminList(data);
        renderResults(data);
        updateLastUpdatePill();
      } catch (err) {
        $("#adminStatus").textContent = `Import erreur: ${err.message || err}`;
      } finally {
        e.target.value = "";
      }
    });

    $("#resetDemoBtn").addEventListener("click", () => {
      if (!confirm("Reset démo ? (écrase tes données locales)")) return;
      const seeded = seedOffers();
      saveDb(seeded);
      $("#adminStatus").textContent = "Reset OK ✅";
      renderAdminList(seeded);
      renderResults(seeded);
      updateLastUpdatePill();
    });
  }

  // ---------------------------
  // Top UI bindings
  // ---------------------------
  function setActiveChip(groupSelector, predicateFn) {
    $$(groupSelector).forEach((btn) => {
      btn.classList.toggle("is-active", predicateFn(btn));
    });
  }

  function updateLastUpdatePill() {
    const meta = getMeta();
    const pill = $("#lastUpdatePill");
    if (!pill) return;
    if (!meta?.last_update_at) {
      pill.textContent = "🕒 Dernière MAJ : —";
      return;
    }
    // show "aujourd’hui HH:mm"
    pill.textContent = `🕒 Dernière MAJ : ${nowHuman()}`;
  }

  function bindHeaderMenu() {
    const menuBtn = $("#menuBtn");
    const nav = $("#nav");
    if (!menuBtn || !nav) return;

    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      nav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  }

  function bindAccueilControls(allOffers) {
    const budgetInput = $("#budgetInput");
    const searchBtn = $("#searchBtn");

    function applyBudget(v) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return;
      state.budget = n;
      budgetInput.value = String(n);
      renderResults(allOffers);
      // scroll gently to results
      $("#bestBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // init
    budgetInput.value = String(state.budget);

    searchBtn.addEventListener("click", () => {
      applyBudget(budgetInput.value);
    });

    budgetInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBudget(budgetInput.value);
    });

    $$(".chip--budget").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyBudget(btn.dataset.budget);
        setActiveChip(".chip--budget", (b) => b.dataset.budget === btn.dataset.budget);
      });
    });

    // Usage
    $$(".chip[data-usage]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.usage = btn.dataset.usage;
        setActiveChip('.chip[data-usage]', (b) => b.dataset.usage === state.usage);
        renderResults(allOffers);
      });
    });

    // Operator
    $$(".chip[data-operator]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.operator = btn.dataset.operator;
        setActiveChip('.chip[data-operator]', (b) => b.dataset.operator === state.operator);
        renderResults(allOffers);
      });
    });

    // Validity
    $$(".chip[data-validity]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.validity = btn.dataset.validity;
        setActiveChip('.chip[data-validity]', (b) => b.dataset.validity === state.validity);
        renderResults(allOffers);
      });
    });

    // Suggestions when no offers
    $$(".chip--suggest").forEach((btn) => {
      btn.addEventListener("click", () => {
        const b = btn.dataset.suggestBudget;
        const u = btn.dataset.suggestUsage;
        const v = btn.dataset.suggestValidity;

        if (b) applyBudget(b);

        if (u) {
          state.usage = u;
          setActiveChip('.chip[data-usage]', (x) => x.dataset.usage === state.usage);
        }

        if (v) {
          state.validity = v;
          setActiveChip('.chip[data-validity]', (x) => x.dataset.validity === state.validity);
        }

        renderResults(allOffers);
      });
    });

    // Verify modal
    $("#howVerifyBtn").addEventListener("click", () => openModal("Comment on vérifie ?", howWeVerifyHtml()));

    // WA CTA placeholder
    $("#waCta").href = "https://wa.me/?text=" + encodeURIComponent("Je veux recevoir les bons plans Doylu (1 msg/jour max).");
  }

  function bindPromos(allOffers) {
    $("#howVerifyBtn2").addEventListener("click", () => openModal("Comment on vérifie ?", howWeVerifyHtml()));

    function renderPromos() {
      const grid = $("#promosGrid");
      const promos = (allOffers || [])
        .filter((o) => o.active !== false)
        .filter((o) => !!o.is_promo)
        .filter((o) => state.promosOperator === "Tous" ? true : o.operator === state.promosOperator);

      if (!promos.length) {
        grid.innerHTML = `<div class="card compact"><strong>Pas de promos publiées pour l’instant</strong><div class="muted small">Ajoute une promo via Admin (#/admin).</div></div>`;
        return;
      }

      promos.sort((a, b) => (a.price_fcfa - b.price_fcfa));
      grid.innerHTML = promos.map((o) => renderOfferCard(o)).join("");
      bindOfferCardActions(allOffers);
    }

    $$(".chip[data-promos-operator]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.promosOperator = btn.dataset.promosOperator;
        setActiveChip('.chip[data-promos-operator]', (b) => b.dataset.promosOperator === state.promosOperator);
        renderPromos();
      });
    });

    renderPromos();
  }

  function bindContact() {
    // V1: no backend, show "copied message" to send via WhatsApp/email later
    function info(el, msg) { el.textContent = msg; }

    $("#contactSend1").addEventListener("click", () => {
      const op = $("#contactOperator").value;
      const details = $("#contactDetails").value.trim();
      if (!details) return info($("#contactInfo1"), "Ajoute des détails 👍");
      info($("#contactInfo1"), `Reçu ✅ (V1) — Copie/colle via WhatsApp au besoin. (${op})`);
      toast("Signalement enregistré ✅");
    });

    $("#contactSend2").addEventListener("click", () => {
      const op = $("#promoSmsOperator").value;
      const sms = $("#promoSmsText").value.trim();
      if (!sms) return info($("#contactInfo2"), "Colle le SMS 👍");
      info($("#contactInfo2"), `Merci ✅ (V1) — On l’ajoutera après vérification. (${op})`);
      toast("Promo reçue ✅");
    });

    $("#contactSend3").addEventListener("click", () => {
      info($("#contactInfo3"), "Contact (V1) : réponds via WhatsApp business / email.");
      toast("OK ✅");
    });
  }

  // ---------------------------
  // Init
  // ---------------------------
  function init() {
    bindHeaderMenu();
    bindModal();

    const offers = ensureDb();
    updateLastUpdatePill();

    // Admin entry hidden until auth
    ensureAdminEntry();

    // Router
    function onRoute() {
      const route = getRoute();
      if (!guardAdmin(route)) return;

      showView(route);

      // Bind view-specific
      if (route === "accueil") {
        bindAccueilControls(offers);
        renderResults(loadDb() || offers);
      }

      if (route === "promos") {
        bindPromos(loadDb() || offers);
      }

      if (route === "contact") {
        bindContact();
      }

      if (route === "admin") {
        // show admin link once authed
        ensureAdminEntry();
        adminClearForm();
        const latest = loadDb() || offers;
        renderAdminList(latest);
        bindAdmin(latest);
      }
    }

    window.addEventListener("hashchange", onRoute);

    // Default route
    if (!window.location.hash) window.location.hash = "#/accueil";
    onRoute();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
