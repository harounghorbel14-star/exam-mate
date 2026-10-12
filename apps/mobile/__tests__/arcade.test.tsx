import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, ARCADE_IDS, type SudokuState } from '@exammate/core';
import { AppProvider } from '../src/lib/app';
import { ArcadeScreen, ArcadePlayScreen } from '../src/screens/ArcadeScreen';
import { ARCADE_COMPONENTS } from '../src/arcade/registry';
import { createSfx, type ArcadeGameProps } from '../src/arcade/shared';

const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate('en', k, p);
const sfx = createSfx({ sound: true, haptics: false, volume: 0.5 });
const props = (over: Partial<ArcadeGameProps> = {}): ArcadeGameProps => ({ difficulty: 'easy', mode: 'local', seed: 3, paused: false, locale: 'en', t, sfx, onFinish: jest.fn(), ...over });

beforeEach(async () => { await AsyncStorage.clear(); });

describe('mobile arcade hub', () => {
  it('lists 15 games, searches and toggles favourites', async () => {
    const nav = { navigate: jest.fn() };
    await render(<AppProvider><ArcadeScreen navigation={nav} /></AppProvider>);
    expect(await screen.findByLabelText('Snake')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search games'), 'démineur');
    expect(screen.getByLabelText('Minesweeper')).toBeTruthy();
    expect(screen.queryByLabelText('Snake')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Add Minesweeper to favorites'));
    expect(await screen.findByLabelText('Remove Minesweeper from favorites')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Minesweeper'));
    expect(nav.navigate).toHaveBeenCalledWith('ArcadePlay', { id: 'minesweeper' });
  });
});

describe('mobile arcade play shell', () => {
  it('plays a pass-and-play tic-tac-toe to a win and records the stats offline', async () => {
    await render(<AppProvider><ArcadePlayScreen route={{ params: { id: 'tic-tac-toe' } }} /></AppProvider>);
    await fireEvent.press(await screen.findByText('Got it'));
    await fireEvent.press(screen.getByText('2 players (this device)'));
    await fireEvent.press(screen.getByText('▶ Play'));
    for (const [r, c] of [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3]]) await fireEvent.press(screen.getByLabelText(`Row ${r}, column ${c}`));
    expect(await screen.findByText('Player 1 (X) wins!', {}, { timeout: 3000 })).toBeTruthy();
    const raw = JSON.parse((await AsyncStorage.getItem('exammate.arcade.stats.v1'))!);
    expect(Object.values(raw['tic-tac-toe'].counters)[0]).toMatchObject({ plays: 1, wins: 1 });
  });
});

describe('each mobile arcade game renders and responds to input', () => {
  it('has a component for all 15 games', () => {
    expect(Object.keys(ARCADE_COMPONENTS).sort()).toEqual([...ARCADE_IDS].sort());
  });
  it('connect four: vertical win', async () => {
    const onFinish = jest.fn();
    const G = ARCADE_COMPONENTS['connect-four'];
    await render(<G {...props({ onFinish })} />);
    for (const c of [1, 2, 1, 2, 1, 2, 1]) await fireEvent.press(screen.getByLabelText(`Column ${c}`));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'win' })));
  });
  it('checkers: selecting a piece shows targets and moving passes the turn', async () => {
    const G = ARCADE_COMPONENTS.checkers;
    await render(<G {...props()} />);
    await fireEvent.press(screen.getByLabelText('Row 6, column 1: Player 1'));
    await fireEvent.press(screen.getByLabelText('Row 5, column 2'));
    expect(screen.getByText('Player 2 to play')).toBeTruthy();
  });
  it('rock paper scissors: pass-and-play hides the first choice', async () => {
    const G = ARCADE_COMPONENTS['rock-paper-scissors'];
    await render(<G {...props()} />);
    await fireEvent.press(screen.getByLabelText('✊ Rock'));
    expect(screen.getByText('Choice hidden — pass the device to Player 2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('✌️ Scissors'));
    expect(screen.getByText('Player 1 takes the round')).toBeTruthy();
  });
  it('memory match: matching a pair keeps it face up and scores in two-player mode', async () => {
    const G = ARCADE_COMPONENTS['memory-match'];
    await render(<G {...props({ option: '3x4' })} />);
    const symbols: string[] = [];
    for (let i = 1; i <= 12; i++) {
      await fireEvent.press(screen.getByLabelText(`Card ${i}`));
      const el = screen.getByLabelText(new RegExp(`^Card ${i}: `));
      symbols.push(String(el.props.accessibilityLabel).split(': ')[1]!);
      if (i % 2 === 0) await act(async () => { await new Promise((r) => setTimeout(r, 950)); });
    }
    expect(new Set(symbols).size).toBe(6);
  }, 20_000);
  it('minesweeper: first tap is safe and opens cells', async () => {
    const onFinish = jest.fn();
    const G = ARCADE_COMPONENTS.minesweeper;
    await render(<G {...props({ onFinish })} />);
    await fireEvent.press(screen.getByLabelText('Row 5, column 5'));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.queryAllByLabelText(/^Row \d+, column \d+: \d$/).length + 1).toBeGreaterThan(1);
  });
  it('sudoku: entering the unique solution wins', async () => {
    const onFinish = jest.fn();
    const G = ARCADE_COMPONENTS.sudoku;
    await render(<G {...props({ onFinish })} />);
    await screen.findByText(/Mistakes 0\/3/);
    await waitFor(async () => expect(await AsyncStorage.getItem('exammate.arcade.save.v1.sudoku')).not.toBeNull());
    const st = JSON.parse((await AsyncStorage.getItem('exammate.arcade.save.v1.sudoku'))!) as SudokuState;
    for (let i = 0; i < 81; i++) {
      if (st.values[i]) continue;
      await fireEvent.press(screen.getByLabelText(`Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}`));
      await fireEvent.press(screen.getByLabelText(String(st.solution[i])));
    }
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'win' })));
  }, 30_000);
  it('hangman: letters can be guessed', async () => {
    const G = ARCADE_COMPONENTS.hangman;
    await render(<G {...props({ mode: 'solo' })} />);
    await screen.findByText(/Category:/);
    await fireEvent.press(screen.getByLabelText('E'));
    expect(screen.getByLabelText('E').props.accessibilityState.disabled).toBe(true);
  });
  it('snake: runs into the wall and reports the score', async () => {
    jest.useFakeTimers();
    const onFinish = jest.fn();
    const Snake = ARCADE_COMPONENTS.snake;
    await render(<Snake {...props({ onFinish, difficulty: 'hard' })} />);
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'done' }));
    jest.useRealTimers();
  });
  it('falling blocks: hard drop locks a piece', async () => {
    const Blocks = ARCADE_COMPONENTS['falling-blocks'];
    await render(<Blocks {...props({ paused: false })} />);
    await fireEvent.press(screen.getByLabelText('Drop'));
    expect(screen.getByLabelText(/^Score [1-9]\d*, Lines 0$/)).toBeTruthy();
  });
  it('maze escape: the d-pad moves the player through open passages', async () => {
    const Maze = ARCADE_COMPONENTS['maze-escape'];
    await render(<Maze {...props()} />);
    const label = () => screen.getByLabelText(/^Maze /).props.accessibilityLabel as string;
    const before = label();
    for (const d of ['Right', 'Down']) await fireEvent.press(screen.getByLabelText(d));
    expect(label()).not.toBe(before);
  });
  it('reaction test: tapping during the wait is a false start', async () => {
    const Reaction = ARCADE_COMPONENTS['reaction-test'];
    await render(<Reaction {...props()} />);
    await fireEvent(screen.getByLabelText('Tap to start'), 'pressIn');
    await fireEvent(screen.getByLabelText('Wait for green…'), 'pressIn');
    expect(screen.getByText(/False starts: 1/)).toBeTruthy();
  });
  it('simon says: plays the sequence then hands over to the player', async () => {
    jest.useFakeTimers();
    const Simon = ARCADE_COMPONENTS['simon-says'];
    await render(<Simon {...props()} />);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText(/Your turn/)).toBeTruthy();
    jest.useRealTimers();
  });
  it('pong and 2048 render their fields', async () => {
    const Pong = ARCADE_COMPONENTS.pong;
    const po = await render(<Pong {...props({ mode: 'ai', paused: true })} />);
    expect(screen.getByLabelText('Pong 0–0')).toBeTruthy();
    await po.unmount();
    const G2048 = ARCADE_COMPONENTS['2048'];
    await render(<G2048 {...props()} />);
    expect(await screen.findByLabelText('2048')).toBeTruthy();
  });
});
