const { ipcRenderer } = require('electron');

// DOM Elements
const addressBar = document.getElementById('address-bar');
const protocolEl = document.querySelector('.protocol');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');
const menuBtn = document.getElementById('menu-btn');
const tabsEl = document.getElementById('tabs');
const addTabBtn = document.getElementById('add-tab-btn');
const gptToggleBtn = document.getElementById('gpt-toggle-btn');
const gptSidebar = document.getElementById('chatgpt-sidebar');
const gptMessages = document.getElementById('chatgpt-messages');
const gptForm = document.getElementById('chatgpt-form');
const gptInput = document.getElementById('chatgpt-text');
const gptTabsEl = document.getElementById('chatgpt-tabs');
const gptNewBtn = document.getElementById('chatgpt-new');
const gptAskPageBtn = document.getElementById('chatgpt-ask-page');
const gptTagsEl = document.getElementById('chatgpt-tags');
// Notes sidebar elements
const notesToggleBtn = document.getElementById('notes-toggle-btn');
const notesSidebar = document.getElementById('notes-sidebar');
const notesTabsEl = document.getElementById('notes-tabs');
const notesNewBtn = document.getElementById('notes-new');
const notesTextarea = document.getElementById('notes-textarea');
const browserViewContainer = document.getElementById('browser-view-container');
// Menu panel elements
const menuPanel = document.getElementById('menu-panel');
const menuClose = document.getElementById('menu-close');
const menuTabSettings = document.getElementById('menu-tab-settings');
const menuTabHistory = document.getElementById('menu-tab-history');
const menuTabAbout = document.getElementById('menu-tab-about');
const menuPageSettings = document.getElementById('menu-page-settings');
const menuPageHistory = document.getElementById('menu-page-history');
const menuPageAbout = document.getElementById('menu-page-about');
const openaiKeyInput = document.getElementById('openai-key');
const showKeyBtn = document.getElementById('show-key');
const saveKeyBtn = document.getElementById('save-openai-key');
const testKeyBtn = document.getElementById('test-openai-key');
const keyStatus = document.getElementById('key-status');
const compactToggle = document.getElementById('compact-mode');
const compactState = document.getElementById('compact-mode-state');
// Adaptive theme controls
const adaptiveToggle = document.getElementById('adaptive-theme');
const adaptiveState = document.getElementById('adaptive-theme-state');
const adaptiveFadeToggle = document.getElementById('adaptive-fade');
const adaptiveFadeState = document.getElementById('adaptive-fade-state');
// Theme color controls
const colorFgInput = document.getElementById('color-fg');
const colorBgInput = document.getElementById('color-bg');
const applyColorsBtn = document.getElementById('apply-colors');
const resetColorsBtn = document.getElementById('reset-colors');
// Font controls
const fontSelect = document.getElementById('font-select');
const applyFontBtn = document.getElementById('apply-font');
// Start page background controls (ON/OFF)
const startBgToggle = document.getElementById('start-bg-toggle');
const startBgState = document.getElementById('start-bg-state');
const applyStartBgBtn = document.getElementById('apply-start-bg');
// Preset controls
const presetSelect = document.getElementById('preset-select');
const applyPresetBtn = document.getElementById('apply-preset');
const savePresetBtn = document.getElementById('save-preset');
const deletePresetBtn = document.getElementById('delete-preset');
const presetNameInput = document.getElementById('preset-name');
// History elements
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const clearHistoryBtn = document.getElementById('clear-history');

// Tab state in renderer
let tabs = []; // [{id, title, url}]
let activeTabId = null;
let shouldCloseWindowIfNoTabs = false; // when true, closing last tab will close the window instead of reopening start page

// Navigation functions
function stripScheme(u){
  if (!u) return '';
  if (u.startsWith('https://')) return u.slice(8);
  if (u.startsWith('http://')) return u.slice(7);
  return u;
}

function setAddressBarDisplay(url){
  // start page shows empty
  const isStart = url && url.startsWith('file:') && url.toLowerCase().includes('/startpage/index.html');
  const display = isStart ? '' : stripScheme(url);
  if (addressBar) addressBar.value = display;
  if (protocolEl) {
    if (isStart) protocolEl.textContent = '';
    else if (url?.startsWith('http://')) protocolEl.textContent = 'http://';
    else if (url?.startsWith('https://')) protocolEl.textContent = 'https://';
    else protocolEl.textContent = '';
  }
}

function navigateTo(url) {
  if (!url) return;
  
  // Clean and validate URL
  url = url.trim();
  
  // Special-case the local start page route
  if (url === 'start:') {
    // Display nothing in the address bar and navigate to start page
    setAddressBarDisplay('');
    ipcRenderer.send('navigate-to', { tabId: activeTabId, url });
    return;
  }
  
  // If it looks like a search query, use Google search
  if (!url.includes('.') && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Update address bar (hide scheme in input)
  setAddressBarDisplay(url);
  
  // Send navigation request to main process for active tab
  ipcRenderer.send('navigate-to', { tabId: activeTabId, url });
}

function goBack() {
  ipcRenderer.send('go-back', { tabId: activeTabId });
}

function goForward() {
  ipcRenderer.send('go-forward', { tabId: activeTabId });
}

function reload() {
  ipcRenderer.send('reload', { tabId: activeTabId });
}

function goHome() {
  navigateTo('start:');
}

// Tabs UI helpers
function renderTabs() {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const tab = document.createElement('button');
    tab.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(t.id === activeTabId));
    tab.dataset.id = String(t.id);

    const title = document.createElement('span');
    title.className = 'tab-title';
  title.textContent = t.title || t.url || 'ARKIUM START';

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.type = 'button';
    close.title = 'Close Tab';
    close.textContent = 'X';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(t.id);
    });

    tab.addEventListener('click', () => selectTab(t.id));
    tab.appendChild(title);
    tab.appendChild(close);
    tabsEl.appendChild(tab);
  }
}

function selectTab(id) {
  if (id === activeTabId) return;
  activeTabId = id;
  ipcRenderer.send('switch-tab', id);
  const t = tabs.find(x => x.id === id);
  if (t?.url) setAddressBarDisplay(t.url);
  renderTabs();
}

function addTab(initialUrl) {
  ipcRenderer.send('create-tab', initialUrl);
}

function closeTab(id) {
  // Decide next active tab before mutating local state
  const idx = tabs.findIndex(x => x.id === id);
  let nextId = null;
  if (idx !== -1) {
    const right = tabs[idx + 1]?.id;
    const left = tabs[idx - 1]?.id;
    nextId = right ?? left ?? null;
  }
  // Ask main to close the tab
  ipcRenderer.send('close-tab', id);
  // Update local state optimistically
  tabs = tabs.filter(x => x.id !== id);
  if (activeTabId === id) {
    if (nextId != null) {
      selectTab(nextId);
    }
  } else {
    renderTabs();
  }
}

// Event Listeners
addressBar.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigateTo(addressBar.value);
  }
});

addressBar.addEventListener('focus', () => {
  addressBar.select();
});

backBtn.addEventListener('click', goBack);
forwardBtn.addEventListener('click', goForward);
reloadBtn.addEventListener('click', reload);
homeBtn.addEventListener('click', goHome);

menuBtn.addEventListener('click', () => {
  toggleMenu();
});

addTabBtn.addEventListener('click', () => addTab('start:'));

