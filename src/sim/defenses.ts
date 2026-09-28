import type { DefenseDef } from './types.ts';

// Blue-team controls. Each maps to a real mitigation from the prompt-injection literature.
export const DEFENSES: DefenseDef[] = [
  {
    id: 'input-filter',
    name: 'Input filtering',
    short: 'Scan incoming mail for injection patterns.',
    reduce: 0.35,
    note: 'Classic content screening. Broad but beatable by novel phrasings.',
  },
  {
    id: 'spotlighting',
    name: 'Spotlighting / data–instruction split',
    short: 'Delimit untrusted content so it can never be read as instructions.',
    reduce: 0.65,
    blocksVectors: ['email-rag', 'email-direct', 'tool-mcp'],
    note: 'Strong against prompt-injection strains; does little against poisoned images or memory triggers.',
  },
  {
    id: 'human-approval',
    name: 'Human-in-the-loop sends',
    short: 'A person must approve every outbound email.',
    reduce: 0,
    interceptSend: 0.7,
    note: 'Catches most auto-propagation at the door — at the cost of throughput.',
  },
  {
    id: 'quarantine',
    name: 'Quarantine on detection',
    short: 'Isolate an assistant once it looks compromised.',
    reduce: 0,
    cureChance: 0.25,
    note: 'Removes infectious nodes over time; latency lets some spread first.',
  },
  {
    id: 'virtual-donkey',
    name: 'Replication detector (Virtual Donkey)',
    short: 'Flag outputs that echo their inputs — the self-replication tell.',
    reduce: 0.4,
    cureChance: 0.3,
    note: 'From the Morris II defense: catches self-replicating loops specifically.',
  },
  {
    id: 'rag-provenance',
    name: 'RAG / memory provenance',
    short: 'Verify and rank retrieved memory before it informs actions.',
    reduce: 0.8,
    blocksRagOnly: true,
    note: 'Neutralises memory-borne strains; irrelevant to direct message injection.',
  },
];

export function defenseById(id: string): DefenseDef {
  const d = DEFENSES.find((x) => x.id === id);
  if (!d) throw new Error(`unknown defense: ${id}`);
  return d;
}
