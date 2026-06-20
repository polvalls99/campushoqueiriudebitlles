/* ============================================================
   Campus d'hoquei patins — frontend logic
   Formulari generat des de la config (Google Sheet).
   Suporta: múltiples campus, adjuntar fitxers, prefill local.
   ============================================================ */

// 🔧 Enganxa aquí la URL del teu Apps Script (acaba en /exec).
// Buida = MODE DEMO amb dades d'exemple.
const SCRIPT_URL = "";

const STORAGE_KEY = "campus_inscripcions_v1";
const MAX_FILE_MB = 5;     // mida màxima per fitxer
const MAX_TOTAL_MB = 12;   // mida màxima total de l'enviament

// ---- Config d'exemple (mode demo) ----
const DEMO_CONFIG = {
  settings: {
    nombre_campus: "Campus d'Hoquei Patins",
    temporada: "2026",
    lema: "Inscripcions obertes",
    hero_titulo: "Apunta el teu fill al campus",
    intro: "Tria el campus i les setmanes, adjunta la documentació i rep la confirmació al correu.",
    email_contacto: "info@elteuclub.cat",
    texto_boton: "Confirmar inscripció",
    mensaje_exito: "T'hem enviat un correu amb tots els detalls de la inscripció.",
    consentimiento: "Com a pare/mare o tutor/a, autoritzo la inscripció del meu fill/a i el tractament de les dades per organitzar el campus.",
    semanas_obligatorias: true
  },
  campuses: [
    { id: "estiu", nombre: "Campus d'Estiu", fechas: "Juliol 2026", habilitado: true },
    { id: "nadal", nombre: "Campus de Nadal", fechas: "Desembre 2026", habilitado: true },
    { id: "setmanasanta", nombre: "Campus de Setmana Santa", fechas: "Abril 2026", habilitado: false }
  ],
  weeks: [
    { id: "e1", campus: "estiu", etiqueta: "Setmana 1", fechas: "29 jun – 3 jul", precio: "120 €", plazas: 20, plazas_restantes: 6 },
    { id: "e2", campus: "estiu", etiqueta: "Setmana 2", fechas: "6 jul – 10 jul", precio: "120 €", plazas: 20, plazas_restantes: 14 },
    { id: "e3", campus: "estiu", etiqueta: "Setmana 3", fechas: "13 jul – 17 jul", precio: "120 €", plazas: 20, plazas_restantes: 0 },
    { id: "n1", campus: "nadal", etiqueta: "Torn únic", fechas: "23 des – 3 gen", precio: "95 €", plazas: 24, plazas_restantes: 18 }
  ],
  fields: [
    { id: "nom_nen", etiqueta: "Nom del nen/a", tipo: "text", obligatorio: true, grupo: "Dades del nen/a", orden: 1 },
    { id: "cognoms_nen", etiqueta: "Cognoms", tipo: "text", obligatorio: true, grupo: "Dades del nen/a", orden: 2 },
    { id: "data_naixement", etiqueta: "Data de naixement", tipo: "date", obligatorio: true, grupo: "Dades del nen/a", orden: 3 },
    { id: "talla", etiqueta: "Talla de samarreta", tipo: "select", opciones: "6|8|10|12|14|S|M|L", obligatorio: true, grupo: "Dades del nen/a", orden: 4 },
    { id: "nivell", etiqueta: "Nivell", tipo: "select", opciones: "Iniciació|Federat|Competició", obligatorio: false, grupo: "Dades del nen/a", orden: 5 },
    { id: "alergies", etiqueta: "Al·lèrgies o observacions mèdiques", tipo: "textarea", obligatorio: false, ayuda: "Deixa-ho en blanc si no n'hi ha cap.", grupo: "Dades del nen/a", orden: 6 },
    { id: "targeta_sanitaria", etiqueta: "Còpia de la targeta sanitària", tipo: "file", opciones: "image/*,application/pdf", obligatorio: true, ayuda: "Foto o PDF. Màx 5 MB.", grupo: "Documentació", orden: 7 },
    { id: "foto", etiqueta: "Foto del nen/a", tipo: "file", opciones: "image/*", obligatorio: false, ayuda: "Opcional.", grupo: "Documentació", orden: 8 },
    { id: "nom_tutor", etiqueta: "Nom del pare/mare o tutor/a", tipo: "text", obligatorio: true, grupo: "Dades de contacte", orden: 9 },
    { id: "email", etiqueta: "Correu electrònic", tipo: "email", obligatorio: true, ayuda: "Hi enviarem la confirmació.", grupo: "Dades de contacte", orden: 10 },
    { id: "telefon", etiqueta: "Telèfon", tipo: "tel", obligatorio: true, grupo: "Dades de contacte", orden: 11 }
  ]
};

