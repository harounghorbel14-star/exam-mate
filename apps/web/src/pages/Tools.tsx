import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  safeEvaluate, formatNumber, convertUnits, PHYSICS_FORMULAS, FORMULA_PAIRS, ELEMENTS, balanceEquation, molarMass, sampleFunction, normalizeMathInput,
  type ChemicalElement, type MessageKey,
} from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/online';
import { api } from '../lib/api';
import { readJson, writeJson } from '../lib/kv';
import { MathTex } from '../components/Math';
import { PageHead } from '../components/ui';

type ToolId = 'calculator' | 'scientific' | 'units' | 'formulas' | 'periodic' | 'chem' | 'graph' | 'notes' | 'timer' | 'saved' | 'bookmarks' | 'recent';
const TOOLS: Array<{ id: ToolId; key: MessageKey; offline: boolean }> = [
  { id: 'calculator', key: 'tools.calculator', offline: true }, { id: 'scientific', key: 'tools.scientific', offline: true },
  { id: 'units', key: 'tools.units', offline: true }, { id: 'formulas', key: 'tools.formulas', offline: true },
  { id: 'periodic', key: 'tools.periodic', offline: true }, { id: 'chem', key: 'tools.chem', offline: true },
  { id: 'graph', key: 'tools.graph', offline: true }, { id: 'timer', key: 'tools.timer', offline: true },
  { id: 'notes', key: 'tools.notes', offline: true }, { id: 'saved', key: 'tools.saved', offline: false },
  { id: 'bookmarks', key: 'tools.bookmarks', offline: false }, { id: 'recent', key: 'tools.recent', offline: false },
];

function Calculator({ scientific }: { scientific: boolean }) {
  const { t } = useI18n();
  const [expr, setExpr] = useState('');
  const [deg, setDeg] = useState(true);
  const [history, setHistory] = useState<string[]>(() => readJson('exammate.calc.history', []));
  const result = useMemo(() => {
    if (!expr.trim()) return '';
    try {
      let e = normalizeMathInput(expr);
      if (scientific && deg) e = e.replace(/\b(sin|cos|tan)\(/g, '$1(pi/180*');
      const v = safeEvaluate(e);
      return typeof v === 'number' ? formatNumber(v, 12) : String(v);
    } catch { return '…'; }
  }, [expr, deg, scientific]);
  const keys = scientific
    ? ['sin(', 'cos(', 'tan(', 'log10(', 'log(', 'sqrt(', '^', '(', ')', 'pi', 'e', '!', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+']
    : ['7', '8', '9', '/', '(', '4', '5', '6', '*', ')', '1', '2', '3', '-', '^', '0', '.', '%', '+', '√('];
  const commit = () => { if (result && result !== '…') { const h = [`${expr} = ${result}`, ...history].slice(0, 20); setHistory(h); writeJson('exammate.calc.history', h); setExpr(result); } };
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <input className="input mono ltr" style={{ fontSize: '1.3rem' }} value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} aria-label={t('tools.calculator')} />
      <div className="ltr" style={{ fontSize: '1.6rem', fontWeight: 700, minHeight: '2rem', textAlign: 'end' }} aria-live="polite">{result && `= ${result}`}</div>
      {scientific && <label className="row faint"><input type="checkbox" checked={deg} onChange={(e) => setDeg(e.target.checked)} /> DEG</label>}
      <div className="calc-grid">
        {keys.map((k) => <button key={k} className="btn" onClick={() => setExpr((x) => x + (k === '√(' ? 'sqrt(' : k))}>{k}</button>)}
        <button className="btn" onClick={() => setExpr((x) => x.slice(0, -1))}>⌫</button>
        <button className="btn" onClick={() => setExpr('')}>C</button>
        <button className="btn primary" onClick={commit}>=</button>
      </div>
      {history.length > 0 && <ul className="list">{history.slice(0, 6).map((h, i) => <li key={i} className="list-item ltr mono">{h}</li>)}</ul>}
    </div>
  );
}

