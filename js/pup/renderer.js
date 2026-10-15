// PuppyRenderer from the app: body and head, outlined together as one sticker.
(function () {
  const Pup = window.Pup, V = Pup.V;
  const standingHeight = 3.3;

  function draw(ctx, pose, style, cam, shadow = true) {
    const g = new Pup.Geometry(pose, style);
    const ow = Math.max(1.2, cam.scale * 0.05);
    if (shadow) {
      const k = Math.max(0.35, 1 - pose.jump * 0.35);
      const e = cam.ellipse([pose.x, 0, pose.z], [1.25 * k, 0, 0], [0, 0.001, 0], [0, 0, 0.75 * k]);
      ctx.fill(e.path(), Pup.css(Pup.hex(0x281e14), 0.18 * k));
    }
    const headFirst = cam.depth(g.headCenter) + 0.02 < Pup.Body.depth(g, cam);
    Pup.Body.outline(ctx, g, cam, ow);
    Pup.Head.outline(ctx, g, cam, ow);
    if (headFirst) {
      Pup.Head.draw(ctx, g, cam, ow);
      Pup.Body.draw(ctx, g, cam, ow);
    } else {
      Pup.Body.draw(ctx, g, cam, ow);
      Pup.Head.draw(ctx, g, cam, ow);
      Pup.Body.drawOverHead(ctx, g, cam, ow);
    }
    if (pose.treat > 0.01) treat(ctx, g, cam, ow);
  }

  function treat(ctx, g, cam, ow) {
    const fr = Pup.Head.frame(g, cam);
    const nose = Pup.Head.nosePoint(g, cam);
    const size = fr.radius * 0.34;
    const up = { x: Math.sin(fr.roll), y: -Math.cos(fr.roll) };
    const rise = size * 0.55 + g.pose.treatLift * cam.scale;
    const center = { x: nose.x + up.x * size * 0.55, y: nose.y + up.y * size * 0.55 - (rise - size * 0.55) };
    const c = ctx.copy();
    c.opacity = g.pose.treat;
    c.translateBy(center.x, center.y);
    c.rotate(fr.roll + g.pose.treatLift * 2.4);
    const biscuit = Pup.roundedRect({ x: -size * 0.7, y: -size * 0.32, width: size * 1.4, height: size * 0.64 }, size * 0.3);
    c.fillStroked(biscuit, Pup.css(Pup.hex(0x5a3a20)), { lineWidth: ow * 2 });
    c.fill(biscuit, Pup.css(Pup.hex(0xd9a35e)));
    for (const dx of [-0.3, 0.0, 0.3]) {
      c.fill(new Pup.Path().addEllipseIn({ x: size * dx - size * 0.06, y: -size * 0.06, width: size * 0.12, height: size * 0.12 }), Pup.css(Pup.hex(0x8c5a2e)));
    }
  }

  // The camera for a box `size` whose ground sits at `groundY` (0…1 of its height), scaled
  // so a standing puppy is `dogHeight` points tall.
  const camera = (size, dogHeight, groundY) => new Pup.Camera({ x: size.width / 2, y: size.height * groundY }, dogHeight / standingHeight);

  Pup.Renderer = { draw, camera, standingHeight };
})();
