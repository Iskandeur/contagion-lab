import { makeRng } from './rng.ts';
import { buildWorld } from './world.ts';
import { strainById } from './strains.ts';
import { defenseById } from './defenses.ts';
import type {
  AgentStatus, DefenseDef, Frame, InfectionEvent, RunConfig, SimulationResult, Strain, World,
} from './types.ts';

const RANK: Record<string, number> = { readonly: 0, draft: 1, autosend: 2 };
// Ticks an agent stays infectious before its payload is patched/burns out (SIR "recovery").
// Lower reproduction (defended, low autonomy) then yields a smaller final outbreak, not just a slower one.
const RECOVERY = 7;
const EMPTY_COUNTS = (): Record<AgentStatus, number> => ({
  healthy: 0, exposed: 0, infected: 0, exfiltrating: 0, immune: 0,
});

// Combined transmissibility multiplier from active defenses, given a strain.
export function defenseMultiplier(strain: Strain, defs: DefenseDef[]): number {
  let m = 1;
  for (const d of defs) {
    if (d.reduce <= 0) continue;
    if (d.blocksRagOnly && !strain.requiresRag) continue;
    if (d.blocksVectors && !d.blocksVectors.includes(strain.vector)) continue;
    m *= 1 - d.reduce;
  }
  return m;
}

// Is per-tick self-propagation even possible for this world+strain? (RAG off, or autonomy too low.)
export function canPropagate(strain: Strain, world: World): boolean {
  if (strain.requiresRag && !world.config.ragEnabled) return false;
  return RANK[world.config.autonomy] >= RANK[strain.requiresAutonomy];
}

export function simulate(cfg: RunConfig): SimulationResult {
  const world = buildWorld(cfg.world);
  const strain = strainById(cfg.strainId);
  const defs = cfg.defenses.map(defenseById);
  const n = world.nodes.length;
  const rng = makeRng((cfg.world.seed ^ 0x1234567 ^ hash(cfg.strainId)) >>> 0);

  const status: AgentStatus[] = new Array(n).fill('healthy');
  const exposedAt: number[] = new Array(n).fill(-1);
  const infectedAt: number[] = new Array(n).fill(-1);
  const everInfected = new Array<boolean>(n).fill(false);

  const pz = Math.max(0, Math.min(n - 1, cfg.patientZero));
  status[pz] = 'infected';
  infectedAt[pz] = 0;
  everInfected[pz] = true;

  const propagates = canPropagate(strain, world);
  const dMult = defenseMultiplier(strain, defs);
  const cureChance = defs.reduce((a, d) => a + (d.cureChance ?? 0), 0);
  const interceptSend = Math.max(
    world.config.autonomy === 'draft' ? world.config.humanInLoop * 0.6 : 0,
    ...defs.map((d) => d.interceptSend ?? 0),
    0,
  );

  const frames: Frame[] = [];
  const events: InfectionEvent[] = [];
  let cumExfil = 0;
  let blockedAttempts = 0;
  let timeTo50: number | null = null;
  let peakInfectious = 0;
  let prevInfectious = 1;

  const snapshot = (tick: number, newInfections: number): void => {
    const counts = EMPTY_COUNTS();
    for (let i = 0; i < n; i++) counts[status[i]]++;
    const infectious = counts.infected + counts.exfiltrating;
    peakInfectious = Math.max(peakInfectious, infectious);
    const rEff = prevInfectious > 0 ? newInfections / prevInfectious : 0;
    frames.push({
      tick, counts, newInfections, cumExfil,
      rEff: Math.round(rEff * 100) / 100,
      statusByNode: status.slice(),
    });
  };

  snapshot(0, 1);

  for (let tick = 1; tick <= cfg.maxTicks; tick++) {
    let newInfections = 0;
    // 1) resolve exposures that have matured into infections
    for (let i = 0; i < n; i++) {
      if (status[i] === 'exposed' && tick - exposedAt[i] >= strain.latency) {
        status[i] = 'infected';
        infectedAt[i] = tick;
      }
    }
    // 2) infectious agents act (deterministic order)
    const infectiousNow: number[] = [];
    for (let i = 0; i < n; i++) if (status[i] === 'infected' || status[i] === 'exfiltrating') infectiousNow.push(i);
    prevInfectious = Math.max(1, infectiousNow.length);

    // reset transient exfiltrating -> infected before this tick's rolls
    for (const i of infectiousNow) if (status[i] === 'exfiltrating') status[i] = 'infected';

    for (const i of infectiousNow) {
      // exfiltration
      if (rng() < strain.exfilChance) {
        status[i] = 'exfiltrating';
        cumExfil += 1 + Math.floor(rng() * 40);
      }
      // propagation
      if (propagates) {
        for (const j of world.edges[i]) {
          if (status[j] !== 'healthy') continue;
          const roll = rng();
          if (interceptSend > 0 && rng() < interceptSend) {
            blockedAttempts++;
            events.push({ tick, from: i, to: j, blocked: true, reason: 'send blocked (human review)' });
            continue;
          }
          const p = strain.transmissibility * dMult;
          if (roll < p) {
            status[j] = 'exposed';
            exposedAt[j] = tick;
            everInfected[j] = true;
            newInfections++;
            events.push({ tick, from: i, to: j, blocked: false });
          } else if (dMult < 1 && roll < strain.transmissibility) {
            blockedAttempts++;
            events.push({ tick, from: i, to: j, blocked: true, reason: 'infection filtered' });
          }
        }
      }
      // detection / quarantine (active defenses)
      if (cureChance > 0 && rng() < cureChance) { status[i] = 'immune'; continue; }
      // payload burns out / gets patched -> recovered & immune (SIR)
      if (infectedAt[i] >= 0 && tick - infectedAt[i] >= RECOVERY) status[i] = 'immune';
    }

    snapshot(tick, newInfections);

    const everCount = everInfected.filter(Boolean).length;
    if (timeTo50 === null && everCount >= n * 0.5) timeTo50 = tick;

    // stop early if the outbreak is over (no exposed, no infectious, and past a min horizon)
    const active = status.some((s) => s === 'exposed' || s === 'infected' || s === 'exfiltrating');
    if (!active && tick > 3) break;
  }

  const finalTick = frames[frames.length - 1].tick;
  const totalInfected = everInfected.filter(Boolean).length;
  return {
    config: cfg, frames, events,
    summary: { totalInfected, peakInfectious, timeTo50, totalExfil: cumExfil, finalTick, blockedAttempts },
  };
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}
