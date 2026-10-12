import type { LocalizedText } from '../i18n/index.js';

/** Bundled, original offline content. Version this pack so downloaded packs can extend it. */
export const BUNDLED_PACK_VERSION = 'core-2026.10.1';

export const L = (en: string, fr: string, ar: string): LocalizedText => ({ en, fr, ar });
const same = (s: string): LocalizedText => ({ en: s, fr: s, ar: s });

export interface McqItem { topic: string; q: LocalizedText; choices: LocalizedText[]; answer: number; why?: LocalizedText }

export const GENERAL_QUIZ: McqItem[] = [
  { topic: 'astronomy', q: L('Which is the largest planet in the Solar System?', 'Quelle est la plus grande planète du système solaire ?', 'ما أكبر كوكب في المجموعة الشمسية؟'), choices: [L('Jupiter', 'Jupiter', 'المشتري'), L('Saturn', 'Saturne', 'زحل'), L('Earth', 'Terre', 'الأرض'), L('Neptune', 'Neptune', 'نبتون')], answer: 0 },
  { topic: 'astronomy', q: L('Which planet is closest to the Sun?', 'Quelle planète est la plus proche du Soleil ?', 'ما الكوكب الأقرب إلى الشمس؟'), choices: [L('Venus', 'Vénus', 'الزهرة'), L('Mercury', 'Mercure', 'عطارد'), L('Mars', 'Mars', 'المريخ'), L('Earth', 'Terre', 'الأرض')], answer: 1 },
  { topic: 'science', q: L('What gas do plants absorb from the air for photosynthesis?', 'Quel gaz les plantes absorbent-elles pour la photosynthèse ?', 'ما الغاز الذي تمتصه النباتات من الهواء في البناء الضوئي؟'), choices: [L('Oxygen', 'Oxygène', 'الأكسجين'), L('Nitrogen', 'Azote', 'النيتروجين'), L('Carbon dioxide', 'Dioxyde de carbone', 'ثاني أكسيد الكربون'), L('Helium', 'Hélium', 'الهيليوم')], answer: 2 },
  { topic: 'science', q: L('At sea level, water boils at…', 'Au niveau de la mer, l’eau bout à…', 'عند مستوى سطح البحر، يغلي الماء عند…'), choices: [same('90 °C'), same('100 °C'), same('110 °C'), same('120 °C')], answer: 1 },
  { topic: 'science', q: L('What is the speed of light in vacuum, approximately?', 'Quelle est approximativement la vitesse de la lumière dans le vide ?', 'ما سرعة الضوء في الفراغ تقريبًا؟'), choices: [same('300 000 km/s'), same('30 000 km/s'), same('3 000 km/s'), same('340 m/s')], answer: 0 },
  { topic: 'math', q: L('How many degrees are in the interior angles of a triangle?', 'Quelle est la somme des angles d’un triangle ?', 'ما مجموع زوايا المثلث الداخلية؟'), choices: [same('90°'), same('180°'), same('270°'), same('360°')], answer: 1 },
  { topic: 'math', q: L('Which number is prime?', 'Quel nombre est premier ?', 'أي عدد من هذه الأعداد أولي؟'), choices: [same('21'), same('27'), same('29'), same('33')], answer: 2 },
  { topic: 'math', q: L('What is π rounded to two decimal places?', 'Quelle est la valeur de π arrondie au centième ?', 'ما قيمة π مقربة إلى منزلتين عشريتين؟'), choices: [same('3.12'), same('3.14'), same('3.16'), same('3.41')], answer: 1 },
  { topic: 'history', q: L('In which year did the Second World War end?', 'En quelle année la Seconde Guerre mondiale s’est-elle terminée ?', 'في أي عام انتهت الحرب العالمية الثانية؟'), choices: [same('1918'), same('1939'), same('1945'), same('1962')], answer: 2 },
  { topic: 'history', q: L('Which ancient civilisation built the pyramids of Giza?', 'Quelle civilisation a construit les pyramides de Gizeh ?', 'أي حضارة بنت أهرامات الجيزة؟'), choices: [L('The Romans', 'Les Romains', 'الرومان'), L('The Ancient Egyptians', 'Les Égyptiens anciens', 'المصريون القدماء'), L('The Greeks', 'Les Grecs', 'الإغريق'), L('The Phoenicians', 'Les Phéniciens', 'الفينيقيون')], answer: 1 },
  { topic: 'history', q: L('Ibn Khaldun is best known for his work in…', 'Ibn Khaldoun est surtout connu pour ses travaux en…', 'اشتهر ابن خلدون بأعماله في…'), choices: [L('History and sociology', 'Histoire et sociologie', 'التاريخ وعلم الاجتماع'), L('Astronomy', 'Astronomie', 'علم الفلك'), L('Medicine', 'Médecine', 'الطب'), L('Music', 'Musique', 'الموسيقى')], answer: 0 },
  { topic: 'history', q: L('Al-Khwarizmi gave his name to which word?', 'Al-Khwarizmi a donné son nom à quel mot ?', 'ما الكلمة المشتقة من اسم الخوارزمي؟'), choices: [L('Algorithm', 'Algorithme', 'خوارزمية'), L('Alchemy', 'Alchimie', 'الخيمياء'), L('Almanac', 'Almanach', 'التقويم'), L('Alcohol', 'Alcool', 'الكحول')], answer: 0 },
  { topic: 'geography', q: L('Which is the largest ocean?', 'Quel est le plus grand océan ?', 'ما أكبر محيط؟'), choices: [L('Atlantic', 'Atlantique', 'الأطلسي'), L('Indian', 'Indien', 'الهندي'), L('Arctic', 'Arctique', 'المتجمد الشمالي'), L('Pacific', 'Pacifique', 'الهادئ')], answer: 3 },
  { topic: 'geography', q: L('Which is the largest hot desert in the world?', 'Quel est le plus grand désert chaud du monde ?', 'ما أكبر صحراء حارة في العالم؟'), choices: [L('Gobi', 'Gobi', 'غوبي'), L('Sahara', 'Sahara', 'الصحراء الكبرى'), L('Kalahari', 'Kalahari', 'كالاهاري'), L('Atacama', 'Atacama', 'أتاكاما')], answer: 1 },
  { topic: 'geography', q: L('Mount Everest is located in which mountain range?', 'Dans quelle chaîne se trouve l’Everest ?', 'في أي سلسلة جبلية يقع جبل إيفرست؟'), choices: [L('Alps', 'Alpes', 'الألب'), L('Andes', 'Andes', 'الأنديز'), L('Himalayas', 'Himalaya', 'الهيمالايا'), L('Atlas', 'Atlas', 'الأطلس')], answer: 2 },
  { topic: 'language', q: L('How many letters are in the Arabic alphabet?', 'Combien de lettres compte l’alphabet arabe ?', 'كم عدد حروف الأبجدية العربية؟'), choices: [same('26'), same('28'), same('30'), same('24')], answer: 1 },
  { topic: 'technology', q: L('What does "CPU" stand for?', 'Que signifie « CPU » ?', 'ماذا يعني الاختصار CPU؟'), choices: [L('Central Processing Unit', 'Unité centrale de traitement', 'وحدة المعالجة المركزية'), L('Computer Power Unit', 'Unité d’alimentation', 'وحدة طاقة الحاسوب'), L('Central Program Utility', 'Utilitaire central', 'أداة البرامج المركزية'), L('Core Processing Utility', 'Utilitaire de calcul', 'أداة المعالجة الأساسية')], answer: 0 },
  { topic: 'technology', q: L('How many bits are in one byte?', 'Combien de bits dans un octet ?', 'كم بت في البايت الواحد؟'), choices: [same('4'), same('8'), same('16'), same('10')], answer: 1 },
  { topic: 'science', q: L('Which organ pumps blood around the body?', 'Quel organe fait circuler le sang ?', 'ما العضو الذي يضخ الدم في الجسم؟'), choices: [L('Lungs', 'Poumons', 'الرئتان'), L('Liver', 'Foie', 'الكبد'), L('Heart', 'Cœur', 'القلب'), L('Kidneys', 'Reins', 'الكليتان')], answer: 2 },
  { topic: 'science', q: L('What is the chemical symbol of gold?', 'Quel est le symbole chimique de l’or ?', 'ما الرمز الكيميائي للذهب؟'), choices: [same('Go'), same('Gd'), same('Au'), same('Ag')], answer: 2 },
  { topic: 'astronomy', q: L('What is the natural satellite of the Earth?', 'Quel est le satellite naturel de la Terre ?', 'ما التابع الطبيعي للأرض؟'), choices: [L('The Moon', 'La Lune', 'القمر'), L('The Sun', 'Le Soleil', 'الشمس'), L('Mars', 'Mars', 'المريخ'), L('Phobos', 'Phobos', 'فوبوس')], answer: 0 },
  { topic: 'math', q: L('What is 15% of 200?', 'Combien font 15 % de 200 ?', 'كم يساوي 15٪ من 200؟'), choices: [same('15'), same('20'), same('30'), same('35')], answer: 2 },
  { topic: 'science', q: L('Sound cannot travel through…', 'Le son ne se propage pas dans…', 'لا ينتقل الصوت في…'), choices: [L('Water', 'L’eau', 'الماء'), L('Steel', 'L’acier', 'الفولاذ'), L('A vacuum', 'Le vide', 'الفراغ'), L('Air', 'L’air', 'الهواء')], answer: 2 },
  { topic: 'geography', q: L('Which river flows through Cairo?', 'Quel fleuve traverse Le Caire ?', 'أي نهر يمر بالقاهرة؟'), choices: [L('Nile', 'Nil', 'النيل'), L('Tigris', 'Tigre', 'دجلة'), L('Niger', 'Niger', 'النيجر'), L('Congo', 'Congo', 'الكونغو')], answer: 0 },
];

