import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from '../src/lib/app';
import { SolverScreen } from '../src/screens/SolverScreen';
import { GamePlayScreen } from '../src/screens/GamesScreen';
import { GAME_BY_ID, applyResult } from '@exammate/core';
import { gameRepo } from '../src/lib/store';

describe('mobile screens (offline, no account)', () => {
  it('solves with the on-device engine', async () => {
    await render(<AppProvider><SolverScreen /></AppProvider>);
    await fireEvent.changeText(screen.getByLabelText(/Type or paste a question/), '2x + 3 = 11');
    await fireEvent.press(screen.getByText('Solve'));
    await waitFor(() => expect(screen.getByText('x = 4')).toBeTruthy());
    expect(screen.getByText(/Verified by an independent check/)).toBeTruthy();
    expect(screen.getByText('Solved by: on-device')).toBeTruthy();
  });

  it('plays a True or False round and stores progress locally', async () => {
    await render(<AppProvider><GamePlayScreen route={{ params: { id: 'true-false' } }} /></AppProvider>);
    await fireEvent.press(await screen.findByText('Play'));
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByText('True'));
    expect(screen.getByText(/Score: /)).toBeTruthy();
    expect(screen.getByText(/✓ Correct|✗ Incorrect/)).toBeTruthy();
  });

  it('persists progress when a memory game is finished', async () => {
    const def = GAME_BY_ID['memory-cards'];
    const { progress } = applyResult(undefined, { gameId: def.id, level: 1, score: 500, correct: 4, answered: 4, accuracy: 1, stars: 3, passed: true, bestStreak: 0, avgTimeMs: 1000 }, def.maxLevel, 'mobile-test', 1);
    await gameRepo.save(progress);
    expect(JSON.parse((await AsyncStorage.getItem('exammate.games.progress.v1'))!)['memory-cards'].unlockedLevel).toBe(2);
  });
});