// Measure toolbar height and inform main process
function reportChromeMetrics() {
  const toolbar = document.querySelector('.browser-controls');
  const tabbar = document.querySelector('.tab-bar');
  const top = toolbar ? Math.ceil(toolbar.getBoundingClientRect().height) : 0;
  // In compact mode, tabs are at the bottom (horizontal). Otherwise on the left (vertical).
  const isCompact = document.body.classList.contains('compact-mode');
  const rect = tabbar ? tabbar.getBoundingClientRect() : null;
  const left = isCompact ? 0 : (rect ? Math.ceil(rect.width) : 0);
  const bottom = isCompact ? (rect ? Math.ceil(rect.height) : 0) : 0;
  const rightMenu = (menuPanel && menuPanel.classList.contains('open')) ? Math.ceil(menuPanel.getBoundingClientRect().width) : 0;
  const rightGpt = (gptSidebar && gptSidebar.classList.contains('open')) ? Math.ceil(gptSidebar.getBoundingClientRect().width) : 0;
  const rightNotes = (typeof notesSidebar !== 'undefined' && notesSidebar && notesSidebar.classList.contains('open')) ? Math.ceil(notesSidebar.getBoundingClientRect().width) : 0;
  const right = rightMenu + rightGpt + rightNotes;
  // reflect right chrome width in CSS for the frame element
  if (browserViewContainer) {
    document.documentElement.style.setProperty('--right-chrome', right + 'px');
    document.documentElement.style.setProperty('--left-chrome', left + 'px');
    document.documentElement.style.setProperty('--bottom-chrome', bottom + 'px');
  }
  ipcRenderer.send('chrome-metrics', { top, left, right, bottom });
}

// Handle window resize to adjust BrowserView using measured toolbar height
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    reportChromeMetrics();
  }, 100);
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Arkium initialized');
  // Restore font selection
  try {
    const fid = loadSavedFontId();
    applyFontById(fid);
    if (fontSelect) fontSelect.value = fid;
  } catch {}
  // Restore start page background toggle
  try {
    const bg = loadSavedStartBg();
    const on = bg !== 'none';
    if (startBgToggle) startBgToggle.checked = on;
    if (startBgState) startBgState.textContent = on ? 'ON' : 'OFF';
  } catch {}
  // Restore compact mode preference
  try {
    const savedCompact = localStorage.getItem('atb_compact_mode');
    const enabled = savedCompact === '1' || savedCompact === 'true';
    if (enabled) document.body.classList.add('compact-mode');
    if (compactToggle) compactToggle.checked = enabled;
    if (compactState) compactState.textContent = enabled ? 'ON' : 'OFF';
  } catch {}
  // Restore adaptive theme preference
  try {
    const saved = localStorage.getItem('atb_adaptive_theme');
    const on = saved === '1' || saved === 'true';
    if (adaptiveToggle) adaptiveToggle.checked = on;
    if (adaptiveState) adaptiveState.textContent = on ? 'ON' : 'OFF';
    // If enabled, request immediate analysis for the current (soon-to-be) active tab after it loads
    if (on) setTimeout(() => { try { ipcRenderer.invoke('request-adaptive-theme'); } catch {} }, 500);
  } catch {}
  // Restore adaptive fade preference (default ON)
  try {
    const saved = localStorage.getItem('atb_adaptive_fade');
    const on = saved == null || saved === '1' || saved === 'true';
    if (adaptiveFadeToggle) adaptiveFadeToggle.checked = on;
    if (adaptiveFadeState) adaptiveFadeState.textContent = on ? 'ON' : 'OFF';
    updateAdaptiveFadeClass();
  } catch {}
  // Restore theme colors
  try {
    const raw = localStorage.getItem('atb_theme_colors');
    const parsed = raw ? JSON.parse(raw) : null;
    const fg = parsed?.fg && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(parsed.fg) ? parsed.fg : '#ffffff';
    const bg = parsed?.bg && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(parsed.bg) ? parsed.bg : '#000000';
    document.documentElement.style.setProperty('--fg', fg);
    document.documentElement.style.setProperty('--bg', bg);
    if (colorFgInput) colorFgInput.value = fg.toUpperCase();
    if (colorBgInput) colorBgInput.value = bg.toUpperCase();
  } catch {}
  reportChromeMetrics();
  // Initialize key status
  updateKeyStatus();
  // Restore chats
  try {
    const raw = localStorage.getItem('atb_chats');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) chats = parsed.filter(c => c && Array.isArray(c.messages));
    }
    const savedActive = localStorage.getItem('atb_active_chat');
    if (savedActive) activeChatId = Number(savedActive);
  } catch {}
  if (!chats.length) newChat(); else { renderChatTabs(); if (!activeChatId) activeChatId = chats[0].id; renderChatMessages(); }
  // Restore last prompt into input
  try { const last = localStorage.getItem('atb_last_prompt'); if (gptInput && last) gptInput.value = last; } catch {}
  // Restore notes
  try {
    const rawNotes = localStorage.getItem('atb_notes');
    if (rawNotes) {
      const arr = JSON.parse(rawNotes);
      if (Array.isArray(arr)) notes = arr.filter(n => n && typeof n.id !== 'undefined');
    }
    const savedNoteId = localStorage.getItem('atb_active_note');
    if (savedNoteId) activeNoteId = Number(savedNoteId);
  } catch {}
  if (!notes.length) newNote(); else { renderNotesTabs(); if (!activeNoteId) activeNoteId = notes[0].id; renderNoteEditor(); }
  // Create first tab - start page
  addTab('start:');
});

// ===== Always focus website content (active BrowserView) =====
// Aggressively redirect focus back to the webview to keep sites keyboard-active.
function refocusWebviewSoon(){ try { ipcRenderer.send('focus-webview'); } catch {} }
// Any click in the UI -> return focus to content right after
document.addEventListener('mousedown', () => { setTimeout(refocusWebviewSoon, 0); }, true);
document.addEventListener('mouseup', () => { setTimeout(refocusWebviewSoon, 0); }, true);
// Any focus shift in UI -> defocus and return to content
document.addEventListener('focusin', (e) => {
  try { if (e.target && typeof e.target.blur === 'function') e.target.blur(); } catch {}
  setTimeout(refocusWebviewSoon, 0);
}, true);
// When the window regains focus, push it to the webview as well
window.addEventListener('focus', () => { setTimeout(refocusWebviewSoon, 0); });

// Compact mode toggle removed from UI; logic kept for compatibility if key exists

// Adaptive theme toggle
adaptiveToggle?.addEventListener('change', () => {
  const on = !!adaptiveToggle.checked;
  try { localStorage.setItem('atb_adaptive_theme', on ? '1' : '0'); } catch {}
  if (adaptiveState) adaptiveState.textContent = on ? 'ON' : 'OFF';
  updateAdaptiveFadeClass();
  if (on) {
    // Request analysis and apply when response arrives
    try { ipcRenderer.invoke('request-adaptive-theme'); } catch {}
  } else {
    // Revert to saved manual theme
    try {
      const raw = localStorage.getItem('atb_theme_colors');
      const parsed = raw ? JSON.parse(raw) : null;
      const fg = parsed?.fg || '#ffffff';
      const bg = parsed?.bg || '#000000';
      applyThemeColors(fg, bg);
    } catch {}
  }
});

// Adaptive fade toggle
adaptiveFadeToggle?.addEventListener('change', () => {
  const on = !!adaptiveFadeToggle.checked;
  try { localStorage.setItem('atb_adaptive_fade', on ? '1' : '0'); } catch {}
  if (adaptiveFadeState) adaptiveFadeState.textContent = on ? 'ON' : 'OFF';
  updateAdaptiveFadeClass();
});