export const BIOLOGY_QUIZ: McqItem[] = [
  { topic: 'cells', q: L('Which organelle produces most of the cell’s energy (ATP)?', 'Quel organite produit l’essentiel de l’énergie (ATP) de la cellule ?', 'ما العضية التي تنتج معظم طاقة الخلية (ATP)؟'), choices: [L('Mitochondrion', 'Mitochondrie', 'الميتوكوندريا'), L('Ribosome', 'Ribosome', 'الريبوسوم'), L('Nucleus', 'Noyau', 'النواة'), L('Golgi apparatus', 'Appareil de Golgi', 'جهاز غولجي')], answer: 0 },
  { topic: 'cells', q: L('Where does photosynthesis take place?', 'Où se déroule la photosynthèse ?', 'أين تحدث عملية البناء الضوئي؟'), choices: [L('Chloroplast', 'Chloroplaste', 'البلاستيدة الخضراء'), L('Vacuole', 'Vacuole', 'الفجوة'), L('Mitochondrion', 'Mitochondrie', 'الميتوكوندريا'), L('Cell wall', 'Paroi cellulaire', 'الجدار الخلوي')], answer: 0 },
  { topic: 'cells', q: L('Which structure controls what enters and leaves the cell?', 'Quelle structure contrôle les échanges de la cellule ?', 'ما التركيب الذي يتحكم في دخول المواد وخروجها من الخلية؟'), choices: [L('Cell membrane', 'Membrane plasmique', 'الغشاء الخلوي'), L('Nucleolus', 'Nucléole', 'النوية'), L('Cytoskeleton', 'Cytosquelette', 'الهيكل الخلوي'), L('Lysosome', 'Lysosome', 'الجسيم الحال')], answer: 0 },
  { topic: 'cells', q: L('Ribosomes are the site of…', 'Les ribosomes sont le lieu de…', 'الريبوسومات هي موقع…'), choices: [L('Protein synthesis', 'La synthèse des protéines', 'تصنيع البروتين'), L('Respiration', 'La respiration', 'التنفس'), L('DNA storage', 'Le stockage de l’ADN', 'تخزين DNA'), L('Digestion', 'La digestion', 'الهضم')], answer: 0 },
  { topic: 'genetics', q: L('How many chromosomes does a typical human body cell have?', 'Combien de chromosomes possède une cellule humaine typique ?', 'كم عدد الكروموسومات في خلية جسمية بشرية نموذجية؟'), choices: [same('23'), same('44'), same('46'), same('48')], answer: 2 },
  { topic: 'genetics', q: L('Which base pairs with adenine in DNA?', 'Quelle base s’apparie avec l’adénine dans l’ADN ?', 'ما القاعدة التي ترتبط بالأدينين في DNA؟'), choices: [L('Thymine', 'Thymine', 'الثايمين'), L('Guanine', 'Guanine', 'الغوانين'), L('Cytosine', 'Cytosine', 'السيتوسين'), L('Uracil', 'Uracile', 'اليوراسيل')], answer: 0 },
  { topic: 'genetics', q: L('Cell division producing gametes is called…', 'La division produisant les gamètes s’appelle…', 'يسمى الانقسام الذي ينتج الأمشاج…'), choices: [L('Mitosis', 'Mitose', 'الانقسام المتساوي'), L('Meiosis', 'Méiose', 'الانقسام المنصف'), L('Fission', 'Fission', 'الانشطار'), L('Budding', 'Bourgeonnement', 'التبرعم')], answer: 1 },
  { topic: 'genetics', q: L('An allele that is expressed whenever present is…', 'Un allèle qui s’exprime dès qu’il est présent est…', 'الأليل الذي يظهر أثره كلما وُجد هو…'), choices: [L('Dominant', 'Dominant', 'سائد'), L('Recessive', 'Récessif', 'متنحٍّ'), L('Mutant', 'Mutant', 'طافر'), L('Neutral', 'Neutre', 'محايد')], answer: 0 },
  { topic: 'human-body', q: L('Which blood cells fight infection?', 'Quelles cellules sanguines combattent les infections ?', 'ما خلايا الدم التي تحارب العدوى؟'), choices: [L('Red blood cells', 'Globules rouges', 'كريات الدم الحمراء'), L('White blood cells', 'Globules blancs', 'كريات الدم البيضاء'), L('Platelets', 'Plaquettes', 'الصفائح الدموية'), L('Plasma', 'Plasma', 'البلازما')], answer: 1 },
  { topic: 'human-body', q: L('Where in the lungs does gas exchange happen?', 'Où se font les échanges gazeux dans les poumons ?', 'أين يحدث تبادل الغازات في الرئتين؟'), choices: [L('Alveoli', 'Alvéoles', 'الحويصلات الهوائية'), L('Trachea', 'Trachée', 'القصبة الهوائية'), L('Bronchi', 'Bronches', 'الشعب الهوائية'), L('Diaphragm', 'Diaphragme', 'الحجاب الحاجز')], answer: 0 },
  { topic: 'human-body', q: L('Which organ produces insulin?', 'Quel organe produit l’insuline ?', 'ما العضو الذي ينتج الإنسولين؟'), choices: [L('Liver', 'Foie', 'الكبد'), L('Pancreas', 'Pancréas', 'البنكرياس'), L('Stomach', 'Estomac', 'المعدة'), L('Thyroid', 'Thyroïde', 'الغدة الدرقية')], answer: 1 },
  { topic: 'human-body', q: L('The basic unit of the nervous system is the…', 'L’unité de base du système nerveux est…', 'الوحدة الأساسية في الجهاز العصبي هي…'), choices: [L('Neuron', 'Neurone', 'العصبون'), L('Nephron', 'Néphron', 'النفرون'), L('Alveolus', 'Alvéole', 'الحويصلة'), L('Muscle fibre', 'Fibre musculaire', 'الليف العضلي')], answer: 0 },
  { topic: 'human-body', q: L('Which part of the digestive system absorbs most nutrients?', 'Quelle partie du tube digestif absorbe la plupart des nutriments ?', 'أي جزء من الجهاز الهضمي يمتص معظم المواد الغذائية؟'), choices: [L('Small intestine', 'Intestin grêle', 'الأمعاء الدقيقة'), L('Large intestine', 'Gros intestin', 'الأمعاء الغليظة'), L('Oesophagus', 'Œsophage', 'المريء'), L('Stomach', 'Estomac', 'المعدة')], answer: 0 },
  { topic: 'ecology', q: L('Organisms that make their own food are called…', 'Les organismes qui produisent leur propre nourriture sont…', 'تسمى الكائنات التي تصنع غذاءها بنفسها…'), choices: [L('Producers', 'Producteurs', 'منتجات'), L('Consumers', 'Consommateurs', 'مستهلكات'), L('Decomposers', 'Décomposeurs', 'محللات'), L('Parasites', 'Parasites', 'طفيليات')], answer: 0 },
  { topic: 'ecology', q: L('Fungi and bacteria that break down dead matter are…', 'Champignons et bactéries qui dégradent la matière morte sont des…', 'الفطريات والبكتيريا التي تحلل المواد الميتة هي…'), choices: [L('Decomposers', 'Décomposeurs', 'محللات'), L('Producers', 'Producteurs', 'منتجات'), L('Predators', 'Prédateurs', 'مفترسات'), L('Herbivores', 'Herbivores', 'آكلات أعشاب')], answer: 0 },
  { topic: 'ecology', q: L('Which process releases water vapour from leaves?', 'Quel processus libère de la vapeur d’eau par les feuilles ?', 'ما العملية التي تطلق بخار الماء من الأوراق؟'), choices: [L('Transpiration', 'Transpiration', 'النتح'), L('Respiration', 'Respiration', 'التنفس'), L('Germination', 'Germination', 'الإنبات'), L('Pollination', 'Pollinisation', 'التلقيح')], answer: 0 },
  { topic: 'evolution', q: L('Who proposed the theory of evolution by natural selection?', 'Qui a proposé la théorie de l’évolution par sélection naturelle ?', 'من اقترح نظرية التطور بالانتقاء الطبيعي؟'), choices: [L('Charles Darwin', 'Charles Darwin', 'تشارلز داروين'), L('Gregor Mendel', 'Gregor Mendel', 'غريغور مندل'), L('Louis Pasteur', 'Louis Pasteur', 'لويس باستور'), L('Isaac Newton', 'Isaac Newton', 'إسحاق نيوتن')], answer: 0 },
  { topic: 'genetics', q: L('Who is considered the father of genetics?', 'Qui est considéré comme le père de la génétique ?', 'من يعتبر أبا علم الوراثة؟'), choices: [L('Gregor Mendel', 'Gregor Mendel', 'غريغور مندل'), L('Charles Darwin', 'Charles Darwin', 'تشارلز داروين'), L('Robert Hooke', 'Robert Hooke', 'روبرت هوك'), L('Marie Curie', 'Marie Curie', 'ماري كوري')], answer: 0 },
  { topic: 'cells', q: L('Which of these is found in plant cells but not animal cells?', 'Lequel se trouve dans les cellules végétales mais pas animales ?', 'أي مما يلي يوجد في الخلية النباتية دون الحيوانية؟'), choices: [L('Cell wall', 'Paroi cellulaire', 'الجدار الخلوي'), L('Nucleus', 'Noyau', 'النواة'), L('Mitochondrion', 'Mitochondrie', 'الميتوكوندريا'), L('Cell membrane', 'Membrane', 'الغشاء الخلوي')], answer: 0 },
  { topic: 'human-body', q: L('Which vessels carry blood away from the heart?', 'Quels vaisseaux transportent le sang depuis le cœur ?', 'ما الأوعية التي تنقل الدم بعيدًا عن القلب؟'), choices: [L('Arteries', 'Artères', 'الشرايين'), L('Veins', 'Veines', 'الأوردة'), L('Capillaries', 'Capillaires', 'الشعيرات الدموية'), L('Lymph vessels', 'Vaisseaux lymphatiques', 'الأوعية اللمفاوية')], answer: 0 },
];