// ---- Estat ----
let CONFIG = null;
let currentCampus = null;          // id del campus seleccionat
const fileStore = {};              // { fieldId: [ {name, mimeType, dataBase64, size} ] }
const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cache();
  els.retry.addEventListener("click", load);
  els.form.addEventListener("submit", onSubmit);
  els.another.addEventListener("click", resetForNew);
  els.returningClose.addEventListener("click", () => (els.returning.hidden = true));
  await load();
}

function cache() {
  const id = (x) => document.getElementById(x);
  els.loading = id("loading");
  els.loadError = id("load-error");
  els.loadErrorHint = id("load-error-hint");
  els.closed = id("closed");
  els.closedTitle = id("closed-title");
  els.closedText = id("closed-text");
  els.retry = id("retry");
  els.form = id("form");
  els.sections = id("form-sections");
  els.submitBtn = id("submit-btn");
  els.submitNote = id("submit-note");
  els.done = id("done");
  els.doneText = id("done-text");
  els.doneSummary = id("done-summary");
  els.another = id("another");
  els.returning = id("returning");
  els.returningText = id("returning-text");
  els.returningActions = id("returning-actions");
  els.returningClose = id("returning-close");
  els.consentText = id("consent-text");
}

// ---- Càrrega ----
async function load() {
  els.loading.hidden = false;
  els.loadError.hidden = true;
  els.closed.hidden = true;
  els.form.hidden = true;
  els.done.hidden = true;

  try {
    CONFIG = await fetchConfig();
    applySettings(CONFIG.settings || {});

    const open = enabledCampuses();
    // Si hi ha pestanya de campus però cap habilitat → tancat
    if (CONFIG.campuses && CONFIG.campuses.length && open.length === 0) {
      els.loading.hidden = true;
      els.closed.hidden = false;
      return;
    }
    currentCampus = open.length ? open[0].id : null;

    renderForm();
    els.loading.hidden = true;
    els.form.hidden = false;
    maybeShowReturning();
  } catch (err) {
    console.error(err);
    els.loading.hidden = true;
    els.loadError.hidden = false;
    if (!SCRIPT_URL) els.loadErrorHint.textContent =
      "Encara no has configurat la URL del servidor (SCRIPT_URL a app.js).";
  }
}

