import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { safeEvaluate, formatNumber, normalizeMathInput, convertUnits, balanceEquation, molarMass, ELEMENTS, PHYSICS_FORMULAS, FORMULA_PAIRS, type ChemicalElement } from '@exammate/core';
import { useApp } from '../lib/app';
import { colors } from '../lib/theme';
import { Badge, Button, Card, Input, P, Screen, Title, s } from '../components/ui';

type Tool = 'calc' | 'units' | 'chem' | 'periodic' | 'formulas';

const UNIT_GROUPS: Record<string, string[]> = {
  length: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'mi'], mass: ['mg', 'g', 'kg', 'lb'], time: ['s', 'min', 'h', 'day'],
  speed: ['m/s', 'km/h', 'mi/h'], temperature: ['degC', 'degF', 'K'], energy: ['J', 'kJ', 'cal', 'kWh'], pressure: ['Pa', 'kPa', 'bar', 'atm'],
};

function Calculator() {
  const [expr, setExpr] = useState('');
  const result = useMemo(() => {
    if (!expr.trim()) return '';
    try { const v = safeEvaluate(normalizeMathInput(expr)); return typeof v === 'number' ? formatNumber(v, 12) : String(v); } catch { return '…'; }
  }, [expr]);
  const keys = ['7', '8', '9', '/', 'sqrt(', '4', '5', '6', '*', '^', '1', '2', '3', '-', '(', '0', '.', 'pi', '+', ')', 'sin(', 'cos(', 'tan(', 'log(', 'e'];
  return (
    <View style={{ gap: 8 }}>
      <Input value={expr} onChangeText={setExpr} style={{ fontFamily: 'monospace', fontSize: 20 }} accessibilityLabel="expression" autoCapitalize="none" />
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', textAlign: 'right' }} accessibilityLiveRegion="polite">{result && `= ${result}`}</Text>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        {keys.map((k) => <Pressable key={k} onPress={() => setExpr((x) => x + k)} style={{ width: '18%', height: 48, borderRadius: 10, backgroundColor: colors.elev, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={k}><Text style={{ color: colors.text, fontSize: 17 }}>{k}</Text></Pressable>)}
      </View>
      <View style={s.row}><Button title="⌫" onPress={() => setExpr((x) => x.slice(0, -1))} /><Button title="C" onPress={() => setExpr('')} /><Button title="=" variant="primary" onPress={() => result && result !== '…' && setExpr(result)} /></View>
    </View>
  );
}

function Units() {
  const { t } = useApp();
  const [group, setGroup] = useState('length');
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('m');
  const [value, setValue] = useState('1');
  let out = '';
  try { out = convertUnits(Number(value.replace(',', '.')), from, to).answer; } catch (e) { out = (e as Error).message; }
  const units = UNIT_GROUPS[group]!;
  return (
    <View style={{ gap: 8 }}>
      <View style={s.row}>{Object.keys(UNIT_GROUPS).map((g) => <Button key={g} title={g} variant={g === group ? 'primary' : 'default'} onPress={() => { setGroup(g); setFrom(UNIT_GROUPS[g]![0]!); setTo(UNIT_GROUPS[g]![1]!); }} />)}</View>
      <Input value={value} onChangeText={setValue} keyboardType="numbers-and-punctuation" accessibilityLabel={t('tools.value')} />
      <P muted>{t('tools.from')}</P><View style={s.row}>{units.map((u) => <Button key={u} title={u} variant={u === from ? 'primary' : 'default'} onPress={() => setFrom(u)} />)}</View>
      <P muted>{t('tools.to')}</P><View style={s.row}>{units.map((u) => <Button key={u} title={u} variant={u === to ? 'primary' : 'default'} onPress={() => setTo(u)} />)}</View>
      <Card><P style={{ fontSize: 20, fontWeight: '700' }}>{out}</P></Card>
    </View>
  );
}

function Chem() {
  const { t } = useApp();
  const [eq, setEq] = useState('CH4 + O2 -> CO2 + H2O');
  const [f, setF] = useState('H2SO4');
  let bal = '', mm = '';
  try { bal = balanceEquation(eq).balanced; } catch (e) { bal = (e as Error).message; }
  try { mm = molarMass(f).answer; } catch (e) { mm = (e as Error).message; }
  return (
    <View style={{ gap: 8 }}>
      <P muted>{t('tools.chem')}</P><Input value={eq} onChangeText={setEq} autoCapitalize="none" style={{ fontFamily: 'monospace' }} /><Card><P style={{ fontWeight: '700' }}>{bal}</P></Card>
      <P muted>{t('tools.molarMass')}</P><Input value={f} onChangeText={setF} autoCapitalize="none" style={{ fontFamily: 'monospace' }} /><Card><P style={{ fontWeight: '700' }}>{mm}</P></Card>
    </View>
  );
}

function Periodic() {
  const { locale, t } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<ChemicalElement | null>(null);
  const list = ELEMENTS.filter((e) => !q || `${e.symbol} ${e.name[locale]} ${e.z}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ gap: 8 }}>
      <Input value={q} onChangeText={setQ} placeholder={t('common.search')} />
      {sel && <Card><P style={{ fontSize: 22, fontWeight: '800' }}>{sel.symbol} — {sel.name[locale]}</P><P muted>Z = {sel.z} · {sel.mass} g/mol · {sel.category}{sel.group ? ` · group ${sel.group}` : ''} · period {sel.period}</P></Card>}
      <View style={s.row}>{list.map((e) => <Pressable key={e.z} onPress={() => setSel(e)} accessibilityLabel={e.name[locale]} style={{ width: 54, padding: 4, borderRadius: 8, backgroundColor: colors.elev, alignItems: 'center' }}><Text style={{ color: colors.faint, fontSize: 10 }}>{e.z}</Text><Text style={{ color: colors.text, fontWeight: '700' }}>{e.symbol}</Text></Pressable>)}</View>
    </View>
  );
}

function Formulas() {
  const { locale } = useApp();
  return (
    <View style={{ gap: 8 }}>
      {PHYSICS_FORMULAS.map((f) => <Card key={f.id}><P style={{ fontWeight: '700' }}>{f.name}</P><Text style={s.mono}>{f.equation.replace(/\bmass\b/g, 'm').replace(/\bPw\b/g, 'P').replace(/\bPr\b/g, 'P').replace(/\blam\b/g, 'λ')}</Text><Badge text={f.topic} /></Card>)}
      {FORMULA_PAIRS.map((f) => <Card key={f.formula}><P style={{ fontWeight: '700' }}>{f.name[locale]}</P><Text style={s.mono}>{f.formula}</Text></Card>)}
    </View>
  );
}

export function ToolsScreen() {
  const { t } = useApp();
  const [tool, setTool] = useState<Tool>('calc');
  const tabs: Array<[Tool, string]> = [['calc', t('tools.scientific')], ['units', t('tools.units')], ['chem', t('tools.chem')], ['periodic', t('tools.periodic')], ['formulas', t('tools.formulas')]];
  return (
    <Screen>
      <Title>{t('nav.tools')}</Title>
      <Badge text={t('common.offlineReady')} tone="success" />
      <View style={s.row}>{tabs.map(([id, label]) => <Button key={id} title={label} variant={tool === id ? 'primary' : 'default'} onPress={() => setTool(id)} />)}</View>
      {tool === 'calc' && <Calculator />}
      {tool === 'units' && <Units />}
      {tool === 'chem' && <Chem />}
      {tool === 'periodic' && <Periodic />}
      {tool === 'formulas' && <Formulas />}
    </Screen>
  );
}
