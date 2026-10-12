import type { Locale } from '../i18n/index.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export const ARCADE_IDS = [
  'tic-tac-toe', 'connect-four', 'snake', 'falling-blocks', '2048', 'rock-paper-scissors', 'memory-match', 'minesweeper',
  'sudoku', 'hangman', 'maze-escape', 'reaction-test', 'simon-says', 'checkers', 'pong',
] as const;
export type ArcadeId = (typeof ARCADE_IDS)[number];

export type ArcadeCategory = 'strategy' | 'action' | 'puzzle' | 'brain' | 'word' | 'casual';
export const ARCADE_CATEGORIES: ArcadeCategory[] = ['strategy', 'action', 'puzzle', 'brain', 'word', 'casual'];
/** solo = single player; ai = versus the computer; local = pass-and-play / same device. */
export type ArcadeMode = 'solo' | 'ai' | 'local';
/** high = higher score is better; time = lower time is better; wins = win/loss record. */
export type ArcadeScoreKind = 'high' | 'time' | 'wins';

export interface ArcadeText { title: string; tagline: string; rules: string[]; controls: string[] }
export interface ArcadeGameInfo {
  id: ArcadeId;
  emoji: string;
  color: string;
  category: ArcadeCategory;
  modes: ArcadeMode[];
  difficulties: ArcadeDifficulty[];
  scoreKind: ArcadeScoreKind;
  /** Real-time games are paused when the app is hidden. */
  realtime: boolean;
  text: Record<Locale, ArcadeText>;
}

const ALL: ArcadeDifficulty[] = ['easy', 'medium', 'hard'];