export interface TrueFalseItem { topic: string; s: LocalizedText; value: boolean; why?: LocalizedText }

export const TRUE_FALSE: TrueFalseItem[] = [
  { topic: 'science', s: L('Water is made of hydrogen and oxygen.', 'L’eau est composée d’hydrogène et d’oxygène.', 'يتكون الماء من الهيدروجين والأكسجين.'), value: true },
  { topic: 'science', s: L('Sound travels faster than light.', 'Le son est plus rapide que la lumière.', 'ينتقل الصوت أسرع من الضوء.'), value: false },
  { topic: 'science', s: L('The Sun is a star.', 'Le Soleil est une étoile.', 'الشمس نجم.'), value: true },
  { topic: 'science', s: L('Humans have four lungs.', 'Les humains ont quatre poumons.', 'للإنسان أربع رئات.'), value: false },
  { topic: 'science', s: L('Diamond is a form of carbon.', 'Le diamant est une forme de carbone.', 'الألماس شكل من أشكال الكربون.'), value: true },
  { topic: 'science', s: L('Electrons have a positive charge.', 'Les électrons ont une charge positive.', 'للإلكترونات شحنة موجبة.'), value: false },
  { topic: 'science', s: L('Ice is less dense than liquid water.', 'La glace est moins dense que l’eau liquide.', 'الجليد أقل كثافة من الماء السائل.'), value: true },
  { topic: 'science', s: L('Bats are mammals.', 'Les chauves-souris sont des mammifères.', 'الخفافيش من الثدييات.'), value: true },
  { topic: 'science', s: L('Spiders are insects.', 'Les araignées sont des insectes.', 'العناكب من الحشرات.'), value: false },
  { topic: 'science', s: L('The unit of force is the newton.', 'L’unité de force est le newton.', 'وحدة القوة هي النيوتن.'), value: true },
  { topic: 'science', s: L('Mercury is a liquid metal at room temperature.', 'Le mercure est un métal liquide à température ambiante.', 'الزئبق فلز سائل في درجة حرارة الغرفة.'), value: true },
  { topic: 'science', s: L('An acid has a pH greater than 7.', 'Un acide a un pH supérieur à 7.', 'للحمض رقم هيدروجيني أكبر من 7.'), value: false },
  { topic: 'geography', s: L('The Nile flows into the Mediterranean Sea.', 'Le Nil se jette dans la Méditerranée.', 'يصب نهر النيل في البحر الأبيض المتوسط.'), value: true },
  { topic: 'geography', s: L('Australia is both a country and a continent.', 'L’Australie est à la fois un pays et un continent.', 'أستراليا دولة وقارة في آن واحد.'), value: true },
  { topic: 'geography', s: L('The capital of Morocco is Casablanca.', 'La capitale du Maroc est Casablanca.', 'عاصمة المغرب هي الدار البيضاء.'), value: false, why: L('It is Rabat.', 'C’est Rabat.', 'إنها الرباط.') },
  { topic: 'geography', s: L('The Amazon rainforest is mostly in Brazil.', 'La forêt amazonienne se trouve surtout au Brésil.', 'تقع غابات الأمازون في معظمها في البرازيل.'), value: true },
  { topic: 'geography', s: L('Mount Kilimanjaro is in Asia.', 'Le Kilimandjaro se trouve en Asie.', 'يقع جبل كليمنجارو في آسيا.'), value: false },
  { topic: 'history', s: L('The Berlin Wall fell in 1989.', 'Le mur de Berlin est tombé en 1989.', 'سقط جدار برلين عام 1989.'), value: true },
  { topic: 'history', s: L('The French Revolution began in 1889.', 'La Révolution française a commencé en 1889.', 'بدأت الثورة الفرنسية عام 1889.'), value: false, why: L('It began in 1789.', 'Elle a commencé en 1789.', 'بدأت عام 1789.') },
  { topic: 'history', s: L('Cordoba was a major centre of learning in Al-Andalus.', 'Cordoue était un grand centre de savoir en al-Andalus.', 'كانت قرطبة مركزًا علميًا كبيرًا في الأندلس.'), value: true },
  { topic: 'math', s: L('Zero is an even number.', 'Zéro est un nombre pair.', 'الصفر عدد زوجي.'), value: true },
  { topic: 'math', s: L('Every square is a rectangle.', 'Tout carré est un rectangle.', 'كل مربع مستطيل.'), value: true },
  { topic: 'math', s: L('The square root of 2 is a rational number.', 'La racine carrée de 2 est un nombre rationnel.', 'الجذر التربيعي للعدد 2 عدد نسبي.'), value: false },
  { topic: 'math', s: L('1 is a prime number.', '1 est un nombre premier.', 'العدد 1 عدد أولي.'), value: false },
  { topic: 'math', s: L('A hexagon has six sides.', 'Un hexagone a six côtés.', 'للسداسي ستة أضلاع.'), value: true },
  { topic: 'cs', s: L('In binary, 101 equals 5.', 'En binaire, 101 vaut 5.', 'في النظام الثنائي 101 يساوي 5.'), value: true },
  { topic: 'cs', s: L('RAM keeps its data when the power is off.', 'La RAM conserve ses données hors tension.', 'تحتفظ ذاكرة RAM ببياناتها عند انقطاع الكهرباء.'), value: false },
  { topic: 'cs', s: L('Binary search requires a sorted list.', 'La recherche dichotomique nécessite une liste triée.', 'يتطلب البحث الثنائي قائمة مرتبة.'), value: true },
  { topic: 'biology', s: L('DNA has a double helix structure.', 'L’ADN a une structure en double hélice.', 'للـ DNA بنية حلزونية مزدوجة.'), value: true },
  { topic: 'biology', s: L('Plants release carbon dioxide during photosynthesis.', 'Les plantes libèrent du dioxyde de carbone pendant la photosynthèse.', 'تطلق النباتات ثاني أكسيد الكربون أثناء البناء الضوئي.'), value: false },
];

