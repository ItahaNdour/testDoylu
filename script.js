"use strict";

/**
 * Doylu V1 (usage-based)
 * - UI universelle: Budget + Usage + Validité (24h/7j/30j)
 * - "jour/nuit/semaine/mois" = interne (Orange), NON affiché dans l'UI
 * - Admin invisible sauf /#admin + mot de passe
 */

const ADMIN_PASSWORD = "doyluadmin";
const STORAGE_KEY = "doylu_v1_bundle";

function $(id){ return document.getElementById(id); }
function pad2(n){ return String(n).padStart(2,"0"); }
function nowHHmm(){ const d=new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function isoNow(){ return new Date().toISOString(); }
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function formatMoney(n){
  try { return new Intl.NumberFormat("fr-FR").format(n); } catch { return String(n); }
}

const SafeStorage = (() => {
  const memory = new Map();
  function hasLocalStorage(){
    try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; } catch { return false; }
  }
  const enabled = hasLocalStorage();
  return {
    getItem(k){ return enabled ? localStorage.getItem(k) : (memory.get(k) ?? null); },
    setItem(k,v){ enabled ? localStorage.setItem(k,v) : memory.set(k,String(v)); }
  };
})();

let BUNDLE = null;
let OFFERS = [];
let SOURCES = [];

let selectedBudget = null;
let selectedUsage = "data";
let selectedValidity = "any";

function mkOffer(offer_id, operator, name, price_fcfa, type_usage, data_mb, minutes, validity_days, promo_limited, internal_category){
  const t = isoNow();
  return {
    offer_id,
    operator,
    name,
    price_fcfa,
    type_usage,
    data_mb: data_mb ?? null,
    minutes: minutes ?? null,
    validity_days: validity_days ?? null,
    validity_type: validity_days === 1 ? "24h" : validity_days === 7 ? "7j" : validity_days === 30 ? "30j" : "inconnu",
    // interne (Orange), pas affiché:
    internal_category: internal_category || "unknown", // jour/nuit/semaine/mois
    time_restriction: internal_category === "nuit" ? "23h-6h" : null,
    note: null,
    ussd_code: "#1234#",
    activation_path: "#1234# > Achat pass internet",
    status: "active",
    promo_limited: Boolean(promo_limited),
    is_sponsored: false,
    hidden: false,
    updated_at: t,
    created_at: t,
    last_seen_at: t
  };
}

function seedBundle(){
  const t = isoNow();

  // Toutes les offres Orange (fiables)
  const offers = [
    // Jour (1j)
    mkOffer("off_orange_jour_300mo_200", "Orange", "Pass 300Mo", 200, "data", 300, null, 1, false, "jour"),
    mkOffer("off_orange_jour_1_5go_500", "Orange", "Pass 1,5Go", 500, "data", 1536, null, 1, false, "jour"),
    mkOffer("off_orange_jour_5go_1000", "Orange", "Pass 5Go", 1000, "data", 5120, null, 1, false, "jour"),

    // Nuit (1j + restriction)
    mkOffer("off_orange_nuit_5go_500", "Orange", "Pass Nuit 5Go", 500, "data", 5120, null, 1, false, "nuit"),

    // Semaine (7j)
    mkOffer("off_orange_sem_edu_1go_100", "Orange", "Pass Éducation 1Go", 100, "data", 1024, null, 7, false, "semaine"),
    mkOffer("off_orange_sem_600mo_500", "Orange", "Pass 600Mo", 500, "data", 600, null, 7, false, "semaine"),
    mkOffer("off_orange_sem_2go_1000", "Orange", "Pass 2Go", 1000, "data", 2048, null, 7, false, "semaine"),
    mkOffer("off_orange_sem_10go_2500", "Orange", "Pass 10Go", 2500, "data", 10240, null, 7, false, "semaine"),

    // Mois (30j)
    mkOffer("off_orange_mois_5go_2000", "Orange", "Pass 5Go (Max it)", 2000, "data", 5120, null, 30, false, "mois"),
    mkOffer("off_orange_mois_promo_10go_2000", "Orange", "Promo 10Go (OM)", 2000, "data", 10240, null, 30, true, "mois"),
    mkOffer("off_orange_mois_12go_3000", "Orange", "Pass 12Go", 3000, "data", 12288, null, 30, false, "mois"),
    mkOffer("off_orange_mois_25go_5000", "Orange", "Pass 25Go", 5000, "data", 25600, null, 30, false, "mois"),
    mkOffer("off_orange_mois_60go_10000", "Orange", "Pass 60Go", 10000, "data", 61440, null, 30, false, "mois"),
    mkOffer("off_orange_mois_100go_15000", "Orange", "Pass 100Go", 15000, "data", 102400, null, 30, false, "mois"),
  ];

  const sources = offers.map(o => ({
    source_id:`src_${o.offer_id}`,
    offer_id:o.offer_id,
    source_type:"ussd",
    platform:"ussd",
    raw_text:"Vu via menu d’achat pass (captures famille).",
    received_at:t,
    is_official:true
  }));

  return { offers, sources, meta:{ last_update:t } };
}

