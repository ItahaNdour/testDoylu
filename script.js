/* Doylu V1 — script.js COMPLET (stable + Firebase tracking)
   - Navigation hash (#accueil/#promos/#ussd/#contact/#admin)
   - Budget "proche" (exact → 0.8X..X → 0.7X..X)
   - ✅ Si budget vide/0 => pas de filtre budget (affiche tout)
   - Filtres: usage, opérateur, validité
   - Top + gain dynamiques (uniquement offres public)
   - Offres sous conditions séparées
   - Admin: ajout/modif, liste, import/export JSON (localStorage)
   - ✅ Firebase (Firestore):
       - offer_events: log reveal/copy/share
       - offer_stats: compteurs reveal/copy/share par offer_id
       - Admin: tableau stats (offer_stats)
*/

(() => {
  "use strict";

  /* =========================
   * 0) CONFIG
   * ========================= */
  const CONFIG = {
    operators: ["Orange", "Free", "Expresso"],
    validityMap: { "Toutes": null, "24h": 1, "7 jours": 7, "30 jours": 30 },
    budgetBands: [
      { low: 1.0, high: 1.0 }, // exact
      { low: 0.8, high: 1.0 },
      { low: 0.7, high: 1.0 },
    ],
    adminPassword: "doylu2026",
    STORAGE_KEY: "doylu_offers_v1",
    WA_LINK: "https://wa.me/?text=",

    // ✅ Firebase config (ton config)
    FIREBASE: {
      enabled: true,
      firebaseConfig: {
        apiKey: "AIzaSyByiREEaHhhY9s9HI6uho6K0wat-PgrVCI",
        authDomain: "doylu-69ed8.firebaseapp.com",
        projectId: "doylu-69ed8",
        storageBucket: "doylu-69ed8.firebasestorage.app",
        messagingSenderId: "15959760370",
        appId: "1:15959760370:web:dd7bd5aebb1fe81016df6b",
      },
      collections: {
        events: "offer_events",
        stats: "offer_stats",
      },
    },

    // ton site (juste pour mettre le nom/lien dans le partage)
    BRAND_URL: "https://itahandour.github.io",
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
   * 2) FIREBASE (SAFE INIT)
   * ========================= */
  let FB = { enabled: false, db: null, FieldValue: null };

  const initFirebase = () => {
    try {
      if (!CONFIG.FIREBASE.enabled) return;
      if (!window.firebase?.initializeApp) return;

      if (!firebase.apps?.length) firebase.initializeApp(CONFIG.FIREBASE.firebaseConfig);
      const db = firebase.firestore();

      FB = {
        enabled: true,
        db,
        FieldValue: firebase.firestore.FieldValue,
      };
    } catch (e) {
      // si firebase est mal chargé => on désactive pour ne pas casser le site
      FB = { enabled: false, db: null, FieldValue: null };
    }
  };

  const logOfferEvent = async (type, offer) => {
    if (!FB.enabled || !FB.db) return;

    try {
      const payload = {
        offer_id: offer.offer_id,
        operator: offer.operator,
        name: offer.name,
        price_fcfa: offer.price_fcfa,
        usage: state.usage,
        page: `#${state.route}`,
        type,
        ts: FB.FieldValue.serverTimestamp(),
      };
      await FB.db.collection(CONFIG.FIREBASE.collections.events).add(payload);
    } catch {
      // silent
    }
  };

  const incOfferStat = async (offer, field) => {
    if (!FB.enabled || !FB.db) return;

    try {
      const ref = FB.db.collection(CONFIG.FIREBASE.collections.stats).doc(offer.offer_id);
      await FB.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          tx.set(ref, {
            offer_id: offer.offer_id,
            operator: offer.operator,
            name: offer.name,
            price_fcfa: offer.price_fcfa,
            reveals: 0,
            copies: 0,
            shares: 0,
            updated_at: FB.FieldValue.serverTimestamp(),
            [field]: 1,
          }, { merge: true });
        } else {
          tx.set(ref, {
            operator: offer.operator,
            name: offer.name,
            price_fcfa: offer.price_fcfa,
            updated_at: FB.FieldValue.serverTimestamp(),
            [field]: FB.FieldValue.increment(1),
          }, { merge: true });
        }
      });
    } catch {
      // silent
    }
  };

  const fetchStatsForAdmin = async () => {
    const wrap = $("#statsTable");
    const msg = $("#statsMsg");
    if (!wrap || !msg) return;

    if (!FB.enabled) {
      msg.textContent = "Firebase non activé (ou scripts non chargés).";
      wrap.innerHTML = "";
      return;
    }

    msg.textContent = "Chargement…";
    try {
      const q = await FB.db
        .collection(CONFIG.FIREBASE.collections.stats)
        .orderBy("updated_at", "desc")
        .limit(50)
        .get();

      const rows = q.docs.map((d) => d.data());

      if (!rows.length) {
        wrap.innerHTML = "";
        msg.textContent = "Aucune stat pour l’instant.";
        return;
      }

      const head = `
        <div class="st-head">
          <div>Offre</div>
          <div>Opérateur</div>
          <div>👁 Reveals</div>
          <div>📋 Copies</div>
          <div>🟢 Shares</div>
        </div>
      `;

      const body = rows.map((r) => `
        <div class="st-row">
          <div>
            <div style="font-weight:1000">${safe(r.name || "—")}</div>
            <div class="st-muted">${safe(r.price_fcfa != null ? formatFcfa(r.price_fcfa) : "")}</div>
          </div>
          <div>${safe(r.operator || "—")}</div>
          <div>${Number(r.reveals || 0)}</div>
          <div>${Number(r.copies || 0)}</div>
          <div>${Number(r.shares || 0)}</div>
        </div>
      `).join("");

      wrap.innerHTML = head + body;
      msg.textContent = `OK — ${rows.length} ligne(s)`;
    } catch {
      wrap.innerHTML = "";
      msg.textContent = "Erreur de lecture des stats (vérifie les rules Firestore / index).";
    }
  };

  /* =========================
   * 3) OFFERS STORAGE
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
    { operator: "Orange", name: "Pass USSD 3,5Go (24h)", price_fcfa: 700, type_usage: "data", data_mb: 3.5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Jour 300Mo", price_fcfa: 200, type_usage: "data", data_mb: 300, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Jour 1,5Go", price_fcfa: 500, type_usage: "data", data_mb: 1536, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Jour 5Go", price_fcfa: 1000, type_usage: "data", data_mb: 5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Nuit 5Go (23h-6h)", price_fcfa: 500, type_usage: "data", data_mb: 5 * 1024, validity_days: 1, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass semaine 600Mo", price_fcfa: 500, type_usage: "data", data_mb: 600, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass semaine 2Go", price_fcfa: 1000, type_usage: "data", data_mb: 2 * 1024, validity_days: 7, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Mois 12Go", price_fcfa: 3000, type_usage: "data", data_mb: 12 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
    { operator: "Orange", name: "Pass Mois 25Go", price_fcfa: 5000, type_usage: "data", data_mb: 25 * 1024, validity_days: 30, ussd_code: "#1234#", eligibility_type: "public", source_badge: "Source SMS", status: "active" },
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
   * 4) STATE
   * ========================= */
  const state = {
    route: "accueil",
    budgetX: 1000,        // null => pas de filtre budget
    usage: "data",
    operator: "Tous",
    validity: "Toutes",
    promoOperator: "Tous",
    isAdmin: false,
    editingId: null,
  };

  /* =========================
   * 5) PIPELINE
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

  const filterByBudgetBand = (list, x) => {
    const exact = list.filter((o) => o.price_fcfa === x);
    if (exact.length) return exact;

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
    if (!Number.isFinite(o.data_mb)) return -Infinity;
    return o.data_mb / o.price_fcfa;
  };

  const formatGainData = (gainMb) => {
    if (!Number.isFinite(gainMb) || gainMb <= 0) return null;
    if (gainMb < 1024) {
      const rounded = roundTo(gainMb, 50);
      return `🔥 Tu as +${Math.max(50, rounded)} Mo`;
    }
    const gainGo = mbToGo(gainMb);
    const roundedGo = roundTo(gainGo, 0.5);
    const str = roundedGo % 1 === 0 ? roundedGo.toFixed(0) : roundedGo.toFixed(1);
    return `🔥 Tu as +${str} Go`;
  };

  const formatGainMinutes = (gainMin) => {
    if (!Number.isFinite(gainMin) || gainMin <= 0) return null;
    return `🔥 Tu as +${Math.round(gainMin)} min`;
  };

  const computeGain = (top1, top2, usage) => {
    if (!top1 || !top2) return null;

    if (usage === "appels") {
      if (!Number.isFinite(top1.minutes) || !Number.isFinite(top2.minutes)) return null;
      const label = formatGainMinutes(top1.minutes - top2.minutes);
      if (!label) return null;
      return { label, sub: "" };
    }

    if (usage === "mixte") {
      if (Number.isFinite(top1.data_mb) && Number.isFinite(top2.data_mb)) {
        const label = formatGainData(top1.data_mb - top2.data_mb);
        if (!label) return null;
        return { label, sub: "" };
      }
      if (Number.isFinite(top1.minutes) && Number.isFinite(top2.minutes)) {
        const label = formatGainMinutes(top1.minutes - top2.minutes);
        if (!label) return null;
        return { label, sub: "" };
      }
      return null;
    }

    if (!Number.isFinite(top1.data_mb) || !Number.isFinite(top2.data_mb)) return null;
    const label = formatGainData(top1.data_mb - top2.data_mb);
    if (!label) return null;
    return { label, sub: "" };
  };

  const pipeline = () => {
    const x = state.budgetX;

    let list = OFFERS.slice()
      .map(normalizeOffer)
      .filter(isActive)
      .filter(isOperatorAllowed);

    // ✅ 1) Budget: si budget null/0 => on ne filtre pas
    if (Number.isFinite(x) && x > 0) {
      list = filterByBudgetBand(list, x);
      if (!list.length) {
        return { list: [], publicOffers: [], specialOffers: [], scoredPublic: [], top1: null, top2: null, gain: null };
      }
    }

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

  /* =========================
   * 6) RENDER
   * ========================= */
  const renderOfferCard = (o, { isTop = false } = {}) => {
    const badgeTop = isTop ? `<div class="pill pill-top">🏆 TOP CHOIX</div>` : "";
    const badgeSource = `<div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>`;
    const badgePromo = o.est_promo ? `<div class="pill pill-warning">Promo</div>` : "";

    const usage = state.usage;
    let metaLine = "";
    if (usage === "appels") {
      metaLine = `📞 ${Number.isFinite(o.minutes) ? `${Math.round(o.minutes)} min` : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    } else {
      metaLine = `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;
    }

    const ussdHtml = o.ussd_code
      ? `<div class="ussd hidden" data-ussd-wrap="${o.offer_id}"><code>${o.ussd_code}</code></div>`
      : `<div class="ussd hidden" data-ussd-wrap="${o.offer_id}"><code>—</code></div>`;

    // ✅ WhatsApp share text inclut la marque + lien
    const shareText = encodeURIComponent(
      `Doylu • ${o.operator} — ${o.name} • ${formatFcfa(o.price_fcfa)} • ${metaLine} • Code: ${o.ussd_code || "—"}\n` +
      `👉 Via Doylu : ${CONFIG.BRAND_URL}`
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

        <div class="offer-actions secondary">
          <button class="btn btn-primary" data-action="reveal" data-id="${o.offer_id}">👁 Afficher le code</button>
        </div>

        ${ussdHtml}

        <div class="offer-actions">
          <button class="btn btn-light" data-action="copy" data-id="${o.offer_id}">📋 Copier</button>
          <a class="btn btn-secondary" href="${waHref}" target="_blank" rel="noopener noreferrer"
             data-action="share" data-id="${o.offer_id}">🟢 WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderSpecialCard = (o) => {
    const map = {
      student: "🎓 Réservé aux étudiants",
      corporate: "🔒 Sous conditions opérateur",
      special: "🔒 Sous conditions",
    };
    const label = map[o.eligibility_type] || "🔒 Sous conditions";
    const metaLine = `📱 ${Number.isFinite(o.data_mb) ? formatData(o.data_mb) : "—"} • ⏱ ${Number.isFinite(o.validity_days) ? `${o.validity_days} jour(s)` : "Inconnu"}`;

    const shareText = encodeURIComponent(
      `Doylu • ${o.operator} — ${o.name} • ${formatFcfa(o.price_fcfa)} • ${metaLine}\n` +
      `👉 Via Doylu : ${CONFIG.BRAND_URL}`
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
            <div class="pill pill-warning">${label}</div>
            <div class="pill pill-info">${safe(o.source_badge || "Source SMS")}</div>
          </div>
        </div>

        <div class="offer-name">${safe(o.operator)} — ${safe(o.name)}</div>
        <div class="offer-price">${formatFcfa(o.price_fcfa)}</div>
        <div class="offer-meta">${metaLine}</div>

        <div class="muted" style="margin-top:8px;font-weight:800;">Peut nécessiter un justificatif selon l’opérateur.</div>

        <div class="offer-actions" style="grid-template-columns:1fr;">
          <a class="btn btn-secondary" href="${waHref}" target="_blank" rel="noopener noreferrer"
             data-action="share" data-id="${o.offer_id}">🟢 Partager WhatsApp</a>
        </div>
      </article>
    `;
  };

  const renderBestBanner = ({ top1, gain, list }) => {
    const banner = $("#bestBanner");
    const bestTitle = $("#bestTitle");
    const bestGain = $("#bestGain");
    const bestSub = $("#bestSub");
    const bestMeta = $("#bestMeta");
    const bestReco = $("#bestReco");
    if (!banner) return;

    if (!top1) {
      banner.classList.add("hidden");
      return;
    }

    banner.classList.remove("hidden");

    // ✅ titre: si pas de budget => "Meilleur choix du moment"
    if (Number.isFinite(state.budgetX) && state.budgetX > 0) {
      bestTitle.textContent = `🔥 Meilleur choix pour ${formatFcfa(state.budgetX)} (${state.usage})`;
      bestReco.textContent = `✅ Basé sur ton budget et ton usage`;
    } else {
      bestTitle.textContent = `🔥 Meilleur choix du moment (${state.usage})`;
      bestReco.textContent = `✅ Basé sur ton usage et tes filtres`;
    }

    if (gain?.label) {
      bestGain.textContent = gain.label;
      bestGain.classList.remove("hidden");
      bestSub.textContent = "";
      bestSub.classList.add("hidden");
    } else {
      bestGain.classList.add("hidden");
      bestSub.classList.add("hidden");
    }

    const usageMeta =
      state.usage === "appels"
        ? `📞 ${Number.isFinite(top1.minutes) ? `${Math.round(top1.minutes)} min` : "—"}`
        : `📱 ${Number.isFinite(top1.data_mb) ? formatData(top1.data_mb) : "—"}`;

    const validityMeta = `⏱ ${Number.isFinite(top1.validity_days) ? `${top1.validity_days} jour(s)` : "Inconnu"}`;
    bestMeta.textContent = `${top1.operator} — ${top1.name} • ${usageMeta} • ${validityMeta} • ${formatFcfa(top1.price_fcfa)} • ${list.length} offre(s)`;
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
        if (Number.isFinite(state.budgetX) && state.budgetX > 0) {
          empty.textContent = `Aucune offre proche pour ${formatFcfa(state.budgetX)}. Essaie un autre montant.`;
        } else {
          empty.textContent = `Aucune offre trouvée avec ces filtres.`;
        }
      } else {
        empty.classList.add("hidden");
      }
    }

    renderBestBanner({ top1, gain, list });

    const resultsTitle = $("#resultsTitle");
    if (resultsTitle) {
      if (Number.isFinite(state.budgetX) && state.budgetX > 0) {
        resultsTitle.textContent = `${list.length} offre(s) trouvée(s)`;
      } else {
        resultsTitle.textContent = `${list.length} offre(s) trouvée(s) (sans budget)`;
      }
    }

    const grid = $("#offersGrid");
    if (grid) {
      const html = scoredPublic.map((o, idx) => renderOfferCard(o, { isTop: idx === 0 })).join("");
      grid.innerHTML = html || "";
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
   * 7) ROUTER
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
   * 8) UI EVENTS
   * ========================= */
  const setActiveChips = (filter, value) => {
    $$(`.chip-filter[data-filter="${filter}"]`).forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-value") === value);
    });
  };

  const setActiveBudgetChips = (budget) => {
    $$(".chip-budget").forEach((btn) => {
      btn.classList.toggle("is-active", clampInt(btn.getAttribute("data-budget"), 0) === (budget ?? 0));
    });
  };

  const applyBudget = (x) => {
    const raw = String(x ?? "").trim();
    const budget = clampInt(raw, 0);

    // ✅ budget vide => null => pas de filtre
    if (!raw || budget <= 0) {
      state.budgetX = null;
      $("#budgetInput").value = "";
      setActiveBudgetChips(0);
      renderResults();
      $("#bestBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    state.budgetX = budget;
    $("#budgetInput").value = String(budget);
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

    $$(".chip-budget").forEach((btn) => {
      btn.addEventListener("click", () => applyBudget(btn.getAttribute("data-budget")));
    });

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
      const txt = encodeURIComponent("Je veux recevoir les bons plans Doylu sur WhatsApp 🙌");
      window.open(`${CONFIG.WA_LINK}${txt}`, "_blank", "noopener,noreferrer");
    });

    // ✅ Offer actions: reveal/copy/share (tracking Firestore)
    document.addEventListener("click", async (e) => {
      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-action");
      const id = actionEl.getAttribute("data-id");
      if (!id) return;

      const offer = OFFERS.map(normalizeOffer).find((o) => o.offer_id === id);
      if (!offer) return;

      if (action === "reveal") {
        const wrap = document.querySelector(`[data-ussd-wrap="${id}"]`);
        if (wrap) wrap.classList.toggle("hidden");

        logOfferEvent("reveal_code", offer);
        incOfferStat(offer, "reveals");
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

        logOfferEvent("copy_code", offer);
        incOfferStat(offer, "copies");
      }

      if (action === "share") {
        // pas de preventDefault => WhatsApp s’ouvre normalement
        logOfferEvent("share_whatsapp", offer);
        incOfferStat(offer, "shares");
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
      $("#partnerToast").textContent = "✅ OK. Ajoute un email/WA business plus tard.";
      setTimeout(() => ($("#partnerToast").textContent = ""), 2000);
    });

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
   * 9) ADMIN
   * ========================= */
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

  const renderAdmin = () => {
    const gate = $("#adminGate");
    const panel = $("#adminPanel");
    if (!gate || !panel) return;

    gate.classList.toggle("hidden", state.isAdmin);
    panel.classList.toggle("hidden", !state.isAdmin);
    if (!state.isAdmin) return;

    const rebind = (el, handler) => {
      if (!el) return null;
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      newEl.addEventListener("click", handler);
      return newEl;
    };

    rebind($("#aSave"), () => {
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

    rebind($("#aReset"), () => {
      state.editingId = null;
      resetAdminForm();
      $("#adminToast").textContent = "Réinitialisé.";
      setTimeout(() => ($("#adminToast").textContent = ""), 1200);
    });

    rebind($("#exportJson"), () => {
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

    const importFile = $("#importFile");
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

    // ✅ Stats refresh
    rebind($("#statsRefresh"), () => fetchStatsForAdmin());

    resetAdminForm(false);
    renderAdminList();
    fetchStatsForAdmin();
  };

  /* =========================
   * 10) INIT
   * ========================= */
  const init = () => {
    initFirebase();

    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    $("#lastUpdate").textContent = `Dernière MAJ : aujourd'hui ${nowHHMM()}`;

    $("#budgetInput").value = String(state.budgetX ?? "");
    setActiveBudgetChips(state.budgetX ?? 0);

    setActiveChips("usage", "data");
    setActiveChips("operator", "Tous");
    setActiveChips("validity", "Toutes");
    setActiveChips("promoOperator", "Tous");

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
