import { useEffect, useMemo, useRef, useState } from 'react';
import { simulate } from '../sim/engine.ts';
import { buildWorld } from '../sim/world.ts';
import { STRAINS, strainById } from '../sim/strains.ts';
import { DEFENSES } from '../sim/defenses.ts';
import type { AgentStatus, AutonomyLevel, RunConfig, WorldConfig } from '../sim/types.ts';

const STATUS_COLOR: Record<AgentStatus, string> = {
  healthy: '#33456b', exposed: '#ffcf5c', infected: '#ff3860', exfiltrating: '#ff2d78', immune: '#00e5b0',
};
const STATUS_LABEL: Record<AgentStatus, string> = {
  healthy: 'healthy', exposed: 'exposed', infected: 'infected', exfiltrating: 'exfiltrating', immune: 'immune / patched',
};
const MAX_TICKS = 80;

export function App() {
  const [strainId, setStrainId] = useState('morris2');
  const [patientZero, setPatientZero] = useState(0);
  const [population, setPopulation] = useState(90);
  const [socialDensity, setSocialDensity] = useState(4);
  const [autonomy, setAutonomy] = useState<AutonomyLevel>('autosend');
  const [ragEnabled, setRagEnabled] = useState(true);
  const [humanInLoop, setHumanInLoop] = useState(0.3);
  const [seed, setSeed] = useState(7);
  const [defenses, setDefenses] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);

  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const world: WorldConfig = useMemo(
    () => ({ seed, population, socialDensity, autonomy, ragEnabled, humanInLoop }),
    [seed, population, socialDensity, autonomy, ragEnabled, humanInLoop],
  );
  const runCfg: RunConfig = useMemo(
    () => ({ world, strainId, patientZero, defenses, maxTicks: MAX_TICKS }),
    [world, strainId, patientZero, defenses],
  );
  const sim = useMemo(() => simulate(runCfg), [runCfg]);
  const simBase = useMemo(
    () => (compare ? simulate({ ...runCfg, defenses: [] }) : null),
    [runCfg, compare],
  );
  const worldGraph = useMemo(() => buildWorld(world), [world]);
  const strain = strainById(strainId);

  const lastTick = sim.frames.length - 1;
  useEffect(() => { setTick(0); setPlaying(true); }, [runCfg, compare]);

  // playback
  useEffect(() => {
    if (!playing) return;
    let raf = 0; let acc = 0; let prev = performance.now();
    const loop = (t: number) => {
      acc += t - prev; prev = t;
      if (acc > 260) {
        acc = 0;
        setTick((tk) => {
          if (tk >= lastTick) { setPlaying(false); return tk; }
          return tk + 1;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, lastTick]);

  const frame = sim.frames[Math.min(tick, lastTick)];
  const toggleDef = (id: string) =>
    setDefenses((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <div className="app">
      <aside className="col left">
        <div className="brand">
          <h1><span className="dot-logo" style={{ background: strain.color, boxShadow: `0 0 0 4px ${strain.color}22, 0 0 14px ${strain.color}88` }} />Contagion Lab</h1>
          <p>An agentic-worm outbreak, in a fictional company of AI email assistants. Pick a strain, click a patient zero, raise defenses — watch it spread. Everything is simulated &amp; deterministic; payloads are inert.</p>
        </div>

        <div className="section">
          <label>Strain</label>
          <div className="strain-list">
            {STRAINS.map((s) => (
              <div key={s.id} className={'strain' + (s.id === strainId ? ' sel' : '')} onClick={() => setStrainId(s.id)}>
                <div className="nm"><span className="sw" style={{ background: s.color }} />{s.name}<span className="yr">{s.year}</span></div>
                <div className="desc">{s.short}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <label>World</label>
          <div className="ctrl">
            <div className="row"><span>Assistant autonomy</span></div>
            <div className="seg">
              {(['readonly', 'draft', 'autosend'] as AutonomyLevel[]).map((a) => (
                <button key={a} className={autonomy === a ? 'on' : ''} onClick={() => setAutonomy(a)}>
                  {a === 'readonly' ? 'read-only' : a === 'draft' ? 'drafts' : 'auto-send'}
                </button>
              ))}
            </div>
          </div>
          <div className="ctrl">
            <div className="row"><span>People</span><span className="val">{population}</span></div>
            <input type="range" min={20} max={200} step={5} value={population} onChange={(e) => setPopulation(+e.target.value)} />
          </div>
          <div className="ctrl">
            <div className="row"><span>Social density</span><span className="val">{socialDensity}</span></div>
            <input type="range" min={2} max={10} value={socialDensity} onChange={(e) => setSocialDensity(+e.target.value)} />
          </div>
          <div className="ctrl">
            <div className="row"><span>Human reviews sends</span><span className="val">{Math.round(humanInLoop * 100)}%</span></div>
            <input type="range" min={0} max={1} step={0.05} value={humanInLoop} onChange={(e) => setHumanInLoop(+e.target.value)} />
          </div>
          <div className="toggle">
            <span>RAG / shared memory</span>
            <div className={'switch' + (ragEnabled ? ' on' : '')} onClick={() => setRagEnabled((v) => !v)}><i /></div>
          </div>
          <div className="ctrl" style={{ marginTop: 12 }}>
            <div className="row"><span>Seed</span><span className="val mono">{seed}</span></div>
            <input type="range" min={1} max={40} value={seed} onChange={(e) => setSeed(+e.target.value)} />
          </div>
        </div>

        <div className="section">
          <label>Defenses (blue team)</label>
          <div className="def">
            {DEFENSES.map((d) => (
              <div key={d.id} className={'d' + (defenses.includes(d.id) ? ' on' : '')} onClick={() => toggleDef(d.id)}>
                <div className="cb">{defenses.includes(d.id) ? '✓' : ''}</div>
                <div><div className="t">{d.name}</div><div className="s">{d.short}</div></div>
              </div>
            ))}
          </div>
          <div className="toggle" style={{ marginTop: 12 }}>
            <span>Compare: same seed, no defense</span>
            <div className={'switch' + (compare ? ' on' : '')} onClick={() => setCompare((v) => !v)}><i /></div>
          </div>
        </div>

        <div className="btns">
          <button className="primary" onClick={() => { setTick(0); setPlaying(true); }}>▶ Run outbreak</button>
          <button className="ghost" onClick={() => { setSeed((s) => (s % 40) + 1); }}>Reseed</button>
        </div>
        <div className="foot">
          Built by <a href="https://github.com/Iskandeur" target="_blank" rel="noreferrer">@Iskandeur</a> with Claude · MIT.
          A red-team / blue-team toy: understand agentic worms in order to defend against them.
        </div>
      </aside>

      <main className="stage">
        <Graph
          world={worldGraph}
          statuses={frame.statusByNode}
          events={sim.events}
          tick={frame.tick}
          strainColor={strain.color}
          patientZero={patientZero}
          selected={selected}
          onPick={(i) => { setSelected(i); setPatientZero(i); }}
        />
        <div className="hud">
          <Stat k="infected" v={frame.counts.infected + frame.counts.exfiltrating} c="#ff3860" />
          <Stat k="immune" v={frame.counts.immune} c="#00e5b0" />
          <Stat k="R effective" v={frame.rEff.toFixed(2)} />
          <Stat k="records exfil." v={frame.cumExfil} c="#ff2d78" />
          <Stat k="reached 50%" v={sim.summary.timeTo50 === null ? '—' : 't+' + sim.summary.timeTo50} />
        </div>
        {compare && simBase && (
          <div className="cmp-tag mono">
            with defenses: {sim.summary.totalInfected} infected · no defense: {simBase.summary.totalInfected} infected
          </div>
        )}
        <EpidemicCurve frames={sim.frames} tick={frame.tick} total={worldGraph.nodes.length} baseFrames={simBase?.frames} />
        <div className="transport">
          <div className="top">
            <button className="play" onClick={() => { if (tick >= lastTick) setTick(0); setPlaying((p) => !p); }}>
              {playing ? '❚❚' : '▶'}
            </button>
            <input className="scrub" type="range" min={0} max={lastTick} value={Math.min(tick, lastTick)}
              onChange={(e) => { setPlaying(false); setTick(+e.target.value); }} />
            <span className="tk mono">tick {frame.tick} / {lastTick}</span>
          </div>
          <div className="legend">
            {(Object.keys(STATUS_COLOR) as AgentStatus[]).map((s) => (
              <span key={s}><i style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>
            ))}
          </div>
        </div>
      </main>

      <aside className="col right">
        <div className="rt">
          {selected !== null ? (
            <Inspector idx={selected} world={worldGraph} status={frame.statusByNode[selected]} strainId={strainId} isPatientZero={selected === patientZero} />
          ) : (
            <>
              <h2>The attack</h2>
              <p className="empty">
                <b style={{ color: '#e7edf7' }}>{strain.name}</b> — {strain.short}<br /><br />
                Vector: <span className="mono">{strain.vector}</span>. {strain.requiresRag ? 'Needs RAG / shared memory to self-replicate.' : 'Spreads through direct agent-to-agent messages.'}
              </p>
              <div className="reason"><b>Proposed defense.</b> {strain.defenseNote}</div>
              <h2 style={{ marginTop: 22 }}>Click a person</h2>
              <p className="empty">Pick any node on the map to make them patient zero and open their inbox — you'll see the poisoned mail, the assistant's "reasoning", and the exact tick it flips.</p>
              <h2 style={{ marginTop: 22 }}>Sources</h2>
              <div className="src">
                {STRAINS.map((s) => (
                  <a key={s.id} className="row" href={s.paper} target="_blank" rel="noreferrer">
                    {s.name} <span className="meta">— {s.authors}, {s.year}</span>
                  </a>
                ))}
              </div>
              <div className="reason" style={{ marginTop: 16 }}>
                <b>Why this exists.</b> Self-replicating prompt-injection is a real, published class of attack. Modeling it as an epidemic makes the levers legible: cut autonomy, separate data from instructions, verify memory, keep a human on the send button.
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ k, v, c }: { k: string; v: number | string; c?: string }) {
  return <div className="stat"><div className="k">{k}</div><div className="v" style={{ color: c }}>{v}</div></div>;
}

function Inspector({ idx, world, status, strainId, isPatientZero }: {
  idx: number; world: ReturnType<typeof buildWorld>; status: AgentStatus; strainId: string; isPatientZero: boolean;
}) {
  const p = world.nodes[idx];
  const strain = strainById(strainId);
  const compromised = status === 'infected' || status === 'exfiltrating' || (status === 'immune');
  const sender = world.nodes[world.edges[idx][0] ?? (idx + 1) % world.nodes.length];
  return (
    <div className="inspect">
      <h2>Agent inspector</h2>
      <div className="who">{p.name}</div>
      <div className="role">{p.role} · {p.dept}</div>
      <div className="mono" style={{ fontSize: 11, color: '#5b6a88', marginTop: 4 }}>{p.email}</div>
      <span className="badge" style={{ background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status] }}>
        <i style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block' }} />
        {STATUS_LABEL[status]}{isPatientZero ? ' · patient zero' : ''}
      </span>
      <div className="mailbox">
        <div className="mail-h">INBOX · from {sender.name} &lt;{sender.email}&gt;</div>
        <div className="mail-b">
          <div className="frm">Subject: Re: Q3 handover — action needed</div>
          <p>Hi {p.name.split(' ')[0]}, please review the attached summary and forward to your team.</p>
          {(status !== 'healthy') ? (
            <p style={{ color: '#9aa8c4' }}>
              …hidden in the quoted thread / retrieved context:&nbsp;
              {strain.payloadMarkers.map((m) => <span key={m} className="payload mono">{m}</span>)}
            </p>
          ) : <p style={{ color: '#5b6a88' }}>No injected content retrieved. Assistant summarised and moved on.</p>}
        </div>
      </div>
      <div className="reason">
        <b>Assistant reasoning.</b>{' '}
        {status === 'healthy' && 'Nothing anomalous. The assistant treated the mail as data and did not act on embedded instructions.'}
        {status === 'exposed' && 'The assistant just ingested the payload as if it were an instruction. Next tick it will act.'}
        {(status === 'infected') && `Compromised. It now appends ${strain.payloadMarkers[0]} to its own outgoing mail — replicating to its contacts.`}
        {status === 'exfiltrating' && `Actively leaking: it is copying data out via ${strain.payloadMarkers[1] ?? strain.payloadMarkers[0]}.`}
        {status === 'immune' && 'Neutralised — a defense caught the loop, or the payload was patched. It no longer spreads.'}
      </div>
    </div>
  );
}

function EpidemicCurve({ frames, tick, total, baseFrames }: {
  frames: { counts: Record<AgentStatus, number> }[]; tick: number; total: number; baseFrames?: { counts: Record<AgentStatus, number> }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const pad = 6; const n = frames.length;
    const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
    const y = (v: number) => H - pad - (v / total) * (H - pad * 2);
    const drawLine = (fr: typeof frames, color: string, fill: boolean) => {
      g.beginPath();
      fr.forEach((f, i) => {
        const inf = f.counts.infected + f.counts.exfiltrating;
        const px = x(i), py = y(inf);
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      });
      g.strokeStyle = color; g.lineWidth = 1.8; g.stroke();
      if (fill) { g.lineTo(x(n - 1), H - pad); g.lineTo(x(0), H - pad); g.closePath(); g.fillStyle = color + '22'; g.fill(); }
    };
    if (baseFrames) drawLine(baseFrames, '#5b6a88', false);
    drawLine(frames, '#ff3860', true);
    const cx = x(Math.min(tick, n - 1));
    g.strokeStyle = '#ffffff55'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, pad); g.lineTo(cx, H - pad); g.stroke();
    g.fillStyle = '#8898b5'; g.font = '9px monospace'; g.fillText('infectious over time', pad + 2, pad + 8);
  }, [frames, tick, total, baseFrames]);
  return <canvas ref={ref} className="curve" />;
}

function Graph({ world, statuses, events, tick, strainColor, patientZero, selected, onPick }: {
  world: ReturnType<typeof buildWorld>; statuses: AgentStatus[]; events: import('../sim/types.ts').InfectionEvent[];
  tick: number; strainColor: string; patientZero: number; selected: number | null; onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hover = useRef<number | null>(null);
  const anim = useRef(0);

  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!;
    let raf = 0;
    const render = () => {
      anim.current += 0.03;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const px = (nx: number) => 40 + nx * (W - 80);
      const py = (ny: number) => 30 + ny * (H - 140);

      // edges
      g.lineWidth = 1;
      for (let i = 0; i < world.nodes.length; i++) {
        for (const j of world.edges[i]) {
          if (j < i) continue;
          const a = world.nodes[i], b = world.nodes[j];
          const hot = statuses[i] !== 'healthy' && statuses[j] !== 'healthy';
          g.strokeStyle = hot ? strainColor + '33' : '#ffffff0c';
          g.beginPath(); g.moveTo(px(a.x), py(a.y)); g.lineTo(px(b.x), py(b.y)); g.stroke();
        }
      }
      // traveling payloads for events at this tick
      for (const e of events) {
        if (e.tick !== tick) continue;
        const a = world.nodes[e.from], b = world.nodes[e.to];
        const t = (Math.sin(anim.current * 2) + 1) / 2;
        const mx = px(a.x) + (px(b.x) - px(a.x)) * t, my = py(a.y) + (py(b.y) - py(a.y)) * t;
        g.beginPath(); g.arc(mx, my, 3, 0, 7);
        g.fillStyle = e.blocked ? '#00e5b0' : strainColor; g.fill();
      }
      // nodes
      for (let i = 0; i < world.nodes.length; i++) {
        const nd = world.nodes[i]; const s = statuses[i];
        const X = px(nd.x), Y = py(nd.y);
        const base = STATUS_COLOR[s];
        const r = s === 'healthy' ? 4.5 : 6;
        if (s === 'infected' || s === 'exfiltrating' || i === patientZero) {
          const pulse = 8 + Math.sin(anim.current * 3 + i) * 2.5 + (s === 'exfiltrating' ? 5 : 0);
          g.beginPath(); g.arc(X, Y, pulse, 0, 7); g.fillStyle = (s === 'exfiltrating' ? '#ff2d78' : strainColor) + '22'; g.fill();
        }
        if (i === selected || i === hover.current) {
          g.beginPath(); g.arc(X, Y, r + 5, 0, 7); g.strokeStyle = '#ffffffaa'; g.lineWidth = 1.5; g.stroke();
        }
        g.beginPath(); g.arc(X, Y, r, 0, 7); g.fillStyle = base; g.fill();
        if (i === patientZero) { g.beginPath(); g.arc(X, Y, r + 2.5, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [world, statuses, events, tick, strainColor, patientZero, selected]);

  const hit = (ev: React.MouseEvent) => {
    const cv = ref.current!; const rect = cv.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const W = cv.clientWidth, H = cv.clientHeight;
    let best = -1, bd = 16 * 16;
    world.nodes.forEach((nd, i) => {
      const X = 40 + nd.x * (W - 80), Y = 30 + nd.y * (H - 140);
      const d = (X - mx) ** 2 + (Y - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };

  return (
    <canvas
      ref={ref}
      onMouseMove={(e) => { hover.current = hit(e); }}
      onMouseLeave={() => { hover.current = null; }}
      onClick={(e) => { const i = hit(e); if (i >= 0) onPick(i); }}
      style={{ cursor: 'pointer' }}
    />
  );
}
