/* ============================================================
   Casal d'hoquei — inscripcions (frontend)
   Formulari generat des de la config (Google Sheet).
   Per ara: un sol casal (estiu). Adjuntar fitxers + prefill local.
   ============================================================ */

// 🔧 Enganxa aquí la URL del teu Apps Script (acaba en /exec).
// Buida = MODE DEMO amb dades d'exemple.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwuWJFZKY-JKs54yYAP1RAyJgORL1w-xEGBziVPY_amaQYAw8rxfO5KYPEffW0laUII/exec";

// 🔧 Quin formulari es mostra. Es llegeix de la URL: ...index.html?form=primavera
// Buit = formulari per defecte (les files del full sense columna "form").
const FORM_ID = (new URLSearchParams(location.search).get("form") || "").trim();

const STORAGE_KEY = "casal_hoquei_v1";
const MAX_FILE_MB = 5;
const MAX_TOTAL_MB = 12;

// Textos llargs de les autoritzacions
const T_ACTIVITAT = "Autoritzo el meu fill/a a dur a terme les activitats programades al casal (esport, sortides, piscina, etc.), que es realitzaran del 29 de juny al 31 de juliol de 2026, tant a peu com en vehicle privat o públic. La responsabilitat de custòdia del club sobre l'infant serà exclusivament dins l'horari del casal, i passarà als tutors un cop finalitzada l'activitat.";
const T_VEHICLE = "Autoritzo a usar un vehicle privat per al desplaçament no urgent ni especialitzat en cas de necessitar atenció mèdica. També autoritzo a efectuar petites cures per part de l'equip de monitors.";
const T_IMATGE = "Autoritzo que la imatge del meu fill/a pugui aparèixer en fotografies i filmacions d'activitats del club, publicades a les pàgines oficials del club E7 i CP Riudebitlles i a Instagram, Twitter i Facebook, amb finalitats esportives i promocionals.";
const T_LOPD = "D'acord amb la normativa de protecció de dades, t'informem que les dades facilitades es tractaran amb la confidencialitat adequada, s'incorporaran a un fitxer del Club Esportiu E7 i només s'utilitzaran per a la gestió del casal. Pots exercir els drets d'accés, rectificació i cancel·lació adreçant-te al club per escrit.";

