import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ArcadeId } from '@exammate/core';
import type { ArcadeGameProps } from './shared';

/** Each game is its own chunk; all chunks are precached by the service worker for offline play. */
export const ARCADE_COMPONENTS: Record<ArcadeId, LazyExoticComponent<ComponentType<ArcadeGameProps>>> = {
  'tic-tac-toe': lazy(() => import('./games/TicTacToe')),
  'connect-four': lazy(() => import('./games/ConnectFour')),
  snake: lazy(() => import('./games/Snake')),
  'falling-blocks': lazy(() => import('./games/FallingBlocks')),
  '2048': lazy(() => import('./games/G2048')),
  'rock-paper-scissors': lazy(() => import('./games/RockPaperScissors')),
  'memory-match': lazy(() => import('./games/MemoryMatch')),
  minesweeper: lazy(() => import('./games/Minesweeper')),
  sudoku: lazy(() => import('./games/Sudoku')),
  hangman: lazy(() => import('./games/Hangman')),
  'maze-escape': lazy(() => import('./games/MazeEscape')),
  'reaction-test': lazy(() => import('./games/ReactionTest')),
  'simon-says': lazy(() => import('./games/SimonSays')),
  checkers: lazy(() => import('./games/Checkers')),
  pong: lazy(() => import('./games/Pong')),
};

/** Games whose in-progress state is saved and resumed. */
export const RESUMABLE: ArcadeId[] = ['2048', 'sudoku'];
