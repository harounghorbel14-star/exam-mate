import { mulberry32 } from '../exam/grading.js';
import type { Locale } from '../i18n/index.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export type HangmanCategory = 'animals' | 'food' | 'nature' | 'objects' | 'places';
interface Entry { w: string; c: HangmanCategory }

/** Bundled, original word lists (no network). Difficulty is by length/rarity. */
const WORDS: Record<Locale, Record<ArcadeDifficulty, Entry[]>> = {
  en: {
    easy: [
      { w: 'cat', c: 'animals' }, { w: 'dog', c: 'animals' }, { w: 'fish', c: 'animals' }, { w: 'frog', c: 'animals' }, { w: 'duck', c: 'animals' },
      { w: 'apple', c: 'food' }, { w: 'bread', c: 'food' }, { w: 'lemon', c: 'food' }, { w: 'rice', c: 'food' }, { w: 'cake', c: 'food' },
      { w: 'tree', c: 'nature' }, { w: 'rain', c: 'nature' }, { w: 'moon', c: 'nature' }, { w: 'star', c: 'nature' }, { w: 'lake', c: 'nature' },
      { w: 'chair', c: 'objects' }, { w: 'clock', c: 'objects' }, { w: 'phone', c: 'objects' }, { w: 'book', c: 'objects' }, { w: 'lamp', c: 'objects' },
      { w: 'park', c: 'places' }, { w: 'farm', c: 'places' }, { w: 'shop', c: 'places' }, { w: 'beach', c: 'places' }, { w: 'house', c: 'places' },
    ],
    medium: [
      { w: 'rabbit', c: 'animals' }, { w: 'turtle', c: 'animals' }, { w: 'parrot', c: 'animals' }, { w: 'monkey', c: 'animals' }, { w: 'dolphin', c: 'animals' },
      { w: 'cheese', c: 'food' }, { w: 'carrot', c: 'food' }, { w: 'noodles', c: 'food' }, { w: 'pancake', c: 'food' }, { w: 'orange', c: 'food' },
      { w: 'forest', c: 'nature' }, { w: 'thunder', c: 'nature' }, { w: 'volcano', c: 'nature' }, { w: 'desert', c: 'nature' }, { w: 'island', c: 'nature' },
      { w: 'blanket', c: 'objects' }, { w: 'pencil', c: 'objects' }, { w: 'bottle', c: 'objects' }, { w: 'mirror', c: 'objects' }, { w: 'basket', c: 'objects' },
      { w: 'museum', c: 'places' }, { w: 'harbor', c: 'places' }, { w: 'library', c: 'places' }, { w: 'stadium', c: 'places' }, { w: 'airport', c: 'places' },
    ],
    hard: [
      { w: 'chameleon', c: 'animals' }, { w: 'porcupine', c: 'animals' }, { w: 'flamingo', c: 'animals' }, { w: 'jellyfish', c: 'animals' }, { w: 'kangaroo', c: 'animals' },
      { w: 'pineapple', c: 'food' }, { w: 'zucchini', c: 'food' }, { w: 'avocado', c: 'food' }, { w: 'blueberry', c: 'food' }, { w: 'croissant', c: 'food' },
      { w: 'avalanche', c: 'nature' }, { w: 'waterfall', c: 'nature' }, { w: 'hurricane', c: 'nature' }, { w: 'glacier', c: 'nature' }, { w: 'rainbow', c: 'nature' },
      { w: 'umbrella', c: 'objects' }, { w: 'telescope', c: 'objects' }, { w: 'keyboard', c: 'objects' }, { w: 'compass', c: 'objects' }, { w: 'lantern', c: 'objects' },
      { w: 'lighthouse', c: 'places' }, { w: 'observatory', c: 'places' }, { w: 'greenhouse', c: 'places' }, { w: 'playground', c: 'places' }, { w: 'monastery', c: 'places' },
    ],
  },
  fr: {
    easy: [
      { w: 'chat', c: 'animals' }, { w: 'chien', c: 'animals' }, { w: 'loup', c: 'animals' }, { w: 'ours', c: 'animals' }, { w: 'vache', c: 'animals' },
      { w: 'pain', c: 'food' }, { w: 'pomme', c: 'food' }, { w: 'lait', c: 'food' }, { w: 'riz', c: 'food' }, { w: 'miel', c: 'food' },
      { w: 'arbre', c: 'nature' }, { w: 'pluie', c: 'nature' }, { w: 'lune', c: 'nature' }, { w: 'mer', c: 'nature' }, { w: 'fleur', c: 'nature' },
      { w: 'table', c: 'objects' }, { w: 'livre', c: 'objects' }, { w: 'lampe', c: 'objects' }, { w: 'clé', c: 'objects' }, { w: 'verre', c: 'objects' },
      { w: 'parc', c: 'places' }, { w: 'école', c: 'places' }, { w: 'plage', c: 'places' }, { w: 'ferme', c: 'places' }, { w: 'gare', c: 'places' },
    ],
    medium: [
      { w: 'lapin', c: 'animals' }, { w: 'tortue', c: 'animals' }, { w: 'girafe', c: 'animals' }, { w: 'requin', c: 'animals' }, { w: 'écureuil', c: 'animals' },
      { w: 'fromage', c: 'food' }, { w: 'carotte', c: 'food' }, { w: 'crêpe', c: 'food' }, { w: 'cerise', c: 'food' }, { w: 'tomate', c: 'food' },
      { w: 'forêt', c: 'nature' }, { w: 'tonnerre', c: 'nature' }, { w: 'volcan', c: 'nature' }, { w: 'désert', c: 'nature' }, { w: 'rivière', c: 'nature' },
      { w: 'crayon', c: 'objects' }, { w: 'bouteille', c: 'objects' }, { w: 'miroir', c: 'objects' }, { w: 'panier', c: 'objects' }, { w: 'horloge', c: 'objects' },
      { w: 'musée', c: 'places' }, { w: 'château', c: 'places' }, { w: 'marché', c: 'places' }, { w: 'hôpital', c: 'places' }, { w: 'théâtre', c: 'places' },
    ],
    hard: [
      { w: 'caméléon', c: 'animals' }, { w: 'hérisson', c: 'animals' }, { w: 'papillon', c: 'animals' }, { w: 'kangourou', c: 'animals' }, { w: 'méduse', c: 'animals' },
      { w: 'ananas', c: 'food' }, { w: 'courgette', c: 'food' }, { w: 'framboise', c: 'food' }, { w: 'croissant', c: 'food' }, { w: 'pamplemousse', c: 'food' },
      { w: 'avalanche', c: 'nature' }, { w: 'cascade', c: 'nature' }, { w: 'ouragan', c: 'nature' }, { w: 'glacier', c: 'nature' }, { w: 'arc-en-ciel', c: 'nature' },
      { w: 'parapluie', c: 'objects' }, { w: 'télescope', c: 'objects' }, { w: 'boussole', c: 'objects' }, { w: 'lanterne', c: 'objects' }, { w: 'clavier', c: 'objects' },
      { w: 'phare', c: 'places' }, { w: 'bibliothèque', c: 'places' }, { w: 'observatoire', c: 'places' }, { w: 'aéroport', c: 'places' }, { w: 'boulangerie', c: 'places' },
    ],
  },
  ar: {
    easy: [
      { w: 'قط', c: 'animals' }, { w: 'كلب', c: 'animals' }, { w: 'أسد', c: 'animals' }, { w: 'فيل', c: 'animals' }, { w: 'سمك', c: 'animals' },
      { w: 'خبز', c: 'food' }, { w: 'تمر', c: 'food' }, { w: 'حليب', c: 'food' }, { w: 'عسل', c: 'food' }, { w: 'موز', c: 'food' },
      { w: 'شمس', c: 'nature' }, { w: 'قمر', c: 'nature' }, { w: 'بحر', c: 'nature' }, { w: 'نهر', c: 'nature' }, { w: 'جبل', c: 'nature' },
      { w: 'باب', c: 'objects' }, { w: 'كتاب', c: 'objects' }, { w: 'قلم', c: 'objects' }, { w: 'كرسي', c: 'objects' }, { w: 'مفتاح', c: 'objects' },
      { w: 'بيت', c: 'places' }, { w: 'سوق', c: 'places' }, { w: 'مدرسة', c: 'places' }, { w: 'حديقة', c: 'places' }, { w: 'شاطئ', c: 'places' },
    ],
    medium: [
      { w: 'أرنب', c: 'animals' }, { w: 'سلحفاة', c: 'animals' }, { w: 'زرافة', c: 'animals' }, { w: 'دلفين', c: 'animals' }, { w: 'حصان', c: 'animals' },
      { w: 'برتقال', c: 'food' }, { w: 'جزر', c: 'food' }, { w: 'طماطم', c: 'food' }, { w: 'زيتون', c: 'food' }, { w: 'فراولة', c: 'food' },
      { w: 'غابة', c: 'nature' }, { w: 'صحراء', c: 'nature' }, { w: 'بركان', c: 'nature' }, { w: 'جزيرة', c: 'nature' }, { w: 'سحابة', c: 'nature' },
      { w: 'ساعة', c: 'objects' }, { w: 'مرآة', c: 'objects' }, { w: 'زجاجة', c: 'objects' }, { w: 'مصباح', c: 'objects' }, { w: 'سلة', c: 'objects' },
      { w: 'متحف', c: 'places' }, { w: 'ميناء', c: 'places' }, { w: 'مكتبة', c: 'places' }, { w: 'مطار', c: 'places' }, { w: 'ملعب', c: 'places' },
    ],
    hard: [
      { w: 'حرباء', c: 'animals' }, { w: 'قنفذ', c: 'animals' }, { w: 'فراشة', c: 'animals' }, { w: 'كنغر', c: 'animals' }, { w: 'أخطبوط', c: 'animals' },
      { w: 'أناناس', c: 'food' }, { w: 'كوسة', c: 'food' }, { w: 'باذنجان', c: 'food' }, { w: 'رمان', c: 'food' }, { w: 'بطيخ', c: 'food' },
      { w: 'شلال', c: 'nature' }, { w: 'إعصار', c: 'nature' }, { w: 'قوس قزح', c: 'nature' }, { w: 'نهر جليدي', c: 'nature' }, { w: 'زلزال', c: 'nature' },
      { w: 'مظلة', c: 'objects' }, { w: 'منظار', c: 'objects' }, { w: 'بوصلة', c: 'objects' }, { w: 'فانوس', c: 'objects' }, { w: 'لوحة مفاتيح', c: 'objects' },
      { w: 'منارة', c: 'places' }, { w: 'مستشفى', c: 'places' }, { w: 'مخبزة', c: 'places' }, { w: 'مرصد', c: 'places' }, { w: 'مسرح', c: 'places' },
    ],
  },
};