function updateAdaptiveFadeClass(){
  try {
    const ad = localStorage.getItem('atb_adaptive_theme');
    const adaptiveOn = ad === '1' || ad === 'true';
    const fadeSaved = localStorage.getItem('atb_adaptive_fade');
    const fadeOn = fadeSaved == null || fadeSaved === '1' || fadeSaved === 'true';
    const shouldDisable = adaptiveOn && !fadeOn;
    document.body.classList.toggle('no-adaptive-fade', shouldDisable);
  } catch {}
}

function applyThemeColors(fg, bg){
  document.documentElement.style.setProperty('--fg', fg);
  document.documentElement.style.setProperty('--bg', bg);
}
// ===== Global font selection =====
const FONT_STACKS = {
  'tiny5': "'Tiny5', monospace",
  'inter': "'Inter', sans-serif",
  'ibm-plex-mono': "'IBM Plex Mono', monospace",
  'jetbrains-mono': "'JetBrains Mono', monospace",
  'press-start-2p': "'Press Start 2P', cursive",
  'space-mono': "'Space Mono', monospace",
};

function applyFontById(id){
  const stack = FONT_STACKS[id] || FONT_STACKS['tiny5'];
  document.documentElement.style.setProperty('--font', stack);
}

function loadSavedFontId(){
  try { return localStorage.getItem('atb_font') || 'tiny5'; } catch { return 'tiny5'; }
}
function saveFontId(id){
  try { localStorage.setItem('atb_font', id); } catch {}
}

// Start page background helpers
function loadSavedStartBg(){
  try { return localStorage.getItem('atb_start_bg') || 'noise'; } catch { return 'noise'; }
}
function saveStartBg(mode){
  try { localStorage.setItem('atb_start_bg', mode); } catch {}
}


function validHex(x){ return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(x || ''); }

function syncPresetSelectionToCurrentColors(){
  if (!presetSelect) return;
  try {
    const fg = (colorFgInput?.value || '').toUpperCase();
    const bg = (colorBgInput?.value || '').toUpperCase();
    const m = matchPresetByColors(fg, bg);
    if (m) {
      if (m.source === 'builtin') presetSelect.value = `builtin:${m.id}`;
      else if (m.source === 'saved') presetSelect.value = `saved:${m.name}`;
    } else {
      presetSelect.value = '';
    }
    updateDeletePresetState();
  } catch {}
}

applyColorsBtn?.addEventListener('click', () => {
  const fg = (colorFgInput?.value || '').trim();
  const bg = (colorBgInput?.value || '').trim();
  if (!validHex(fg) || !validHex(bg)) {
    alert('Enter valid HEX colors like #000000 and #FFFFFF');
    return;
  }
  applyThemeColors(fg, bg);
  try { localStorage.setItem('atb_theme_colors', JSON.stringify({ fg, bg })); } catch {}
  // If the active tab is the start page, apply into it immediately
  try {
    const t = tabs.find(tt => tt.id === activeTabId);
    if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
  const fid = loadSavedFontId();
  const font = FONT_STACKS[fid] || FONT_STACKS['tiny5'];
  const startBg = loadSavedStartBg();
      let sendFg = fg, sendBg = bg;
      try {
        const ad = localStorage.getItem('atb_adaptive_theme');
        const adaptiveOn = ad === '1' || ad === 'true';
        if (adaptiveOn) { sendFg = '#ffffff'; sendBg = '#000000'; }
      } catch {}
      ipcRenderer.send('set-startpage-theme', { fg: sendFg, bg: sendBg, font, startBg, fontId: fid });
    }
  } catch {}
  // reflect selection if it matches a preset
  syncPresetSelectionToCurrentColors();
});

resetColorsBtn?.addEventListener('click', () => {
  const fg = '#ffffff';
  const bg = '#000000';
  applyThemeColors(fg, bg);
  if (colorFgInput) colorFgInput.value = fg;
  if (colorBgInput) colorBgInput.value = bg;
  try { localStorage.setItem('atb_theme_colors', JSON.stringify({ fg, bg })); } catch {}
  try {
    const t = tabs.find(tt => tt.id === activeTabId);
    if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
      // also include current font stack
  const fid = loadSavedFontId();
  const font = FONT_STACKS[fid] || FONT_STACKS['tiny5'];
  const startBg = loadSavedStartBg();
      let sendFg = fg, sendBg = bg;
      try {
        const ad = localStorage.getItem('atb_adaptive_theme');
        const adaptiveOn = ad === '1' || ad === 'true';
        if (adaptiveOn) { sendFg = '#ffffff'; sendBg = '#000000'; }
      } catch {}
      ipcRenderer.send('set-startpage-theme', { fg: sendFg, bg: sendBg, font, startBg, fontId: fid });
    }
  } catch {}
  syncPresetSelectionToCurrentColors();
});

// Apply font button
applyFontBtn?.addEventListener('click', () => {
  const id = (fontSelect?.value || 'tiny5');
  applyFontById(id);
  saveFontId(id);
  // If start page active, inject font var too
  try {
    const t = tabs.find(tt => tt.id === activeTabId);
    if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
      // keep existing theme colors
      const raw = localStorage.getItem('atb_theme_colors');
      const parsed = raw ? JSON.parse(raw) : null;
      let fg = parsed?.fg || '#ffffff';
      let bg = parsed?.bg || '#000000';
  const font = FONT_STACKS[id] || FONT_STACKS['tiny5'];
  const startBg = loadSavedStartBg();
      try {
        const ad = localStorage.getItem('atb_adaptive_theme');
        const adaptiveOn = ad === '1' || ad === 'true';
        if (adaptiveOn) { fg = '#ffffff'; bg = '#000000'; }
      } catch {}
      ipcRenderer.send('set-startpage-theme', { fg, bg, font, startBg, fontId: id });
    }
  } catch {}
});

