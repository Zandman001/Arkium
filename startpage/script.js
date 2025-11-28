// SimplexNoise (2D) - vanilla JS version adapted for the start page
class SimplexNoise {
  constructor(){
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    const p = [];
    for (let i=0;i<256;i++) p[i] = Math.floor(Math.random()*256);
    this.perm = [];
    for (let i=0;i<512;i++) this.perm[i] = p[i & 255];
  }
  dot(g,x,y){ return g[0]*x + g[1]*y; }
  noise(xin,yin){
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    let n0, n1, n2;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0*t0*this.dot(this.grad3[gi0], x0, y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1*t1*this.dot(this.grad3[gi1], x1, y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2*t2*this.dot(this.grad3[gi2], x2, y2); }
    return 70.0 * (n0 + n1 + n2);
  }
}

(function(){
  // ===== Editable Quick Links =====
  const LS_KEY = 'atb_start_links';
  const defaultLinks = [
    { name: 'GOOGLE', url: 'https://www.google.com' },
    { name: 'YOUTUBE', url: 'https://www.youtube.com' },
    { name: 'GITHUB', url: 'https://www.github.com' },
    { name: 'REDDIT', url: 'https://www.reddit.com' },
  ];
  function loadLinks(){
    try { const raw = localStorage.getItem(LS_KEY); const arr = raw ? JSON.parse(raw) : null; if (Array.isArray(arr)) return arr; } catch {}
    return defaultLinks.slice();
  }
  function saveLinks(list){ try { localStorage.setItem(LS_KEY, JSON.stringify(list||[])); } catch {} }

  const linksList = document.getElementById('links-list');
  const editToggle = document.getElementById('links-edit-toggle');
  const editor = document.getElementById('links-editor');
  const inputName = document.getElementById('new-link-name');
  const inputUrl = document.getElementById('new-link-url');
  const addBtn = document.getElementById('add-link-btn');
  let links = loadLinks();

  function renderLinks(){
    if (!linksList) return;
    linksList.innerHTML = '';
    links.forEach((ln, idx) => {
      const a = document.createElement('a');
      a.className = 'link-item';
      a.href = ln.url;
      a.textContent = ln.name || ln.url;
      a.target = '_self';
      // In edit mode, make name editable on click and show remove
      a.addEventListener('click', (e) => {
        if (!document.body.classList.contains('ql-editing')) return;
        e.preventDefault();
        const newName = prompt('LINK NAME', ln.name || '');
        if (newName != null) ln.name = String(newName).trim().toUpperCase() || ln.name || '';
        const newUrl = prompt('LINK URL', ln.url || '');
        if (newUrl != null) ln.url = String(newUrl).trim();
        saveLinks(links); renderLinks();
      });
      if (document.body.classList.contains('ql-editing')) {
        const x = document.createElement('button');
        x.className = 'link-remove';
        x.type = 'button';
        x.title = 'REMOVE';
        x.textContent = 'X';
        x.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          links.splice(idx, 1); saveLinks(links); renderLinks();
        });
        a.appendChild(x);
      }
      linksList.appendChild(a);
    });
  }

  function setEditing(on){
    document.body.classList.toggle('ql-editing', !!on);
    if (editor) editor.hidden = !on;
    renderLinks();
  }