async function fetchConfig() {
  if (!SCRIPT_URL) return structuredClone(DEMO_CONFIG);
  const res = await fetch(`${SCRIPT_URL}?action=config`, { method: "GET" });
  if (!res.ok) throw new Error("config HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function enabledCampuses() {
  return (CONFIG.campuses || []).filter((c) => c.habilitado !== false);
}

// ---- Settings al chrome ----
function applySettings(s) {
  const setText = (sel, val) =>
    document.querySelectorAll(sel).forEach((n) => { if (val != null) n.textContent = val; });
  setText("[data-camp-name]", s.nombre_campus);
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
  let n = 0;

  // Secció 0: selector de campus (només si n'hi ha més d'un d'habilitat)
  const open = enabledCampuses();
  if (open.length > 1) {
    n++;
    els.sections.appendChild(sectionEl(n, "Tria el campus", [campusPickerEl(open)]));
  }

  // Seccions de camps, agrupades per "grupo"
  const fields = [...(CONFIG.fields || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const groups = [];
  const byName = {};
  for (const f of fields) {
    const g = f.grupo || "Inscripció";
    if (!byName[g]) { byName[g] = { name: g, fields: [] }; groups.push(byName[g]); }
    byName[g].fields.push(f);
  }
  for (const g of groups) {
    n++;
    els.sections.appendChild(sectionEl(n, g.name, g.fields.map(fieldEl)));
  }

  // Secció de setmanes (depèn del campus seleccionat)
  if (weeksForCampus().length || (CONFIG.weeks || []).length) {
    n++;
    const sec = sectionEl(n, "Setmanes del campus", [weeksEl()]);
    sec.id = "weeks-section";
    els.sections.appendChild(sec);
  }
}

function rerenderWeeks() {
  const old = document.getElementById("weeks-section");
  if (!old) return;
  const num = old.querySelector(".section__num").textContent;
  const fresh = sectionEl(parseInt(num, 10), "Setmanes del campus", [weeksEl()]);
  fresh.id = "weeks-section";
  old.replaceWith(fresh);
}

function sectionEl(num, title, children) {
  const sec = document.createElement("section");
  sec.className = "section";
  const head = document.createElement("div");
  head.className = "section__head";
  head.innerHTML = `<span class="section__num">${String(num).padStart(2, "0")}</span>
                    <h2 class="section__title"></h2>`;
  head.querySelector(".section__title").textContent = title;
  sec.appendChild(head);
  children.forEach((c) => sec.appendChild(c));
  return sec;
}

function campusPickerEl(open) {
  const wrap = document.createElement("div");
  wrap.className = "campus-pick";
  open.forEach((c) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "campus-card" + (c.id === currentCampus ? " is-selected" : "");
    card.dataset.campus = c.id;
    card.innerHTML = `
      <span class="campus-card__name"></span>
      <span class="campus-card__meta"></span>
      <span class="campus-card__check">✓</span>`;
    card.querySelector(".campus-card__name").textContent = c.nombre || c.id;
    card.querySelector(".campus-card__meta").textContent = c.fechas || "";
    card.addEventListener("click", () => {
      currentCampus = c.id;
      wrap.querySelectorAll(".campus-card").forEach((x) =>
        x.classList.toggle("is-selected", x.dataset.campus === c.id));
      rerenderWeeks();
    });
    wrap.appendChild(card);
  });
  return wrap;
}

function fieldEl(f) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.dataset.id = f.id;
  wrap.dataset.required = f.obligatorio ? "1" : "";

  const labId = `f_${f.id}`;
  const req = f.obligatorio ? ` <span class="field__req">*</span>` : "";
  const label = document.createElement("label");
  label.className = "field__label";
  label.setAttribute("for", labId);
  label.innerHTML = escapeHtml(f.etiqueta) + req;
  wrap.appendChild(label);

  let control;
  const opts = (f.opciones || "").split("|").map((o) => o.trim()).filter(Boolean);

  switch (f.tipo) {
    case "file":
      control = fileControl(f, labId);
      break;
    case "textarea":
      control = el("textarea", "textarea");
      break;
    case "select":
      control = el("select", "select");
      control.appendChild(opt("", "Tria una opció…"));
      opts.forEach((o) => control.appendChild(opt(o, o)));
      break;
    case "radio":
    case "checkbox": {
      control = document.createElement("div");
      control.className = "choices";
      opts.forEach((o, i) => {
        const c = document.createElement("label");
        c.className = "choice";
        const input = document.createElement("input");
        input.type = f.tipo === "radio" ? "radio" : "checkbox";
        input.name = f.id; input.value = o;
        if (i === 0) input.id = labId;
        const span = document.createElement("span");
        span.textContent = o;
        c.append(input, span);
        control.appendChild(c);
      });
      break;
    }
    default:
      control = el("input", "input");
      control.type = ["email", "tel", "number", "date"].includes(f.tipo) ? f.tipo : "text";
      if (f.placeholder) control.placeholder = f.placeholder;
  }

  if (!control.id) control.id = labId;
  control.dataset.field = f.id;
  control.dataset.type = f.tipo || "text";
  wrap.appendChild(control);

  if (f.ayuda) {
    const help = document.createElement("p");
    help.className = "field__help";
    help.textContent = f.ayuda;
    wrap.appendChild(help);
  }
  const err = document.createElement("p");
  err.className = "field__error";
  err.textContent = "Aquest camp és obligatori.";
  wrap.appendChild(err);
  return wrap;
}

// ---- Camp de fitxers ----
function fileControl(f, labId) {
  fileStore[f.id] = fileStore[f.id] || [];
  const box = document.createElement("div");
  box.className = "filebox-wrap";
  box.dataset.field = f.id;
  box.dataset.type = "file";
  box.id = labId;

  const accept = f.opciones || "image/*,application/pdf";
  const drop = document.createElement("label");
  drop.className = "filebox";
  drop.innerHTML = `
    <input type="file" accept="${escapeHtml(accept)}" multiple />
    <div class="filebox__icon" aria-hidden="true">📎</div>
    <div class="filebox__text">Tria fitxers o arrossega'ls aquí</div>
    <div class="filebox__hint">Fins a ${MAX_FILE_MB} MB per fitxer</div>`;
  const input = drop.querySelector("input");
  const chips = document.createElement("div");
  chips.className = "file-chips";

  const addFiles = async (list) => {
    for (const file of list) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        flashNote(`"${file.name}" supera els ${MAX_FILE_MB} MB.`); continue;
      }
      try {
        const dataBase64 = await readFileBase64(file);
        fileStore[f.id].push({ name: file.name, mimeType: file.type, dataBase64, size: file.size });
        renderChips();
      } catch { flashNote(`No s'ha pogut llegir "${file.name}".`); }
    }
    input.value = "";
  };

  const renderChips = () => {
    chips.innerHTML = "";
    fileStore[f.id].forEach((fl, idx) => {
      const chip = document.createElement("div");
      chip.className = "file-chip";
      const isImg = (fl.mimeType || "").startsWith("image/");
      chip.innerHTML = `
        ${isImg
          ? `<img class="file-chip__thumb" alt="" src="data:${fl.mimeType};base64,${fl.dataBase64}" />`
          : `<span class="file-chip__thumb">PDF</span>`}
        <span class="file-chip__name"></span>
        <span class="file-chip__size">${fmtSize(fl.size)}</span>
        <button type="button" class="file-chip__remove" aria-label="Treure">✕</button>`;
      chip.querySelector(".file-chip__name").textContent = fl.name;
      chip.querySelector(".file-chip__remove").addEventListener("click", () => {
        fileStore[f.id].splice(idx, 1); renderChips();
      });
      chips.appendChild(chip);
    });
  };

  input.addEventListener("change", (e) => addFiles(e.target.files));
  ["dragover", "dragenter"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-drag"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });

  box.append(drop, chips);
  return box;
}

