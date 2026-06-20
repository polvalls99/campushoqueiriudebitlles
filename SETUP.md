# Casal Hoquei — Guia de muntatge

Web estàtica (GitHub Pages) + Google Apps Script + Google Sheets.
Tota la parametrització es fa des del full de càlcul. De moment, **un sol casal (estiu)**;
l'opció de diversos casals (Nadal, Setmana Santa) amb habilitar/deshabilitar la deixem per a després.

```
Navegador (pare/mare)
   │  GET  ?action=config  → preguntes, setmanes, textos
   │  POST {inscripció + fitxers en base64}
   ▼
GitHub Pages (index.html, styles.css, app.js)
   ▼
Apps Script (Code.gs) ─► Google Sheet (base de dades)
                      ├─► Drive (carpeta amb la documentació)
                      └─► MailApp (correu de confirmació)
```

---

## 1. El full de càlcul — 3 pestanyes (noms exactes)

### `Ajustes`  (clau · valor)

| Clave | Valor |
|---|---|
| nombre_campus | Casal Hoquei Estiu 2026 |
| club | Club Esportiu E7 · CP Riudebitlles |
| temporada | 2026 |
| lema | Inscripcions obertes |
| hero_titulo | Casal d'Hoquei d'Estiu |
| intro | Del 29 de juny al 31 de juliol. Tria les setmanes i adjunta la targeta sanitària. |
| email_contacto | coordinaciocpriudebitlles@gmail.com |
| email_asunto | Inscripció rebuda · Casal Hoquei Estiu 2026 |
| email_intro | Hem rebut la inscripció. Aquí tens el resum: |
| texto_boton | Enviar inscripció |
| mensaje_exito | T'hem enviat un correu amb el resum. |
| consentimiento | He llegit i accepto la política de protecció de dades del Club Esportiu E7. |
| setmanes_info | Preu: 1a setmana 80 € · 2a setmana / fam. nombrosa / 2n germà 70 € · jugadors C.P. Riudebitlles 70 € (2a setmana o 2n germà 60 €). |
| semanas_obligatorias | TRUE |
| carpeta_fitxers | Inscripcions - fitxers |

### `Semanas`

| id | etiqueta | fechas | precio | plazas |
|---|---|---|---|---|
| S1 | Setmana 1 | 29 juny – 3 juliol | | |
| S2 | Setmana 2 | 6 – 10 juliol | | |
| S3 | Setmana 3 | 13 – 17 juliol | | 0 |
| S4 | Setmana 4 | 20 – 24 juliol | | |
| S5 | Setmana 5 | 27 – 31 juliol | | |

- **plazas = 0** força "Complet" (com la S3 actual). Buit = sense límit i sense comptador.
- Si poses un número (p. ex. 20), mostra "queden X" i bloqueja quan s'omple.
- `precio` el deixem buit perquè el preu depèn de setmanes/germans (s'explica a `setmanes_info`).

### `Campos`  (les preguntes — ja són les del teu formulari)

| id | etiqueta | tipo | opciones | obligatorio | ayuda | grupo | orden |
|---|---|---|---|---|---|---|---|
| nom_jugador | Nom i cognoms | text | | TRUE | | Dades del jugador/a | 1 |
| data_naixement | Data de naixement | date | | TRUE | Exemple: 18/11/2018 | Dades del jugador/a | 2 |
| sap_nedar | Sap nedar? | radio | Sí\|No | TRUE | | Dades del jugador/a | 3 |
| nom_tutor | Nom i cognoms del tutor/a | text | | TRUE | | Dades del pare/mare/tutor | 4 |
| nif | NIF | text | | TRUE | | Dades del pare/mare/tutor | 5 |
| adreca | Adreça | text | | TRUE | | Dades del pare/mare/tutor | 6 |
| poblacio | Població | text | | TRUE | | Dades del pare/mare/tutor | 7 |
| codi_postal | Codi postal | text | | TRUE | | Dades del pare/mare/tutor | 8 |
| telefon | Telèfon | tel | | TRUE | | Dades del pare/mare/tutor | 9 |
| email | Email | email | | TRUE | Hi enviarem la confirmació | Dades del pare/mare/tutor | 10 |
| aut_activitat | Autorització de l'activitat | radio | Sí\|No | TRUE | (text llarg de l'autorització) | Autoritzacions | 11 |
| aut_vehicle | Autorització de vehicle i cures | radio | Sí\|No | TRUE | (text llarg) | Autoritzacions | 12 |
| drets_imatge | Drets d'imatge | radio | Sí\|No | TRUE | (text llarg) | Autoritzacions | 13 |
| targeta_sanitaria | Còpia de la targeta sanitària | file | image/*,application/pdf | FALSE | Foto o PDF; pots saltar-ho si ja l'has enviat | Documentació | 14 |
| nota_lopd | Protecció de dades | nota | | FALSE | (text LOPD) | Protecció de dades | 15 |

Tipus disponibles: `text`, `email`, `tel`, `number`, `date`, `textarea`, `select`, `radio`, `checkbox`, `file`, **`nota`** (bloc de text sense resposta, per a avisos/autoritzacions/LOPD).
- `codi_postal` i `telefon` són **text** a propòsit: així no perden el zero inicial ni surten amb ".0".
- Posa el text llarg de cada autorització i del LOPD a la columna **ayuda** (a `radio` i `file` la mostra a sobre del control).

### `Inscripciones` (automàtica)
La crea el script. A més de les dades, hi escriu **una columna 1/0 per cada setmana** (S1…S5) i una columna **Edat** calculada de la data de naixement — el mateix que feies a mà a la "Hoja 1". Els fitxers hi queden com a **enllaç** al Drive.

---

## 2. Backend (Apps Script)

1. Al full: **Extensions → Apps Script**, enganxa `apps-script/Code.gs`, desa.
2. **Desplega → Nou desplegament → Aplicació web** · executa com **Jo** · accés **Qualsevol**.
3. Autoritza permisos: **full**, **Drive** (fitxers) i **Gmail** (correu).
4. Copia la URL `/exec`.

> Cada canvi de codi: **Gestiona desplegaments → edita → versió nova**.

## 3. Frontend (GitHub Pages)

1. A `app.js`, primera línia: `const SCRIPT_URL = "…/exec";` (buit = mode demo).
2. Puja els fitxers i activa Pages (repo públic).

## 4. Notes

- **Fitxers**: 5 MB/fitxer i 12 MB per enviament (a dalt d'`app.js`: `MAX_FILE_MB`, `MAX_TOTAL_MB`).
- **Drets d'imatge**: ara és Sí/No (com a la teva exportació). Legalment és més correcte que sigui opcional; deixa'l obligatori només si t'interessa forçar resposta.
- **Diversos casals**: quan ho vulguem, s'afegeix una pestanya `Campus` i una columna `campus` a `Semanas`; el codi ja ho contempla.
- **Correus**: Gmail ~100/dia, Workspace ~1500/dia.
- **Menors**: casella de consentiment obligatòria; el text LOPD és a la nota. Revisa que el text legal sigui el que vol el club.
```