export interface Country { code: string; name: LocalizedText; capital: LocalizedText; continent: 'africa' | 'asia' | 'europe' | 'north-america' | 'south-america' | 'oceania'; lat: number; lon: number }

export const CONTINENTS: Record<Country['continent'], LocalizedText> = {
  africa: L('Africa', 'Afrique', 'أفريقيا'),
  asia: L('Asia', 'Asie', 'آسيا'),
  europe: L('Europe', 'Europe', 'أوروبا'),
  'north-america': L('North America', 'Amérique du Nord', 'أمريكا الشمالية'),
  'south-america': L('South America', 'Amérique du Sud', 'أمريكا الجنوبية'),
  oceania: L('Oceania', 'Océanie', 'أوقيانوسيا'),
};

// Approximate capital coordinates (degrees) used only for "which is further north" style questions.
export const COUNTRIES: Country[] = [
  { code: 'TN', name: L('Tunisia', 'Tunisie', 'تونس'), capital: L('Tunis', 'Tunis', 'تونس'), continent: 'africa', lat: 36.8, lon: 10.2 },
  { code: 'DZ', name: L('Algeria', 'Algérie', 'الجزائر'), capital: L('Algiers', 'Alger', 'الجزائر'), continent: 'africa', lat: 36.8, lon: 3.1 },
  { code: 'MA', name: L('Morocco', 'Maroc', 'المغرب'), capital: L('Rabat', 'Rabat', 'الرباط'), continent: 'africa', lat: 34.0, lon: -6.8 },
  { code: 'EG', name: L('Egypt', 'Égypte', 'مصر'), capital: L('Cairo', 'Le Caire', 'القاهرة'), continent: 'africa', lat: 30.0, lon: 31.2 },
  { code: 'LY', name: L('Libya', 'Libye', 'ليبيا'), capital: L('Tripoli', 'Tripoli', 'طرابلس'), continent: 'africa', lat: 32.9, lon: 13.2 },
  { code: 'SN', name: L('Senegal', 'Sénégal', 'السنغال'), capital: L('Dakar', 'Dakar', 'داكار'), continent: 'africa', lat: 14.7, lon: -17.4 },
  { code: 'NG', name: L('Nigeria', 'Nigeria', 'نيجيريا'), capital: L('Abuja', 'Abuja', 'أبوجا'), continent: 'africa', lat: 9.1, lon: 7.5 },
  { code: 'KE', name: L('Kenya', 'Kenya', 'كينيا'), capital: L('Nairobi', 'Nairobi', 'نيروبي'), continent: 'africa', lat: -1.3, lon: 36.8 },
  { code: 'ZA', name: L('South Africa', 'Afrique du Sud', 'جنوب أفريقيا'), capital: L('Pretoria', 'Pretoria', 'بريتوريا'), continent: 'africa', lat: -25.7, lon: 28.2 },
  { code: 'ET', name: L('Ethiopia', 'Éthiopie', 'إثيوبيا'), capital: L('Addis Ababa', 'Addis-Abeba', 'أديس أبابا'), continent: 'africa', lat: 9.0, lon: 38.7 },
  { code: 'MR', name: L('Mauritania', 'Mauritanie', 'موريتانيا'), capital: L('Nouakchott', 'Nouakchott', 'نواكشوط'), continent: 'africa', lat: 18.1, lon: -16.0 },
  { code: 'SD', name: L('Sudan', 'Soudan', 'السودان'), capital: L('Khartoum', 'Khartoum', 'الخرطوم'), continent: 'africa', lat: 15.5, lon: 32.5 },
  { code: 'GH', name: L('Ghana', 'Ghana', 'غانا'), capital: L('Accra', 'Accra', 'أكرا'), continent: 'africa', lat: 5.6, lon: -0.2 },
  { code: 'SA', name: L('Saudi Arabia', 'Arabie saoudite', 'السعودية'), capital: L('Riyadh', 'Riyad', 'الرياض'), continent: 'asia', lat: 24.7, lon: 46.7 },
  { code: 'AE', name: L('United Arab Emirates', 'Émirats arabes unis', 'الإمارات'), capital: L('Abu Dhabi', 'Abou Dabi', 'أبوظبي'), continent: 'asia', lat: 24.5, lon: 54.4 },
  { code: 'QA', name: L('Qatar', 'Qatar', 'قطر'), capital: L('Doha', 'Doha', 'الدوحة'), continent: 'asia', lat: 25.3, lon: 51.5 },
  { code: 'JO', name: L('Jordan', 'Jordanie', 'الأردن'), capital: L('Amman', 'Amman', 'عمّان'), continent: 'asia', lat: 31.9, lon: 35.9 },
  { code: 'LB', name: L('Lebanon', 'Liban', 'لبنان'), capital: L('Beirut', 'Beyrouth', 'بيروت'), continent: 'asia', lat: 33.9, lon: 35.5 },
  { code: 'IQ', name: L('Iraq', 'Irak', 'العراق'), capital: L('Baghdad', 'Bagdad', 'بغداد'), continent: 'asia', lat: 33.3, lon: 44.4 },
  { code: 'SY', name: L('Syria', 'Syrie', 'سوريا'), capital: L('Damascus', 'Damas', 'دمشق'), continent: 'asia', lat: 33.5, lon: 36.3 },
  { code: 'OM', name: L('Oman', 'Oman', 'عُمان'), capital: L('Muscat', 'Mascate', 'مسقط'), continent: 'asia', lat: 23.6, lon: 58.4 },
  { code: 'KW', name: L('Kuwait', 'Koweït', 'الكويت'), capital: L('Kuwait City', 'Koweït', 'مدينة الكويت'), continent: 'asia', lat: 29.4, lon: 48.0 },
  { code: 'TR', name: L('Turkey', 'Turquie', 'تركيا'), capital: L('Ankara', 'Ankara', 'أنقرة'), continent: 'asia', lat: 39.9, lon: 32.9 },
  { code: 'JP', name: L('Japan', 'Japon', 'اليابان'), capital: L('Tokyo', 'Tokyo', 'طوكيو'), continent: 'asia', lat: 35.7, lon: 139.7 },
  { code: 'CN', name: L('China', 'Chine', 'الصين'), capital: L('Beijing', 'Pékin', 'بكين'), continent: 'asia', lat: 39.9, lon: 116.4 },
  { code: 'IN', name: L('India', 'Inde', 'الهند'), capital: L('New Delhi', 'New Delhi', 'نيودلهي'), continent: 'asia', lat: 28.6, lon: 77.2 },
  { code: 'ID', name: L('Indonesia', 'Indonésie', 'إندونيسيا'), capital: L('Jakarta', 'Jakarta', 'جاكرتا'), continent: 'asia', lat: -6.2, lon: 106.8 },
  { code: 'KR', name: L('South Korea', 'Corée du Sud', 'كوريا الجنوبية'), capital: L('Seoul', 'Séoul', 'سول'), continent: 'asia', lat: 37.6, lon: 127.0 },
  { code: 'PK', name: L('Pakistan', 'Pakistan', 'باكستان'), capital: L('Islamabad', 'Islamabad', 'إسلام آباد'), continent: 'asia', lat: 33.7, lon: 73.1 },
  { code: 'FR', name: L('France', 'France', 'فرنسا'), capital: L('Paris', 'Paris', 'باريس'), continent: 'europe', lat: 48.9, lon: 2.4 },
  { code: 'DE', name: L('Germany', 'Allemagne', 'ألمانيا'), capital: L('Berlin', 'Berlin', 'برلين'), continent: 'europe', lat: 52.5, lon: 13.4 },
  { code: 'IT', name: L('Italy', 'Italie', 'إيطاليا'), capital: L('Rome', 'Rome', 'روما'), continent: 'europe', lat: 41.9, lon: 12.5 },
  { code: 'ES', name: L('Spain', 'Espagne', 'إسبانيا'), capital: L('Madrid', 'Madrid', 'مدريد'), continent: 'europe', lat: 40.4, lon: -3.7 },
  { code: 'GB', name: L('United Kingdom', 'Royaume-Uni', 'المملكة المتحدة'), capital: L('London', 'Londres', 'لندن'), continent: 'europe', lat: 51.5, lon: -0.1 },
  { code: 'PT', name: L('Portugal', 'Portugal', 'البرتغال'), capital: L('Lisbon', 'Lisbonne', 'لشبونة'), continent: 'europe', lat: 38.7, lon: -9.1 },
  { code: 'GR', name: L('Greece', 'Grèce', 'اليونان'), capital: L('Athens', 'Athènes', 'أثينا'), continent: 'europe', lat: 38.0, lon: 23.7 },
  { code: 'NL', name: L('Netherlands', 'Pays-Bas', 'هولندا'), capital: L('Amsterdam', 'Amsterdam', 'أمستردام'), continent: 'europe', lat: 52.4, lon: 4.9 },
  { code: 'SE', name: L('Sweden', 'Suède', 'السويد'), capital: L('Stockholm', 'Stockholm', 'ستوكهولم'), continent: 'europe', lat: 59.3, lon: 18.1 },
  { code: 'NO', name: L('Norway', 'Norvège', 'النرويج'), capital: L('Oslo', 'Oslo', 'أوسلو'), continent: 'europe', lat: 59.9, lon: 10.8 },
  { code: 'PL', name: L('Poland', 'Pologne', 'بولندا'), capital: L('Warsaw', 'Varsovie', 'وارسو'), continent: 'europe', lat: 52.2, lon: 21.0 },
  { code: 'BE', name: L('Belgium', 'Belgique', 'بلجيكا'), capital: L('Brussels', 'Bruxelles', 'بروكسل'), continent: 'europe', lat: 50.8, lon: 4.4 },
  { code: 'CH', name: L('Switzerland', 'Suisse', 'سويسرا'), capital: L('Bern', 'Berne', 'برن'), continent: 'europe', lat: 46.9, lon: 7.4 },
  { code: 'US', name: L('United States', 'États-Unis', 'الولايات المتحدة'), capital: L('Washington, D.C.', 'Washington', 'واشنطن'), continent: 'north-america', lat: 38.9, lon: -77.0 },
  { code: 'CA', name: L('Canada', 'Canada', 'كندا'), capital: L('Ottawa', 'Ottawa', 'أوتاوا'), continent: 'north-america', lat: 45.4, lon: -75.7 },
  { code: 'MX', name: L('Mexico', 'Mexique', 'المكسيك'), capital: L('Mexico City', 'Mexico', 'مكسيكو'), continent: 'north-america', lat: 19.4, lon: -99.1 },
  { code: 'CU', name: L('Cuba', 'Cuba', 'كوبا'), capital: L('Havana', 'La Havane', 'هافانا'), continent: 'north-america', lat: 23.1, lon: -82.4 },
  { code: 'BR', name: L('Brazil', 'Brésil', 'البرازيل'), capital: L('Brasília', 'Brasilia', 'برازيليا'), continent: 'south-america', lat: -15.8, lon: -47.9 },
  { code: 'AR', name: L('Argentina', 'Argentine', 'الأرجنتين'), capital: L('Buenos Aires', 'Buenos Aires', 'بوينس آيرس'), continent: 'south-america', lat: -34.6, lon: -58.4 },
  { code: 'CL', name: L('Chile', 'Chili', 'تشيلي'), capital: L('Santiago', 'Santiago', 'سانتياغو'), continent: 'south-america', lat: -33.4, lon: -70.7 },
  { code: 'PE', name: L('Peru', 'Pérou', 'بيرو'), capital: L('Lima', 'Lima', 'ليما'), continent: 'south-america', lat: -12.0, lon: -77.0 },
  { code: 'CO', name: L('Colombia', 'Colombie', 'كولومبيا'), capital: L('Bogotá', 'Bogota', 'بوغوتا'), continent: 'south-america', lat: 4.7, lon: -74.1 },
  { code: 'AU', name: L('Australia', 'Australie', 'أستراليا'), capital: L('Canberra', 'Canberra', 'كانبرا'), continent: 'oceania', lat: -35.3, lon: 149.1 },
  { code: 'NZ', name: L('New Zealand', 'Nouvelle-Zélande', 'نيوزيلندا'), capital: L('Wellington', 'Wellington', 'ولينغتون'), continent: 'oceania', lat: -41.3, lon: 174.8 },
  { code: 'FJ', name: L('Fiji', 'Fidji', 'فيجي'), capital: L('Suva', 'Suva', 'سوفا'), continent: 'oceania', lat: -18.1, lon: 178.4 },
];