export const HANGMAN_ALPHABET: Record<Locale, string[]> = {
  en: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  fr: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  ar: 'ابتثجحخدذرزسشصضطظعغفقكلمنهويةء'.split(''),
};

export const HANGMAN_MAX_WRONG = 6;

/** Folds letters so one key covers its variants (é→e, أ→ا, ى→ي …). */
export function hangmanFold(ch: string, locale: Locale): string {
  const lower = ch.toLowerCase();
  if (locale === 'ar') return lower.replace(/[أإآٱ]/g, 'ا').replace(/ى|ئ/g, 'ي').replace(/ؤ/g, 'و');
  return lower.normalize('NFD').replace(/[̀-ͯ]/g, '').replace('æ', 'a').replace('œ', 'o');
}

export function hangmanWordCount(locale: Locale, difficulty: ArcadeDifficulty): number {
  return WORDS[locale][difficulty].length;
}

export function hangmanAllWords(): Array<{ locale: Locale; difficulty: ArcadeDifficulty; word: string; category: HangmanCategory }> {
  return (Object.keys(WORDS) as Locale[]).flatMap((locale) => (Object.keys(WORDS[locale]) as ArcadeDifficulty[])
    .flatMap((difficulty) => WORDS[locale][difficulty].map((e) => ({ locale, difficulty, word: e.w, category: e.c }))));
}

