import { describe, expect, it } from 'vitest';
import {
  tttNew, tttPlay, tttAiMove, tttWinner,
  c4New, c4Drop, c4AiMove, c4LegalCols, C4_COLS, C4_ROWS,
  rpsNew, rpsPlayRound, rpsOutcome, rpsAiChoice,
  snakeNew, snakeStep, snakeTurn,
  blocksNew, blocksTick, blocksHardDrop, blocksMove, blocksRotate, blocksHold, pieceCells, blocksInterval, BLOCKS_W, BLOCKS_H, type BlocksState,
  g2048New, g2048Move, slideRow, g2048CanMove,
  pongNew, pongStep, PONG_W, PONG_H,
  minesNew, minesReveal, minesToggleFlag, minesNeighbors, minesChord,
  sudokuNew, sudokuGenerate, sudokuCountSolutions, sudokuIsValid, sudokuEnter, sudokuHint, sudokuSolve, sudokuConflicts,
  hangmanNew, hangmanGuess, hangmanMask, hangmanFold, hangmanAllWords, HANGMAN_ALPHABET,
  mazeNew, mazeGenerate, mazeShortestPath, mazeMove, mazeTick, mazeCanMove,
  reactionNew, reactionArm, reactionGo, reactionTap, reactionSummary, REACTION_MIN_DELAY, REACTION_MAX_DELAY,
  simonNew, simonShown, simonPress, simonFlashMs, simonScore,
  mmNew, mmFlip, mmScore, MEMORY_GRIDS,
  checkersNew, checkersLegalMoves, checkersApply, checkersAiMove, type CheckersState, type CheckersPiece,
  ARCADE_GAMES, ARCADE_IDS, searchArcade, arcadeText,
  ArcadeRepository, applyArcadeResult, mergeArcadeStats, arcadeTotals, arcadeSummary, isArcadeStatsRecord,
} from './index.js';
import { MemoryStore } from '../games/engine.js';
import { GAME_IDS } from '../games/index.js';
import type { Dir } from './snake.js';
import type { Locale } from '../i18n/index.js';

const LOCALES: Locale[] = ['en', 'fr', 'ar'];

describe('arcade catalogue', () => {
  it('has 15 distinct games, distinct from the 15 educational games (30 total)', () => {
    expect(ARCADE_GAMES).toHaveLength(15);
    expect(new Set(ARCADE_IDS).size).toBe(15);
    expect(ARCADE_GAMES.map((g) => g.id)).toEqual([...ARCADE_IDS]);
    expect(GAME_IDS).toHaveLength(15);
    expect(new Set([...ARCADE_IDS, ...GAME_IDS]).size).toBe(30);
  });
  it('has complete trilingual text for every game', () => {
    for (const g of ARCADE_GAMES) for (const l of LOCALES) {
      const t = g.text[l];
      expect(t.title.length, `${g.id}/${l}`).toBeGreaterThan(1);
      expect(t.tagline.length).toBeGreaterThan(3);
      expect(t.rules.length).toBeGreaterThanOrEqual(1);
      expect(t.controls.length).toBeGreaterThanOrEqual(1);
      expect(t.rules.length, `${g.id}/${l} rule count parity`).toBe(g.text.en.rules.length);
    }
    expect(arcadeText('snake', 'fr').title).toBe('Serpent');
  });
  it('searches across languages and filters by category/favorites', () => {
    expect(searchArcade('serpent').map((g) => g.id)).toEqual(['snake']);
    expect(searchArcade('demineur').map((g) => g.id)).toEqual(['minesweeper']); // accent-insensitive
    expect(searchArcade('', { category: 'strategy' }).map((g) => g.id).sort()).toEqual(['checkers', 'connect-four', 'tic-tac-toe']);
    expect(searchArcade('', { onlyFavorites: true, favorites: ['pong'] }).map((g) => g.id)).toEqual(['pong']);
  });
});

