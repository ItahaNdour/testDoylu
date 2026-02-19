import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

(() => {
  "use strict";

  /* =========================
   * 0) FIREBASE
   * ========================= */
  const firebaseConfig = {
    apiKey: "AIzaSyByiREEaHhhY9s9HI6uho6K0wat-PgrVCI",
    authDomain: "doylu-69ed8.firebaseapp.com",
    projectId: "doylu-69ed8",
    storageBucket: "doylu-69ed8.firebasestorage.app",
    messagingSenderId: "15959760370",
    appId: "1:15959760370:web:dd7bd5aebb1fe81016df6b",
  };

  let db = null;
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch {
    db = null;
  }

  /* =========================
   * 1) CONFIG
   * ========================= */
  const CONFIG = {
    operators: ["Orange", "Free", "Expresso"],
    validityMap: { "Toutes": null, "24h": 1, "7 jours": 7, "30 jours": 30 },
    STORAGE_KEY: "doylu_offers_v1",
    WA_LINK: "https://wa.me/?text=",
    GAIN_MIN_RATIO: 0.15,
  };

  /* =========================
   * 2) HELPERS
   * ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safe = (v) => (v == null ? "" : String(v));
  const clampInt = (v, fallback = 0) => {
    const n = Number.parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const formatFcfa = (n) => `${Number(n).toLocaleString("fr-FR")} FCFA`;
  const mbToGo = (mb) => mb / 1024;

  const formatData = (mb) => {
    if (!Number.isFinite(mb)) return "—";
    if (mb >= 1024) {
      const go = mbToGo(mb);
      const s = go % 1 === 0 ? go.toFixed(0) : go.toFixed(1);
      return `${s} Go`;
    }
    return `${Math.round(mb)} Mo`;
  };

  const toast = (msg) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1600);
  };

  const openModal = (title, bodyHtml) => {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;
    $("#modal").classList.remove("hidden");
  };
  const closeModal = () => $("#modal").classList.add("hidden");

  const siteUrl = () => `${location.origin}${location.pathname}`.replace(/\/index\.html$/i, "/");

  /* =========================
   * 3) TRACKING
   * ========================= */
  const trackEvent = async (type, offer, extra = {}) => {
    if (!db) return;

    const payload = {
      type,
      offer_id: offer?.offer_id || null,
      operator: offer?.operator || null,
      price_fcfa: offer?.price_fcfa || null,
      usage: offer?.type_usage || null,
      ts: serverTimestamp(),
      page: location.hash || "#accueil",
      ...extra,
    };

    try {
      await addDoc(collection(db, "offer_events"), payload);

      if (offer?.offer_id) {
        const statsRef = doc(db, "offer_stats", offer.offer_id);
        const inc = { updated_at: serverTimestamp() };

        if (type === "share_whatsapp") inc.shares = increment(1);
        if (type === "copy_code") inc.copies = increment(1);
        if (type === "reveal_code") inc.reveals = increment(1);

        inc.operator = offer.operator || null;
        inc.name = offer.name || null;
        inc.price_fcfa = offer.price_fcfa || null;

        await setDoc(statsRef, inc, { merge: true });
      }
    } catch {
      // ignore
    }
  };

  /* =========================
   * 4) OFFERS
   * ========================= */
  const normalizeOffer = (o) => {
    const operator = safe(o.operator).trim();
    const usage = String(o.type_usage ?? "data").toLowerCase();
    const elig = String(o.eligibility_type ?? "public").toLowerCase();

    return {
      offer_id: safe(o.offer_id || o.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()))),
      operator,
      name: safe(o.name || "Offre").trim(),
      price_fcfa: Number(o.price_fcfa ?? o.price ?? 0),
      type_usage: ["data", "appels", "mixte"].includes(usage) ? usage : "data",
      data_mb: o.data_mb == null || o.data_mb === "" ? null : Number(o.data_mb),
      minutes: o.minutes == null || o.minutes === "" ? null : Number(o.minutes),
      validity_days: o.validity_days == null || o.validity_days === "" ? null : Number(o.validity_days),
      ussd_code: safe(o.ussd_code || "").trim(),
      eligibility_type: ["public", "student", "corporate", "special", "restricted"].includes(elig) ? elig : "public",
      est_promo: Boolean(o.est_promo ?? false),
      source_badge: safe(o.source_badge || "Source SMS").trim(),
      status: safe(o.status || "active").toLowerCase(),
    };
  };

  const defaultOffers = () => ([
    { operator: "Orange", name: "Pass Jour 5Go", price_fcfa: 1000, type_usage: "data", data_mb: 5*1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass semaine 2Go", price_fcfa: 1000, type_usage: "data", data_mb: 2*1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Promo 10Go (30 jours) exclusif OM", price_fcfa: 2000, type_usage: "data", data_mb: 10*1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", est_promo: true, source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Éducation 1Go", price_fcfa: 100, type_usage: "data", data_mb: 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "student", source_badge: "Source SMS", status: "active" },
  ].map(normalizeOffer));

  const loadOffers = () => {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return defaultOffers();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return defaultOffers();
      return arr.map(normalizeOffer);
    } catch {
      return defaultOffers();
    }
  };

  let OFFERS = loadOffers();

  /* =========================
   * 5) STATE
   * ========================= */
  const state = {
    route: "accueil",
    budgetX: 1000,      // 0 => sans budget
    usage: "data",
    operator: "Tous",
    validity: "Toutes",
    promoOperator: "Tous",
    sort: "valeur",
    show: 8,
  };

  /* =========================
   * 6) PIPELINE
   * ========================= */
  const isActive = (o) => safe(o.status).toLowerCase() === "active";
  const isOperatorAllowed = (o) => CONFIG.operators.includes(o.operator);

  const offerHasUsage = (o, usage) => {
    if (!usage) return true;
    if (o.type_usage === usage) return true;
    if (o.type_usage === "mixte" && (usage === "data" || usage === "appels")) return true;
    return false;
  };

  const offerMatchesValidity = (o, validityLabel) => {
    const maxDays = CONFIG.validityMap[validityLabel] ?? null;
    if (!maxDays) return true;
    if (!Number.isFinite(o.validity_days)) return false;
    return o.validity_days <= maxDays;
  };

  const filterByBudget = (list, x) => {
    if (!x || x <= 0) return list; // budget vide => pas de filtre budget
    const low = x;
    const high = Math.floor(x * 1.2);
    return list.filter((o) => o.price_fcfa >= low && o.price_fcfa <= high);
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

    if (!Number.isFinite(o.data_mb)) return -Infinity;
    return o.data_mb / o.price_fcfa;
  };

  const computeUnitLabel = (o) => {
    if (!o) return null;

    if (state.usage !== "appels" && Number.isFinite(o.data_mb) && o.data_mb > 0) {
      const go = mbToGo(o.data_mb);
      const perGo = Math.round(o.price_fcfa / go);
      return `💰 ${perGo} FCFA / Go`;
    }

    if (state.usage === "appels" && Number.isFinite(o.minutes) && o.minutes > 0) {
      const perMin = (o.price_fcfa / o.minutes);
      const rounded = perMin < 1 ? perMin.toFixed(2) : perMin.toFixed(1);
      return `💰 ${rounded} FCFA / min`;
    }

    return null;
  };

  const computeGainSimple = (top1, top2, usage) => {
    if (!top1 || !top2) return null;

    if (usage === "appels") {
      if (!Number.isFinite(top1.minutes) || !Number.isFinite(top2.minutes) || top2.minutes <= 0) return null;
      const diff = top1.minutes - top2.minutes;
      if (diff <= 0) return null;
      if ((diff / top2.minutes) < CONFIG.GAIN_MIN_RATIO) return null;
      return `🔥 +${Math.round(diff)} min de plus que les autres offres`;
    }

    const a = top1.data_mb;
    const b = top2.data_mb;
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;

    const diff = a - b;
    if (diff <= 0) return null;
    if ((diff / b) < CONFIG.GAIN_MIN_RATIO) return null;

    if (diff < 1024) return `🔥 +${Math.round(diff)} Mo de plus que les autres offres`;
    const go = mbToGo(diff);
    const s = go % 1 === 0 ? go.toFixed(0) : go.toFixed(1);
    return `🔥 +${s} Go de plus que les autres offres`;
  };

  const sortOffersForDisplay = (arr) => {
    const usage = state.usage;
    const sort = state.sort;

    const byScore = (a, b) => computeScore(b, usage) - computeScore(a, usage);
    const byPrice = (a, b) => (a.price_fcfa - b.price_fcfa);
    const byVolume = (a, b) => {
      const av = (usage === "appels") ? (a.minutes ?? -1) : (a.data_mb ?? -1);
      const bv = (usage === "appels") ? (b.minutes ?? -1) : (b.data_mb ?? -1);
      return bv - av;
    };
    const byDuree = (a, b) => (b.validity_days ?? -1) - (a.validity_days ?? -1);

    if (sort === "prix") return arr.slice().sort(byPrice);
    if (sort === "volume") return arr.slice().sort(byVolume);
    if (sort === "duree") return arr.slice().sort(byDuree);
    return arr.slice().sort(byScore);
  };

  const pipeline = () => {
    let list = OFFERS.slice()
      .map(normalizeOffer)
      .filter(isActive)
      .filter(isOperatorAllowed);

    list = filterByBudget(list, state.budgetX);

    if (state.operator !== "Tous") list = list.filter((o) => o.operator === state.operator);

    list = list.filter((o) => offerHasUsage(o, state.usage));
    list = list.filter((o) => offerMatchesValidity(o, state.validity));

    const publicOffers = list.filter((o) => o.eligibility_type === "public");
    const specialOffers = list.filter((o) => o.eligibility_type !== "public");

    const scoredPublic = sortOffersForDisplay(publicOffers);
    const top1 = scoredPublic[0] || null;
    const top2 = scoredPublic[1] || null;
    const gain = (top1 && top2) ? computeGainSimple(top1, top2, state.usage) : null;

    return { list, specialOffers, scoredPublic, top1, gain };
  };

  /* =========================
   * 7) RENDER
   * ========================= */
  const renderOfferCard = (o, { isTop = false } = {}) => {
    const badgeTop = isTop ? `<div class="pill pill-top">🏆 Recommandé</div>` : "";
    const badgeSource = `<div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>`;
    const badgePromo = o.est_promo ? `<div class="pill pill-warning">Promo</div>` : "";

    const metaLine = (state.usage === "appels")
      ? `📞 ${Number.isFinite(o.minutes) ? `${Math.round(o.minutes)} min` : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`
      : `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;

    const unit = computeUnitLabel(o);
    const unitHtml = unit ? `<div class="offer-kpi">${unit}</div>` : "";

    const ussdHtml = `<div class="ussd hidden" data-ussd-wrap="${o.offer_id}"><code>${o.ussd_code || "—"}</code></div>`;

    const shareText = encodeURIComponent(
      `Doylu — ${o.operator} • ${o.name} • ${formatFcfa(o.price_fcfa)} • ${metaLine} • Code: ${o.ussd_code || "—"} • ${siteUrl()}`
    );
    const waHref = `${CONFIG.WA_LINK}${shareText}`;

    return `
      <article class="offer-card" data-offer="${o.offer_id}">
        <div class="offer-head">
          <div class="offer-operator">
            <span class="pill">${o.operator?.[0] || "•"}</span>
            <span>${o.operator}</span>
          </div>
          <div class="offer-badges">
            ${badgeTop}
            ${badgePromo}
            ${badgeSource}
          </div>
        </div>

        <div class="offer-name">${safe(o.operator)} — ${safe(o.name)}</div>
        <div class="offer-price">${formatFcfa(o.price_fcfa)}</div>
        <div class="offer-meta">${metaLine}</div>
        ${unitHtml}

        <div class="offer-actions secondary">
          <button class="btn btn-primary" data-action="reveal" data-id="${o.offer_id}">👁 Afficher le code</button>
        </div>

        ${ussdHtml}

        <div class="offer-actions">
          <button class="btn btn-light" data-action="copy" data-id="${o.offer_id}">📋 Copier</button>
          <a class="btn btn-secondary" data-action="share" data-id="${o.offer_id}" href="${waHref}" target="_blank" rel="noopener noreferrer">🟢 WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderSpecialCard = (o) => {
    const metaLine = `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    const shareText = encodeURIComponent(`Doylu — ${o.operator} • ${o.name} • ${formatFcfa(o.price_fcfa)} • ${metaLine} • ${siteUrl()}`);
    const waHref = `${CONFIG.WA_LINK}${shareText}`;

    return `
      <article class="offer-card" data-offer="${o.offer_id}">
        <div class="offer-head">
          <div class="offer-operator">
            <span class="pill">${o.operator?.[0] || "•"}</span>
            <span>${o.operator}</span>
          </div>
          <div class="offer-badges">
            <div class="pill pill-warning">🔒 Sous conditions</div>
            <div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>
          </div>
        </div>

        <div class="offer-name">${safe(o.operator)} — ${safe(o.name)}</div>
        <div class="offer-price">${formatFcfa(o.price_fcfa)}</div>
        <div class="offer-meta">${metaLine}</div>

        <div class="offer-actions" style="grid-template-columns:1fr;">
          <a class="btn btn-secondary" data-action="share" data-id="${o.offer_id}" href="${waHref}" target="_blank" rel="noopener noreferrer">🟢 Partager WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderBestBanner = ({ top1, gain }) => {
    const banner = $("#bestBanner");
    if (!banner) return;

    if (!top1) {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");

    $("#bestTitle").textContent = (!state.budgetX || state.budgetX <= 0)
      ? "🔥 Meilleur choix du moment"
      : `🔥 Meilleur choix pour ${formatFcfa(state.budgetX)}`;

    const vol = (state.usage === "appels")
      ? (Number.isFinite(top1.minutes) ? `${Math.round(top1.minutes)} min` : "—")
      : (Number.isFinite(top1.data_mb) ? formatData(top1.data_mb) : "—");
    const dur = Number.isFinite(top1.validity_days) ? `${top1.validity_days} jour(s)` : "Durée ?";

    $("#bestLine1").textContent = `${top1.operator} — ${top1.name} • ${vol} • ${dur}`;

    const unit = computeUnitLabel(top1);
    const unitEl = $("#bestUnit");
    if (unit) {
      unitEl.textContent = unit;
      unitEl.classList.remove("hidden");
    } else {
      unitEl.classList.add("hidden");
    }

    const gainEl = $("#bestGain");
    if (gain) {
      gainEl.textContent = gain;
      gainEl.classList.remove("hidden");
    } else {
      gainEl.classList.add("hidden");
    }
  };

  const renderPromos = () => {
    const grid = $("#promosGrid");
    const empty = $("#promosEmpty");
    if (!grid || !empty) return;

    const op = state.promoOperator;
    const promos = OFFERS
      .map(normalizeOffer)
      .filter(isActive)
      .filter(isOperatorAllowed)
      .filter((o) => o.est_promo)
      .filter((o) => (op === "Tous" ? true : o.operator === op));

    if (!promos.length) {
      empty.classList.remove("hidden");
      grid.innerHTML = "";
      return;
    }

    empty.classList.add("hidden");
    grid.innerHTML = promos.map((o) => renderOfferCard(o, { isTop: false })).join("");
  };

  const renderResults = () => {
    const { list, specialOffers, scoredPublic, top1, gain } = pipeline();

    const countEl = $("#offersCount");
    if (countEl) countEl.textContent = `${list.length} offre(s)`;

    const empty = $("#noResults");
    if (empty) {
      if (!list.length) {
        empty.classList.remove("hidden");
        empty.textContent = state.budgetX > 0
          ? `Aucune offre proche de ${formatFcfa(state.budgetX)}.`
          : `Aucune offre trouvée avec ces filtres.`;
      } else {
        empty.classList.add("hidden");
      }
    }

    renderBestBanner({ top1, gain });

    const resultsTitle = $("#resultsTitle");
    if (resultsTitle) {
      const n = list.length;
      resultsTitle.textContent = `${n} offre${n > 1 ? "s" : ""} trouvée${n > 1 ? "s" : ""}`;
    }

    const grid = $("#offersGrid");
    if (grid) {
      const limited = scoredPublic.slice(0, state.show);
      grid.innerHTML = limited.map((o, idx) => renderOfferCard(o, { isTop: idx === 0 })).join("");
    }

    const wrap = $("#specialOffersWrap");
    const sgrid = $("#specialOffersGrid");
    if (wrap && sgrid) {
      if (!specialOffers.length) {
        wrap.classList.add("hidden");
      } else {
        wrap.classList.remove("hidden");
        sgrid.innerHTML = specialOffers.map(renderSpecialCard).join("");
      }
    }

    renderPromos();
  };

  /* =========================
   * 8) ROUTER
   * ========================= */
  const views = ["accueil", "promos", "ussd", "contact"];

  const showRoute = (route) => {
    const r = views.includes(route) ? route : "accueil";
    state.route = r;

    views.forEach((v) => {
      const el = $(`#view-${v}`);
      if (!el) return;
      el.classList.toggle("hidden", v !== r);
    });

    $$(".nav-link").forEach((a) => {
      const is = a.getAttribute("data-route") === r;
      a.style.textDecoration = is ? "underline" : "none";
    });

    $("#mobileNav")?.classList.add("hidden");
    $("#menuBtn")?.setAttribute("aria-expanded", "false");

    if (r === "accueil") renderResults();
    if (r === "promos") renderPromos();
  };

  const handleHash = () => showRoute((location.hash || "#accueil").replace("#", "").trim());

  /* =========================
   * 9) EVENTS
   * ========================= */
  const setActiveChips = (filter, value) => {
    $$(`.chip-filter[data-filter="${filter}"]`).forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-value") === value);
    });
  };

  const setActiveBudgetChips = (budget) => {
    $$(".chip-budget").forEach((btn) => {
      btn.classList.toggle("is-active", clampInt(btn.getAttribute("data-budget"), 0) === budget);
    });
  };

  const applyBudget = (x) => {
    const budget = Math.max(0, clampInt(x, 0));
    state.budgetX = budget || 0;
    $("#budgetInput").value = budget ? String(budget) : "";
    setActiveBudgetChips(budget);
    renderResults();
    $("#bestBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindEvents = () => {
    $("#menuBtn")?.addEventListener("click", () => {
      const mobile = $("#mobileNav");
      const expanded = $("#menuBtn").getAttribute("aria-expanded") === "true";
      $("#menuBtn").setAttribute("aria-expanded", String(!expanded));
      mobile?.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      const a = e.target.closest(".nav-link");
      if (!a) return;
      $("#mobileNav")?.classList.add("hidden");
      $("#menuBtn")?.setAttribute("aria-expanded", "false");
    });

    $("#budgetSubmit")?.addEventListener("click", () => applyBudget($("#budgetInput").value));
    $("#budgetInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBudget($("#budgetInput").value);
    });

    $$(".chip-budget").forEach((btn) => btn.addEventListener("click", () => applyBudget(btn.getAttribute("data-budget"))));

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip-filter");
      if (!btn) return;

      const filter = btn.getAttribute("data-filter");
      const value = btn.getAttribute("data-value");

      if (filter === "usage") {
        state.usage = value;
        setActiveChips("usage", value);
        $("#mUsage") && ($("#mUsage").value = value);
        renderResults();
      }
      if (filter === "operator") {
        state.operator = value;
        setActiveChips("operator", value);
        $("#mOperator") && ($("#mOperator").value = value);
        renderResults();
      }
      if (filter === "validity") {
        state.validity = value;
        setActiveChips("validity", value);
        $("#mValidity") && ($("#mValidity").value = value);
        renderResults();
      }
      if (filter === "promoOperator") {
        state.promoOperator = value;
        setActiveChips("promoOperator", value);
        renderPromos();
      }
    });

    $("#filtersToggle")?.addEventListener("click", () => {
      const panel = $("#filtersPanel");
      const expanded = $("#filtersToggle").getAttribute("aria-expanded") === "true";
      $("#filtersToggle").setAttribute("aria-expanded", String(!expanded));
      panel?.classList.toggle("hidden");
    });

    $("#mApply")?.addEventListener("click", () => {
      state.usage = $("#mUsage")?.value || "data";
      state.operator = $("#mOperator")?.value || "Tous";
      state.validity = $("#mValidity")?.value || "Toutes";
      state.sort = $("#mSort")?.value || "valeur";
      state.show = clampInt($("#mShow")?.value, 8) || 8;

      setActiveChips("usage", state.usage);
      setActiveChips("operator", state.operator);
      setActiveChips("validity", state.validity);

      $("#filtersPanel")?.classList.add("hidden");
      $("#filtersToggle")?.setAttribute("aria-expanded", "false");
      renderResults();
    });

    const verifyHtml = `
      <ul>
        <li>On collecte des offres reçues par SMS/USSD et des annonces publiques.</li>
        <li>On vérifie la cohérence (prix, volume, validité) et on retire les offres expirées.</li>
        <li>Les offres “sous conditions” restent visibles mais ne dominent jamais le Top.</li>
      </ul>
    `;
    $("#howVerifyBtn")?.addEventListener("click", () => openModal("Comment on vérifie ?", verifyHtml));
    $("#sourcesInfoBtn")?.addEventListener("click", () => openModal("Comment on vérifie ?", verifyHtml));

    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modal")?.addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

    $("#waOpenBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const txt = encodeURIComponent(`Je veux recevoir les bons plans Doylu sur WhatsApp 🙌 • ${siteUrl()}`);
      window.open(`${CONFIG.WA_LINK}${txt}`, "_blank", "noopener,noreferrer");
    });

    document.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;

      const action = actionBtn.getAttribute("data-action");
      const id = actionBtn.getAttribute("data-id");
      const offer = OFFERS.map(normalizeOffer).find((o) => o.offer_id === id);
      if (!offer) return;

      if (action === "reveal") {
        const wrap = document.querySelector(`[data-ussd-wrap="${id}"]`);
        if (wrap) wrap.classList.toggle("hidden");
        trackEvent("reveal_code", offer);
      }

      if (action === "copy") {
        const code = offer.ussd_code || "";
        if (!code) return toast("Pas de code disponible");

        try {
          await navigator.clipboard.writeText(code);
          toast("Code copié ✅");
        } catch {
          const ta = document.createElement("textarea");
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          toast("Code copié ✅");
        }
        trackEvent("copy_code", offer);
      }

      if (action === "share") {
        trackEvent("share_whatsapp", offer, { via: "whatsapp" });
      }
    });

    $("#contactSend")?.addEventListener("click", () => {
      $("#contactToast").textContent = "✅ Merci ! Message enregistré (V1).";
      setTimeout(() => ($("#contactToast").textContent = ""), 2000);
    });
    $("#smsSend")?.addEventListener("click", () => {
      $("#smsToast").textContent = "✅ Merci ! SMS enregistré (V1).";
      setTimeout(() => ($("#smsToast").textContent = ""), 2000);
    });
    $("#partnerBtn")?.addEventListener("click", () => {
      $("#partnerToast").textContent = "✅ OK.";
      setTimeout(() => ($("#partnerToast").textContent = ""), 2000);
    });
  };

  /* =========================
   * 10) INIT
   * ========================= */
  const init = () => {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    const lastUpdateText = $("#lastUpdateText");
    if (lastUpdateText) lastUpdateText.textContent = `MAJ : aujourd'hui ${nowHHMM()}`;

    $("#budgetInput").value = String(state.budgetX);
    setActiveBudgetChips(state.budgetX);

    setActiveChips("usage", "data");
    setActiveChips("operator", "Tous");
    setActiveChips("validity", "Toutes");
    setActiveChips("promoOperator", "Tous");

    $("#mUsage") && ($("#mUsage").value = state.usage);
    $("#mOperator") && ($("#mOperator").value = state.operator);
    $("#mValidity") && ($("#mValidity").value = state.validity);

    bindEvents();

    window.addEventListener("hashchange", handleHash);
    handleHash();

    renderResults();
    renderPromos();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
