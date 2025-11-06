const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentView;
let topChrome = 36; // default toolbar height
let leftChrome = 160; // default sidebar width (vertical tabs)
let rightChrome = 0; // width of GPT/Notes/menu when open on the right
let bottomChrome = 0; // height of bottom chrome (e.g., compact tab bar)
const frameBorder = 3; // border around the browsing area to reveal CSS frame
let activeTabId = null;
const tabs = new Map(); // tabId -> BrowserView
let nextTabId = 1;

// -------- Simple browsing history (file-persisted) --------
const HISTORY_LIMIT = 500;
let historyItems = [];

function getHistoryPath() {
  try {
    return path.join(app.getPath('userData'), 'history.json');
  } catch {
    return path.join(process.cwd(), 'history.json');
  }
}

function loadHistory() {
  try {
    const p = getHistoryPath();
    if (!fs.existsSync(p)) { historyItems = []; return; }
    const raw = fs.readFileSync(p, 'utf8');
    const arr = JSON.parse(raw || '[]');
    historyItems = Array.isArray(arr) ? arr.slice(-HISTORY_LIMIT) : [];
  } catch {
    historyItems = [];
  }
}

function saveHistory() {
  try {
    const p = getHistoryPath();
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(historyItems.slice(-HISTORY_LIMIT), null, 2));
  } catch {}
}

function notifyHistoryUpdated() {
  try {
    if (mainWindow) mainWindow.webContents.send('history-updated', historyItems);
  } catch {}
}

function recordHistory(url, title) {
  try {
    if (!url || typeof url !== 'string') return;
    // Normalize
    const u = String(url);
    const t = String(title || '') || '';
    // Skip about:blank
    if (u === 'about:blank') return;
    // Ignore internal devtools
    if (u.startsWith('devtools://')) return;
    // Avoid duplicate consecutive entries
    const last = historyItems[historyItems.length - 1];
    if (last && last.url === u) {
      // Update the title/timestamp of the last entry instead of pushing a new one
      last.title = t || last.title;
      last.ts = Date.now();
    } else {
      historyItems.push({ url: u, title: t, ts: Date.now() });
      if (historyItems.length > HISTORY_LIMIT) historyItems = historyItems.slice(-HISTORY_LIMIT);
    }
    saveHistory();
    notifyHistoryUpdated();
  } catch {}
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#1e1e1e'
  });

  // Load the browser UI
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register global-ish shortcuts (work across UI and BrowserView)
  try { registerShortcutsForWC(mainWindow.webContents); } catch {}
}

// Create browser view for rendering web pages
function setViewBounds(view) {
  if (!mainWindow || !view) return;
  const bounds = mainWindow.getContentBounds();
  view.setBounds({
    x: leftChrome + frameBorder,
    y: topChrome + frameBorder,
    width: Math.max(0, bounds.width - leftChrome - rightChrome - frameBorder * 2),
    height: Math.max(0, bounds.height - topChrome - bottomChrome - frameBorder * 2)
  });
  view.setAutoResize({ width: true, height: true });
}

function switchToView(view) {
  if (!mainWindow || !view) return;
  if (currentView) {
    try { mainWindow.removeBrowserView(currentView); } catch {}
  }
  currentView = view;
  mainWindow.addBrowserView(currentView);
  setViewBounds(currentView);
}

function getStartPagePath() {
  return path.join(app.getAppPath(), 'startpage', 'index.html');
}

