import type { MathResult, SolveResponse } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { usePrefs } from '../lib/prefs';
import { speak, speechSynthesisSupported } from '../lib/speech';
import { MathTex } from './Math';

export interface DocumentAnswer { found: boolean; answer: string; engine: string; citations: Array<{ documentTitle: string; page: number | null; section: string | null; quote: string }> }
export interface ServerSolve extends SolveResponse {
  engine?: string;
  warnings?: string[];
  documentAnswer?: DocumentAnswer;
  llmAnswer?: { answer: string; steps: string[]; uncertainty: string; assumptions: string[] };
  translation?: string;
  enrichedExplanation?: string;
  rationale?: string;
  solutionId?: string;
  latencyMs?: number;
}

export function ConfidenceBadge({ c }: { c: SolveResponse['confidence'] }) {
  const { t } = useI18n();
  const cls = c === 'verified' ? 'success' : c === 'unverified' ? 'warning' : 'danger';
  const key = c === 'verified' ? 'solver.confidence.verified' : c === 'unverified' ? 'solver.confidence.unverified' : 'solver.confidence.unsupported';
  return <span className={`badge ${cls}`}>{c === 'verified' ? '✓' : '!'} {t(key)}</span>;
}

function plainAnswer(r: MathResult) {
  return r.answer;
}

export function SolutionView({ data }: { data: ServerSolve }) {
  const { t, locale } = useI18n();
  const { prefs } = usePrefs();
  const r = data.result;
  const subject = t(`subject.${data.subject}` as never);
  const readAloud = () => {
    const parts = [r?.answer, ...(r?.steps.map((s) => s.description) ?? []), data.documentAnswer?.answer, data.llmAnswer?.answer, data.modeText].filter(Boolean);
    speak(parts.join('. '), locale, prefs.speechRate);
  };
  return (
    <div className="stack" aria-live="polite">
      <div className="row">
        <ConfidenceBadge c={data.confidence} />
        <span className="badge">{t('solver.detected', { subject, type: data.questionType })}</span>
        {data.engine && <span className="badge info">{t('solver.engine', { engine: data.engine })}</span>}
        {data.latencyMs !== undefined && <span className="faint">{Math.round(data.latencyMs)} ms</span>}
        {speechSynthesisSupported() && <button className="btn sm ghost" onClick={readAloud}>🔊 {t('voice.speak')}</button>}
      </div>

      {data.status === 'error' && <div className="alert danger">{data.error}</div>}

      {r && r.answer && (
        <div className="card glass">
          <div className="label muted">{t('solver.answer')}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 650 }}>
            {r.answerLatex ? <MathTex tex={r.answerLatex} block /> : <span className="ltr">{plainAnswer(r)}</span>}
          </div>
        </div>
      )}

      {data.check && (
        <div className={`alert ${data.check.correct ? 'success' : 'danger'}`}><strong>{data.check.correct ? t('common.correct') : t('common.incorrect')}</strong>&nbsp;{data.check.detail}</div>
      )}
      {data.similar && (
        <div className="card"><div className="label muted">{t('mode.similar')}</div><p className="ltr" style={{ fontSize: '1.1rem' }}>{data.similar.question}</p>
          <details><summary>{t('solver.answer')}</summary><p className="ltr">{data.similar.answer}</p></details></div>
      )}
      {data.modeText && <div className="alert info">{data.modeText}</div>}
      {data.enrichedExplanation && <div className="card"><div className="label muted">{t('mode.simple')}</div><p>{data.enrichedExplanation}</p><p className="faint">{t('solver.localModelNote')}</p></div>}

      {r && r.steps.length > 0 && (
        <div className="card">
          <h3>{t('solver.steps')}</h3>
          <ol className="steps">
            {r.steps.map((s, i) => (<li key={i}><div>{s.description}</div>{s.latex && <MathTex tex={s.latex} block />}</li>))}
          </ol>
        </div>
      )}

      {data.documentAnswer?.found && (
        <div className="card">
          <h3>{t('solver.fromDocuments')}</h3>
          <p>{data.documentAnswer.answer}</p>
          <ul className="list">
            {data.documentAnswer.citations.map((c, i) => (
              <li key={i} className="list-item" style={{ display: 'block' }}>
                <span className="badge">{c.documentTitle} · {t('docs.source', { page: c.page ?? '?' })}</span>
                <blockquote className="muted" style={{ margin: '6px 0 0' }}>“{c.quote}”</blockquote>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.llmAnswer && (
        <div className="card">
          <h3>{t('solver.localModelAnswer')}</h3>
          <p>{data.llmAnswer.answer}</p>
          {data.llmAnswer.steps.length > 0 && <ol>{data.llmAnswer.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
          <span className="badge warning">{t('solver.uncertainty')}: {data.llmAnswer.uncertainty}</span>
        </div>
      )}
      {data.translation && <div className="card"><h3>{t('mode.translate')}</h3><p>{data.translation}</p></div>}

      {r && r.verification.length > 0 && (
        <details className="card" open={r.verification.some((v) => !v.passed)}>
          <summary><strong>{t('solver.verification')}</strong> — {r.verification.filter((v) => v.passed).length}/{r.verification.length}</summary>
          <ul className="list" style={{ marginTop: 10 }}>
            {r.verification.map((v, i) => <li key={i} className="list-item"><span>{v.passed ? '✓' : '✗'} {v.method}</span><span className="faint ltr">{v.detail}</span></li>)}
          </ul>
        </details>
      )}
      {r && r.assumptions.length > 0 && <div className="alert info"><div><strong>{t('solver.assumptions')}:</strong> {r.assumptions.join(' ')}</div></div>}
      {(data.warnings?.length ?? 0) > 0 && <div className="alert warning"><div><strong>{t('solver.warnings')}:</strong><ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>{[...new Set(data.warnings)].map((w, i) => <li key={i}>{w}</li>)}</ul></div></div>}

      {data.status === 'unsupported' && !data.documentAnswer?.found && !data.llmAnswer && (
        <div className="alert warning"><div><strong>{t('solver.unsupportedTitle')}</strong><p style={{ margin: '4px 0 0' }}>{t('solver.unsupportedHelp')}</p></div></div>
      )}
    </div>
  );
}