export const ARCADE_GAMES: ArcadeGameInfo[] = [
  {
    id: 'tic-tac-toe', emoji: '⭕', color: '#ff6b9a', category: 'strategy', modes: ['ai', 'local'], difficulties: ALL, scoreKind: 'wins', realtime: false,
    text: {
      en: { title: 'Tic-Tac-Toe', tagline: 'Three in a row wins.', rules: ['Players take turns placing X and O.', 'Line up three of your marks in a row, column or diagonal to win.', 'A full board with no line is a draw.'], controls: ['Tap or click a square.', 'Keyboard: arrow keys to move, Enter to place.'] },
      fr: { title: 'Morpion', tagline: 'Trois alignés pour gagner.', rules: ['Les joueurs placent X et O à tour de rôle.', 'Alignez trois symboles en ligne, colonne ou diagonale pour gagner.', 'Une grille pleine sans alignement est un match nul.'], controls: ['Touchez ou cliquez une case.', 'Clavier : flèches pour se déplacer, Entrée pour jouer.'] },
      ar: { title: 'إكس-أو', tagline: 'ثلاثة في صف واحد للفوز.', rules: ['يتناوب اللاعبان على وضع X و O.', 'اصنع خطًا من ثلاث علامات أفقيًا أو عموديًا أو قطريًا لتفوز.', 'امتلاء اللوحة بدون خط يعني التعادل.'], controls: ['انقر على مربع.', 'لوحة المفاتيح: الأسهم للتنقل و Enter للعب.'] },
    },
  },
  {
    id: 'connect-four', emoji: '🔴', color: '#ff8a3d', category: 'strategy', modes: ['ai', 'local'], difficulties: ALL, scoreKind: 'wins', realtime: false,
    text: {
      en: { title: 'Connect Four', tagline: 'Drop discs, connect four.', rules: ['Drop a disc into a column; it falls to the lowest free spot.', 'Connect four discs horizontally, vertically or diagonally to win.', 'If the grid fills up, the game is a draw.'], controls: ['Tap a column.', 'Keyboard: ← → to choose a column, Enter to drop, or keys 1–7.'] },
      fr: { title: 'Puissance 4', tagline: 'Lâchez les jetons, alignez-en quatre.', rules: ['Lâchez un jeton dans une colonne ; il tombe au plus bas.', 'Alignez quatre jetons horizontalement, verticalement ou en diagonale.', 'Si la grille est pleine, c’est un match nul.'], controls: ['Touchez une colonne.', 'Clavier : ← → pour choisir, Entrée pour lâcher, ou touches 1–7.'] },
      ar: { title: 'أربعة في صف', tagline: 'أسقط الأقراص واجمع أربعة.', rules: ['أسقط قرصًا في عمود فيستقر في أدنى خانة فارغة.', 'اجمع أربعة أقراص أفقيًا أو عموديًا أو قطريًا لتفوز.', 'إذا امتلأت الشبكة فالنتيجة تعادل.'], controls: ['انقر على عمود.', 'لوحة المفاتيح: ← → لاختيار العمود و Enter للإسقاط، أو الأرقام 1–7.'] },
    },
  },
  {
    id: 'snake', emoji: '🐍', color: '#3ddc84', category: 'action', modes: ['solo'], difficulties: ALL, scoreKind: 'high', realtime: true,
    text: {
      en: { title: 'Snake', tagline: 'Eat, grow, don’t bite yourself.', rules: ['Guide the snake to the food to grow and score 10 points.', 'Hitting a wall or your own body ends the game.', 'Higher difficulty means a faster snake.'], controls: ['Arrow keys or WASD to steer, P or Space to pause.', 'Touch: swipe in a direction or use the on-screen pad.'] },
      fr: { title: 'Serpent', tagline: 'Mangez, grandissez, ne vous mordez pas.', rules: ['Guidez le serpent vers la nourriture pour grandir (+10 points).', 'Toucher un mur ou votre corps termine la partie.', 'Plus la difficulté est haute, plus le serpent est rapide.'], controls: ['Flèches ou ZQSD/WASD pour diriger, P ou Espace pour la pause.', 'Tactile : balayez ou utilisez la croix à l’écran.'] },
      ar: { title: 'الثعبان', tagline: 'كُل، اكبر، ولا تعضّ نفسك.', rules: ['وجّه الثعبان إلى الطعام لينمو وتكسب 10 نقاط.', 'الاصطدام بالجدار أو بجسمك ينهي اللعبة.', 'كلما زادت الصعوبة زادت سرعة الثعبان.'], controls: ['الأسهم أو WASD للتوجيه، و P أو المسافة للإيقاف المؤقت.', 'باللمس: اسحب في اتجاه أو استخدم الأزرار على الشاشة.'] },
    },
  },
  {
    id: 'falling-blocks', emoji: '🧱', color: '#8b5cf6', category: 'action', modes: ['solo'], difficulties: ALL, scoreKind: 'high', realtime: true,
    text: {
      en: { title: 'Falling Blocks', tagline: 'Stack shapes, clear lines.', rules: ['Shapes fall into the well; move and rotate them as they fall.', 'Fill a whole row to clear it. Clearing several rows at once scores more.', 'Every 10 lines the level and speed go up. The game ends when the stack reaches the top.'], controls: ['← → move, ↑ or X rotate, Z rotate back, ↓ soft drop, Space hard drop, C hold, P pause.', 'Touch: on-screen buttons; swipe left/right to move, tap to rotate, swipe down to drop.'] },
      fr: { title: 'Blocs tombants', tagline: 'Empilez les formes, effacez les lignes.', rules: ['Des formes tombent dans le puits ; déplacez-les et tournez-les.', 'Complétez une ligne pour l’effacer. Plusieurs lignes d’un coup rapportent plus.', 'Toutes les 10 lignes, le niveau et la vitesse augmentent. La partie finit quand la pile atteint le haut.'], controls: ['← → déplacer, ↑ ou X tourner, Z tourner en arrière, ↓ descente douce, Espace chute, C réserve, P pause.', 'Tactile : boutons à l’écran ; balayez pour déplacer, touchez pour tourner, balayez vers le bas pour lâcher.'] },
      ar: { title: 'الكتل المتساقطة', tagline: 'رصّ الأشكال وامسح الصفوف.', rules: ['تسقط الأشكال في البئر؛ حرّكها ودوّرها أثناء سقوطها.', 'املأ صفًا كاملًا لمسحه. مسح عدة صفوف معًا يمنح نقاطًا أكثر.', 'كل 10 صفوف يرتفع المستوى والسرعة. تنتهي اللعبة عندما تصل الكومة إلى الأعلى.'], controls: ['← → للتحريك، ↑ أو X للتدوير، Z للتدوير العكسي، ↓ للنزول، المسافة للإسقاط، C للحجز، P للإيقاف.', 'باللمس: أزرار على الشاشة؛ اسحب للتحريك، انقر للتدوير، اسحب للأسفل للإسقاط.'] },
    },
  },
  {
    id: '2048', emoji: '🔢', color: '#f5b83d', category: 'puzzle', modes: ['solo'], difficulties: ['medium'], scoreKind: 'high', realtime: false,
    text: {
      en: { title: '2048', tagline: 'Slide and merge to 2048.', rules: ['Slide all tiles in one direction. Equal tiles that touch merge into their sum.', 'After each move a new 2 or 4 appears.', 'Reach the 2048 tile to win; you can keep going. No moves left ends the game.'], controls: ['Arrow keys or WASD.', 'Touch: swipe up, down, left or right.'] },
      fr: { title: '2048', tagline: 'Glissez et fusionnez jusqu’à 2048.', rules: ['Faites glisser toutes les tuiles dans une direction. Deux tuiles égales qui se touchent fusionnent.', 'Après chaque coup, un 2 ou un 4 apparaît.', 'Atteignez 2048 pour gagner ; vous pouvez continuer. Plus aucun coup possible : fin de partie.'], controls: ['Flèches ou ZQSD/WASD.', 'Tactile : balayez dans une direction.'] },
      ar: { title: '2048', tagline: 'حرّك وادمج حتى 2048.', rules: ['حرّك كل المربعات في اتجاه واحد. يندمج المربعان المتساويان المتلامسان في مجموعهما.', 'بعد كل حركة يظهر 2 أو 4 جديد.', 'اصل إلى 2048 لتفوز ويمكنك المتابعة. انعدام الحركات ينهي اللعبة.'], controls: ['الأسهم أو WASD.', 'باللمس: اسحب للأعلى أو الأسفل أو اليمين أو اليسار.'] },
    },
  },
  {
    id: 'rock-paper-scissors', emoji: '✊', color: '#22c3e6', category: 'casual', modes: ['ai', 'local'], difficulties: ALL, scoreKind: 'wins', realtime: false,
    text: {
      en: { title: 'Rock Paper Scissors', tagline: 'Best of five. Read your opponent.', rules: ['Rock beats scissors, scissors beat paper, paper beats rock.', 'Same choice is a tie and does not count.', 'First to win the majority of rounds takes the match. Hard AI learns your patterns.'], controls: ['Tap a hand, or press R, P or S (1, 2, 3).', 'Pass-and-play: choices stay hidden until both players pick.'] },
      fr: { title: 'Pierre-feuille-ciseaux', tagline: 'Au meilleur des cinq. Lisez votre adversaire.', rules: ['La pierre bat les ciseaux, les ciseaux battent la feuille, la feuille bat la pierre.', 'Un choix identique est une égalité.', 'Le premier à remporter la majorité des manches gagne. L’IA difficile apprend vos habitudes.'], controls: ['Touchez une main, ou appuyez sur 1, 2, 3.', 'À deux sur un appareil : les choix restent cachés jusqu’à ce que les deux aient joué.'] },
      ar: { title: 'حجر ورقة مقص', tagline: 'الأفضل من خمس جولات. اقرأ خصمك.', rules: ['الحجر يغلب المقص، والمقص يغلب الورقة، والورقة تغلب الحجر.', 'الاختيار نفسه تعادل ولا يُحتسب.', 'من يفوز بأغلب الجولات يفوز بالمباراة. الذكاء الصعب يتعلم أنماطك.'], controls: ['انقر على يد، أو اضغط 1 أو 2 أو 3.', 'اللعب بالتناوب: تبقى الاختيارات مخفية حتى يختار اللاعبان.'] },
    },
  },
  {
    id: 'memory-match', emoji: '🃏', color: '#ec4899', category: 'brain', modes: ['solo', 'local'], difficulties: ALL, scoreKind: 'high', realtime: false,
    text: {
      en: { title: 'Memory Match', tagline: 'Find all the pairs.', rules: ['Flip two cards per move. Matching symbols stay face up.', 'Fewer moves and less time give a higher score.', 'In 2-player mode a match earns another turn; a miss passes the turn.'], controls: ['Tap or click a card.', 'Keyboard: Tab to a card and press Enter or Space.'] },
      fr: { title: 'Paires', tagline: 'Trouvez toutes les paires.', rules: ['Retournez deux cartes par coup. Les symboles identiques restent visibles.', 'Moins de coups et moins de temps donnent un meilleur score.', 'À deux joueurs, une paire trouvée permet de rejouer ; sinon le tour passe.'], controls: ['Touchez ou cliquez une carte.', 'Clavier : Tab jusqu’à une carte puis Entrée ou Espace.'] },
      ar: { title: 'مطابقة الذاكرة', tagline: 'اعثر على كل الأزواج.', rules: ['اقلب بطاقتين في كل حركة. الرموز المتطابقة تبقى مكشوفة.', 'حركات أقل ووقت أقل يعنيان نتيجة أعلى.', 'في وضع لاعبَين، المطابقة تمنحك دورًا إضافيًا والخطأ ينقل الدور.'], controls: ['انقر على بطاقة.', 'لوحة المفاتيح: Tab للوصول إلى بطاقة ثم Enter أو المسافة.'] },
    },
  },
  {
    id: 'minesweeper', emoji: '💣', color: '#64748b', category: 'puzzle', modes: ['solo'], difficulties: ALL, scoreKind: 'time', realtime: false,
    text: {
      en: { title: 'Minesweeper', tagline: 'Clear the field without a boom.', rules: ['Reveal every safe square. Numbers show how many mines touch that square.', 'Flag squares you think hide mines.', 'Your first reveal is always safe. Revealing a mine ends the game.'], controls: ['Click/tap to reveal; right-click or long-press to flag (or toggle Flag mode).', 'Click a satisfied number to reveal its neighbours. Keyboard: arrows, Enter reveal, F flag.'] },
      fr: { title: 'Démineur', tagline: 'Dégagez le terrain sans explosion.', rules: ['Révélez toutes les cases sûres. Les chiffres indiquent le nombre de mines voisines.', 'Posez un drapeau sur les cases suspectes.', 'La première case révélée est toujours sûre. Révéler une mine termine la partie.'], controls: ['Clic/toucher pour révéler ; clic droit ou appui long pour un drapeau (ou mode Drapeau).', 'Cliquez un chiffre satisfait pour révéler ses voisines. Clavier : flèches, Entrée, F.'] },
      ar: { title: 'كاسحة الألغام', tagline: 'نظّف الحقل بدون انفجار.', rules: ['اكشف كل المربعات الآمنة. الأرقام تبيّن عدد الألغام المجاورة.', 'ضع علمًا على المربعات التي تظن أنها تخفي لغمًا.', 'أول كشف آمن دائمًا. كشف لغم ينهي اللعبة.'], controls: ['انقر للكشف؛ النقر الأيمن أو الضغط المطوّل لوضع علم (أو وضع العلم).', 'انقر على رقم مكتمل لكشف جيرانه. لوحة المفاتيح: الأسهم، Enter للكشف، F للعلم.'] },
    },
  },
  {
    id: 'sudoku', emoji: '9️⃣', color: '#0ea5e9', category: 'puzzle', modes: ['solo'], difficulties: ALL, scoreKind: 'time', realtime: false,
    text: {
      en: { title: 'Sudoku', tagline: 'Every row, column and box: 1 to 9.', rules: ['Fill the grid so each row, column and 3×3 box contains 1–9 exactly once.', 'Every puzzle is generated with exactly one solution.', 'Wrong entries count as mistakes; three mistakes end the game. Hints fill a cell.'], controls: ['Select a cell, then tap a number or type 1–9. 0/Backspace clears.', 'Notes mode (N) adds pencil marks. Arrow keys move the selection.'] },
      fr: { title: 'Sudoku', tagline: 'Chaque ligne, colonne et bloc : de 1 à 9.', rules: ['Remplissez la grille pour que chaque ligne, colonne et bloc 3×3 contienne 1 à 9 une seule fois.', 'Chaque grille est générée avec une solution unique.', 'Les erreurs sont comptées ; trois erreurs terminent la partie. Un indice remplit une case.'], controls: ['Choisissez une case puis un chiffre (ou tapez 1–9). 0/Retour efface.', 'Le mode Notes (N) ajoute des annotations. Flèches pour se déplacer.'] },
      ar: { title: 'سودوكو', tagline: 'كل صف وعمود ومربع: من 1 إلى 9.', rules: ['املأ الشبكة بحيث يحتوي كل صف وعمود ومربع 3×3 على الأرقام 1–9 مرة واحدة.', 'كل لغز يُولَّد بحل واحد فقط.', 'الإدخالات الخاطئة تُحتسب أخطاء؛ ثلاثة أخطاء تنهي اللعبة. التلميح يملأ خانة.'], controls: ['اختر خانة ثم رقمًا أو اكتب 1–9. الصفر أو الحذف للمسح.', 'وضع الملاحظات (N) يضيف علامات. الأسهم لتحريك التحديد.'] },
    },
  },
  {
    id: 'hangman', emoji: '🪢', color: '#a3e635', category: 'word', modes: ['solo'], difficulties: ALL, scoreKind: 'wins', realtime: false,
    text: {
      en: { title: 'Hangman', tagline: 'Guess the word letter by letter.', rules: ['Guess letters to reveal the hidden word. The category is shown as a clue.', 'Six wrong guesses and the round is lost.', 'Words come from bundled lists in the current language.'], controls: ['Tap a letter or type it on your keyboard.'] },
      fr: { title: 'Pendu', tagline: 'Devinez le mot lettre par lettre.', rules: ['Proposez des lettres pour révéler le mot caché. La catégorie sert d’indice.', 'Six erreurs et la manche est perdue.', 'Les mots viennent de listes intégrées dans la langue choisie. Les accents sont trouvés avec la lettre simple.'], controls: ['Touchez une lettre ou tapez-la au clavier.'] },
      ar: { title: 'الرجل المشنوق', tagline: 'خمّن الكلمة حرفًا بحرف.', rules: ['خمّن الحروف لكشف الكلمة المخفية. الفئة تظهر كتلميح.', 'ستة تخمينات خاطئة وتخسر الجولة.', 'الكلمات من قوائم مدمجة باللغة الحالية. حرف الألف يكشف كل أشكال الهمزة.'], controls: ['انقر على حرف أو اكتبه بلوحة المفاتيح.'] },
    },
  },
  {
    id: 'maze-escape', emoji: '🌀', color: '#14b8a6', category: 'puzzle', modes: ['solo'], difficulties: ALL, scoreKind: 'time', realtime: false,
    text: {
      en: { title: 'Maze Escape', tagline: 'Find the exit before time runs out.', rules: ['Move from the top-left corner to the flag at the bottom-right.', 'Every maze is freshly generated and always has a path out.', 'The clock starts on your first move. Beat the time limit to escape.'], controls: ['Arrow keys or WASD.', 'Touch: swipe or use the on-screen pad.'] },
      fr: { title: 'Évasion du labyrinthe', tagline: 'Trouvez la sortie avant la fin du temps.', rules: ['Allez du coin supérieur gauche jusqu’au drapeau en bas à droite.', 'Chaque labyrinthe est généré et possède toujours une sortie.', 'Le chrono démarre au premier mouvement. Sortez avant la limite.'], controls: ['Flèches ou ZQSD/WASD.', 'Tactile : balayez ou utilisez la croix.'] },
      ar: { title: 'الهروب من المتاهة', tagline: 'اعثر على المخرج قبل انتهاء الوقت.', rules: ['تحرّك من الزاوية العلوية إلى العلم في الزاوية السفلية المقابلة.', 'كل متاهة مولّدة حديثًا ولها دائمًا طريق للخروج.', 'يبدأ المؤقت مع أول حركة. اخرج قبل نهاية الوقت.'], controls: ['الأسهم أو WASD.', 'باللمس: اسحب أو استخدم الأزرار على الشاشة.'] },
    },
  },
  {
    id: 'reaction-test', emoji: '⚡', color: '#facc15', category: 'brain', modes: ['solo'], difficulties: ['medium'], scoreKind: 'time', realtime: true,
    text: {
      en: { title: 'Reaction Test', tagline: 'Wait for green… now!', rules: ['Tap to start, then wait for the screen to turn green.', 'Tap as soon as it turns green. Tapping early is a false start.', 'Five rounds; your average reaction time is your score.'], controls: ['Click/tap the panel, or press Space or Enter.'] },
      fr: { title: 'Test de réflexes', tagline: 'Attendez le vert… maintenant !', rules: ['Touchez pour commencer puis attendez que l’écran devienne vert.', 'Touchez dès qu’il devient vert. Trop tôt = faux départ.', 'Cinq essais ; votre temps moyen est votre score.'], controls: ['Cliquez/touchez le panneau, ou Espace / Entrée.'] },
      ar: { title: 'اختبار رد الفعل', tagline: 'انتظر الأخضر… الآن!', rules: ['انقر للبدء ثم انتظر حتى تتحول الشاشة إلى الأخضر.', 'انقر فور تحولها إلى الأخضر. النقر المبكر بداية خاطئة.', 'خمس جولات؛ متوسط زمن رد فعلك هو نتيجتك.'], controls: ['انقر على اللوحة أو اضغط المسافة أو Enter.'] },
    },
  },
  {
    id: 'simon-says', emoji: '🎵', color: '#f43f5e', category: 'brain', modes: ['solo'], difficulties: ALL, scoreKind: 'high', realtime: false,
    text: {
      en: { title: 'Simon Says', tagline: 'Watch, listen, repeat.', rules: ['Watch the pads light up, then repeat the sequence.', 'Each round adds one step and plays a little faster.', 'A wrong pad ends the game (Easy gives one retry).'], controls: ['Tap or click the pads, or press 1–4 (1–6 on Hard).', 'Sound can be turned off in settings.'] },
      fr: { title: 'Jacques a dit', tagline: 'Regardez, écoutez, répétez.', rules: ['Observez les touches qui s’allument puis répétez la séquence.', 'Chaque manche ajoute une étape et accélère un peu.', 'Une erreur termine la partie (Facile donne un essai de plus).'], controls: ['Touchez les touches ou appuyez sur 1–4 (1–6 en Difficile).', 'Le son peut être coupé dans les réglages.'] },
      ar: { title: 'سايمون يقول', tagline: 'شاهد، استمع، كرّر.', rules: ['شاهد الأزرار وهي تضيء ثم كرّر التسلسل.', 'كل جولة تضيف خطوة وتصبح أسرع قليلًا.', 'الزر الخاطئ ينهي اللعبة (السهل يمنح محاولة إضافية).'], controls: ['انقر على الأزرار أو اضغط 1–4 (1–6 في الصعب).', 'يمكن إيقاف الصوت من الإعدادات.'] },
    },
  },
  {
    id: 'checkers', emoji: '🏁', color: '#ef4444', category: 'strategy', modes: ['ai', 'local'], difficulties: ALL, scoreKind: 'wins', realtime: false,
    text: {
      en: { title: 'Checkers', tagline: 'Jump, capture, crown.', rules: ['Men move diagonally forward one square on dark squares.', 'Captures are mandatory: jump over an opponent piece to an empty square; keep jumping if you can.', 'Reach the far row to become a king, which moves both ways. Capture or block every enemy piece to win.'], controls: ['Tap a piece, then tap a highlighted square. Multi-jumps are taken in one move.', 'Keyboard: arrows to move the cursor, Enter to select.'] },
      fr: { title: 'Dames', tagline: 'Sautez, capturez, couronnez.', rules: ['Les pions avancent d’une case en diagonale sur les cases sombres.', 'La prise est obligatoire : sautez un pion adverse vers une case vide ; enchaînez si possible.', 'Atteignez la dernière rangée pour obtenir une dame qui va dans les deux sens. Prenez ou bloquez toutes les pièces adverses.'], controls: ['Touchez une pièce puis une case en surbrillance. Les rafles se jouent en un coup.', 'Clavier : flèches pour le curseur, Entrée pour choisir.'] },
      ar: { title: 'الداما', tagline: 'اقفز، التقط، تُوِّج.', rules: ['تتحرك القطع قطريًا للأمام خانة واحدة على المربعات الداكنة.', 'الأكل إجباري: اقفز فوق قطعة الخصم إلى خانة فارغة، وتابع القفز إن أمكن.', 'الوصول إلى الصف الأخير يجعل القطعة ملكًا يتحرك في الاتجاهين. التقط أو احصر كل قطع الخصم لتفوز.'], controls: ['انقر على قطعة ثم على خانة مضيئة. القفزات المتعددة تُلعب في حركة واحدة.', 'لوحة المفاتيح: الأسهم لتحريك المؤشر و Enter للاختيار.'] },
    },
  },
  {
    id: 'pong', emoji: '🏓', color: '#6366f1', category: 'action', modes: ['ai', 'local'], difficulties: ALL, scoreKind: 'wins', realtime: true,
    text: {
      en: { title: 'Pong', tagline: 'Classic paddle duel to 7.', rules: ['Hit the ball back past your opponent’s paddle to score.', 'Where the ball hits your paddle changes its angle; rallies speed up.', 'First to 7 points wins.'], controls: ['Left player: W/S. Right player (2P): ↑/↓. Vs AI you may use either.', 'Touch: drag on your half of the field. P pauses.'] },
      fr: { title: 'Pong', tagline: 'Duel de raquettes en 7 points.', rules: ['Renvoyez la balle derrière la raquette adverse pour marquer.', 'L’endroit de l’impact change l’angle ; les échanges accélèrent.', 'Le premier à 7 points gagne.'], controls: ['Joueur gauche : W/S (Z/S). Joueur droit (2J) : ↑/↓. Contre l’IA, les deux marchent.', 'Tactile : glissez sur votre moitié du terrain. P pour la pause.'] },
      ar: { title: 'بونغ', tagline: 'مبارزة المضارب الكلاسيكية حتى 7.', rules: ['أعد الكرة لتتجاوز مضرب الخصم وتسجّل نقطة.', 'مكان اصطدام الكرة بالمضرب يغيّر زاويتها؛ والتبادلات تتسارع.', 'أول من يصل إلى 7 نقاط يفوز.'], controls: ['اللاعب الأيسر: W/S. اللاعب الأيمن (لاعبان): ↑/↓. ضد الذكاء يمكنك استخدام أيهما.', 'باللمس: اسحب على نصفك من الملعب. P للإيقاف.'] },
    },
  },
];

export const ARCADE_BY_ID = Object.fromEntries(ARCADE_GAMES.map((g) => [g.id, g])) as Record<ArcadeId, ArcadeGameInfo>;

export function isArcadeId(x: unknown): x is ArcadeId {
  return typeof x === 'string' && (ARCADE_IDS as readonly string[]).includes(x);
}

export function arcadeText(id: ArcadeId, locale: Locale): ArcadeText {
  return ARCADE_BY_ID[id].text[locale] ?? ARCADE_BY_ID[id].text.en;
}

/** Search in every language so a French user typing "snake" still finds Serpent. */
export function searchArcade(query: string, opts: { category?: ArcadeCategory | 'all'; favorites?: string[]; onlyFavorites?: boolean } = {}): ArcadeGameInfo[] {
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ARCADE_GAMES.filter((g) => {
    if (opts.category && opts.category !== 'all' && g.category !== opts.category) return false;
    if (opts.onlyFavorites && !opts.favorites?.includes(g.id)) return false;
    if (!q) return true;
    const hay = [g.id, ...Object.values(g.text).flatMap((t) => [t.title, t.tagline])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return hay.includes(q);
  });
}
