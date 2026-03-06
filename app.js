/* ═══════════════════════════════════════════════════════════
   3D Coordinate Plotter — app.js
   ═══════════════════════════════════════════════════════════ */

// ─── Configuration ──────────────────────────────────────────────────────────

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUA2UWnQ3pn-DUH6y_h9acbKv3SYaDwBcD4mswGofDGx4QicnfTEcFzKi_PHod9VfqUXmCGZa86U4q/pub?gid=892495698&single=true&output=csv';


// ─── App State ───────────────────────────────────────────────────────────────

let currentData   = [];   // Array of {name, x, y, z} — validated points
let currentCamera = null; // Plotly scene.camera object captured from relayout
let uiRevision    = 'init'; // Changes only on "Reset View" to force Plotly to reset camera

// ─── Theme ───────────────────────────────────────────────────────────────────

function getTheme() {
  return localStorage.getItem('plotter-theme') || 'dark';
}

function applyTheme(theme) {
  document.body.className = theme;
  localStorage.setItem('plotter-theme', theme);

  const toggle = document.getElementById('themeToggle');
  const label  = document.getElementById('themeLabel');
  toggle.checked  = theme === 'light';
  label.textContent = theme === 'light' ? 'Dark' : 'Light';

  // Re-render so Plotly picks up the new colours.
  if (currentData.length > 0 || true) {
    renderPlot(currentData);
  }
}

// ─── CSV parsing & validation ─────────────────────────────────────────────────

/**
 * Parse CSV text, validate rows, snap to 0.1 grid.
 * Returns { valid: [{name,x,y,z}], totalRows, invalidCount }
 */
function parseAndValidate(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  });

  const valid = [];
  let invalidCount = 0;

  for (const row of parsed.data) {
    // Accept case-insensitive column names
    const name = String(row['word'] ?? row['name'] ?? '').trim() || '(unnamed)';

    const xRaw = row['x'] ?? row['X'];
    const yRaw = row['y'] ?? row['Y'];
    const zRaw = row['z'] ?? row['Z'];

    const x = parseFloat(xRaw);
    const y = parseFloat(yRaw);
    const z = parseFloat(zRaw);

    // Skip rows that can't be parsed
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      invalidCount++;
      continue;
    }

    // Skip rows outside [-1, 1]
    if (x < -1 || x > 1 || y < -1 || y > 1 || z < -1 || z > 1) {
      invalidCount++;
      continue;
    }

    // Snap to nearest 0.1
    const snap = v => Math.round(v * 10) / 10;

    valid.push({ name, x: snap(x), y: snap(y), z: snap(z) });
  }

  return { valid, totalRows: parsed.data.length, invalidCount };
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchData() {
  setStatus('loading', 'Fetching data…');
  clearStats();

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const text = await res.text();
    const { valid, totalRows, invalidCount } = parseAndValidate(text);

    currentData = valid;

    setStats(`Rows fetched : ${totalRows}\nValid points : ${valid.length}\nInvalid/skip : ${invalidCount}`);

    if (valid.length === 0) {
      setStatus('ok', 'No valid data yet. Waiting for submissions.');
    } else {
      setStatus('ok', `Showing ${valid.length} point${valid.length !== 1 ? 's' : ''}.`);
    }

    return valid;
  } catch (err) {
    const msg =
      `Fetch failed: ${err.message}\n\n` +
      `Make sure the Google Sheet is published to the web as CSV.\n` +
      `(File → Share → Publish to web → CSV)`;
    setStatus('error', msg);
    clearStats();
    return null;
  }
}

// ─── Plotly helpers ───────────────────────────────────────────────────────────

/** Colours that differ between dark and light theme. */
function themeColors() {
  const dark = getTheme() === 'dark';
  return {
    paper:      dark ? '#001122' : '#f0f2f5',
    plot:       dark ? '#001122' : '#f0f2f5',
    axisPane:   dark ? '#000C1D' : '#ffffff',
    font:       dark ? '#8BADC1' : '#444c5a',
    fontBright: dark ? '#d6e9f8' : '#1a202c',
    grid:       dark ? '#102a44' : '#cdd2db',
    zeroline:   dark ? '#1e3a5f' : '#b0b8c4',
    marker:     dark ? '#4fc1ff' : '#1a73e8',
    markerLine: dark ? '#102a44' : '#1557b0',
  };
}

/** Read current axis toggle + label state from UI controls. */
function axisSettings() {
  return {
    xOn:    document.getElementById('axisX').checked,
    yOn:    document.getElementById('axisY').checked,
    zOn:    document.getElementById('axisZ').checked,
    xLabel: document.getElementById('labelX').value.trim() || 'X',
    yLabel: document.getElementById('labelY').value.trim() || 'Y',
    zLabel: document.getElementById('labelZ').value.trim() || 'Z',
  };
}

