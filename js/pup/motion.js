// The app's motion engine (Puppy, PuppyClip, PuppySpring, PuppyEase), ported line for line:
// a mood's held attitude, additive hand-keyed clips on top, and springs for follow-through.
(function () {
  const Pup = window.Pup, V = Pup.V, M = Pup.M;

  const Ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };

  // A clip's value on a channel at time t: keys ease into their values.
  function clipValue(clip, channel, t) {
    const keys = clip.tracks[channel];
    if (!keys || !keys.length) return null;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1][0]) {
        const a = keys[i], b = keys[i + 1];
        const u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * Ease[b[2]](u);
      }
    }
    return keys[keys.length - 1][1];
  }

  class Spring {
    constructor(x = 0, k = 120, d = 12) { this.x = x; this.v = 0; this.k = k; this.d = d; }
    step(target, dt) {
      const a = (target - this.x) * this.k - this.v * this.d;
      this.v += a * dt;
      this.x += this.v * dt;
      return this.x;
    }
    kick(impulse) { this.v += impulse; }
  }

  const ATTITUDE = {
    happy: { sit: 0, lie: 0, tailUp: 0.95, tailCurl: 0.3, wag: 0.75, wagHz: 3.4, flare: 0.45, swing: 0.15, smile: 1, mouthOpen: 0.42, tongue: 1, eyeOpen: 1, brows: 0, blush: 0.7, headPitch: 0.08, headDrop: 0, look: 0.6, pant: 1, bob: 0.08 },
    content: { sit: 1, lie: 0, tailUp: 0.55, tailCurl: 0.25, wag: 0.3, wagHz: 1.3, flare: 0.32, swing: 0, smile: 0.7, mouthOpen: 0.04, tongue: 0, eyeOpen: 0.92, brows: 0, blush: 0.35, headPitch: 0, headDrop: 0, look: 0.5, pant: 0, bob: 0.05 },
    eager: { sit: 0, lie: 0, tailUp: 0.85, tailCurl: 0.3, wag: 0.55, wagHz: 2.8, flare: 0.6, swing: 0.25, smile: 0.55, mouthOpen: 0.22, tongue: 0.35, eyeOpen: 1, brows: 0, blush: 0.2, headPitch: 0.12, headDrop: 0, look: 1, pant: 0.5, bob: 0.07 },
    sad: { sit: 1, lie: 0, tailUp: -1.15, tailCurl: 0.12, wag: 0.03, wagHz: 0.6, flare: 0.16, swing: -0.22, smile: -0.6, mouthOpen: 0, tongue: 0, eyeOpen: 0.95, brows: 0.9, blush: 0, headPitch: -0.28, headDrop: 0.12, look: 0.25, pant: 0, bob: 0.02 },
    gloomy: { sit: 0, lie: 1, tailUp: -0.55, tailCurl: 0.1, wag: 0, wagHz: 0.4, flare: 0.12, swing: -0.3, smile: -0.35, mouthOpen: 0, tongue: 0, eyeOpen: 0.35, brows: 0.6, blush: 0, headPitch: -0.15, headDrop: 0, look: 0.1, pant: 0, bob: 0.015 },
  };

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pickWeighted = (options) => {
    const total = options.reduce((s, o) => s + o[1], 0);
    let r = Math.random() * total;
    for (const o of options) { r -= o[1]; if (r <= 0) return o[0]; }
    return options.length ? options[options.length - 1][0] : null;
  };

  const grabHeight = 0.3, dropHeight = 0.6;

  class Puppy {
    constructor(mood, yaw = Math.PI / 2, style, seed = 1) {
      this.mood = mood;
      this.base = { ...ATTITUDE[mood] };
      this.clips = [];
      this.faceYaw = yaw;
      this.yaw = yaw;
      this.rest = 'auto';
      this.forceSit = false;
      this.lookBias = 0;
      this.autoIdle = true;
      this.tricks = [];
      this.showOff = false;
      this.dramatic = false;
      this.lifted = false;
      this.holding = false;
      this.liftY = 0;
      this.liftV = 0;
      this.blinks = true;
      this.steerYaw = null;
      this.steerSpeed = 0;
      this.moveSpeed = 0;
      this.turnRate = 0;
      this.gait = 0;
      this.gaitPhase = 0;
      this.wagPhase = 0;
      this.time = (seed % 1000) * 0.37;
      this.blinkTimer = rand(2, 5);
      this.blink = 0;
      this.idleTimer = rand(2, 6);
      this.flareL = new Spring(0.3, 170, 7); this.flareR = new Spring(0.3, 170, 7);
      this.swingL = new Spring(0, 150, 7); this.swingR = new Spring(0, 150, 7);
      this.headYawSpring = new Spring(0, 70, 14);
      this.previousHead = null;
      this.previousHeadVelocity = [0, 0, 0];
      this.style = style;
      this.pose = Pup.newPose();
    }

    get isBusy() { return this.clips.length > 0; }
    get playingClip() { return this.clips.length ? this.clips[this.clips.length - 1].name : null; }

    setMood(m) {
      if (m === this.mood) return;
      this.mood = m;
      this.idleTimer = rand(1.5, 3.5);
    }

    play(name) {
      const clip = window.PupData.clips[name];
      if (!clip) return;
      this.clips = [{ name, clip, t: 0 }];
      this.idleTimer = rand(3, 6);
    }

    steer(yaw, speed) {
      this.steerYaw = yaw;
      this.steerSpeed = yaw == null ? 0 : speed;
    }

    settle(seconds = 3) {
      const wasBlinking = this.blinks, wasIdle = this.autoIdle;
      this.blinks = false;
      this.autoIdle = false;
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) this.update(1 / 60);
      this.blinks = wasBlinking;
      this.autoIdle = wasIdle;
    }

    update(rawDT) {
      const dt = Math.min(0.05, Math.max(0, rawDT));
      this.time += dt;
      const k = 1 - Math.exp(-dt * 3.2);
      const target = ATTITUDE[this.mood];
      for (const key in this.base) this.base[key] += (target[key] - this.base[key]) * k;
      const b = { ...this.base };
      switch (this.rest) {
        case 'stand': b.sit = 0; b.lie = 0; break;
        case 'sit': b.sit = Math.max(b.sit, 1 - b.lie); break;
        case 'lie': case 'sleep': b.lie = 1; b.sit = 0; break;
      }
      if (this.rest === 'sleep') { b.eyeOpen = 0; b.look = 0; b.wag = 0; b.mouthOpen = 0; }

      // Clips.
      const add = {};
      this.clips = this.clips.filter((p) => {
        p.t += dt;
        for (const channel in p.clip.tracks) {
          add[channel] = (add[channel] || 0) + (clipValue(p.clip, channel, Math.min(p.t, p.clip.duration)) || 0);
        }
        return p.t < p.clip.duration;
      });
      const A = (c) => add[c] || 0;

      // Idle actions, chosen by mood.
      if (this.autoIdle && !this.lifted && this.liftY <= 0 && this.steerYaw == null && !this.clips.length && this.rest !== 'sleep') {
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          const trickWeight = this.showOff ? 3.5 : 1;
          let options;
          switch (this.mood) {
            case 'happy': options = [['wiggle', 3], ['headTilt', 2], ['hop', 1], ['playBow', 1.5]].concat(this.tricks.map((t) => [t, 1.2 * trickWeight])); break;
            case 'content': options = [['headTilt', 2], ['yawn', 1], ['shake', 1], ['sniff', 1]].concat(this.tricks.map((t) => [t, this.showOff ? 1.5 : 0.4])); break;
            case 'eager': options = [['bark', 3], ['pawLift', 3], ['headTilt', 1], ['hop', 1]].concat(this.tricks.map((t) => [t, 1 * trickWeight])); break;
            case 'sad': options = [['sigh', 3], ['glanceUp', 1]].concat(this.dramatic ? [['flop', 0.7], ['sigh', 2]] : []); break;
            default: options = [['sigh', 2], ['glanceUp', 1]].concat(this.dramatic ? [['flop', 0.5]] : []);
          }
          const pick = pickWeighted(options);
          if (pick) this.play(pick);
          this.idleTimer = rand(3, 6);
        }
      }

      // Turning + gait.
      const desiredYaw = this.steerYaw != null ? this.steerYaw : this.faceYaw;
      const err = M.wrap(desiredYaw - this.yaw);
      const wantRate = M.clamp(err * 5, -4.5, 4.5);
      this.turnRate += (wantRate - this.turnRate) * (1 - Math.exp(-dt * 10));
      this.yaw += this.turnRate * dt;
      const speed = this.steerYaw == null ? 0 : this.steerSpeed * M.clamp(Math.cos(err), 0.2, 1);
      this.moveSpeed += (speed - this.moveSpeed) * (1 - Math.exp(-dt * 6));

      const stride = 0.2 + 0.05 * M.clamp(this.moveSpeed, 0, 2);
      const gaitDrive = Math.max(this.moveSpeed, Math.abs(this.turnRate) * 0.45);
      const gaitTarget = M.clamp(gaitDrive / 0.35, 0, 1);
      this.gait += (gaitTarget - this.gait) * (1 - Math.exp(-dt * 8));
      const omega = (Math.max(gaitDrive, 0.35) * Math.PI) / (2 * stride);
      if (this.gait > 0.01) this.gaitPhase += omega * dt;
      const g = this.gait, ph = this.gaitPhase;
      const standUp = M.clamp(1 - g * 1.5, 0, 1);

      // Assemble the pose.
      const p = Pup.copyPose(this.pose);
      p.x = 0;
      p.z = 0;
      p.yaw = this.yaw + A('yaw');
      if (this.lifted) {
        this.liftV += ((0.9 - this.liftY) * 70 - this.liftV * 11) * dt;
      } else if (this.liftY > 0 || this.liftV > 0) {
        this.liftV -= 24 * dt;
      }
      this.liftY += this.liftV * dt;
      if (!this.lifted && this.liftY <= 0) {
        if (this.liftV < -1.5) this.play('land');
        this.liftY = 0;
        this.liftV = 0;
      }
      const carried = M.clamp(this.liftY / 0.9, 0, 1);
      p.jump = Math.max(0, A('jump')) + this.liftY;
      const sitBase = this.forceSit ? 1 - b.lie : b.sit;
      p.sit = M.clamp(sitBase * standUp * (1 - carried) + A('sit'), 0, 1);
      p.lie = M.clamp(b.lie * standUp * (1 - carried) + A('lie'), 0, 1);
      const breath = Math.sin(this.time * 2 * Math.PI * (this.mood === 'happy' ? 0.9 : 0.35));
      const pant = b.pant * Math.sin(this.time * 2 * Math.PI * 3.2);
      p.squash = A('squash') + breath * 0.014 + pant * 0.008 - g * b.bob * 0.4 * Math.abs(Math.cos(ph));
      p.bodyY = A('bodyY') + g * b.bob * Math.abs(Math.sin(ph));
      p.pitch = A('pitch') + g * 0.035 * Math.sin(ph);
      p.roll = A('roll') + g * 0.04 * Math.sin(ph + 0.4) + carried * 0.07 * Math.sin(this.time * 3.1);
      p.headPitch = b.headPitch + A('headPitch') + breath * 0.02 - g * 0.05 * Math.sin(2 * ph - 0.7);
      p.headRoll = A('headRoll');
      p.headDrop = b.headDrop * standUp + A('headDrop');
      p.feetFollow = M.clamp(A('feetFollow'), 0, 1);
      p.frontFollow = M.clamp(A('frontFollow'), 0, 1);
      p.treat = M.clamp(A('treat'), 0, 1);
      p.treatLift = Math.max(0, A('treatLift'));
      p.coverEyes = M.clamp(A('coverEyes'), 0, 1);
      const rollLift = A('rollLift');
      if (rollLift !== 0) p.bodyY += rollLift * 0.35 * (1 - Math.cos(p.roll));

      const look = M.clamp((b.look + this.lookBias) * (1 - g) + A('look'), 0, 1);
      const toViewer = M.clamp(M.wrap(Math.PI / 2 - this.yaw), -1.05, 1.05);
      const headTarget = look * toViewer + M.clamp(this.turnRate * 0.12, -0.5, 0.5) + A('headYaw');
      p.headYaw = this.headYawSpring.step(headTarget, dt);

      const reach = M.clamp(A('reach'), 0, 1);
      if (reach > 0) {
        const targetH = this.playingClip === 'dropToy' ? dropHeight : grabHeight;
        const mouth = Pup.Head.mouthPoint(new Pup.Geometry(p, this.style), new Pup.Camera({ x: 0, y: 0 }, 1));
        p.headDrop += reach * (-mouth.y / M.cosPitch - targetH);
      }

      const tuck = A('tuck');
      const phases = [0, Math.PI, Math.PI, 0];
      for (let i = 0; i < 4; i++) {
        const psi = ph + phases[i];
        p.feet[i] = [g * -stride * Math.cos(psi), g * 0.2 * Math.max(0, Math.sin(psi)) + tuck, 0];
      }
      p.feet[0][0] += A('frontX') + A('flX');
      p.feet[0][1] += A('flY');
      p.feet[1][0] += A('frontX') + A('frX');
      p.feet[1][1] += A('frY');
      p.feet[0][2] += A('flZ');
      p.feet[1][2] += A('frZ');
      const sprawl = A('sprawl');
      if (sprawl !== 0) for (let i = 0; i < 4; i++) p.feet[i] = V.add(p.feet[i], [0, 0.32 * sprawl, -0.62 * sprawl]);
      if (carried > 0) for (let i = 0; i < 4; i++) p.feet[i][1] -= carried * 0.12 * (1 + 0.5 * Math.sin(this.time * 7 + i * 1.7));

      const wagAmp = M.clamp(b.wag + A('wag') + g * 0.2, 0, 1.1);
      this.wagPhase += (b.wagHz + A('wagHz') + g * 1.2) * dt;
      p.tailUp = b.tailUp + A('tailUp') - g * 0.15;
      p.tailCurl = b.tailCurl;
      for (let i = 0; i < 4; i++) p.tailWag[i] = wagAmp * Math.sin(2 * Math.PI * this.wagPhase - i * 0.6) * (0.55 + 0.2 * i);

      const head = new Pup.Geometry(p, this.style).headCenter;
      if (this.previousHead && dt > 0) {
        const v = V.mul(V.sub(head, this.previousHead), 1 / dt);
        const dv = V.sub(v, this.previousHeadVelocity);
        const forward = [Math.cos(this.yaw), 0, Math.sin(this.yaw)];
        const dF = M.clamp(V.dot(dv, forward), -6, 6), dY = M.clamp(dv[1], -6, 6);
        this.flareL.kick(-dY * 0.35); this.flareR.kick(-dY * 0.35);
        this.swingL.kick(-dF * 0.3); this.swingR.kick(-dF * 0.3);
        this.previousHeadVelocity = v;
      }
      this.previousHead = head;
      const swing = b.swing + A('swing');
      p.earL.flare = M.clamp(this.flareL.step(b.flare + A('flareL'), dt), 0.08, 1.6);
      p.earR.flare = M.clamp(this.flareR.step(b.flare + A('flareR'), dt), 0.08, 1.6);
      p.earL.swing = M.clamp(this.swingL.step(swing, dt), -1, 1);
      p.earR.swing = M.clamp(this.swingR.step(swing, dt), -1, 1);

      if (this.blinks) {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) { this.blink = 1; this.blinkTimer = rand(2.2, 5.7); }
      }
      this.blink = Math.max(0, this.blink - dt / 0.16);
      const blinkShape = this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0;
      p.face.eyeOpen = M.clamp(b.eyeOpen + A('eyeOpen') - blinkShape * 1.2, 0, 1.1);
      p.face.joy = M.clamp(A('joy'), 0, 1);
      p.face.smile = M.clamp(b.smile + A('smile'), -1, 1);
      p.face.mouthOpen = M.clamp(b.mouthOpen + A('mouthOpen') + pant * 0.08, 0, 1.2);
      p.face.tongue = M.clamp(b.tongue + A('tongue'), 0, 1) * M.clamp(p.face.mouthOpen * 3, 0, 1);
      if (this.holding) {
        p.face.mouthOpen = M.clamp(0.18 + A('mouthOpen'), 0, 1.2);
        p.face.tongue = 0;
      }
      p.face.brows = M.clamp(b.brows + A('brows'), 0, 1);
      p.face.blush = M.clamp(b.blush + A('blush'), 0, 1);
      this.pose = p;
      return p;
    }
  }

  Pup.Puppy = Puppy;
  Pup.clipValue = clipValue;
})();