// ===== Color Presets (built-in + user saved) =====
const BUILTIN_PRESETS = [
  { id: 'classic', name: 'Classic (White on Black)', fg: '#FFFFFF', bg: '#000000' },
  { id: 'inverted', name: 'Inverted (Black on White)', fg: '#000000', bg: '#FFFFFF' },
  { id: 'green-phosphor', name: 'Green Phosphor', fg: '#39FF14', bg: '#000000' },
  { id: 'amber', name: 'Amber', fg: '#FFBF00', bg: '#000000' },
  { id: 'navy-ice', name: 'Navy + Ice', fg: '#CDE6FF', bg: '#001833' },
  { id: 'mint-chocolate', name: 'Mint + Chocolate', fg: '#C8FFD4', bg: '#2B1B12' },
  { id: 'violet-noir', name: 'Violet Noir', fg: '#EDE3FF', bg: '#140027' },
  // Extras
  { id: 'teal-on-black', name: 'Teal on Black', fg: '#00FFD0', bg: '#000000' },
  { id: 'cyanotype', name: 'Cyanotype', fg: '#BFE8FF', bg: '#001B2E' },
  { id: 'solarized-dark', name: 'Solarized Dark (2-col)', fg: '#EEE8D5', bg: '#002B36' },
  { id: 'solarized-light', name: 'Solarized Light (2-col)', fg: '#073642', bg: '#FDF6E3' },
  { id: 'gameboy', name: 'Game Boy', fg: '#0F380F', bg: '#E0F8D0' },
  { id: 'hot-pink-noir', name: 'Hot Pink Noir', fg: '#FF66CC', bg: '#000000' },
  { id: 'terminal-green', name: 'Terminal Green', fg: '#00FF00', bg: '#000000' },
  { id: 'nord-dark', name: 'Nord Dark (2-col)', fg: '#D8DEE9', bg: '#2E3440' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark (2-col)', fg: '#EBDBB2', bg: '#282828' },
  { id: 'gruvbox-light', name: 'Gruvbox Light (2-col)', fg: '#3C3836', bg: '#FBF1C7' },
  { id: 'fire', name: 'Fire', fg: '#FFD166', bg: '#1B0B0B' },
  { id: 'forest', name: 'Forest', fg: '#D2FFCB', bg: '#081C0C' },
  { id: 'royal', name: 'Royal', fg: '#EAD9FF', bg: '#1B1464' },
  { id: 'ocean-midnight', name: 'Ocean Midnight', fg: '#9AEDFF', bg: '#001219' },
  { id: 'blue-screen', name: 'Blue Screen', fg: '#FFFFFF', bg: '#0000AA' },
  { id: 'hi-contrast-yellow', name: 'High Contrast Yellow', fg: '#FFFF00', bg: '#000000' },
  { id: 'magenta-noir', name: 'Magenta Noir', fg: '#FF00FF', bg: '#000000' },
  { id: 'aqua-noir', name: 'Aqua Noir', fg: '#00FFFF', bg: '#000000' },
  { id: 'paper-ink', name: 'Paper Ink', fg: '#111111', bg: '#FAFAFA' },
  // Catppuccin (2-col variants)
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha (2-col)', fg: '#CDD6F4', bg: '#1E1E2E' },
  { id: 'catppuccin-macchiato', name: 'Catppuccin Macchiato (2-col)', fg: '#CAD3F5', bg: '#24273A' },
  { id: 'catppuccin-frappe', name: 'Catppuccin Frappé (2-col)', fg: '#C6D0F5', bg: '#303446' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte (2-col)', fg: '#4C4F69', bg: '#EFF1F5' },
];

const PRESETS_KEY = 'atb_color_presets';
function loadSavedPresets(){
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      // sanitize
      return arr.filter(p => p && typeof p.name === 'string' && validHex(p.fg) && validHex(p.bg));
    }
  } catch {}
  return [];
}
function saveSavedPresets(list){
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list || [])); } catch {}
}

function populatePresetSelect(){
  if (!presetSelect) return;
  presetSelect.innerHTML = '';

  // Placeholder option
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select a preset —';
  presetSelect.appendChild(placeholder);

  const ogBuilt = document.createElement('optgroup');
  ogBuilt.label = 'Built-in';
  BUILTIN_PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = `builtin:${p.id}`;
    opt.textContent = p.name;
    opt.dataset.source = 'builtin';
    opt.dataset.fg = p.fg.toUpperCase();
    opt.dataset.bg = p.bg.toUpperCase();
    ogBuilt.appendChild(opt);
  });
  presetSelect.appendChild(ogBuilt);

  const saved = loadSavedPresets();
  const ogSaved = document.createElement('optgroup');
  ogSaved.label = 'Saved';
  saved.forEach(p => {
    const opt = document.createElement('option');
    opt.value = `saved:${p.name}`;
    opt.textContent = p.name;
    opt.dataset.source = 'saved';
    opt.dataset.fg = p.fg.toUpperCase();
    opt.dataset.bg = p.bg.toUpperCase();
    ogSaved.appendChild(opt);
  });
  if (saved.length) presetSelect.appendChild(ogSaved);

  updateDeletePresetState();
}

function updateDeletePresetState(){
  if (!deletePresetBtn || !presetSelect) return;
  const val = presetSelect.value || '';
  const isSaved = val.startsWith('saved:');
  deletePresetBtn.disabled = !isSaved;
}

function matchPresetByColors(fg, bg){
  const F = (fg || '').toUpperCase();
  const B = (bg || '').toUpperCase();
  // built-ins
  for (const p of BUILTIN_PRESETS) {
    if (p.fg.toUpperCase() === F && p.bg.toUpperCase() === B) return { source: 'builtin', id: p.id };
  }
  // saved
  for (const p of loadSavedPresets()) {
    if (p.fg.toUpperCase() === F && p.bg.toUpperCase() === B) return { source: 'saved', name: p.name };
  }
  return null;
}

// Initialize presets UI once DOM and color inputs are ready
document.addEventListener('DOMContentLoaded', () => {
  populatePresetSelect();
  try {
    const fg = (colorFgInput?.value || '').toUpperCase();
    const bg = (colorBgInput?.value || '').toUpperCase();
    const m = matchPresetByColors(fg, bg);
    if (m && presetSelect) {
      if (m.source === 'builtin') presetSelect.value = `builtin:${m.id}`;
      else if (m.source === 'saved') presetSelect.value = `saved:${m.name}`;
      updateDeletePresetState();
    }
  } catch {}
});

presetSelect?.addEventListener('change', () => {
  updateDeletePresetState();
  const opt = presetSelect.options[presetSelect.selectedIndex];
  const fg = opt?.dataset?.fg;
  const bg = opt?.dataset?.bg;
  if (validHex(fg) && validHex(bg)) {
    if (colorFgInput) colorFgInput.value = fg.toUpperCase();
    if (colorBgInput) colorBgInput.value = bg.toUpperCase();
  }
});

applyPresetBtn?.addEventListener('click', () => {
  if (!presetSelect) return;
  const opt = presetSelect.options[presetSelect.selectedIndex];
  const fg = (opt?.dataset?.fg || '').toUpperCase();
  const bg = (opt?.dataset?.bg || '').toUpperCase();
  if (!validHex(fg) || !validHex(bg)) {
    alert('Select a preset first.');
    return;
  }
  if (colorFgInput) colorFgInput.value = fg;
  if (colorBgInput) colorBgInput.value = bg;
  applyThemeColors(fg, bg);
  try { localStorage.setItem('atb_theme_colors', JSON.stringify({ fg, bg })); } catch {}
  try {
    const t = tabs.find(tt => tt.id === activeTabId);
    if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
      const startBg = loadSavedStartBg();
      const fid = loadSavedFontId();
      let sendFg = fg, sendBg = bg;
      try {
        const ad = localStorage.getItem('atb_adaptive_theme');
        const adaptiveOn = ad === '1' || ad === 'true';
        if (adaptiveOn) { sendFg = '#ffffff'; sendBg = '#000000'; }
      } catch {}
      ipcRenderer.send('set-startpage-theme', { fg: sendFg, bg: sendBg, startBg, fontId: fid });
    }
  } catch {}
});

savePresetBtn?.addEventListener('click', () => {
  const name = (presetNameInput?.value || '').trim();
  const fg = (colorFgInput?.value || '').trim().toUpperCase();
  const bg = (colorBgInput?.value || '').trim().toUpperCase();
  if (!name) { alert('Enter a preset name.'); return; }
  if (!validHex(fg) || !validHex(bg)) { alert('Enter valid HEX colors.'); return; }
  const list = loadSavedPresets();
  const idx = list.findIndex(p => (p.name || '').toLowerCase() === name.toLowerCase());
  const entry = { name, fg, bg };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveSavedPresets(list);
  populatePresetSelect();
  if (presetSelect) presetSelect.value = `saved:${name}`;
  updateDeletePresetState();
});

