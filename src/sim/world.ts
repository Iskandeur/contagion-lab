import { makeRng, hashStr, pick } from './rng.ts';
import type { World, WorldConfig, Node } from './types.ts';

const FIRST = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ravi', 'Yuki', 'Omar', 'Ines', 'Kai',
  'Lena', 'Theo', 'Nora', 'Sam', 'Aya', 'Enzo', 'Priya', 'Hugo', 'Lucia', 'Milo',
  'Nina', 'Otto', 'Sana', 'Tariq', 'Vera', 'Wei', 'Xan', 'Yara', 'Zane', 'Cleo'];
const LAST = ['Okoro', 'Nakamura', 'Silva', 'Haddad', 'Novak', 'Ferrari', 'Kim', 'Dubois',
  'Patel', 'Andersson', 'Rossi', 'Costa', 'Weber', 'Moreau', 'Ivanov', 'Reyes', 'Tan', 'Berg'];

const DEPARTMENTS = [
  { name: 'Executive', roles: ['CEO', 'COO', 'Chief of Staff'], color: '#ff3860' },
  { name: 'Sales', roles: ['AE', 'SDR', 'Sales Lead'], color: '#ffb020' },
  { name: 'Engineering', roles: ['Engineer', 'Staff Eng', 'EM'], color: '#00e5b0' },
  { name: 'Finance', roles: ['Analyst', 'Controller', 'CFO'], color: '#7c5cff' },
  { name: 'Legal', roles: ['Counsel', 'Paralegal', 'GC'], color: '#37b6ff' },
  { name: 'Support', roles: ['Agent', 'Team Lead', 'Ops'], color: '#ff6bd6' },
  { name: 'HR', roles: ['Recruiter', 'HRBP', 'People Lead'], color: '#9be15d' },
];

const COMPANY = 'nimbus-dynamics.example';

// Build a fictional company: people in departments, an email each, and a social graph
// (dense within a department, sparser across). Fully deterministic from config.seed.
export function buildWorld(config: WorldConfig): World {
  const rng = makeRng(config.seed ^ 0x9e3779b9);
  const n = Math.max(3, Math.min(400, Math.floor(config.population)));
  const deptCount = Math.min(DEPARTMENTS.length, Math.max(3, Math.round(n / 12)));
  const depts = DEPARTMENTS.slice(0, deptCount);

  const nodes: Node[] = [];
  const deptColors: Record<string, string> = {};
  for (const d of depts) deptColors[d.name] = d.color;

  const usedEmails = new Set<string>();
  for (let i = 0; i < n; i++) {
    const d = depts[i % deptCount];
    const first = pick(rng, FIRST);
    const last = pick(rng, LAST);
    let handle = `${first}.${last}`.toLowerCase();
    let email = `${handle}@${COMPANY}`;
    let bump = 2;
    while (usedEmails.has(email)) email = `${handle}${bump++}@${COMPANY}`;
    usedEmails.add(email);
    // Cluster layout: departments arranged on a ring, people scattered around the cluster center.
    const di = depts.indexOf(d);
    const ca = (di / deptCount) * Math.PI * 2;
    const cx = 0.5 + Math.cos(ca) * 0.32;
    const cy = 0.5 + Math.sin(ca) * 0.32;
    const r = 0.04 + rng() * 0.12;
    const a = rng() * Math.PI * 2;
    nodes.push({
      id: `n${i}`,
      name: `${first} ${last}`,
      role: pick(rng, d.roles),
      dept: d.name,
      email,
      x: Math.max(0.04, Math.min(0.96, cx + Math.cos(a) * r)),
      y: Math.max(0.06, Math.min(0.94, cy + Math.sin(a) * r)),
    });
  }

  // Social graph: each person emails `socialDensity` contacts, biased toward same department.
  const density = Math.max(1, Math.min(12, config.socialDensity));
  const edges: number[][] = nodes.map(() => []);
  const byDept: Record<string, number[]> = {};
  nodes.forEach((nd, i) => (byDept[nd.dept] ||= []).push(i));

  for (let i = 0; i < n; i++) {
    const erng = makeRng(hashStr(nodes[i].id) ^ config.seed);
    const target = new Set<number>();
    const sameDept = byDept[nodes[i].dept].filter((j) => j !== i);
    let guard = 0;
    while (target.size < density && guard++ < density * 20) {
      const crossDept = erng() < 0.3;
      let j: number;
      if (crossDept || sameDept.length === 0) {
        j = Math.floor(erng() * n);
      } else {
        j = sameDept[Math.floor(erng() * sameDept.length)];
      }
      if (j !== i) target.add(j);
    }
    edges[i] = [...target].sort((a, b) => a - b);
    // make undirected-ish: mirror a fraction so contagion can flow both ways
    for (const j of edges[i]) if (erng() < 0.6 && !edges[j].includes(i)) edges[j].push(i);
  }
  for (let i = 0; i < n; i++) edges[i].sort((a, b) => a - b);

  return { config, nodes, edges, deptColors };
}
