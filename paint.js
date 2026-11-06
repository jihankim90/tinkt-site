// Paints days as watercolor blooms, the way the app does: a bloom mask tinted with a Field pigment,
// multiplied on light paper, screened on dark. Sample days only; colors carry no meaning.
(() => {
  const PIGMENTS = ["#E8A94A", "#C87A5A", "#B76060", "#A66B48", "#C4A57A", "#D9C8A6",
                    "#6E85A6", "#7CA599", "#85977A", "#8B6C89", "#8A8890", "#565C6A"];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const isDark = () => root.dataset.theme === "dark";

  // Light is the default; dark only when chosen in the header. Remembered on this device only.
  const themePick = document.querySelector(".theme-pick");
  if (themePick) {
    themePick.value = isDark() ? "dark" : "light";
    themePick.addEventListener("change", () => {
      if (themePick.value === "dark") root.dataset.theme = "dark"; else delete root.dataset.theme;
      try { isDark() ? localStorage.setItem("theme", "dark") : localStorage.removeItem("theme"); } catch (e) {}
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark() ? "#16140F" : "#F7F1E4");
      dispatchEvent(new Event("themechange"));
    });
  }
  document.querySelector(".lang-pick")?.addEventListener("change", e => (location.href = e.target.value));
  // Back/Forward can restore this page from memory without reloading: re-apply the saved theme and reset the menus.
  addEventListener("pageshow", e => {
    if (!e.persisted) return;
    let dark = false; try { dark = localStorage.getItem("theme") === "dark"; } catch (err) {}
    if (dark !== isDark()) { dark ? (root.dataset.theme = "dark") : delete root.dataset.theme; dispatchEvent(new Event("themechange")); }
    if (themePick) themePick.value = dark ? "dark" : "light";
    const lang = document.querySelector(".lang-pick"); if (lang) lang.value = lang.querySelector("[selected]").value;
  });

  // The store link goes live on release day; until then a click shows the date instead. Expires on its own.
  if (Date.now() < new Date(2026, 10, 27)) {
    const tip = document.createElement("span");
    tip.className = "soon"; tip.setAttribute("role", "status");
    document.body.append(tip);
    let timer;
    const hide = () => tip.classList.remove("on");
    document.querySelectorAll('a[href*="apps.apple.com"]').forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      const r = a.getBoundingClientRect();
      tip.textContent = root.lang === "ko" ? "11월 27일 출시 예정이에요" : "Coming Nov 27";
      tip.style.left = `${r.left + r.width / 2}px`; tip.style.top = `${r.top}px`;
      tip.classList.add("on"); clearTimeout(timer); timer = setTimeout(hide, 2400);
    }));
    addEventListener("scroll", hide, { passive: true });
  }

  // The app's tiny LCG, so every visit paints the same sample year.
  let seed = 20261126;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const shapeFor = n => (n * 7919) % 6 + 1;

  // A sample year: colors drift in runs, like a real one.
  const year = [];
  for (let i = 0, c = 7; i < 365; i++) {
    if (rnd() > 0.38) c = Math.floor(rnd() * 12);
    year.push({ n: i, color: PIGMENTS[c], shape: shapeFor(i + 3), rot: rnd() * 360, jx: rnd() - 0.5, jy: rnd() - 0.5 });
  }
  const TODAY = 294;            // Thu 22 Oct 2026
  year[TODAY].color = PIGMENTS[1];
  const WEEK0 = 290;            // Sun 18 – Sat 24 Oct, as in the app's preview
  const OCT1 = 273, OCT_FIRST_COL = 4; // 1 Oct 2026 is a Thursday
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Layouts in unit space: {w, h, at: Map(dayIndex → {x, y, s})}
  const SPOTS = [[-0.78, 0.36], [-0.62, -0.42], [0.1, -0.86], [0.6, -0.48], [0, 0], [0.74, 0.3], [-0.08, 0.72]]; // Sun…Sat; Thu in the middle
  const layouts = {
    day: () => ({ w: 1, h: 1, at: new Map([[TODAY, { x: 0.5, y: 0.5, s: 1 }]]) }),
    week: () => ({ w: 2.6, h: 2.6, at: new Map(SPOTS.map(([x, y], i) => [WEEK0 + i, { x: 1.3 + x, y: 1.3 + y, s: 0.92 }])) }),
    month: () => {
      const at = new Map();
      for (let d = 0; d < 31; d++) {
        const cell = OCT_FIRST_COL + d;
        at.set(OCT1 + d, { x: (cell % 7) + 0.5, y: Math.floor(cell / 7) + 0.5, s: 1.1 });
      }
      return { w: 7, h: 5, at };
    },
    year: () => {
      const at = new Map(); let n = 0;
      MONTH_DAYS.forEach((len, m) => {
        for (let d = 0; d < len; d++, n++) at.set(n, { x: d + 0.5, y: m * 1.15 + 0.55, s: 1.25 });
      });
      return { w: 31, h: 12 * 1.15 - 0.05, at };
    },
  };

  // Tinted sprites, cached per shape × color.
  const masks = {}, sprites = {};
  const loadMask = i => masks[i] || (masks[i] = new Promise(res => {
    const img = new Image(); img.onload = () => res(img); img.src = `/assets/bloom-${i}.png`;
  }));
  async function sprite(day) {
    const key = day.shape + day.color;
    if (sprites[key]) return sprites[key];
    const img = await loadMask(day.shape);
    const c = document.createElement("canvas"); c.width = c.height = img.width;
    const x = c.getContext("2d");
    x.fillStyle = day.color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-in"; x.drawImage(img, 0, 0);
    return (sprites[key] = c);
  }

  const ease = t => 1 - Math.pow(1 - t, 4); // close to the app's cubic-bezier(0.22, 1, 0.36, 1)
  const smooth = t => t * t * (3 - 2 * t);
  const clamp = t => Math.min(1, Math.max(0, t));

  function bloom(ctx, img, x, y, size, rot, alpha) {
    ctx.globalAlpha = alpha;
    ctx.setTransform(1, 0, 0, 1, x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }
  const blend = ctx => (ctx.globalCompositeOperation = isDark() ? "screen" : "multiply");

  // ── Small paintings (share frames): wash in once when seen. ──
  async function paint(canvas) {
    const L = layouts[canvas.dataset.scale]();
    const cssW = canvas.clientWidth, unit = cssW / L.w, dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(L.h * unit * dpr);
    canvas.style.aspectRatio = `${L.w} / ${L.h}`;
    const ctx = canvas.getContext("2d");
    const items = await Promise.all([...L.at].map(async ([n, p], i) => ({ ...p, day: year[n], img: await sprite(year[n]), i })));
    const total = items.length, t0 = performance.now(), animate = !still && canvas.dataset.painted !== "1";
    function frame(now) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); blend(ctx);
      let done = true;
      for (const m of items) {
        const t = animate ? clamp((now - t0 - m.i * 180) / 2200) : 1;
        if (t < 1) done = false;
        if (t <= 0) continue;
        const k = ease(t);
        bloom(ctx, m.img, (m.x + m.day.jx * 0.06) * unit * dpr, (m.y + m.day.jy * 0.06) * unit * dpr,
              m.s * unit * dpr * (0.82 + 0.18 * k), m.day.rot, 0.88 * k);
      }
      if (!done) requestAnimationFrame(frame); else canvas.dataset.painted = "1";
    }
    requestAnimationFrame(frame);
  }
  const canvases = [...document.querySelectorAll("canvas.painting")];
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { io.unobserve(e.target); paint(e.target); }
  }), { threshold: 0.25 });
  canvases.forEach(c => io.observe(c));

  // ── The morph: one day becomes a week, a month, a year, driven by scroll. ──
  const morph = document.querySelector(".morph");
  if (morph) {
    const canvas = morph.querySelector("canvas"), ctx = canvas.getContext("2d");
    const caps = [...morph.querySelectorAll(".cap")];
    const STAGES = ["day", "week", "month", "year"].map(k => layouts[k]());
    const MAXPX = [220, 420, 460, 1100];      // largest each painting gets on a wide screen
    let fits = [], W = 0, H = 0, dpr = 1, imgs = null, queued = false;

    function fit() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      // Each layout centered in the stage, as large as its limits allow.
      // Share of the stage width each painting may use; phones get more of it.
      const maxw = W < 600 ? [0.56, 0.84, 0.88, 0.96] : [0.42, 0.62, 0.66, 0.94];
      fits = STAGES.map((L, i) => {
        const u = Math.min(Math.min(W * maxw[i], MAXPX[i]) / L.w, (H * 0.9) / L.h);
        return { u, ox: (W - L.w * u) / 2, oy: (H - L.h * u) / 2 };
      });
    }
    const where = (i, n) => {
      const p = STAGES[i].at.get(n); if (!p) return null;
      const f = fits[i], d = year[n];
      return { x: f.ox + (p.x + d.jx * 0.06) * f.u, y: f.oy + (p.y + d.jy * 0.06) * f.u, size: p.s * f.u };
    };

    function progress() {
      const r = morph.getBoundingClientRect(), span = r.height - innerHeight;
      return clamp(-r.top / span) * (STAGES.length - 1);   // 0 … 3
    }

    function draw() {
      queued = false;
      if (!imgs) return;
      const p = progress();
      const i = Math.min(Math.floor(p), STAGES.length - 2);
      // Rest at each stage, move between them.
      let t = clamp((p - i - 0.18) / 0.64);
      t = still ? (t < 0.5 ? 0 : 1) : smooth(t);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); blend(ctx);
      for (let n = 0; n < 365; n++) {
        const a = where(i, n), b = where(i + 1, n), d = year[n];
        if (!a && !b) continue;
        let x, y, size, alpha;
        if (a && b) {             // travels
          x = a.x + (b.x - a.x) * t; y = a.y + (b.y - a.y) * t; size = a.size + (b.size - a.size) * t; alpha = 0.88;
        } else if (b) {           // arrives: blooms in where it belongs, a little after the others start moving
          const k = ease(clamp((t - 0.25 - (n % 7) * 0.03) / 0.6));
          x = b.x; y = b.y; size = b.size * (0.7 + 0.3 * k); alpha = 0.88 * k;
        } else {                  // only on the way back up: fades away
          const k = 1 - smooth(t);
          x = a.x; y = a.y; size = a.size; alpha = 0.88 * k;
        }
        if (alpha <= 0.01) continue;
        bloom(ctx, imgs[n], x * dpr, y * dpr, size * dpr, d.rot, alpha);
      }
      caps.forEach((c, k) => (c.style.opacity = clamp(1 - Math.abs(p - k) * 2.2)));
    }
    const request = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };

    fit();
    Promise.all(year.map(sprite)).then(list => { imgs = list; request(); });
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", () => { fit(); request(); });
    addEventListener("themechange", request);
  }

  // Repaint small paintings (without animating) on theme change or resize.
  const repaint = () => canvases.filter(c => c.dataset.painted === "1").forEach(paint);
  addEventListener("themechange", repaint);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(repaint, 200); });

  // Text and phones wash in as they arrive.
  const ro = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); }
  }), { threshold: 0.2 });
  document.querySelectorAll(".reveal").forEach(el => ro.observe(el));

  // iPhone Duo opens as you scroll, like the morph above: the hinge angle follows the scroll 1:1.
  // Geometry follows Apple's Duo page: the left half folds over the right and carries the outer display.
  const duoScroll = document.querySelector(".duo-scroll");
  if (duoScroll) {
    const d = duoScroll.querySelector(".duo-try"), q = s => d.querySelector(s);
    const rig = q(".rig"), pl = q(".pl"), shadeLi = q(".pl .in .shade"), shadeLo = q(".pl .out .shade"), shadeR = q(".pr .in .shade");
    let queued = false;
    const draw = () => {
      queued = false;
      const r = duoScroll.getBoundingClientRect();
      let t = clamp((clamp(-r.top / (r.height - innerHeight)) - 0.15) / 0.6);   // rest closed, open, rest open
      t = still ? (t < 0.5 ? 0 : 1) : smooth(t);
      const hinge = 180 * t, a = 180 - hinge, s = Math.sin((a * Math.PI) / 180), c = Math.cos((a * Math.PI) / 180);
      rig.style.transform = `rotateY(${(-20 * s).toFixed(2)}deg) translateX(${(-50 * Math.min(0.5, (1 - c) / 2)).toFixed(2)}%)`;
      pl.style.transform = `rotateY(${a.toFixed(2)}deg) translateZ(${(-1.5 * a / 180).toFixed(2)}px)`;
      shadeLi.style.opacity = (s * 0.28).toFixed(3);
      shadeR.style.opacity = (Math.max(0, s) * 0.12).toFixed(3);
      shadeLo.style.opacity = (t * 0.55).toFixed(3);
    };
    const req = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
    addEventListener("scroll", req, { passive: true });
    addEventListener("resize", req);
    draw();
  }

  // Videos only play while on screen.
  const vo = new IntersectionObserver(entries => entries.forEach(e => {
    if (still) return;
    e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause();
  }));
  document.querySelectorAll("video").forEach(v => vo.observe(v));
})();