const UNIT_GROUPS: Record<string, string[]> = {
  length: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'], mass: ['mg', 'g', 'kg', 'tonne', 'lb', 'oz'], time: ['ms', 's', 'min', 'h', 'day', 'week'],
  speed: ['m/s', 'km/h', 'mi/h', 'knot'], temperature: ['degC', 'degF', 'K'], area: ['cm^2', 'm^2', 'km^2', 'hectare', 'acre'],
  volume: ['mL', 'L', 'cm^3', 'm^3', 'gallon'], energy: ['J', 'kJ', 'cal', 'kcal', 'Wh', 'kWh', 'eV'], pressure: ['Pa', 'kPa', 'bar', 'atm', 'mmHg', 'psi'],
  force: ['N', 'kN', 'lbf'], power: ['W', 'kW', 'hp'],
};

function Units() {
  const { t } = useI18n();
  const [group, setGroup] = useState('length');
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('m');
  const [value, setValue] = useState('1');
  const units = UNIT_GROUPS[group]!;
  let out = '';
  try { out = convertUnits(Number(value), from, to).answer; } catch (e) { out = (e as Error).message; }
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <div className="chips">{Object.keys(UNIT_GROUPS).map((g) => <button key={g} className="chip" aria-pressed={group === g} onClick={() => { setGroup(g); setFrom(UNIT_GROUPS[g]![0]!); setTo(UNIT_GROUPS[g]![1]!); }}>{g}</button>)}</div>
      <div className="grid cols-3">
        <div className="field"><label htmlFor="uv">{t('tools.value')}</label><input id="uv" className="input ltr" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        <div className="field"><label htmlFor="uf">{t('tools.from')}</label><select id="uf" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div className="field"><label htmlFor="ut">{t('tools.to')}</label><select id="ut" className="input" value={to} onChange={(e) => setTo(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select></div>
      </div>
      <div className="card ltr" style={{ fontSize: '1.3rem', fontWeight: 650 }} aria-live="polite">{out}</div>
    </div>
  );
}

function Formulas() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState('');
  const items = [
    ...PHYSICS_FORMULAS.map((f) => ({ name: f.name, tex: f.latex, topic: f.topic })),
    ...FORMULA_PAIRS.map((f) => ({ name: f.name[locale], tex: f.formula.replace('½', '\\tfrac12 ').replace('π', '\\pi ').replace('Δ', '\\Delta ').replace('−', '-'), topic: 'general' })),
  ].filter((f) => !q || `${f.name} ${f.topic} ${f.tex}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack">
      <input className="input" placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid cols-3">{items.map((f, i) => <div key={i} className="card"><div className="row between"><strong>{f.name}</strong><span className="badge">{f.topic}</span></div><MathTex tex={f.tex} block /></div>)}</div>
    </div>
  );
}

function Periodic() {
  const { locale } = useI18n();
  const [sel, setSel] = useState<ChemicalElement | null>(ELEMENTS[0]!);
  // Position: main table by group/period; f-block (lanthanides/actinides) in rows 9–10.
  const pos = (e: ChemicalElement) => {
    if (e.category === 'lanthanide') return { col: e.z - 57 + 3, row: 9 };
    if (e.category === 'actinide') return { col: e.z - 89 + 3, row: 10 };
    return { col: e.group ?? 1, row: e.period };
  };
  return (
    <div className="stack">
      {sel && <div className="card row"><span style={{ fontSize: '2rem', fontWeight: 800 }}>{sel.symbol}</span><div><strong>{sel.name[locale]}</strong><div className="faint ltr">Z = {sel.z} · {sel.mass} g/mol · {sel.category}{sel.group ? ` · group ${sel.group}` : ''} · period {sel.period}</div></div></div>}
      <div style={{ overflowX: 'auto' }}>
        <div className="periodic" style={{ gridTemplateRows: 'repeat(10, auto)' }}>
          {ELEMENTS.map((e) => { const p = pos(e); return (
            <button key={e.z} className={`el ${e.category}`} style={{ gridColumn: p.col, gridRow: p.row }} onClick={() => setSel(e)} aria-label={`${e.name[locale]} (${e.symbol})`}><small>{e.z}</small><b>{e.symbol}</b></button>
          ); })}
        </div>
      </div>
    </div>
  );
}

function Chem() {
  const { t } = useI18n();
  const [eq, setEq] = useState('C3H8 + O2 -> CO2 + H2O');
  const [formula, setFormula] = useState('H2SO4');
  let bal = '', mm = '';
  try { bal = balanceEquation(eq).balanced; } catch (e) { bal = (e as Error).message; }
  try { mm = molarMass(formula).answer; } catch (e) { mm = (e as Error).message; }
  return (
    <div className="grid cols-2">
      <div className="card stack"><label className="label" htmlFor="eq">{t('tools.chem')}</label><input id="eq" className="input ltr mono" value={eq} onChange={(e) => setEq(e.target.value)} /><div className="ltr" style={{ fontSize: '1.2rem', fontWeight: 650 }}>{bal}</div></div>
      <div className="card stack"><label className="label" htmlFor="mm">{t('tools.molarMass')}</label><input id="mm" className="input ltr mono" value={formula} onChange={(e) => setFormula(e.target.value)} /><div className="ltr" style={{ fontSize: '1.2rem', fontWeight: 650 }}>{mm}</div></div>
    </div>
  );
}

function Graph() {
  const [fns, setFns] = useState(['sin(x)', 'x^2/10']);
  const [range, setRange] = useState(10);
  const colors = ['var(--primary)', 'var(--cyan)', 'var(--violet)', 'var(--warning)'];
  const W = 600, H = 280;
  const series = fns.map((f) => { try { return sampleFunction(f, -range, range, 400); } catch { return null; } });
  const ys = series.flatMap((s) => (s ? [s.min, s.max] : [])).filter(Number.isFinite);
  const yMin = Math.max(-1e6, Math.min(-1, ...ys)), yMax = Math.min(1e6, Math.max(1, ...ys));
  const sx = (x: number) => ((x + range) / (2 * range)) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  return (
    <div className="stack">
      {fns.map((f, i) => <div key={i} className="row"><span style={{ color: colors[i], fontWeight: 800 }}>y =</span><input className="input ltr mono" style={{ flex: 1 }} value={f} onChange={(e) => setFns(fns.map((x, j) => (j === i ? e.target.value : x)))} />{series[i] === null && <span className="badge danger">!</span>}</div>)}
      <div className="row">{fns.length < 4 && <button className="btn sm" onClick={() => setFns([...fns, 'x'])}>+ y</button>}<label className="faint">± <input type="number" className="input" style={{ width: 80 }} value={range} min={1} max={1000} onChange={(e) => setRange(Math.max(1, Number(e.target.value)))} /></label></div>
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Function graph">
        <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--border-strong)" />
        <line y1={0} y2={H} x1={sx(0)} x2={sx(0)} stroke="var(--border-strong)" />
        {series.map((s, i) => s && <path key={i} fill="none" stroke={colors[i]} strokeWidth={2} d={s.points.reduce((d, [x, y], j) => (y === null ? d : `${d}${j === 0 || s.points[j - 1]![1] === null ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`), '')} />)}
        <text x={4} y={14} fill="var(--text-faint)" fontSize={11}>{formatNumber(yMax, 4)}</text>
        <text x={4} y={H - 4} fill="var(--text-faint)" fontSize={11}>{formatNumber(yMin, 4)}</text>
      </svg>
    </div>
  );
}

function Timer() {
  const { t } = useI18n();
  const [focus, setFocus] = useState(25);
  const [brk, setBrk] = useState(5);
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(() => readJson<number>('exammate.timer.sessions', 0));
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setLeft((l) => {
      if (l > 1) return l - 1;
      if (phase === 'focus') { const s = sessions + 1; setSessions(s); writeJson('exammate.timer.sessions', s); }
      const next = phase === 'focus' ? 'break' : 'focus';
      setPhase(next);
      try { navigator.vibrate?.(300); } catch { /* ignore */ }
      return (next === 'focus' ? focus : brk) * 60;
    }), 1000);
    return () => clearInterval(i);
  }, [running, phase, focus, brk, sessions]);
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <div className="card" style={{ textAlign: 'center' }}><div className="faint">{t(phase === 'focus' ? 'tools.focus' : 'tools.break')}</div><div className="timer" style={{ fontSize: '3rem' }} role="timer">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div></div>
      <div className="row"><button className="btn primary" onClick={() => setRunning(!running)}>{running ? '❚❚' : '▶'}</button><button className="btn" onClick={() => { setRunning(false); setPhase('focus'); setLeft(focus * 60); }}>{t('common.restart')}</button><span className="faint">✓ {sessions}</span></div>
      <div className="grid cols-2">
        <label className="field"><span className="label">{t('tools.focus')} ({t('common.minutes')})</span><input type="number" className="input" min={1} max={120} value={focus} onChange={(e) => { setFocus(Number(e.target.value)); if (!running && phase === 'focus') setLeft(Number(e.target.value) * 60); }} /></label>
        <label className="field"><span className="label">{t('tools.break')} ({t('common.minutes')})</span><input type="number" className="input" min={1} max={60} value={brk} onChange={(e) => setBrk(Number(e.target.value))} /></label>
      </div>
    </div>
  );
}

interface Note { id: string; title: string; body: string; version: number }
function Notes() {
  const { t } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const remote = !!user && online;
  const [notes, setNotes] = useState<Note[]>(() => readJson('exammate.notes.local', []));
  const [sel, setSel] = useState<Note | null>(null);
  useEffect(() => { if (remote) void api<{ notes: Note[] }>('/account/notes').then((r) => setNotes(r.notes)).catch(() => undefined); }, [remote]);
  const save = async () => {
    if (!sel) return;
    if (remote) {
      const r = sel.id.startsWith('local-')
        ? await api<{ note: Note }>('/account/notes', { method: 'POST', body: { title: sel.title || 'Untitled', body: sel.body } })
        : await api<{ note: Note }>(`/account/notes/${sel.id}`, { method: 'PUT', body: { title: sel.title || 'Untitled', body: sel.body, version: sel.version } });
      setNotes((n) => [r.note, ...n.filter((x) => x.id !== sel.id && x.id !== r.note.id)]); setSel(r.note);
    } else {
      const next = [sel, ...notes.filter((x) => x.id !== sel.id)];
      setNotes(next); writeJson('exammate.notes.local', next);
    }
  };
  return (
    <div className="grid cols-2">
      <div className="stack">
        <button className="btn primary" onClick={() => setSel({ id: `local-${Date.now()}`, title: '', body: '', version: 1 })}>+ {t('tools.notes')}</button>
        {!remote && <span className="faint">{t('tools.notesLocal')}</span>}
        <ul className="list">{notes.map((n) => <li key={n.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(n)}><strong>{n.title}</strong></li>)}</ul>
      </div>
      {sel && (
        <div className="stack">
          <input className="input" value={sel.title} placeholder={t('common.title')} onChange={(e) => setSel({ ...sel, title: e.target.value })} dir="auto" />
          <textarea className="input" style={{ minHeight: 260 }} value={sel.body} onChange={(e) => setSel({ ...sel, body: e.target.value })} dir="auto" />
          <div className="row"><button className="btn primary" onClick={() => void save()}>{t('common.save')}</button>
            <button className="btn danger" onClick={async () => { if (remote && !sel.id.startsWith('local-')) await api(`/account/notes/${sel.id}`, { method: 'DELETE' }); const next = notes.filter((x) => x.id !== sel.id); setNotes(next); if (!remote) writeJson('exammate.notes.local', next); setSel(null); }}>{t('common.delete')}</button></div>
        </div>
      )}
    </div>
  );
}

function RemoteList({ kind }: { kind: 'saved' | 'bookmarks' | 'recent' }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const [items, setItems] = useState<Array<{ id: string; text?: string; title?: string; latest_solution?: { answer: string } | null }> | null>(null);
  useEffect(() => {
    if (!user || !online) return;
    const path = kind === 'recent' ? '/documents?limit=8' : `/questions?${kind === 'saved' ? 'saved' : 'bookmarked'}=true&limit=30`;
    void api<{ items: typeof items }>(path).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [kind, user, online]);
  if (!user || !online) return <p className="muted">{t('common.needsInternet')}</p>;
  if (!items) return null;
  if (items.length === 0) return <p className="muted">{t('common.empty')}</p>;
  return (
    <ul className="list">{items.map((i) => (
      <li key={i.id} className="list-item">
        {kind === 'recent' ? <Link to={`/documents/${i.id}`}>{i.title}</Link> : <Link to={`/solver?q=${encodeURIComponent(i.text ?? '')}`} className="ltr">{i.text}</Link>}
        {i.latest_solution && <span className="faint ltr">{i.latest_solution.answer}</span>}
        {kind !== 'recent' && <button className="btn sm ghost" onClick={async () => { await api(`/questions/${i.id}`, { method: 'PATCH', body: kind === 'saved' ? { saved: false } : { bookmarked: false } }); setItems(items.filter((x) => x.id !== i.id)); }}>✕</button>}
      </li>))}</ul>
  );
}

export default function Tools() {
  const { t } = useI18n();
  const [order, setOrder] = useState<ToolId[]>(() => readJson('exammate.tools.order', TOOLS.map((x) => x.id)));
  const [hidden, setHidden] = useState<ToolId[]>(() => readJson('exammate.tools.hidden', []));
  const [active, setActive] = useState<ToolId>(order.find((x) => !hidden.includes(x)) ?? 'calculator');
  const [customize, setCustomize] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const visible = order.filter((x) => !hidden.includes(x));
  const move = (id: ToolId, d: number) => {
    const i = order.indexOf(id), j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order]; [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next); writeJson('exammate.tools.order', next);
  };
  const toggle = (id: ToolId) => { const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]; setHidden(next); writeJson('exammate.tools.hidden', next); };
  const meta = (id: ToolId) => TOOLS.find((x) => x.id === id)!;
  return (
    <>
      <PageHead title={t('nav.tools')} actions={<button className="btn sm" aria-pressed={customize} onClick={() => setCustomize(!customize)}>{t('tools.customize')}</button>} />
      {customize && (
        <ul className="list" style={{ marginBottom: 16 }}>{order.map((id) => (
          <li key={id} className="list-item"><label className="row"><input type="checkbox" checked={!hidden.includes(id)} onChange={() => toggle(id)} /> {t(meta(id).key)}</label>
            <div className="row"><button className="btn sm" onClick={() => move(id, -1)} aria-label="up">↑</button><button className="btn sm" onClick={() => move(id, 1)} aria-label="down">↓</button></div></li>))}</ul>
      )}
      <div className="tabs" role="tablist">{visible.map((id) => (
        <button key={id} role="tab" className="tab" aria-selected={active === id} onClick={() => { setActive(id); panelRef.current?.focus(); }}>{t(meta(id).key)} {!meta(id).offline && <span className="faint">☁</span>}</button>))}</div>
      <div ref={panelRef} tabIndex={-1} role="tabpanel">
        <p className="faint">{meta(active).offline ? t('common.offlineReady') : t('common.needsInternet')}</p>
        {active === 'calculator' && <Calculator scientific={false} />}
        {active === 'scientific' && <Calculator scientific />}
        {active === 'units' && <Units />}
        {active === 'formulas' && <Formulas />}
        {active === 'periodic' && <Periodic />}
        {active === 'chem' && <Chem />}
        {active === 'graph' && <Graph />}
        {active === 'timer' && <Timer />}
        {active === 'notes' && <Notes />}
        {(active === 'saved' || active === 'bookmarks' || active === 'recent') && <RemoteList kind={active} />}
      </div>
    </>
  );
}