describe('tic-tac-toe', () => {
  it('detects wins, draws and rejects illegal moves', () => {
    let s = tttNew();
    for (const i of [0, 3, 1, 4, 2]) s = tttPlay(s, i);
    expect(s.result).toBe('X');
    expect(s.line).toEqual([0, 1, 2]);
    expect(() => tttPlay(s, 5)).toThrow('Illegal move');
    expect(() => tttPlay(tttPlay(tttNew(), 4), 4)).toThrow();
    expect(tttWinner(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']).winner).toBe('draw');
  });
  it('hard AI never loses against every possible human line', () => {
    let losses = 0, games = 0;
    const explore = (s: ReturnType<typeof tttNew>) => {
      if (s.result) { games++; if (s.result === 'X') losses++; return; }
      if (s.turn === 'O') { explore(tttPlay(s, tttAiMove(s, 'hard', s.moves))); return; }
      for (let i = 0; i < 9; i++) if (!s.board[i]) explore(tttPlay(s, i));
    };
    explore(tttNew('X'));
    expect(games).toBeGreaterThan(100);
    expect(losses).toBe(0);
  });
  it('medium AI takes a win and blocks', () => {
    // O to move with a winning move at 2 and X threatening at 8
    const s = { board: ['O', 'O', null, null, 'X', null, null, 'X', null] as Array<'X' | 'O' | null>, turn: 'O' as const, result: null, line: null, moves: 4 };
    expect(tttAiMove(s, 'medium', 1)).toBe(2);
    const b = { ...s, board: [null, null, null, 'O', 'X', null, null, 'X', null] as Array<'X' | 'O' | null> };
    expect(tttAiMove(b, 'medium', 1)).toBe(1);
  });
});

describe('connect four', () => {
  it('stacks discs and detects vertical, horizontal and diagonal lines', () => {
    let s = c4New();
    for (const c of [0, 1, 0, 1, 0, 1, 0]) s = c4Drop(s, c);
    expect(s.result).toBe(1);
    expect(s.line).toHaveLength(4);
    s = c4New();
    for (const c of [0, 0, 1, 1, 2, 2, 3]) s = c4Drop(s, c);
    expect(s.result).toBe(1);
    // diagonal for player 1: (5,0) (4,1) (3,2) (2,3)
    s = c4New();
    for (const c of [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]) s = c4Drop(s, c);
    expect(s.result).toBe(1);
  });
  it('rejects full columns and moves after game over', () => {
    let s = c4New();
    for (let i = 0; i < C4_ROWS; i++) s = c4Drop(s, 3);
    expect(c4LegalCols(s)).not.toContain(3);
    expect(() => c4Drop(s, 3)).toThrow();
    expect(() => c4Drop(s, C4_COLS)).toThrow();
  });
  it('hard AI wins immediately when possible and blocks a threat', () => {
    let s = c4New();
    for (const c of [0, 6, 1, 6, 2]) s = c4Drop(s, c); // P1 threatens col 3; P2 to move
    expect(c4AiMove(s, 'hard', 1)).toBe(3);
    s = c4New();
    for (const c of [6, 0, 6, 1, 5, 2]) s = c4Drop(s, c); // P2 threatens col 3, P1 to move... P1 must also block
    expect(c4AiMove(s, 'hard', 2)).toBe(3);
  });
  it('a full game AI vs AI terminates with a legal result', () => {
    let s = c4New();
    let n = 0;
    while (!s.result && n++ < 50) s = c4Drop(s, c4AiMove(s, n % 2 ? 'medium' : 'easy', n));
    expect(s.result).not.toBeNull();
  });
});

describe('rock paper scissors', () => {
  it('scores rounds and ends a best-of match', () => {
    expect(rpsOutcome('rock', 'scissors')).toBe(1);
    expect(rpsOutcome('rock', 'paper')).toBe(2);
    expect(rpsOutcome('paper', 'paper')).toBe(0);
    let m = rpsNew(3);
    m = rpsPlayRound(m, 'rock', 'rock');
    m = rpsPlayRound(m, 'rock', 'scissors');
    expect(m.winner).toBeNull();
    m = rpsPlayRound(m, 'paper', 'rock');
    expect(m.winner).toBe(1);
    expect(() => rpsPlayRound(m, 'rock', 'rock')).toThrow();
    expect(() => rpsNew(4)).toThrow();
  });
  it('adaptive AI exploits a predictable player', () => {
    const history: Array<'rock'> = Array(10).fill('rock');
    let paper = 0;
    for (let seed = 0; seed < 100; seed++) if (rpsAiChoice(history, 'medium', seed) === 'paper') paper++;
    expect(paper).toBeGreaterThan(80);
  });
});

describe('snake', () => {
  it('moves, eats food, grows and scores', () => {
    let s = snakeNew(1, 10, 10);
    s = { ...s, food: { x: 5, y: s.snake[0]!.y } };
    s = snakeStep(s);
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(10);
    expect(s.food).not.toBeNull();
    expect(s.snake.some((p) => p.x === s.food!.x && p.y === s.food!.y)).toBe(false);
  });
  it('ignores reversing and dies on walls and self-collision', () => {
    let s = snakeNew(2, 8, 8);
    expect(snakeTurn(s, 'left').queued).toEqual([]);
    s = { ...s, food: null };
    for (let i = 0; i < 10 && s.alive; i++) s = snakeStep(s);
    expect(s.alive).toBe(false);
    // self collision: a 5-long snake turning in a tight square
    let t = snakeNew(3, 10, 10);
    t = { ...t, snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }], food: null, dir: 'right' };
    for (const d of ['up'] as Dir[]) t = snakeTurn(t, d);
    t = snakeStep(t);
    expect(t.alive).toBe(false);
  });
  it('wraps around edges in wrap mode', () => {
    let s = snakeNew(4, 6, 6, true);
    s = { ...s, food: null, snake: [{ x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }] };
    s = snakeStep(s);
    expect(s.alive).toBe(true);
    expect(s.snake[0]).toEqual({ x: 0, y: 2 });
  });
});