export interface WordItem { word: string; hint: string }

/** Spelling words per language with a short definition used as a hint. */
export const WORDS: Record<'en' | 'fr' | 'ar', WordItem[]> = {
  en: [
    { word: 'planet', hint: 'A large body orbiting a star' }, { word: 'oxygen', hint: 'Gas we need to breathe' },
    { word: 'triangle', hint: 'Shape with three sides' }, { word: 'library', hint: 'Place to borrow books' },
    { word: 'energy', hint: 'Capacity to do work' }, { word: 'history', hint: 'Study of the past' },
    { word: 'equation', hint: 'Statement that two expressions are equal' }, { word: 'molecule', hint: 'Group of bonded atoms' },
    { word: 'necessary', hint: 'Needed; required' }, { word: 'separate', hint: 'To set apart' },
    { word: 'rhythm', hint: 'Regular repeated pattern of sound' }, { word: 'science', hint: 'Systematic study of the world' },
    { word: 'knowledge', hint: 'Facts and skills you have learned' }, { word: 'chemistry', hint: 'Study of substances and reactions' },
    { word: 'parallel', hint: 'Lines that never meet' }, { word: 'geography', hint: 'Study of places and the Earth' },
    { word: 'vocabulary', hint: 'All the words you know' }, { word: 'algorithm', hint: 'Step-by-step procedure' },
    { word: 'continent', hint: 'One of the Earth’s large landmasses' }, { word: 'photosynthesis', hint: 'How plants make food from light' },
  ],
  fr: [
    { word: 'planète', hint: 'Corps qui tourne autour d’une étoile' }, { word: 'oxygène', hint: 'Gaz nécessaire à la respiration' },
    { word: 'triangle', hint: 'Figure à trois côtés' }, { word: 'bibliothèque', hint: 'Lieu où l’on emprunte des livres' },
    { word: 'énergie', hint: 'Capacité à produire un travail' }, { word: 'histoire', hint: 'Étude du passé' },
    { word: 'équation', hint: 'Égalité contenant une inconnue' }, { word: 'molécule', hint: 'Groupe d’atomes liés' },
    { word: 'nécessaire', hint: 'Dont on a besoin' }, { word: 'rythme', hint: 'Retour régulier d’un son' },
    { word: 'science', hint: 'Étude méthodique du monde' }, { word: 'connaissance', hint: 'Ce que l’on sait' },
    { word: 'chimie', hint: 'Étude des substances et réactions' }, { word: 'parallèle', hint: 'Droites qui ne se coupent jamais' },
    { word: 'géographie', hint: 'Étude de la Terre et des lieux' }, { word: 'vocabulaire', hint: 'Ensemble des mots' },
    { word: 'algorithme', hint: 'Suite d’instructions' }, { word: 'continent', hint: 'Grande étendue de terre' },
    { word: 'grenouille', hint: 'Amphibien qui saute' }, { word: 'aujourd’hui', hint: 'Le jour présent' },
  ],
  ar: [
    { word: 'كوكب', hint: 'جرم يدور حول نجم' }, { word: 'مدرسة', hint: 'مكان التعلم' },
    { word: 'مثلث', hint: 'شكل له ثلاثة أضلاع' }, { word: 'مكتبة', hint: 'مكان استعارة الكتب' },
    { word: 'طاقة', hint: 'القدرة على بذل شغل' }, { word: 'تاريخ', hint: 'دراسة الماضي' },
    { word: 'معادلة', hint: 'مساواة تحتوي على مجهول' }, { word: 'جزيء', hint: 'مجموعة ذرات مترابطة' },
    { word: 'كيمياء', hint: 'علم المواد وتفاعلاتها' }, { word: 'جغرافيا', hint: 'علم الأرض والأماكن' },
    { word: 'حاسوب', hint: 'جهاز لمعالجة البيانات' }, { word: 'قاموس', hint: 'كتاب يشرح معاني الكلمات' },
    { word: 'خوارزمية', hint: 'خطوات مرتبة لحل مسألة' }, { word: 'قارة', hint: 'كتلة يابسة كبيرة' },
    { word: 'نبات', hint: 'كائن حي يصنع غذاءه' }, { word: 'شمس', hint: 'النجم الأقرب إلى الأرض' },
    { word: 'جامعة', hint: 'مؤسسة للتعليم العالي' }, { word: 'امتحان', hint: 'اختبار لقياس المعرفة' },
    { word: 'معرفة', hint: 'ما تعلمته من حقائق ومهارات' }, { word: 'مستطيل', hint: 'شكل رباعي زواياه قائمة' },
  ],
};

