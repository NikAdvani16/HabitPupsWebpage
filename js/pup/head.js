// PuppyHead from the app, ported line for line: the face laid out in the head's own 2D
// frame, eyes, ears, muzzle, markings, and the hats and sunglasses.
(function () {
  const Pup = window.Pup, V = Pup.V, M = Pup.M;
  const pt = (x, y) => ({ x, y });
  const css = Pup.css;
  const S = Math.sin, C = Math.cos;

  const skullRX = 1.0, skullRY = 0.93;
  const earFadeStart = 0.42, earFadeEnd = 0.58;

  function frame(g, cam) {
    const cp = M.cosPitch, sp = M.sinPitch;
    const f = V.col(g.headM, 0), u = V.col(g.headM, 1);
    const fx = f[0], fUp = f[1] * cp - f[2] * sp, fD = f[2] * cp + f[1] * sp;
    const ux = u[0], uUp = u[1] * cp - u[2] * sp;
    return {
      center: cam.point(g.headCenter),
      radius: 0.9 * cam.scale,
      turn: Math.atan2(fx, fD),
      nod: Math.asin(M.clamp(fUp, -1, 1)),
      roll: Math.atan2(ux, uUp),
    };
  }

  function layout(fr, g) {
    const p = g.pose, style = g.style;
    const t = fr.turn, tf = t * (1 - 0.15 * Math.max(0, C(t))), nod = S(fr.nod);
    const mv = C(t);
    const snout = style.snoutLength;
    const jowl = style.jowls ? 1 : 0;
    const muzzle = { x: 0.8 * S(t) * (0.85 + 0.15 * snout), y: 0.37 + 0.03 * jowl - nod * 0.5 * Math.max(0, mv), rx: 0.5 * snout * (1 + 0.14 * jowl), ry: 0.34 + 0.05 * jowl, vis: mv };
    const eyes = [-1, 1].map((side) => {
      const a = tf + side * 0.42, vis = C(a);
      const show = M.smooth(0.22, 0.3, vis);
      const h = show;
      let y = -0.06 - nod * 0.45 * Math.max(0, vis);
      const dx = (0.8 * S(a) - muzzle.x) / muzzle.rx;
      if (muzzle.vis > -0.25 && Math.abs(dx) < 1) {
        const top = muzzle.y - muzzle.ry * Math.sqrt(1 - dx * dx);
        y = Math.min(y, top + 0.03 - 0.185 * h);
      }
      return { side, x: 0.8 * S(a), y, w: (0.72 + 0.28 * vis) * show, h, show };
    });
    const nose = { x: muzzle.x + 0.36 * snout * S(t), y: muzzle.y - 0.14, rx: 0.15 * (0.72 + 0.28 * Math.abs(mv)), ry: 0.11 };
    const mid = pt(muzzle.x + 0.3 * snout * S(t), muzzle.y + 0.12);
    const corners = [-1, 1].map((side) => {
      const a = t + side * 0.95;
      const smile = p.face.smile;
      return { x: muzzle.x + 0.44 * snout * S(a), y: muzzle.y + 0.1 - smile * (smile < 0 ? 0.13 : 0.08), vis: C(a) };
    }).filter((k) => k.vis > -0.15);

    const upright = style.uprightEars;
    const ears = [[p.earL, 1], [p.earR, -1]].map(([ear, s]) => {
      const a = t + s * (upright || style.ears === 'tiny' ? -1.3 : -1.75);
      const raw = S(a);
      const vis = C(a), x = (upright ? 0.74 : 0.8) * (raw >= 0 ? 1 : -1) * Math.pow(Math.abs(raw), 0.6);
      const out = x === 0 ? s : x > 0 ? 1 : -1;
      const noseDir = S(t) >= 0 ? 1 : -1;
      let angle;
      if (upright) {
        const lean = M.clamp(x / 0.45, -1, 1);
        const facing = 0.35 + 0.65 * Math.max(0, C(t));
        const away = M.smooth(0.1, -0.5, C(t));
        angle = lean * (0.28 + ((ear.flare - 0.35) * 0.35 - ear.swing * 0.9) * facing) * (1 - 0.5 * away) - fr.roll * away;
      } else {
        const facing = 0.3 + 0.7 * Math.max(0, C(t));
        const side = Math.abs(S(t)) * Math.max(0, vis);
        const hang = style.ears === 'tiny' ? 0 : noseDir * 0.3 * side;
        angle = -out * (0.08 + ear.flare * 0.85 * facing) - noseDir * ear.swing * Math.abs(S(t)) * 0.9 + hang;
        if (style.ears === 'tiny') {
          angle = out * 0.35 * facing - noseDir * 0.55 * Math.abs(S(t)) - noseDir * ear.swing * Math.abs(S(t)) * 0.4;
        }
        if (style.ears !== 'tiny') {
          let seen = angle + fr.roll * 0.25;
          if (noseDir * seen > 0.32) seen = noseDir * 0.32;
          const lying = M.smooth(0.35, 0.8, Math.abs(fr.roll));
          angle = seen - fr.roll * (1 - lying) + (angle - seen + fr.roll * 0.25) * lying;
        }
      }
      const base = { floppy: [0.5, 0.52], long: [0.54, 0.7], tiny: [0.42, 0.24], perked: [0.5, 0.6], semiPerked: [0.48, 0.44], bat: [0.66, 0.6] }[style.ears];
      const size = { w: base[0] * style.earScale, l: base[1] * style.earScale };
      let y = (upright ? -0.62 : style.ears === 'tiny' ? -0.62 : -0.52) - nod * 0.3 * Math.max(0, vis);
      if (style.ears === 'tiny') {
        const rim = -skullRY * Math.sqrt(1 - Math.min(0.95, x * x));
        y = rim + 0.07;
      }
      const behind = upright ? 0 : M.smooth(-0.05, -0.35, C(t));
      const front = M.smooth(-0.05, 0.15, vis) * (1 - behind);
      const sideSign = x >= 0 ? 1 : -1;
      let edgeX = M.lerp(x, sideSign * 0.88, behind * M.smooth(-0.05, 0.15, vis));
      if (style.ears === 'floppy' || style.ears === 'long') {
        edgeX -= noseDir * 0.2 * Math.abs(S(t)) * M.smooth(0, 0.4, vis);
      }
      if (style.ears === 'floppy' || style.ears === 'long') {
        const rim = -skullRY * Math.sqrt(1 - Math.min(0.95, edgeX * edgeX));
        y = Math.max(y, rim + 0.12 * size.l + 0.05);
      }
      const opening = C(t + s * -0.35);
      return { x: edgeX, y, angle, front, width: size.w * (0.72 + 0.28 * Math.abs(vis)), length: size.l, vis, opening };
    });
    if (!upright) {
      for (const ear of ears) {
        if (ear.front <= 0.5) continue;
        for (const eye of eyes) {
          if (eye.show > 0.3 && Math.abs(ear.x - eye.x) < 0.6) {
            const away = ear.x < eye.x ? -1 : 1;
            ear.x = M.clamp(eye.x + away * 0.6, -0.9, 0.9);
          }
        }
      }
    }
    return { eyes, muzzle, nose, mouthMid: mid, corners, ears };
  }

  const earTransform = (e) => Pup.T.concat(Pup.T.rotate(e.angle), Pup.T.translate(e.x, e.y));

  function earPath(e, style, grow) {
    let local;
    switch (style.ears) {
      case 'bat':
        local = batEar(e, grow, true);
        break;
      case 'perked':
      case 'semiPerked': {
        const w = e.width / 2 + grow, h = e.length + grow;
        local = new Pup.Path();
        local.move(pt(-w, 0.1 + grow));
        local.addQuadCurve(pt(0, -h), pt(-w * 0.8, -h * 0.55));
        local.addQuadCurve(pt(w, 0.1 + grow), pt(w * 0.8, -h * 0.55));
        local.closeSubpath();
        break;
      }
      default:
        if (style.curly && (style.ears === 'floppy' || style.ears === 'long' || style.ears === 'tiny')) {
          local = new Pup.Path();
          const r = e.width * 0.5;
          for (const [dx, dy, k] of [[0.0, 0.34, 0.95], [0.06, 0.8, 1.05], [-0.02, 1.22, 0.9]]) {
            const rr = r * k + grow;
            local.addEllipseIn({ x: dx * e.width - rr, y: dy * e.length - rr, width: 2 * rr, height: 2 * rr });
          }
        } else if (style.ears === 'tiny') {
          const w = e.width / 2 + grow, l = e.length + grow;
          local = new Pup.Path();
          local.move(pt(-w, 0.02));
          local.addQuadCurve(pt(w, 0.02), pt(0, -0.4 * l - grow));
          local.addQuadCurve(pt(0.12 * w, 1.05 * l), pt(w * 0.85, 0.62 * l));
          local.addQuadCurve(pt(-w, 0.02), pt(-w * 0.55, 0.75 * l));
          local.closeSubpath();
        } else {
          const w = e.width / 2 + grow, l = e.length;
          const top = -0.12 * l - grow, bottom = 1.88 * l + grow, waist = 1.15 * l;
          const neck = w * 0.42;
          local = new Pup.Path();
          local.move(pt(-neck, top + 0.06 * l));
          local.addCurve(pt(-w, waist), pt(-neck - w * 0.25, top + 0.45 * l), pt(-w, waist - 0.45 * l));
          local.addCurve(pt(w, waist), pt(-w, bottom + 0.02 * l), pt(w, bottom + 0.02 * l));
          local.addCurve(pt(neck, top + 0.06 * l), pt(w, waist - 0.45 * l), pt(neck + w * 0.25, top + 0.45 * l));
          local.addQuadCurve(pt(-neck, top + 0.06 * l), pt(0, top - 0.32 * l));
          local.closeSubpath();
        }
    }
    return local.applying(earTransform(e));
  }

  function earSides(e, style) {
    if (style.ears === 'bat') return batEar(e, 0, false).applying(earTransform(e));
    const w = e.width / 2, h = e.length;
    const p = new Pup.Path();
    p.move(pt(-w, 0.1));
    p.addQuadCurve(pt(0, -h), pt(-w * 0.8, -h * 0.55));
    p.addQuadCurve(pt(w, 0.1), pt(w * 0.8, -h * 0.55));
    return p.applying(earTransform(e));
  }

  function batEar(e, grow, closed) {
    const w = e.width / 2 + grow, h = e.length + grow;
    const p = new Pup.Path();
    p.move(pt(-w * 0.78, 0.1 + grow));
    p.addCurve(pt(0, -h), pt(-w * 1.2, -h * 0.45), pt(-w * 0.82, -h));
    p.addCurve(pt(w * 0.78, 0.1 + grow), pt(w * 0.82, -h), pt(w * 1.2, -h * 0.45));
    if (closed) p.closeSubpath();
    return p;
  }

  function jowls(L, grow) {
    const m = L.muzzle;
    const p = new Pup.Path();
    const spread = m.rx * 0.5 * Math.max(0.4, Math.abs(m.vis));
    for (const side of [-1, 1]) {
      const c = pt(m.x + side * spread, m.y + m.ry * 0.62);
      p.addEllipseIn({ x: c.x - m.rx * 0.52 - grow, y: c.y - m.ry * 0.5 - grow, width: m.rx * 1.04 + 2 * grow, height: m.ry + 2 * grow });
    }
    return p;
  }

  function cheekFluff(grow) {
    const p = new Pup.Path();
    for (let deg = -10; deg <= 190 + 1e-9; deg += 25) {
      const a = (deg * Math.PI) / 180;
      const r = 0.2 + grow;
      p.addEllipseIn({ x: C(a) * 0.9 - r, y: S(a) * 0.8 - r, width: 2 * r, height: 2 * r });
    }
    return p;
  }

  function crownPuffs(grow) {
    const p = new Pup.Path();
    const puffs = [];
    for (let deg = 200; deg <= 340 + 1e-9; deg += 28) {
      const a = (deg * Math.PI) / 180;
      puffs.push([C(a) * 0.9, S(a) * 0.84, 0.2]);
    }
    puffs.push([0, -1.02, 0.24], [-0.2, -0.96, 0.2], [0.2, -0.96, 0.2]);
    for (const [x, y, r] of puffs) p.addEllipseIn({ x: x - r - grow, y: y - r - grow, width: 2 * (r + grow), height: 2 * (r + grow) });
    return p;
  }

  function withFrame(ctx, fr, body) {
    const c = ctx.copy();
    c.translateBy(fr.center.x, fr.center.y);
    c.rotate(fr.roll);
    c.scaleBy(fr.radius, fr.radius);
    body(c);
  }

  function outline(ctx, g, cam, width) {
    const fr = frame(g, cam), L = layout(fr, g);
    const o = width / fr.radius, ink = css(g.style.ink);
    withFrame(ctx, fr, (c) => {
      c.fill(Pup.ellipse(pt(0, 0), skullRX + o, skullRY + o), ink);
      if (g.style.curly) c.fill(crownPuffs(o), ink);
      if (g.style.ruff) c.fill(cheekFluff(o), ink);
      for (const e of L.ears) c.fill(earPath(e, g.style, o), ink);
      if (g.style.outfit.hat === 'beanie') {
        const pomY = -1.16 + 0.32 * Math.max(0, -S(fr.nod));
        c.fill(Pup.ellipse(pt(0, pomY), 0.23 + o, 0.23 + o), ink);
      }
      c.fill(Pup.ellipse(pt(L.muzzle.x, L.muzzle.y), L.muzzle.rx + o, L.muzzle.ry + o), ink);
      if (g.style.jowls && L.muzzle.vis > -0.25) c.fill(jowls(L, o), ink);
    });
  }

  function draw(ctx, g, cam, width) {
    const fr = frame(g, cam), L = layout(fr, g), style = g.style, f = g.pose.face;
    const o = width / fr.radius, lw = Math.max(1.3 / fr.radius, 0.05);
    withFrame(ctx, fr, (c) => {
      function ear(e, opacity, inked) {
        if (opacity <= 0.001) return;
        const paint = (c) => {
          const path = earPath(e, style, 0);
          const upright = style.uprightEars;
          const skull = Pup.ellipse(pt(0, 0), skullRX, skullRY);
          if (inked) {
            const edge = c.copy();
            if (upright) edge.clip(skull, true);
            if (style.ears === 'floppy' || style.ears === 'long') {
              const root = pt(e.x + S(e.angle) * 0.0, e.y);
              edge.clip(Pup.ellipse(root, e.width * 0.42, e.length * 0.32, e.angle), true);
            }
            edge.fill(earPath(e, style, o * 0.8), css(style.ink));
          }
          c.fill(path, css(style.ear));
          if (inked && upright) {
            const over = c.copy();
            over.clip(skull);
            over.stroke(earSides(e, style).trimmedPath(0.24, 0.76), css(style.ink), { lineWidth: lw, lineCap: 'round', lineJoin: 'round' });
          }
          if (upright && e.opening > 0.15) {
            const inner = { ...e, width: e.width * 0.55, length: e.length * 0.62 };
            const ci = c.copy();
            ci.opacity = M.smooth(0.15, 0.45, e.opening);
            ci.fill(earPath(inner, style, 0), css(Pup.mix(style.cream, Pup.hex(0xf4a7a0), 0.35)));
          }
          if (style.ears === 'semiPerked') {
            const tip = pt(e.x + S(e.angle) * e.length * 0.78, e.y - C(e.angle) * e.length * 0.78);
            c.fill(Pup.ellipse(tip, e.width * 0.26, e.length * 0.2, e.angle), css(Pup.darken(style.ear, 0.12)));
          }
        };
        if (opacity >= 0.999) {
          paint(c);
        } else {
          const outer = c.copy();
          outer.opacity = opacity;
          outer.drawLayer(paint);
        }
      }
      const muzzleBehind = L.muzzle.vis <= -0.25;
      for (const e of L.ears) if (e.front < earFadeEnd) ear(e, 1, false);
      const muffs = style.outfit.hat === 'earmuffs' ? earmuffs(fr) : null;
      if (muffs) for (const m of muffs.muffs) if (!m.front) muff(c, m, style, o);
      if (muzzleBehind) drawMuzzle(c, L, style, f, lw, false);

      if (style.curly) c.fill(crownPuffs(0), css(style.body));
      if (style.ruff) c.fill(cheekFluff(0), css(style.body));

      const skull = Pup.ellipse(pt(0, 0), skullRX, skullRY);
      c.fill(skull, css(style.body));
      const clipped = c.copy();
      clipped.clip(skull);
      clipped.fill(skull, css(style.shade));
      clipped.fill(Pup.ellipse(pt(-0.08, -0.12), skullRX, skullRY), css(style.body));
      if (style.curly) {
        [[-0.55, -0.62], [0.0, -0.74], [0.55, -0.6], [-1.1, -0.35], [1.1, -0.38]].forEach(([lon, y], i) => {
          const a = fr.turn * 0.85 + lon;
          if (C(a) <= 0.15) return;
          const cc = pt(0.82 * S(a), y);
          const r = 0.09 * (0.6 + 0.4 * C(a));
          const start = (i % 3) * 1.1;
          const curl = new Pup.Path().addArc(cc, r, start, start + 4.2, false);
          clipped.stroke(curl, css(style.shade), { lineWidth: 0.035, lineCap: 'round' });
        });
      }
      if (style.markingStyle === 'blaze' || style.markingStyle === 'tricolor') {
        const b = clipped.copy();
        const cs = C(fr.turn);
        const fade = M.smooth(0.35, 0.6, cs);
        b.opacity = M.smooth(0, 0.3, fade);
        b.fill(Pup.ellipse(pt(0.82 * S(fr.turn * (1 - 0.15 * Math.max(0, cs))), -0.32), 0.11 * Math.max(0.3, cs) * fade, 0.5), css(style.cream));
      }

      if (style.markingStyle === 'patchEye') {
        for (const e of L.eyes) {
          if (!(e.side > 0 && e.show > 0.01)) continue;
          const patch = clipped.copy();
          patch.opacity = M.smooth(0.05, 0.4, e.show);
          patch.fill(Pup.ellipse(pt(e.x + 0.03 * e.side, e.y - 0.02), 0.3 * Math.max(0.55, e.w), 0.33, -0.3 * e.side), css(style.marking));
        }
      } else if (style.markingStyle === 'tricolor') {
        for (const e of L.eyes) {
          if (e.show <= 0.01) continue;
          const dot = clipped.copy();
          dot.opacity = M.smooth(0.2, 0.5, e.show);
          dot.fill(Pup.ellipse(pt(e.x - 0.01 * e.side, e.y - 0.27), 0.085 * Math.max(0.5, e.w), 0.06), css(style.marking));
        }
        if (L.muzzle.vis > -0.1) {
          const m = L.muzzle;
          const cheek = clipped.copy();
          cheek.opacity = M.smooth(-0.1, 0.2, m.vis);
          for (const side of [-1, 1]) {
            cheek.fill(Pup.ellipse(pt(m.x + side * m.rx * 0.82 * Math.max(0.3, Math.abs(m.vis)), m.y - 0.04), 0.16, 0.15), css(style.marking));
          }
        }
      }
      if (style.jowls && style.markingStyle === 'mask') {
        for (const e of L.eyes) {
          if (e.show <= 0.01) continue;
          const around = clipped.copy();
          around.opacity = 0.6 * M.smooth(0.05, 0.4, e.show);
          around.fill(Pup.ellipse(pt(e.x, e.y + 0.03), 0.24 * Math.max(0.55, e.w), 0.22), css(style.marking));
        }
      }
      if (style.jowls && C(fr.turn) > 0.15) {
        const w = clipped.copy();
        w.opacity = 0.4 * M.smooth(0.15, 0.5, C(fr.turn));
        const cx = 0.82 * S(fr.turn * 0.85);
        for (const [dy, half] of [[-0.5, 0.13], [-0.42, 0.1]]) {
          const crease = new Pup.Path();
          crease.move(pt(cx - half, dy + 0.02));
          crease.addQuadCurve(pt(cx + half, dy + 0.02), pt(cx, dy - 0.035));
          w.stroke(crease, css(style.ink), { lineWidth: lw * 0.85, lineCap: 'round' });
        }
      }

      if (style.outfit.hat === 'beanie') beanie(c, L, fr, style, o, lw);

      for (const e of L.eyes) if (e.show > 0.01) drawEye(c, e, f, style, lw);
      if (!muzzleBehind) drawMuzzle(c, L, style, f, lw, true);
      if (style.outfit.sunglasses) sunglasses(c, L, fr, style, o, lw);
      if (g.pose.coverEyes > 0.01) pawsOverEyes(c, L, style, g.pose.coverEyes, o, lw);
      for (const e of L.ears) if (e.front > earFadeStart) ear(e, M.smooth(earFadeStart, earFadeEnd, e.front), true);
      if (muffs) {
        band(c, muffs, style, o);
        for (const m of muffs.muffs) if (m.front) muff(c, m, style, o);
      }
      if (style.outfit.hat === 'crown') crownHat(c, fr, style, o, lw);
      if (style.outfit.hat === 'partyHat') partyHat(c, fr, style, o, lw);
    });
  }

  function pawsOverEyes(c, L, style, cover, o, lw) {
    for (const e of L.eyes.filter((e) => e.show > 0.2)) {
      const center = pt(e.x * 1.05, e.y + 0.06 + (1 - cover) * 0.55);
      const rx = 0.27 * Math.max(0.6, e.w), ry = 0.22;
      const arm = new Pup.Path();
      arm.move(pt(center.x, center.y + ry * 0.4));
      arm.addLine(pt(center.x * 1.25, center.y + 0.5));
      c.stroke(arm, css(style.ink), { lineWidth: 0.32 + 2 * o, lineCap: 'round' });
      c.stroke(arm, css(style.body), { lineWidth: 0.32, lineCap: 'round' });
      const paw = Pup.ellipse(center, rx, ry);
      c.fill(Pup.ellipse(center, rx + o, ry + o), css(style.ink));
      c.fill(paw, css(style.cream));
      for (const dx of [-0.33, 0.0, 0.33]) {
        if (dx === 0) continue;
        const toe = Pup.segment(pt(center.x + dx * rx, center.y - ry * 0.95), pt(center.x + dx * rx, center.y - ry * 0.45));
        c.stroke(toe, css(style.ink), { lineWidth: lw * 0.8, lineCap: 'round' });
      }
    }
  }

  function sunglasses(c, L, fr, style, o, lw) {
    const lensColor = css(Pup.hex(0x1d1e26)), frameInk = css(Pup.darken(style.ink, 0.3));
    const shown = L.eyes.filter((e) => e.show > 0.2);
    const lenses = shown.map((e) => {
      const w = 0.38 * Math.max(0.5, e.w), h = 0.3 * e.h;
      return Pup.roundedRect({ x: e.x - w / 2, y: e.y - h * 0.55, width: w, height: h }, h * 0.42);
    });
    if (shown.length === 2) {
      const a = shown[0], b = shown[1];
      const left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
      const bridge = new Pup.Path();
      bridge.move(pt(left.x + 0.17 * Math.max(0.5, left.w), left.y - 0.06));
      bridge.addQuadCurve(pt(right.x - 0.17 * Math.max(0.5, right.w), right.y - 0.06), pt((left.x + right.x) / 2, Math.min(left.y, right.y) - 0.12));
      c.stroke(bridge, frameInk, { lineWidth: lw * 2.2, lineCap: 'round' });
    }
    for (const lens of lenses) {
      c.fillStroked(lens, frameInk, { lineWidth: lw * 2.4, lineJoin: 'round' });
      c.fill(lens, lensColor);
      const shine = c.copy();
      shine.clip(lens);
      const box = lens.boundingRect();
      const streak = Pup.segment(pt(box.minX + box.width * 0.2, box.maxY), pt(box.minX + box.width * 0.55, box.minY));
      shine.stroke(streak, Pup.white(0.35), { lineWidth: box.width * 0.16 });
    }
  }

  function partyHat(c, fr, style, o, lw) {
    const base = pt(0.12, -0.78 - 0.1 * Math.max(0, S(fr.nod)));
    const apex = pt(base.x + 0.22, base.y - 0.78);
    const half = 0.3;
    const cone = new Pup.Path();
    cone.move(pt(base.x - half, base.y + 0.04));
    cone.addLine(apex);
    cone.addLine(pt(base.x + half, base.y - 0.04));
    cone.addQuadCurve(pt(base.x - half, base.y + 0.04), pt(base.x, base.y + 0.12));
    cone.closeSubpath();
    const pom = Pup.ellipse(apex, 0.11, 0.11);
    c.fill(Pup.ellipse(apex, 0.11 + o, 0.11 + o), css(style.ink));
    c.fillStroked(cone, css(style.ink), { lineWidth: o * 2, lineJoin: 'round' });
    c.fill(cone, css(Pup.hex(0x3fb0e8)));
    const stripes = c.copy();
    stripes.clip(cone);
    for (let i = 0; i < 4; i++) {
      const u = 0.14 + i * 0.24;
      const p = pt(base.x + (apex.x - base.x) * u, base.y + (apex.y - base.y) * u);
      stripes.stroke(Pup.segment(pt(p.x - 0.4, p.y + 0.14), pt(p.x + 0.4, p.y - 0.05)), css(Pup.hex(i % 2 === 0 ? 0xffd23f : 0xff6b8b)), { lineWidth: 0.08 });
    }
    c.fill(pom, css(Pup.hex(0xff6b8b)));
    c.fill(Pup.ellipse(pt(apex.x - 0.03, apex.y - 0.03), 0.04, 0.03), Pup.white(0.5));
  }

  function crownHat(c, fr, style, o, lw) {
    const gold = css(Pup.hex(0xf4c443)), deep = css(Pup.hex(0xd99a1e));
    const baseY = -0.8 - 0.1 * Math.max(0, S(fr.nod)), half = 0.4;
    const p = new Pup.Path();
    p.move(pt(-half, baseY));
    p.addLine(pt(-half - 0.04, baseY - 0.34));
    p.addLine(pt(-half * 0.45, baseY - 0.18));
    p.addLine(pt(0, baseY - 0.44));
    p.addLine(pt(half * 0.45, baseY - 0.18));
    p.addLine(pt(half + 0.04, baseY - 0.34));
    p.addLine(pt(half, baseY));
    p.addQuadCurve(pt(-half, baseY), pt(0, baseY + 0.08));
    p.closeSubpath();
    const balls = [pt(-half - 0.04, baseY - 0.37), pt(0, baseY - 0.47), pt(half + 0.04, baseY - 0.37)];
    for (const b of balls) c.fill(Pup.ellipse(b, 0.065 + o, 0.065 + o), css(style.ink));
    c.fillStroked(p, css(style.ink), { lineWidth: o * 2, lineJoin: 'round' });
    c.fill(p, gold);
    const band = c.copy();
    band.clip(p);
    band.fill(Pup.rectPath({ x: -half - 0.1, y: baseY - 0.1, width: 2 * half + 0.2, height: 0.2 }), deep);
    for (const b of balls) c.fill(Pup.ellipse(b, 0.065, 0.065), gold);
    for (const [x, color] of [[-0.22, 0xe04a5a], [0.0, 0x3f7fd1], [0.22, 0xe04a5a]]) {
      c.fill(Pup.ellipse(pt(x, baseY - 0.05), 0.05, 0.05), css(Pup.hex(color)));
    }
    c.fill(Pup.ellipse(pt(-half * 0.6, baseY - 0.22), 0.05, 0.025), Pup.white(0.5));
  }

  function brimY(L, fr) {
    let y = -0.42 - 0.25 * S(fr.nod) * Math.max(0, C(fr.turn));
    for (const e of L.eyes) if (e.show > 0.3) y = Math.min(y, e.y - 0.4);
    return Math.max(-0.78, y);
  }

  function beanie(c, L, fr, style, o, lw) {
    const brim = brimY(L, fr);
    const ink = css(style.ink);
    const main = style.outfitColor, accent = style.outfitAccent;
    const ellipse = (rx, ry) => Pup.ellipse(pt(0, -0.03), rx, ry);
    const bandCtx = (top, bottom) => {
      const k = c.copy();
      k.clip(Pup.rectPath({ x: -3, y: top, width: 6, height: bottom - top }));
      return k;
    };
    const pomCenter = pt(0, -1.16 + 0.32 * Math.max(0, -S(fr.nod)));
    const pom = (grow) => Pup.ellipse(pomCenter, 0.23 + grow, 0.23 + grow);
    const g = o * 1.1;
    bandCtx(-3, brim + g).fill(ellipse(1.07 + g, 1.03 + g), ink);
    c.fill(pom(g), ink);
    const dome = bandCtx(-3, brim);
    dome.fill(ellipse(1.07, 1.03), css(main));
    dome.clip(ellipse(1.07, 1.03));
    dome.fill(Pup.rectPath({ x: -2, y: brim - 0.5, width: 4, height: 0.13 }), css(accent));
    bandCtx(brim - 0.24 - g, brim + 0.06 + g).fill(ellipse(1.12 + g, 1.07 + g), ink);
    const cuff = bandCtx(brim - 0.24, brim + 0.06);
    cuff.fill(ellipse(1.12, 1.07), css(Pup.darken(main, 0.08)));
    cuff.clip(ellipse(1.12, 1.07));
    for (let k = -7; k <= 7; k++) {
      const a = fr.turn * 0.85 + k * 0.3;
      if (C(a) <= 0.1) continue;
      const x = 1.1 * S(a);
      cuff.stroke(Pup.segment(pt(x, brim - 0.21), pt(x, brim + 0.03)), css(Pup.darken(main, 0.25)), { lineWidth: lw * 0.8 });
    }
    c.fill(pom(0), css(accent));
    c.fill(Pup.ellipse(pt(pomCenter.x - 0.07, pomCenter.y - 0.07), 0.08, 0.06), Pup.white(0.35));
  }

  function earmuffs(fr) {
    const t = fr.turn;
    const f = { x: S(t), z: C(t) }, l = { x: C(t), z: -S(t) };
    const setBack = 0.06;
    const point = (theta, r, rise = 1) => {
      const x = r * C(theta) * l.x - setBack * f.x;
      const z = r * C(theta) * l.z - setBack * f.z;
      return { p: pt(x, -r * rise * S(theta) * skullRY), z };
    };
    const low = 0.42;
    const points = [];
    for (let i = 0; i <= 48; i++) points.push(point(low + ((Math.PI - 2 * low) * i) / 48, 1.0, 1.05));
    const frontPoints = points.filter((q) => q.z >= 0).map((q) => q.p);
    const backPoints = points.filter((q, i) =>
      q.z < 0
      || (i > 0 && points[i - 1].z < 0) || (i > 1 && points[i - 2].z < 0)
      || (i + 1 < points.length && points[i + 1].z < 0) || (i + 2 < points.length && points[i + 2].z < 0)
    ).map((q) => q.p);
    const front = new Pup.Path().addLines(frontPoints), back = new Pup.Path().addLines(backPoints);
    const r = 0.27;
    const muffs = [low - 0.06, Math.PI - low + 0.06].map((theta) => {
      const q = point(theta, 0.98);
      return { center: q.p, rx: r * (0.58 + 0.42 * Math.abs(f.x)), ry: r, front: q.z > -0.12 };
    });
    return { bandBack: back, bandFront: front, clearance: 0.14 * Math.abs(f.z), muffs };
  }

  function band(c, muffs, style, o) {
    const near = c.copy();
    near.clip(Pup.ellipse(pt(0, 0), skullRX + muffs.clearance + o, skullRY + muffs.clearance + o));
    const far = near.copy();
    far.clip(Pup.ellipse(pt(0, 0), skullRX, skullRY), true);
    const ink = { lineWidth: 0.14 + 2 * o, lineCap: 'butt', lineJoin: 'round' };
    const fill = { lineWidth: 0.14, lineCap: 'butt', lineJoin: 'round' };
    far.stroke(muffs.bandBack, css(style.ink), ink);
    near.stroke(muffs.bandFront, css(style.ink), ink);
    far.stroke(muffs.bandBack, css(style.outfitAccent), fill);
    near.stroke(muffs.bandFront, css(style.outfitAccent), fill);
  }

  function muff(c, m, style, o) {
    c.fill(Pup.ellipse(m.center, m.rx + o * 1.1, m.ry + o * 1.1), css(style.ink));
    c.fill(Pup.ellipse(m.center, m.rx, m.ry), css(style.outfitColor));
    c.fill(Pup.ellipse(pt(m.center.x - m.rx * 0.25, m.center.y - m.ry * 0.3), m.rx * 0.34, m.ry * 0.22), Pup.white(0.35));
  }

  const eyeInk = Pup.hex(0x24160e);
  const tongueColor = css(Pup.hex(0xf07a8c));

  function drawEye(c, e, f, style, lw) {
    const inner = -e.side, w = e.w;
    if (f.blush > 0.01) {
      const b = c.copy();
      b.opacity = 0.42 * f.blush * e.show;
      b.fill(Pup.ellipse(pt(e.x - inner * 0.1 * w, e.y + 0.26), 0.15 * w, 0.08), css(Pup.hex(0xff7882)));
    }
    const rx = 0.14 * w, ry = 0.185 * e.h;
    const ink = css(eyeInk);
    const stroke = { lineWidth: lw * 1.05, lineCap: 'round' };
    if (f.joy > 0.5) {
      const p = new Pup.Path();
      p.move(pt(e.x - rx, e.y + 0.03));
      p.addQuadCurve(pt(e.x + rx, e.y + 0.03), pt(e.x, e.y - 0.17 * e.h));
      c.stroke(p, ink, stroke);
    } else if (f.eyeOpen < 0.14) {
      const p = new Pup.Path();
      p.move(pt(e.x - rx, e.y));
      p.addQuadCurve(pt(e.x + rx, e.y), pt(e.x, e.y + 0.1 * e.h));
      c.stroke(p, ink, stroke);
    } else {
      const open = Math.min(1, f.eyeOpen), h = ry * open, cy = e.y + (1 - open) * 0.06;
      if (style.eyeRing) c.fill(Pup.ellipse(pt(e.x, cy), rx + 0.03, h + 0.03), css(style.eyeRing));
      const eye = Pup.ellipse(pt(e.x, cy), rx, h);
      c.fill(eye, ink);
      const g = c.copy();
      g.clip(eye);
      const k = (1 + f.brows * 0.35) * Math.max(0.6, w) * e.h;
      g.fill(Pup.ellipse(pt(e.x - rx * 0.32, cy - h * 0.38), 0.058 * k, 0.058 * k), '#fff');
      g.fill(Pup.ellipse(pt(e.x + rx * 0.35, cy + h * 0.35), 0.026 * k, 0.026 * k), '#fff');
    }
    if (f.brows > 0.02) {
      const by = e.y - 0.3;
      const b = c.copy();
      b.opacity = Math.min(1, f.brows * 1.4) * e.show;
      b.stroke(Pup.segment(pt(e.x + inner * 0.12 * w, by - 0.08 * f.brows), pt(e.x - inner * 0.1 * w, by + 0.02)), css(style.ink), { lineWidth: lw * 0.95, lineCap: 'round' });
    }
  }

  function drawMuzzle(c, L, style, f, lw, front) {
    const m = L.muzzle;
    const away = M.smooth(0.1, -0.4, m.vis);
    const muzzleColor = style.markingStyle === 'mask'
      ? Pup.mix(style.marking, style.body, 0.3 + 0.6 * away)
      : Pup.mix(style.cream, style.body, away);
    if (style.jowls) c.fill(jowls(L, 0), css(muzzleColor));
    c.fill(Pup.ellipse(pt(m.x, m.y), m.rx, m.ry), css(muzzleColor));
    if (style.jowls && front) {
      const crease = c.copy();
      crease.opacity = 0.5;
      crease.stroke(Pup.ellipse(pt(m.x, m.y), m.rx, m.ry).trimmedPath(0.08, 0.42), css(style.ink), { lineWidth: lw * 0.8 });
    }
    if (!front) return;
    const n = L.nose, mid = L.mouthMid, cs = L.corners;
    const ink = style.markingStyle === 'mask' ? css(Pup.darken(style.ink, 0.4)) : css(style.ink);
    const lineStyle = { lineWidth: lw, lineCap: 'round', lineJoin: 'round' };

    if (f.mouthOpen > 0.3 && cs.length && m.vis > 0.05) {
      const jaw = pt(mid.x, mid.y + 0.12 + f.mouthOpen * 0.24);
      const a = cs[0], b = cs[cs.length - 1];
      const mouth = new Pup.Path();
      mouth.move(mid);
      mouth.addQuadCurve(pt(a.x, a.y), pt((mid.x + a.x) / 2, mid.y + 0.07));
      mouth.addQuadCurve(jaw, pt(a.x + (jaw.x - a.x) * 0.25, jaw.y));
      if (cs.length === 2) {
        mouth.addQuadCurve(pt(b.x, b.y), pt(b.x + (jaw.x - b.x) * 0.25, jaw.y));
        mouth.addQuadCurve(mid, pt((mid.x + b.x) / 2, mid.y + 0.07));
      }
      mouth.closeSubpath();
      c.fill(mouth, css(Pup.hex(0x6b2330)));
      const hang = 0.17 * M.clamp((f.tongue - 0.3) / 0.7, 0, 1);
      const hw = 0.1, top = jaw.y - 0.13, bot = Math.max(jaw.y + hang, top + 2 * hw);
      const tonguePath = new Pup.Path().addRoundedRect({ x: jaw.x - hw, y: top, width: 2 * hw, height: bot - top }, hw);
      if (f.tongue > 0.02) {
        const inside = c.copy();
        inside.clip(mouth);
        inside.fill(tonguePath, tongueColor);
      }
      c.stroke(mouth, ink, lineStyle);
      if (hang > 0.01) {
        const below = c.copy();
        below.clip(Pup.rectPath({ x: jaw.x - 1, y: jaw.y - 0.01, width: 2, height: 1 }));
        below.fill(tonguePath, tongueColor);
        below.stroke(tonguePath, ink, { lineWidth: lw * 0.9 });
        c.stroke(Pup.segment(pt(jaw.x, jaw.y - 0.04), pt(jaw.x, bot - 0.06)), css(Pup.hex(0xaa3246), 0.55), { lineWidth: lw * 0.6 });
      }
    } else {
      const p = new Pup.Path();
      p.move(pt(n.x, n.y + 0.08));
      p.addLine(mid);
      for (const k of cs) {
        p.move(mid);
        p.addQuadCurve(pt(k.x, k.y), pt((mid.x + k.x) / 2, mid.y + 0.05 + f.smile * (f.smile < 0 ? 0.1 : 0.06)));
      }
      c.stroke(p, ink, lineStyle);
    }
    c.fill(Pup.ellipse(pt(n.x, n.y), n.rx, n.ry), css(style.nose));
    c.fill(Pup.ellipse(pt(n.x - n.rx * 0.3, n.y - n.ry * 0.35), n.rx * 0.35, n.ry * 0.25), Pup.white(0.55));
  }

  function toScreen(fr, local) {
    const t = Pup.T.concat(Pup.T.concat(Pup.T.scale(fr.radius, fr.radius), Pup.T.rotate(fr.roll)), Pup.T.translate(fr.center.x, fr.center.y));
    return Pup.T.apply(t, local);
  }
  function nosePoint(g, cam) {
    const fr = frame(g, cam), L = layout(fr, g);
    return toScreen(fr, pt(L.nose.x, L.nose.y - L.nose.ry));
  }
  function mouthPoint(g, cam) {
    const fr = frame(g, cam), L = layout(fr, g);
    return toScreen(fr, pt(L.mouthMid.x, L.mouthMid.y + 0.12));
  }

  Pup.Head = { frame, layout, outline, draw, nosePoint, mouthPoint };
})();
