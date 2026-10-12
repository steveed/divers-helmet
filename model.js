// Diver's Helmet (spherical Skewb) model and solver.
//
// Geometry: unit sphere cut by the 4 great circles perpendicular to the cube diagonals.
// That gives 6 centre pieces (diamonds) and 8 corner pieces (triangles). Wherever two
// cuts cross (the 12 cube-edge midpoints) four pieces meet, and each of the four can
// carry a quarter of a ring drawn around that point. Those 48 quarter-arcs are "slots".
//
// Solved = some equator of 4 edge midpoints each has a full single-colour ring.
// Coordinates: x right, y up, z towards the viewer.
(function (root) {
  'use strict';

  const RING_R = 0.40; // angular radius of a ring, radians

  const v = (x, y, z) => [x, y, z];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const norm = (a) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

  // Rodrigues rotation of p about unit axis k by angle t.
  function rotate(p, k, t) {
    const c = Math.cos(t), s = Math.sin(t);
    return add(add(scale(p, c), scale(cross(k, p), s)), scale(k, dot(k, p) * (1 - c)));
  }

  const DIAGS = [v(1, 1, 1), v(1, 1, -1), v(1, -1, 1), v(-1, 1, 1)].map(norm);

  const signKey = (p) => DIAGS.reduce((k, d, i) => k | (dot(p, d) > 0 ? 1 << i : 0), 0);

  // Pieces: 0..5 centres, 6..13 corners.
  const CENTER_DIRS = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)];
  const CENTER_NAMES = ['right', 'left', 'top', 'bottom', 'front', 'back'];
  const CORNER_DIRS = [];
  const CORNER_NAMES = [];
  for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) {
    CORNER_DIRS.push(norm(v(x, y, z)));
    CORNER_NAMES.push((y > 0 ? 'top' : 'bottom') + '-' + (z > 0 ? 'front' : 'back') + '-' + (x > 0 ? 'right' : 'left'));
  }
  const PIECES = CENTER_DIRS.concat(CORNER_DIRS);
  const PIECE_OF_KEY = new Int8Array(16).fill(-1);
  PIECES.forEach((p, i) => { PIECE_OF_KEY[signKey(p)] = i; });
  const isCorner = (piece) => piece >= 6;
  // The two corner orbits (corners never leave their orbit): even/odd number of minus signs.
  const cornerOrbit = (piece) => {
    const c = PIECES[piece];
    return ((c[0] < 0) + (c[1] < 0) + (c[2] < 0)) % 2;
  };

  function classify(p) { return PIECE_OF_KEY[signKey(p)]; }

  // Edge midpoints.
  const EDGES = [];
  for (const a of [1, -1]) for (const b of [1, -1]) {
    EDGES.push(norm(v(a, b, 0)), norm(v(a, 0, b)), norm(v(0, a, b)));
  }

  // Slots: for each edge, the 4 directions bisecting the quadrants between the two cuts.
  const SLOTS = []; // {edge, piece, point, tangent u, v basis, a0, a1 (angle range)}
  EDGES.forEach((m, ei) => {
    const cuts = DIAGS.filter((d) => Math.abs(dot(d, m)) < 1e-9);
    const t1 = norm(cross(m, cuts[0]));
    const t2 = norm(cross(m, cuts[1]));
    const u = t1, w = norm(cross(m, u));
    const ang = (t) => Math.atan2(dot(t, w), dot(t, u));
    const rays = [t1, t2, scale(t1, -1), scale(t2, -1)].map(ang).map((a) => (a + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
    for (let i = 0; i < 4; i++) {
      const a0 = rays[i];
      const a1 = i < 3 ? rays[i + 1] : rays[0] + 2 * Math.PI;
      const mid = (a0 + a1) / 2;
      const dir = add(scale(u, Math.cos(mid)), scale(w, Math.sin(mid)));
      const point = add(scale(m, Math.cos(RING_R)), scale(dir, Math.sin(RING_R)));
      SLOTS.push({ edge: ei, piece: classify(point), point, u, w, a0, a1 });
    }
  });

  const SLOT_INDEX = new Map(); // "edge,piece" -> slot
  SLOTS.forEach((s, i) => SLOT_INDEX.set(s.edge * 16 + s.piece, i));
  const slotAt = (edge, piece) => SLOT_INDEX.get(edge * 16 + piece);

  function nearestSlot(p) {
    let best = -1, bd = -2;
    SLOTS.forEach((s, i) => { const d = dot(s.point, p); if (d > bd) { bd = d; best = i; } });
    return best;
  }

  // Each piece's slots in cyclic order around the piece.
  const PIECE_SLOTS = PIECES.map((c, pi) => {
    const mine = SLOTS.map((s, i) => i).filter((i) => SLOTS[i].piece === pi);
    const ref = Math.abs(c[1]) > 0.9 ? v(1, 0, 0) : v(0, 1, 0);
    const a = norm(cross(ref, c)), b = cross(c, a);
    return mine.sort((i, j) => {
      const pi_ = EDGES[SLOTS[i].edge], pj = EDGES[SLOTS[j].edge];
      return Math.atan2(dot(pi_, b), dot(pi_, a)) - Math.atan2(dot(pj, b), dot(pj, a));
    });
  });

  // A rigid rotation applied to a subset of pieces -> slot permutation (perm[old] = new).
  function slotPerm(axis, angle, inHalf) {
    return SLOTS.map((s) => (inHalf(s) ? nearestSlot(rotate(s.point, axis, angle)) : SLOTS.indexOf(s)));
  }

  // The anchor corner never moves. The 4 turnable halves are the ones that exclude it.
  const ANCHOR = CORNER_DIRS.findIndex((c) => c[0] < 0 && c[1] < 0 && c[2] > 0) + 6; // bottom-front-left
  const ANCHOR_DIR = PIECES[ANCHOR];
  const MOVE_AXES = DIAGS.map((d) => (dot(d, ANCHOR_DIR) < 0 ? d : scale(d, -1)));
  const MOVE_CORNERS = MOVE_AXES.map((a) => CORNER_DIRS.findIndex((c) => dot(c, a) > 0.99) + 6);
  // Moves: 2*k = clockwise looking at corner k, 2*k+1 = anticlockwise.
  const MOVES = [];
  MOVE_AXES.forEach((axis, k) => {
    for (const dir of [-1, 1]) {
      const angle = dir * 2 * Math.PI / 3;
      MOVES.push({
        axis, angle, corner: MOVE_CORNERS[k], name: CORNER_NAMES[MOVE_CORNERS[k] - 6],
        clockwise: dir < 0,
        perm: slotPerm(axis, angle, (s) => dot(PIECES[s.piece], axis) > 0),
      });
    }
  });

  function applyMove(state, m) {
    const perm = MOVES[m].perm, out = new Uint8Array(48);
    for (let i = 0; i < 48; i++) out[perm[i]] = state[i];
    return out;
  }

  // Whole-ball rotations (24) as slot permutations.
  const ROTATIONS = (() => {
    const gens = [slotPerm(v(1, 0, 0), Math.PI / 2, () => true), slotPerm(v(0, 1, 0), Math.PI / 2, () => true)];
    const id = SLOTS.map((_, i) => i);
    const seen = new Map([[id.join(), id]]);
    const queue = [id];
    while (queue.length) {
      const p = queue.shift();
      for (const g of gens) {
        const q = p.map((x) => g[x]);
        const k = q.join();
        if (!seen.has(k)) { seen.set(k, q); queue.push(q); }
      }
    }
    return [...seen.values()];
  })();

  // Solved states for a given ring colouring around the y axis; rotations give the rest.
  function solvedState(ringColors) {
    const st = new Uint8Array(48);
    const ring = EDGES.map((m) => Math.abs(m[1]) < 1e-9); // vertical edges = around y axis
    let k = 0;
    // Order the 4 vertical edges around the equator.
    const eq = EDGES.map((m, i) => i).filter((i) => ring[i]).sort((i, j) => Math.atan2(EDGES[i][2], EDGES[i][0]) - Math.atan2(EDGES[j][2], EDGES[j][0]));
    for (const ei of eq) {
      for (let s = 0; s < 48; s++) if (SLOTS[s].edge === ei) st[s] = ringColors[k];
      k++;
    }
    return st;
  }

  function permutations(a) {
    if (a.length <= 1) return [a];
    return a.flatMap((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p)));
  }

  const ALL_GOALS = (() => {
    const out = new Map();
    for (const cols of permutations([1, 2, 3, 4])) {
      const s = solvedState(cols);
      for (const r of ROTATIONS) {
        const g = new Uint8Array(48);
        for (let i = 0; i < 48; i++) g[r[i]] = s[i];
        out.set(g.join(''), g);
      }
    }
    return [...out.values()];
  })();

  // ---- validation -------------------------------------------------------------------

  // Returns {ok, errors: [{msg, pieces}]}.
  function validate(state) {
    const errors = [];
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 48; i++) counts[state[i]]++;
    for (let c = 1; c <= 4; c++) {
      if (counts[c] !== 4) errors.push({ msg: `${COLOR_NAMES[c]} has ${counts[c]} arcs; it should have 4.`, pieces: [] });
    }
    const badCorners = [], badCenters = [];
    let blankCenters = 0;
    for (let p = 0; p < 14; p++) {
      const cols = PIECE_SLOTS[p].map((s) => state[s]);
      const n = cols.filter((c) => c).length;
      if (isCorner(p)) {
        if (n !== 1) badCorners.push(p);
      } else if (n === 0) {
        blankCenters++;
      } else if (n !== 2 || !((cols[0] && cols[2]) || (cols[1] && cols[3]))) {
        badCenters.push(p);
      }
    }
    if (badCorners.length) errors.push({ msg: 'Every triangle (corner) piece carries exactly one arc.', pieces: badCorners });
    if (badCenters.length) errors.push({ msg: 'A coloured diamond (centre) piece carries two arcs on opposite tips.', pieces: badCenters });
    if (!badCenters.length && blankCenters !== 2) errors.push({ msg: `There should be 2 plain diamonds (the logo and keyring ones), found ${blankCenters}.`, pieces: [] });
    if (!errors.length) {
      for (const orbit of [0, 1]) {
        const seen = new Set();
        for (let p = 6; p < 14; p++) if (cornerOrbit(p) === orbit) seen.add(PIECE_SLOTS[p].map((s) => state[s]).find((c) => c));
        if (seen.size !== 4) {
          errors.push({ msg: 'Two triangles with the same colour can never sit diagonally across a diamond from each other; one corner is probably entered wrong.', pieces: [] });
          break;
        }
      }
    }
    return { ok: !errors.length, errors };
  }

  // ---- solver -----------------------------------------------------------------------

  // Project state onto a set of slots, giving a string key.
  function keyOf(state, slots) {
    let k = '';
    for (const s of slots) k += state[s];
    return k;
  }

  const CENTER_SLOTS = [], CORNER_SLOTS = [];
  for (let s = 0; s < 48; s++) (isCorner(SLOTS[s].piece) ? CORNER_SLOTS : CENTER_SLOTS).push(s);

  // BFS over the projection reachable from the goals. Returns {index Map, dist Uint8Array, moveTable}.
  function buildTable(goals, slots) {
    const index = new Map();
    const states = [];
    const dist = [];
    const sub = (st) => { const a = new Uint8Array(48); for (const s of slots) a[s] = st[s]; return a; };
    for (const g of goals) {
      const sg = sub(g), k = keyOf(sg, slots);
      if (!index.has(k)) { index.set(k, states.length); states.push(sg); dist.push(0); }
    }
    const moveTable = [];
    for (let i = 0; i < states.length; i++) {
      const row = new Int32Array(MOVES.length);
      for (let m = 0; m < MOVES.length; m++) {
        const n = applyMove(states[i], m), k = keyOf(n, slots);
        let j = index.get(k);
        if (j === undefined) { j = states.length; index.set(k, j); states.push(n); dist.push(dist[i] + 1); }
        row[m] = j;
      }
      moveTable.push(row);
    }
    return { index, dist: Uint8Array.from(dist), moveTable };
  }

  // Goals compatible with what the user entered (same anchor appearance, same centre pieces).
  function goalsFor(state) {
    const anchorKey = keyOf(state, PIECE_SLOTS[ANCHOR]);
    const centerSet = (st) => PIECE_SLOTS.slice(0, 6).map((sl) => {
      const c = sl.map((s) => st[s]).filter((x) => x).sort();
      return c.join('');
    }).sort().join('|');
    const want = centerSet(state);
    return ALL_GOALS.filter((g) => keyOf(g, PIECE_SLOTS[ANCHOR]) === anchorKey && centerSet(g) === want);
  }

  // IDA*. Returns array of move indices, or null if unreachable.
  function solve(state, opts = {}) {
    const maxDepth = opts.maxDepth || 14; // every real position seen solves in <= 11
    const goals = goalsFor(state);
    if (!goals.length) return null;
    const ct = buildTable(goals, CORNER_SLOTS);
    const zt = buildTable(goals, CENTER_SLOTS);
    const c0 = ct.index.get(keyOf(state, CORNER_SLOTS));
    const z0 = zt.index.get(keyOf(state, CENTER_SLOTS));
    if (c0 === undefined || z0 === undefined) return null;
    const goalPairs = new Set(goals.map((g) => ct.index.get(keyOf(g, CORNER_SLOTS)) * 1e7 + zt.index.get(keyOf(g, CENTER_SLOTS))));
    const path = [];
    const h = (c, z) => Math.max(ct.dist[c], zt.dist[z]);
    function dfs(c, z, g, bound, lastAxis) {
      const f = g + h(c, z);
      if (f > bound) return false;
      if (goalPairs.has(c * 1e7 + z)) return true;
      for (let m = 0; m < MOVES.length; m++) {
        if ((m >> 1) === lastAxis) continue;
        path.push(m);
        if (dfs(ct.moveTable[c][m], zt.moveTable[z][m], g + 1, bound, m >> 1)) return true;
        path.pop();
      }
      return false;
    }
    for (let bound = h(c0, z0); bound <= maxDepth; bound++) {
      if (dfs(c0, z0, 0, bound, -1)) return path.slice();
    }
    return null;
  }

  function isSolved(state) {
    const k = state.join('');
    return ALL_GOALS.some((g) => g.join('') === k);
  }

  const COLOR_NAMES = ['none', 'red', 'yellow', 'green', 'blue'];

  root.Helmet = {
    RING_R, DIAGS, PIECES, PIECE_OF_KEY, CENTER_NAMES, CORNER_NAMES, EDGES, SLOTS, PIECE_SLOTS, MOVES, ROTATIONS,
    ALL_GOALS, ANCHOR, COLOR_NAMES,
    dot, cross, norm, rotate, classify, slotAt, nearestSlot, isCorner, cornerOrbit,
    applyMove, solvedState, validate, solve, isSolved,
  };
})(typeof window !== 'undefined' ? window : globalThis);