describe('falling blocks', () => {
  const emptyBoard = () => Array.from({ length: BLOCKS_H }, () => Array(BLOCKS_W).fill(0));
  it('gravity moves the piece down and locks it at the bottom', () => {
    let s = blocksNew(7);
    const before = s.piece.y;
    s = blocksTick(s);
    expect(s.piece.y).toBe(before + 1);
    const kind = s.piece.kind;
    s = blocksHardDrop(s);
    expect(s.board.flat().filter(Boolean)).toHaveLength(4);
    expect(s.piece.kind).not.toBeUndefined();
    expect(s.score).toBeGreaterThan(0);
    expect(kind).toBeTruthy();
  });
  it('walls block movement and rotation stays in bounds', () => {
    let s = blocksNew(9);
    for (let i = 0; i < 20; i++) s = blocksMove(s, -1);
    expect(Math.min(...pieceCells(s.piece).map(([, c]) => c))).toBe(0);
    for (let i = 0; i < 4; i++) s = blocksRotate(s);
    expect(pieceCells(s.piece).every(([, c]) => c >= 0 && c < BLOCKS_W)).toBe(true);
  });
  it('clears full lines with level-scaled scoring', () => {
    const board = emptyBoard();
    for (let c = 0; c < BLOCKS_W; c++) if (c < 3 || c > 6) { board[19]![c] = 1; board[18]![c] = 1; }
    // O piece fills columns 4-5 rows 18-19; place I-ish? use an O plus fill cols 3 & 6 manually
    board[19]![3] = 1; board[18]![3] = 1; board[19]![6] = 1; board[18]![6] = 1;
    let s: BlocksState = { ...blocksNew(1), board, piece: { kind: 'O', rot: 0, x: 4, y: 0 } };
    s = blocksHardDrop(s);
    expect(s.lines).toBe(2);
    expect(s.score).toBe(300 + 2 * 18);
    expect(s.board[19]!.every((v) => v === 0)).toBe(true);
  });
  it('hold swaps once per piece and game ends on overflow', () => {
    let s = blocksNew(5);
    const k = s.piece.kind;
    s = blocksHold(s);
    expect(s.hold).toBe(k);
    expect(blocksHold(s)).toBe(s);
    const full = emptyBoard().map((row, r) => (r < 2 ? row : row.map((_, c) => (c === 0 ? 0 : 1))));
    let o: BlocksState = { ...blocksNew(2), board: full };
    o = blocksHardDrop(o);
    expect(o.over).toBe(true);
    expect(blocksInterval(1)).toBeGreaterThan(blocksInterval(10));
  });
});

