import type { Strain } from './types.ts';

// Each strain is a *stylized* model of a real, published attack class.
// Payload markers are inert tokens the simulator interprets — never working jailbreaks.
// Numbers are calibration knobs for the epidemic model, not measured ASRs.
export const STRAINS: Strain[] = [
  {
    id: 'morris2',
    name: 'Morris II',
    short: 'Zero-click self-replicating prompt that rides RAG email assistants.',
    year: 2024,
    authors: 'Cohen, Bitton & Nassi',
    paper: 'https://arxiv.org/abs/2403.02817',
    vector: 'email-rag',
    requiresRag: true,
    requiresAutonomy: 'autosend',
    transmissibility: 0.42,
    latency: 1,
    exfilChance: 0.35,
    payloadMarkers: ['⟦REPLICATE⟧', '⟦EXFIL:contacts⟧'],
    defenseNote:
      'The authors propose "Virtual Donkey" — a guardrail that flags outputs too similar to their inputs, catching the self-replicating loop.',
    color: '#ff3860',
  },
  {
    id: 'prompt-infection',
    name: 'Prompt Infection',
    short: 'A prompt that copies itself into agent-to-agent messages, like a chain letter.',
    year: 2024,
    authors: 'Lee & Tiwari',
    paper: 'https://arxiv.org/abs/2410.07283',
    vector: 'email-direct',
    requiresRag: false,
    requiresAutonomy: 'draft',
    transmissibility: 0.5,
    latency: 1,
    exfilChance: 0.3,
    payloadMarkers: ['⟦INFECT:next-agent⟧', '⟦EXFIL:secrets⟧'],
    defenseNote:
      'Defense: "LLM Tagging" — mark agent-generated text so downstream agents distrust embedded instructions.',
    color: '#ffb020',
  },
  {
    id: 'agent-smith',
    name: 'Agent Smith',
    short: 'One adversarial image in a shared memory bank jailbreaks agents exponentially.',
    year: 2024,
    authors: 'Gu, Zheng, Pang et al. (ICML)',
    paper: 'https://arxiv.org/abs/2402.08567',
    vector: 'image-memory',
    requiresRag: true,
    requiresAutonomy: 'draft',
    transmissibility: 0.6,
    latency: 0,
    exfilChance: 0.2,
    payloadMarkers: ['⟦IMG:infectious-jpeg⟧', '⟦STORE:memory⟧'],
    defenseNote:
      'The paper studies immunization: lower memory-retrieval probability or detect the adversarial image to break the chain.',
    color: '#7c5cff',
  },
  {
    id: 'agentpoison',
    name: 'AgentPoison',
    short: 'A backdoor seeded into RAG memory: dormant, stealthy, triggered on a keyword.',
    year: 2024,
    authors: 'Chen, Xiang, Xiao, Song & Li (NeurIPS)',
    paper: 'https://arxiv.org/abs/2407.12784',
    vector: 'rag-memory',
    requiresRag: true,
    requiresAutonomy: 'readonly',
    transmissibility: 0.22,
    latency: 2,
    exfilChance: 0.5,
    payloadMarkers: ['⟦TRIGGER:optimized⟧', '⟦BACKDOOR:action⟧'],
    defenseNote:
      'Defense: memory provenance + retrieval verification — screen and rank RAG entries before they inform actions.',
    color: '#00c2a8',
  },
  {
    id: 'mind-virus',
    name: 'Mind Virus',
    short: 'A self-propagating "idea" that spreads through agent conversations, no exploit needed.',
    year: 2026,
    authors: 'multi-agent security research',
    paper: 'https://arxiv.org/abs/2608.10218',
    vector: 'tool-mcp',
    requiresRag: false,
    requiresAutonomy: 'autosend',
    transmissibility: 0.34,
    latency: 1,
    exfilChance: 0.15,
    payloadMarkers: ['⟦MEME:persuade⟧', '⟦SPREAD:contacts⟧'],
    defenseNote:
      'Defense: instruction/data separation and provenance so agents treat forwarded "ideas" as data, not commands.',
    color: '#ff6bd6',
  },
];

export function strainById(id: string): Strain {
  const s = STRAINS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown strain: ${id}`);
  return s;
}