deletePresetBtn?.addEventListener('click', () => {
  if (!presetSelect) return;
  const val = presetSelect.value || '';
  if (!val.startsWith('saved:')) return;
  const name = val.slice(6);
  const ok = window.confirm(`Delete preset "${name}"?`);
  if (!ok) return;
  const list = loadSavedPresets();
  const next = list.filter(p => (p.name || '') !== name);
  saveSavedPresets(next);
  populatePresetSelect();
  presetSelect.value = '';
  updateDeletePresetState();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // SUPER = metaKey (Command on macOS, Windows key on Windows/Linux)

  // SUPER+ALT+T - Next theme preset (built-in list)
  if (e.metaKey && e.altKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    try {
      // Determine current colors
      const fgNow = (colorFgInput?.value || getComputedStyle(document.documentElement).getPropertyValue('--fg') || '').trim().toUpperCase();
      const bgNow = (colorBgInput?.value || getComputedStyle(document.documentElement).getPropertyValue('--bg') || '').trim().toUpperCase();
      // Find match in built-ins, then advance
      let idx = BUILTIN_PRESETS.findIndex(p => p.fg.toUpperCase() === fgNow && p.bg.toUpperCase() === bgNow);
      idx = (idx + 1 + (idx < 0 ? 0 : 0)) % BUILTIN_PRESETS.length; // if not found, idx becomes 0
      if (idx < 0) idx = 0;
      const next = BUILTIN_PRESETS[idx];
      const fg = next.fg.toUpperCase();
      const bg = next.bg.toUpperCase();
      if (colorFgInput) colorFgInput.value = fg;
      if (colorBgInput) colorBgInput.value = bg;
      applyThemeColors(fg, bg);
      try { localStorage.setItem('atb_theme_colors', JSON.stringify({ fg, bg })); } catch {}
      try {
        const t = tabs.find(tt => tt.id === activeTabId);
        if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
          const startBg = loadSavedStartBg();
          const fid = loadSavedFontId();
          let sendFg = fg, sendBg = bg;
          try {
            const ad = localStorage.getItem('atb_adaptive_theme');
            const adaptiveOn = ad === '1' || ad === 'true';
            if (adaptiveOn) { sendFg = '#ffffff'; sendBg = '#000000'; }
          } catch {}
          ipcRenderer.send('set-startpage-theme', { fg: sendFg, bg: sendBg, startBg, fontId: fid });
        }
      } catch {}
      // reflect preset selection if applicable
      syncPresetSelectionToCurrentColors();
    } catch {}
    return;
  }

  // SUPER + L - Focus address bar
  if (e.metaKey && e.key === 'l') {
    e.preventDefault();
    addressBar.focus();
    addressBar.select();
  }
  
  // SUPER + R - Reload
  if (e.metaKey && e.key === 'r') {
    e.preventDefault();
    reload();
  }
  
  // SUPER + [ - Go back
  if (e.metaKey && e.key === '[') {
    e.preventDefault();
    goBack();
  }
  
  // SUPER + ] - Go forward
  if (e.metaKey && e.key === ']') {
    e.preventDefault();
    goForward();
  }
  
  // SUPER + H - Go home
  if (e.metaKey && e.key === 'h') {
    e.preventDefault();
    goHome();
  }

  // SUPER + T - New start page tab (no Alt)
  if (e.metaKey && !e.altKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    addTab('start:');
  }

  // SUPER + W - Close current tab; if last, close window
  if (e.metaKey && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    shouldCloseWindowIfNoTabs = true;
    if (activeTabId != null) closeTab(activeTabId);
  }

  // SUPER + G - Open GPT sidebar
  if (e.metaKey && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    toggleGpt(true);
  }

  // SUPER + N - Open Notes sidebar
  if (e.metaKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    toggleNotes(true);
  }

  // SUPER + M - Open Menu panel
  if (e.metaKey && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    toggleMenu(true);
  }

  // Esc - close menu or GPT or Notes if open
  if (e.key === 'Escape') {
    let handled = false;
    if (menuPanel && menuPanel.classList.contains('open')) { toggleMenu(false); handled = true; }
    if (!handled && gptSidebar && gptSidebar.classList.contains('open')) { toggleGpt(false); handled = true; }
    if (!handled && notesSidebar && notesSidebar.classList.contains('open')) { toggleNotes(false); handled = true; }
    if (handled) e.preventDefault();
  }
});

// IPC listeners from main
ipcRenderer.on('shortcut', (_e, payload) => {
  const action = payload?.action;
  switch (action) {
    case 'open-gpt':
      toggleGpt(true);
      break;
    case 'open-notes':
      toggleNotes(true);
      break;
    case 'open-menu':
      toggleMenu(true);
      break;
    case 'focus-url':
      try { addressBar.focus(); addressBar.select(); } catch {}
      break;
    case 'next-theme':
      try {
        const fgNow = (colorFgInput?.value || getComputedStyle(document.documentElement).getPropertyValue('--fg') || '').trim().toUpperCase();
        const bgNow = (colorBgInput?.value || getComputedStyle(document.documentElement).getPropertyValue('--bg') || '').trim().toUpperCase();
        let idx = BUILTIN_PRESETS.findIndex(p => p.fg.toUpperCase() === fgNow && p.bg.toUpperCase() === bgNow);
        idx = (idx + 1 + (idx < 0 ? 0 : 0)) % BUILTIN_PRESETS.length;
        if (idx < 0) idx = 0;
        const next = BUILTIN_PRESETS[idx];
        const fg = next.fg.toUpperCase();
        const bg = next.bg.toUpperCase();
        if (colorFgInput) colorFgInput.value = fg;
        if (colorBgInput) colorBgInput.value = bg;
        applyThemeColors(fg, bg);
        try { localStorage.setItem('atb_theme_colors', JSON.stringify({ fg, bg })); } catch {}
        try {
          const t = tabs.find(tt => tt.id === activeTabId);
          if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
            const startBg = loadSavedStartBg();
            const fid = loadSavedFontId();
            const font = FONT_STACKS[fid] || FONT_STACKS['tiny5'];
            ipcRenderer.send('set-startpage-theme', { fg, bg, startBg, font, fontId: fid });
          }
        } catch {}
        syncPresetSelectionToCurrentColors();
      } catch {}
      break;
    case 'escape':
      // Close any open panels (Menu > GPT > Notes order)
      if (menuPanel && menuPanel.classList.contains('open')) { toggleMenu(false); break; }
      if (gptSidebar && gptSidebar.classList.contains('open')) { toggleGpt(false); break; }
      if (notesSidebar && notesSidebar.classList.contains('open')) { toggleNotes(false); break; }
      break;
    default:
      break;
  }
});
ipcRenderer.on('tab-created', (_e, payload) => {
  const { tabId, url, title } = payload;
  tabs.push({ id: tabId, url, title });
  activeTabId = tabId; // new tab becomes active
  setAddressBarDisplay(url || '');
  renderTabs();
});