function createTab(initialUrl) {
  const id = nextTabId++;
  const view = new BrowserView({
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  tabs.set(id, view);

  // Wire events to update renderer
  const wc = view.webContents;
  const sendUpdate = () => {
    if (mainWindow) {
      mainWindow.webContents.send('tab-updated', {
        tabId: id,
        title: wc.getTitle(),
        url: wc.getURL()
      });
    }
  };
  wc.on('page-title-updated', sendUpdate);
  wc.on('did-navigate', sendUpdate);
  wc.on('did-navigate-in-page', sendUpdate);
  wc.on('did-stop-loading', sendUpdate);
  // Record history when a navigation finishes loading
  wc.on('did-stop-loading', () => {
    try { recordHistory(wc.getURL(), wc.getTitle()); } catch {}
    // Also analyze colors for adaptive theme
    try { analyzeAndNotifyPageTheme(id, wc); } catch {}
  });

  // Ensure shortcuts work when the BrowserView has focus
  try { registerShortcutsForWC(wc); } catch {}

  if (!initialUrl || initialUrl === 'start:') {
    wc.loadFile(getStartPagePath());
  } else {
    wc.loadURL(initialUrl);
  }

  activeTabId = id;
  switchToView(view);

  if (mainWindow) {
    const urlForBar = (!initialUrl || initialUrl === 'start:') ? '' : initialUrl;
    mainWindow.webContents.send('tab-created', { tabId: id, url: urlForBar, title: '' });
  }
  return id;
}

function registerShortcutsForWC(wc) {
  if (!wc) return;
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = String(input.key || '').toLowerCase();
    const meta = !!input.meta;
    const alt = !!input.alt;
    // Only handle when our window is focused
    const winFocused = !!BrowserWindow.getFocusedWindow();
    if (!winFocused) return;

    // SUPER+T (new start page tab)
    if (meta && !alt && key === 't') {
      event.preventDefault();
      createTab('start:');
      return;
    }
    // SUPER+W (close active tab)
    if (meta && key === 'w') {
      event.preventDefault();
      const id = activeTabId;
      if (id != null) closeTabInternal(id);
      return;
    }
    // SUPER+G (open GPT)
    if (meta && key === 'g') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('shortcut', { action: 'open-gpt' });
      return;
    }
    // SUPER+N (open Notes)
    if (meta && key === 'n') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('shortcut', { action: 'open-notes' });
      return;
    }
    // SUPER+M (open Menu)
    if (meta && key === 'm') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('shortcut', { action: 'open-menu' });
      return;
    }
    // SUPER+ALT+T (next theme preset)
    if (meta && alt && key === 't') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('shortcut', { action: 'next-theme' });
      return;
    }
    // SUPER+L (focus URL)
    if (meta && key === 'l') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('shortcut', { action: 'focus-url' });
      return;
    }
    // SUPER+R (reload)
    if (meta && key === 'r') {
      event.preventDefault();
      const view = activeTabId ? tabs.get(activeTabId) : null;
      if (view) view.webContents.reload();
      return;
    }
    // SUPER+[ (back)
    if (meta && key === '[') {
      event.preventDefault();
      const view = activeTabId ? tabs.get(activeTabId) : null;
      if (view && view.webContents.canGoBack()) view.webContents.goBack();
      return;
    }
    // SUPER+] (forward)
    if (meta && key === ']') {
      event.preventDefault();
      const view = activeTabId ? tabs.get(activeTabId) : null;
      if (view && view.webContents.canGoForward()) view.webContents.goForward();
      return;
    }
    // SUPER+H (home)
    if (meta && key === 'h') {
      event.preventDefault();
      const view = activeTabId ? tabs.get(activeTabId) : null;
      if (view) view.webContents.loadFile(getStartPagePath());
      return;
    }
    // ESC (close panels)
    if (key === 'escape') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('shortcut', { action: 'escape' });
      return;
    }
  });
}

// Analyze the current page for an adaptive theme suggestion and notify renderer
async function analyzeAndNotifyPageTheme(tabId, wc){
  if (!wc) return;
  try {
    const result = await wc.executeJavaScript(`(() => {
      function getMetaColor(){
        const m = document.querySelector('meta[name="theme-color"]');
        if (!m) return null;
        const v = (m.getAttribute('content')||'').trim();
        return v || null;
      }
      function getBg(el){
        if (!el) return null;
        const cs = getComputedStyle(el);
        const c = cs.backgroundColor || cs.background || '';
        return c || null;
      }
      return {
        url: location.href,
        meta: getMetaColor(),
        bodyBg: getBg(document.body),
        docBg: getBg(document.documentElement)
      };
    })()`, true);
    const pick = (arr) => arr.find(v => v && typeof v === 'string' && v.trim());
    const url = result?.url || wc.getURL() || '';
    let bgHex = '#FFFFFF';
    let fgHex = '#000000';
    // Force default B/W for the start page
    if (/\/startpage\/index\.html/i.test(url)) {
      bgHex = '#000000';
      fgHex = '#FFFFFF';
    } else {
      const chosen = pick([result?.meta, result?.bodyBg, result?.docBg]) || 'rgb(255,255,255)';
      const { r, g, b } = parseColorToRgb(chosen);
      bgHex = rgbToHex(r, g, b);
      fgHex = pickTextColor(r, g, b);
    }
    if (mainWindow) mainWindow.webContents.send('adaptive-theme-suggested', { tabId, bg: bgHex, fg: fgHex, source: 'analyze' });
  } catch {}
}

