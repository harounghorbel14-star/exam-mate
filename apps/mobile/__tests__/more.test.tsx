import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from '../src/lib/app';
import { ToolsScreen } from '../src/screens/ToolsScreen';
import { CoachScreen } from '../src/screens/CoachScreen';
import { ExamsScreen } from '../src/screens/ExamsScreen';

describe('mobile tools and coach (offline)', () => {
  it('calculates, converts units and balances equations', async () => {
    await render(<AppProvider><ToolsScreen /></AppProvider>);
    await fireEvent.changeText(screen.getByLabelText('expression'), '2^10 - 24');
    expect(screen.getByText('= 1000')).toBeTruthy();
    await fireEvent.press(screen.getByText('Unit converter'));
    expect(screen.getByText('1 km = 1000 m')).toBeTruthy();
    await fireEvent.press(screen.getByText('Equation balancer'));
    expect(screen.getByText('CH4 + 2O2 → CO2 + 2H2O')).toBeTruthy();
  });
  it('shows a time allocation and the guessing expected value', async () => {
    await render(<AppProvider><CoachScreen /></AppProvider>);
    expect(screen.getByText(/Final review: 9 min/)).toBeTruthy();
    expect(screen.getByText(/Expected points from guessing: 0.33/)).toBeTruthy();
  });
});

describe('mobile exams (signed in, server stubbed)', () => {
  it('starts an exam, answers and shows graded results', async () => {
    await AsyncStorage.setItem('exammate.user', JSON.stringify({ id: 'u1', email: 'a@b.c', displayName: 'A' }));
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const json = (o: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(o) });
      if (url.endsWith('/exams/attempts')) return json({ attempt: { id: 'a1', deadline_at: new Date(Date.now() + 600_000).toISOString(), questions: [{ id: 'q1', type: 'mcq', prompt: '2 + 2 = ?', choices: ['3', '4'], points: 1, topic: 'arith' }] } }, 201);
      if (url.endsWith('/submit')) {
        const body = JSON.parse(init!.body!);
        const correct = body.responses.q1 === 1;
        return json({ grades: [{ questionId: 'q1', status: correct ? 'correct' : 'incorrect', pointsAwarded: correct ? 1 : 0, pointsPossible: 1, feedback: '' }], summary: { percent: correct ? 100 : 0, score: correct ? 1 : 0, maxScore: 1, pendingReview: 0 }, questions: [{ id: 'q1', type: 'mcq', prompt: '2 + 2 = ?', choices: ['3', '4'], answer: 1, points: 1, topic: 'arith' }] });
      }
      return json({ error: { code: 'not_found', message: 'nf' } }, 404);
    }) as unknown as typeof fetch;
    await render(<AppProvider><ExamsScreen /></AppProvider>);
    await fireEvent.press(await screen.findByText('Start exam'));
    await fireEvent.press(await screen.findByText('B. 4'));
    const { submitCurrent } = { submitCurrent: async () => { await fireEvent.press(screen.getByText('Finish exam')); } };
    // Alert.alert is mocked by jest-expo; confirm by invoking the submit button callback.
    const { Alert } = require('react-native');
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => { const buttons = args[2] as Array<{ onPress?: () => void }>; buttons[1]!.onPress!(); });
    await submitCurrent();
    await waitFor(() => expect(screen.getByText('100%')).toBeTruthy());
    expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/submit'))).toBe(true);
    spy.mockRestore();
  });
});
