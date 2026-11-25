/**
 * Telegram-style particle dissolve ("vaporize / snap") animation for deleted chat bubbles.
 * Spawns a transient fixed <canvas> overlay above the target message elements and
 * scatters lightweight pixel/dust particles while the bubble fades & shrinks.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

export function triggerTelegramDeleteAnimation(messageIds: string[]): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined" || messageIds.length === 0) {
    return Promise.resolve();
  }

  // Respect user's reduced-motion preference
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return new Promise((r) => setTimeout(r, 120));
    }
  } catch {}

  const targets: { rect: DOMRect; colors: string[] }[] = [];

  for (const id of messageIds.slice(0, 14)) {
    const outer = document.getElementById(`msg-${id}`);
    if (!outer) continue;
    const bubble = (outer.querySelector("[data-nsta-bubble='true']") as HTMLElement | null) || outer;
    const rect = bubble.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    let bg = "#10b981";
    let fg = "#e2e8f0";
    try {
      const style = window.getComputedStyle(bubble);
      if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") {
        bg = style.backgroundColor;
      }
      if (style.color) fg = style.color;
    } catch {}

    targets.push({
      rect,
      colors: [bg, fg, "#94a3b8", "#34d399", "#cbd5e1"],
    });
  }

  if (targets.length === 0) {
    return new Promise((r) => setTimeout(r, 180));
  }

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new Promise((r) => setTimeout(r, 180));
  }
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const particles: Particle[] = [];
  const perBubble = targets.length > 4 ? 26 : 48;

  for (const t of targets) {
    const { rect, colors } = t;
    for (let i = 0; i < perBubble; i++) {
      const px = rect.left + Math.random() * rect.width;
      const py = rect.top + Math.random() * rect.height;
      // Bias slightly upward and outward like Telegram's vaporize cloud
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 0.6 + Math.random() * 2.4;
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 1.1,
        vy: Math.sin(angle) * speed - 0.4,
        size: 1.5 + Math.random() * 3.0,
        alpha: 0.92,
        decay: 0.022 + Math.random() * 0.024,
        color: colors[i % colors.length],
      });
    }
  }

  return new Promise<void>((resolve) => {
    const start = performance.now();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      resolve();
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0.02) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy -= 0.035; // gentle upward float
        p.alpha -= p.decay;
        if (p.alpha > 0.02) {
          alive++;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (alive > 0 && elapsed < 540) {
        requestAnimationFrame(tick);
      } else {
        finish();
      }
    };

    requestAnimationFrame(tick);
    setTimeout(finish, 580);
  });
}
