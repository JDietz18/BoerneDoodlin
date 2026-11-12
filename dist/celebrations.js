// Lightweight canvas confetti for Doodle Onward. The caller owns the canvas,
// clearing, and DPR transform. This layer never touches the DOM or starts a timer.

const LIMIT = 120;
const TAU = Math.PI * 2;
const PALETTE = ['#FFD46B', '#B9E6CB', '#FFF5D7', '#F48A78'];
const KINDS = {
  win:    { count: 64, speed: [.27, .54], gravity: .5, drag: .38, spread: 1.12, life: 2.7, marks: 5 },
  record: { count: 82, speed: [.3, .58], gravity: .52, drag: .36, spread: 1.2, life: 2.85, marks: 5 },
  star:   { count: 18, speed: [.07, .17], gravity: .12, drag: .65, spread: 0, life: 2.25, marks: 3 },
  power:  { count: 22, speed: [.12, .28], gravity: .055, drag: 1.1, spread: 0, life: 2.15, marks: 1 },
  combo:  { count: 10, speed: [.1, .21], gravity: .24, drag: .65, spread: .95, life: 2.1, marks: 3 },
  stack:  { count: 26, speed: [.18, .34], gravity: .28, drag: .6, spread: 1.02, life: 2.35, marks: 3 }
};
const MARKS = [[0, 0], [-.78, -.28], [.74, -.44], [-.38, .66], [.63, .57]];
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const colorOrNull = value => typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value) ? value : null;

/** Bounded, transient celebration particles. Origins are normalized to 0..1;
 * motion is relative to the canvas's shorter edge, keeping phones comfortable.
 * Optional color accepts an opaque 3- or 6-digit hex color.
 */
export class Celebrations {
  constructor({ random = Math.random } = {}) {
    this.random = typeof random === 'function' ? random : Math.random;
    this.particles = [];
  }

  burst({ x = .5, y = .35, kind = 'win', color } = {}) {
    kind = Object.hasOwn(KINDS, kind) ? kind : 'win';
    const preset = KINDS[kind];
    const originX = clamp(finite(x, .5), 0, 1);
    const originY = clamp(finite(y, .35), 0, 1);
    const customColor = colorOrNull(color);
    const overflow = this.particles.length + preset.count - LIMIT;
    if (overflow > 0) this.particles.splice(0, overflow);

    for (let i = 0; i < preset.count; i++) {
      const radial = preset.spread === 0;
      const angle = radial ? (i / preset.count) * TAU + this._roll() * .15
        : -Math.PI / 2 + (this._roll() * 2 - 1) * preset.spread;
      const speed = preset.speed[0] + this._roll() * (preset.speed[1] - preset.speed[0]);
      const pick = this._roll();
      const gold = kind === 'star' || kind === 'record';
      const stack = kind === 'stack';
      const powerCore = kind === 'power' && i === 0;
      const shape = powerCore || stack || kind === 'star' || pick < .32 ? 'star'
        : pick > .9 && (kind === 'win' || kind === 'record') ? 'paw' : 'paper';
      const palette = stack || kind === 'power' ? PALETTE.slice(0, 3)
        : gold ? [PALETTE[0], PALETTE[2], PALETTE[1], PALETTE[0]] : PALETTE;
      this.particles.push({
        originX, originY,
        x: powerCore ? 0 : (this._roll() - .5) * .018,
        y: powerCore ? 0 : (this._roll() - .5) * .012,
        vx: powerCore ? 0 : Math.cos(angle) * speed,
        vy: powerCore ? 0 : Math.sin(angle) * speed,
        gravity: powerCore ? 0 : preset.gravity,
        drag: preset.drag,
        rotation: (this._roll() - .5) * 1.5,
        spin: powerCore ? 0 : (this._roll() - .5) * 3.1,
        size: powerCore ? 1.65 : .65 + this._roll() * .62,
        flutter: powerCore ? 0 : this._roll() * .005,
        phase: this._roll() * TAU,
        age: 0,
        life: powerCore ? .6 : preset.life - this._roll() * .24,
        color: customColor || palette[i % palette.length],
        shape,
        powerCore,
        mark: i < preset.marks ? i : -1,
        markLife: kind === 'combo' ? .65 : .85
      });
    }
    return preset.count;
  }

