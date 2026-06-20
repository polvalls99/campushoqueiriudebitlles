/* ============================================================
   Casal d'hoquei — Backend (Google Apps Script)

   Script LLIGAT al full: Extensions → Apps Script, enganxa això,
   Desplega → Aplicació web (executa com "Jo", accés "Qualsevol").
   Copia la URL /exec a SCRIPT_URL d'app.js.

   Pestanyes (vegeu SETUP.md):
     · Ajustes        (Clave | Valor)
     · Semanas        (id | etiqueta | fechas | precio | plazas)   [campus opcional]
     · Campos         (id | etiqueta | tipo | opciones | obligatorio | placeholder | ayuda | grupo | orden)
     · Inscripciones  (automàtica: hi escriu 1 columna per setmana + edat)
     · Campus         (opcional, per a més endavant)
   ============================================================ */

var SHEETS = {
  settings: "Ajustes",
  campus: "Campus",
  weeks: "Semanas",
  fields: "Campos",
  subs: "Inscripciones"
};

function doGet(e) {
  try { return json(buildConfig()); }
  catch (err) { return json({ error: String(err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var payload = JSON.parse(e.postData.contents);
    var data = payload.data || {};
    var id = "INS-" + new Date().getTime();

    var settings = readSettings();
    var saved = saveFiles(payload.files, settings, payload, id);
    var byField = {};
    saved.forEach(function (s) { (byField[s.field] = byField[s.field] || []).push(s.url); });
    Object.keys(byField).forEach(function (k) { data[k] = byField[k].join("\n"); });

    saveRow(id, payload, data);
    sendConfirmation(settings, payload, data, saved);
    return json({ ok: true, id: id });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Config ---------- */
function buildConfig() {
  return { settings: readSettings(), campuses: readCampuses(), weeks: readWeeks(), fields: readFields() };
}
function readSettings() {
  var out = {};
  readTable(SHEETS.settings).forEach(function (r) {
    var k = String(r.Clave || r.clave || "").trim();
    if (k) out[k] = coerce(r.Valor != null ? r.Valor : r.valor);
  });
  return out;
}
function readCampuses() {
  return readTable(SHEETS.campus).filter(function (r) { return r.id; }).map(function (r) {
    return { id: String(r.id).trim(), nombre: str(r.nombre), fechas: str(r.fechas), descripcion: str(r.descripcion), habilitado: truthy(r.habilitado) };
  });
}
function readWeeks() {
  var counts = countWeekRegistrations();
  return readTable(SHEETS.weeks).filter(function (r) { return r.id; }).map(function (r) {
    var plazas = num(r.plazas), used = counts[String(r.id).trim()] || 0;
    var w = { id: String(r.id).trim(), campus: str(r.campus), etiqueta: str(r.etiqueta), fechas: str(r.fechas), precio: str(r.precio) };
    if (plazas != null) { w.plazas = plazas; w.plazas_restantes = Math.max(0, plazas - used); }
    return w;
  });
}
function readFields() {
  return readTable(SHEETS.fields).filter(function (r) { return r.id; }).map(function (r) {
    return {
      id: String(r.id).trim(), etiqueta: str(r.etiqueta), tipo: str(r.tipo) || "text",
      opciones: str(r.opciones), obligatorio: truthy(r.obligatorio), placeholder: str(r.placeholder),
      ayuda: str(r.ayuda), grupo: str(r.grupo) || "Inscripció", orden: num(r.orden) || 0
    };
  });
}

/* ---------- Fitxers → Drive ---------- */
function saveFiles(files, settings, payload, id) {
  if (!files || !files.length) return [];
  var folder = getUploadFolder(settings, payload);
  return files.map(function (f) {
    var bytes = Utilities.base64Decode(f.dataBase64);
    var safe = (pickChild(payload) || id).replace(/[^\w\-]+/g, "_");
    var blob = Utilities.newBlob(bytes, f.mimeType || "application/octet-stream", safe + "__" + (f.field || "fitxer") + "__" + (f.name || "arxiu"));
    var file = folder.createFile(blob);
    return { field: f.field, name: file.getName(), url: file.getUrl() };
  });
}
function getUploadFolder(settings, payload) {
  var root = getOrCreateFolder(DriveApp.getRootFolder(), settings.carpeta_fitxers || "Inscripcions - fitxers");
  var campus = (payload && payload.campusName) || (payload && payload.campusId) || "General";
  return getOrCreateFolder(root, String(campus));
}
function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ---------- Guardar fila ----------
   Columnes: Timestamp · ID · [camps no-nota, amb Edat després de la data
   de naixement] · una columna 1/0 per setmana · Setmanes (text) */
function saveRow(id, payload, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.subs) || ss.insertSheet(SHEETS.subs);

  var fields = readFields().filter(function (f) { return f.tipo !== "nota"; });
  var weeks = readWeeks();

  // construeix l'ordre de columnes desitjat
  var plan = ["Timestamp", "ID"];
  fields.forEach(function (f) {
    plan.push(f.id);
    if (/naix/i.test(f.id) || f.tipo === "date") plan.push("Edat");
  });
  weeks.forEach(function (w) { plan.push(w.id); });
  plan.push("Setmanes");

  // capçalera actual; afegeix les columnes que faltin (al final)
  var lastCol = sheet.getLastColumn();
  var header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (!header.length) {
    header = plan.slice();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  } else {
    plan.forEach(function (col) {
      if (header.indexOf(col) === -1) { header.push(col); sheet.getRange(1, header.length, 1, 1).setValue(col); }
    });
  }

  var selected = {};
  (payload.weeks || []).forEach(function (w) { selected[w] = true; });
  var edat = computeAge(findBirthdate(data));

  var row = header.map(function (col) {
    if (col === "Timestamp") return new Date();
    if (col === "ID") return id;
    if (col === "Edat") return edat != null ? edat : "";
    if (col === "Setmanes") return (payload.weekLabels || []).join(", ");
    if (selectedIsWeek(col, weeks)) return selected[col] ? 1 : 0;
    return data[col] != null ? data[col] : "";
  });
  sheet.appendRow(row);
}
function selectedIsWeek(col, weeks) {
  for (var i = 0; i < weeks.length; i++) if (weeks[i].id === col) return true;
  return false;
}

/* ---------- Edat ---------- */
function findBirthdate(data) {
  for (var k in data) if (/naix|nacim|birth/i.test(k)) return data[k];
  return null;
}
function computeAge(v) {
  if (!v) return null;
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  var now = new Date();
  var age = now.getFullYear() - d.getFullYear();
  var m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return (age >= 0 && age < 120) ? age : null;
}

/* ---------- Places ---------- */
function countWeekRegistrations() {
  var counts = {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.subs);
  if (!sheet || sheet.getLastRow() < 2) return counts;
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // compta via les columnes 1/0 de cada setmana
  var weeks = readTable(SHEETS.weeks).filter(function (r) { return r.id; }).map(function (r) { return String(r.id).trim(); });
  if (sheet.getLastRow() < 2) return counts;
  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  weeks.forEach(function (wid) {
    var col = header.indexOf(wid);
    if (col === -1) return;
    var c = 0;
    vals.forEach(function (r) { if (Number(r[col]) === 1) c++; });
    counts[wid] = c;
  });
  return counts;
}

/* ---------- Correu ---------- */
function sendConfirmation(settings, payload, data, savedFiles) {
  var to = findEmail(data);
  if (!to) return;
  var camp = settings.nombre_campus || "Casal";
  var subject = settings.email_asunto || ("Inscripció rebuda · " + camp);
  var intro = settings.email_intro || "Hem rebut la inscripció. Aquí tens el resum:";
  var labels = fieldLabels();

  var rows = "";
  if (payload.campusName) rows += emailRow("Casal", payload.campusName);
  Object.keys(data).forEach(function (k) {
    if (data[k] === "" || data[k] == null) return;
    var v = String(data[k]).indexOf("http") === 0 ? "(fitxer adjuntat)" : data[k];
    rows += emailRow(labels[k] || k, v);
  });
  if (payload.weekLabels && payload.weekLabels.length) rows += emailRow("Setmanes", payload.weekLabels.join(", "));
  if (savedFiles && savedFiles.length) rows += emailRow("Documents", savedFiles.length + " fitxer(s) rebut(s)");

  var html =
    "<div style='font-family:Arial,sans-serif;max-width:520px;color:#16233D'>" +
      "<div style='background:#0E2A63;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0'>" +
        "<div style='font-size:13px;letter-spacing:.1em;color:#9DC0FF;text-transform:uppercase'>" + esc(camp) + "</div>" +
        "<div style='font-size:20px;font-weight:700;margin-top:4px'>Inscripció rebuda</div>" +
      "</div>" +
      "<div style='border:1px solid #D6DEEC;border-top:none;padding:22px;border-radius:0 0 12px 12px'>" +
        "<p style='margin:0 0 16px'>" + esc(intro) + "</p>" +
        "<table style='border-collapse:collapse;font-size:14px'>" + rows + "</table>" +
        (settings.email_contacto ? "<p style='margin:20px 0 0;font-size:13px;color:#5A6B86'>Dubtes? Escriu a " + esc(settings.email_contacto) + "</p>" : "") +
      "</div></div>";

  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: camp, replyTo: settings.email_contacto || undefined });
}
function emailRow(k, v) {
  return "<tr><td style='padding:6px 14px 6px 0;color:#5A6B86;vertical-align:top'>" + esc(k) + "</td><td style='padding:6px 0;font-weight:600'>" + esc(v) + "</td></tr>";
}
function fieldLabels() {
  var m = {};
  readFields().forEach(function (f) { m[f.id] = f.etiqueta || f.id; });
  return m;
}

/* ---------- Full ---------- */
function readTable(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {}, empty = true;
    for (var c = 0; c < header.length; c++) {
      if (!header[c]) continue;
      obj[header[c]] = values[i][c];
      if (values[i][c] !== "" && values[i][c] != null) empty = false;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

/* ---------- Helpers ---------- */
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function str(v) { return v == null ? "" : String(v).trim(); }
function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function truthy(v) { var s = String(v).trim().toLowerCase(); return s === "true" || s === "sí" || s === "si" || s === "x" || s === "1" || s === "yes"; }
function coerce(v) { if (typeof v !== "string") return v; var s = v.trim().toLowerCase(); if (s === "true") return true; if (s === "false") return false; return v; }
function findEmail(data) { if (data.email) return data.email; for (var k in data) if (/email|correu|correo/i.test(k) && /@/.test(String(data[k]))) return data[k]; return ""; }
function pickChild(payload) { var d = (payload && payload.data) || {}; for (var k in d) if (/nom/i.test(k) && !/tutor|pare|mare/i.test(k)) return d[k]; return ""; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