describe('2048', () => {
  it('slides and merges each pair once', () => {
    expect(slideRow([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 });
    expect(slideRow([0, 2, 0, 2])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
    expect(slideRow([4, 4, 8, 0])).toEqual({ row: [8, 8, 0, 0], gained: 8 });
  });
  it('a move spawns exactly one new tile; no-op moves change nothing', () => {
    const s = { ...g2048New(1), grid: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]] };
    const left = g2048Move(s, 'left');
    expect(left.moved).toBe(true);
    expect(left.state.grid.flat().filter(Boolean)).toHaveLength(3);
    const blocked = g2048Move({ ...s, grid: [[2, 4, 2, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }, 'left');
    expect(blocked.moved).toBe(false);
  });
  it('detects win and game over', () => {
    const won = g2048Move({ ...g2048New(1), grid: [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }, 'left');
    expect(won.state.won).toBe(true);
    expect(won.state.score).toBe(2048);
    expect(g2048CanMove([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])).toBe(false);
  });
});

describe('pong', () => {
  it('ball bounces off walls and a paddle, and points are scored past a paddle', () => {
    let s = pongNew(1);
    s = { ...s, ball: { x: 50, y: 1.5, vx: 0, vy: -40 } };
    s = pongStep(s, 0.05, { left: 0, right: 0 });
    expect(s.ball.vy).toBeGreaterThan(0);
    // ball heading left at the left paddle's height → bounced back
    s = { ...pongNew(1), ball: { x: 6, y: PONG_H / 2, vx: -60, vy: 0 } };
    s = pongStep(s, 0.05, { left: 0, right: 0 });
    expect(s.ball.vx).toBeGreaterThan(0);
    // ball heading left with the paddle far away → right scores
    s = { ...pongNew(1), paddles: [8, PONG_H / 2], ball: { x: 2, y: 50, vx: -80, vy: 0 } };
    for (let i = 0; i < 5 && s.score[1] === 0; i++) s = pongStep(s, 0.05, { left: 0, right: 0 });
    expect(s.score).toEqual([0, 1]);
    expect(s.ball.x).toBe(PONG_W / 2); // re-served from the centre
  });
  it('declares a winner at the target', () => {
    let s = { ...pongNew(1, 1), paddles: [8, PONG_H / 2] as [number, number], ball: { x: 2, y: 50, vx: -80, vy: 0 } };
    for (let i = 0; i < 5; i++) s = pongStep(s, 0.05, { left: 0, right: 0 });
    expect(s.winner).toBe(2);
    expect(pongStep(s, 0.05, { left: 1, right: 1 })).toBe(s);
  });
  it('paddles stay on the field', () => {
    let s = pongNew(1);
    for (let i = 0; i < 100; i++) s = pongStep({ ...s, ball: { x: 50, y: 30, vx: 0, vy: 0 } }, 0.05, { left: -1, right: 1 });
    expect(s.paddles[0]).toBeGreaterThan(0);
    expect(s.paddles[1]).toBeLessThan(PONG_H);
  });
});

describe('minesweeper', () => {
  it('first reveal is always safe and opens an area', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = minesReveal(minesNew('hard', seed), 0);
      expect(s.status).not.toBe('lost');
      expect(s.cells.filter((c) => c.mine)).toHaveLength(40);
      expect(s.cells[0]!.adjacent).toBe(0);
      expect(s.revealedCount).toBeGreaterThan(1);
    }
  });
  it('adjacent counts are correct and revealing a mine loses', () => {
    const s = minesReveal(minesNew('easy', 3), 40);
    for (let i = 0; i < s.cells.length; i++) expect(s.cells[i]!.adjacent).toBe(minesNeighbors(s, i).filter((n) => s.cells[n]!.mine).length);
    const mine = s.cells.findIndex((c) => c.mine);
    const lost = minesReveal(s, mine);
    expect(lost.status).toBe('lost');
    expect(lost.exploded).toBe(mine);
  });
  it('flags protect cells; revealing all safe cells wins', () => {
    let s = minesReveal(minesNew('easy', 5), 40);
    const mine = s.cells.findIndex((c) => c.mine);
    s = minesToggleFlag(s, mine);
    expect(s.flags).toBe(1);
    expect(minesReveal(s, mine)).toBe(s);
    for (let i = 0; i < s.cells.length; i++) if (!s.cells[i]!.mine) s = minesReveal(s, i);
    expect(s.status).toBe('won');
    expect(minesChord(s, 0)).toBe(s);
  });
});

describe('sudoku', () => {
  it('generates valid puzzles with exactly one solution', () => {
    for (const [d, seed] of [['easy', 1], ['medium', 2], ['hard', 3]] as const) {
      const { puzzle, solution } = sudokuGenerate(d, seed);
      expect(sudokuIsValid(puzzle)).toBe(true);
      expect(solution.every((v) => v >= 1 && v <= 9)).toBe(true);
      expect(sudokuIsValid(solution)).toBe(true);
      expect(puzzle.every((v, i) => v === 0 || v === solution[i])).toBe(true);
      expect(sudokuCountSolutions(puzzle, 2)).toBe(1);
      expect(sudokuSolve(puzzle)).toEqual(solution);
    }
    const easy = sudokuGenerate('easy', 9).puzzle.filter(Boolean).length;
    const hard = sudokuGenerate('hard', 9).puzzle.filter(Boolean).length;
    expect(easy).toBeGreaterThan(hard);
  });
  it('tracks mistakes, hints, and wins', () => {
    let s = sudokuNew('easy', 4);
    const empty = s.values.indexOf(0);
    const wrong = (s.solution[empty]! % 9) + 1;
    let r = sudokuEnter(s, empty, wrong);
    expect(r.correct).toBe(false);
    expect(r.state.mistakes).toBe(1);
    s = r.state;
    r = sudokuEnter(s, s.puzzle.findIndex(Boolean), 5);
    expect(r.correct).toBeNull(); // givens are locked
    const h = sudokuHint(s, empty);
    expect(h.cell).toBe(empty);
    expect(h.state.values[empty]).toBe(s.solution[empty]);
    expect(h.state.hintsUsed).toBe(1);
    s = h.state;
    for (let i = 0; i < 81; i++) if (!s.values[i]) s = sudokuEnter(s, i, s.solution[i]!).state;
    expect(s.status).toBe('won');
    expect(sudokuConflicts(s.values).size).toBe(0);
  });
  it('three mistakes lose and invalid grids are detected', () => {
    let s = sudokuNew('medium', 5);
    const empty = s.values.indexOf(0);
    for (let k = 0; k < 3; k++) s = sudokuEnter(s, empty, (s.solution[empty]! % 9) + 1).state;
    expect(s.status).toBe('lost');
    const bad = Array(81).fill(0); bad[0] = 5; bad[1] = 5;
    expect(sudokuIsValid(bad)).toBe(false);
    expect(sudokuCountSolutions(bad)).toBe(0);
    expect(sudokuConflicts(bad)).toEqual(new Set([0, 1]));
  });
});

describe('hangman', () => {
  it('has bundled words for every language and difficulty, typeable with the on-screen alphabet', () => {
    const words = hangmanAllWords();
    for (const l of LOCALES) for (const d of ['easy', 'medium', 'hard'] as const) expect(words.filter((w) => w.locale === l && w.difficulty === d).length).toBeGreaterThanOrEqual(20);
    for (const w of words) for (const ch of w.word) {
      if (!/\p{L}/u.test(ch)) continue;
      expect(HANGMAN_ALPHABET[w.locale], `${w.word} ${ch}`).toContain(hangmanFold(ch, w.locale));
    }
  });
  it('reveals letters, folds accents and hamza, and ends the round', () => {
    let s = { ...hangmanNew('fr', 'easy', 1), word: 'école' };
    let r = hangmanGuess(s, 'e');
    expect(r.hit).toBe(true);
    expect(hangmanMask(r.state)).toEqual(['é', null, null, null, 'e']);
    expect(hangmanGuess(r.state, 'E').hit).toBeNull(); // duplicate
    s = r.state;
    for (const ch of 'col') s = hangmanGuess(s, ch).state;
    expect(s.status).toBe('won');
    let a = { ...hangmanNew('ar', 'easy', 1), word: 'أسد' };
    a = hangmanGuess(a, 'ا').state;
    expect(hangmanMask(a)[0]).toBe('أ');
    let l = { ...hangmanNew('en', 'easy', 1), word: 'cat' };
    for (const ch of 'zxqwvb') l = hangmanGuess(l, ch).state;
    expect(l.status).toBe('lost');
    expect(l.wrong).toHaveLength(6);
  });
  it('shows spaces in multi-word answers', () => {
    const s = { ...hangmanNew('ar', 'hard', 1), word: 'قوس قزح' };
    expect(hangmanMask(s)[3]).toBe(' ');
  });
});

describe('maze escape', () => {
  it('generates perfect mazes where the exit is always reachable', () => {
    for (let seed = 0; seed < 30; seed++) {
      const m = mazeNew('hard', seed);
      const path = mazeShortestPath(m, m.player, m.exit);
      expect(path).not.toBeNull();
      // perfect maze: exactly w*h-1 passages
      let passages = 0;
      for (let i = 0; i < m.w * m.h; i++) passages += (m.walls[i]! & 2 ? 0 : 1) + (m.walls[i]! & 4 ? 0 : 1);
      expect(passages).toBe(m.w * m.h - 1);
    }
    expect(mazeGenerate(5, 5, 1)).toEqual(mazeGenerate(5, 5, 1));
  });
  it('walls block movement; following the solution wins and records time', () => {
    let m = mazeNew('easy', 11);
    const path = mazeShortestPath(m, m.player, m.exit)!;
    const blocked = (['up', 'left'] as Dir[]).filter((d) => !mazeCanMove(m, m.player, d));
    expect(blocked).toHaveLength(2);
    expect(mazeMove(m, 'up', 0)).toBe(m);
    let t = 1000;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i]!.x - path[i - 1]!.x, dy = path[i]!.y - path[i - 1]!.y;
      m = mazeMove(m, dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up', (t += 100));
    }
    expect(m.status).toBe('won');
    expect(m.moves).toBe(path.length - 1);
    expect(m.finishedAt! - m.startedAt!).toBe((path.length - 2) * 100);
  });
  it('time limit loses', () => {
    let m = mazeNew('easy', 2);
    const d = (['right', 'down'] as Dir[]).find((x) => mazeCanMove(m, m.player, x))!;
    m = mazeMove(m, d, 0);
    expect(mazeTick(m, 89_000).status).toBe('playing');
    expect(mazeTick(m, 91_000).status).toBe('lost');
  });
});

