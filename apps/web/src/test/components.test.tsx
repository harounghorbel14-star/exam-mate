import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { solveLocally } from '@exammate/core';
import { I18nProvider } from '../lib/i18n';
import { AuthProvider } from '../lib/auth';
import { PrefsProvider } from '../lib/prefs';
import { SolutionView } from '../components/SolutionView';
import { LocalStore } from '../lib/kv';

const wrap = (ui: React.ReactNode) => render(<I18nProvider><AuthProvider><PrefsProvider>{ui}</PrefsProvider></AuthProvider></I18nProvider>);

describe('SolutionView', () => {
  it('shows a verified badge, steps and checks for a deterministic solution', () => {
    wrap(<SolutionView data={{ ...solveLocally('2x + 3 = 11'), engine: 'on-device' }} />);
    expect(screen.getByText(/Verified by an independent check/)).toBeTruthy();
    expect(screen.getByText('Step-by-step')).toBeTruthy();
    expect(screen.getByText(/substitute x = 4/)).toBeTruthy();
  });
  it('explains honestly when a question is unsupported', () => {
    wrap(<SolutionView data={solveLocally('Explain the causes of World War I')} />);
    expect(screen.getByText('ExamMate cannot answer this reliably')).toBeTruthy();
    expect(screen.queryByText('Answer')).toBeNull();
  });
});

describe('LocalStore', () => {
  it('round-trips values and survives storage failures', async () => {
    const s = new LocalStore();
    await s.setItem('k', 'v');
    expect(await s.getItem('k')).toBe('v');
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    expect(await s.getItem('k')).toBe('v');
    Storage.prototype.getItem = orig;
  });
});