function weeksForCampus() {
  const all = CONFIG.weeks || [];
  if (!currentCampus) return all.filter((w) => !w.campus); // sense campus = genèriques
  // si cap setmana té camp 'campus', mostra-les totes
  if (!all.some((w) => w.campus)) return all;
  return all.filter((w) => w.campus === currentCampus);
}

function weeksEl() {
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.dataset.weeks = "1";
  const list = document.createElement("div");
  list.className = "weeks";
  const weeks = weeksForCampus();

  if (!weeks.length) {
    const p = document.createElement("p");
    p.className = "field__help";
    p.textContent = "Aquest campus encara no té setmanes definides.";
    wrap.appendChild(p);
    return wrap;
  }

  weeks.forEach((w, i) => {
    const full = w.plazas_restantes != null && Number(w.plazas_restantes) <= 0;
    const lab = document.createElement("label");
    lab.className = "week" + (full ? " is-full" : "");
    lab.dataset.week = w.id;
    const input = document.createElement("input");
    input.type = "checkbox"; input.value = w.id; input.name = "_weeks"; input.disabled = full;
    input.addEventListener("change", () => lab.classList.toggle("is-selected", input.checked));
    const remaining = w.plazas_restantes != null
      ? (full ? `<span class="week__tag">Complet</span>`
              : `<span class="week__meta"> · queden ${w.plazas_restantes}</span>`)
      : "";
    lab.innerHTML = `
      <span class="week__num">${i + 1}</span>
      <span class="week__body">
        <span class="week__label">${escapeHtml(w.etiqueta)}</span>
        <span class="week__meta">${escapeHtml(w.fechas || "")}</span>${remaining}
      </span>
      <span class="week__price">${escapeHtml(w.precio || "")}</span>
      <span class="week__check">✓</span>`;
    lab.prepend(input);
    list.appendChild(lab);
  });
  wrap.appendChild(list);
  const err = document.createElement("p");
  err.className = "field__error";
  err.textContent = "Tria almenys una setmana.";
  wrap.appendChild(err);
  return wrap;
}

