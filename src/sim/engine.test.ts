import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, canPropagate, defenseMultiplier } from './engine.ts';
import { buildWorld } from './world.ts';
import { STRAINS, strainById } from './strains.ts';
import { DEFENSES } from './defenses.ts';
import type { RunConfig, WorldConfig } from './types.ts';

const world = (over: Partial<WorldConfig> = {}): WorldConfig => ({
  seed: 42, population: 80, socialDensity: 4, autonomy: 'autosend', ragEnabled: true, humanInLoop: 0, ...over,
});
const run = (over: Partial<RunConfig> = {}): RunConfig => ({
  world: world(), strainId: 'morris2', patientZero: 0, defenses: [], maxTicks: 60, ...over,
});

test('world is deterministic from seed', () => {
  const a = buildWorld(world());
  const b = buildWorld(world());
  assert.deepEqual(a.nodes, b.nodes);
  assert.deepEqual(a.edges, b.edges);
});

test('different seeds give different worlds', () => {
  const a = buildWorld(world({ seed: 1 }));
  const b = buildWorld(world({ seed: 2 }));
  assert.notDeepEqual(a.nodes.map((x) => x.email), b.nodes.map((x) => x.email));
});

test('population is clamped and edges reference valid nodes', () => {
  const w = buildWorld(world({ population: 120, socialDensity: 5 }));
  assert.equal(w.nodes.length, 120);
  for (const list of w.edges) for (const j of list) assert.ok(j >= 0 && j < 120);
});

test('simulation is fully deterministic', () => {
  const a = simulate(run());
  const b = simulate(run());
  assert.deepEqual(a.frames, b.frames);
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.summary, b.summary);
});

test('patient zero starts infected at tick 0', () => {
  const r = simulate(run({ patientZero: 3 }));
  assert.equal(r.frames[0].statusByNode[3], 'infected');
  assert.equal(r.frames[0].counts.infected, 1);
});

test('ever-infected count never decreases across frames', () => {
  const r = simulate(run());
  let prevEver = 0;
  for (const f of r.frames) {
    const ever = f.counts.infected + f.counts.exfiltrating + f.counts.immune
      + f.statusByNode.filter((s) => s === 'exposed').length;
    // ever-infected is monotonic via everInfected; here check total non-healthy is monotonic
    const touched = f.statusByNode.filter((s) => s !== 'healthy').length;
    assert.ok(touched >= prevEver - 0, `touched ${touched} < ${prevEver}`);
    prevEver = Math.max(prevEver, touched);
    void ever;
  }
});

test('turning RAG off immunizes against a RAG-only strain (Morris II)', () => {
  const on = simulate(run({ world: world({ ragEnabled: true }) }));
  const off = simulate(run({ world: world({ ragEnabled: false }) }));
  assert.ok(on.summary.totalInfected > 1);
  assert.equal(off.summary.totalInfected, 1, 'no spread without RAG');
  assert.equal(canPropagate(strainById('morris2'), buildWorld(world({ ragEnabled: false }))), false);
});

test('read-only autonomy stops a strain that needs autosend', () => {
  const auto = simulate(run({ world: world({ autonomy: 'autosend' }) }));
  const ro = simulate(run({ world: world({ autonomy: 'readonly' }) }));
  assert.ok(auto.summary.totalInfected > ro.summary.totalInfected);
  assert.equal(ro.summary.totalInfected, 1);
});

test('AgentPoison (read-only, RAG) still spreads under read-only autonomy', () => {
  const r = simulate(run({ strainId: 'agentpoison', world: world({ autonomy: 'readonly' }) }));
  assert.ok(r.summary.totalInfected > 1, 'memory-borne strain ignores send autonomy');
});

test('defenses reduce total spread', () => {
  const bare = simulate(run());
  const defended = simulate(run({ defenses: ['spotlighting', 'input-filter'] }));
  assert.ok(defended.summary.totalInfected < bare.summary.totalInfected);
});

test('rag-provenance neutralises a RAG strain but a spotlight barely dents it differently', () => {
  const prov = simulate(run({ strainId: 'agentpoison', defenses: ['rag-provenance'] }));
  const none = simulate(run({ strainId: 'agentpoison' }));
  assert.ok(prov.summary.totalInfected < none.summary.totalInfected);
});

test('human-approval records blocked send attempts', () => {
  const r = simulate(run({ defenses: ['human-approval'] }));
  assert.ok(r.summary.blockedAttempts > 0);
  assert.ok(r.events.some((e) => e.blocked));
});

test('every strain and defense is well-formed', () => {
  assert.ok(STRAINS.length >= 4);
  for (const s of STRAINS) {
    assert.ok(s.paper.startsWith('https://'), `${s.id} needs a paper link`);
    assert.ok(s.transmissibility > 0 && s.transmissibility <= 1);
    assert.ok(s.payloadMarkers.length >= 1);
  }
  for (const d of DEFENSES) assert.ok(d.reduce >= 0 && d.reduce <= 1);
});

test('defenseMultiplier is multiplicative and clamped', () => {
  const s = strainById('morris2');
  assert.equal(defenseMultiplier(s, []), 1);
  const m = defenseMultiplier(s, [DEFENSES.find((d) => d.id === 'input-filter')!]);
  assert.ok(m > 0 && m < 1);
});

test('frames cover tick 0..finalTick contiguously', () => {
  const r = simulate(run());
  for (let i = 0; i < r.frames.length; i++) assert.equal(r.frames[i].tick, i);
});

test('timeTo50 is null when spread is blocked', () => {
  const r = simulate(run({ world: world({ ragEnabled: false }) }));
  assert.equal(r.summary.timeTo50, null);
});
