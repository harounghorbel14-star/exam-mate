import type { ComponentType } from 'react';
import type { ArcadeId } from '@exammate/core';
import type { ArcadeGameProps } from './shared';
import TicTacToe from './games/TicTacToe';
import ConnectFour from './games/ConnectFour';
import Snake from './games/Snake';
import FallingBlocks from './games/FallingBlocks';
import G2048 from './games/G2048';
import RockPaperScissors from './games/RockPaperScissors';
import MemoryMatch from './games/MemoryMatch';
import Minesweeper from './games/Minesweeper';
import Sudoku from './games/Sudoku';
import Hangman from './games/Hangman';
import MazeEscape from './games/MazeEscape';
import ReactionTest from './games/ReactionTest';
import SimonSays from './games/SimonSays';
import Checkers from './games/Checkers';
import Pong from './games/Pong';

export const ARCADE_COMPONENTS: Record<ArcadeId, ComponentType<ArcadeGameProps>> = {
  'tic-tac-toe': TicTacToe, 'connect-four': ConnectFour, snake: Snake, 'falling-blocks': FallingBlocks, '2048': G2048,
  'rock-paper-scissors': RockPaperScissors, 'memory-match': MemoryMatch, minesweeper: Minesweeper, sudoku: Sudoku, hangman: Hangman,
  'maze-escape': MazeEscape, 'reaction-test': ReactionTest, 'simon-says': SimonSays, checkers: Checkers, pong: Pong,
};
export const RESUMABLE: ArcadeId[] = ['2048', 'sudoku'];
