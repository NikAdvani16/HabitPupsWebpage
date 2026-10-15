// A small stand-in for SwiftUI's Path and GraphicsContext on the HTML canvas, so the app's
// drawing code ports line for line. Points are {x, y}; rects are {x, y, width, height};
// transforms are CoreGraphics-style [a, b, c, d, tx, ty] (x' = a·x + c·y + tx).
(function () {
  const Pup = (window.Pup = window.Pup || {});

  // ---- Colour ---------------------------------------------------------------------------
  const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
  Pup.hex = (v) => ({ r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 });
  Pup.rgb = (r, g, b) => ({ r, g, b });
  Pup.mix = (a, b, t) => {
    t = clamp01(t);
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  };
  Pup.darken = (c, a) => Pup.mix(c, { r: 0, g: 0, b: 0 }, a);
  Pup.lighten = (c, a) => Pup.mix(c, { r: 1, g: 1, b: 1 }, a);
  Pup.luminance = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  Pup.css = (c, alpha = 1) =>
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
  Pup.white = (alpha) => `rgba(255,255,255,${alpha})`;

  // ---- Affine transforms (CoreGraphics conventions) ----------------------------------
  const T = (Pup.T = {
    identity: [1, 0, 0, 1, 0, 0],
    rotate: (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0],
    translate: (x, y) => [1, 0, 0, 1, x, y],
    scale: (sx, sy) => [sx, 0, 0, sy, 0, 0],
    // t1 then t2 (CGAffineTransform.concatenating).
    concat: (t1, t2) => [
      t1[0] * t2[0] + t1[1] * t2[2],
      t1[0] * t2[1] + t1[1] * t2[3],
      t1[2] * t2[0] + t1[3] * t2[2],
      t1[2] * t2[1] + t1[3] * t2[3],
      t1[4] * t2[0] + t1[5] * t2[2] + t2[4],
      t1[4] * t2[1] + t1[5] * t2[3] + t2[5],
    ],
    apply: (t, p) => ({ x: t[0] * p.x + t[2] * p.y + t[4], y: t[1] * p.x + t[3] * p.y + t[5] }),
  });

  // ---- Path -------------------------------------------------------------------------------
  // Commands: ['M', p] ['L', p] ['Q', control, to] ['C', c1, c2, to] ['Z']
  const K = 0.5522847498307936;

  class Path {
    constructor() {
      this.cmds = [];
      this._p2d = null;
    }
    move(p) { this.cmds.push(['M', p]); this._p2d = null; return this; }
    addLine(p) { this.cmds.push(['L', p]); this._p2d = null; return this; }
    addQuadCurve(to, control) { this.cmds.push(['Q', control, to]); this._p2d = null; return this; }
    addCurve(to, c1, c2) { this.cmds.push(['C', c1, c2, to]); this._p2d = null; return this; }
    closeSubpath() { this.cmds.push(['Z']); this._p2d = null; return this; }
    addLines(points) {
      points.forEach((p, i) => (i === 0 ? this.move(p) : this.addLine(p)));
      return this;
    }
    addPath(other) { this.cmds.push(...other.cmds); this._p2d = null; return this; }

    // An ellipse as four cubic arcs from angle 0 (its +x end), angles increasing toward +y,
    // as CoreGraphics adds one.
    addEllipse(cx, cy, rx, ry, rotation = 0) {
      const cr = Math.cos(rotation), sr = Math.sin(rotation);
      const pt = (a) => {
        const lx = rx * Math.cos(a), ly = ry * Math.sin(a);
        return { x: cx + lx * cr - ly * sr, y: cy + lx * sr + ly * cr };
      };
      const tan = (a) => {
        const lx = -rx * Math.sin(a), ly = ry * Math.cos(a);
        return { x: lx * cr - ly * sr, y: lx * sr + ly * cr };
      };
      this.move(pt(0));
      for (let i = 0; i < 4; i++) {
        const a0 = (i * Math.PI) / 2, a1 = ((i + 1) * Math.PI) / 2;
        const p0 = pt(a0), p1 = pt(a1), t0 = tan(a0), t1 = tan(a1);
        this.addCurve(p1, { x: p0.x + K * t0.x, y: p0.y + K * t0.y }, { x: p1.x - K * t1.x, y: p1.y - K * t1.y });
      }
      return this.closeSubpath();
    }
    addEllipseIn(r) { return this.addEllipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2); }
    addRect(r) {
      return this.move({ x: r.x, y: r.y }).addLine({ x: r.x + r.width, y: r.y })
        .addLine({ x: r.x + r.width, y: r.y + r.height }).addLine({ x: r.x, y: r.y + r.height }).closeSubpath();
    }
    addRoundedRect(r, cw, ch = cw) {
      cw = Math.min(cw, r.width / 2);
      ch = Math.min(ch, r.height / 2);
      const x0 = r.x, y0 = r.y, x1 = r.x + r.width, y1 = r.y + r.height, kx = cw * K, ky = ch * K;
      this.move({ x: x0 + cw, y: y0 });
      this.addLine({ x: x1 - cw, y: y0 });
      this.addCurve({ x: x1, y: y0 + ch }, { x: x1 - cw + kx, y: y0 }, { x: x1, y: y0 + ch - ky });
      this.addLine({ x: x1, y: y1 - ch });
      this.addCurve({ x: x1 - cw, y: y1 }, { x: x1, y: y1 - ch + ky }, { x: x1 - cw + kx, y: y1 });
      this.addLine({ x: x0 + cw, y: y1 });
      this.addCurve({ x: x0, y: y1 - ch }, { x: x0 + cw - kx, y: y1 }, { x: x0, y: y1 - ch + ky });
      this.addLine({ x: x0, y: y0 + ch });
      this.addCurve({ x: x0 + cw, y: y0 }, { x: x0, y: y0 + ch - ky }, { x: x0 + cw - kx, y: y0 });
      return this.closeSubpath();
    }
    // CoreGraphics addArc: clockwise=false sweeps with increasing angle.
    addArc(c, r, a0, a1, clockwise) {
      let sweep = a1 - a0;
      const tau = Math.PI * 2;
      if (!clockwise) { while (sweep < 0) sweep += tau; } else { while (sweep > 0) sweep -= tau; }
      const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
      const step = sweep / n, k = (4 / 3) * Math.tan(step / 4);
      const pt = (a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
      const start = pt(a0);
      if (this.cmds.length && this.cmds[this.cmds.length - 1][0] !== 'Z') this.addLine(start); else this.move(start);
      for (let i = 0; i < n; i++) {
        const s = a0 + step * i, e = s + step, p0 = pt(s), p1 = pt(e);
        this.addCurve(p1,
          { x: p0.x - k * r * Math.sin(s), y: p0.y + k * r * Math.cos(s) },
          { x: p1.x + k * r * Math.sin(e), y: p1.y - k * r * Math.cos(e) });
      }
      return this;
    }

    applying(t) {
      const out = new Path();
      const f = (p) => T.apply(t, p);
      out.cmds = this.cmds.map((c) => [c[0], ...c.slice(1).map(f)]);
      return out;
    }
    offsetBy(dx, dy) { return this.applying(T.translate(dx, dy)); }

    toPath2D() {
      if (this._p2d) return this._p2d;
      const p = new Path2D();
      for (const c of this.cmds) {
        switch (c[0]) {
          case 'M': p.moveTo(c[1].x, c[1].y); break;
          case 'L': p.lineTo(c[1].x, c[1].y); break;
          case 'Q': p.quadraticCurveTo(c[1].x, c[1].y, c[2].x, c[2].y); break;
          case 'C': p.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y); break;
          case 'Z': p.closePath(); break;
        }
      }
      this._p2d = p;
      return p;
    }

    // Polylines, one per subpath, sampling curves.
    flatten(steps = 16) {
      const subs = [];
      let cur = null, start = null, last = null;
      const push = (p) => { cur.pts.push(p); last = p; };
      for (const c of this.cmds) {
        switch (c[0]) {
          case 'M': cur = { pts: [], closed: false }; subs.push(cur); start = c[1]; push(c[1]); break;
          case 'L': if (!cur) { cur = { pts: [], closed: false }; subs.push(cur); } push(c[1]); break;
          case 'Q': {
            const p0 = last;
            for (let i = 1; i <= steps; i++) {
              const t = i / steps, u = 1 - t;
              push({ x: u * u * p0.x + 2 * u * t * c[1].x + t * t * c[2].x, y: u * u * p0.y + 2 * u * t * c[1].y + t * t * c[2].y });
            }
            break;
          }
          case 'C': {
            const p0 = last;
            for (let i = 1; i <= steps; i++) {
              const t = i / steps, u = 1 - t;
              push({
                x: u * u * u * p0.x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t * t * t * c[3].x,
                y: u * u * u * p0.y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t * t * t * c[3].y,
              });
            }
            break;
          }
          case 'Z': if (cur) { cur.closed = true; if (start) push(start); } break;
        }
      }
      return subs;
    }

    boundingRect() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of this.flatten(24)) for (const p of s.pts) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY };
    }

    // The part of the path between two fractions of its whole length.
    trimmedPath(from, to) {
      const subs = this.flatten(32);
      let total = 0;
      for (const s of subs) for (let i = 1; i < s.pts.length; i++) total += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
      const a = from * total, b = to * total, out = new Path();
      let run = 0;
      for (const s of subs) {
        let open = false;
        for (let i = 1; i < s.pts.length; i++) {
          const p = s.pts[i - 1], q = s.pts[i], len = Math.hypot(q.x - p.x, q.y - p.y);
          const s0 = run, s1 = run + len;
          run = s1;
          if (s1 < a || s0 > b || len === 0) { open = false; continue; }
          const lerp = (d) => ({ x: p.x + (q.x - p.x) * ((d - s0) / len), y: p.y + (q.y - p.y) * ((d - s0) / len) });
          if (!open) { out.move(lerp(Math.max(a, s0))); open = true; }
          out.addLine(lerp(Math.min(b, s1)));
        }
      }
      return out;
    }
  }
  Pup.Path = Path;
  Pup.ellipse = (center, rx, ry, rotation = 0) => new Path().addEllipse(center.x, center.y, rx, ry, rotation);
  Pup.segment = (a, b) => new Path().move(a).addLine(b);
  Pup.rectPath = (r) => new Path().addRect(r);
  Pup.roundedRect = (r, radius) => new Path().addRoundedRect(r, radius);

  // ---- GraphicsContext --------------------------------------------------------------------
  // A value-like context: copy() it where Swift does `var c = ctx`. Clips and transforms
  // apply to whatever is drawn through that copy only.
  const layerPool = [];
  class GC {
    constructor(ctx, t = T.identity) {
      this.ctx = ctx;
      this.t = t;
      this.clips = [];
      this.opacity = 1;
    }
    copy() {
      const g = new GC(this.ctx, this.t);
      g.clips = this.clips.slice();
      g.opacity = this.opacity;
      return g;
    }
    translateBy(x, y) { this.t = T.concat(T.translate(x, y), this.t); }
    rotate(a) { this.t = T.concat(T.rotate(a), this.t); }
    scaleBy(sx, sy) { this.t = T.concat(T.scale(sx, sy), this.t); }
    clip(path, inverse = false) { this.clips.push({ path, t: this.t, inverse }); }

    _begin() {
      const c = this.ctx;
      c.save();
      for (const k of this.clips) {
        c.setTransform(k.t[0], k.t[1], k.t[2], k.t[3], k.t[4], k.t[5]);
        if (k.inverse) {
          const p = new Path2D();
          p.rect(-1e6, -1e6, 2e6, 2e6);
          p.addPath(k.path.toPath2D());
          c.clip(p, 'evenodd');
        } else {
          c.clip(k.path.toPath2D());
        }
      }
      const t = this.t;
      c.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
      c.globalAlpha = this.opacity;
    }

    fill(path, color) {
      this._begin();
      this.ctx.fillStyle = color;
      this.ctx.fill(path.toPath2D());
      this.ctx.restore();
    }

    // style: { lineWidth, lineCap: 'butt'|'round'|'square', lineJoin: 'miter'|'round'|'bevel' }
    stroke(path, color, style) {
      this._begin();
      const c = this.ctx;
      c.strokeStyle = color;
      c.lineWidth = style.lineWidth;
      c.lineCap = style.lineCap || 'butt';
      c.lineJoin = style.lineJoin || 'miter';
      c.miterLimit = 10;
      c.stroke(path.toPath2D());
      c.restore();
    }

    // Swift's `ctx.fill(path.strokedPath(style), …)`.
    fillStroked(path, color, style) { this.stroke(path, color, style); }

    // Draws into an offscreen layer, then composites it once with this context's opacity
    // and clips (SwiftUI drawLayer).
    drawLayer(paint) {
      const canvas = this.ctx.canvas;
      let layer = layerPool.pop();
      if (!layer) layer = document.createElement('canvas');
      if (layer.width !== canvas.width || layer.height !== canvas.height) {
        layer.width = canvas.width;
        layer.height = canvas.height;
      }
      const lctx = layer.getContext('2d');
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, layer.width, layer.height);
      paint(new GC(lctx, this.t));
      this._begin();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.drawImage(layer, 0, 0);
      this.ctx.restore();
      layerPool.push(layer);
    }

    text(string, at, size, color) {
      this._begin();
      const c = this.ctx;
      c.fillStyle = color;
      c.font = `900 ${size}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(string, at.x, at.y);
      c.restore();
    }
  }
  Pup.GC = GC;
})();
