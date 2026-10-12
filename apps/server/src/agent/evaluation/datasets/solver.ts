/**
 * Versioned evaluation datasets for the agent. Expected values are hand-computed; never
 * produced by the system under test. Bump EVAL_DATASET_VERSION whenever a case changes.
 */
export const EVAL_DATASET_VERSION = 'agent-eval-2026.10.1';

export interface SolveCase { id: string; suite: 'math' | 'science' | 'multilingual'; question: string; expectNumbers?: number[]; expectText?: string; tolerance?: number }

export const SOLVE_CASES: SolveCase[] = [
  { id: 'm01', suite: 'math', question: 'Solve 2x + 3 = 11', expectNumbers: [4] },
  { id: 'm02', suite: 'math', question: 'x^2 - 5x + 6 = 0', expectNumbers: [2, 3] },
  { id: 'm03', suite: 'math', question: '3(x - 2) = 2x + 5', expectNumbers: [11] },
  { id: 'm04', suite: 'math', question: 'x/4 + 1 = 3', expectNumbers: [8] },
  { id: 'm05', suite: 'math', question: '2x^2 - 8 = 0', expectNumbers: [-2, 2] },
  { id: 'm06', suite: 'math', question: 'x^2 + 4x + 4 = 0', expectNumbers: [-2] },
  { id: 'm07', suite: 'math', question: 'Solve 5x - 7 = 3x + 9', expectNumbers: [8] },
  { id: 'm08', suite: 'math', question: '2x + y = 7; x - y = 2', expectNumbers: [3, 1] },
  { id: 'm09', suite: 'math', question: 'x + y + z = 6; x - y = 0; 2z = 4', expectNumbers: [2, 2, 2] },
  { id: 'm10', suite: 'math', question: '3 * (4 + 5)^2', expectNumbers: [243] },
  { id: 'm11', suite: 'math', question: '2^10 - 24', expectNumbers: [1000] },
  { id: 'm12', suite: 'math', question: '1/3 + 1/6', expectNumbers: [0.5] },
  { id: 'm13', suite: 'math', question: 'sqrt(144) + 3^3', expectNumbers: [39] },
  { id: 'm14', suite: 'math', question: 'derivative of x^3', expectText: '3 * x ^ 2' },
  { id: 'm15', suite: 'math', question: 'integrate x^2 from 0 to 3', expectNumbers: [9] },
  { id: 'm16', suite: 'math', question: 'integrate 2x + 1 from 1 to 4', expectNumbers: [18] },
  { id: 'm17', suite: 'math', question: 'Find the mean of 2, 4, 6, 8', expectNumbers: [5] },
  { id: 'm18', suite: 'math', question: 'x^3 - 6x^2 + 11x - 6 = 0', expectNumbers: [1, 2, 3] },
  { id: 'm19', suite: 'math', question: 'exp(x) = 1', expectNumbers: [0] },
  { id: 'm20', suite: 'math', question: 'x^2 = 2', expectNumbers: [-1.41421356, 1.41421356], tolerance: 1e-6 },
  { id: 'm21', suite: 'math', question: 'What is 15% of 80?', expectNumbers: [12] },
  { id: 'm22', suite: 'math', question: 'Solve 4x = 2', expectNumbers: [0.5] },
  { id: 'm23', suite: 'math', question: 'simplify 2x + 3x', expectText: '5 * x' },
  { id: 'm24', suite: 'math', question: 'x^2 + 1 = 0', expectText: 'No real solution' },
  { id: 'm25', suite: 'math', question: 'A rectangle has a perimeter of 30 cm and a width of 5 cm. What is its length?', expectNumbers: [10] },
  { id: 's01', suite: 'science', question: 'convert 72 km/h to m/s', expectNumbers: [20] },
  { id: 's02', suite: 'science', question: 'convert 5 kg to g', expectNumbers: [5000] },
  { id: 's03', suite: 'science', question: 'convert 100 °C to °F', expectNumbers: [212] },
  { id: 's04', suite: 'science', question: 'A car travels 150 m in 6 s. What is its average speed?', expectNumbers: [25] },
  { id: 's05', suite: 'science', question: 'A 1200 kg car accelerates at 3 m/s². Calculate the net force.', expectNumbers: [3600] },
  { id: 's06', suite: 'science', question: 'A resistor of 220 Ω carries a current of 0.05 A. Find the voltage.', expectNumbers: [11] },
  { id: 's07', suite: 'science', question: 'A 2 kg ball moves at 3 m/s. What is its kinetic energy?', expectNumbers: [9] },
  { id: 's08', suite: 'science', question: 'balance H2 + O2 -> H2O', expectText: '2H2 + O2 → 2H2O' },
  { id: 's09', suite: 'science', question: 'balance C3H8 + O2 -> CO2 + H2O', expectText: 'C3H8 + 5O2 → 3CO2 + 4H2O' },
  { id: 's10', suite: 'science', question: 'molar mass of H2O', expectNumbers: [18.015], tolerance: 1e-3 },
  { id: 's11', suite: 'science', question: 'molar mass of NaCl', expectNumbers: [58.44], tolerance: 1e-3 },
  { id: 's12', suite: 'science', question: 'molar mass of CaCO3', expectNumbers: [100.086], tolerance: 1e-3 },
  { id: 's13', suite: 'science', question: 'A wave has frequency 50 Hz and wavelength 2 m. What is its speed?', expectNumbers: [100] },
  { id: 's14', suite: 'science', question: 'convert 2.5 h to min', expectNumbers: [150] },
  { id: 's15', suite: 'science', question: 'A 10 kg box is lifted 5 m. What is its potential energy?', expectNumbers: [490.5] },
  { id: 's16', suite: 'science', question: 'How much heat is needed to warm 2 kg of water by 10 K? (c = 4180 J/(kg K))', expectNumbers: [83600] },
  { id: 'l01', suite: 'multilingual', question: 'Résoudre 3x - 7 = 11', expectNumbers: [6] },
  { id: 'l02', suite: 'multilingual', question: 'حل المعادلة 2x + 4 = 10', expectNumbers: [3] },
  { id: 'l03', suite: 'multilingual', question: 'احسب 3 * (2 + 5)', expectNumbers: [21] },
  { id: 'l04', suite: 'multilingual', question: 'Calcule la dérivée de x^2', expectText: '2 * x' },
  { id: 'l05', suite: 'multilingual', question: 'convertir 3 km en m', expectNumbers: [3000] },
  { id: 'l06', suite: 'multilingual', question: 'Une voiture parcourt 100 m en 4 s. Quelle est sa vitesse ?', expectNumbers: [25] },
  { id: 'l07', suite: 'multilingual', question: 'سيارة تقطع 200 م في 10 ث. ما سرعتها؟', expectNumbers: [20] },
  { id: 'l08', suite: 'multilingual', question: 'الكتلة المولية لـ H2O', expectNumbers: [18.015], tolerance: 1e-3 },
  { id: 'l09', suite: 'multilingual', question: 'وازن H2 + O2 -> H2O', expectText: '2H2 + O2 → 2H2O' },
  { id: 'l10', suite: 'multilingual', question: 'Quelle est la moyenne de 4, 8, 15, 16, 23, 42', expectNumbers: [18] },
  { id: 'l11', suite: 'multilingual', question: 'Résoudre x^2 - 4x + 3 = 0', expectNumbers: [1, 3] },
  { id: 'l12', suite: 'multilingual', question: 'Combien font 25 % de 200 ?', expectNumbers: [50] },
];

