// Preload for BrowserView tabs: credential autofill & capture
const { contextBridge, ipcRenderer } = require('electron');

function detectLoginForms(){
  const pwFields = Array.from(document.querySelectorAll('input[type="password"]'));
  if (!pwFields.length) return [];
  // Group by form
  const forms = new Map();
  pwFields.forEach(pw => {
    const f = pw.form || pw.closest('form');
    if (f) forms.set(f, true);
  });
  return Array.from(forms.keys());
}

function pickUserField(form){
  if (!form) return null;
  const candidates = Array.from(form.querySelectorAll('input'));
  const score = (el) => {
    const t = (el.getAttribute('type')||'').toLowerCase();
    if (t === 'password' || t === 'hidden' || t === 'submit' || t === 'button') return -1;
    let s = 0;
    const name = (el.name||'').toLowerCase();
    const id = (el.id||'').toLowerCase();
    const ph = (el.getAttribute('placeholder')||'').toLowerCase();
    const combined = name + ' ' + id + ' ' + ph;
    if (/user|login|email|mail|name/i.test(combined)) s += 5;
    if (t === 'email') s += 4;
    if (t === 'text') s += 2;
    if (el.autocomplete && /username|email/i.test(el.autocomplete)) s += 5;
    return s;
  };
  return candidates.reduce((best, el) => {
    const sc = score(el);
    if (sc > (best?.score ?? -1)) return { el, score: sc };
    return best;
  }, null)?.el || null;
}

async function tryAutofill(){
  try {
    const host = location.hostname;
    if (!host) return;
    const res = await ipcRenderer.invoke('cred-get', { host });
    if (!res || !res.ok || !res.username || !res.password) return;
    const forms = detectLoginForms();
    for (const f of forms){
      const pw = f.querySelector('input[type="password"]');
      if (!pw) continue;
      const user = pickUserField(f);
      if (user) user.value = res.username;
      pw.value = res.password;
      // Avoid overwriting multiple times
      break;
    }
  } catch {}
}

function hookSubmissions(){
  const forms = detectLoginForms();
  forms.forEach(f => {
    if (f.__arkiumHooked) return;
    f.__arkiumHooked = true;
    f.addEventListener('submit', async () => {
      try {
        const host = location.hostname;
        if (!host) return;
        const pw = f.querySelector('input[type="password"]');
        if (!pw || !pw.value) return;
        const user = pickUserField(f);
        const username = user ? user.value : '';
        const password = pw.value;
        if (username && password) {
          await ipcRenderer.invoke('cred-save', { host, username, password });
        }
      } catch {}
    }, { capture: true });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  tryAutofill();
  hookSubmissions();
  // Re-scan if DOM changes (simple mutation observer)
  const mo = new MutationObserver(() => hookSubmissions());
  mo.observe(document.documentElement, { childList: true, subtree: true });
});

contextBridge.exposeInMainWorld('__arkiumCreds', {
  requestAutofill: tryAutofill
});