// ---- Recollida + validació ----
function collect() {
  const data = {};
  els.sections.querySelectorAll("[data-field]").forEach((c) => {
    const id = c.dataset.field;
    if (c.dataset.type === "file") return; // els fitxers van a part
    if (c.dataset.type === "checkbox") {
      data[id] = [...els.sections.querySelectorAll(`input[name="${id}"]:checked`)].map((i) => i.value).join(", ");
    } else if (c.dataset.type === "radio") {
      const sel = els.sections.querySelector(`input[name="${id}"]:checked`);
      data[id] = sel ? sel.value : "";
    } else {
      data[id] = c.value.trim();
    }
  });
  const weeks = [...els.sections.querySelectorAll('input[name="_weeks"]:checked')].map((i) => i.value);
  const files = [];
  Object.keys(fileStore).forEach((fid) =>
    fileStore[fid].forEach((fl) => files.push({ field: fid, name: fl.name, mimeType: fl.mimeType, dataBase64: fl.dataBase64 })));
  return { data, weeks, files };
}

function validate() {
  let ok = true, firstBad = null;
  els.sections.querySelectorAll(".field[data-required='1']").forEach((wrap) => {
    const c = wrap.querySelector("[data-field]");
    let empty;
    if (c.dataset.type === "file") {
      empty = !(fileStore[c.dataset.field] && fileStore[c.dataset.field].length);
    } else if (c.dataset.type === "checkbox" || c.dataset.type === "radio") {
      empty = !wrap.querySelector("input:checked");
    } else {
      empty = !c.value.trim();
      if (c.dataset.type === "email" && c.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.value.trim())) {
        empty = true; wrap.querySelector(".field__error").textContent = "Introdueix un correu vàlid.";
      }
    }
    wrap.classList.toggle("field--invalid", empty);
    if (empty && !firstBad) firstBad = wrap;
    if (empty) ok = false;
  });
  if (CONFIG.settings && CONFIG.settings.semanas_obligatorias && weeksForCampus().length) {
    const wrap = els.sections.querySelector("[data-weeks]");
    const none = !wrap.querySelector('input[name="_weeks"]:checked');
    wrap.classList.toggle("field--invalid", none);
    if (none && !firstBad) firstBad = wrap;
    if (none) ok = false;
  }
  if (firstBad) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
  return ok;
}

// ---- Enviament ----
async function onSubmit(e) {
  e.preventDefault();
  els.submitNote.textContent = "";
  els.submitNote.classList.remove("is-error");

  const consent = document.getElementById("consent");
  if (!consent.checked) return flashNote("Cal acceptar l'autorització per continuar.");
  if (!validate()) return flashNote("Revisa els camps marcats.");

  const { data, weeks, files } = collect();

  const totalBytes = files.reduce((s, f) => s + (f.dataBase64.length * 0.75), 0);
  if (totalBytes > MAX_TOTAL_MB * 1024 * 1024)
    return flashNote(`Els fitxers sumen massa (màx ${MAX_TOTAL_MB} MB). Treu-ne algun o redueix-ne la mida.`);

  const campus = (CONFIG.campuses || []).find((c) => c.id === currentCampus);
  const weekLabels = weeksForCampus().filter((w) => weeks.includes(w.id)).map((w) => w.etiqueta);
  const payload = {
    campusId: currentCampus || "",
    campusName: campus ? campus.nombre : "",
    data, weeks, weekLabels, files,
    ts: new Date().toISOString()
  };

  setLoading(true);
  try {
    const result = await send(payload);
    saveLocal(data, weekLabels, payload.campusName);
    showDone(data, weekLabels, payload.campusName, result);
  } catch (err) {
    console.error(err);
    flashNote("No s'ha pogut enviar. Torna-ho a provar en uns segons.");
  } finally {
    setLoading(false);
  }
}