  if (editToggle) {
    editToggle.addEventListener('click', () => {
      const on = !document.body.classList.contains('ql-editing');
      setEditing(on);
    });
  }
  addBtn?.addEventListener('click', () => {
    const name = (inputName?.value || '').trim().toUpperCase();
    let url = (inputUrl?.value || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    links.push({ name: name || url, url });
    saveLinks(links);
    if (inputName) inputName.value = '';
    if (inputUrl) inputUrl.value = '';
    renderLinks();
  });
  renderLinks();

  function getVar(name){
    const cs = getComputedStyle(document.documentElement);
    return (cs.getPropertyValue(name) || '').trim();
  }
  function hexToRGBA(hex, a){
    const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex||'');
    if (!m) return `rgba(0,0,0,${a})`;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(ch => ch+ch).join('');
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  let settingBgA = false;
  function applyDerivedTheme(){
    const bg = getVar('--bg') || '#000000';
    const bgA = hexToRGBA(bg, 0.8);
    // Only set if changed to avoid unnecessary attribute mutations
    const current = document.documentElement.style.getPropertyValue('--bgA');
    if (current && current.trim() === bgA) return;
    settingBgA = true;
    document.documentElement.style.setProperty('--bgA', bgA);
    // Yield microtask to allow observer to run, then clear flag
    Promise.resolve().then(() => { settingBgA = false; });
  }

  // Search form behavior
  const form = document.getElementById('start-search');
  const input = document.getElementById('q');
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (input.value || '').trim();
      if (!q) return;
      const url = /^https?:\/\//i.test(q) || q.includes('.')
        ? (q.startsWith('http') ? q : 'https://' + q)
        : 'https://www.google.com/search?q=' + encodeURIComponent(q);
      window.location.href = url;
    });
  }

  // Noise grid canvas animation (1-bit look) and static patterns
  const canvas = document.getElementById('noise-canvas');
  const container = document.querySelector('.hero');
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const noise = new SimplexNoise();

  let cols = 0, rows = 0, gap = 7, pixelSize = 4;
  const noiseScale = 0.002;
  const timeScale = 0.00008;

  function resize(){
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    cols = Math.ceil(canvas.width / gap);
    rows = Math.ceil(canvas.height / gap);
  }
  resize();
  window.addEventListener('resize', resize);

  let raf;
  let animating = false;
  function animate(){
    animating = true;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const time = Date.now() * timeScale;
    // Use theme foreground color for pixels (1-bit effect)
    const fg = getVar('--fg') || '#ffffff';
    ctx.fillStyle = fg;
    for (let i=0;i<cols;i++){
      for (let j=0;j<rows;j++){
        const x = i * gap;
        const y = j * gap;
        const n1 = noise.noise(x*noiseScale + time*1.2, y*noiseScale + time*0.9);
        const n2 = noise.noise(x*noiseScale*1.8 - time*0.6, y*noiseScale*1.8 + time*0.5);
        const n3 = noise.noise(x*noiseScale*0.5 + time*0.3, y*noiseScale*0.5 - time*0.4);
        const combined = (n1*0.5 + n2*0.3 + n3*0.2);
        const threshold = Math.sin(time*0.3) * 0.2; // drifting threshold
        if (combined > threshold){
          ctx.fillRect(x, y, pixelSize, pixelSize);
        }
      }
    }
    raf = requestAnimationFrame(animate);
  }

  function stopAnimation(){
    animating = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function drawDither(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const fg = getVar('--fg') || '#ffffff';
    ctx.fillStyle = fg;
    const step = Math.max(2, Math.floor(gap/2));
    for (let y=0; y<canvas.height; y+=step){
      for (let x=0; x<canvas.width; x+=step){
        // checkerboard style dither
        if (((x/step) + (y/step)) % 2 === 0) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }
  }

  function drawGrid(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const fg = getVar('--fg') || '#ffffff';
    ctx.fillStyle = fg;
    const step = gap * 2;
    // vertical lines
    for (let x=0; x<canvas.width; x+=step){
      ctx.fillRect(x, 0, 1, canvas.height);
    }
    // horizontal lines
    for (let y=0; y<canvas.height; y+=step){
      ctx.fillRect(0, y, canvas.width, 1);
    }
  }

  function drawStripes(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const fg = getVar('--fg') || '#ffffff';
    ctx.fillStyle = fg;
    const step = gap * 2;
    for (let x=0; x<canvas.width; x+=step){
      ctx.fillRect(x, 0, Math.max(2, Math.floor(step/3)), canvas.height);
    }
  }

  let currentMode = null;
  function applyMode(mode){
    if (!mode) mode = 'noise';
    if (mode === currentMode) return;
    currentMode = mode;
    if (mode === 'noise') {
      canvas.style.display = '';
      // restart animation
      stopAnimation();
      animate();
    } else if (mode === 'none') {
      stopAnimation();
      ctx.clearRect(0,0,canvas.width,canvas.height);
      canvas.style.display = 'none';
    } else {
      canvas.style.display = '';
      stopAnimation();
      if (mode === 'dither') drawDither();
      else if (mode === 'grid') drawGrid();
      else if (mode === 'stripes') drawStripes();
    }
  }

  function getStartBgMode(){
    const m = (getVar('--start-bg-mode') || '').toLowerCase();
    if (['noise','none','dither','grid','stripes'].includes(m)) return m;
    return 'noise';
  }

  // Expose helper for main process injection
  window.__applyStartBgMode = function(mode){
    applyMode(mode);
  };
  applyDerivedTheme();
  // Watch for inline style changes on :root to recompute --bgA and react to bg mode
  const mo = new MutationObserver(() => {
    if (!settingBgA) {
      applyDerivedTheme();
      const nextMode = getStartBgMode();
      if (nextMode !== currentMode) applyMode(nextMode);
    }
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

  // Initialize background mode from CSS var (ensure first call triggers animate if needed)
  applyMode(getStartBgMode());

  // Focus the search input automatically when the start page loads
  function focusSearchInputRetry(left){
    try {
      const el = document.getElementById('q');
      if (el && typeof el.focus === 'function') {
        el.focus();
        if (typeof el.select === 'function') el.select();
        return;
      }
    } catch {}
    if ((left|0) > 0) setTimeout(() => focusSearchInputRetry((left|0) - 1), 50);
  }
  // try a few times in case fonts/layout reflow
  focusSearchInputRetry(10);

  // Cleanup
  window.addEventListener('beforeunload', ()=>{ if (raf) cancelAnimationFrame(raf); });
})();
