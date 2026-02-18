/* Doylu V1 — script.js COMPLET (mobile optimisé)
   - Budget crédible: offres UNIQUEMENT dans [X ; X*1.2]
   - Filtres = bottom-sheet (slide-up) via bouton flottant
   - Reco compacte (3 lignes max)
   - Gain seulement si différence >= 15% (public only, comparable)
   - Affiche FCFA / Go (ou FCFA / min)
   - Type affiché: Public | Promo | Étudiant | Ciblée | Sous conditions
   - Admin: ajout/modif, liste, import/export JSON (localStorage)
*/

(() => {
  "use strict";

  /* =========================
   * 0) CONFIG
   * ========================= */
  const CONFIG = {
    operators: ["Orange", "Free", "Expresso"],
    validityMap: { "Toutes": null, "24h": 1, "7 jours": 7, "30 jours": 30 },
    adminPassword: "doylu2026",
    STORAGE_KEY: "doylu_offers_v1",
    WA_LINK: "https://wa.me/?text=",
    budgetTolerance: 1.2,   // X..X*1.2
    gainMinRatio: 0.15,     // >=15% sinon on n'affiche pas
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
      const rounded = Math.round(go * 10) / 10;
      const s = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
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

  const defaultOffers = () => ([
    { operator: "Orange", name: "Pass Jour 5Go", price_fcfa: 1000, type_usage: "data", data_mb: 5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass semaine 2Go", price_fcfa: 1000, type_usage: "data", data_mb: 2 * 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Promo 10Go (30 jours) exclusif OM", price_fcfa: 2000, type_usage: "data", data_mb: 10 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", est_promo: true, source_badge: "Source SMS", status: "active" },
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

  const saveOffers = (arr) => {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(arr));
    const lastUpdate = $("#lastUpdate");
    if (lastUpdate) lastUpdate.textContent = `Dernière MAJ : aujourd'hui ${nowHHMM()}`;
  };

  let OFFERS = loadOffers();

  /* =========================
   * 3) STATE
   * ========================= */
  const state = {
    route: "accueil",
    budgetX: 1000,
    usage: "data",
    operator: "Tous",
    validity: "Toutes",
    sort: "valeur",  // valeur|prix|volume|duree
    limit: 8,        // 8|16|0
    promoOperator: "Tous",
    isAdmin: false,
    editingId: null,
  };

  /* =========================
   * 4) FILTERS / PIPELINE
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

  const filterByBudgetWindow = (list, x) => {
    if (!Number.isFinite(x) || x <= 0) return [];
    const min = x;
    const max = Math.floor(x * CONFIG.budgetTolerance);
    return list.filter((o) => Number.isFinite(o.price_fcfa) && o.price_fcfa >= min && o.price_fcfa <= max);
  };

  const scoreFor = (o, usage) => {
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

  const metricForGain = (o, usage) => {
    if (!o) return null;
    if (usage === "appels") return Number.isFinite(o.minutes) ? o.minutes : null;
    if (usage === "mixte") {
      if (Number.isFinite(o.data_mb)) return o.data_mb;
      if (Number.isFinite(o.minutes)) return o.minutes;
      return null;
    }
    return Number.isFinite(o.data_mb) ? o.data_mb : null;
  };

  const formatGain = (delta, usage) => {
    if (!Number.isFinite(delta) || delta <= 0) return null;

    // delta in MB for data/mixte-data
    if (usage !== "appels") {
      if (delta < 1024) {
        const rounded = roundTo(delta, 50);
        return `+${Math.max(50, rounded)} Mo`;
      }
      const go = mbToGo(delta);
      const roundedGo = roundTo(go, 0.5);
      const s = roundedGo % 1 === 0 ? roundedGo.toFixed(0) : roundedGo.toFixed(1);
      return `+${s} Go`;
    }

    // delta in minutes
    return `+${Math.round(delta)} min`;
  };

  const computeGain = (top1, top2, usage) => {
    if (!top1 || !top2) return null;

    const m1 = metricForGain(top1, usage);
    const m2 = metricForGain(top2, usage);

    if (!Number.isFinite(m1) || !Number.isFinite(m2) || m2 <= 0) return null;

    const delta = m1 - m2;
    if (delta <= 0) return null;

    // ✅ 15% threshold
    const ratio = delta / m2;
    if (ratio < CONFIG.gainMinRatio) return null;

    const label = formatGain(delta, usage);
    if (!label) return null;

    return { label: `🔥 ${label}`, sub: "vs la 2e meilleure offre (publique)" };
  };

  const unitCostLabel = (o, usage) => {
    if (!o || !Number.isFinite(o.price_fcfa) || o.price_fcfa <= 0) return null;

    if (usage === "appels") {
      if (!Number.isFinite(o.minutes) || o.minutes <= 0) return null;
      const v = Math.round(o.price_fcfa / o.minutes);
      return `${v} FCFA / min`;
    }

    // data or mixte => prioritize data
    if (Number.isFinite(o.data_mb) && o.data_mb > 0) {
      const go = o.data_mb / 1024;
      if (go <= 0) return null;
      const v = Math.round(o.price_fcfa / go);
      return `${v} FCFA / Go`;
    }

    // fallback for mixte (minutes)
    if (usage === "mixte" && Number.isFinite(o.minutes) && o.minutes > 0) {
      const v = Math.round(o.price_fcfa / o.minutes);
      return `${v} FCFA / min`;
    }

    return null;
  };

  const typeBadge = (o) => {
    if (!o) return { text: "Public", cls: "pill-type" };

    // Promo overrides (still public in eligibility_type sometimes)
    if (o.est_promo) return { text: "Promo", cls: "pill-warning" };

    const map = {
      public: { text: "Public", cls: "pill-type" },
      student: { text: "Étudiant", cls: "pill-warning" },
      corporate: { text: "Ciblée", cls: "pill-warning" },
      special: { text: "Sous conditions", cls: "pill-warning" },
    };
    return map[o.eligibility_type] || { text: "Public", cls: "pill-type" };
  };

  const sortOffers = (arr) => {
    const usage = state.usage;
    const byPrice = (a, b) => (a.price_fcfa ?? 0) - (b.price_fcfa ?? 0);
    const byDuration = (a, b) => (b.validity_days ?? -1) - (a.validity_days ?? -1);
    const byVolume = (a, b) => {
      const va =
        usage === "appels" ? (a.minutes ?? -1) :
        usage === "mixte" ? (Number.isFinite(a.data_mb) ? a.data_mb : (a.minutes ?? -1)) :
        (a.data_mb ?? -1);

      const vb =
        usage === "appels" ? (b.minutes ?? -1) :
        usage === "mixte" ? (Number.isFinite(b.data_mb) ? b.data_mb : (b.minutes ?? -1)) :
        (b.data_mb ?? -1);

      return vb - va;
    };
    const byValue = (a, b) => scoreFor(b, usage) - scoreFor(a, usage);

    if (state.sort === "prix") return arr.slice().sort(byPrice);
    if (state.sort === "volume") return arr.slice().sort(byVolume);
    if (state.sort === "duree") return arr.slice().sort(byDuration);
    return arr.slice().sort(byValue);
  };

  const pipeline = () => {
    const x = state.budgetX;

    let list = OFFERS.slice()
      .map(normalizeOffer)
      .filter(isActive)
      .filter(isOperatorAllowed);

    // 1) budget window
    list = filterByBudgetWindow(list, x);

    // 2) operator
    if (state.operator !== "Tous") list = list.filter((o) => o.operator === state.operator);

    // 3) usage
    list = list.filter((o) => offerHasUsage(o, state.usage));

    // 4) validity
    list = list.filter((o) => offerMatchesValidity(o, state.validity));

    const publicOffers = list.filter((o) => o.eligibility_type === "public");
    const specialOffers = list.filter((o) => o.eligibility_type !== "public");

    const sortedPublic = sortOffers(publicOffers);

    // gain based on value ranking
    const scored = publicOffers
      .map((o) => ({ o, score: scoreFor(o, state.usage) }))
      .filter((x) => Number.isFinite(x.score) && x.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o);

    const top1 = scored[0] || null;
    const top2 = scored[1] || null;
    const gain = top1 && top2 ? computeGain(top1, top2, state.usage) : null;

    return { list, publicOffers, specialOffers, sortedPublic, top1, gain };
  };

  /* =========================
   * 5) RENDER
   * ========================= */
  const renderOfferCard = (o, { isTop = false } = {}) => {
    const topBadge = isTop ? `<div class="pill pill-top">🏆 Meilleur</div>` : "";
    const srcBadge = `<div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>`;
    const t = typeBadge(o);
    const typePill = `<div class="pill ${t.cls}">${t.text}</div>`;

    const usage = state.usage;
    let metaLine = "";
    if (usage === "appels") {
      metaLine = `📞 ${Number.isFinite(o.minutes) ? `${Math.round(o.minutes)} min` : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    } else if (usage === "mixte") {
      const parts = [];
      if (Number.isFinite(o.data_mb)) parts.push(`📱 ${formatData(o.data_mb)}`);
      if (Number.isFinite(o.minutes)) parts.push(`📞 ${Math.round(o.minutes)} min`);
      metaLine = `${parts.join(" • ") || "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    } else {
      metaLine = `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    }

    const unit = unitCostLabel(o, usage);
    const unitHtml = unit ? `<div class="offer-unit">⚖️ ${unit}</div>` : "";

    const ussdHtml = `
      <div class="ussd hidden" data-ussd-wrap="${o.offer_id}">
        <code>${o.ussd_code ? o.ussd_code : "—"}</code>
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
            ${topBadge}
            ${typePill}
            ${srcBadge}
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
    const t = typeBadge(o);
    const label = t.text;

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

        <div class="muted" style="margin-top:8px;font-weight:850;">Peut nécessiter un justificatif selon l’opérateur.</div>

        <div class="offer-actions" style="grid-template-columns:1fr;">
          <a class="btn btn-secondary" href="${waHref}" target="_blank" rel="noopener noreferrer">🟢 Partager WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderBestBanner = ({ list, top1, gain }) => {
    const banner = $("#bestBanner");
    const bestTitle = $("#bestTitle");
    const bestGain = $("#bestGain");
    const bestSub = $("#bestSub");
    const bestMeta = $("#bestMeta");

    if (!banner) return;

    if (!top1 || !list.length) {
      banner.classList.add("hidden");
      return;
    }

    banner.classList.remove("hidden");
    bestTitle.textContent = `🔥 Meilleure option pour ${formatFcfa(state.budgetX)}`;

    if (gain?.label) {
      bestGain.textContent = gain.label;
      bestGain.classList.remove("hidden");
      bestSub.textContent = gain.sub || "";
      bestSub.classList.remove("hidden");
    } else {
      bestGain.classList.add("hidden");
      bestSub.classList.add("hidden");
    }

    // ✅ 3 lignes max
    const unit = unitCostLabel(top1, state.usage);
    const line1 = `🏆 ${top1.operator} — ${top1.name}`;
    const line2 = unit ? `⚖️ ${unit}` : "";
    const max = Math.floor(state.budgetX * CONFIG.budgetTolerance);
    const line3 = `📌 Offres entre ${formatFcfa(state.budgetX)} et ${formatFcfa(max)}`;

    const lines = [line1, line2, line3].filter(Boolean).slice(0, 3);
    bestMeta.innerHTML = lines.map((s) => `<div>${s}</div>`).join("");
  };

  const renderResults = () => {
    const { list, specialOffers, sortedPublic, top1, gain } = pipeline();

    const countEl = $("#offersCount");
    if (countEl) countEl.textContent = `${list.length} offre(s)`;

    const empty = $("#noResults");
    if (empty) {
      if (!list.length) {
        const max = Math.floor(state.budgetX * CONFIG.budgetTolerance);
        empty.classList.remove("hidden");
        empty.textContent = `Aucune offre entre ${formatFcfa(state.budgetX)} et ${formatFcfa(max)}. Essaie un autre montant.`;
      } else {
        empty.classList.add("hidden");
      }
    }

    renderBestBanner({ list, top1, gain });

    const resultsTitle = $("#resultsTitle");
    if (resultsTitle) {
      if (!list.length) resultsTitle.textContent = `Résultats`;
      else {
        const max = Math.floor(state.budgetX * CONFIG.budgetTolerance);
        resultsTitle.textContent = `Résultats : ${list.length} offre(s) entre ${formatFcfa(state.budgetX)} et ${formatFcfa(max)}`;
      }
    }

    const grid = $("#offersGrid");
    if (grid) {
      const limited =
        state.limit && Number(state.limit) > 0 ? sortedPublic.slice(0, Number(state.limit)) : sortedPublic;

      grid.innerHTML = limited
        .map((o, idx) => renderOfferCard(o, { isTop: idx === 0 }))
        .join("");
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

    if (r === "admin") renderAdmin();
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
  const setActiveBudgetChips = (budget) => {
    $$(".chip-budget").forEach((btn) => {
      btn.classList.toggle("is-active", clampInt(btn.getAttribute("data-budget"), 0) === budget);
    });
  };

  const applyBudget = (x) => {
    const budget = Math.max(0, clampInt(x, 0));
    if (!budget) return;

    state.budgetX = budget;
    $("#budgetInput").value = String(budget);
    setActiveBudgetChips(budget);
    renderResults();
    $("#bestBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindFilters = () => {
    const usage = $("#usageSelect");
    const op = $("#operatorSelect");
    const val = $("#validitySelect");
    const sort = $("#sortSelect");
    const lim = $("#limitSelect");
    const promoOp = $("#promoOperatorSelect");

    if (usage) usage.value = state.usage;
    if (op) op.value = state.operator;
    if (val) val.value = state.validity;
    if (sort) sort.value = state.sort;
    if (lim) lim.value = String(state.limit);

    if (promoOp) {
      promoOp.value = state.promoOperator;
      promoOp.addEventListener("change", () => {
        state.promoOperator = promoOp.value;
        renderPromos();
      });
    }
  };

  const openSheet = () => {
    $("#filtersSheet")?.classList.remove("hidden");
    $("#sheetBackdrop")?.classList.remove("hidden");
    $("#filtersFab")?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeSheet = () => {
    $("#filtersSheet")?.classList.add("hidden");
    $("#sheetBackdrop")?.classList.add("hidden");
    $("#filtersFab")?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  const applySheet = () => {
    const usage = $("#usageSelect")?.value || state.usage;
    const op = $("#operatorSelect")?.value || state.operator;
    const val = $("#validitySelect")?.value || state.validity;
    const sort = $("#sortSelect")?.value || state.sort;
    const lim = Number($("#limitSelect")?.value ?? state.limit);

    state.usage = usage;
    state.operator = op;
    state.validity = val;
    state.sort = sort;
    state.limit = Number.isFinite(lim) ? lim : state.limit;

    renderResults();
    closeSheet();
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

    // budget
    $("#budgetSubmit")?.addEventListener("click", () => applyBudget($("#budgetInput").value));
    $("#budgetInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBudget($("#budgetInput").value);
    });

    $$(".chip-budget").forEach((btn) => {
      btn.addEventListener("click", () => applyBudget(btn.getAttribute("data-budget")));
    });

    // sheet
    $("#filtersFab")?.addEventListener("click", openSheet);
    $("#sheetClose")?.addEventListener("click", closeSheet);
    $("#sheetBackdrop")?.addEventListener("click", closeSheet);
    $("#applyFiltersBtn")?.addEventListener("click", applySheet);

    // how verify
    const verifyHtml = `
      <ul>
        <li>On collecte des offres reçues par SMS/USSD et des annonces publiques.</li>
        <li>On vérifie la cohérence (prix, volume, validité) et on retire les offres expirées.</li>
        <li>Les offres sous conditions restent visibles mais ne dominent pas le Top.</li>
      </ul>
    `;
    $("#howVerifyBtn")?.addEventListener("click", () => openModal("Comment on vérifie ?", verifyHtml));
    $("#sourcesInfoBtn")?.addEventListener("click", () => openModal("Comment on vérifie ?", verifyHtml));

    // modal close
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modal")?.addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });

    // WhatsApp
    $("#waOpenBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const txt = encodeURIComponent("Je veux recevoir les bons plans Doylu sur WhatsApp 🙌");
      window.open(`${CONFIG.WA_LINK}${txt}`, "_blank", "noopener,noreferrer");
    });

    // actions offer
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

    // contact dummy
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

    // admin login
    $("#adminLogin")?.addEventListener("click", () => {
      const pass = $("#adminPass")?.value || "";
      if (pass === CONFIG.adminPassword) {
        state.isAdmin = true;
        $("#adminGateMsg").textContent = "";
        renderAdmin();
      } else {
        $("#adminGateMsg").textContent = "Mot de passe incorrect.";
      }
    });
  };

  /* =========================
   * 8) ADMIN (inchangé)
   * ========================= */
  const renderAdmin = () => {
    const gate = $("#adminGate");
    const panel = $("#adminPanel");
    if (!gate || !panel) return;

    gate.classList.toggle("hidden", state.isAdmin);
    panel.classList.toggle("hidden", !state.isAdmin);

    if (!state.isAdmin) return;

    const saveBtn = $("#aSave");
    const resetBtn = $("#aReset");
    const exportBtn = $("#exportJson");
    const importFile = $("#importFile");

    const rebind = (el, handler) => {
      if (!el) return;
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      newEl.addEventListener("click", handler);
      return newEl;
    };

    rebind(saveBtn, () => {
      const o = {
        offer_id: state.editingId || undefined,
        operator: $("#aOperator").value,
        name: $("#aName").value,
        price_fcfa: clampInt($("#aPrice").value, 0),
        type_usage: $("#aUsage").value,
        data_mb: $("#aDataMb").value === "" ? null : Number($("#aDataMb").value),
        minutes: $("#aMinutes").value === "" ? null : Number($("#aMinutes").value),
        validity_days: $("#aValidityDays").value === "" ? null : Number($("#aValidityDays").value),
        ussd_code: $("#aUssd").value,
        eligibility_type: $("#aEligibility").value,
        source_badge: $("#aSourceBadge").value,
        est_promo: $("#aPromo").checked,
        status: "active",
      };

      const no = normalizeOffer(o);
      const idx = OFFERS.findIndex((x) => x.offer_id === no.offer_id);

      if (idx >= 0) OFFERS[idx] = no;
      else OFFERS.unshift(no);

      saveOffers(OFFERS);
      $("#adminToast").textContent = "✅ Enregistré.";
      setTimeout(() => ($("#adminToast").textContent = ""), 1500);
      state.editingId = null;
      resetAdminForm();
      renderAdminList();
      renderResults();
    });

    rebind(resetBtn, () => {
      state.editingId = null;
      resetAdminForm();
      $("#adminToast").textContent = "Réinitialisé.";
      setTimeout(() => ($("#adminToast").textContent = ""), 1200);
    });

    rebind(exportBtn, () => {
      const blob = new Blob([JSON.stringify(OFFERS, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "doylu_offers.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    if (importFile) {
      importFile.onchange = async () => {
        const file = importFile.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const arr = JSON.parse(text);
          if (!Array.isArray(arr)) throw new Error("JSON invalide");
          OFFERS = arr.map(normalizeOffer);
          saveOffers(OFFERS);
          $("#importMsg").textContent = "✅ Import OK.";
          setTimeout(() => ($("#importMsg").textContent = ""), 1800);
          renderAdminList();
          renderResults();
        } catch {
          $("#importMsg").textContent = "❌ Import impossible (JSON invalide).";
          setTimeout(() => ($("#importMsg").textContent = ""), 2200);
        } finally {
          importFile.value = "";
        }
      };
    }

    resetAdminForm(false);
    renderAdminList();
  };

  const resetAdminForm = (clearToast = true) => {
    $("#aOperator").value = "Orange";
    $("#aName").value = "";
    $("#aPrice").value = "";
    $("#aUsage").value = "data";
    $("#aDataMb").value = "";
    $("#aMinutes").value = "";
    $("#aValidityDays").value = "";
    $("#aUssd").value = "#1234#";
    $("#aEligibility").value = "public";
    $("#aSourceBadge").value = "Source SMS";
    $("#aPromo").checked = false;
    if (clearToast) $("#adminToast").textContent = "";
  };

  const renderAdminList = () => {
    const list = $("#adminList");
    if (!list) return;

    const items = OFFERS.map(normalizeOffer)
      .filter(isOperatorAllowed)
      .sort((a, b) => (a.operator + a.name).localeCompare(b.operator + b.name));

    list.innerHTML = items
      .map((o) => {
        const meta = `${o.type_usage} • ${formatFcfa(o.price_fcfa)} • ${o.eligibility_type}`;
        return `
          <div class="admin-item" data-admin-offer="${o.offer_id}">
            <strong>${o.operator} — ${o.name}</strong>
            <div class="muted">${meta}</div>
            <div class="row">
              <button class="btn btn-light" data-admin-action="edit" data-id="${o.offer_id}">Modifier</button>
              <button class="btn btn-light" data-admin-action="delete" data-id="${o.offer_id}">Supprimer</button>
            </div>
          </div>
        `;
      })
      .join("");

    list.onclick = (e) => {
      const b = e.target.closest("[data-admin-action]");
      if (!b) return;
      const action = b.getAttribute("data-admin-action");
      const id = b.getAttribute("data-id");
      const o = OFFERS.find((x) => x.offer_id === id);
      if (!o) return;

      if (action === "delete") {
        OFFERS = OFFERS.filter((x) => x.offer_id !== id);
        saveOffers(OFFERS);
        renderAdminList();
        renderResults();
        toast("Supprimé");
      }

      if (action === "edit") {
        state.editingId = id;
        $("#aOperator").value = o.operator;
        $("#aName").value = o.name;
        $("#aPrice").value = o.price_fcfa;
        $("#aUsage").value = o.type_usage;
        $("#aDataMb").value = o.data_mb ?? "";
        $("#aMinutes").value = o.minutes ?? "";
        $("#aValidityDays").value = o.validity_days ?? "";
        $("#aUssd").value = o.ussd_code ?? "";
        $("#aEligibility").value = o.eligibility_type ?? "public";
        $("#aSourceBadge").value = o.source_badge ?? "Source SMS";
        $("#aPromo").checked = Boolean(o.est_promo);
        $("#adminToast").textContent = "✏️ Mode édition";
      }
    };
  };

  /* =========================
   * 9) INIT
   * ========================= */
  const init = () => {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    $("#lastUpdate").textContent = `Dernière MAJ : aujourd'hui ${nowHHMM()}`;

    $("#budgetInput").value = String(state.budgetX);
    setActiveBudgetChips(state.budgetX);

    // default selects
    bindFilters();

    // promos select
    $("#promoOperatorSelect")?.addEventListener("change", () => {
      state.promoOperator = $("#promoOperatorSelect").value;
      renderPromos();
    });

    // keep sheet hidden by default
    closeSheet();

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