function loadBundle(){
  const raw = SafeStorage.getItem(STORAGE_KEY);
  if(!raw){
    BUNDLE = seedBundle();
    persistBundle();
    return;
  }
  try{
    BUNDLE = JSON.parse(raw);
    if(!BUNDLE?.offers || !BUNDLE?.sources) throw new Error("bad");
  }catch{
    BUNDLE = seedBundle();
    persistBundle();
  }
}

function persistBundle(){
  BUNDLE.meta = BUNDLE.meta || {};
  BUNDLE.meta.last_update = isoNow();
  SafeStorage.setItem(STORAGE_KEY, JSON.stringify(BUNDLE));
}

function syncFromBundle(){
  OFFERS = Array.isArray(BUNDLE.offers) ? BUNDLE.offers : [];
  SOURCES = Array.isArray(BUNDLE.sources) ? BUNDLE.sources : [];
}

/* ---------- scoring (usage-based) ---------- */
function dataPerFcfa(o){
  if(!o.data_mb || !o.price_fcfa) return 0;
  return Number(o.data_mb) / Number(o.price_fcfa);
}
function minutesPerFcfa(o){
  if(!o.minutes || !o.price_fcfa) return 0;
  return Number(o.minutes) / Number(o.price_fcfa);
}
function durationFactor(days){
  const d = Number(days || 0);
  if(!d) return 1.0;
  return 1.0 + Math.min(0.22, Math.log10(d + 1) * 0.18);
}
function restrictionFactor(o){
  let f = 1.0;
  // pénalité si c’est une offre nuit (mais on ne l'affiche pas en UI)
  if(o.internal_category === "nuit") f *= 0.82;
  // pénalité légère si "éducation"
  if(String(o.name || "").toLowerCase().includes("éducation")) f *= 0.85;
  return f;
}
function promoFactor(o){ return o.promo_limited ? 1.05 : 1.0; }

function offerScore(o, usage){
  const d = dataPerFcfa(o);
  const m = minutesPerFcfa(o);

  const w = usage === "data"
    ? { wd: 1.0, wm: 0.10 }
    : usage === "appels"
      ? { wd: 0.10, wm: 1.0 }
      : { wd: 0.70, wm: 0.70 };

  let base = (d * w.wd) + (m * w.wm);
  base *= durationFactor(o.validity_days);
  base *= restrictionFactor(o);
  base *= promoFactor(o);

  return base;
}

function operatorCode(op){
  if(op==="Orange") return "O";
  if(op==="Free") return "F";
  if(op==="Expresso") return "E";
  return "L";
}

function goFromMb(mb){ return mb ? mb / 1024 : null; }
function displayData(o){
  if(!o.data_mb) return null;
  const go = goFromMb(o.data_mb);
  if(go >= 1) return `${(Math.round(go*10)/10).toString().replace(".", ",")} Go`;
  return `${o.data_mb} Mo`;
}
function validityLabel(o){
  if(o.validity_days === 1) return "24h";
  if(o.validity_days === 7) return "7 jours";
  if(o.validity_days === 30) return "30 jours";
  return "Inconnu";
}
function metaLine(o){
  const parts = [];
  const d = displayData(o);
  if(d) parts.push(`📱 ${d}`);
  if(o.minutes) parts.push(`📞 ${o.minutes} min`);
  parts.push(`⏱ ${validityLabel(o)}`);
  return parts.join(" • ");
}
function oneBadge(o){
  if(o.promo_limited) return { cls:"promo", label:"Promo limitée" };
  return { cls:"official", label:"Source officielle" };
}