describe('reaction test', () => {
  it('measures reaction times from supplied timestamps', () => {
    let s = reactionNew(2, 1);
    const a = reactionArm(s, 0);
    expect(a.delay).toBeGreaterThanOrEqual(REACTION_MIN_DELAY);
    expect(a.delay).toBeLessThanOrEqual(REACTION_MAX_DELAY);
    s = reactionGo(a.state, 2000);
    s = reactionTap(s, 2234);
    expect(s.last).toBe(234);
    expect(s.phase).toBe('result');
    s = reactionTap(reactionGo(reactionArm(s, 3000).state, 5000), 5300);
    expect(s.phase).toBe('done');
    expect(reactionSummary(s)).toEqual({ average: 267, best: 234, worst: 300 });
  });
  it('detects false starts (early tap or anticipation)', () => {
    let s = reactionArm(reactionNew(3), 0).state;
    s = reactionTap(s, 500);
    expect(s.phase).toBe('false-start');
    expect(s.falseStarts).toBe(1);
    expect(s.results).toEqual([]);
    s = reactionTap(reactionGo(reactionArm(s, 0).state, 1000), 1050);
    expect(s.phase).toBe('false-start');
    expect(s.falseStarts).toBe(2);
  });
});

describe('simon says', () => {
  it('extends the sequence each round and speeds up', () => {
    let s = simonShown(simonNew('medium', 3));
    const f1 = simonFlashMs(s);
    for (let round = 1; round <= 5; round++) {
      const seq = s.sequence;
      for (let i = 0; i < seq.length; i++) {
        const r = simonPress(s, seq[i]!);
        expect(r.result).toBe(i === seq.length - 1 ? 'round' : 'ok');
        s = r.state;
      }
      expect(s.sequence).toHaveLength(round + 1);
      s = simonShown(s);
    }
    expect(simonScore(s)).toBe(5);
    expect(simonFlashMs(s)).toBeLessThan(f1);
  });
  it('wrong pad ends the game (easy gives one retry)', () => {
    const wrong = (s: ReturnType<typeof simonNew>) => (s.sequence[0]! + 1) % s.pads;
    let s = simonShown(simonNew('hard', 1));
    expect(s.pads).toBe(6);
    expect(simonPress(s, wrong(s)).result).toBe('over');
    s = simonShown(simonNew('easy', 1));
    const r = simonPress(s, wrong(s));
    expect(r.result).toBe('retry');
    expect(simonPress(simonShown(r.state), wrong(s)).result).toBe('over');
  });
});