/** Vocabulary pairs used by Memory Cards and Flashcard Sprint (en ↔ fr ↔ ar). */
export const VOCAB: LocalizedText[] = [
  L('book', 'livre', 'كتاب'), L('school', 'école', 'مدرسة'), L('teacher', 'professeur', 'معلّم'), L('water', 'eau', 'ماء'),
  L('sun', 'soleil', 'شمس'), L('moon', 'lune', 'قمر'), L('tree', 'arbre', 'شجرة'), L('house', 'maison', 'بيت'),
  L('friend', 'ami', 'صديق'), L('city', 'ville', 'مدينة'), L('sea', 'mer', 'بحر'), L('time', 'temps', 'وقت'),
  L('question', 'question', 'سؤال'), L('answer', 'réponse', 'جواب'), L('science', 'science', 'علم'), L('number', 'nombre', 'عدد'),
];

/** Formula ↔ name pairs used by Memory Cards and Flashcard Sprint. */
export const FORMULA_PAIRS: Array<{ formula: string; name: LocalizedText }> = [
  { formula: 'F = ma', name: L('Newton’s second law', 'Deuxième loi de Newton', 'قانون نيوتن الثاني') },
  { formula: 'U = RI', name: L('Ohm’s law', 'Loi d’Ohm', 'قانون أوم') },
  { formula: 'a² + b² = c²', name: L('Pythagorean theorem', 'Théorème de Pythagore', 'مبرهنة فيثاغورس') },
  { formula: 'A = πr²', name: L('Area of a circle', 'Aire d’un disque', 'مساحة الدائرة') },
  { formula: 'E = mc²', name: L('Mass–energy equivalence', 'Équivalence masse-énergie', 'تكافؤ الكتلة والطاقة') },
  { formula: 'v = d/t', name: L('Average speed', 'Vitesse moyenne', 'السرعة المتوسطة') },
  { formula: 'ρ = m/V', name: L('Density', 'Masse volumique', 'الكثافة') },
  { formula: 'n = m/M', name: L('Amount of substance', 'Quantité de matière', 'كمية المادة') },
  { formula: 'P = UI', name: L('Electric power', 'Puissance électrique', 'القدرة الكهربائية') },
  { formula: 'Ec = ½mv²', name: L('Kinetic energy', 'Énergie cinétique', 'الطاقة الحركية') },
  { formula: 'Δ = b² − 4ac', name: L('Discriminant', 'Discriminant', 'المميز') },
  { formula: 'C = n/V', name: L('Molar concentration', 'Concentration molaire', 'التركيز المولي') },
];

