import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_LOCALES, LOCALES, type Locale, type MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { RequireAccount, ErrorState, PageHead } from '../components/ui';

const LEVELS = ['middle', 'high', 'university', 'other'] as const;
const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'languages', 'cs', 'history', 'geography'] as const;
const GOALS = ['exam', 'grades', 'understand', 'habit'] as const;

export default function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const nav = useNavigate();
  const [level, setLevel] = useState<string>('high');
  const [subjects, setSubjects] = useState<string[]>(['math']);
  const [goals, setGoals] = useState<string[]>(['exam']);
  const [error, setError] = useState<unknown>(null);
  const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const finish = async () => {
    try {
      await api('/account/profile', { method: 'PUT', body: { academicLevel: level, subjects, goals, locale, onboarded: true } });
      nav('/');
    } catch (e) { setError(e); }
  };
  return (
    <RequireAccount>
      <PageHead title={t('onboarding.title')} />
      <div className="stack" style={{ maxWidth: 720 }}>
        {error !== null && <ErrorState error={error} />}
        <fieldset className="card stack" style={{ border: undefined }}>
          <legend className="label">{t('common.language')}</legend>
          <div className="chips">{SUPPORTED_LOCALES.map((l) => <button key={l} className="chip" aria-pressed={locale === l} onClick={() => setLocale(l as Locale)}>{LOCALES[l].name}</button>)}</div>
        </fieldset>
        <fieldset className="card stack">
          <legend className="label">{t('onboarding.level')}</legend>
          <div className="chips">{LEVELS.map((l) => <button key={l} className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>{t(`level.${l}` as MessageKey)}</button>)}</div>
        </fieldset>
        <fieldset className="card stack">
          <legend className="label">{t('onboarding.subjects')}</legend>
          <div className="chips">{SUBJECTS.map((s) => <button key={s} className="chip" aria-pressed={subjects.includes(s)} onClick={() => toggle(subjects, s, setSubjects)}>{t(`subject.${s}` as MessageKey)}</button>)}</div>
        </fieldset>
        <fieldset className="card stack">
          <legend className="label">{t('onboarding.goals')}</legend>
          <div className="chips">{GOALS.map((g) => <button key={g} className="chip" aria-pressed={goals.includes(g)} onClick={() => toggle(goals, g, setGoals)}>{t(`goal.${g}` as MessageKey)}</button>)}</div>
        </fieldset>
        <div><button className="btn primary lg" onClick={finish} disabled={subjects.length === 0}>{t('onboarding.finish')}</button></div>
      </div>
    </RequireAccount>
  );
}