describe('memory match', () => {
  it('builds configurable grids with each symbol exactly twice', () => {
    for (const g of Object.keys(MEMORY_GRIDS) as Array<keyof typeof MEMORY_GRIDS>) {
      const s = mmNew(g, 1);
      expect(s.cards).toHaveLength(MEMORY_GRIDS[g].cols * MEMORY_GRIDS[g].rows);
      const counts = new Map<string, number>();
      for (const c of s.cards) counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    }
  });
  it('counts moves, matches and finishes; two-player turns pass on a miss', () => {
    let s = mmNew('3x4', 2, 2);
    const first = s.cards[0]!;
    const twin = s.cards.find((c) => c.symbol === first.symbol && c.id !== first.id)!;
    const other = s.cards.find((c) => c.symbol !== first.symbol)!;
    let r = mmFlip(s, first.id, 0); r = mmFlip(r.state, other.id, 100);
    expect(r.match).toBe(false);
    expect(r.state.turn).toBe(1);
    s = mmFlip(r.state, first.id, 200).state;
    r = mmFlip(s, twin.id, 300);
    expect(r.match).toBe(true);
    expect(r.state.scores).toEqual([0, 1]);
    expect(r.state.turn).toBe(1);
    s = r.state;
    const remaining = new Map<string, number[]>();
    for (const c of s.cards) if (!c.matched) remaining.set(c.symbol, [...(remaining.get(c.symbol) ?? []), c.id]);
    let t = 400;
    for (const [a, b] of remaining.values()) { s = mmFlip(s, a!, t++).state; s = mmFlip(s, b!, t++).state; }
    expect(s.finishedAt).not.toBeNull();
    expect(s.moves).toBe(7);
    expect(s.matches).toBe(6);
  });
  it('score rewards fewer moves', () => {
    const base = { ...mmNew('4x4', 1), startedAt: 0, finishedAt: 30_000 };
    expect(mmScore({ ...base, moves: 8 })).toBeGreaterThan(mmScore({ ...base, moves: 20 }));
  });
});