/** Build Plotly traces — one per unique word so same-word points share a colour. */
function buildTraces(points) {
  const showLabels = document.getElementById('showLabels').checked;
  const ax  = axisSettings();
  const col = themeColors();

  const PALETTE = [
    '#4fc1ff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8',
    '#ff922b', '#20c997', '#f06595', '#74c0fc', '#a9e34b',
    '#ff8787', '#63e6be', '#ffec99', '#d0bfff', '#ffa94d',
  ];

  // Collect unique words in first-seen order
  const wordOrder = [];
  const wordMap   = {};
  for (const p of points) {
    if (!(p.name in wordMap)) {
      wordMap[p.name] = { pts: [], color: PALETTE[wordOrder.length % PALETTE.length] };
      wordOrder.push(p.name);
    }
    wordMap[p.name].pts.push(p);
  }

  return wordOrder.map(word => {
    const { pts, color } = wordMap[word];
    const xs = pts.map(p => ax.xOn ? p.x : 0);
    const ys = pts.map(p => ax.yOn ? p.y : 0);
    const zs = pts.map(p => ax.zOn ? p.z : 0);
    const hovertext = pts.map(p =>
      `<b>${escapeHtml(p.name)}</b><br>x: ${p.x}<br>y: ${p.y}<br>z: ${p.z}`
    );
    return {
      type: 'scatter3d',
      mode: showLabels ? 'markers+text' : 'markers',
      name: word,
      x: xs,
      y: ys,
      z: zs,
      text:         pts.map(p => p.name),
      textposition: 'top center',
      hovertext,
      hoverinfo:    'text',
      textfont: {
        size:   11,
        color:  col.fontBright,
        family: 'Segoe UI, system-ui, sans-serif',
      },
      marker: {
        size:    7,
        color,
        opacity: 0.92,
        line: { color: col.markerLine, width: 1 },
      },
    };
  });
}

/** Build the Plotly layout. Applies camera if provided. */
function buildLayout(camera) {
  const ax  = axisSettings();
  const col = themeColors();

  /** Config for one axis. */
  function axis(label, visible) {
    return {
      title: {
        text: visible ? label : '',
        font: { color: col.fontBright, size: 13 },
      },
      visible,
      showgrid:        visible,
      showticklabels:  visible,
      showspikes:      false,
      tickfont:        { color: col.font, size: 10 },
      gridcolor:       col.grid,
      zerolinecolor:   col.zeroline,
      zerolinewidth:   1,
      backgroundcolor: col.axisPane,
      range:           [0, 1],
    };
  }

  const scene = {
    xaxis: axis(ax.xLabel, ax.xOn),
    yaxis: axis(ax.yLabel, ax.yOn),
    zaxis: axis(ax.zLabel, ax.zOn),
    bgcolor:     col.axisPane,
    aspectmode: 'cube',
  };

  if (camera) scene.camera = camera;

  return {
    scene,
    paper_bgcolor: col.paper,
    plot_bgcolor:  col.plot,
    font: {
      color:  col.font,
      family: 'Segoe UI, system-ui, sans-serif',
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: true,
    legend: {
      font:    { color: col.fontBright, size: 11 },
      bgcolor: col.axisPane,
      bordercolor: col.grid,
      borderwidth: 1,
    },
    // Keep same key across refreshes → Plotly preserves internal UI state
    uirevision: uiRevision,
    hoverlabel: {
      bgcolor:     col.axisPane,
      bordercolor: col.grid,
      font: { color: col.fontBright, size: 12 },
    },
  };
}

const PLOTLY_CONFIG = {
  responsive:   true,
  displaylogo:  false,
  modeBarButtonsToRemove: ['toImage'],
};

/** Render / update the Plotly figure. */
function renderPlot(points) {
  const plotEl = document.getElementById('plot');
  const data   = buildTraces(points);
  const layout = buildLayout(currentCamera);

  Plotly.react(plotEl, data, layout, PLOTLY_CONFIG);

  // Attach camera-capture listener exactly once per plot element lifetime.
  if (!plotEl._cameraListenerAttached) {
    plotEl.on('plotly_relayout', event => {
      // Plotly emits 'scene.camera' key on every rotate/zoom.
      const cam = event['scene.camera'];
      if (cam) {
        currentCamera = cam;
      }
    });
    plotEl._cameraListenerAttached = true;
  }
}

// ─── Button handlers ──────────────────────────────────────────────────────────

async function handleRefresh() {
  const btn = document.getElementById('btnRefresh');
  btn.disabled = true;

  const data = await fetchData();
  if (data !== null) {
    renderPlot(data);
  }

  btn.disabled = false;
}


// ─── Status helpers ───────────────────────────────────────────────────────────

function setStatus(type, message) {
  const el = document.getElementById('statusText');
  el.className   = `status-text ${type}`;
  el.textContent = message;
}

function setStats(text) {
  document.getElementById('statsText').textContent = text;
}

function clearStats() {
  document.getElementById('statsText').textContent = '';
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Re-render if we already have data. Used by control change listeners. */
function reRenderIfData() {
  if (currentData.length > 0) renderPlot(currentData);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // 1. Apply saved / default theme (before rendering anything)
  applyTheme(getTheme());

  // 2. Theme toggle
  document.getElementById('themeToggle').addEventListener('change', e => {
    applyTheme(e.target.checked ? 'light' : 'dark');
  });

  // 3. Action buttons
  document.getElementById('btnRefresh').addEventListener('click', handleRefresh);

  // 4. Controls that change plot appearance without re-fetching
  ['showLabels', 'axisX', 'axisY', 'axisZ'].forEach(id => {
    document.getElementById(id).addEventListener('change', reRenderIfData);
  });

  ['labelX', 'labelY', 'labelZ'].forEach(id => {
    document.getElementById(id).addEventListener('input', reRenderIfData);
  });

  // 5. Initial data load
  handleRefresh();
});