function toggleLoader(on, text="Recherche en cours…"){
  $("loaderText").textContent = text;
  $("loader").style.display = on ? "flex" : "none";
}
function setLastUpdate(){ $("lastUpdate").textContent = `aujourd’hui ${nowHHmm()}`; }

function showToast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> t.style.display="none", 2000);
}
async function copyText(text){
  try{ await navigator.clipboard.writeText(text); return true; }catch{ return false; }
}
function shareWhatsApp(title, price, ussd){
  const msg = `Bon plan Doylu 🇸🇳\n${title}\nPrix: ${price} FCFA\nCode: ${ussd}\n`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ---------- modal ---------- */
function openModal(title, html){
  $("modalTitle").textContent = title || "Info";
  $("modalBody").innerHTML = html || "<p></p>";
  $("modalBackdrop").style.display = "flex";
}
function closeModal(){ $("modalBackdrop").style.display = "none"; }
function openHowVerify(){
  openModal("Comment on vérifie ?", `
    <ul>
      <li>On collecte des offres reçues par SMS et vues dans les menus USSD.</li>
      <li>On vérifie prix / volume / validité, puis on retire les offres expirées.</li>
      <li>“Source officielle” = preuve fiable (USSD / page officielle).</li>
    </ul>
  `);
}

/* ---------- pages routing ---------- */
const PAGES = ["home", "promos", "guide", "contact"];
function currentPageFromHash(){
  const h = (window.location.hash || "#home").replace("#","");
  if(h === "admin") return "home";
  return PAGES.includes(h) ? h : "home";
}
function showPage(page){
  for(const p of PAGES){
    $("page_"+p)?.classList.toggle("hidden-page", p!==page);
    $("nav_"+p)?.classList.toggle("active", p===page);
    $("mnav_"+p)?.classList.toggle("active", p===page);
  }
}
function toggleMobileMenu(forceClose=false){
  const menu = $("mobileMenu");
  if(forceClose) return menu.classList.add("hidden");
  menu.classList.toggle("hidden");
}

/* ---------- filters ---------- */
function passesValidity(o){
  if(selectedValidity==="any") return true;
  const v = Number(selectedValidity);
  const d = Number(o.validity_days || 0);
  if(!d) return false;
  if(v===1) return d <= 1;
  return d >= v;
}
function offerIsDisplayable(o, budget){
  if(o.hidden) return false;
  if(o.status === "expired") return false;
  if(!budget) return false;
  if(Number(o.price_fcfa) > Number(budget)) return false;
  if(o.type_usage !== selectedUsage) return false;
  if(!passesValidity(o)) return false;
  return true;
}
function computeResults(){
  const budget = Number(selectedBudget || 0);
  const rows = OFFERS
    .filter(o => offerIsDisplayable(o, budget))
    .map(o => ({...o, _score: offerScore(o, selectedUsage)}));
  rows.sort((a,b)=> b._score - a._score);
  return rows;
}

function renderBestPick(best, count){
  const el = $("bestPick");
  if(!best){ el.style.display="none"; el.innerHTML=""; return; }
  const title = `${best.operator} — ${best.name}`;
  el.style.display="block";
  el.innerHTML = `
    <div class="best-card">
      <div class="best-title">🔥 Meilleur choix pour ${formatMoney(selectedBudget)} FCFA (${selectedUsage})</div>
      <div class="best-sub">${escapeHtml(title)} • ${escapeHtml(metaLine(best))} • <strong>${formatMoney(best.price_fcfa)} FCFA</strong> — ${count} offre(s)</div>
    </div>
  `;
}

function renderResults(){
  const resultsEl = $("results");
  const habitEl = $("habitMsg");
  resultsEl.innerHTML = "";
  $("bestPick").style.display="none";
  habitEl.style.display="none";

  if(!selectedBudget) return;

  const rows = computeResults();

  if(rows.length===0){
    resultsEl.innerHTML = `
      <div class="offer-card">
        <div class="offer-title">Aucune offre trouvée</div>
        <div class="meta-line">Essaie un autre budget ou une autre validité.</div>
      </div>
    `;
    habitEl.style.display="block";
    return;
  }

  renderBestPick(rows[0], rows.length);

  resultsEl.innerHTML = rows.map(o=>{
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
        <div class="meta-line">${escapeHtml(metaLine(o))}</div>

        <button class="btn cta" id="reveal_${o.offer_id}" type="button">👁️ Afficher le code</button>
        <div class="ussd-box" id="ussd_${o.offer_id}">${escapeHtml(ussd)}</div>

        <div class="row-actions">
          <button class="btn gray" id="copy_${o.offer_id}" type="button" style="display:none">📋 Copier</button>
          <button class="btn whatsapp" id="share_${o.offer_id}" type="button">🟢 Partager WhatsApp</button>
        </div>
      </div>
    `;
  }).join("");

  for(const o of rows){
    const title = `${o.operator} — ${o.name}`;
    const ussd = o.ussd_code || "USSD indisponible";

    document.getElementById(`reveal_${o.offer_id}`)?.addEventListener("click", () => {
      const box = document.getElementById(`ussd_${o.offer_id}`);
      const copyBtn = document.getElementById(`copy_${o.offer_id}`);
      if(box) box.style.display="block";
      if(copyBtn) copyBtn.style.display="inline-flex";
    });

    document.getElementById(`copy_${o.offer_id}`)?.addEventListener("click", async () => {
      const ok = await copyText(ussd);
      if(!ok) return showToast("Copie impossible sur ce navigateur.");
      showToast("Code copié ✅");
    });

    document.getElementById(`share_${o.offer_id}`)?.addEventListener("click", () => {
      shareWhatsApp(title, Number(o.price_fcfa), ussd);
    });
  }

  habitEl.style.display="block";
}

function renderBudgets(){
  const budgets=[500,1000,2000,3000,5000,10000,15000];
  $("budgetGrid").innerHTML = budgets.map(b => `<button class="budget-btn" type="button" data-b="${b}">${formatMoney(b)}</button>`).join("");
  document.querySelectorAll(".budget-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const b = Number(btn.dataset.b);
      $("budgetInput").value = String(b);
      setBudget(b, true);
    });
  });
}

function setBudget(b, autoscroll){
  selectedBudget = Number(b);
  document.querySelectorAll(".budget-btn").forEach(x => x.classList.toggle("active", Number(x.dataset.b)===selectedBudget));
  toggleLoader(true, "Recherche en cours…");
  setTimeout(()=>{
    toggleLoader(false);
    renderResults();
    if(autoscroll) $("results").scrollIntoView({behavior:"smooth", block:"start"});
  }, 350);
}

/* ---------- promos ---------- */
function renderPromos(){
  const el = $("promoResults");
  const promos = OFFERS
    .filter(o => !o.hidden && o.status !== "expired")
    .filter(o => o.promo_limited)
    .slice(0, 30);

  if(promos.length===0){
    el.innerHTML = `
      <div class="offer-card">
        <div class="offer-title">Pas de promos publiées pour l’instant</div>
        <div class="meta-line">Ajoute une promo via Admin (#admin).</div>
      </div>
    `;
    return;
  }

  el.innerHTML = promos.map(o=>{
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
        <div class="meta-line">${escapeHtml(metaLine(o))}</div>

        <button class="btn cta" id="reveal_${o.offer_id}" type="button">👁️ Afficher le code</button>
        <div class="ussd-box" id="ussd_${o.offer_id}">${escapeHtml(ussd)}</div>

        <div class="row-actions">
          <button class="btn gray" id="copy_${o.offer_id}" type="button" style="display:none">📋 Copier</button>
          <button class="btn whatsapp" id="share_${o.offer_id}" type="button">🟢 Partager WhatsApp</button>
        </div>
      </div>
    `;
  }).join("");

  for(const o of promos){
    const title = `${o.operator} — ${o.name}`;
    const ussd = o.ussd_code || "USSD indisponible";
    document.getElementById(`reveal_${o.offer_id}`)?.addEventListener("click", ()=>{
      const box = document.getElementById(`ussd_${o.offer_id}`);
      const copyBtn = document.getElementById(`copy_${o.offer_id}`);
      if(box) box.style.display="block";
      if(copyBtn) copyBtn.style.display="inline-flex";
    });
    document.getElementById(`copy_${o.offer_id}`)?.addEventListener("click", async ()=>{
      const ok = await copyText(ussd);
      if(!ok) return showToast("Copie impossible sur ce navigateur.");
      showToast("Code copié ✅");
    });
    document.getElementById(`share_${o.offer_id}`)?.addEventListener("click", ()=> shareWhatsApp(title, Number(o.price_fcfa), ussd));
  }
}

/* ---------- admin ---------- */
function adminAuth(){ return prompt("Mot de passe admin ?") === ADMIN_PASSWORD; }
function openAdminIfAllowed(){
  if(!adminAuth()){
    window.location.hash="#home";
    return false;
  }
  $("adminPanel").style.display="block";
  $("adminPanel").setAttribute("aria-hidden","false");
  renderAdmin();
  return true;
}
function closeAdmin(){
  $("adminPanel").style.display="none";
  $("adminPanel").setAttribute("aria-hidden","true");
}
function handleAdminRoute(){
  if(window.location.hash === "#admin") openAdminIfAllowed();
  else closeAdmin();
}
function adminExport(){
  const out = { offers: OFFERS, sources: SOURCES, exported_at: isoNow() };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doylu_export_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Export JSON ✅");
}
function adminImportFile(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const b = JSON.parse(String(r.result || "{}"));
      if(!Array.isArray(b.offers) || !Array.isArray(b.sources)) return alert("Format invalide.");
      BUNDLE.offers = b.offers;
      BUNDLE.sources = b.sources;
      persistBundle();
      syncFromBundle();
      renderAdmin();
      renderPromos();
      if(selectedBudget) renderResults();
      showToast("Import OK ✅");
    }catch{
      alert("Fichier JSON invalide.");
    }
  };
  r.readAsText(file);
}
function openPasteImportModal(){
  openModal("Coller JSON", `
    <p class="muted">Colle un JSON au format <strong>{ "offers": [...], "sources": [...] }</strong></p>
    <textarea id="pasteJson" style="width:100%;min-height:220px;padding:12px;border-radius:14px;border:1px solid #e5e7eb;font-weight:900;font-size:13px"></textarea>
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <button class="btn cta" type="button" id="pasteImportConfirm">Importer</button>
      <button class="btn gray" type="button" id="pasteImportCancel">Annuler</button>
    </div>
  `);
  document.getElementById("pasteImportCancel")?.addEventListener("click", closeModal);
  document.getElementById("pasteImportConfirm")?.addEventListener("click", () => {
    const raw = String(document.getElementById("pasteJson")?.value || "").trim();
    if(!raw) return alert("Colle le JSON d'abord.");
    try{
      const b = JSON.parse(raw);
      if(!Array.isArray(b.offers) || !Array.isArray(b.sources)) return alert("Format invalide.");
      BUNDLE.offers = b.offers;
      BUNDLE.sources = b.sources;
      persistBundle();
      syncFromBundle();
      renderAdmin();
      renderPromos();
      if(selectedBudget) renderResults();
      closeModal();
      showToast("Import OK ✅");
    }catch{
      alert("JSON illisible.");
    }
  });
}

