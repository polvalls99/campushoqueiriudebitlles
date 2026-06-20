/* ============================================================
   Campus d'hoquei patins — Backend (Google Apps Script)

   Script LLIGAT al full: obre el Google Sheet → Extensions → Apps Script,
   enganxa això i Desplega → Aplicació web (executa com "Jo", accés "Qualsevol").
   Copia la URL /exec a SCRIPT_URL d'app.js.

   Pestanyes esperades (vegeu SETUP.md):
     · Ajustes        (Clave | Valor)
     · Campus         (id | nombre | habilitado | fechas | descripcion)
     · Semanas        (id | campus | etiqueta | fechas | precio | plazas)
     · Campos         (id | etiqueta | tipo | opciones | obligatorio | placeholder | ayuda | grupo | orden)
     · Inscripciones  (automàtica)
   ============================================================ */

var SHEETS = {
  settings: "Ajustes",
  campus: "Campus",
  weeks: "Semanas",
  fields: "Campos",
  subs: "Inscripciones"
};

/* ---------- GET: config ---------- */
function doGet(e) {
  try { return json(buildConfig()); }
  catch (err) { return json({ error: String(err) }); }
}

/* ---------- POST: guarda + correu ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var payload = JSON.parse(e.postData.contents);
    var data = payload.data || {};
    var id = "INS-" + new Date().getTime();

    // 1) desa fitxers al Drive i posa els enllaços dins de data
    var settings = readSettings();
    var saved = saveFiles(payload.files, settings, payload, id);
    var byField = {};
    saved.forEach(function (s) { (byField[s.field] = byField[s.field] || []).push(s.url); });
    Object.keys(byField).forEach(function (k) { data[k] = byField[k].join("\n"); });

    // 2) desa la fila
    saveRow(id, payload, data);

    // 3) correu de confirmació
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
  return {
    settings: readSettings(),
    campuses: readCampuses(),
    weeks: readWeeks(),
    fields: readFields()
  };
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
    return {
      id: String(r.id).trim(),
      nombre: str(r.nombre),
      fechas: str(r.fechas),
      descripcion: str(r.descripcion),
      habilitado: truthy(r.habilitado)
    };
  });
}

function readWeeks() {
  var counts = countWeekRegistrations();
  return readTable(SHEETS.weeks).filter(function (r) { return r.id; }).map(function (r) {
    var plazas = num(r.plazas), used = counts[String(r.id).trim()] || 0;
    var w = {
      id: String(r.id).trim(),
      campus: str(r.campus),
      etiqueta: str(r.etiqueta),
      fechas: str(r.fechas),
      precio: str(r.precio)
    };
    if (plazas != null) { w.plazas = plazas; w.plazas_restantes = Math.max(0, plazas - used); }
    return w;
  });
}

function readFields() {
  return readTable(SHEETS.fields).filter(function (r) { return r.id; }).map(function (r) {
    return {
      id: String(r.id).trim(),
      etiqueta: str(r.etiqueta),
      tipo: str(r.tipo) || "text",
      opciones: str(r.opciones),
      obligatorio: truthy(r.obligatorio),
      placeholder: str(r.placeholder),
      ayuda: str(r.ayuda),
      grupo: str(r.grupo) || "Inscripció",
      orden: num(r.orden) || 0
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
    var blob = Utilities.newBlob(bytes, f.mimeType || "application/octet-stream",
      safe + "__" + (f.field || "fitxer") + "__" + (f.name || "arxiu"));
    var file = folder.createFile(blob);
    return { field: f.field, name: file.getName(), url: file.getUrl() };
  });
}

function getUploadFolder(settings, payload) {
  var root = getOrCreateFolder(DriveApp.getRootFolder(),
    settings.carpeta_fitxers || "Inscripcions - fitxers");
  var campus = (payload && payload.campusName) || (payload && payload.campusId) || "General";
  return getOrCreateFolder(root, String(campus));
}
function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ---------- Guardar fila ---------- */
function saveRow(id, payload, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.subs) || ss.insertSheet(SHEETS.subs);

  var lastCol = sheet.getLastColumn();
  var header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (!header.length) {
    header = ["Timestamp", "ID", "Campus", "Setmanes (id)", "Setmanes"];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }

  readFields().map(function (f) { return f.id; }).forEach(function (fid) {
    if (header.indexOf(fid) === -1) {
      header.push(fid);
      sheet.getRange(1, header.length, 1, 1).setValue(fid);
    }
  });

  var row = header.map(function (col) {
    if (col === "Timestamp") return new Date();
    if (col === "ID") return id;
    if (col === "Campus") return payload.campusName || payload.campusId || "";
    if (col === "Setmanes (id)") return (payload.weeks || []).join(", ");
    if (col === "Setmanes") return (payload.weekLabels || []).join(", ");
    return data[col] != null ? data[col] : "";
  });
  sheet.appendRow(row);
}

