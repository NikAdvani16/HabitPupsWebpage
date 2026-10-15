// PuppyBody from the app, ported line for line: legs, torso, tail, markings, and the
// collar, bandana, scarf and cape.
(function () {
  const Pup = window.Pup, V = Pup.V, M = Pup.M;
  const pt = (x, y) => ({ x, y });
  const css = Pup.css;

  const legRadiusBase = 0.19;
  const legRadius = (style) => (style.curly ? 0.22 : legRadiusBase);

  function fleece(torso, scale, grow) {
    const p = new Pup.Path();
    const r = 0.15 * scale + grow;
    const cosR = Math.cos(torso.rotation), sinR = Math.sin(torso.rotation);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 2 * Math.PI + 0.2;
      const lx = torso.rx * Math.cos(a) * 0.97, ly = torso.ry * Math.sin(a) * 0.97;
      const c = pt(torso.center.x + lx * cosR - ly * sinR, torso.center.y + lx * sinR + ly * cosR);
      p.addEllipseIn({ x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r });
    }
    return p;
  }

  function ruff(L, scale, grow) {
    const p = new Pup.Path();
    const a = L.neck[0], b = L.neck[1];
    const c = pt(a.x + (b.x - a.x) * 0.35, a.y + (b.y - a.y) * 0.35);
    const ring = 0.5 * scale, r = 0.19 * scale + grow;
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * 2 * Math.PI + 0.3;
      const q = pt(c.x + ring * Math.cos(t), c.y + ring * 0.85 * Math.sin(t));
      p.addEllipseIn({ x: q.x - r, y: q.y - r, width: 2 * r, height: 2 * r });
    }
    return p;
  }

  const curls = [
    [0.2, 0.75, 0.62], [-0.35, 0.6, 0.72], [0.55, 0.35, 0.75], [-0.65, 0.25, 0.7],
    [0.0, 0.95, 0.3], [-0.3, 0.9, -0.3], [0.35, 0.8, -0.45], [-0.1, 0.3, 0.95],
    [0.3, 0.4, -0.85], [-0.55, 0.5, -0.65], [0.7, 0.55, 0.2], [-0.8, 0.5, 0.1],
  ];
  const spots = [
    [0.3, 0.7, 0.65], [-0.4, 0.55, 0.75], [-0.1, 0.9, -0.45], [0.5, 0.2, -0.85],
    [-0.6, 0.3, -0.7], [0.05, 0.4, 0.92], [-0.75, 0.6, 0.2], [0.6, 0.6, -0.4],
  ];

  function neckFrame(g, base, top, level) {
    const up = [0, 1, 0];
    let axis = M.norm(V.add(V.mul(M.norm(V.sub(top, base)), 1 - level), V.mul(up, level)));
    if (axis[1] < 0.6) axis = M.norm(V.add(axis, V.mul(up, (0.6 - axis[1]) * 2.5)));
    const sideRaw = V.mv(g.yawM, [0, 0, 1]);
    const side = M.norm(V.sub(sideRaw, V.mul(axis, V.dot(sideRaw, axis))));
    let forward = M.norm(V.cross(axis, side));
    if (V.dot(forward, V.mv(g.yawM, [1, 0, 0])) < 0) forward = V.neg(forward);
    return { axis, side, forward };
  }

  function layout(g, cam) {
    const facing = (d) => V.dot(M.norm(g.bodyVector(d)), cam.view);
    const torso = cam.ellipse(g.bodyPoint([0, 1.2, 0]), g.bodyVector([0.95, 0, 0]), g.bodyVector([0, 0.66, 0]), g.bodyVector([0, 0, 0.64]));

    const legs = [];
    for (let leg = 0; leg < 4; leg++) {
      const h = Pup.HIPS[leg];
      const vis = facing([h[0], 0, h[2] * 1.8]);
      const foot = g.feet[leg];
      const pawCenter = V.add(foot, V.mv(g.yawM, [0.06, 0.1, 0]));
      const lifted = g.pose.feet[leg][1] > 0.45 && vis > -0.3;
      legs.push({
        vis,
        near: M.smooth(-0.2, 0.2, vis),
        hip: cam.point(g.bodyPoint([h[0] * 0.95, h[1] + 0.12, h[2] * 0.85])),
        ankle: cam.point(V.add(foot, [0, 0.12, 0])),
        paw: cam.ellipse(pawCenter, V.mv(g.yawM, [0.22, 0, 0]), [0, 0.12, 0], V.mv(g.yawM, [0, 0, 0.19])),
        // Up on its hind legs (dancing), the front legs hang in front of the chest.
        raised: lifted || ((leg === 0 || leg === 1) && g.pose.frontFollow > 0.5 && vis > -0.3),
        overHead: lifted && (leg === 0 || leg === 1)
          && cam.depth(pawCenter) > cam.depth(g.headCenter) + 0.35
          && pawCenter[1] > g.headCenter[1] - 0.95,
      });
    }
    legs.sort((a, b) => a.vis - b.vis);

    const haunch = 0.72 + 0.28 * g.pose.sit;
    const thighs = [1, -1].map((s) => ({
      vis: facing([0, 0, s]),
      ellipse: cam.ellipse(g.bodyPoint([-0.48, 0.98, s * 0.34]), g.bodyVector([0.42 * haunch, 0, 0]), g.bodyVector([0, 0.44 * haunch, 0]), g.bodyVector([0, 0, 0.28 * haunch])),
    }));
    const neckTop = V.add(g.headCenter, V.mv(g.headM, [-0.1, -0.4, 0]));

    function neckRing(along, drop, radius, level = 0) {
      const base = g.bodyPoint([0.5, 1.4, 0]);
      const { side, forward } = neckFrame(g, base, neckTop, level);
      const center = V.add(V.add(base, V.mul(V.sub(neckTop, base), along)), [0, -drop, 0]);
      const point = (a) => cam.point(V.add(center, V.mul(V.add(V.mul(forward, Math.cos(a)), V.mul(side, Math.sin(a))), radius)));
      const phi = Math.atan2(V.dot(side, cam.view), V.dot(forward, cam.view));
      const arc = (a, b) => {
        const p = new Pup.Path();
        p.move(point(a));
        for (let i = 1; i <= 24; i++) p.addLine(point(a + ((b - a) * i) / 24));
        return p;
      };
      return { near: arc(phi - Math.PI / 2, phi + Math.PI / 2), far: arc(phi + Math.PI / 2, phi + 1.5 * Math.PI), center, forward, side };
    }

    const outfit = g.style.outfit;
    let collar = null;
    if (outfit.collar && !outfit.scarf) {
      const radius = 0.44;
      const ring = neckRing(0.25, 0.02, radius, 0.4);
      const top = V.add(ring.center, V.mul(ring.forward, radius + 0.02));
      const mid = V.add(V.add(top, [0, -0.15, 0]), V.mul(ring.forward, 0.03));
      const tag = cam.ellipse(mid, V.mul(ring.side, 0.13), [0, 0.13, 0], V.mul(ring.forward, 0.02));
      let bandana = null;
      if (outfit.bandana && V.dot(ring.forward, cam.view) > -0.25) {
        const onRing = (a) => V.add(ring.center, V.mul(V.add(V.mul(ring.forward, Math.cos(a)), V.mul(ring.side, Math.sin(a))), radius + 0.03));
        const tip = V.add(V.add(ring.center, V.mul(ring.forward, radius + 0.12)), [0, -0.5, 0]);
        const p = new Pup.Path();
        p.move(cam.point(onRing(-1.15)));
        p.addQuadCurve(cam.point(onRing(1.15)), cam.point(V.add(onRing(0), [0, -0.06, 0])));
        p.addQuadCurve(cam.point(tip), cam.point(V.add(V.add(onRing(0.7), [0, -0.32, 0]), V.mul(ring.forward, 0.08))));
        p.addQuadCurve(cam.point(onRing(-1.15)), cam.point(V.add(V.add(onRing(-0.7), [0, -0.32, 0]), V.mul(ring.forward, 0.08))));
        p.closeSubpath();
        bandana = p;
      }
      const headDown = M.norm(V.sub(neckTop, g.bodyPoint([0.5, 1.4, 0])))[1] < 0.35;
      collar = {
        near: ring.near, far: ring.far, tag,
        tagShows: V.dot(ring.forward, cam.view) > 0.05,
        bandana,
        behindBody: headDown && facing([1, 0, 0]) < -0.2,
      };
    }

    let cape = null;
    if (outfit.cape) {
      const ring = neckRing(0.1, 0.02, 0.46, 0.65);
      const flutter = g.pose.tailWag[0] || 0;
      const up = [0, 1, 0];
      const tieL = V.sub(V.add(ring.center, V.mul(ring.side, 0.34)), V.mul(ring.forward, 0.1));
      const tieR = V.sub(V.sub(ring.center, V.mul(ring.side, 0.34)), V.mul(ring.forward, 0.1));
      const shoulderL = g.bodyPoint([0.25, 1.8, 0.56]), shoulderR = g.bodyPoint([0.25, 1.8, -0.56]);
      const hemL = V.add(g.bodyPoint([-1.25, 1.2, 0.98]), V.mul(up, 0.05 * flutter));
      const hemR = V.sub(g.bodyPoint([-1.25, 1.2, -0.98]), V.mul(up, 0.05 * flutter));
      const hemMid = V.add(g.bodyPoint([-1.62, 1.45, 0]), V.mul(up, 0.08 * flutter));
      const p = (v) => cam.point(v);
      const path = new Pup.Path();
      path.move(p(tieL));
      path.addQuadCurve(p(shoulderL), p(V.add(V.add(tieL, V.mul(V.sub(shoulderL, tieL), 0.5)), V.mul(up, 0.08))));
      path.addQuadCurve(p(hemL), p(g.bodyPoint([-0.45, 1.98, 0.92])));
      path.addQuadCurve(p(hemMid), p(V.add(g.bodyPoint([-1.62, 1.12, 0.52]), V.mul(up, 0.06 * flutter))));
      path.addQuadCurve(p(hemR), p(V.sub(g.bodyPoint([-1.62, 1.12, -0.52]), V.mul(up, 0.06 * flutter))));
      path.addQuadCurve(p(shoulderR), p(g.bodyPoint([-0.45, 1.98, -0.92])));
      path.addQuadCurve(p(tieR), p(V.add(V.add(tieR, V.mul(V.sub(shoulderR, tieR), 0.5)), V.mul(up, 0.08))));
      path.addQuadCurve(p(tieL), p(V.add(V.sub(ring.center, V.mul(ring.forward, 0.42)), V.mul(up, 0.08))));
      path.closeSubpath();
      const hem = new Pup.Path();
      hem.move(p(hemL));
      hem.addQuadCurve(p(hemMid), p(V.add(g.bodyPoint([-1.62, 1.12, 0.52]), V.mul(up, 0.06 * flutter))));
      hem.addQuadCurve(p(hemR), p(V.sub(g.bodyPoint([-1.62, 1.12, -0.52]), V.mul(up, 0.06 * flutter))));
      cape = { path, hem, behind: facing([1, -0.2, 0]) > 0.3 };
    }

    let scarf = null;
    if (outfit.scarf) {
      const base = g.bodyPoint([0.5, 1.4, 0]);
      const { side, forward } = neckFrame(g, base, neckTop, 0);
      const center = V.add(V.add(base, V.mul(V.sub(neckTop, base), 0.02)), [0, -0.04, 0]);
      const radius = 0.46;
      const point = (a) => cam.point(V.add(center, V.mul(V.add(V.mul(forward, Math.cos(a)), V.mul(side, Math.sin(a))), radius)));
      const phi = Math.atan2(V.dot(side, cam.view), V.dot(forward, cam.view));
      const arc = (a, b) => {
        const p = new Pup.Path();
        p.move(point(a));
        for (let i = 1; i <= 24; i++) p.addLine(point(a + ((b - a) * i) / 24));
        return p;
      };
      const start = V.add(V.add(center, V.mul(forward, 0.42)), V.mul(side, 0.2));
      const end = V.add(V.add(start, [0, -0.46, 0]), V.mul(forward, 0.06));
      scarf = {
        near: arc(phi - Math.PI / 2, phi + Math.PI / 2),
        far: arc(phi + Math.PI / 2, phi + 1.5 * Math.PI),
        end: [cam.point(start), cam.point(end)],
        endInFront: V.dot(forward, cam.view) > -0.15,
      };
    }

    return {
      torso, legs, thighs,
      tail: g.tail.map((v) => cam.point(v)),
      tailVis: facing([-1, 0.5, 0]),
      tailDroop: M.smooth(0.15, -0.5, g.pose.tailUp),
      bib: cam.ellipse(g.bodyPoint([0.62, 1.05, 0]), g.bodyVector([0.32, 0, 0]), g.bodyVector([0, 0.44, 0]), g.bodyVector([0, 0, 0.42])),
      bibVis: facing([1, -0.15, 0]),
      neck: [cam.point(g.bodyPoint([0.5, 1.4, 0])), cam.point(neckTop)],
      scarf, collar, cape,
    };
  }

  function tailRadii(style) {
    switch (style.tail) {
      case 'plume': return [0.19, 0.18, 0.16, 0.13];
      case 'straight': return [0.15, 0.13, 0.11, 0.09];
      case 'curled': return [0.14, 0.13, 0.11, 0.09];
      case 'stub': return [0.15];
      case 'pom': return [0.09, 0.08, 0.08];
    }
    return [0.15];
  }

  function strokeSegment(c, a, b, width, color) {
    c.stroke(Pup.segment(a, b), color, { lineWidth: width, lineCap: 'round' });
  }

  function tail(c, L, style, scale, grow, ink) {
    const radii = tailRadii(style);
    const tip = css(Pup.mix(style.cream, style.body, L.tailDroop));
    for (let i = 0; i < L.tail.length - 1; i++) {
      const last = i === L.tail.length - 2;
      const color = ink || (last && style.tail !== 'stub' ? tip : css(style.body));
      const n = Math.max(1, L.tail.length - 2);
      const taper = style.tail === 'stub' ? 1 : 1 - (0.45 * L.tailDroop * i) / n;
      strokeSegment(c, L.tail[i], L.tail[i + 1], 2 * radii[Math.min(i, radii.length - 1)] * scale * taper + grow * 2, color);
    }
    if (style.tail === 'pom' && L.tail.length) {
      const tipP = L.tail[L.tail.length - 1];
      const r = 0.2 * scale + grow;
      c.fill(Pup.ellipse(tipP, r, r), ink || css(style.cream));
    }
  }

  function outline(ctx, g, cam, ow) {
    const L = layout(g, cam), s = cam.scale, ink = css(g.style.ink);
    ctx.fill(L.torso.path(ow), ink);
    if (g.style.curly || g.style.ruff) ctx.fill(fleece(L.torso, s, ow), ink);
    for (const t of L.thighs) ctx.fill(t.ellipse.path(ow), ink);
    strokeSegment(ctx, L.neck[0], L.neck[1], 0.84 * s + ow * 2, ink);
    if (g.style.ruff) ctx.fill(ruff(L, s, ow), ink);
    for (const l of L.legs) {
      strokeSegment(ctx, l.hip, l.ankle, 2 * legRadius(g.style) * s + ow * 2, ink);
      ctx.fill(l.paw.path(ow), ink);
    }
    tail(ctx, L, g.style, s, ow, ink);
  }

  const scarfTube = 0.27;
  const collarBandWidth = 0.15;
  const tagGold = Pup.hex(0xf4c443);
  const capeRed = Pup.hex(0xd8343e);

  function draw(ctx, g, cam, ow) {
    const L = layout(g, cam), s = cam.scale, style = g.style;

    function leg(l) {
      strokeSegment(ctx, l.hip, l.ankle, 2 * legRadius(style) * s, css(Pup.mix(style.shade, style.body, l.near)));
      if (style.markingStyle === 'tricolor') {
        const knee = pt(l.hip.x + (l.ankle.x - l.hip.x) * 0.5, l.hip.y + (l.ankle.y - l.hip.y) * 0.5);
        strokeSegment(ctx, knee, l.ankle, 2 * legRadius(style) * s, css(Pup.darken(style.marking, 0.25 * (1 - l.near))));
      }
      ctx.fill(l.paw.path(), css(Pup.mix(style.shade, style.cream, l.near)));
    }
    for (const l of L.legs) if (!l.raised) leg(l);
    if (L.tailVis < 0) tail(ctx, L, style, s, 0, null);

    if (L.scarf) scarfLoop(ctx, L.scarf.far, style, s, ow);
    const neckAndBody = L.torso.path(ow * 0.5);
    const neckMid = pt((L.neck[0].x + L.neck[1].x) / 2, (L.neck[0].y + L.neck[1].y) / 2);
    const neckLength = Math.hypot(L.neck[1].x - L.neck[0].x, L.neck[1].y - L.neck[0].y);
    neckAndBody.addPath(Pup.ellipse(neckMid, 0.42 * s + ow * 0.5, neckLength / 2 + 0.42 * s,
      Math.atan2(L.neck[1].x - L.neck[0].x, -(L.neck[1].y - L.neck[0].y))));
    if (L.cape && L.cape.behind) drawCape(ctx, L.cape, ow);
    strokeSegment(ctx, L.neck[0], L.neck[1], 0.84 * s, css(style.body));
    if (L.collar && L.collar.behindBody) {
      const behind = ctx.copy();
      behind.clip(neckAndBody);
      drawCollar(behind, L.collar, style, s, ow);
    }
    for (const t of L.thighs) ctx.fill(t.ellipse.path(), css(style.body));
    if (style.curly || style.ruff) ctx.fill(fleece(L.torso, s, 0), css(style.body));
    const e = L.torso, m = Math.max(e.rx, e.ry);
    const torsoPath = e.path();
    ctx.fill(torsoPath, css(style.body));
    const inside = ctx.copy();
    inside.clip(torsoPath);
    inside.fill(torsoPath, css(style.shade));
    inside.fill(Pup.ellipse(pt(e.center.x - m * 0.07, e.center.y - m * 0.11), e.rx, e.ry, e.rotation), css(style.body));
    if (style.markingStyle === 'saddle') {
      const saddle = cam.ellipse(g.bodyPoint([-0.1, 1.55, 0]), g.bodyVector([0.72, 0, 0]), g.bodyVector([0, 0.36, 0]), g.bodyVector([0, 0, 0.6]));
      inside.fill(saddle.path(), css(style.marking));
    } else if (style.markingStyle === 'spots') {
      const radii = [0.95, 0.66, 0.64];
      for (const d of spots) {
        const dir = M.norm(d);
        const n = M.norm(g.bodyVector(V.div(dir, radii)));
        const face = V.dot(n, cam.view);
        if (face <= 0.1) continue;
        const t1 = M.norm(V.cross(n, [0, 1, 0])), t2 = V.cross(n, t1);
        const spot = cam.ellipse(g.bodyPoint(V.add([0, 1.2, 0], [dir[0] * radii[0], dir[1] * radii[1], dir[2] * radii[2]])), V.mul(t1, 0.11), V.mul(t2, 0.09), V.mul(n, 0.01));
        inside.fill(spot.path(), css(style.marking));
      }
    }
    if (style.curly) {
      const radii = [0.95, 0.66, 0.64];
      curls.forEach((d, i) => {
        const dir = M.norm(d);
        const n = M.norm(g.bodyVector(V.div(dir, radii)));
        const face = V.dot(n, cam.view);
        if (face <= 0.2) return;
        const c = cam.point(g.bodyPoint(V.add([0, 1.2, 0], [dir[0] * radii[0], dir[1] * radii[1], dir[2] * radii[2]])));
        const r = 0.075 * s * (0.6 + 0.4 * face);
        const start = (i % 4) * 0.9;
        const curl = new Pup.Path().addArc(c, r, start, start + 4.2, false);
        const mark = inside.copy();
        mark.opacity = M.smooth(0.2, 0.45, face);
        mark.stroke(curl, css(style.shade), { lineWidth: Math.max(0.8, 0.028 * s), lineCap: 'round' });
      });
    }
    if (L.bibVis > -0.1) {
      const bib = inside.copy();
      bib.opacity = M.smooth(-0.1, -0.02, L.bibVis) * (1 - g.pose.lie);
      bib.fill(L.bib.path(), css(style.cream));
    }

    if (style.ruff) ctx.fill(ruff(L, s, 0), css(style.body));
    if (L.scarf) drawScarf(ctx, L.scarf, style, s, ow);
    if (L.cape && !L.cape.behind) drawCape(ctx, L.cape, ow);
    if (L.collar && !L.collar.behindBody) {
      const c = ctx.copy();
      c.clip(neckAndBody);
      drawCollar(c, L.collar, style, s, ow);
    }

    for (const l of L.legs) {
      if (!(l.raised && !l.overHead)) continue;
      strokeSegment(ctx, l.hip, l.ankle, 2 * legRadius(style) * s + ow * 2, css(style.ink));
      ctx.fill(l.paw.path(ow), css(style.ink));
      leg(l);
    }
    if (L.tailVis >= 0) {
      if (style.tail !== 'stub') tail(ctx, L, style, s, ow, css(style.ink));
      tail(ctx, L, style, s, 0, null);
    }
  }

  function nameTag(ctx, t, initial, style, ow) {
    const w = t.rx * 2.6, h = t.ry * 1.25;
    const c = pt(t.center.x, t.center.y + t.ry * 0.15);
    const bone = new Pup.Path();
    bone.addRoundedRect({ x: c.x - w * 0.36, y: c.y - h * 0.3, width: w * 0.72, height: h * 0.6 }, h * 0.2);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const r = h * 0.27;
      const p = pt(c.x + sx * w * 0.38, c.y + sy * h * 0.22);
      bone.addEllipseIn({ x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r });
    }
    ctx.fillStroked(bone, css(style.ink), { lineWidth: ow * 2, lineJoin: 'round' });
    ctx.fill(bone, css(tagGold));
    if (h <= 9) return;
    ctx.text(initial, c, h * 0.62, css(style.ink));
  }

  function collarBand(ctx, path, style, s, ow) {
    const w = collarBandWidth * s;
    ctx.stroke(path, css(style.ink), { lineWidth: w + ow * 2, lineCap: 'butt', lineJoin: 'round' });
    ctx.stroke(path, css(style.collar), { lineWidth: w, lineCap: 'butt', lineJoin: 'round' });
  }

  function drawCape(ctx, cape, ow) {
    ctx.stroke(cape.path, css(Pup.hex(0x3a1418)), { lineWidth: ow * 2, lineJoin: 'round' });
    ctx.fill(cape.path, css(cape.behind ? Pup.darken(capeRed, 0.22) : capeRed));
    const lining = ctx.copy();
    lining.clip(cape.path);
    lining.stroke(cape.hem, css(tagGold), { lineWidth: ow * 3, lineCap: 'round' });
  }

  function drawCollar(ctx, collar, style, s, ow) {
    collarBand(ctx, collar.near, style, s, ow);
    if (collar.bandana) {
      const bandana = collar.bandana;
      ctx.fillStroked(bandana, css(style.ink), { lineWidth: ow * 2, lineJoin: 'round' });
      ctx.fill(bandana, css(Pup.hex(0xd8433b)));
      const dots = ctx.copy();
      dots.clip(bandana);
      const box = bandana.boundingRect();
      const r = Math.max(0.8, box.width * 0.045);
      let row = 0, y = box.minY + r * 2;
      const spotsPath = new Pup.Path();
      while (y < box.maxY) {
        let x = box.minX + (row % 2 === 0 ? r * 2 : r * 4.5);
        while (x < box.maxX) {
          spotsPath.addEllipseIn({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });
          x += r * 5;
        }
        y += r * 4;
        row += 1;
      }
      dots.fill(spotsPath, Pup.white(0.9));
    }
    if (!collar.tagShows) return;
    if (style.outfit.nameTag) {
      nameTag(ctx, collar.tag, style.outfit.nameTag, style, ow);
      return;
    }
    const t = collar.tag;
    ctx.fill(t.path(ow), css(style.ink));
    ctx.fill(t.path(), css(tagGold));
    const r = Math.max(t.rx, t.ry);
    ctx.fill(Pup.ellipse(pt(t.center.x - t.rx * 0.38, t.center.y - t.ry * 0.42), t.rx * 0.28, t.ry * 0.18), Pup.white(0.5));
    if (r <= 6) return;
    const tick = new Pup.Path();
    tick.move(pt(t.center.x - t.rx * 0.42, t.center.y + t.ry * 0.02));
    tick.addLine(pt(t.center.x - t.rx * 0.1, t.center.y + t.ry * 0.34));
    tick.addLine(pt(t.center.x + t.rx * 0.45, t.center.y - t.ry * 0.34));
    ctx.stroke(tick, css(style.ink), { lineWidth: Math.max(1, r * 0.2), lineCap: 'round', lineJoin: 'round' });
  }

  function scarfLoop(ctx, path, style, s, ow) {
    const tube = scarfTube * s;
    ctx.stroke(path, css(style.ink), { lineWidth: tube + ow * 2, lineCap: 'round', lineJoin: 'round' });
    ctx.stroke(path, css(style.outfitColor), { lineWidth: tube, lineCap: 'round', lineJoin: 'round' });
    ctx.stroke(path.offsetBy(0, tube * 0.26), css(Pup.darken(style.outfitColor, 0.16)), { lineWidth: tube * 0.4, lineCap: 'round', lineJoin: 'round' });
  }

  function drawScarf(ctx, scarf, style, s, ow) {
    scarfLoop(ctx, scarf.near, style, s, ow);
    if (!scarf.endInFront) return;
    const width = 0.24 * s;
    strokeSegment(ctx, scarf.end[0], scarf.end[1], width + ow * 2, css(style.ink));
    strokeSegment(ctx, scarf.end[0], scarf.end[1], width, css(style.outfitColor));
    for (const u of [0.55, 0.75]) {
      const p = pt(scarf.end[0].x + (scarf.end[1].x - scarf.end[0].x) * u, scarf.end[0].y + (scarf.end[1].y - scarf.end[0].y) * u);
      ctx.stroke(Pup.segment(pt(p.x - width * 0.5, p.y), pt(p.x + width * 0.5, p.y)), css(style.outfitAccent), { lineWidth: width * 0.22 });
    }
  }

  function drawOverHead(ctx, g, cam, ow) {
    if (!(g.pose.feet[0][1] > 0.45 || g.pose.feet[1][1] > 0.45)) return;
    const L = layout(g, cam), s = cam.scale, style = g.style;
    for (const l of L.legs) {
      if (!l.overHead) continue;
      strokeSegment(ctx, l.hip, l.ankle, 2 * legRadius(style) * s + ow * 2, css(style.ink));
      ctx.fill(l.paw.path(ow), css(style.ink));
      strokeSegment(ctx, l.hip, l.ankle, 2 * legRadius(style) * s, css(Pup.mix(style.shade, style.body, l.near)));
      ctx.fill(l.paw.path(), css(Pup.mix(style.shade, style.cream, l.near)));
    }
  }

  const depth = (g, cam) => cam.depth(g.bodyPoint([0, 1.2, 0]));

  Pup.Body = { outline, draw, drawOverHead, depth };
})();