// ---- Config d'exemple (mode demo) ----
const DEMO_CONFIG = {
  settings: {
    nombre_campus: "Campus Hoquei Riudebitlles",
    club: "Sant Pere de Riudebitlles · CP Riudebitlles",
    temporada: "2026",
    lema: "Inscripcions obertes",
    hero_titulo: "Casal d'Hoquei d'Estiu",
    intro: "Del 29 de juny al 31 de juliol. Completa la inscripció, tria les setmanes i adjunta la targeta sanitària.",
    email_contacto: "coordinaciocpriudebitlles@gmail.com",
    email_asunto: "Inscripció rebuda · Casal Hoquei Estiu 2026",
    email_intro: "Hem rebut la inscripció. Aquí tens el resum:",
    texto_boton: "Enviar inscripció",
    mensaje_exito: "T'hem enviat un correu amb el resum. Si has de fer algun canvi, escriu-nos.",
    consentimiento: "He llegit i accepto la política de protecció de dades del Club Esportiu E7.",
    setmanes_info: "Preu del casal: 1a setmana 80 € · 2a setmana, família nombrosa o 2n germà 70 € · jugadors del C.P. Riudebitlles 70 € (2a setmana o 2n germà 60 €).",
    semanas_obligatorias: true
  },
  campuses: [],  // un sol casal de moment; els campus s'implementaran després
  weeks: [
    { id: "S1", etiqueta: "Setmana 1", fechas: "29 juny – 3 juliol" },
    { id: "S2", etiqueta: "Setmana 2", fechas: "6 – 10 juliol" },
    { id: "S3", etiqueta: "Setmana 3", fechas: "13 – 17 juliol", plazas: 0, plazas_restantes: 0 },
    { id: "S4", etiqueta: "Setmana 4", fechas: "20 – 24 juliol" },
    { id: "S5", etiqueta: "Setmana 5", fechas: "27 – 31 juliol" }
  ],
  fields: [
    // Dades del jugador/a
    { id: "nom_jugador", etiqueta: "Nom i cognoms", tipo: "text", obligatorio: true, grupo: "Dades del jugador/a", orden: 1 },
    { id: "data_naixement", etiqueta: "Data de naixement", tipo: "date", obligatorio: true, ayuda: "Exemple: 18/11/2018", grupo: "Dades del jugador/a", orden: 2 },
    { id: "sap_nedar", etiqueta: "Sap nedar?", tipo: "radio", opciones: "Sí|No", obligatorio: true, grupo: "Dades del jugador/a", orden: 3 },
    // Dades del pare/mare/tutor
    { id: "nom_tutor", etiqueta: "Nom i cognoms del tutor/a", tipo: "text", obligatorio: true, grupo: "Dades del pare/mare/tutor", orden: 4 },
    { id: "nif", etiqueta: "NIF", tipo: "text", obligatorio: true, grupo: "Dades del pare/mare/tutor", orden: 5 },
    { id: "adreca", etiqueta: "Adreça", tipo: "text", obligatorio: true, grupo: "Dades del pare/mare/tutor", orden: 6 },
    { id: "poblacio", etiqueta: "Població", tipo: "text", obligatorio: true, grupo: "Dades del pare/mare/tutor", orden: 7 },
    { id: "codi_postal", etiqueta: "Codi postal", tipo: "text", obligatorio: true, grupo: "Dades del pare/mare/tutor", orden: 8 },
    { id: "telefon", etiqueta: "Telèfon", tipo: "tel", obligatorio: true, grupo: "Dades del pare/mare/tutor", orden: 9 },
    { id: "email", etiqueta: "Email", tipo: "email", obligatorio: true, ayuda: "Hi enviarem la confirmació.", grupo: "Dades del pare/mare/tutor", orden: 10 },
    // Autoritzacions
    { id: "aut_activitat", etiqueta: "Autorització de l'activitat", tipo: "radio", opciones: "Sí|No", obligatorio: true, ayuda: T_ACTIVITAT, grupo: "Autoritzacions", orden: 11 },
    { id: "aut_vehicle", etiqueta: "Autorització de vehicle i cures", tipo: "radio", opciones: "Sí|No", obligatorio: true, ayuda: T_VEHICLE, grupo: "Autoritzacions", orden: 12 },
    { id: "drets_imatge", etiqueta: "Drets d'imatge", tipo: "radio", opciones: "Sí|No", obligatorio: true, ayuda: T_IMATGE, grupo: "Autoritzacions", orden: 13 },
    // Documentació
    { id: "targeta_sanitaria", etiqueta: "Còpia de la targeta sanitària", tipo: "file", opciones: "image/*,application/pdf", obligatorio: false, ayuda: "Foto o PDF. Si ja l'has enviat altres anys, pots saltar aquest pas o enviar-la a coordinaciocpriudebitlles@gmail.com.", grupo: "Documentació", orden: 14 },
    // Protecció de dades
    { id: "nota_lopd", etiqueta: "Protecció de dades", tipo: "nota", ayuda: T_LOPD, grupo: "Protecció de dades", orden: 15 }
  ]
};

// ---- Estat ----
let CONFIG = null;
let currentCampus = null;
let childCount = 1;            // quants jugadors/es s'estan inscrivint alhora
let returningDismissed = false; // l'usuari ha tancat la barra "ja t'havíem vist"
const fileStore = {};
const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cache();
  els.retry.addEventListener("click", load);
  els.form.addEventListener("submit", onSubmit);
  els.another.addEventListener("click", resetForNew);
  els.returningClose.addEventListener("click", () => { els.returning.hidden = true; returningDismissed = true; });
  await load();
}