/* ---------- Places: compta per setmana ---------- */
function countWeekRegistrations() {
  var counts = {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.subs);
  if (!sheet || sheet.getLastRow() < 2) return counts;
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = header.indexOf("Setmanes (id)");
  if (col === -1) return counts;
  sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
    String(r[0] || "").split(",").forEach(function (x) {
      x = x.trim(); if (x) counts[x] = (counts[x] || 0) + 1;
    });
  });
  return counts;
}

/* ---------- Correu ---------- */
function sendConfirmation(settings, payload, data, savedFiles) {
  var to = findEmail(data);
  if (!to) return;
  var camp = settings.nombre_campus || "Campus";
  var subject = settings.email_asunto || ("Inscripció confirmada · " + camp);
  var intro = settings.email_intro || "Hem rebut la inscripció correctament. Aquí tens el resum:";

  var rows = "";
  if (payload.campusName) rows += emailRow("Campus", payload.campusName);
  Object.keys(data).forEach(function (k) {
    if (data[k] === "" || data[k] == null) return;
    var v = String(data[k]).indexOf("http") === 0 ? "(fitxer adjuntat)" : data[k];
    rows += emailRow(k, v);
  });
  if (payload.weekLabels && payload.weekLabels.length) rows += emailRow("Setmanes", payload.weekLabels.join(", "));
  if (savedFiles && savedFiles.length) rows += emailRow("Documents", savedFiles.length + " fitxer(s) rebut(s)");

  var html =
    "<div style='font-family:Arial,sans-serif;max-width:520px;color:#14241D'>" +
      "<div style='background:#0E3B2E;color:#F3F1E7;padding:18px 22px;border-radius:12px 12px 0 0'>" +
        "<div style='font-size:13px;letter-spacing:.1em;color:#F4B43C;text-transform:uppercase'>" + esc(camp) + "</div>" +
        "<div style='font-size:20px;font-weight:700;margin-top:4px'>Inscripció confirmada</div>" +
      "</div>" +
      "<div style='border:1px solid #E1DECF;border-top:none;padding:22px;border-radius:0 0 12px 12px'>" +
        "<p style='margin:0 0 16px'>" + esc(intro) + "</p>" +
        "<table style='border-collapse:collapse;font-size:14px'>" + rows + "</table>" +
        (settings.email_contacto ? "<p style='margin:20px 0 0;font-size:13px;color:#4A5A52'>Dubtes? Escriu a " + esc(settings.email_contacto) + "</p>" : "") +
      "</div>" +
    "</div>";

  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: camp, replyTo: settings.email_contacto || undefined });
}
function emailRow(k, v) {
  return "<tr><td style='padding:6px 14px 6px 0;color:#4A5A52'>" + esc(k) +
         "</td><td style='padding:6px 0;font-weight:600'>" + esc(v) + "</td></tr>";
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
function truthy(v) {
  var s = String(v).trim().toLowerCase();
  return s === "true" || s === "sí" || s === "si" || s === "x" || s === "1" || s === "yes";
}
function coerce(v) {
  if (typeof v !== "string") return v;
  var s = v.trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return v;
}
function findEmail(data) {
  if (data.email) return data.email;
  for (var k in data) if (/email|correu|correo/i.test(k) && /@/.test(String(data[k]))) return data[k];
  return "";
}
function pickChild(payload) {
  var d = (payload && payload.data) || {};
  for (var k in d) if (/nom|nombre/i.test(k) && !/tutor|pare|mare/i.test(k)) return d[k];
  return "";
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
