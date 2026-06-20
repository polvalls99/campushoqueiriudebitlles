# Campus d'hoquei patins — Guia de muntatge

Web estàtica (GitHub Pages) + Google Apps Script + Google Sheets.
Sense hosting de pagament. Tota la **parametrització es fa des del full de càlcul**:
preguntes, setmanes, textos i **quins campus estan oberts**.

```
Navegador (pare/mare)
   │  GET  ?action=config  → campus oberts, preguntes, setmanes, textos
   │  POST {inscripció + fitxers en base64}
   ▼
GitHub Pages (index.html, styles.css, app.js)
   ▼
Apps Script (Code.gs) ─► Google Sheet (base de dades)
                      ├─► Drive (carpeta amb els fitxers adjunts)
                      └─► MailApp (correu de confirmació)
```

---

## 1. El full de càlcul — 5 pestanyes (noms exactes)

### `Ajustes`  (clau · valor)

| Clave | Valor |
|---|---|
| nombre_campus | Campus d'Hoquei Patins |
| temporada | 2026 |
| lema | Inscripcions obertes |
| hero_titulo | Apunta el teu fill al campus |
| intro | Tria el campus, les setmanes i adjunta la documentació. |
| email_contacto | info@elteuclub.cat |
| email_asunto | Inscripció confirmada · Campus Hoquei |
| email_intro | Hem rebut la inscripció. Aquí tens el resum: |
| texto_boton | Confirmar inscripció |
| mensaje_exito | T'hem enviat un correu amb els detalls. |
| consentimiento | Com a pare/mare o tutor/a, autoritzo la inscripció i el tractament de dades. |
| semanas_obligatorias | TRUE |
| carpeta_fitxers | Inscripcions - fitxers |

### `Campus`  (un campus per fila)

| id | nombre | habilitado | fechas | descripcion |
|---|---|---|---|---|
| estiu | Campus d'Estiu | TRUE | Juliol 2026 | |
| nadal | Campus de Nadal | TRUE | Desembre 2026 | |
| setmanasanta | Campus de Setmana Santa | FALSE | Abril 2026 | |

- **habilitado**: `TRUE` = apareix a la web · `FALSE` = amagat.
- Si només n'hi ha **un** d'habilitat, la web no mostra selector (l'agafa directament).
- Si **cap** està habilitat, la web mostra "ara mateix no hi ha inscripcions obertes".
- No canviïs un `id` un cop hi hagi inscrits (es perdria el lligam amb les setmanes).

### `Semanas`  (setmanes lligades a un campus)

| id | campus | etiqueta | fechas | precio | plazas |
|---|---|---|---|---|---|
| e1 | estiu | Setmana 1 | 29 jun – 3 jul | 120 € | 20 |
| e2 | estiu | Setmana 2 | 6 jul – 10 jul | 120 € | 20 |
| n1 | nadal | Torn únic | 23 des – 3 gen | 95 € | 24 |

- **campus**: l'`id` del campus al qual pertany la setmana.
- **plazas**: opcional. Mostra "queden X" i bloqueja quan s'omple. Buit = il·limitat.

### `Campos`  (les preguntes)

| id | etiqueta | tipo | opciones | obligatorio | placeholder | ayuda | grupo | orden |
|---|---|---|---|---|---|---|---|---|
| nom_nen | Nom del nen/a | text | | TRUE | | | Dades del nen/a | 1 |
| data_naixement | Data de naixement | date | | TRUE | | | Dades del nen/a | 2 |
| talla | Talla samarreta | select | 6\|8\|10\|12\|14 | TRUE | | | Dades del nen/a | 3 |
| targeta_sanitaria | Còpia targeta sanitària | file | image/*,application/pdf | TRUE | | Foto o PDF, màx 5 MB | Documentació | 4 |
| foto | Foto del nen/a | file | image/* | FALSE | | Opcional | Documentació | 5 |
| nom_tutor | Nom del tutor/a | text | | TRUE | | | Contacte | 6 |
| email | Correu electrònic | email | | TRUE | | Hi enviarem la confirmació | Contacte | 7 |
| telefon | Telèfon | tel | | TRUE | | | Contacte | 8 |

- **tipo**: `text`, `email`, `tel`, `number`, `date`, `textarea`, `select`, `radio`, `checkbox`, **`file`**.
- **opciones** per a `select/radio/checkbox`: valors separats per `|`.
  Per a **`file`**: tipus acceptats (ex. `image/*,application/pdf`). Es poden adjuntar **diversos** fitxers.
- **grupo**: les preguntes amb el mateix grup surten juntes en una secció.
- ⚠️ El camp de correu ha de tenir `email` al seu `id` (o ser tipus `email`) per a confirmació i prefill.

### `Inscripciones`
Deixa-la buida. El script crea capçaleres i hi afegeix una fila per inscripció.
Els camps de tipus `file` guarden els **enllaços** als fitxers del Drive.

---

## 2. Backend (Apps Script)

1. Al full: **Extensions → Apps Script**, enganxa `apps-script/Code.gs`, desa.
2. **Desplega → Nou desplegament → Aplicació web** · executa com **Jo** · accés **Qualsevol**.
3. Autoritza permisos — ara també demanarà **Drive** (per guardar fitxers) i **Gmail** (per enviar correu).
4. Copia la URL `/exec`.

> Els fitxers es guarden al teu Drive, dins `Inscripcions - fitxers / <Campus>`, de forma **privada**.
> A la Sheet hi queda l'enllaç; només qui té accés al teu Drive el pot obrir.

> Cada canvi de codi: **Gestiona desplegaments → edita → versió nova**.

---

## 3. Frontend (GitHub Pages)

1. A `app.js`, primera línia: `const SCRIPT_URL = "…/exec";` (buit = mode demo).
2. Puja `index.html`, `styles.css`, `app.js` a GitHub.
3. **Settings → Pages → Branch main / root → Save**.

---

## 4. Límits i notes

- **Fitxers**: màx 5 MB per fitxer i 12 MB per enviament (configurable a dalt d'`app.js`:
  `MAX_FILE_MB`, `MAX_TOTAL_MB`). Per fotos de mòbil sol n'hi ha prou; si calen més grans, puja els límits amb seny (Apps Script accepta fins ~50 MB per petició).
- **Correus**: Gmail ~100/dia, Workspace ~1500/dia.
- **Prefill de qui torna**: és local al navegador (`localStorage`); els **fitxers no es reomplen** (s'han de tornar a adjuntar, per privadesa).
- **Dades de menors**: casella de consentiment obligatòria; enllaça una política de privadesa al text `consentimiento` o al peu.
- **Backup**: Fitxer → Crea una còpia per arxivar una temporada.
```