export interface Compound { formula: string; name: LocalizedText; kind: 'acid' | 'base' | 'salt' | 'oxide' | 'organic' | 'element' }

export const COMPOUNDS: Compound[] = [
  { formula: 'H2O', name: L('Water', 'Eau', 'الماء'), kind: 'oxide' },
  { formula: 'CO2', name: L('Carbon dioxide', 'Dioxyde de carbone', 'ثاني أكسيد الكربون'), kind: 'oxide' },
  { formula: 'NaCl', name: L('Sodium chloride', 'Chlorure de sodium', 'كلوريد الصوديوم'), kind: 'salt' },
  { formula: 'HCl', name: L('Hydrochloric acid', 'Acide chlorhydrique', 'حمض الهيدروكلوريك'), kind: 'acid' },
  { formula: 'H2SO4', name: L('Sulfuric acid', 'Acide sulfurique', 'حمض الكبريتيك'), kind: 'acid' },
  { formula: 'HNO3', name: L('Nitric acid', 'Acide nitrique', 'حمض النيتريك'), kind: 'acid' },
  { formula: 'NaOH', name: L('Sodium hydroxide', 'Hydroxyde de sodium', 'هيدروكسيد الصوديوم'), kind: 'base' },
  { formula: 'KOH', name: L('Potassium hydroxide', 'Hydroxyde de potassium', 'هيدروكسيد البوتاسيوم'), kind: 'base' },
  { formula: 'NH3', name: L('Ammonia', 'Ammoniac', 'الأمونيا'), kind: 'base' },
  { formula: 'CH4', name: L('Methane', 'Méthane', 'الميثان'), kind: 'organic' },
  { formula: 'C2H5OH', name: L('Ethanol', 'Éthanol', 'الإيثانول'), kind: 'organic' },
  { formula: 'C6H12O6', name: L('Glucose', 'Glucose', 'الغلوكوز'), kind: 'organic' },
  { formula: 'CaCO3', name: L('Calcium carbonate', 'Carbonate de calcium', 'كربونات الكالسيوم'), kind: 'salt' },
  { formula: 'Fe2O3', name: L('Iron(III) oxide', 'Oxyde de fer(III)', 'أكسيد الحديد الثلاثي'), kind: 'oxide' },
  { formula: 'O3', name: L('Ozone', 'Ozone', 'الأوزون'), kind: 'element' },
  { formula: 'CuSO4', name: L('Copper(II) sulfate', 'Sulfate de cuivre(II)', 'كبريتات النحاس الثنائي'), kind: 'salt' },
];