function cache() {
  const id = (x) => document.getElementById(x);
  ["loading","load-error","load-error-hint","closed","retry","form","form-sections",
   "submit-btn","submit-note","done","done-text","done-summary","another",
   "returning","returning-text","returning-actions","returning-close","consent-text"]
    .forEach((k) => (els[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = id(k)));
  els.sections = id("form-sections");
}

// ---- Càrrega ----
async function load() {
  els.loading.hidden = false; els.loadError.hidden = true; els.closed.hidden = true;
  els.form.hidden = true; els.done.hidden = true;
  try {
    CONFIG = await fetchConfig();
    applySettings(CONFIG.settings || {});
    if (CONFIG.form && CONFIG.form.habilitado === false) {
      els.loading.hidden = true; els.closed.hidden = false; return;
    }
    const open = enabledCampuses();
    if (CONFIG.campuses && CONFIG.campuses.length && open.length === 0) {
      els.loading.hidden = true; els.closed.hidden = false; return;
    }
    currentCampus = open.length ? open[0].id : null;
    renderForm();
    els.loading.hidden = true; els.form.hidden = false;
    maybeShowReturning();
  } catch (err) {
    console.error(err);
    els.loading.hidden = true; els.loadError.hidden = false;
    if (!SCRIPT_URL) els.loadErrorHint.textContent = "Encara no has configurat la URL del servidor (SCRIPT_URL a app.js).";
  }
}

async function fetchConfig() {
  if (!SCRIPT_URL) return structuredClone(DEMO_CONFIG);
  const res = await fetch(`${SCRIPT_URL}?action=config&form=${encodeURIComponent(FORM_ID)}`, { method: "GET" });
  if (!res.ok) throw new Error("config HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
function enabledCampuses() { return (CONFIG.campuses || []).filter((c) => c.habilitado !== false); }

// ---- Settings ----
function applySettings(s) {
  const setText = (sel, val) => document.querySelectorAll(sel).forEach((n) => { if (val != null) n.textContent = val; });
  setText("[data-camp-name]", s.nombre_campus);
  setText("[data-club]", s.club);
  setText("[data-season]", s.temporada);
  setText("[data-tagline]", s.lema);
  setText("[data-hero-title]", s.hero_titulo);
  setText("[data-intro]", s.intro);
  setText("[data-submit-text]", s.texto_boton);
  if (s.consentimiento) els.consentText.textContent = s.consentimiento;
  if (s.nombre_campus) document.title = `Inscripcions · ${s.nombre_campus}`;
  const link = document.querySelector("[data-contact-link]");
  if (link && s.email_contacto) link.href = `mailto:${s.email_contacto}`;
}

// ---- Render ----
function renderForm() {
  els.sections.innerHTML = "";
  childCount = Math.max(1, childCount || 1);
  let n = 0;
  const open = enabledCampuses();
  if (open.length > 1) { n++; els.sections.appendChild(sectionEl(n, "Tria el casal", [campusPickerEl(open)])); }

  const fields = [...(CONFIG.fields || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const groups = []; const byName = {};
  for (const f of fields) {
    const g = f.grupo || "Inscripció";
    if (!byName[g]) { byName[g] = { name: g, fields: [] }; groups.push(byName[g]); }
    byName[g].fields.push(f);
  }
  const childGroup = detectChildGroup(groups);
  for (const g of groups) {
    n++;
    if (g.name === childGroup) els.sections.appendChild(childrenSectionEl(n, g));
    else els.sections.appendChild(sectionEl(n, g.name, g.fields.map((f) => fieldEl(f))));
  }
  // Les setmanes ara són per cada jugador/a (dins de cada bloc), no una secció a part.
}

// El grup "per jugador/a" es repeteix per cada fill. Detectem-lo pel nom; si no,
// agafem el primer grup del formulari.
function detectChildGroup(groups) {
  const m = groups.find((g) => /jugador|alumn|fill|nen|infant|nin/i.test(g.name));
  return m ? m.name : (groups[0] && groups[0].name);
}

// Secció que conté N blocs de jugador/a + el botó "Afegir un altre fill/a".
function childrenSectionEl(num, group) {
  const sec = sectionEl(num, group.name, []);
  sec.id = "children-section";
  const info = (CONFIG.settings || {}).setmanes_info;
  if (info && (weeksForCampus().length)) {
    const p = document.createElement("p"); p.className = "field__help field__help--above";
    p.textContent = info; sec.appendChild(p);
  }
  const wrap = document.createElement("div"); wrap.className = "children";
  sec.appendChild(wrap);
  const add = document.createElement("button");
  add.type = "button"; add.className = "btn btn--ghost add-child";
  add.innerHTML = `<span aria-hidden="true">+</span> Afegir un altre fill/a`;
  add.addEventListener("click", () => addChildBlock(wrap, group));
  sec.appendChild(add);
  for (let i = 0; i < childCount; i++) wrap.appendChild(childBlockEl(group, i));
  renumberChildren(wrap);
  return sec;
}
function childBlockEl(group, i) {
  const block = document.createElement("div"); block.className = "child-block"; block.dataset.child = String(i);
  const head = document.createElement("div"); head.className = "child-block__head";
  head.innerHTML = `<span class="child-block__title"></span>`;
  const rm = document.createElement("button");
  rm.type = "button"; rm.className = "child-block__remove"; rm.setAttribute("aria-label", "Treure aquest jugador/a");
  rm.innerHTML = `✕ Treure`;
  rm.addEventListener("click", () => removeChildBlock(block));
  head.appendChild(rm);
  block.appendChild(head);
  group.fields.forEach((f) => block.appendChild(fieldEl(f, i)));
  block.appendChild(childWeeksEl(i));
  return block;
}
function addChildBlock(wrap, group) {
  const i = wrap.querySelectorAll(".child-block").length;
  wrap.appendChild(childBlockEl(group, i));
  childCount = wrap.querySelectorAll(".child-block").length;
  renumberChildren(wrap);
  wrap.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
}
function removeChildBlock(block) {
  const wrap = block.parentElement;
  block.remove();
  // reindexa els blocs restants perquè els noms d'inputs segueixin sent únics
  [...wrap.querySelectorAll(".child-block")].forEach((b, idx) => reindexChildBlock(b, idx));
  childCount = wrap.querySelectorAll(".child-block").length || 1;
  renumberChildren(wrap);
}
function reindexChildBlock(block, idx) {
  block.dataset.child = String(idx);
  block.querySelectorAll("[data-scope]").forEach((c) => (c.dataset.scope = String(idx)));
  // refà els noms (radio/checkbox/setmanes) que depenen de l'índex
  block.querySelectorAll("[data-field]").forEach((c) => {
    if (!("field" in c.dataset)) return;
    const nm = `c${idx}__${c.dataset.field}`;
    c.dataset.name = nm;
    c.querySelectorAll(`input`).forEach((inp) => { if (inp.name) inp.name = nm; });
  });
  block.querySelectorAll('.weeks input[type="checkbox"]').forEach((inp) => (inp.name = `c${idx}__weeks`));
}
function renumberChildren(wrap) {
  const blocks = [...wrap.querySelectorAll(".child-block")];
  blocks.forEach((b, idx) => {
    b.querySelector(".child-block__title").textContent = blocks.length > 1 ? `Jugador/a ${idx + 1}` : "Dades del jugador/a";
    const rm = b.querySelector(".child-block__remove");
    if (rm) rm.style.display = blocks.length > 1 ? "" : "none";
  });
}
function refreshChildWeeks() {
  document.querySelectorAll(".child-block").forEach((block) => {
    const i = Number(block.dataset.child);
    const old = block.querySelector(".child-weeks");
    if (old) old.replaceWith(childWeeksEl(i));
  });
}
function weeksTitle() { return ((CONFIG && CONFIG.settings) || {}).setmanes_titulo || "Setmanes del casal"; }
function sectionEl(num, title, children) {
  const sec = document.createElement("section"); sec.className = "section";
  const head = document.createElement("div"); head.className = "section__head";
  head.innerHTML = `<span class="section__num">${String(num).padStart(2, "0")}</span><h2 class="section__title"></h2>`;
  head.querySelector(".section__title").textContent = title;
  sec.appendChild(head); children.forEach((c) => sec.appendChild(c));
  return sec;
}
function campusPickerEl(open) {
  const wrap = document.createElement("div"); wrap.className = "campus-pick";
  open.forEach((c) => {
    const card = document.createElement("button");
    card.type = "button"; card.className = "campus-card" + (c.id === currentCampus ? " is-selected" : "");
    card.dataset.campus = c.id;
    card.innerHTML = `<span class="campus-card__name"></span><span class="campus-card__meta"></span><span class="campus-card__check">✓</span>`;
    card.querySelector(".campus-card__name").textContent = c.nombre || c.id;
    card.querySelector(".campus-card__meta").textContent = c.fechas || "";
    card.addEventListener("click", () => {
      currentCampus = c.id;
      wrap.querySelectorAll(".campus-card").forEach((x) => x.classList.toggle("is-selected", x.dataset.campus === c.id));
      refreshChildWeeks();
    });
    wrap.appendChild(card);
  });
  return wrap;
}

function fieldEl(f, scope) {
  // nota: bloc de text sense input
  if (f.tipo === "nota") {
    const note = document.createElement("div"); note.className = "field note";
    if (f.etiqueta) { const t = document.createElement("p"); t.className = "note__title"; t.textContent = f.etiqueta; note.appendChild(t); }
    if (f.ayuda) { const b = document.createElement("p"); b.className = "note__body"; b.textContent = f.ayuda; note.appendChild(b); }
    return note;
  }

  // Quan el camp pertany a un jugador/a concret, l'identifiquem amb un sufix
  // d'àmbit (scope) perquè els noms d'input (radio/checkbox) i els ids siguin únics.
  const scoped = scope != null;
  const sfx = scoped ? `_c${scope}` : "";
  const nm = scoped ? `c${scope}__${f.id}` : f.id;

  const wrap = document.createElement("div");
  wrap.className = "field"; wrap.dataset.id = f.id; wrap.dataset.required = f.obligatorio ? "1" : "";
  if (scoped) wrap.dataset.scope = String(scope);

  const labId = `f_${f.id}${sfx}`;
  const req = f.obligatorio ? ` <span class="field__req">*</span>` : "";
  const label = document.createElement("label");
  label.className = "field__label"; label.setAttribute("for", labId);
  label.innerHTML = escapeHtml(f.etiqueta) + req;
  wrap.appendChild(label);

  const choiceLike = ["radio", "checkbox", "file"].includes(f.tipo);
  // ajuda a sobre per a opcions/fitxers (text contextual abans del control)
  if (f.ayuda && choiceLike) {
    const help = document.createElement("p"); help.className = "field__help field__help--above";
    help.textContent = f.ayuda; wrap.appendChild(help);
  }

  let control;
  const opts = (f.opciones || "").split("|").map((o) => o.trim()).filter(Boolean);
  switch (f.tipo) {
    case "file": control = fileControl(f, labId); break;
    case "textarea": control = el("textarea", "textarea"); break;
    case "select":
      control = el("select", "select");
      control.appendChild(opt("", "Tria una opció…"));
      opts.forEach((o) => control.appendChild(opt(o, o)));
      break;
    case "radio":
    case "checkbox": {
      control = document.createElement("div");
      control.className = "choices" + (f.tipo === "radio" && opts.length <= 3 ? " choices--inline" : "");
      opts.forEach((o, i) => {
        const c = document.createElement("label"); c.className = "choice";
        const input = document.createElement("input");
        input.type = f.tipo === "radio" ? "radio" : "checkbox";
        input.name = nm; input.value = o; if (i === 0) input.id = labId;
        const span = document.createElement("span"); span.textContent = o;
        c.append(input, span); control.appendChild(c);
      });
      break;
    }
    default:
      control = el("input", "input");
      control.type = ["email", "tel", "number", "date"].includes(f.tipo) ? f.tipo : "text";
      if (f.placeholder) control.placeholder = f.placeholder;
  }
  if (!control.id) control.id = labId;
  control.dataset.field = f.id; control.dataset.type = f.tipo || "text";
  control.dataset.name = nm;
  if (scoped) control.dataset.scope = String(scope);
  wrap.appendChild(control);

  if (f.ayuda && !choiceLike) {
    const help = document.createElement("p"); help.className = "field__help"; help.textContent = f.ayuda; wrap.appendChild(help);
  }
  const err = document.createElement("p"); err.className = "field__error"; err.textContent = "Aquest camp és obligatori.";
  wrap.appendChild(err);
  return wrap;
}

function fileControl(f, labId) {
  fileStore[f.id] = fileStore[f.id] || [];
  const box = document.createElement("div");
  box.className = "filebox-wrap"; box.dataset.field = f.id; box.dataset.type = "file"; box.id = labId;
  const accept = f.opciones || "image/*,application/pdf";
  const drop = document.createElement("label"); drop.className = "filebox";
  drop.innerHTML = `<input type="file" accept="${escapeHtml(accept)}" multiple />
    <div class="filebox__icon" aria-hidden="true">📎</div>
    <div class="filebox__text">Tria fitxers o arrossega'ls aquí</div>
    <div class="filebox__hint">Fins a ${MAX_FILE_MB} MB per fitxer</div>`;
  const input = drop.querySelector("input");
  const chips = document.createElement("div"); chips.className = "file-chips";

  const renderChips = () => {
    chips.innerHTML = "";
    fileStore[f.id].forEach((fl, idx) => {
      const chip = document.createElement("div"); chip.className = "file-chip";
      const isImg = (fl.mimeType || "").startsWith("image/");
      chip.innerHTML = `${isImg ? `<img class="file-chip__thumb" alt="" src="data:${fl.mimeType};base64,${fl.dataBase64}" />` : `<span class="file-chip__thumb">PDF</span>`}
        <span class="file-chip__name"></span><span class="file-chip__size">${fmtSize(fl.size)}</span>
        <button type="button" class="file-chip__remove" aria-label="Treure">✕</button>`;
      chip.querySelector(".file-chip__name").textContent = fl.name;
      chip.querySelector(".file-chip__remove").addEventListener("click", () => { fileStore[f.id].splice(idx, 1); renderChips(); });
      chips.appendChild(chip);
    });
  };
  const addFiles = async (list) => {
    for (const file of list) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) { flashNote(`"${file.name}" supera els ${MAX_FILE_MB} MB.`); continue; }
      try { const dataBase64 = await readFileBase64(file); fileStore[f.id].push({ name: file.name, mimeType: file.type, dataBase64, size: file.size }); renderChips(); }
      catch { flashNote(`No s'ha pogut llegir "${file.name}".`); }
    }
    input.value = "";
  };
  input.addEventListener("change", (e) => addFiles(e.target.files));
  ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-drag"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });
  box.append(drop, chips);
  return box;
}

function weeksForCampus() {
  const all = CONFIG.weeks || [];
  if (!currentCampus) return all.filter((w) => !w.campus).length ? all.filter((w) => !w.campus) : all;
  if (!all.some((w) => w.campus)) return all;
  return all.filter((w) => w.campus === currentCampus);
}
function childWeeksEl(i) {
  const wrap = document.createElement("div"); wrap.className = "field child-weeks"; wrap.dataset.weeks = "1"; wrap.dataset.child = String(i);
  const lab = document.createElement("p"); lab.className = "field__label"; lab.textContent = weeksTitle(); wrap.appendChild(lab);
  const list = document.createElement("div"); list.className = "weeks";
  const weeks = weeksForCampus();
  if (!weeks.length) { const p = document.createElement("p"); p.className = "field__help"; p.textContent = "Aquest casal encara no té setmanes definides."; wrap.appendChild(p); return wrap; }

  weeks.forEach((w, idx) => {
    const full = w.plazas_restantes != null && Number(w.plazas_restantes) <= 0;
    const lab = document.createElement("label"); lab.className = "week" + (full ? " is-full" : ""); lab.dataset.week = w.id;
    const input = document.createElement("input");
    input.type = "checkbox"; input.value = w.id; input.name = `c${i}__weeks`; input.disabled = full;
    input.addEventListener("change", () => lab.classList.toggle("is-selected", input.checked));
    const remaining = w.plazas_restantes != null ? (full ? `<span class="week__tag">Complet</span>` : `<span class="week__meta"> · queden ${w.plazas_restantes}</span>`) : "";
    lab.innerHTML = `<span class="week__num">${idx + 1}</span>
      <span class="week__body"><span class="week__label">${escapeHtml(w.etiqueta)}</span>
      <span class="week__meta">${escapeHtml(w.fechas || "")}</span>${remaining}</span>
      <span class="week__price">${escapeHtml(w.precio || "")}</span>
      <span class="week__check">✓</span>`;
    lab.prepend(input); list.appendChild(lab);
  });
  wrap.appendChild(list);
  const err = document.createElement("p"); err.className = "field__error"; err.textContent = "Tria almenys una setmana.";
  wrap.appendChild(err);
  return wrap;
}

// ---- Recollida + validació ----
// Llegeix el valor d'un control (input/select/choices) dins d'una arrel donada.
function readControl(c, root) {
  if (c.dataset.type === "checkbox") return [...root.querySelectorAll(`input[name="${c.dataset.name}"]:checked`)].map((i) => i.value).join(", ");
  if (c.dataset.type === "radio") { const sel = root.querySelector(`input[name="${c.dataset.name}"]:checked`); return sel ? sel.value : ""; }
  return c.value.trim();
}
function collect() {
  // Camps compartits (tutor, autoritzacions, documentació…): tots els que NO són d'un jugador/a.
  const shared = {};
  els.sections.querySelectorAll("[data-field]").forEach((c) => {
    if (c.dataset.scope != null && c.dataset.scope !== "") return; // pertany a un fill → s'agafa a sota
    if (c.dataset.type === "file") return;
    shared[c.dataset.field] = readControl(c, els.sections);
  });
  const files = [];
  Object.keys(fileStore).forEach((fid) => fileStore[fid].forEach((fl) => files.push({ field: fid, name: fl.name, mimeType: fl.mimeType, dataBase64: fl.dataBase64 })));

  // Un bloc per cada jugador/a: dades pròpies + setmanes pròpies.
  const children = [];
  document.querySelectorAll(".child-block").forEach((block) => {
    const data = {};
    block.querySelectorAll("[data-field]").forEach((c) => {
      if (c.dataset.type === "file") return;
      data[c.dataset.field] = readControl(c, block);
    });
    const weeks = [...block.querySelectorAll(".weeks input:checked")].map((i) => i.value);
    children.push({ data, weeks });
  });
  return { shared, children, files };
}
function validate() {
  let ok = true, firstBad = null;
  els.sections.querySelectorAll(".field[data-required='1']").forEach((wrap) => {
    const c = wrap.querySelector("[data-field]"); let empty;
    if (c.dataset.type === "file") empty = !(fileStore[c.dataset.field] && fileStore[c.dataset.field].length);
    else if (c.dataset.type === "checkbox" || c.dataset.type === "radio") empty = !wrap.querySelector("input:checked");
    else {
      empty = !c.value.trim();
      if (c.dataset.type === "email" && c.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.value.trim())) { empty = true; wrap.querySelector(".field__error").textContent = "Introdueix un correu vàlid."; }
    }
    wrap.classList.toggle("field--invalid", empty);
    if (empty && !firstBad) firstBad = wrap; if (empty) ok = false;
  });
  // Setmanes obligatòries: cada jugador/a n'ha de tenir almenys una.
  if (CONFIG.settings && CONFIG.settings.semanas_obligatorias && weeksForCampus().length) {
    els.sections.querySelectorAll("[data-weeks]").forEach((wrap) => {
      const none = !wrap.querySelector('input[type="checkbox"]:checked');
      wrap.classList.toggle("field--invalid", none);
      if (none && !firstBad) firstBad = wrap; if (none) ok = false;
    });
  }
  if (firstBad) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
  return ok;
}

// ---- Enviament ----
async function onSubmit(e) {
  e.preventDefault();
  els.submitNote.textContent = ""; els.submitNote.classList.remove("is-error");
  if (!document.getElementById("consent").checked) return flashNote("Cal acceptar la política de protecció de dades.");
  if (!validate()) return flashNote("Revisa els camps marcats.");
  const { shared, children, files } = collect();
  const totalBytes = files.reduce((s, f) => s + f.dataBase64.length * 0.75, 0);
  if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) return flashNote(`Els fitxers sumen massa (màx ${MAX_TOTAL_MB} MB).`);
  const campus = (CONFIG.campuses || []).find((c) => c.id === currentCampus);
  const all = weeksForCampus();
  const childrenPayload = children.map((ch) => ({
    data: ch.data,
    weeks: ch.weeks,
    weekLabels: all.filter((w) => ch.weeks.includes(w.id)).map((w) => `${w.id} (${w.fechas || w.etiqueta})`)
  }));
  const campusName = campus ? campus.nombre : "";
  const payload = {
    form: FORM_ID, formName: (CONFIG.form && CONFIG.form.nombre) || "",
    campusId: currentCampus || "", campusName,
    shared, children: childrenPayload, files, ts: new Date().toISOString()
  };

  setLoading(true);
  try {
    const result = await send(payload);
    saveLocal(shared, childrenPayload, campusName);
    showDone(shared, childrenPayload, campusName, result);
  } catch (err) { console.error(err); flashNote("No s'ha pogut enviar. Torna-ho a provar en uns segons."); }
  finally { setLoading(false); }
}
async function send(payload) {
  if (!SCRIPT_URL) { await new Promise((r) => setTimeout(r, 700)); return { ok: true, demo: true, id: "DEMO-" + Date.now() }; }
  const res = await fetch(SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "error servidor");
  return out;
}
function setLoading(on) { els.submitBtn.disabled = on; els.submitBtn.classList.toggle("is-loading", on); }
function flashNote(msg) { els.submitNote.textContent = msg; els.submitNote.classList.add("is-error"); }

// ---- Èxit ----
function showDone(shared, children, campusName, result) {
  els.form.hidden = true; els.returning.hidden = true; els.done.hidden = false;
  const s = CONFIG.settings || {};
  els.doneText.textContent = (s.mensaje_exito || "Inscripció rebuda correctament.") + (result && result.demo ? "  (mode demo: encara no s'ha guardat enlloc)" : "");
  const items = [];
  if (campusName) items.push(["Casal", campusName]);
  children.forEach((ch, i) => {
    const name = ch.data.nom_jugador || pickName(ch.data);
    if (!name && !(ch.weekLabels || []).length) return;
    const key = children.length > 1 ? `Jugador/a ${i + 1}` : "Jugador/a";
    const val = [name, (ch.weekLabels || []).join(", ")].filter(Boolean).join(" · ");
    items.push([key, val]);
  });
  const email = findEmail(shared);
  if (email) items.push(["Correu", email]);
  els.doneSummary.innerHTML = "<dl>" + items.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("") + "</dl>";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resetForNew() {
  els.done.hidden = true; els.form.hidden = false; els.form.reset();
  Object.keys(fileStore).forEach((k) => (fileStore[k] = []));
  childCount = 1; returningDismissed = false;
  renderForm(); els.submitNote.textContent = ""; maybeShowReturning();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- localStorage ----
function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { families: [] }; } catch { return { families: [] }; } }
function familyLabel(entry) {
  const names = (entry.children || []).map((ch) => ch.data && (ch.data.nom_jugador || pickName(ch.data))).filter(Boolean);
  return names.join(" + ") || entry.email || "";
}
function saveLocal(shared, children, campusName) {
  const store = loadLocal();
  const email = findEmail(shared);
  const entry = {
    email, shared, campusName, ts: Date.now(),
    children: (children || []).map((ch) => ({ data: ch.data, weeks: ch.weeks, weekLabels: ch.weekLabels }))
  };
  const label = familyLabel(entry);
  store.families = (store.families || []).filter((f) => familyLabel(f) !== label || f.email !== email);
  store.families.unshift(entry); store.families = store.families.slice(0, 8);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {}
}
function maybeShowReturning() {
  if (returningDismissed) { els.returning.hidden = true; return; }
  const store = loadLocal();
  // Només mostrem inscripcions anteriors amb dades útils (nom o correu).
  const fams = (store.families || []).filter((f) => familyLabel(f));
  if (!fams.length) { els.returning.hidden = true; return; }
  els.returningActions.innerHTML = "";
  els.returningText.textContent = fams.length === 1 ? "Vols recuperar les dades de l'última inscripció?" : "Tria una inscripció per omplir les dades automàticament:";
  fams.forEach((f) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.textContent = familyLabel(f) + ((f.children || []).length > 1 ? ` (${f.children.length} fills)` : "");
    b.addEventListener("click", () => { prefillFamily(f); els.returning.hidden = true; });
    els.returningActions.appendChild(b);
  });
  els.returning.hidden = false;
}
// Omple els controls (no-fitxer) d'una arrel amb les dades d'un objecte.
function fillControlsIn(root, data, skipScoped) {
  root.querySelectorAll("[data-field]").forEach((c) => {
    if (skipScoped && c.dataset.scope != null && c.dataset.scope !== "") return;
    const id = c.dataset.field;
    if (c.dataset.type === "file" || !data || !(id in data)) return;
    const val = data[id];
    if (c.dataset.type === "checkbox") { const set = new Set(String(val).split(",").map((x) => x.trim())); root.querySelectorAll(`input[name="${c.dataset.name}"]`).forEach((i) => (i.checked = set.has(i.value))); }
    else if (c.dataset.type === "radio") { root.querySelectorAll(`input[name="${c.dataset.name}"]`).forEach((i) => { i.checked = i.value === val; i.closest(".choice")?.classList.toggle("is-on", i.checked); }); }
    else c.value = val;
  });
}
function prefillFamily(entry) {
  // Recrea tants blocs de fill com tingués la inscripció guardada.
  childCount = Math.max(1, (entry.children || []).length);
  renderForm();
  fillControlsIn(els.sections, entry.shared, true); // camps compartits
  const blocks = [...document.querySelectorAll(".child-block")];
  (entry.children || []).forEach((ch, i) => {
    const block = blocks[i]; if (!block) return;
    fillControlsIn(block, ch.data, false);
    (ch.weeks || []).forEach((wid) => {
      const inp = block.querySelector(`.weeks input[value="${wid}"]`);
      if (inp && !inp.disabled) { inp.checked = true; inp.dispatchEvent(new Event("change")); }
    });
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- Helpers ----
function readFileBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("read")); r.readAsDataURL(file); });
}
function fmtSize(b) { return b < 1024 * 1024 ? Math.round(b / 1024) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB"; }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function opt(v, t) { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; }
function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function findEmail(data) { if (data.email) return data.email; for (const k in data) if (/email|correu|correo/i.test(k) && /@/.test(data[k])) return data[k]; return ""; }
function pickName(data) {
  const keys = Object.keys(data);
  const nameKey = keys.find((k) => /nom|nombre/i.test(k) && !/tutor|pare|mare|padre|madre/i.test(k));
  const surKey = keys.find((k) => /cognom|apellido/i.test(k));
  return [data[nameKey], data[surKey]].filter(Boolean).join(" ").trim();
}