describe('checkers', () => {
  const empty = (): CheckersPiece[] => Array(64).fill(0);
  const at = (r: number, c: number) => r * 8 + c;
  it('opening position has 12 pieces each and 7 legal moves', () => {
    const s = checkersNew();
    expect(s.board.filter((p) => p === 1)).toHaveLength(12);
    expect(s.board.filter((p) => p === 2)).toHaveLength(12);
    expect(checkersLegalMoves(s)).toHaveLength(7);
  });
  it('captures are mandatory and multi-jumps chain', () => {
    const board = empty();
    board[at(5, 0)] = 1; board[at(4, 1)] = 2; board[at(2, 3)] = 2; board[at(6, 7)] = 1; board[at(0, 7)] = 2;
    const s: CheckersState = { board, turn: 1, winner: null, quietPlies: 0, moves: 0, last: null };
    const moves = checkersLegalMoves(s);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ from: at(5, 0), path: [at(3, 2), at(1, 4)], captures: [at(4, 1), at(2, 3)] });
    const after = checkersApply(s, moves[0]!);
    expect(after.board.filter((p) => p === 2)).toHaveLength(1);
    expect(() => checkersApply(s, { from: at(6, 7), path: [at(5, 6)], captures: [] })).toThrow('Illegal move');
  });
  it('promotes to king on the far row and kings move backwards', () => {
    const board = empty();
    board[at(1, 2)] = 1; board[at(7, 0)] = 2;
    let s: CheckersState = { board, turn: 1, winner: null, quietPlies: 0, moves: 0, last: null };
    s = checkersApply(s, { from: at(1, 2), path: [at(0, 1)], captures: [] });
    expect(s.board[at(0, 1)]).toBe(3);
    s = { ...s, turn: 1 };
    expect(checkersLegalMoves(s, at(0, 1)).map((m) => m.path[0])).toContain(at(1, 0));
  });
  it('a player with no pieces or no moves loses; AI returns legal moves', () => {
    const board = empty();
    board[at(5, 2)] = 1; board[at(4, 3)] = 2;
    const s: CheckersState = { board, turn: 1, winner: null, quietPlies: 0, moves: 0, last: null };
    const after = checkersApply(s, checkersLegalMoves(s)[0]!);
    expect(after.winner).toBe(1);
    let g = checkersNew();
    for (let i = 0; i < 30 && !g.winner; i++) g = checkersApply(g, checkersAiMove(g, i % 2 ? 'medium' : 'easy', i));
    expect(g.moves).toBeGreaterThan(0);
  });
  it('hard AI takes a free piece', () => {
    const board = empty();
    board[at(5, 2)] = 1; board[at(2, 5)] = 2; board[at(3, 6)] = 1; board[at(7, 0)] = 1;
    const s: CheckersState = { board, turn: 2, winner: null, quietPlies: 0, moves: 0, last: null };
    const m = checkersAiMove(s, 'hard', 1);
    expect(m.captures).toEqual([at(3, 6)]);
  });
});