export const COMPOUND_KINDS: Record<Compound['kind'], LocalizedText> = {
  acid: L('Acid', 'Acide', 'حمض'), base: L('Base', 'Base', 'قاعدة'), salt: L('Salt', 'Sel', 'ملح'),
  oxide: L('Oxide', 'Oxyde', 'أكسيد'), organic: L('Organic compound', 'Composé organique', 'مركب عضوي'), element: L('Element (molecular form)', 'Corps simple', 'عنصر (صيغة جزيئية)'),
};

/** Unbalanced reactions; coefficients are computed by the balancer, never hard-coded. */
export const REACTIONS = [
  'H2 + O2 -> H2O', 'CH4 + O2 -> CO2 + H2O', 'Fe + O2 -> Fe2O3', 'Na + Cl2 -> NaCl', 'N2 + H2 -> NH3',
  'C3H8 + O2 -> CO2 + H2O', 'Al + O2 -> Al2O3', 'Mg + HCl -> MgCl2 + H2', 'KClO3 -> KCl + O2', 'C6H12O6 + O2 -> CO2 + H2O',
  'Zn + HCl -> ZnCl2 + H2', 'CaCO3 -> CaO + CO2', 'C2H6 + O2 -> CO2 + H2O', 'P4 + O2 -> P2O5',
];

export const CS_CONCEPTS: McqItem[] = [
  { topic: 'complexity', q: L('Time complexity of binary search on n sorted items?', 'Complexité de la recherche dichotomique sur n éléments triés ?', 'ما تعقيد البحث الثنائي على n عنصرًا مرتبًا؟'), choices: [same('O(1)'), same('O(log n)'), same('O(n)'), same('O(n²)')], answer: 1 },
  { topic: 'complexity', q: L('Time complexity of bubble sort in the worst case?', 'Complexité du tri à bulles dans le pire cas ?', 'ما تعقيد ترتيب الفقاعات في أسوأ حالة؟'), choices: [same('O(n)'), same('O(n log n)'), same('O(n²)'), same('O(2ⁿ)')], answer: 2 },
  { topic: 'structures', q: L('Which structure is Last-In-First-Out?', 'Quelle structure est LIFO (dernier entré, premier sorti) ?', 'أي بنية تعمل بمبدأ آخر داخل أول خارج؟'), choices: [L('Queue', 'File', 'الطابور'), L('Stack', 'Pile', 'المكدس'), L('Tree', 'Arbre', 'الشجرة'), L('Graph', 'Graphe', 'المخطط')], answer: 1 },
  { topic: 'structures', q: L('Which structure is First-In-First-Out?', 'Quelle structure est FIFO (premier entré, premier sorti) ?', 'أي بنية تعمل بمبدأ أول داخل أول خارج؟'), choices: [L('Queue', 'File', 'الطابور'), L('Stack', 'Pile', 'المكدس'), L('Set', 'Ensemble', 'المجموعة'), L('Heap', 'Tas', 'الكومة')], answer: 0 },
  { topic: 'logic', q: L('What is TRUE AND FALSE?', 'Que vaut VRAI ET FAUX ?', 'ما قيمة صحيح AND خطأ؟'), choices: [L('TRUE', 'VRAI', 'صحيح'), L('FALSE', 'FAUX', 'خطأ')], answer: 1 },
  { topic: 'logic', q: L('What is NOT (FALSE OR FALSE)?', 'Que vaut NON (FAUX OU FAUX) ?', 'ما قيمة NOT (خطأ OR خطأ)؟'), choices: [L('TRUE', 'VRAI', 'صحيح'), L('FALSE', 'FAUX', 'خطأ')], answer: 0 },
  { topic: 'basics', q: L('Which keyword defines a function in Python?', 'Quel mot-clé définit une fonction en Python ?', 'ما الكلمة المفتاحية لتعريف دالة في بايثون؟'), choices: [same('func'), same('def'), same('function'), same('lambda')], answer: 1 },
  { topic: 'basics', q: L('What is the index of the first element of a list in most languages?', 'Quel est l’indice du premier élément d’une liste dans la plupart des langages ?', 'ما فهرس العنصر الأول في القائمة في معظم اللغات؟'), choices: [same('0'), same('1'), same('-1'), same('n')], answer: 0 },
  { topic: 'basics', q: L('Which of these is NOT a programming language?', 'Lequel n’est PAS un langage de programmation ?', 'أي مما يلي ليس لغة برمجة؟'), choices: [same('Python'), same('Java'), same('HTML'), same('C')], answer: 2 },
  { topic: 'complexity', q: L('A function that calls itself is…', 'Une fonction qui s’appelle elle-même est…', 'الدالة التي تستدعي نفسها تسمى…'), choices: [L('Recursive', 'Récursive', 'عودية'), L('Iterative', 'Itérative', 'تكرارية'), L('Static', 'Statique', 'ثابتة'), L('Anonymous', 'Anonyme', 'مجهولة')], answer: 0 },
];