ipcRenderer.on('tab-updated', (_e, payload) => {
  const { tabId, url, title } = payload;
  const t = tabs.find(x => x.id === tabId);
  if (t) {
    if (url) t.url = url;
    if (title) t.title = title;
  }
  if (tabId === activeTabId && url) {
    setAddressBarDisplay(url);
  // If the active tab is the start page, apply current theme colors
    if (/\/startpage\/index\.html/i.test(url)) {
      try {
        const raw = localStorage.getItem('atb_theme_colors');
        const parsed = raw ? JSON.parse(raw) : null;
        let fg = parsed?.fg || '#ffffff';
        let bg = parsed?.bg || '#000000';
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(fg) && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bg)) {
          const fid = loadSavedFontId();
          const font = FONT_STACKS[fid] || FONT_STACKS['tiny5'];
          const startBg = loadSavedStartBg();
          try {
            const ad = localStorage.getItem('atb_adaptive_theme');
            const adaptiveOn = ad === '1' || ad === 'true';
            if (adaptiveOn) { fg = '#ffffff'; bg = '#000000'; }
          } catch {}
          ipcRenderer.send('set-startpage-theme', { fg, bg, font, startBg, fontId: fid });
          try { ipcRenderer.send('focus-startpage-search'); } catch {}
        }
      } catch {}
    }
    // If adaptive theme is on, request analysis (main will also auto-send on load)
    try {
      const saved = localStorage.getItem('atb_adaptive_theme');
      const on = saved === '1' || saved === 'true';
      if (on) ipcRenderer.invoke('request-adaptive-theme');
    } catch {}
  }
  renderTabs();
});
// Receive adaptive theme suggestions and apply if enabled and for active tab
ipcRenderer.on('adaptive-theme-suggested', (_e, payload) => {
  try {
    const { tabId, bg, fg } = payload || {};
    const saved = localStorage.getItem('atb_adaptive_theme');
    const on = saved === '1' || saved === 'true';
    if (!on) return;
    if (tabId !== activeTabId) return;
    if (validHex(fg) && validHex(bg)) {
      applyThemeColors(fg, bg);
      // Do not persist or change color inputs; this is ephemeral for adaptive mode
    }
  } catch {}
});

// Apply Start Page Background button (toggle ON/OFF)
applyStartBgBtn?.addEventListener('click', () => {
  const on = !!startBgToggle?.checked;
  const mode = on ? 'noise' : 'none';
  saveStartBg(mode);
  if (startBgState) startBgState.textContent = on ? 'ON' : 'OFF';
  try {
    const t = tabs.find(tt => tt.id === activeTabId);
    if (t && t.url && /\/startpage\/index\.html/i.test(t.url)) {
      const raw = localStorage.getItem('atb_theme_colors');
      const parsed = raw ? JSON.parse(raw) : null;
      let fg = parsed?.fg || '#ffffff';
      let bg = parsed?.bg || '#000000';
      const fid = loadSavedFontId();
      const font = FONT_STACKS[fid] || FONT_STACKS['tiny5'];
      try {
        const ad = localStorage.getItem('atb_adaptive_theme');
        const adaptiveOn = ad === '1' || ad === 'true';
        if (adaptiveOn) { fg = '#ffffff'; bg = '#000000'; }
      } catch {}
      ipcRenderer.send('set-startpage-theme', { fg, bg, font, startBg: mode, fontId: fid });
    }
  } catch {}
});

ipcRenderer.on('tab-closed', (_e, tabId) => {
  // In case closure originated elsewhere
  tabs = tabs.filter(t => t.id !== tabId);
  if (activeTabId === tabId) {
    const fallback = tabs[0]?.id;
    if (fallback != null) {
      selectTab(fallback);
    } else {
      // No tabs remaining: always close the window
      shouldCloseWindowIfNoTabs = false;
      try { window.close(); } catch {}
    }
  } else {
    renderTabs();
  }
});

// ChatGPT sidebar logic
function toggleGpt(force){
  if (!gptSidebar) return;
  const willOpen = typeof force === 'boolean' ? force : !gptSidebar.classList.contains('open');
  if (willOpen) {
    // Ensure menu is closed for exclusivity
    if (menuPanel && menuPanel.classList.contains('open')) {
      menuPanel.classList.remove('open');
      menuPanel.setAttribute('aria-hidden', 'true');
    }
    // Ensure notes is closed for exclusivity
    if (typeof notesSidebar !== 'undefined' && notesSidebar && notesSidebar.classList.contains('open')) {
      notesSidebar.classList.remove('open');
      notesSidebar.setAttribute('hidden', '');
    }
    gptSidebar.classList.add('open');
    gptSidebar.removeAttribute('hidden');
  } else {
    gptSidebar.classList.remove('open');
    gptSidebar.setAttribute('hidden', '');
  }
  reportChromeMetrics();
}

gptToggleBtn?.addEventListener('click', toggleGpt);
gptNewBtn?.addEventListener('click', () => newChat());

// Notes sidebar logic
function toggleNotes(force){
  if (!notesSidebar) return;
  const willOpen = typeof force === 'boolean' ? force : !notesSidebar.classList.contains('open');
  if (willOpen) {
    // close others
    if (menuPanel && menuPanel.classList.contains('open')) {
      menuPanel.classList.remove('open');
      menuPanel.setAttribute('aria-hidden', 'true');
    }
    if (gptSidebar && gptSidebar.classList.contains('open')) {
      gptSidebar.classList.remove('open');
      gptSidebar.setAttribute('hidden', '');
    }
    notesSidebar.classList.add('open');
    notesSidebar.removeAttribute('hidden');
  } else {
    notesSidebar.classList.remove('open');
    notesSidebar.setAttribute('hidden', '');
  }
  reportChromeMetrics();
}

notesToggleBtn?.addEventListener('click', toggleNotes);

// ===== Multi-chat state and helpers =====
let chats = [];
let activeChatId = null;
let requestCounter = 1;
const pendingReplies = new Map(); // reqId -> chatId
let nextPageContext = null; // { url, title, text } included on next send
let askPageActive = false; // toggle state for including page context once

function newChat() {
  const id = Date.now() + Math.random();
  const chat = { id, title: 'CHAT', messages: [] };
  chats.push(chat);
  activeChatId = id;
  renderChatTabs();
  renderChatMessages();
  persistChats();
}

function closeChat(id) {
  const idx = chats.findIndex(c => c.id === id);
  if (idx === -1) return;
  chats.splice(idx, 1);
  if (activeChatId === id) {
    activeChatId = chats[idx]?.id ?? chats[idx-1]?.id ?? null;
    if (activeChatId == null) newChat();
  }
  renderChatTabs();
  renderChatMessages();
  persistChats();
}

function selectChat(id) {
  if (activeChatId === id) return;
  activeChatId = id;
  renderChatTabs();
  renderChatMessages();
  persistActiveChat();
}

function getActiveChat() { return chats.find(c => c.id === activeChatId) || null; }

function titleFromFirstMessage(chat){
  const first = chat.messages.find(m => m.role === 'user');
  if (!first) return 'CHAT';
  let t = first.content.trim().toUpperCase();
  if (t.length > 24) t = t.slice(0, 24) + '…';
  return t || 'CHAT';
}

function renderChatTabs(){
  if (!gptTabsEl) return;
  gptTabsEl.innerHTML = '';
  chats.forEach(chat => {
    const tab = document.createElement('button');
    tab.className = 'chatgpt-tab' + (chat.id === activeChatId ? ' active' : '');
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected', String(chat.id === activeChatId));

    const title = document.createElement('span');
    title.className = 'chatgpt-tab-title';
    title.textContent = chat.title || titleFromFirstMessage(chat);

    const close = document.createElement('button');
    close.className = 'chatgpt-tab-close';
    close.type = 'button';
    close.textContent = 'X';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeChat(chat.id); });

    tab.addEventListener('click', () => selectChat(chat.id));
    tab.appendChild(title);
    tab.appendChild(close);
    gptTabsEl.appendChild(tab);
  });
}

function renderChatMessages(){
  if (!gptMessages) return;
  gptMessages.innerHTML = '';
  const chat = getActiveChat();
  if (!chat) return;
  for (const m of chat.messages) {
    const div = document.createElement('div');
    div.className = 'chatgpt-msg ' + (m.role === 'user' ? 'user' : 'assistant');
    div.textContent = m.content;
    gptMessages.appendChild(div);
  }
  gptMessages.scrollTop = gptMessages.scrollHeight;
}