  update(dt) {
    dt = Math.max(0, finite(dt));
    if (!dt || !this.particles.length) return;
    // Returning to a backgrounded tab should not restart an old celebration.
    if (dt >= 3) { this.clear(); return; }
    for (const p of this.particles) {
      p.age += dt;
      const nextVx = p.vx * Math.exp(-p.drag * dt);
      p.x += (p.vx - nextVx) / p.drag;
      p.vx = nextVx;
      p.y += p.vy * dt + .5 * p.gravity * dt * dt;
      p.vy += p.gravity * dt;
      p.rotation += p.spin * dt;
      p.spin *= Math.exp(-.3 * dt);
    }
    this.particles = this.particles.filter(p => p.age < p.life);
  }

  draw(ctx, width, height, { reducedMotion = false } = {}) {
    width = finite(width); height = finite(height);
    if (!ctx || width <= 0 || height <= 0 || !this.particles.length) return;
    const unit = Math.min(width, height);
    const baseSize = clamp(unit * .012, 3.6, 8);
    const markRadius = clamp(unit * .055, 15, 30);
    ctx.save();
    try {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#315746';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.filter = 'none';
      ctx.setLineDash?.([]);
      for (const p of this.particles) {
        const activeLife = reducedMotion ? Math.min(p.markLife, p.life) : p.life;
        if (reducedMotion && (p.mark < 0 || p.age >= activeLife)) continue;
        const remaining = activeLife - p.age;
        const fade = reducedMotion ? .3 : Math.min(.7, p.life * .4);
        const alpha = clamp(remaining / fade, 0, 1);
        if (alpha <= 0) continue;
        const mark = MARKS[Math.max(0, p.mark)];
        const x = p.originX * width + (reducedMotion ? mark[0] * markRadius
          : (p.x + Math.sin(p.phase + p.age * 4) * p.flutter) * unit);
        const y = p.originY * height + (reducedMotion ? mark[1] * markRadius : p.y * unit);
        const size = reducedMotion ? baseSize * (p.mark === 0 ? 1.35 : .7) : baseSize * p.size;
        if (x < -size * 2 || x > width + size * 2 || y < -size * 2 || y > height + size * 2) continue;
        ctx.save();
        try {
          ctx.translate(x, y);
          // Reduced motion is a brief stationary cluster, with no travel, spin,
          // flutter, pulsing, or full-screen flash. Only its opacity fades.
          ctx.rotate(reducedMotion || p.powerCore ? 0 : p.rotation);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.lineWidth = Math.max(.7, size * .11);
          const shape = reducedMotion ? 'star' : p.shape;
          if (shape === 'star') this._star(ctx, size);
          else if (shape === 'paw') this._paw(ctx, size);
          else {
            const flutter = .78 + Math.sin(p.phase + p.age * 4) * .18;
            ctx.fillRect(-size * .65, -size * .35, size * 1.3 * flutter, size * .7);
            ctx.strokeRect(-size * .65, -size * .35, size * 1.3 * flutter, size * .7);
          }
        } finally { ctx.restore(); }
      }
    } finally { ctx.restore(); }
  }

  clear() { this.particles.length = 0; }

  _roll() {
    try { return clamp(finite(this.random(), .5), 0, .999999); }
    catch { return .5; }
  }

  _star(ctx, radius) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = radius * (i % 2 ? .45 : 1);
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  _paw(ctx, radius) {
    // A tiny original paw glyph, built from opaque pads rather than an asset.
    const pads = [[0, .28, .48, .38, 0], [-.55, -.19, .2, .27, -.4],
      [-.21, -.52, .21, .28, -.12], [.22, -.52, .21, .28, .12], [.56, -.18, .2, .27, .4]];
    for (const [x, y, rx, ry, angle] of pads) {
      ctx.beginPath(); ctx.ellipse(x * radius, y * radius, rx * radius, ry * radius, angle, 0, TAU);
      ctx.fill(); ctx.stroke();
    }
  }
}
