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
  });

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
});

ipcMain.on('close-tab', (_e, tabId) => {
  const view = tabs.get(tabId);
  if (!view) return;
  // If closing the currently displayed view, remove it from window
  try {
    if (currentView === view && mainWindow) {
      mainWindow.removeBrowserView(view);
      currentView = null;
    }
  } catch {}
  // Destroy and delete
  try { view.webContents.destroy(); } catch {}
  tabs.delete(tabId);
  if (mainWindow) mainWindow.webContents.send('tab-closed', tabId);

  // If closed tab was active, leave switching decision to renderer; ensure active id is valid
  if (activeTabId === tabId) {
    activeTabId = null;
  }
  // If no tabs remain, create one start tab automatically as a safety net
  if (tabs.size === 0) {
    createTab('start:');
  }
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