function appendMsgToChat(chatId, role, text){
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  chat.messages.push({ role, content: text });
  if (!chat.title || chat.title === 'CHAT') chat.title = titleFromFirstMessage(chat);
  if (chatId === activeChatId) renderChatMessages();
  renderChatTabs();
  persistChats();
}

function appendMsg(role, text){
  if (activeChatId == null) return;
  appendMsgToChat(activeChatId, role, text);
}

gptForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!gptInput) return;
  const text = (gptInput.value || '').trim();
  if (!text) return;
  if (activeChatId == null) newChat();
  const chat = getActiveChat();
  appendMsgToChat(chat.id, 'user', text);
  const reqId = requestCounter++;
  pendingReplies.set(reqId, chat.id);
  const base = [ { role: 'system', content: 'You are a concise, helpful assistant.' } ];
  const maybeCtx = askPageActive && nextPageContext
    ? [{ role: 'system', content: `Webpage context (do not echo):\nURL: ${nextPageContext.url}\nTITLE: ${nextPageContext.title}\nTEXT: ${nextPageContext.text}` }]
    : [];
  const history = [ ...base, ...maybeCtx, ...chat.messages ];
  ipcRenderer.send('chatgpt-ask', { id: reqId, messages: history });
  // one-shot toggle: clear after sending
  nextPageContext = null;
  askPageActive = false;
  setAskButtonActive(false);
  updateContextTagUI();
  gptInput.value = '';
  try { localStorage.setItem('atb_last_prompt', ''); } catch {}
});

ipcRenderer.on('chatgpt-reply', (_e, payload) => {
  const { id, content, error } = payload || {};
  const chatId = pendingReplies.get(id) ?? activeChatId;
  if (error) {
    appendMsgToChat(chatId, 'assistant', 'ERROR: ' + error);
  } else if (content) {
    appendMsgToChat(chatId, 'assistant', content);
  }
  pendingReplies.delete(id);
});

// Persistence helpers for chats and last prompt
function persistChats(){
  try { localStorage.setItem('atb_chats', JSON.stringify(chats)); } catch {}
  persistActiveChat();
}
function persistActiveChat(){
  try { localStorage.setItem('atb_active_chat', String(activeChatId ?? '')); } catch {}
}

gptInput?.addEventListener('input', () => {
  try { localStorage.setItem('atb_last_prompt', gptInput.value || ''); } catch {}
});

// Ask Page: toggle capture for the next prompt (one-shot)
gptAskPageBtn?.addEventListener('click', async () => {
  // If already active, turn off
  if (askPageActive) {
    askPageActive = false;
    nextPageContext = null;
    setAskButtonActive(false);
    updateContextTagUI();
    gptAskPageBtn.textContent = 'ASK PAGE';
    return;
  }
  // Turn on by capturing page text now
  try {
    gptAskPageBtn.disabled = true;
    const res = await ipcRenderer.invoke('extract-page-text');
    if (res && res.ok) {
      nextPageContext = { url: res.url || '', title: res.title || '', text: res.text || '' };
      askPageActive = true;
      setAskButtonActive(true);
      updateContextTagUI();
    } else {
      const old = gptAskPageBtn.textContent;
      gptAskPageBtn.textContent = 'ERR';
      setTimeout(() => { gptAskPageBtn.textContent = old; }, 1200);
    }
  } catch (e) {
    const old = gptAskPageBtn.textContent;
    gptAskPageBtn.textContent = 'ERR';
    setTimeout(() => { gptAskPageBtn.textContent = old; }, 1200);
  } finally {
    gptAskPageBtn.disabled = false;
  }
});

function setAskButtonActive(active){
  if (!gptAskPageBtn) return;
  if (active) gptAskPageBtn.classList.add('active');
  else gptAskPageBtn.classList.remove('active');
}

// Show or clear the ASK PAGE tag next to the input
function updateContextTagUI(){
  if (!gptTagsEl) return;
  gptTagsEl.innerHTML = '';
  if (!nextPageContext) return;
  const tag = document.createElement('div');
  tag.className = 'chatgpt-tag';
  const label = document.createElement('span');
  label.className = 'chatgpt-tag-label';
  label.textContent = 'ASK PAGE';
  const close = document.createElement('button');
  close.className = 'chatgpt-tag-close';
  close.type = 'button';
  close.textContent = 'X';
  close.addEventListener('click', () => { nextPageContext = null; updateContextTagUI(); });
  tag.appendChild(label);
  tag.appendChild(close);
  gptTagsEl.appendChild(tag);
}

// MENU / SETTINGS PANEL LOGIC
function toggleMenu(force) {
  if (!menuPanel) return;
  const open = typeof force === 'boolean' ? force : !menuPanel.classList.contains('open');
  if (open) {
    // Ensure GPT is closed for exclusivity
    if (gptSidebar && gptSidebar.classList.contains('open')) {
      gptSidebar.classList.remove('open');
      gptSidebar.setAttribute('hidden', '');
    }
    // Ensure Notes is closed for exclusivity
    if (typeof notesSidebar !== 'undefined' && notesSidebar && notesSidebar.classList.contains('open')) {
      notesSidebar.classList.remove('open');
      notesSidebar.setAttribute('hidden', '');
    }
    menuPanel.classList.add('open');
    menuPanel.setAttribute('aria-hidden', 'false');
    updateKeyStatus();
  } else {
    menuPanel.classList.remove('open');
    menuPanel.setAttribute('aria-hidden', 'true');
  }
  // Adjust BrowserView bounds to make room for the menu panel when open
  reportChromeMetrics();
}

// ===== Sidebar Resizers (Menu, GPT, Notes) =====
function attachSidebarResizer(sidebarEl, storageKey){
  if (!sidebarEl) return;
  const handle = sidebarEl.querySelector('.sidebar-resizer');
  if (!handle) return;
  const minW = 260, maxW = 900;
  const loadW = () => {
    try { const w = parseInt(localStorage.getItem(storageKey)||'',10); if (!isNaN(w) && w>minW && w<maxW) sidebarEl.style.width = w + 'px'; } catch {}
  };
  loadW();
  let dragging = false;
  function onMove(e){
    if (!dragging) return;
    const mouseX = e.clientX;
    const winW = window.innerWidth || document.documentElement.clientWidth;
    let w = Math.max(minW, Math.min(maxW, Math.round(winW - mouseX)));
    sidebarEl.style.width = w + 'px';
    try { localStorage.setItem(storageKey, String(w)); } catch {}
    reportChromeMetrics();
  }
  function onUp(){ dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
  handle.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); });
}

document.addEventListener('DOMContentLoaded', () => {
  attachSidebarResizer(menuPanel, 'atb_width_menu');
  attachSidebarResizer(gptSidebar, 'atb_width_gpt');
  attachSidebarResizer(notesSidebar, 'atb_width_notes');
});

async function updateKeyStatus() {
  try {
    const res = await ipcRenderer.invoke('get-openai-key-status');
    if (res && res.exists) {
      keyStatus.textContent = `Key saved (••••${res.last4}).`;
    } else {
      keyStatus.textContent = 'No key saved.';
    }
  } catch (e) {
    keyStatus.textContent = 'Unable to read key status.';
  }
}

menuClose?.addEventListener('click', () => toggleMenu(false));

