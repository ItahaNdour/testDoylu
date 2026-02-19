/* Doylu V1 — script.js COMPLET (stable + améliorations demandées)
   - Navigation hash (#accueil/#promos/#ussd/#contact/#admin)
   - Budget V1: si X > 0 => price >= X && price <= X*1.2
              si X = 0 => pas de filtre budget (recherche libre)
   - Filtres: usage, opérateur (Orange/Free/Expresso), validité
   - Top + gain dynamiques (uniquement offres public)
   - Offres sous conditions séparées
   - Bandeau top compact + wording simple
*/

(() => {
  "use strict";

  /* =========================
   * 0) CONFIG
   * ========================= */
  const CONFIG = {
    operators: ["Orange", "Free", "Expresso"],
    validityMap: { "Toutes": null, "24h": 1, "7 jours": 7, "30 jours": 30 },
    budgetTolerance: 1.2,
    adminPassword: "doylu2026",
    STORAGE_KEY: "doylu_offers_v1",
    WA_LINK: "https://wa.me/?text=",
    gainMinRatio: 0.15, // n'affiche gain que si >= 15% vs l'autre (évite le gadget)
  };

  /* =========================
   * 1) HELPERS
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
  const roundTo = (value, step) => Math.round(value / step) * step;

  const formatData = (mb) => {
    if (!Number.isFinite(mb)) return "—";
    if (mb >= 1024) {
      const go = mbToGo(mb);
      const s = go % 1 === 0 ? go.toFixed(0) : go.toFixed(1);
      return `${s} Go`;
    }
    return `${Math.round(mb)} Mo`;
  };

  const formatUnitPrice = (o, usage) => {
    if (!o || !Number.isFinite(o.price_fcfa) || o.price_fcfa <= 0) return null;

    if (usage === "appels") {
      if (!Number.isFinite(o.minutes) || o.minutes <= 0) return null;
      const perMin = o.price_fcfa / o.minutes;
      const v = perMin < 1 ? perMin.toFixed(2) : perMin.toFixed(1);
      return `${v} FCFA / min`;
    }

    // data ou mixte: si data dispo => FCFA/Go
    if (Number.isFinite(o.data_mb) && o.data_mb > 0) {
      const go = o.data_mb / 1024;
      if (go <= 0) return null;
      const perGo = Math.round(o.price_fcfa / go);
      return `${perGo} FCFA / Go`;
    }

    // mixte sans data => minutes si dispo
    if (usage === "mixte" && Number.isFinite(o.minutes) && o.minutes > 0) {
      const perMin = o.price_fcfa / o.minutes;
      const v = perMin < 1 ? perMin.toFixed(2) : perMin.toFixed(1);
      return `${v} FCFA / min`;
    }

    return null;
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

  /* =========================
   * 2) OFFERS STORAGE
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
      eligibility_type: ["public", "student", "corporate", "special"].includes(elig) ? elig : "public",
      est_promo: Boolean(o.est_promo ?? o.is_promo ?? false),
      source_badge: safe(o.source_badge || "Source SMS").trim(),
      status: safe(o.status || "active").toLowerCase(),
    };
  };

  // Tu peux remplacer par tes vraies offres (ou importer via admin)
  const defaultOffers = () => ([
    { operator: "Orange", name: "Pass USSD 3,5Go (24h)", price_fcfa: 700, type_usage: "data", data_mb: 3.5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Jour 300Mo", price_fcfa: 200, type_usage: "data", data_mb: 300, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Jour 1,5Go", price_fcfa: 500, type_usage: "data", data_mb: 1536, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Jour 5Go", price_fcfa: 1000, type_usage: "data", data_mb: 5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass semaine 2Go", price_fcfa: 1000, type_usage: "data", data_mb: 2 * 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Promo 10Go (30 jours) exclusif OM", price_fcfa: 2000, type_usage: "data", data_mb: 10 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", est_promo: true, source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Éducation 1Go", price_fcfa: 100, type_usage: "data", data_mb: 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "student", source_badge: "Source SMS", status: "active" },

    // Exemple Free / Expresso (à compléter)
    { operator: "Free", name: "Pass Jour 1Go", price_fcfa: 500, type_usage: "data", data_mb: 1024, validity_days: 1, ussd_code: "*xxx#", eligibility_type: "public", source_badge: "Source officielle", status: "active" },
    { operator: "Expresso", name: "Pass Jour 2Go", price_fcfa: 1000, type_usage: "data", data_mb: 2048, validity_days: 1, ussd_code: "*xxx#", eligibility_type: "public", source_badge: "Source officielle", status: "active" },
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

  const saveOffers = (arr) => {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(arr));
    const lastUpdate = $("#lastUpdate");
    if (lastUpdate) lastUpdate.textContent = `MAJ : ${nowHHMM()}`;
  };

  let OFFERS = loadOffers();

  /* =========================
   * 3) STATE
   * ========================= */
  const state = {
    route: "accueil",
    budgetX: 1000,        // 0 => pas de budget
    usage: "data",        // data|mixte|appels
    operator: "Tous",     // Tous|Orange|Free|Expresso
    validity: "Toutes",   // Toutes|24h|7 jours|30 jours
    promoOperator: "Tous",
    isAdmin: false,
    editingId: null,
  };

  /* =========================
   * 4) FILTERS / LOGIC
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
    if (!Number.isFinite(x) || x <= 0) return list; // recherche libre
    const high = Math.floor(x * CONFIG.budgetTolerance);
    return list.filter((o) => Number.isFinite(o.price_fcfa) && o.price_fcfa >= x && o.price_fcfa <= high);
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

  const formatGainData = (gainMb) => {
    if (!Number.isFinite(gainMb) || gainMb <= 0) return null;
    if (gainMb < 1024) {
      const rounded = roundTo(gainMb, 50);
      return `+${Math.max(50, rounded)} Mo`;
    }
    const gainGo = mbToGo(gainMb);
    const roundedGo = roundTo(gainGo, 0.5);
    const str = roundedGo % 1 === 0 ? roundedGo.toFixed(0) : roundedGo.toFixed(1);
    return `+${str} Go`;
  };

  const formatGainMinutes = (gainMin) => {
    if (!Number.isFinite(gainMin) || gainMin <= 0) return null;
    return `+${Math.round(gainMin)} min`;
  };

  const gainIsMeaningful = (a, b) => {
    // a = top1, b = top2
    if (!a || !b) return false;

    if (state.usage === "appels") {
      if (!Number.isFinite(a.minutes) || !Number.isFinite(b.minutes) || b.minutes <= 0) return false;
      return (a.minutes - b.minutes) / b.minutes >= CONFIG.gainMinRatio;
    }

    // data/mixte: si data dispo
    if (Number.isFinite(a.data_mb) && Number.isFinite(b.data_mb) && b.data_mb > 0) {
      return (a.data_mb - b.data_mb) / b.data_mb >= CONFIG.gainMinRatio;
    }

    // mixte fallback minutes
    if (state.usage === "mixte" && Number.isFinite(a.minutes) && Number.isFinite(b.minutes) && b.minutes > 0) {
      return (a.minutes - b.minutes) / b.minutes >= CONFIG.gainMinRatio;
    }

    return false;
  };

  const computeGainLabel = (top1, top2, usage) => {
    if (!top1 || !top2) return null;
    if (!gainIsMeaningful(top1, top2)) return null;

    if (usage === "appels") {
      if (!Number.isFinite(top1.minutes) || !Number.isFinite(top2.minutes)) return null;
      const label = formatGainMinutes(top1.minutes - top2.minutes);
      return label ? `🔥 ${label} de plus que les autres offres` : null;
    }

    if (usage === "mixte") {
      if (Number.isFinite(top1.data_mb) && Number.isFinite(top2.data_mb)) {
        const label = formatGainData(top1.data_mb - top2.data_mb);
        return label ? `🔥 ${label} de plus que les autres offres` : null;
      }
      if (Number.isFinite(top1.minutes) && Number.isFinite(top2.minutes)) {
        const label = formatGainMinutes(top1.minutes - top2.minutes);
        return label ? `🔥 ${label} de plus que les autres offres` : null;
      }
      return null;
    }

    // data
    if (!Number.isFinite(top1.data_mb) || !Number.isFinite(top2.data_mb)) return null;
    const label = formatGainData(top1.data_mb - top2.data_mb);
    return label ? `🔥 ${label} de plus que les autres offres` : null;
  };

  const pipeline = () => {
    const x = state.budgetX;

    let list = OFFERS.slice()
      .map(normalizeOffer)
      .filter(isActive)
      .filter(isOperatorAllowed);

    // Operator
    if (state.operator !== "Tous") list = list.filter((o) => o.operator === state.operator);

    // Usage
    list = list.filter((o) => offerHasUsage(o, state.usage));

    // Validity
    list = list.filter((o) => offerMatchesValidity(o, state.validity));

    // Budget (après filtres, pour avoir une recherche libre possible)
    list = filterByBudget(list, x);

    const publicOffers = list.filter((o) => o.eligibility_type === "public");
    const specialOffers = list.filter((o) => o.eligibility_type !== "public");

    const scoredPublic = publicOffers
      .map((o) => ({ o, score: computeScore(o, state.usage) }))
      .filter((x) => Number.isFinite(x.score) && x.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o);

    const top1 = scoredPublic[0] || null;
    const top2 = scoredPublic[1] || null;

    const gainLabel = top1 && top2 ? computeGainLabel(top1, top2, state.usage) : null;

    return { list, publicOffers, specialOffers, scoredPublic, top1, gainLabel };
  };

  /* =========================
   * 5) RENDER
   * ========================= */
  const renderOfferCard = (o, { isTop = false } = {}) => {
    const badgeTop = isTop ? `<div class="pill pill-top">🏆 Recommandé</div>` : "";
    const badgeSource = `<div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>`;
    const badgePromo = o.est_promo ? `<div class="pill pill-warning">Promo</div>` : "";

    const usage = state.usage;
    let metaLine = "";
    if (usage === "appels") {
      metaLine = `📞 ${Number.isFinite(o.minutes) ? `${Math.round(o.minutes)} min` : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    } else {
      metaLine = `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    }

    const unit = formatUnitPrice(o, usage);
    const unitHtml = unit ? `<div class="offer-unit">💰 ${unit}</div>` : "";

    const ussdHtml = `
      <div class="ussd hidden" data-ussd-wrap="${o.offer_id}">
        <code>${o.ussd_code || "—"}</code>
      </div>
    `;

    const shareText = encodeURIComponent(`Doylu — ${o.operator} • ${o.name} • ${formatFcfa(o.price_fcfa)} • ${metaLine} • Code: ${o.ussd_code || "—"}`);
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
        ${unitHtml}
        <div class="offer-meta">${metaLine}</div>

        <div class="offer-actions secondary">
          <button class="btn btn-primary" data-action="reveal" data-id="${o.offer_id}">👁 Afficher le code</button>
        </div>

        ${ussdHtml}

        <div class="offer-actions">
          <button class="btn btn-light" data-action="copy" data-id="${o.offer_id}">📋 Copier</button>
          <a class="btn btn-secondary" href="${waHref}" target="_blank" rel="noopener noreferrer">🟢 WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderSpecialCard = (o) => {
    const map = {
      student: "🎓 Étudiant",
      corporate: "🔒 Sous conditions",
      special: "🔒 Sous conditions",
    };
    const label = map[o.eligibility_type] || "🔒 Sous conditions";

    const metaLine = `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;

    const shareText = encodeURIComponent(`Doylu — ${o.operator} • ${o.name} • ${formatFcfa(o.price_fcfa)} • ${metaLine}`);
    const waHref = `${CONFIG.WA_LINK}${shareText}`;

    return `
      <article class="offer-card" data-offer="${o.offer_id}">
        <div class="offer-head">
          <div class="offer-operator">
            <span class="pill">${o.operator?.[0] || "•"}</span>
            <span>${o.operator}</span>
          </div>
          <div class="offer-badges">
            <div class="pill pill-warning">${label}</div>
            <div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>
          </div>
        </div>

        <div class="offer-name">${safe(o.operator)} — ${safe(o.name)}</div>
        <div class="offer-price">${formatFcfa(o.price_fcfa)}</div>
        <div class="offer-meta">${metaLine}</div>

        <div class="muted" style="margin-top:8px;font-weight:800;">Peut nécessiter un justificatif selon l’opérateur.</div>

        <div class="offer-actions" style="grid-template-columns:1fr;">
          <a class="btn btn-secondary" href="${waHref}" target="_blank" rel="noopener noreferrer">🟢 Partager WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderBestBanner = ({ top1, gainLabel }) => {
    const banner = $("#bestBanner");
    if (!banner) return;

    if (!top1) {
      banner.classList.add("hidden");
      return;
    }

    const hasBudget = Number.isFinite(state.budgetX) && state.budgetX > 0;

    banner.classList.remove("hidden");
    $("#bestTitle").textContent = hasBudget
      ? `🔥 Meilleur choix pour ${formatFcfa(state.budgetX)}`
      : `🔥 Meilleur choix du moment`;

    $("#bestLine1").textContent = `${top1.operator} — ${top1.name}`;

    const unit = formatUnitPrice(top1, state.usage);
    const unitEl = $("#bestUnitPrice");
    if (unit && unitEl) {
      unitEl.textContent = `💰 ${unit}`;
      unitEl.classList.remove("hidden");
    } else if (unitEl) {
      unitEl.classList.add("hidden");
    }

    const gainEl = $("#bestGain");
    if (gainLabel && gainEl) {
      gainEl.textContent = gainLabel;
      gainEl.classList.remove("hidden");
    } else if (gainEl) {
      gainEl.classList.add("hidden");
    }

    const usageMeta =
      state.usage === "appels"
        ? `📞 ${Number.isFinite(top1.minutes) ? `${Math.round(top1.minutes)} min` : "—"}`
        : `📱 ${Number.isFinite(top1.data_mb) ? formatData(top1.data_mb) : "—"}`;

    const validityMeta = `⏱ ${Number.isFinite(top1.validity_days) ? `${top1.validity_days} jour(s)` : "Inconnu"}`;
    $("#bestMeta").textContent = `${usageMeta} • ${validityMeta} • ${formatFcfa(top1.price_fcfa)}`;
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
    const { list, specialOffers, scoredPublic, top1, gainLabel } = pipeline();

    // count
    const countEl = $("#offersCount");
    if (countEl) countEl.textContent = `${list.length} offre(s)`;

    // empty
    const empty = $("#noResults");
    if (empty) {
      if (!list.length) {
        empty.classList.remove("hidden");
        if (state.budgetX > 0) {
          empty.textContent = `Aucune offre proche pour ${formatFcfa(state.budgetX)}. Essaie un autre montant.`;
        } else {
          empty.textContent = `Aucune offre trouvée. Essaie de changer les filtres.`;
        }
      } else {
        empty.classList.add("hidden");
      }
    }

    renderBestBanner({ top1, gainLabel });

    // title
    const resultsTitle = $("#resultsTitle");
    if (resultsTitle) {
      if (state.budgetX > 0) resultsTitle.textContent = `${list.length} offre(s) trouvée(s) pour ${formatFcfa(state.budgetX)}`;
      else resultsTitle.textContent = `${list.length} offre(s) trouvée(s)`;
    }

    // main grid (public, trié)
    const grid = $("#offersGrid");
    if (grid) {
      const html = scoredPublic.map((o, idx) => renderOfferCard(o, { isTop: idx === 0 })).join("");
      grid.innerHTML = html || "";
    }

    // specials
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
   * 6) ROUTER
   * ========================= */
  const views = ["accueil", "promos", "ussd", "contact", "admin"];

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

    if (r === "admin") {
      // admin panel non prioritaire V1 — laissé stable
    }

    if (r === "accueil") renderResults();
    if (r === "promos") renderPromos();
  };

  const handleHash = () => {
    const h = (location.hash || "#accueil").replace("#", "").trim();
    showRoute(h);
  };

  /* =========================
   * 7) UI EVENTS
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
    // budget vide => 0 (recherche libre)
    const raw = String(x ?? "").trim();
    const budget = raw === "" ? 0 : Math.max(0, clampInt(raw, 0));

    state.budgetX = budget;
    $("#budgetInput").value = budget ? String(budget) : "";
    setActiveBudgetChips(budget);
    renderResults();
    $("#bestBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindEvents = () => {
    // menu
    $("#menuBtn")?.addEventListener("click", () => {
      const mobile = $("#mobileNav");
      const expanded = $("#menuBtn").getAttribute("aria-expanded") === "true";
      $("#menuBtn").setAttribute("aria-expanded", String(!expanded));
      mobile?.classList.toggle("hidden");
    });

    // nav click (close mobile)
    document.addEventListener("click", (e) => {
      const a = e.target.closest(".nav-link");
      if (!a) return;
      $("#mobileNav")?.classList.add("hidden");
      $("#menuBtn")?.setAttribute("aria-expanded", "false");
    });

    // budget submit
    $("#budgetSubmit")?.addEventListener("click", () => applyBudget($("#budgetInput").value));
    $("#budgetInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBudget($("#budgetInput").value);
    });

    // quick budgets
    $$(".chip-budget").forEach((btn) => {
      btn.addEventListener("click", () => applyBudget(btn.getAttribute("data-budget")));
    });

    // filter chips
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip-filter");
      if (!btn) return;

      const filter = btn.getAttribute("data-filter");
      const value = btn.getAttribute("data-value");

      if (filter === "usage") {
        state.usage = value;
        setActiveChips("usage", value);
        renderResults();
      }
      if (filter === "operator") {
        state.operator = value;
        setActiveChips("operator", value);
        renderResults();
      }
      if (filter === "validity") {
        state.validity = value;
        setActiveChips("validity", value);
        renderResults();
      }
      if (filter === "promoOperator") {
        state.promoOperator = value;
        setActiveChips("promoOperator", value);
        renderPromos();
      }
    });

    // how verify modal
    const verifyHtml = `
      <ul>
        <li>On collecte des offres reçues par SMS/USSD et des annonces publiques.</li>
        <li>On vérifie la cohérence (prix, volume, validité) et on retire les offres expirées.</li>
        <li>Les offres “sous conditions” restent visibles mais ne dominent jamais le Top.</li>
      </ul>
    `;
    $("#howVerifyBtn")?.addEventListener("click", () => openModal("Comment on vérifie ?", verifyHtml));
    $("#sourcesInfoBtn")?.addEventListener("click", () => openModal("Comment on vérifie ?", verifyHtml));

    // modal close
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modal")?.addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });

    // WhatsApp main button
    $("#waOpenBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const txt = encodeURIComponent("Je veux recevoir les bons plans Doylu sur WhatsApp 🙌");
      window.open(`${CONFIG.WA_LINK}${txt}`, "_blank", "noopener,noreferrer");
    });

    // Offer actions (reveal/copy)
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
      }
    });

    // contact dummy sends
    $("#contactSend")?.addEventListener("click", () => {
      $("#contactToast").textContent = "✅ Merci ! Message enregistré (V1).";
      setTimeout(() => ($("#contactToast").textContent = ""), 2000);
    });
    $("#smsSend")?.addEventListener("click", () => {
      $("#smsToast").textContent = "✅ Merci ! SMS enregistré (V1).";
      setTimeout(() => ($("#smsToast").textContent = ""), 2000);
    });
    $("#partnerBtn")?.addEventListener("click", () => {
      $("#partnerToast").textContent = "✅ OK. Ajoute un email/WA business plus tard.";
      setTimeout(() => ($("#partnerToast").textContent = ""), 2000);
    });
  };

  /* =========================
   * 8) INIT
   * ========================= */
  const init = () => {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    $("#lastUpdate").textContent = `MAJ : ${nowHHMM()}`;

    // default budget (affiché)
    $("#budgetInput").value = state.budgetX ? String(state.budgetX) : "";
    setActiveBudgetChips(state.budgetX);

    // default chips
    setActiveChips("usage", "data");
    setActiveChips("operator", "Tous");
    setActiveChips("validity", "Toutes");
    setActiveChips("promoOperator", "Tous");

    // mobile filters accordion: fermé par défaut
    const details = $("#filtersDetails");
    if (details && window.matchMedia("(max-width: 760px)").matches) {
      details.open = false;
    } else if (details) {
      details.open = true; // desktop open
    }

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