export interface CheckCase { id: string; question: string; studentAnswer: string; expectCorrect: boolean }

export const CHECK_CASES: CheckCase[] = [
  { id: 'v01', question: 'Solve 2x + 3 = 11', studentAnswer: '4', expectCorrect: true },
  { id: 'v02', question: 'Solve 2x + 3 = 11', studentAnswer: '5', expectCorrect: false },
  { id: 'v03', question: 'x^2 - 5x + 6 = 0', studentAnswer: '2, 3', expectCorrect: true },
  { id: 'v04', question: 'x^2 - 5x + 6 = 0', studentAnswer: '2', expectCorrect: false },
  { id: 'v05', question: 'convert 1 km to m', studentAnswer: '100', expectCorrect: false },
  { id: 'v06', question: 'convert 1 km to m', studentAnswer: '1000', expectCorrect: true },
  { id: 'v07', question: 'balance H2 + O2 -> H2O', studentAnswer: '2 1 2', expectCorrect: true },
  { id: 'v08', question: 'balance H2 + O2 -> H2O', studentAnswer: '1 1 1', expectCorrect: false },
  { id: 'v09', question: 'molar mass of H2O', studentAnswer: '18', expectCorrect: true },
  { id: 'v10', question: 'molar mass of H2O', studentAnswer: '20', expectCorrect: false },
  { id: 'v11', question: 'integrate x^2 from 0 to 3', studentAnswer: '27', expectCorrect: false },
  { id: 'v12', question: '3x = 1', studentAnswer: '1/3', expectCorrect: true },
];

