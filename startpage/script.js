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

  // Noise grid canvas animation (1-bit look)
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
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const time = Date.now() * timeScale;
    // Draw only pure white squares for a 1-bit effect
    ctx.fillStyle = '#ffffff';
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
  animate();

  // Cleanup
  window.addEventListener('beforeunload', ()=>{ if (raf) cancelAnimationFrame(raf); });
})();
