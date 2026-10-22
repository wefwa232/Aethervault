/* AETHERVAULT — Combat: battle LOD. Builds any specimen's model without a View (synthetic ctx, same builders, same materials),
 * then optionally turns it into a cheap battle unit: lights/sprites/points/additive glow stripped, static meshes merged by material.
 *   mode 'full'    the model exactly as the showcase builds it (animated through inst.update)
 *   mode 'merged'  strip + merge static meshes per original material
 *   mode 'dedupe'  strip + merge, with materials that carry identical parameters collapsed first (fewest draw calls)
 * opts.lod scales marching-cube cell size of metaball skins (K.skin) so organic bodies get fewer triangles.
 * Needs the 3D stage (AV.stage); the pure simulation never touches this file. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const THREE = window.THREE, S = AV.stage, U = AV.util, D = AV.data;
  const lod = (AV.combat.lod = { supported: () => !!(S && !S.failed && S.supported && S.supported()) });
  if (!THREE || !S || S.failed) return;

  /** The ctx View.setSpec assembles, without a View (only cards and a few form motifs read ctx.view, and they guard it). */
  function makeCtx(spec, o) {
    const L = S.lib, q = S.q(), item = D.ITEMS[spec.base], R = item ? D.RARITY[item.rarity] : null, disposables = [], tex = [];
    const F = L.materialFactory(spec, q, disposables, q.tex);
    return { THREE, L, S, spec, item, rarity: R, tier: R ? R.tier : 0, rc: R ? R.color : '#d7b46e', F, q, quality: q, rng: U.mulberry32((spec.seed || 1) ^ 0x5bd1e995), geo: S.geo, disposables, tex,
      mode: 'battle', view: null, reduced: !!o.reduced, lod: o.lod || 0, potentialTier: spec.potential >= 80 ? 2 : spec.potential >= 55 ? 1 : 0, level: spec.level || 0, theme: spec.theme || (item ? item.pal : []) };
  }

  const isGlow = o => o.isSprite || o.isPoints || o.isLight || o.name === 'stagefx' || o.userData.stageRing || (o.isMesh && o.material && !Array.isArray(o.material) && (o.material.blending === THREE.AdditiveBlending || (o.material.transparent && o.material.depthWrite === false && o.material.userData.role !== 'glass')));

  function matKey(m) {
    const tr = m.userData.tr, v = x => (x && x.value && x.value.toArray ? x.value.toArray().map(n => +n.toFixed(3)).join(',') : (x && x.value && x.value.getHex ? x.value.getHex() : ''));
    return [m.type, m.color.getHex(), m.emissive ? m.emissive.getHex() : '', +(m.emissiveIntensity || 0).toFixed(2), +m.metalness.toFixed(2), +m.roughness.toFixed(2), +m.opacity.toFixed(2), m.transparent ? 1 : 0, m.side, m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0,
      +(m.clearcoat || 0).toFixed(2), +(m.iridescence || 0).toFixed(2), m.userData.role || '', tr ? [v(tr.u1), v(tr.u2), v(tr.uTint), v(tr.uCrack), v(tr.uRim), tr.pat && tr.pat.uuid, tr.wear && tr.wear.uuid].join(';') : ''].join('|');
  }

  /** Merge every visible static mesh under root into one mesh per material (or per equal-parameter material group). Returns { root, meshes, dropped }. */
  function merge(root, dedupe, keep) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), loose = [], tmp = new THREE.Matrix4(), im = new THREE.Matrix4();
    const add = (geo, mat, m4) => { if (!geo || !geo.attributes.position) return; const k = dedupe ? matKey(mat) : mat.uuid; let g = groups.get(k); if (!g) groups.set(k, g = { mat, items: [] }); g.items.push({ geo, m4: m4.clone() }); };
    const walk = o => {
      if (!o.visible || (keep && keep(o))) { if (keep && keep(o) && o.visible) loose.push(o); return; }
      if (isGlow(o)) return;
      if (o.isMesh && o.material && !Array.isArray(o.material) && (o.material.isMeshStandardMaterial)) {
        tmp.multiplyMatrices(inv, o.matrixWorld);
        if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); add(o.geometry, o.material, new THREE.Matrix4().multiplyMatrices(tmp, im)); } } else add(o.geometry, o.material, tmp);
      }
      o.children.forEach(walk);
    };
    walk(root);
    const out = new THREE.Group(), made = [];
    groups.forEach(g => {
      let nv = 0, ni = 0, uv = true, col = false;
      g.items.forEach(({ geo }) => { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; if (!geo.attributes.uv) uv = false; if (geo.attributes.color) col = true; });
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uvs = uv ? new Float32Array(nv * 2) : null, cols = col ? new Float32Array(nv * 3).fill(1) : null, idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let vo = 0, io = 0;
      g.items.forEach(({ geo, m4 }) => {
        const P = geo.attributes.position, N = geo.attributes.normal || (geo.computeVertexNormals(), geo.attributes.normal), C = geo.attributes.color, T = geo.attributes.uv; nm.getNormalMatrix(m4);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m4); pos.set([v.x, v.y, v.z], (vo + i) * 3);
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
          if (uvs) uvs.set([T.getX(i), T.getY(i)], (vo + i) * 2);
          if (cols && C) cols.set([C.getX(i), C.getY(i), C.getZ(i)], (vo + i) * 3);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) idx[io + i] = geo.index.getX(i) + vo; else for (let i = 0; i < P.count; i++) idx[io + i] = vo + i;
        io += geo.index ? geo.index.count : P.count; vo += P.count;
      });
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      if (uvs) bg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); if (cols) bg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); bg.setIndex(new THREE.BufferAttribute(idx, 1)); bg.computeBoundingSphere();
      const mesh = new THREE.Mesh(bg, g.mat); mesh.frustumCulled = false; out.add(mesh); made.push(bg);
    });
    loose.forEach(o => { tmp.multiplyMatrices(inv, o.matrixWorld); o.parent && o.parent.remove(o); tmp.decompose(o.position, o.quaternion, o.scale); out.add(o); });
    return { root: out, geos: made };
  }

  /** Triangles and draw calls of a subtree (a mesh = one call; instanced = one call). */
  function count(root) {
    let tris = 0, calls = 0, mats = new Set();
    root.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isSprite) return; if (!o.visible) return; calls++; const g = o.geometry; if (g && g.attributes && g.attributes.position) { const n = g.index ? g.index.count : g.attributes.position.count; tris += (n / 3) * (o.isInstancedMesh ? o.count : 1); } if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m.uuid)); });
    return { tris: Math.round(tris), calls, materials: mats.size };
  }

  /** Build one battle unit. Returns { root, frame, update(dt,t), dispose(), cost:{tris,calls,materials}, buildMs, mode }.
   *  The returned root has its feet at y = 0 and is NOT scaled; the caller scales to arena units using frame. */
  lod.build = function (spec, opts = {}) {
    const t0 = performance.now(), mode = opts.mode || 'dedupe', ls = mode === 'full' ? 0 : (opts.lod || 0);
    if (S.ensure) S.ensure([spec.look && AV.progress ? AV.progress.displaySpec(spec).base : spec.base]);
    spec = spec.base && spec.look && spec.look !== 'auto' && AV.progress ? AV.progress.displaySpec(spec) : spec;
    const def = S.models[spec.base]; if (!def) return null;
    const ctx = makeCtx(spec, { lod: ls, reduced: opts.reduced }), inst = def.build(ctx); inst.disposables = ctx.disposables; inst.ctx = ctx;
    if (S.forms) S.forms.apply(ctx, inst);
    const rs = []; inst.root.traverse(o => { if (o.userData.stageRing) rs.push(o); }); rs.forEach(o => o.parent && o.parent.remove(o));
    let root = inst.root, merged = null;
    const full = { tris: 0, calls: 0 }; Object.assign(full, count(root));
    if (mode !== 'full') { merged = merge(inst.root, mode === 'dedupe'); root = merged.root; }
    const st = { t: 0, reduced: !!opts.reduced, pointer: { x: 0, y: 0 }, hover: false, idle: 0, lastInput: 0, tier: ctx.tier };
    const unit = {
      root, frame: inst.frame || { r: 1, h: 1 }, mode, source: full, cost: count(root), buildMs: performance.now() - t0, spec,
      update(dt, t) { if (mode === 'full' && inst.update) { st.t = t; inst.update(dt, t, st, null); } },
      dispose() {
        if (merged) merged.geos.forEach(g => g.dispose());
        inst.root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
        (inst.disposables || []).forEach(m => m.dispose && m.dispose()); (ctx.tex || []).forEach(t => t.dispose && t.dispose()); // models park per-instance canvas textures (creature faces) in ctx.tex
        try { inst.dispose && inst.dispose(); } catch (e) { /* ignore */ }
      },
    };
    return unit;
  };
  lod.count = count;
})();