export interface GroundingCase { id: string; pages: string[]; question: string; expectFound: boolean; mustContain?: string; expectPage?: number }

const BIO = [
  'Chapter 1: The Cell\nThe cell is the basic unit of life. All living organisms are made of cells. The nucleus contains the genetic material of the cell.',
  'Chapter 2: Photosynthesis\nPhotosynthesis is the process by which green plants convert light energy into chemical energy. It takes place in the chloroplasts. Carbon dioxide and water are used to produce glucose and oxygen.',
  'Chapter 3: Respiration\nCellular respiration takes place in the mitochondria. It releases energy from glucose. The energy is stored as ATP.',
];
const PHYS_FR = [
  'Leçon 1 : Le mouvement\nLa vitesse moyenne est le rapport de la distance parcourue sur la durée du parcours. Elle s’exprime en mètres par seconde.',
  'Leçon 2 : Les forces\nUne force est une action mécanique capable de modifier le mouvement d’un objet. Elle se mesure en newtons avec un dynamomètre.',
];
const BIO_AR = [
  'الدرس الأول: الخلية\nالخلية هي الوحدة الأساسية للكائنات الحية. تتكون الخلية من غشاء وسيتوبلازم ونواة.',
  'الدرس الثاني: التنفس\nيحدث التنفس الخلوي في الميتوكوندريا ويطلق الطاقة من الغلوكوز.',
];

export const GROUNDING_CASES: GroundingCase[] = [
  { id: 'g01', pages: BIO, question: 'Where does photosynthesis take place?', expectFound: true, mustContain: 'chloroplasts', expectPage: 2 },
  { id: 'g02', pages: BIO, question: 'Where does cellular respiration take place?', expectFound: true, mustContain: 'mitochondria', expectPage: 3 },
  { id: 'g03', pages: BIO, question: 'What does the nucleus contain?', expectFound: true, mustContain: 'genetic material', expectPage: 1 },
  { id: 'g04', pages: BIO, question: 'What is the capital of Peru?', expectFound: false },
  { id: 'g05', pages: PHYS_FR, question: 'Comment définir la vitesse moyenne ?', expectFound: true, mustContain: 'rapport', expectPage: 1 },
  { id: 'g06', pages: PHYS_FR, question: 'Avec quel appareil mesure-t-on une force ?', expectFound: true, mustContain: 'dynamomètre', expectPage: 2 },
  { id: 'g07', pages: BIO_AR, question: 'ما هي الوحدة الأساسية للكائنات الحية؟', expectFound: true, mustContain: 'الخلية', expectPage: 1 },
  { id: 'g08', pages: BIO_AR, question: 'متى انتهت الحرب العالمية الثانية؟', expectFound: false },
];