function renderAdmin(){
  const list = $("adminList");
  list.innerHTML = OFFERS.map(o => `
    <div class="admin-item">
      <div class="bold">${escapeHtml(o.operator)} — ${escapeHtml(o.name)}</div>
      <div class="muted">ID: ${escapeHtml(o.offer_id)}</div>
      <div class="hr"></div>

      <select data-offer="${o.offer_id}" data-field="operator">
        <option ${o.operator==="Orange"?"selected":""}>Orange</option>
        <option ${o.operator==="Free"?"selected":""}>Free</option>
        <option ${o.operator==="Expresso"?"selected":""}>Expresso</option>
        <option ${o.operator==="Lebara"?"selected":""}>Lebara</option>
      </select>

      <input data-offer="${o.offer_id}" data-field="name" value="${escapeHtml(o.name)}" />
      <input data-offer="${o.offer_id}" data-field="price_fcfa" type="number" value="${Number(o.price_fcfa)}" />
      <select data-offer="${o.offer_id}" data-field="type_usage">
        <option value="data" ${o.type_usage==="data"?"selected":""}>data</option>
        <option value="mixte" ${o.type_usage==="mixte"?"selected":""}>mixte</option>
        <option value="appels" ${o.type_usage==="appels"?"selected":""}>appels</option>
      </select>

      <input data-offer="${o.offer_id}" data-field="data_mb" type="number" value="${o.data_mb ?? ""}" placeholder="data_mb (ex 5120)" />
      <input data-offer="${o.offer_id}" data-field="minutes" type="number" value="${o.minutes ?? ""}" placeholder="minutes" />
      <input data-offer="${o.offer_id}" data-field="validity_days" type="number" value="${o.validity_days ?? ""}" placeholder="validity_days (ex: 1, 7, 30)" />
      <input data-offer="${o.offer_id}" data-field="ussd_code" value="${escapeHtml(o.ussd_code ?? "")}" placeholder="ussd_code" />
      <textarea data-offer="${o.offer_id}" data-field="note" placeholder="note (optionnel)">${escapeHtml(o.note ?? "")}</textarea>

      <div class="admin-row">
        <label><input data-offer="${o.offer_id}" data-field="hidden" type="checkbox" ${o.hidden ? "checked":""}/> hidden</label>
        <label><input data-offer="${o.offer_id}" data-field="promo_limited" type="checkbox" ${o.promo_limited ? "checked":""}/> promo</label>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("input,select,textarea").forEach(el => {
    el.addEventListener("change", () => {
      const offerId = el.getAttribute("data-offer");
      const field = el.getAttribute("data-field");
      const offer = OFFERS.find(x => x.offer_id === offerId);
      if(!offer) return;

      let v = (el.type === "checkbox") ? el.checked : el.value;
      if(["price_fcfa","data_mb","minutes","validity_days"].includes(field)) v = v === "" ? null : Number(v);

      offer[field] = v;
      offer.updated_at = isoNow();

      BUNDLE.offers = OFFERS;
      BUNDLE.sources = SOURCES;
      persistBundle();

      renderPromos();
      if(selectedBudget) renderResults();
    });
  });
}

/* ---------- events ---------- */
function bindEvents(){
  $("brandBtn").addEventListener("click", () => window.location.hash = "#home");
  $("brandBtn").addEventListener("keydown", (e) => { if(e.key==="Enter") window.location.hash="#home"; });

  $("hamburgerBtn").addEventListener("click", () => toggleMobileMenu());
  ["home","promos","guide","contact"].forEach(p => $("mnav_"+p)?.addEventListener("click", () => toggleMobileMenu(true)));

  $("howVerifyLink").addEventListener("click", (e)=>{ e.preventDefault(); openHowVerify(); });
  $("howVerifyBtn2")?.addEventListener("click", openHowVerify);

  $("modalBackdrop").addEventListener("click", (e)=>{ if(e.target?.id==="modalBackdrop") closeModal(); });
  $("modalCloseBtn").addEventListener("click", closeModal);

  $("waOptIn").addEventListener("click", () => {
    window.open(`https://wa.me/?text=${encodeURIComponent("Salut ! Je veux recevoir les bons plans Doylu sur WhatsApp.")}`, "_blank");
  });

  $("waSupportBtn")?.addEventListener("click", () => {
    window.open(`https://wa.me/?text=${encodeURIComponent("Salut Doylu, j’ai une question / un signalement.")}`, "_blank");
  });

  $("reportBtn")?.addEventListener("click", () => openModal("Signaler une offre", `<p class="muted">V1 : envoie ton signalement sur WhatsApp Business.</p>`));
  $("sendPromoBtn")?.addEventListener("click", () => openModal("Envoyer une promo SMS", `<p class="muted">V1 : copie-colle le SMS promo dans WhatsApp Business.</p>`));
  $("backHomeBtn")?.addEventListener("click", () => { window.location.hash="#home"; setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}), 50); });

  document.querySelectorAll("[data-u]").forEach(btn => btn.addEventListener("click", () => {
    selectedUsage = btn.getAttribute("data-u");
    document.querySelectorAll("[data-u]").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    if(selectedBudget) renderResults();
  }));

  document.querySelectorAll("[data-v]").forEach(btn => btn.addEventListener("click", () => {
    selectedValidity = btn.getAttribute("data-v");
    document.querySelectorAll("[data-v]").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    if(selectedBudget) renderResults();
  }));

  $("findBtn").addEventListener("click", () => {
    const b = Number($("budgetInput").value || 0);
    if(!b) return;
    setBudget(b, true);
  });

  $("budgetInput").addEventListener("keydown", (e) => {
    if(e.key === "Enter"){
      const b = Number($("budgetInput").value || 0);
      if(!b) return;
      setBudget(b, true);
    }
  });

  document.querySelectorAll(".acc-head").forEach(h => h.addEventListener("click", () => {
    const body = h.nextElementSibling;
    if(!body) return;
    body.style.display = body.style.display === "block" ? "none" : "block";
  }));

  $("adminRecomputeBtn").addEventListener("click", () => {
    persistBundle();
    syncFromBundle();
    renderAdmin();
    renderPromos();
    if(selectedBudget) renderResults();
    showToast("OK ✅");
  });

  $("adminExportBtn").addEventListener("click", () => {
    const out = { offers: OFFERS, sources: SOURCES, exported_at: isoNow() };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doylu_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Export ✅");
  });

  $("adminImportBtn").addEventListener("click", () => $("adminImportFile").click());
  $("adminPasteBtn").addEventListener("click", openPasteImportModal);
  $("adminImportFile").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if(f) adminImportFile(f);
  });

  $("adminAddOfferBtn").addEventListener("click", () => {
    const t = isoNow();
    const id = `off_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    OFFERS.unshift({
      offer_id:id, operator:"Orange", name:"Nouvelle offre", price_fcfa:0,
      type_usage:selectedUsage || "data", data_mb:null, minutes:null,
      validity_days:null, validity_type:"inconnu",
      internal_category:"unknown", time_restriction:null,
      ussd_code:"#1234#", activation_path:"#1234# > Achat pass internet",
      note:null, status:"active", promo_limited:false, is_sponsored:false, hidden:false,
      updated_at:t, created_at:t, last_seen_at:t
    });
    BUNDLE.offers = OFFERS;
    BUNDLE.sources = SOURCES;
    persistBundle();
    renderAdmin();
    if(selectedBudget) renderResults();
  });
}

/* ---------- hash ---------- */
window.addEventListener("hashchange", () => {
  showPage(currentPageFromHash());
  if(currentPageFromHash()==="promos") renderPromos();
  handleAdminRoute();
});

/* ---------- boot ---------- */
function boot(){
  loadBundle();
  syncFromBundle();
  bindEvents();
  renderBudgets();
  renderPromos();
  setLastUpdate();
  setInterval(setLastUpdate, 30_000);
  showPage(currentPageFromHash());
  handleAdminRoute();
}
boot();

function currentPageFromHash(){
  const h = (window.location.hash || "#home").replace("#","");
  if(h === "admin") return "home";
  return ["home","promos","guide","contact"].includes(h) ? h : "home";
}
function showPage(page){
  for(const p of ["home","promos","guide","contact"]){
    $("page_"+p)?.classList.toggle("hidden-page", p!==page);
    $("nav_"+p)?.classList.toggle("active", p===page);
    $("mnav_"+p)?.classList.toggle("active", p===page);
  }
}
function handleAdminRoute(){
  if(window.location.hash === "#admin") openAdminIfAllowed();
  else closeAdmin();
}
function adminAuth(){ return prompt("Mot de passe admin ?") === ADMIN_PASSWORD; }
function openAdminIfAllowed(){
  if(!adminAuth()){
    window.location.hash="#home";
    return false;
  }
  $("adminPanel").style.display="block";
  $("adminPanel").setAttribute("aria-hidden","false");
  renderAdmin();
  return true;
}
function closeAdmin(){
  $("adminPanel").style.display="none";
  $("adminPanel").setAttribute("aria-hidden","true");
}
