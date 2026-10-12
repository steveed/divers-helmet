'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../model.js');
const H = globalThis.Helmet;

// Small deterministic PRNG so scrambles are repeatable.
function rng(seed) {
  return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function scramble(r, n = 40) {
  let s = H.ALL_GOALS[0];
  for (let i = 0; i < n; i++) s = H.applyMove(s, Math.floor(r() * H.MOVES.length));
  return s;
}

function respin(state, piece, k) {
  const slots = H.PIECE_SLOTS[piece], cols = slots.map((s) => state[s]), out = Uint8Array.from(state);
  slots.forEach((s, i) => { out[s] = cols[(i + k) % slots.length]; });
  return out;
}

test('geometry has 14 pieces and 48 arc slots', () => {
  assert.strictEqual(H.SLOTS.length, 48);
  assert.deepStrictEqual(H.PIECE_SLOTS.map((s) => s.length), [4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3]);
  assert.strictEqual(H.ROTATIONS.length, 24);
  assert.strictEqual(H.ALL_GOALS.length, 72);
});

test('moves are permutations, and three turns return to start', () => {
  const s = H.ALL_GOALS[0];
  H.MOVES.forEach((m, i) => {
    assert.strictEqual(new Set(m.perm).size, 48);
    let x = s;
    for (let k = 0; k < 3; k++) x = H.applyMove(x, i);
    assert.deepStrictEqual(x, s);
  });
});

test('solved states validate and are recognised', () => {
  for (const g of H.ALL_GOALS) {
    assert.ok(H.validate(g).ok);
    assert.ok(H.isSolved(g));
  }
});

test('random scrambles solve in at most 11 turns', () => {
  const r = rng(12345);
  for (let t = 0; t < 40; t++) {
    const st = scramble(r);
    assert.ok(H.validate(st).ok);
    const sol = H.solve(st);
    assert.ok(sol, 'expected a solution');
    assert.ok(sol.length <= 11, `solution too long: ${sol.length}`);
    const end = sol.reduce((x, m) => H.applyMove(x, m), st);
    assert.ok(H.isSolved(end));
  }
});

test('impossible positions are rejected rather than searched forever', () => {
  const st = scramble(rng(777));
  const corner = H.PIECE_SLOTS.findIndex((sl, p) => H.isCorner(p) && p !== H.ANCHOR);
  assert.strictEqual(H.solve(respin(st, corner, 1)), null, 'twisted corner');
  let spun = st;
  for (let p = 0; p < 6; p++) if (H.PIECE_SLOTS[p].some((s) => st[s])) spun = respin(spun, p, 1);
  assert.strictEqual(H.solve(spun), null, 'all diamonds turned a quarter');
});

test('validation names miscounted colours', () => {
  const st = Uint8Array.from(H.ALL_GOALS[0]);
  st[st.findIndex((c) => c === 1)] = 0;
  const v = H.validate(st);
  assert.ok(!v.ok);
  assert.ok(v.errors.some((e) => /red has 3 arcs/.test(e.msg)));
});