export interface HangmanState {
  locale: Locale; difficulty: ArcadeDifficulty; word: string; category: HangmanCategory;
  guessed: string[]; wrong: string[]; maxWrong: number; status: 'playing' | 'won' | 'lost';
}

export function hangmanNew(locale: Locale, difficulty: ArcadeDifficulty, seed: number, avoid: string[] = []): HangmanState {
  const list = WORDS[locale][difficulty];
  const pool = list.filter((e) => !avoid.includes(e.w));
  const pick = (pool.length ? pool : list)[Math.floor(mulberry32(seed)() * (pool.length || list.length))]!;
  return { locale, difficulty, word: pick.w, category: pick.c, guessed: [], wrong: [], maxWrong: HANGMAN_MAX_WRONG, status: 'playing' };
}

function isLetter(ch: string) { return /\p{L}/u.test(ch); }

/** The word as displayed: unguessed letters → null; spaces/hyphens are shown. */
export function hangmanMask(s: HangmanState): Array<string | null> {
  return [...s.word].map((ch) => (!isLetter(ch) || s.guessed.includes(hangmanFold(ch, s.locale)) ? ch : null));
}

export function hangmanGuess(s: HangmanState, letter: string): { state: HangmanState; hit: boolean | null } {
  const g = hangmanFold(letter, s.locale);
  if (s.status !== 'playing' || g.length !== 1 || !isLetter(g) || s.guessed.includes(g) || s.wrong.includes(g)) return { state: s, hit: null };
  const hit = [...s.word].some((ch) => hangmanFold(ch, s.locale) === g);
  const guessed = hit ? [...s.guessed, g] : s.guessed;
  const wrong = hit ? s.wrong : [...s.wrong, g];
  const next: HangmanState = { ...s, guessed, wrong };
  next.status = wrong.length >= s.maxWrong ? 'lost' : hangmanMask(next).every((c) => c !== null) ? 'won' : 'playing';
  return { state: next, hit };
}
