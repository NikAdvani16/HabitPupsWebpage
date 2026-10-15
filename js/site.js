// The pup studio in the hero: one of the app's own dogs, drawn and animated by the app's own
// renderer and motion engine (ported in js/pup), in a little yard. Pick a breed, teach it a
// trick, dress it up, and set how the habit's going.
(function () {
  const Pup = window.Pup, data = window.PupData;
  const yard = document.getElementById('yard');
  const bg = document.getElementById('yard-bg');
  const canvas = document.getElementById('yard-dog');
  const tag = document.getElementById('breed-tag');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const breedName = (a) => a.breedLabel.replace('Siberian ', '').replace('French Bulldog', 'Frenchie');
  const byId = (id) => data.catalog.find((a) => a.id === id);

  // ---- State ------------------------------------------------------------------------------
  const state = {
    breed: 'golden',
    hat: null,
    sunglasses: false,
    neck: 'collar',
    cape: false,
    mood: 'happy',
  };
  const outfit = () => Object.assign(Pup.noOutfit(), {
    hat: state.hat,
    sunglasses: state.sunglasses,
    collar: state.neck === 'collar' || state.neck === 'bandana',
    bandana: state.neck === 'bandana',
    scarf: state.neck === 'scarf',
    cape: state.cape,
    color: 0,
    accent: 2,
  });
  const styleNow = () => Pup.styleFor(byId(state.breed), outfit());

  const puppy = new Pup.Puppy(state.mood, Math.PI / 2, styleNow(), Math.floor(Math.random() * 997));
  puppy.autoIdle = !reduceMotion;
  puppy.settle(1);

  // ---- Drawing ----------------------------------------------------------------------------
  let width = 0, height = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    width = yard.clientWidth;
    height = yard.clientHeight;
    for (const c of [bg, canvas]) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    drawYard();
  }

  // The yard, in the app's colours: sky, sun, a picket fence and the lawn.
  function drawYard() {
    const c = bg.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horizon = height * 0.56;
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#BFE6F5');
    sky.addColorStop(1, '#E8F6D8');
    c.fillStyle = sky;
    c.fillRect(0, 0, width, horizon + 2);

    const sun = c.createRadialGradient(width - 70, 62, 8, width - 70, 62, 70);
    sun.addColorStop(0, 'rgba(255,224,150,1)');
    sun.addColorStop(0.45, 'rgba(255,224,150,0.95)');
    sun.addColorStop(1, 'rgba(255,224,150,0)');
    c.fillStyle = sun;
    c.fillRect(width - 150, 0, 150, 140);

    // Fence: rails behind pickets with pointed tops.
    const top = height * 0.33, bottom = horizon + 4, pw = 22, gap = 10;
    c.fillStyle = '#B98551';
    c.fillRect(0, top + (bottom - top) * 0.28, width, 7);
    c.fillRect(0, top + (bottom - top) * 0.7, width, 7);
    c.fillStyle = '#D9A86C';
    for (let x = -4; x < width; x += pw + gap) {
      c.beginPath();
      c.moveTo(x, bottom);
      c.lineTo(x, top + 9);
      c.lineTo(x + pw / 2, top);
      c.lineTo(x + pw, top + 9);
      c.lineTo(x + pw, bottom);
      c.closePath();
      c.fill();
    }

    const grass = c.createLinearGradient(0, horizon, 0, height);
    grass.addColorStop(0, '#8FCB74');
    grass.addColorStop(1, '#B6E08C');
    c.fillStyle = grass;
    c.fillRect(0, horizon, width, height - horizon);

    // Tufts and a few daisies, the same every time.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    c.strokeStyle = 'rgba(80,140,60,0.45)';
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    for (let i = 0; i < Math.round(width / 26); i++) {
      const x = rand() * width, y = horizon + 14 + rand() * (height - horizon - 20);
      c.beginPath();
      c.moveTo(x - 4, y); c.lineTo(x - 6, y - 7);
      c.moveTo(x, y); c.lineTo(x, y - 9);
      c.moveTo(x + 4, y); c.lineTo(x + 6, y - 7);
      c.stroke();
    }
    for (let i = 0; i < Math.round(width / 70); i++) {
      const x = rand() * width, y = horizon + 18 + rand() * (height - horizon - 26);
      if (Math.abs(x - width / 2) < width * 0.18) continue; // leave the dog's spot clear
      c.fillStyle = '#ffffff';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        c.beginPath();
        c.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.4, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#F2B24C';
      c.beginPath();
      c.arc(x, y, 2.2, 0, Math.PI * 2);
      c.fill();
    }
  }

  function dogCamera() {
    const a = byId(state.breed);
    const dogHeight = height * 0.46 * Math.pow(a.sizeScale, 0.7);
    return new Pup.Camera({ x: width / 2, y: height * 0.86 }, dogHeight / Pup.Renderer.standingHeight);
  }

  function drawDog(pose) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = Pup.copyPose(pose);
    p.x = 0;
    p.z = 0;
    Pup.Renderer.draw(new Pup.GC(ctx, Pup.T.scale(dpr, dpr)), p, puppy.style, dogCamera());
  }

  // ---- Animation --------------------------------------------------------------------------
  let last = null, visible = true, frame = null;
  function tick(now) {
    frame = null;
    const dt = last == null ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    last = now;
    drawDog(puppy.update(dt));
    if (visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function start() {
    if (frame == null && visible && !document.hidden) {
      last = null;
      frame = requestAnimationFrame(tick);
    }
  }
  // Only animate while it's on screen: no battery spent on a dog nobody's watching.
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    start();
  }).observe(yard);
  document.addEventListener('visibilitychange', start);
  new ResizeObserver(() => { resize(); drawDog(puppy.pose); }).observe(yard);

  // ---- Looking at you ---------------------------------------------------------------------
  // The dog turns a little toward the pointer, and back to face you when it leaves.
  yard.addEventListener('pointermove', (e) => {
    const rect = yard.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    puppy.faceYaw = Math.PI / 2 - Math.max(-0.75, Math.min(0.75, dx * 1.6));
  });
  yard.addEventListener('pointerleave', () => { puppy.faceYaw = Math.PI / 2; });

  // Tap the dog: it reacts, like tapping one in the app.
  const reactions = ['hop', 'spin', 'wiggle', 'playBow', 'speak', 'headTilt'];
  yard.addEventListener('click', () => {
    puppy.play(reactions[Math.floor(Math.random() * reactions.length)]);
    start();
  });

  // ---- Controls ---------------------------------------------------------------------------
  function chip(label, pressed, onClick, extra = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (extra ? ' ' + extra : '');
    b.textContent = label;
    if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', onClick);
    return b;
  }
  const press = (group, button) => {
    for (const b of group.querySelectorAll('[aria-pressed]')) b.setAttribute('aria-pressed', String(b === button));
  };

  function describe() {
    const a = byId(state.breed);
    tag.textContent = a.breedLabel;
    const worn = [state.hat && { beanie: 'a beanie', earmuffs: 'earmuffs', crown: 'a crown', partyHat: 'a party hat' }[state.hat],
      state.sunglasses && 'sunglasses', state.neck === 'bandana' && 'a bandana', state.neck === 'scarf' && 'a scarf',
      state.cape && 'a cape'].filter(Boolean);
    const feeling = { happy: 'happy', eager: 'waiting for you', sad: 'missing you' }[state.mood];
    canvas.setAttribute('aria-label', `A ${a.breedLabel} puppy, ${feeling}${worn.length ? ', wearing ' + worn.join(' and ') : ''}`);
  }

  function restyle() {
    puppy.style = styleNow();
    describe();
    start();
  }

  // Breeds, each with its own portrait drawn by the same renderer.
  const breeds = document.getElementById('breeds');
  for (const a of data.catalog) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'breed';
    b.setAttribute('aria-pressed', String(a.id === state.breed));
    b.setAttribute('aria-label', a.breedLabel);
    const thumb = document.createElement('canvas');
    thumb.width = 112;
    thumb.height = 112;
    b.appendChild(thumb);
    const name = document.createElement('span');
    name.textContent = breedName(a);
    b.appendChild(name);
    b.addEventListener('click', () => {
      state.breed = a.id;
      press(breeds, b);
      restyle();
      puppy.play('hop');
    });
    breeds.appendChild(b);
    portrait(thumb, a);
  }

  function portrait(c, a) {
    const style = Pup.styleFor(a);
    const pup = new Pup.Puppy('content', Math.PI / 2, style, 3);
    pup.forceSit = true;
    pup.lookBias = 1;
    pup.autoIdle = false;
    pup.blinks = false;
    pup.settle(3);
    const ctx = c.getContext('2d');
    const h = c.height;
    // Head and shoulders.
    const cam = new Pup.Camera({ x: c.width / 2, y: h * 1.16 }, (h * 1.12) / Pup.Renderer.standingHeight);
    Pup.Renderer.draw(new Pup.GC(ctx), pup.pose, style, cam, false);
  }

  const tricks = document.getElementById('tricks');
  [['Spin', 'spin'], ['Speak', 'speak'], ['Beg', 'beg'], ['High five', 'highFive'], ['Roll over', 'rollOver'],
    ['Play dead', 'playDead'], ['Peekaboo', 'peekaboo'], ['Chase tail', 'chaseTail'], ['Dance', 'hindLegDance'],
    ['Treat on nose', 'treatOnNose'], ['Leap', 'leap'], ['Backflip', 'backflip']].forEach(([label, clip]) => {
    tricks.appendChild(chip(label, null, () => { puppy.play(clip); start(); }, 'trick'));
  });

  const wear = document.getElementById('wear');
  function slot(title, options, current, set) {
    const box = document.createElement('div');
    box.className = 'slot';
    const t = document.createElement('span');
    t.textContent = title;
    const row = document.createElement('div');
    row.className = 'chips';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', title);
    for (const [label, value] of options) {
      const b = chip(label, value === current, () => {
        set(value);
        press(row, b);
        restyle();
        puppy.play('wiggle');
      });
      row.appendChild(b);
    }
    box.append(t, row);
    wear.appendChild(box);
  }
  slot('Head', [['Nothing', null], ['Beanie', 'beanie'], ['Earmuffs', 'earmuffs'], ['Crown', 'crown'], ['Party hat', 'partyHat']], state.hat, (v) => (state.hat = v));
  slot('Face', [['Nothing', false], ['Sunglasses', true]], state.sunglasses, (v) => (state.sunglasses = v));
  slot('Neck', [['Collar', 'collar'], ['Bandana', 'bandana'], ['Scarf', 'scarf'], ['Nothing', 'none']], state.neck, (v) => (state.neck = v));
  slot('Back', [['Nothing', false], ['Cape', true]], state.cape, (v) => (state.cape = v));

  const moods = document.getElementById('moods');
  [['Done today', 'happy'], ['Waiting for you', 'eager'], ['Missed a day', 'sad']].forEach(([label, mood]) => {
    const b = chip(label, mood === state.mood, () => {
      state.mood = mood;
      press(moods, b);
      puppy.setMood(mood);
      if (mood === 'happy') puppy.play('celebrate');
      describe();
      start();
    });
    moods.appendChild(b);
  });

  describe();
  resize();
  drawDog(puppy.pose);
  start();
})();

// The screenshot reel: arrow buttons step a screen at a time (swipe, scroll and the
// keyboard work as they do in any scroller), and turn off at the ends.
(function () {
  const reel = document.getElementById('reel');
  if (!reel) return;
  const buttons = document.querySelectorAll('.reel-btn');
  const step = () => {
    const first = reel.querySelector('li');
    const gap = parseFloat(getComputedStyle(reel).columnGap) || 0;
    return first ? first.getBoundingClientRect().width + gap : reel.clientWidth;
  };
  const update = () => {
    const max = reel.scrollWidth - reel.clientWidth - 2;
    buttons.forEach((b) => {
      b.disabled = b.dataset.dir === '-1' ? reel.scrollLeft <= 2 : reel.scrollLeft >= max;
    });
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  buttons.forEach((b) => b.addEventListener('click', () => {
    reel.scrollBy({ left: Number(b.dataset.dir) * step() * 2, behavior: reduced ? 'auto' : 'smooth' });
  }));
  reel.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    reel.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * step(), behavior: reduced ? 'auto' : 'smooth' });
  });
  reel.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