describe('arcade stats and persistence', () => {
  it('records wins, streaks, best score and best time', () => {
    let st = applyArcadeResult(undefined, { gameId: 'snake', outcome: 'done', score: 120, playMs: 5000 }, 'dev1', 1).stats;
    st = applyArcadeResult(st, { gameId: 'snake', outcome: 'done', score: 80, playMs: 5000 }, 'dev1', 2).stats;
    expect(st.bestScore).toBe(120);
    expect(arcadeTotals(st).plays).toBe(2);
    let m = applyArcadeResult(undefined, { gameId: 'minesweeper', outcome: 'win', timeMs: 50_000, playMs: 50_000 }, 'd', 1);
    expect(m.newBestTime).toBe(true);
    m = applyArcadeResult(m.stats, { gameId: 'minesweeper', outcome: 'loss', timeMs: 1000, playMs: 1000 }, 'd', 2);
    expect(m.stats.bestTimeMs).toBe(50_000); // losses never set a time record
    m = applyArcadeResult(m.stats, { gameId: 'minesweeper', outcome: 'win', timeMs: 40_000, playMs: 40_000 }, 'd', 3);
    expect(m.stats.bestTimeMs).toBe(40_000);
    expect(m.stats.streak).toBe(1);
    m = applyArcadeResult(m.stats, { gameId: 'minesweeper', outcome: 'win', timeMs: 45_000, playMs: 1 }, 'd', 4);
    expect(m.stats.bestStreak).toBe(2);
    expect(applyArcadeResult(undefined, { gameId: 'snake', outcome: 'done', score: Number.NaN, playMs: -5 }, 'd', 1).stats.bestScore).toBe(0);
  });
  it('merges devices without losing plays or regressing bests', () => {
    const a = applyArcadeResult(undefined, { gameId: '2048', outcome: 'done', score: 900, playMs: 10 }, 'phone', 5).stats;
    const b = applyArcadeResult(undefined, { gameId: '2048', outcome: 'done', score: 1500, playMs: 10 }, 'laptop', 6).stats;
    const merged = mergeArcadeStats(a, b);
    expect(arcadeTotals(merged).plays).toBe(2);
    expect(merged.bestScore).toBe(1500);
    expect(mergeArcadeStats(merged, a)).toEqual(merged);
    expect(() => mergeArcadeStats(a, { ...b, gameId: 'snake' })).toThrow();
  });
  it('repository persists stats, favorites, recents, settings and saved games; ignores corrupt data', async () => {
    const store = new MemoryStore();
    const repo = new ArcadeRepository(store, 'dev');
    await repo.record({ gameId: 'pong', outcome: 'win', playMs: 60_000 }, 10);
    expect((await repo.stats('pong'))!.bestStreak).toBe(1);
    expect(await repo.dirty()).toEqual(['pong']);
    await repo.clearDirty(['pong']);
    expect(await repo.dirty()).toEqual([]);
    expect(await repo.toggleFavorite('sudoku')).toEqual(['sudoku']);
    expect(await repo.toggleFavorite('sudoku')).toEqual([]);
    expect((await repo.meta()).recent).toEqual(['pong']);
    expect((await repo.updateSettings({ sound: false, volume: 7 })).volume).toBe(1);
    await repo.saveGame('2048', { grid: [[2]] });
    expect(await repo.loadGame('2048')).toEqual({ grid: [[2]] });
    await repo.clearGame('2048');
    expect(await repo.loadGame('2048')).toBeNull();
    // reload from the same store (simulated app restart)
    const again = new ArcadeRepository(store, 'dev');
    expect((await again.meta()).settings.sound).toBe(false);
    expect(arcadeSummary(await again.allStats())).toMatchObject({ gamesPlayed: 1, plays: 1, wins: 1 });
    await store.setItem('exammate.arcade.stats.v1', '{"pong":{"gameId":"pong","bestScore":-1}, "bogus": 1}');
    expect(await again.allStats()).toEqual({});
    await store.setItem('exammate.arcade.stats.v1', 'not json');
    expect(await again.allStats()).toEqual({});
    expect(await again.mergeRemote([{ junk: true }, (await repo.stats('pong')) ?? null])).toBe(0);
    expect(isArcadeStatsRecord(applyArcadeResult(undefined, { gameId: 'pong', outcome: 'win', playMs: 1 }, 'x', 1).stats)).toBe(true);
  });
});

describe('falling blocks start level', () => {
  it('harder difficulties start at a higher level that persists after clears', () => {
    const s = blocksNew(1, 4);
    expect(s.level).toBe(4);
    expect(blocksHardDrop(s).level).toBe(4);
  });
});
