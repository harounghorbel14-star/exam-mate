import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { translate } from '@exammate/core';
import { I18nProvider } from '../lib/i18n';
import Arcade from '../pages/Arcade';
import ArcadePlay from '../pages/ArcadePlay';
import TicTacToe from '../arcade/games/TicTacToe';
import ConnectFour from '../arcade/games/ConnectFour';
import Hangman from '../arcade/games/Hangman';
import { createSfx, type ArcadeGameProps } from '../arcade/shared';

const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate('en', k, p);
const silent = createSfx({ sound: false, haptics: false, volume: 0 });
const props = (over: Partial<ArcadeGameProps> = {}): ArcadeGameProps => ({ difficulty: 'easy', mode: 'local', seed: 1, paused: false, locale: 'en', t, sfx: silent, onFinish: vi.fn(), ...over });

describe('Arcade hub', () => {
  it('lists the 15 arcade games and filters by search', async () => {
    render(<I18nProvider><MemoryRouter><Arcade /></MemoryRouter></I18nProvider>);
    expect(screen.getAllByRole('article')).toHaveLength(15);
    fireEvent.change(screen.getByLabelText('Search games'), { target: { value: 'sudoku' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});

describe('Arcade play shell', () => {
  it('shows rules, starts a game and can pause/resume', async () => {
    render(<I18nProvider><MemoryRouter initialEntries={['/arcade/tic-tac-toe']}><Routes><Route path="/arcade/:id" element={<ArcadePlay />} /></Routes></MemoryRouter></I18nProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(await screen.findByRole('grid', { name: 'Tic-Tac-Toe' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Resume/ })[0]!);
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull();
  });
});

describe('arcade game components', () => {
  it('tic-tac-toe: pass-and-play win reports the winner', async () => {
    const onFinish = vi.fn();
    render(<TicTacToe {...props({ onFinish })} />);
    for (const [r, c] of [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3]]) fireEvent.click(screen.getByRole('gridcell', { name: `Row ${r}, column ${c}` }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ outcome: 'win', message: 'Player 1 (X) wins!' }));
  });
  it('tic-tac-toe: paused boards ignore input', () => {
    render(<TicTacToe {...props({ paused: true })} />);
    fireEvent.click(screen.getByRole('gridcell', { name: 'Row 1, column 1' }));
    expect(screen.getByRole('gridcell', { name: 'Row 1, column 1' }).textContent).toBe('');
  });
  it('connect four: vertical line wins', async () => {
    const onFinish = vi.fn();
    render(<ConnectFour {...props({ onFinish })} />);
    for (const c of [1, 2, 1, 2, 1, 2, 1]) fireEvent.click(screen.getByRole('button', { name: `Column ${c}` }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'win' })));
  });
  it('connect four: AI replies in vs-computer mode', async () => {
    vi.useFakeTimers();
    render(<ConnectFour {...props({ mode: 'ai' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Column 4' }));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(document.querySelectorAll('.c4-disc.p2').length).toBe(1);
    vi.useRealTimers();
  });
  it('hangman: keyboard guesses work and the Arabic keyboard is rendered right-to-left', async () => {
    const { container, unmount } = render(<Hangman {...props({ mode: 'solo' })} />);
    await screen.findByText(/Category:/);
    fireEvent.keyDown(window, { key: 'e' });
    await waitFor(() => expect(container.querySelector('.hm-key.hit, .hm-key.miss')).not.toBeNull());
    unmount();
    const ar = render(<Hangman {...props({ mode: 'solo', locale: 'ar' })} />);
    await waitFor(() => expect(ar.container.querySelector('.hm-keys')?.getAttribute('dir')).toBe('rtl'));
  });
});