function parseColorToRgb(input){
  try {
    if (!input) return { r:255, g:255, b:255 };
    let s = String(input).trim();
    if (s.startsWith('#')) {
      let h = s.slice(1);
      if (h.length === 3) h = h.split('').map(ch => ch+ch).join('');
      const r = parseInt(h.slice(0,2),16);
      const g = parseInt(h.slice(2,4),16);
      const b = parseInt(h.slice(4,6),16);
      return { r, g, b };
    }
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(',').map(x => x.trim());
      const r = Math.max(0, Math.min(255, parseInt(parts[0],10)));
      const g = Math.max(0, Math.min(255, parseInt(parts[1],10)));
      const b = Math.max(0, Math.min(255, parseInt(parts[2],10)));
      return { r, g, b };
    }
  } catch {}
  return { r:255, g:255, b:255 };
}

function rgbToHex(r,g,b){
  const to = (n)=> n.toString(16).padStart(2,'0');
  return '#' + to(r) + to(g) + to(b);
}

function pickTextColor(r,g,b){
  // Relative luminance approximation; pick #000 over light bg, #fff over dark bg
  const luminance = (0.2126*(r/255)) + (0.7152*(g/255)) + (0.0722*(b/255));
  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

// IPC handlers for browser actions
ipcMain.on('navigate-to', (event, payload) => {
  let { tabId, url } = payload || {};
  if (!url) return;
  const id = tabId || activeTabId;
  const view = id ? tabs.get(id) : null;
  if (!view) return;
  if (url === 'start:') {
    view.webContents.loadFile(getStartPagePath());
    return;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  view.webContents.loadURL(url);
});

ipcMain.on('go-back', (_e, { tabId } = {}) => {
  const id = tabId || activeTabId;
  const view = id ? tabs.get(id) : null;
  if (view && view.webContents.canGoBack()) view.webContents.goBack();
});

ipcMain.on('go-forward', (_e, { tabId } = {}) => {
  const id = tabId || activeTabId;
  const view = id ? tabs.get(id) : null;
  if (view && view.webContents.canGoForward()) view.webContents.goForward();
});

ipcMain.on('reload', (_e, { tabId } = {}) => {
  const id = tabId || activeTabId;
  const view = id ? tabs.get(id) : null;
  if (view) view.webContents.reload();
});

ipcMain.on('stop', (_e, { tabId } = {}) => {
  const id = tabId || activeTabId;
  const view = id ? tabs.get(id) : null;
  if (view) view.webContents.stop();
});

ipcMain.on('create-tab', (_e, initialUrl) => {
  createTab(initialUrl || 'https://www.google.com');
});

ipcMain.on('switch-tab', (_e, tabId) => {
  const view = tabs.get(tabId);
  if (!view) return;
  activeTabId = tabId;
  switchToView(view);
  // Suggest theme for new active tab as well
  try { analyzeAndNotifyPageTheme(tabId, view.webContents); } catch {}
});

ipcMain.on('close-tab', (_e, tabId) => {
  closeTabInternal(tabId);
});

function closeTabInternal(tabId){
  const view = tabs.get(tabId);
  if (!view) return;
  try {
    if (currentView === view && mainWindow) {
      mainWindow.removeBrowserView(view);
      currentView = null;
    }
  } catch {}
  try { view.webContents.destroy(); } catch {}
  tabs.delete(tabId);
  if (mainWindow) mainWindow.webContents.send('tab-closed', tabId);
  if (activeTabId === tabId) {
    activeTabId = null;
  }
  if (tabs.size === 0) {
    createTab('start:');
  }
}

// Focus the start page search input when requested by renderer
ipcMain.on('focus-startpage-search', () => {
  try {
    const view = activeTabId ? tabs.get(activeTabId) : null;
    if (!view) return;
    const wc = view.webContents;
    const url = wc.getURL() || '';
    if (!/\/startpage\/index\.html/i.test(url)) return;
    const js = `(() => { try { const el = document.getElementById('q'); if (el) { el.focus(); el.select(); } } catch(_){} })()`;
    wc.executeJavaScript(js, true).catch(() => {});
  } catch {}
});

// On-demand adaptive theme request from renderer
ipcMain.handle('request-adaptive-theme', async () => {
  try {
    const id = activeTabId;
    const view = id ? tabs.get(id) : null;
    if (!view) return { ok: false };
    await analyzeAndNotifyPageTheme(id, view.webContents);
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

// Apply theme colors to start page (active tab) by setting CSS variables in the page
ipcMain.on('set-startpage-theme', (_e, payload) => {
  try {
    const { fg, bg, font, startBg, fontId } = payload || {};
    const isHex = (x) => typeof x === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(x);
    if (!isHex(fg) || !isHex(bg)) return;
    const view = activeTabId ? tabs.get(activeTabId) : null;
    if (!view) return;
    const wc = view.webContents;
    const url = wc.getURL() || '';
    if (!/\/startpage\/index\.html/i.test(url)) return;
    let js = `document.documentElement.style.setProperty('--fg','${fg}'); document.documentElement.style.setProperty('--bg','${bg}');`;
    if (font && typeof font === 'string') {
      // Escape single quotes for safe injection
      const safeFont = font.replace(/'/g, "\\'");
      js += ` document.documentElement.style.setProperty('--font','${safeFont}');`;
    }
    // Optional start page background mode
    if (typeof startBg === 'string') {
      const allowed = ['noise','none'];
      if (allowed.includes(startBg)) {
        js += ` document.documentElement.style.setProperty('--start-bg-mode','${startBg}');`;
        // Nudge the page to apply immediately if helper exists
        js += ` if (window.__applyStartBgMode) { try { window.__applyStartBgMode('${startBg}'); } catch(e){} }`;
      }
    }
    if (typeof fontId === 'string') {
      const safeId = fontId.replace(/[^a-z0-9\-_.]/gi, '');
      js += ` document.documentElement.setAttribute('data-font-id','${safeId}');`;
    }
    wc.executeJavaScript(js, true).catch(() => {});
  } catch {}
});

// App lifecycle
app.whenReady().then(() => {
  // Load browsing history early
  loadHistory();
  createWindow();
  // Tabs are created by renderer on load
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Receive toolbar height from renderer and update view bounds
ipcMain.on('chrome-metrics', (_event, metrics) => {
  if (metrics && typeof metrics.top === 'number') topChrome = Math.ceil(metrics.top);
  if (metrics && typeof metrics.left === 'number') leftChrome = Math.ceil(metrics.left);
  if (metrics && typeof metrics.right === 'number') rightChrome = Math.ceil(metrics.right);
  if (metrics && typeof metrics.bottom === 'number') bottomChrome = Math.ceil(metrics.bottom);
  if (currentView) setViewBounds(currentView);
});

// History IPC
ipcMain.handle('get-history', async () => {
  return { ok: true, items: historyItems };
});

ipcMain.handle('clear-history', async () => {
  historyItems = [];
  saveHistory();
  notifyHistoryUpdated();
  return { ok: true };
});

ipcMain.handle('delete-history-item', async (_e, payload) => {
  try {
    const { ts, url } = payload || {};
    if (typeof ts !== 'number' && !url) return { ok: false };
    const idx = historyItems.findIndex(h => (typeof ts === 'number' ? h.ts === ts : true) && (url ? h.url === url : true));
    if (idx >= 0) {
      historyItems.splice(idx, 1);
      saveHistory();
      notifyHistoryUpdated();
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

// ChatGPT IPC (main process calls OpenAI)
ipcMain.on('chatgpt-ask', async (event, payload) => {
  const { id, messages } = payload || {};
  const apiKey = process.env.OPENAI_API_KEY || getSavedKey();
  if (!apiKey) {
    event.sender.send('chatgpt-reply', { id, error: 'OPENAI_API_KEY not set' });
    return;
  }

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.2 })
    });
    if (!res.ok) {
      const text = await res.text();
      event.sender.send('chatgpt-reply', { id, error: `HTTP ${res.status}: ${text}` });
      return;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    event.sender.send('chatgpt-reply', { id, content });
  } catch (err) {
    event.sender.send('chatgpt-reply', { id, error: String(err) });
  }
});

// Extract visible page text from the active tab
ipcMain.handle('extract-page-text', async () => {
  try {
    const view = activeTabId ? tabs.get(activeTabId) : null;
    if (!view) return { ok: false, error: 'No active tab' };
    const wc = view.webContents;
    const extractionJS = `(() => {
      function collectText(root){
        const clone = root.cloneNode(true);
        const removeSel = [
          'nav','header','footer','aside','script','style','noscript','iframe','svg','canvas','form','input','button','select','textarea','template','dialog','menu','picture','video','audio','figure'
        ];
        removeSel.forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()));
        clone.querySelectorAll('[role="navigation"],[role="banner"],[role="contentinfo"],[aria-hidden="true"]').forEach(n=>n.remove());
        const target = clone.querySelector('main, article') || clone;
        let text = (target.innerText || '').replace(/\s+/g,' ').trim();
        return text;
      }
      const title = document.title || '';
      const url = location.href;
      const text = collectText(document.body || document.documentElement);
      return { title, url, text };
    })()`;
    const result = await wc.executeJavaScript(extractionJS, true);
    const title = result?.title || '';
    const url = result?.url || '';
    let text = result?.text || '';
    // Cap the length to avoid sending unnecessary data
    const maxChars = 12000;
    const originalLen = text.length;
    if (text.length > maxChars) text = text.slice(0, maxChars);
    return { ok: true, url, title, text, originalLen, sentLen: text.length, truncated: originalLen > maxChars };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// -------- Simple file-based secret storage (fallback) --------
function getSecretsPath() {
  try {
    return path.join(app.getPath('userData'), 'secrets.json');
  } catch {
    return path.join(process.cwd(), 'secrets.json');
  }
}

function readSecrets() {
  try {
    const p = getSecretsPath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function writeSecrets(obj) {
  try {
    const p = getSecretsPath();
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

function getSavedKey() {
  const sec = readSecrets();
  return typeof sec.openaiKey === 'string' && sec.openaiKey ? sec.openaiKey : null;
}

function saveOpenAIKey(key) {
  const sec = readSecrets();
  sec.openaiKey = key;
  return writeSecrets(sec);
}

app.whenReady().then(() => {
  // Preload key into env if present
  const k = getSavedKey();
  if (k && !process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = k;
});

// IPC: key management
ipcMain.handle('get-openai-key-status', async () => {
  const k = process.env.OPENAI_API_KEY || getSavedKey();
  if (k) process.env.OPENAI_API_KEY = k;
  return { exists: !!k, last4: k ? String(k).slice(-4) : null };
});

ipcMain.handle('save-openai-key', async (_e, key) => {
  const k = (key || '').trim();
  if (!k) return { ok: false, error: 'Empty key' };
  if (!k.startsWith('sk-')) return { ok: false, error: 'Must start with sk-' };
  const ok = saveOpenAIKey(k);
  if (ok) process.env.OPENAI_API_KEY = k;
  return { ok, last4: k.slice(-4) };
});

ipcMain.handle('test-openai-key', async (_e, maybeKey) => {
  const k = (maybeKey && maybeKey.trim()) || process.env.OPENAI_API_KEY || getSavedKey();
  if (!k) return { ok: false, error: 'No key set' };
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${k}`
      }
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
