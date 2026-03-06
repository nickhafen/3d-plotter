# Classroom 3D Coordinate Plotter

An instructor-facing web app that reads student-submitted word vectors from a Google Sheet and renders an interactive Plotly 3D scatter plot. No backend or server required — just three static files.

---

## How it works

1. Students fill out a **Google Form** rating a word on three scales (0–1)
2. Responses flow into a linked **Google Sheet**
3. A second "Plotter Data" tab in the same sheet maps the responses to standardized `word, x, y, z` columns
4. The app fetches that tab as CSV and plots each submission as a 3D point
5. Points sharing the same word get the same colour

---

## Setup

### Step 1 — Google Form

Create a Google Form with these questions (wording can be anything):

| Column | Example question |
|--------|-----------------|
| word   | Choose a word |
| x      | Male (0) – Female (1) |
| y      | Not alive (0) – Alive (1) |
| z      | Not royal (0) – Royal (1) |

In the **Responses** tab, click the green Sheets icon → **Create a new spreadsheet** to link responses to a sheet.

### Step 2 — Add a "Plotter Data" mapping tab

This tab gives the app stable column names regardless of how you word your form questions.

1. In the linked Google Sheet, click **+** to add a new tab — name it `Plotter Data`
2. Set row 1 headers: `word`, `x`, `y`, `z`
3. In **A2**, paste: `=ARRAYFORMULA('Form Responses 1'!B2:B)`
4. In **B2**, paste: `=ARRAYFORMULA('Form Responses 1'!C2:C)`
5. In **C2**, paste: `=ARRAYFORMULA('Form Responses 1'!D2:D)`
6. In **D2**, paste: `=ARRAYFORMULA('Form Responses 1'!E2:E)`

Columns B–E reference the form response columns **by position**, so renaming your form questions won't break anything.

### Step 3 — Publish the Plotter Data tab to CSV

1. **File → Share → Publish to web**
2. Set the sheet dropdown to **Plotter Data** (not "Entire Document")
3. Format: **Comma-separated values (.csv)**
4. Click **Publish** → copy the URL

### Step 4 — Set the URL in app.js

Open `app.js` and update the constant at the top:

```js
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/LONG_ID/pub?gid=SHEET_GID&single=true&output=csv';
```

### Step 5 — Deploy

#### GitHub Pages (recommended)

1. Create a public repository on [github.com](https://github.com)
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`
3. Go to **Settings → Pages → Branch: main** → Save
4. Your app is live at `https://yourusername.github.io/repo-name`

To update: re-upload changed files and commit.

#### Netlify (quickest)

Drag the project folder onto [netlify.com/drop](https://app.netlify.com/drop). Done.

#### Local

```bash
cd "/path/to/3D Plotter"
python3 -m http.server 8080
```

Open `http://localhost:8080`.

---

## Coordinate constraints

| Property | Value |
|----------|-------|
| Range | 0.0 to 1.0 (inclusive) |
| Increment | 0.1 |

The app snaps values to the nearest 0.1 and silently skips rows outside [0, 1] or with non-numeric coordinates.

---

## UI controls

| Control | What it does |
|---------|-------------|
| **↻ Refresh** | Re-fetches the sheet CSV and redraws the plot |
| **Show point labels** | Toggles word labels on each dot |
| **Axis checkboxes** | Hides an axis and collapses all points to 0 on that dimension |
| **Axis label inputs** | Renames the X / Y / Z axis titles on the plot |
| **Light / Dark toggle** | Switches theme; preference saved in localStorage |

---

## Developer notes

### Stack

- [Plotly.js](https://plotly.com/javascript/) v2.35 — 3D scatter rendering
- [PapaParse](https://www.papaparse.com/) v5.4 — CSV parsing
- Vanilla JS / CSS (no framework, no build step)

### Key decisions

| Question | Decision |
|----------|----------|
| Stable colours | Each unique word is assigned a colour from a 15-colour palette in first-seen order |
| Axis hidden | Coordinate forced to 0 for display (clearest visual for students) |
| Camera persistence | Captured from `plotly_relayout`; re-applied across refreshes |
| Theme persistence | `localStorage` key `plotter-theme` |
| Column mapping | A "Plotter Data" tab normalises column names so form question wording can change freely |