async function send(payload) {
  if (!SCRIPT_URL) { await new Promise((r) => setTimeout(r, 700)); return { ok: true, demo: true, id: "DEMO-" + Date.now() }; }
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS
    body: JSON.stringify(payload)
  });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "error servidor");
  return out;
}

function setLoading(on) { els.submitBtn.disabled = on; els.submitBtn.classList.toggle("is-loading", on); }
function flashNote(msg) { els.submitNote.textContent = msg; els.submitNote.classList.add("is-error"); }

// ---- Èxit ----
function showDone(data, weekLabels, campusName, result) {
  els.form.hidden = true; els.returning.hidden = true; els.done.hidden = false;
  const s = CONFIG.settings || {};
  els.doneText.textContent = (s.mensaje_exito || "Inscripció rebuda correctament.") +
    (result && result.demo ? "  (mode demo: encara no s'ha guardat enlloc)" : "");
  const items = [];
  const name = pickName(data);
  if (campusName) items.push(["Campus", campusName]);
  if (name) items.push(["Nen/a", name]);
  if (weekLabels.length) items.push(["Setmanes", weekLabels.join(", ")]);
  const email = findEmail(data);
  if (email) items.push(["Correu", email]);
  els.doneSummary.innerHTML = "<dl>" +
    items.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("") + "</dl>";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForNew() {
  els.done.hidden = true; els.form.hidden = false; els.form.reset();
  Object.keys(fileStore).forEach((k) => (fileStore[k] = []));
  renderForm();
  els.submitNote.textContent = "";
  maybeShowReturning();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- localStorage ----
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { families: [] }; }
  catch { return { families: [] }; }
}
function saveLocal(data, weekLabels, campusName) {
  const store = loadLocal();
  const email = findEmail(data), child = pickName(data);
  const entry = { email, child, data, weekLabels, campusName, ts: Date.now() };
  store.families = (store.families || []).filter((f) => !(f.email === email && f.child === child));
  store.families.unshift(entry);
  store.families = store.families.slice(0, 8);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {}
}
function maybeShowReturning() {
  const store = loadLocal();
  if (!store.families || !store.families.length) { els.returning.hidden = true; return; }
  els.returningActions.innerHTML = "";
  els.returningText.textContent = store.families.length === 1
    ? "Vols recuperar les dades de l'última inscripció?"
    : "Tria un nen/a per omplir les dades automàticament:";
  store.families.forEach((f) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip";
    b.textContent = f.child || f.email || "Inscripció anterior";
    b.addEventListener("click", () => { prefill(f.data); els.returning.hidden = true; });
    els.returningActions.appendChild(b);
  });
  els.returning.hidden = false;
}
function prefill(data) {
  els.sections.querySelectorAll("[data-field]").forEach((c) => {
    const id = c.dataset.field;
    if (c.dataset.type === "file") return; // els fitxers no es reomplen (s'han de tornar a adjuntar)
    if (!(id in data)) return;
    const val = data[id];
    if (c.dataset.type === "checkbox") {
      const set = new Set(String(val).split(",").map((x) => x.trim()));
      els.sections.querySelectorAll(`input[name="${id}"]`).forEach((i) => (i.checked = set.has(i.value)));
    } else if (c.dataset.type === "radio") {
      els.sections.querySelectorAll(`input[name="${id}"]`).forEach((i) => (i.checked = i.value === val));
    } else { c.value = val; }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- Helpers ----
function readFileBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(file);
  });
}
function fmtSize(b) { return b < 1024 * 1024 ? Math.round(b / 1024) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB"; }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function opt(v, t) { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; }
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function findEmail(data) {
  if (data.email) return data.email;
  for (const k in data) if (/email|correu|correo/i.test(k) && /@/.test(data[k])) return data[k];
  return "";
}
function pickName(data) {
  const keys = Object.keys(data);
  const nameKey = keys.find((k) => /nom|nombre/i.test(k) && !/tutor|pare|mare|padre|madre/i.test(k));
  const surKey = keys.find((k) => /cognom|apellido/i.test(k));
  return [data[nameKey], data[surKey]].filter(Boolean).join(" ").trim();
}
