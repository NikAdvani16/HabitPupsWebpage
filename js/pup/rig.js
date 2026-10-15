// The puppy's 3D toolkit, rig and look: PuppyMath, PuppyCamera, PuppyGeometry and
// PuppyStyle from the app, ported line for line. Vectors are [x, y, z]; matrices are three
// rows, as simd's M3(rows:).
(function () {
  const Pup = window.Pup;

  // ---- Vectors and matrices ---------------------------------------------------------------
  const V = (Pup.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    div: (a, b) => [a[0] / b[0], a[1] / b[1], a[2] / b[2]],
    neg: (a) => [-a[0], -a[1], -a[2]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    // matrix × vector, matrix × matrix, and a column (simd's m[i]).
    mv: (m, v) => [V.dot(m[0], v), V.dot(m[1], v), V.dot(m[2], v)],
    mm: (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j])),
    col: (m, j) => [m[0][j], m[1][j], m[2][j]],
  });

  const pitch = 0.3;
  const M = (Pup.M = {
    pitch,
    cosPitch: Math.cos(pitch),
    sinPitch: Math.sin(pitch),
    clamp: (x, lo, hi) => Math.min(Math.max(x, lo), hi),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (a, b, x) => {
      const t = M.clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    wrap: (a) => {
      let r = (a + Math.PI) % (2 * Math.PI);
      if (r < 0) r += 2 * Math.PI;
      return r - Math.PI;
    },
    norm: (v) => {
      const l = V.len(v);
      return l > 0 ? V.mul(v, 1 / l) : v;
    },
    yaw: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, -s], [0, 1, 0], [s, 0, c]]; },
    pitchM: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; },
    roll: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; },
  });

  // ---- Camera -------------------------------------------------------------------------------
  class Camera {
    constructor(origin, scale) { this.origin = origin; this.scale = scale; }
    get view() { return [0, M.sinPitch, M.cosPitch]; }
    point(p) {
      return { x: this.origin.x + p[0] * this.scale, y: this.origin.y - (p[1] * M.cosPitch - p[2] * M.sinPitch) * this.scale };
    }
    depth(p) { return p[2] * M.cosPitch + p[1] * M.sinPitch; }
    vector(d) { return { dx: d[0] * this.scale, dy: -(d[1] * M.cosPitch - d[2] * M.sinPitch) * this.scale }; }
    ellipse(c, a1, a2, a3) {
      const b1 = this.vector(a1), b2 = this.vector(a2), b3 = this.vector(a3);
      const A = b1.dx * b1.dx + b2.dx * b2.dx + b3.dx * b3.dx;
      const B = b1.dx * b1.dy + b2.dx * b2.dy + b3.dx * b3.dy;
      const C = b1.dy * b1.dy + b2.dy * b2.dy + b3.dy * b3.dy;
      const h = (A + C) / 2, d = Math.sqrt(((A - C) / 2) * ((A - C) / 2) + B * B);
      return new ScreenEllipse(this.point(c), Math.sqrt(Math.max(h + d, 1e-6)), Math.sqrt(Math.max(h - d, 1e-6)), 0.5 * Math.atan2(2 * B, A - C));
    }
  }
  class ScreenEllipse {
    constructor(center, rx, ry, rotation) { this.center = center; this.rx = rx; this.ry = ry; this.rotation = rotation; }
    path(grow = 0) { return Pup.ellipse(this.center, this.rx + grow, this.ry + grow, this.rotation); }
  }
  Pup.Camera = Camera;
  Pup.ScreenEllipse = ScreenEllipse;

  // ---- Pose ---------------------------------------------------------------------------------
  Pup.newPose = () => ({
    x: 0, z: 0, jump: 0, yaw: Math.PI / 2,
    bodyY: 0, pitch: 0, roll: 0, squash: 0, sit: 0, lie: 0,
    headYaw: 0, headPitch: 0, headRoll: 0, headDrop: 0,
    feet: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    tailUp: 0.7, tailCurl: 0.25, tailWag: [0, 0, 0, 0],
    earL: { flare: 0.35, swing: 0 }, earR: { flare: 0.35, swing: 0 },
    face: { eyeOpen: 1, joy: 0, smile: 0.5, mouthOpen: 0, tongue: 0, brows: 0, blush: 0 },
    feetFollow: 0, frontFollow: 0, treat: 0, treatLift: 0, coverEyes: 0,
  });
  Pup.copyPose = (p) => ({
    ...p,
    feet: p.feet.map((f) => f.slice()),
    tailWag: p.tailWag.slice(),
    earL: { ...p.earL }, earR: { ...p.earR },
    face: { ...p.face },
  });

  // ---- Geometry -----------------------------------------------------------------------------
  const HIPS = [[0.55, 0.85, 0.34], [0.55, 0.85, -0.34], [-0.55, 0.85, 0.34], [-0.55, 0.85, -0.34]];
  const PIVOT = [-0.55, 0.85, 0];

  class Geometry {
    constructor(p, style) {
      this.pose = p;
      this.style = style;
      this.yawM = M.yaw(p.yaw);
      this.prM = V.mm(M.pitchM(p.pitch), M.roll(p.roll));
      this.bodyM = V.mm(this.yawM, this.prM);
      this.root = [p.x, p.jump, p.z];
      this.sy = 1 + p.squash;
      this.sxz = 1 - p.squash * 0.5;
      this.bodyY = p.bodyY - p.sit * 0.4 - p.lie * 0.52 + (style.legLength - 1) * 0.42 * (1 - p.lie);
      this.headM = V.mm(V.mm(M.yaw(p.yaw + p.headYaw), M.pitchM(p.headPitch + p.pitch * 0.3 - p.lie * 0.12)), M.roll(p.headRoll + p.roll * 0.5));

      const neck = this.bodyPoint([0.62, 1.62, 0]);
      this.headCenter = V.add(V.add(neck, V.mv(this.headM, [0.2, 0.6, 0])), [0, -p.headDrop - p.lie * 0.32, 0]);

      this.feet = [];
      for (let leg = 0; leg < 4; leg++) {
        const hip = HIPS[leg];
        const front = leg === 0 || leg === 1;
        const s = leg === 0 || leg === 2 ? 1 : -1;
        let fx = hip[0] * style.bodyLength, fz = hip[2];
        if (front) { fx += -0.1 * p.sit + 0.7 * p.lie; } else { fx += 0.45 * p.sit + 0.25 * p.lie; fz += s * 0.22 * p.lie; }
        const o = p.feet[leg];
        let local = [fx + o[0], o[1], fz + o[2]];
        const follow = M.clamp(p.feetFollow + (front ? p.frontFollow : 0), 0, 1);
        if (follow > 0) {
          const pivotPoint = [PIVOT[0] * style.bodyLength, PIVOT[1] + this.bodyY, 0];
          const turned = V.add(V.mv(this.prM, V.sub(local, pivotPoint)), pivotPoint);
          local = V.add(local, V.mul(V.sub(turned, local), follow));
        }
        let foot = V.add(this.root, V.mv(this.yawM, local));
        if (front && p.coverEyes > 0) {
          // Peekaboo: the legs go up with the paws over the eyes, to under the chin.
          const underChin = V.add(this.headCenter, V.mv(this.yawM, [0.1, -0.3, s * 0.2]));
          const k = M.smooth(0, 0.6, p.coverEyes);
          foot = V.add(foot, V.mul(V.sub(underChin, foot), k));
        }
        if (front && o[1] > 0.3) {
          const hipPoint = this.bodyPoint([hip[0] * 0.95, hip[1] + 0.12, hip[2] * 0.85]);
          const ankle = V.add(foot, [0, 0.12, 0]);
          const reach = (0.85 + 0.42 * (style.legLength - 1)) * 1.12;
          const span = V.sub(ankle, hipPoint);
          const length = V.len(span);
          if (length > reach) foot = V.sub(V.add(hipPoint, V.mul(span, reach / length)), [0, 0.12, 0]);
        }
        this.feet.push(foot);
      }

      const tailUpN = M.clamp((p.tailUp + 0.5) / 1.4, 0, 1);
      let segments, segLength;
      switch (style.tail) {
        case 'stub': segments = 1; segLength = 0.16; break;
        case 'pom': segments = 3; segLength = 0.17; break;
        case 'curled': segments = 4; segLength = 0.21 - 0.05 * (1 - tailUpN); break;
        default: segments = 4; segLength = 0.21;
      }
      const tail = [this.bodyPoint([-0.86, 1.42, 0])];
      const perk = style.tail === 'curled' ? tailUpN : 0;
      const extraCurl = style.tail === 'curled' ? 0.5 * perk + 0.26 * (1 - perk) : 0;
      const lift = 0.7 * perk;
      for (let i = 0; i < segments; i++) {
        const e = p.tailUp + lift + i * (p.tailCurl + extraCurl), w = i < p.tailWag.length ? p.tailWag[i] : 0;
        const d = [-Math.cos(e) * Math.cos(w), Math.sin(e), Math.cos(e) * Math.sin(w)];
        tail.push(V.add(tail[i], V.mul(M.norm(this.bodyVector(d)), segLength)));
      }
      this.tail = tail;
    }

    bodyPoint(l) {
      const length = this.style.bodyLength;
      const pv = [PIVOT[0] * length, PIVOT[1], PIVOT[2]];
      let q = [l[0] * length * this.sxz, l[1] * this.sy, l[2] * this.sxz];
      q = V.add(V.mv(this.prM, V.sub(q, pv)), pv);
      q[1] += this.bodyY;
      return V.add(this.root, V.mv(this.yawM, q));
    }
    bodyVector(d) {
      return V.mv(this.bodyM, [d[0] * this.style.bodyLength * this.sxz, d[1] * this.sy, d[2] * this.sxz]);
    }
  }
  Pup.Geometry = Geometry;
  Pup.HIPS = HIPS;

  // ---- Style --------------------------------------------------------------------------------
  const OUTFIT_COLORS = [0xd8343e, 0x2fa39a, 0xe8b23a, 0x8e5bc4, 0x3f7fd1, 0xe8728f].map(Pup.hex);
  Pup.noOutfit = () => ({ hat: null, scarf: false, color: 0, accent: 0, collar: true, bandana: false, sunglasses: false, cape: false, nameTag: null });

  Pup.styleFor = (a, outfit = Pup.noOutfit()) => {
    const coat = a.coat;
    const dark = Pup.luminance(coat) < 0.25;
    const s = {
      body: coat,
      shade: Pup.darken(coat, 0.14),
      cream: a.accent,
      marking: a.marking,
      collar: a.collar,
      nose: Pup.hex(0x2e1e16),
      ink: dark ? Pup.hex(0x121116) : Pup.darken(coat, 0.72),
      eyeRing: dark ? Pup.lighten(coat, 0.28) : null,
      outfit,
    };
    s.ears = { floppy: 'floppy', longFloppy: 'long', tinyFolded: 'tiny', perked: 'perked', semiPerked: 'semiPerked', bat: 'bat' }[a.ears];
    s.curly = a.texture === 'curly';
    s.ear = s.curly
      ? Pup.darken(coat, 0.1)
      : a.ears === 'tinyFolded' && a.markingStyle === 'mask' && Pup.luminance(coat) > 0.5
        ? a.marking
        : a.markingStyle === 'tricolor'
          ? coat
          : (a.ears === 'longFloppy' || a.ears === 'floppy') && a.markingStyle !== 'spots'
            ? (a.id === 'golden' ? Pup.darken(coat, 0.16) : a.marking)
            : Pup.darken(coat, 0.1);
    s.tail = a.tail;
    s.markingStyle = {
      saddle: 'saddle',
      mask: Pup.luminance(coat) > 0.5 ? 'mask' : 'none',
      spots: 'spots', blaze: 'blaze', patchEye: 'patchEye', tricolor: 'tricolor', none: 'none', socks: 'none',
    }[a.markingStyle];
    s.bodyLength = Math.pow(a.bodyStretch, 0.6);
    s.legLength = a.legLength;
    s.snoutLength = Math.pow(a.snoutLength, 0.6);
    s.earScale = a.earScale;
    s.jowls = a.jowls;
    s.ruff = a.ruff;
    s.outfitColor = OUTFIT_COLORS[outfit.color % OUTFIT_COLORS.length];
    s.outfitAccent = OUTFIT_COLORS[outfit.accent % OUTFIT_COLORS.length];
    s.uprightEars = s.ears === 'perked' || s.ears === 'semiPerked' || s.ears === 'bat';
    return s;
  };
})();