// Menu tabs switching
function selectMenuTab(which){
  const isSettings = which === 'settings';
  const isHistory = which === 'history';
  const isAbout = which === 'about';
  // tabs
  if (menuTabSettings) { menuTabSettings.classList.toggle('active', isSettings); menuTabSettings.setAttribute('aria-selected', String(isSettings)); }
  if (menuTabHistory) { menuTabHistory.classList.toggle('active', isHistory); menuTabHistory.setAttribute('aria-selected', String(isHistory)); }
  if (menuTabAbout) { menuTabAbout.classList.toggle('active', isAbout); menuTabAbout.setAttribute('aria-selected', String(isAbout)); }
  // pages
  if (menuPageSettings) { menuPageSettings.hidden = !isSettings; menuPageSettings.classList.toggle('active', isSettings); }
  if (menuPageHistory) { menuPageHistory.hidden = !isHistory; menuPageHistory.classList.toggle('active', isHistory); }
  if (menuPageAbout) { menuPageAbout.hidden = !isAbout; menuPageAbout.classList.toggle('active', isAbout); }
  if (isHistory) {
    refreshHistory();
  }
}

menuTabSettings?.addEventListener('click', () => selectMenuTab('settings'));
menuTabHistory?.addEventListener('click', () => selectMenuTab('history'));
menuTabAbout?.addEventListener('click', () => selectMenuTab('about'));

showKeyBtn?.addEventListener('click', () => {
  if (!openaiKeyInput) return;
  const showing = openaiKeyInput.type === 'text';
  openaiKeyInput.type = showing ? 'password' : 'text';
  showKeyBtn.setAttribute('aria-pressed', String(!showing));
  showKeyBtn.textContent = showing ? 'SHOW' : 'HIDE';
});

saveKeyBtn?.addEventListener('click', async () => {
  const key = (openaiKeyInput?.value || '').trim();
  if (!key) { keyStatus.textContent = 'Enter a key (starts with sk-).'; return; }
  try {
    const res = await ipcRenderer.invoke('save-openai-key', key);
    if (res && res.ok) {
      keyStatus.textContent = `Saved (••••${res.last4}).`;
      openaiKeyInput.value = '';
      openaiKeyInput.type = 'password';
    } else {
      keyStatus.textContent = 'Save failed.' + (res?.error ? ' ' + res.error : '');
    }
  } catch (e) {
    keyStatus.textContent = 'Save error.';
  }
});

testKeyBtn?.addEventListener('click', async () => {
  const key = (openaiKeyInput?.value || '').trim();
  try {
    const res = await ipcRenderer.invoke('test-openai-key', key || undefined);
    if (res && res.ok) {
      keyStatus.textContent = 'Key works.';
    } else {
      keyStatus.textContent = 'Key test failed' + (res?.status ? ` (HTTP ${res.status})` : res?.error ? `: ${res.error}` : '.');
    }
  } catch (e) {
    keyStatus.textContent = 'Test error.';
  }
});

// ===== History rendering and actions =====
let cachedHistory = [];

function fmtTime(ts){
  try {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${h}:${m}`;
  } catch { return ''; }
}

function renderHistory(items){
  if (!historyList || !historyEmpty) return;
  historyList.innerHTML = '';
  const arr = Array.isArray(items) ? items.slice().reverse() : [];
  if (!arr.length) {
    historyEmpty.style.display = '';
    return;
  }
  historyEmpty.style.display = 'none';
  arr.forEach((it) => {
    const div = document.createElement('button');
    div.className = 'history-item';
    div.type = 'button';
    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = it.title || it.url || 'UNTITLED';
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = it.url || '';
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = fmtTime(it.ts);
    div.appendChild(title);
    div.appendChild(url);
    div.appendChild(time);
    const remove = document.createElement('button');
    remove.className = 'history-remove';
    remove.type = 'button';
    remove.title = 'REMOVE';
    remove.textContent = 'X';
    remove.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await ipcRenderer.invoke('delete-history-item', { ts: it.ts, url: it.url });
        // list will refresh via event; force immediate refresh as well
        refreshHistory();
      } catch {}
    });
    div.appendChild(remove);
    div.addEventListener('click', () => {
      navigateTo(it.url);
      toggleMenu(false);
    });
    historyList.appendChild(div);
  });
}

async function refreshHistory(){
  try {
    const res = await ipcRenderer.invoke('get-history');
    if (res && res.ok) {
      cachedHistory = Array.isArray(res.items) ? res.items : [];
      renderHistory(cachedHistory);
    }
  } catch {}
}

ipcRenderer.on('history-updated', (_e, items) => {
  cachedHistory = Array.isArray(items) ? items : [];
  // Only re-render if history page is visible
  const visible = menuPageHistory && !menuPageHistory.hidden;
  if (visible) renderHistory(cachedHistory);
});

clearHistoryBtn?.addEventListener('click', async () => {
  const yes = window.confirm('CLEAR ALL BROWSER HISTORY?');
  if (!yes) return;
  try {
    await ipcRenderer.invoke('clear-history');
    // UI will refresh via history-updated event; also force refresh
    refreshHistory();
  } catch {}
});

// ===== Notes: rendering and persistence helpers =====
let notes = [];
let activeNoteId = null;

function persistNotes(){
  try { localStorage.setItem('atb_notes', JSON.stringify(notes)); } catch {}
  try { localStorage.setItem('atb_active_note', String(activeNoteId ?? '')); } catch {}
}

function noteTitleFromContent(text){
  if (!text) return 'NOTE';
  let first = text.split(/\r?\n/)[0] || 'NOTE';
  first = first.trim().toUpperCase();
  if (!first) first = 'NOTE';
  if (first.length > 24) first = first.slice(0,24) + '…';
  return first;
}

function newNote(){
  const id = Date.now() + Math.random();
  const note = { id, title: 'NOTE', content: '' };
  notes.push(note);
  activeNoteId = id;
  renderNotesTabs();
  renderNoteEditor();
  persistNotes();
}

function closeNote(id){
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return;
  notes.splice(idx,1);
  if (activeNoteId === id) {
    activeNoteId = notes[idx]?.id ?? notes[idx-1]?.id ?? null;
    if (activeNoteId == null) newNote();
  }
  renderNotesTabs();
  renderNoteEditor();
  persistNotes();
}

function selectNote(id){
  if (activeNoteId === id) return;
  activeNoteId = id;
  renderNotesTabs();
  renderNoteEditor();
  persistNotes();
}

function getActiveNote(){ return notes.find(n => n.id === activeNoteId) || null; }

function renderNotesTabs(){
  if (!notesTabsEl) return;
  notesTabsEl.innerHTML = '';
  notes.forEach(n => {
    const tab = document.createElement('button');
    tab.className = 'notes-tab' + (n.id === activeNoteId ? ' active' : '');
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected', String(n.id === activeNoteId));
    const title = document.createElement('span');
    title.className = 'notes-tab-title';
    title.textContent = n.title || noteTitleFromContent(n.content);
    const close = document.createElement('button');
    close.className = 'notes-tab-close';
    close.type = 'button';
    close.textContent = 'X';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeNote(n.id); });
    tab.addEventListener('click', () => selectNote(n.id));
    tab.appendChild(title);
    tab.appendChild(close);
    notesTabsEl.appendChild(tab);
  });
}

function renderNoteEditor(){
  if (!notesTextarea) return;
  const n = getActiveNote();
  notesTextarea.value = n ? (n.content || '') : '';
}

notesNewBtn?.addEventListener('click', () => newNote());

notesTextarea?.addEventListener('input', () => {
  const n = getActiveNote();
  if (!n) return;
  n.content = notesTextarea.value || '';
  n.title = noteTitleFromContent(n.content);
  renderNotesTabs();
  persistNotes();
});
