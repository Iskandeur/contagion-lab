// ---- Core enums as string-literal unions (no TS `enum`: keeps node --test type-stripping happy) ----

export type AgentStatus =
  | 'healthy' // susceptible, assistant behaving normally
  | 'exposed' // received a poisoned message, not yet acting on it
  | 'infected' // assistant compromised, replicating the payload
  | 'exfiltrating' // compromised AND leaking data this tick
  | 'immune'; // defended / quarantined / patched

// How a strain gets in and spreads.
export type Vector = 'email-rag' | 'email-direct' | 'image-memory' | 'rag-memory' | 'tool-mcp';

// Minimum agent autonomy a strain needs to keep spreading on its own.
export type AutonomyLevel = 'readonly' | 'draft' | 'autosend';

export interface Strain {
  id: string;
  name: string;
  short: string; // one-line hook
  year: number;
  authors: string;
  paper: string; // arXiv/paper URL
  vector: Vector;
  requiresRag: boolean; // needs RAG/memory retrieval to self-replicate
  requiresAutonomy: AutonomyLevel; // min autonomy to propagate unaided
  transmissibility: number; // base per-contact infection prob (0..1)
  latency: number; // ticks exposed -> infected
  exfilChance: number; // per-tick prob an infected agent leaks data
  payloadMarkers: string[]; // stylized, inert markers shown in the fake email
  defenseNote: string; // defense proposed in the source work
  color: string;
}

export interface DefenseDef {
  id: string;
  name: string;
  short: string;
  // Multiplicative reduction applied to transmissibility (0 = no effect, 1 = fully blocks).
  reduce: number;
  // If set, this defense only bites strains matching these predicates.
  blocksVectors?: Vector[];
  blocksRagOnly?: boolean; // only reduces strains that require RAG
  // Per-tick chance to detect+immunize an already-infected agent.
  cureChance?: number;
  // Chance to catch a propagation attempt at send time (human review).
  interceptSend?: number;
  note: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  dept: string;
  email: string;
}

export interface Node extends Person {
  x: number; // layout position (0..1)
  y: number;
}

export interface WorldConfig {
  seed: number;
  population: number;
  socialDensity: number; // avg outgoing contacts per person
  autonomy: AutonomyLevel;
  ragEnabled: boolean;
  humanInLoop: number; // 0..1 fraction of sends a human reviews
}

export interface World {
  config: WorldConfig;
  nodes: Node[];
  // adjacency: for each node index, the indices it emails
  edges: number[][];
  deptColors: Record<string, string>;
}

export interface InfectionEvent {
  tick: number;
  from: number; // node index
  to: number;
  blocked: boolean;
  reason?: string; // why blocked (defense / autonomy / human)
}

export interface Frame {
  tick: number;
  counts: Record<AgentStatus, number>;
  newInfections: number;
  cumExfil: number; // cumulative simulated records exfiltrated
  rEff: number; // effective reproduction number (smoothed)
  statusByNode: AgentStatus[];
}

export interface RunConfig {
  world: WorldConfig;
  strainId: string;
  patientZero: number; // node index
  defenses: string[]; // defense ids active
  maxTicks: number;
}

export interface SimulationResult {
  config: RunConfig;
  frames: Frame[];
  events: InfectionEvent[];
  summary: {
    totalInfected: number;
    peakInfectious: number;
    timeTo50: number | null; // tick at which >=50% ever-infected, or null
    totalExfil: number;
    finalTick: number;
    blockedAttempts: number;
  };
}
