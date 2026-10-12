import type { Locale } from '../i18n/index.js';

/**
 * The deterministic engines emit English step descriptions. This table localises them into
 * French and Arabic with regex templates ($1, $2… keep the computed values). Unknown strings
 * are returned unchanged, so a missing entry degrades to English rather than failing.
 */
const RULES: Array<[RegExp, string, string]> = [
  [/^Write the equation$/, 'Écrire l’équation', 'نكتب المعادلة'],
  [/^Move every term to one side and collect like terms$/, 'Tout passer dans un membre et regrouper les termes semblables', 'ننقل كل الحدود إلى طرف واحد ونجمع الحدود المتشابهة'],
  [/^Isolate (\w+): (.+)$/, 'Isoler $1 : $2', 'نعزل $1: $2'],
  [/^Divide both sides by (.+)$/, 'Diviser les deux membres par $1', 'نقسم الطرفين على $1'],
  [/^Identify a = (.+), b = (.+), c = (.+)$/, 'Identifier a = $1, b = $2, c = $3', 'نحدد a = $1، b = $2، c = $3'],
  [/^Compute the discriminant Δ = b² − 4ac$/, 'Calculer le discriminant Δ = b² − 4ac', 'نحسب المميز Δ = b² − 4ac'],
  [/^Apply the quadratic formula$/, 'Appliquer la formule du second degré', 'نطبق قانون حل المعادلة التربيعية'],
  [/^Δ > 0, so there are two distinct real solutions$/, 'Δ > 0 : deux solutions réelles distinctes', 'Δ > 0، إذن يوجد حلان حقيقيان مختلفان'],
  [/^Δ = 0, so there is one repeated real solution$/, 'Δ = 0 : une solution réelle double', 'Δ = 0، إذن يوجد حل حقيقي مضاعف'],
  [/^Δ < 0, so there are no real solutions; the two complex solutions are conjugates$/, 'Δ < 0 : pas de solution réelle ; deux solutions complexes conjuguées', 'Δ < 0، إذن لا توجد حلول حقيقية؛ والحلان العقديان مترافقان'],
  [/^Check each solution by substituting it back into the original equation$/, 'Vérifier chaque solution en la remplaçant dans l’équation de départ', 'نتحقق من كل حل بتعويضه في المعادلة الأصلية'],
  [/^Degree-(\d+) polynomial: find roots numerically \(Durand–Kerner iteration\)$/, 'Polynôme de degré $1 : recherche numérique des racines (méthode de Durand–Kerner)', 'كثير حدود من الدرجة $1: نوجد الجذور عدديًا (طريقة دوراند-كيرنر)'],
  [/^The equation is not polynomial; search for real roots numerically \(sign changes \+ bisection\)$/, 'L’équation n’est pas polynomiale : recherche numérique des racines (changements de signe + dichotomie)', 'المعادلة ليست كثيرة حدود؛ نبحث عن الجذور الحقيقية عدديًا (تغير الإشارة + التنصيف)'],
  [/^Parse the expression$/, 'Analyser l’expression', 'نحلل العبارة'],
  [/^Evaluate using exact operator precedence$/, 'Calculer en respectant les priorités opératoires', 'نحسب مع احترام أولوية العمليات'],
  [/^Original expression$/, 'Expression de départ', 'العبارة الأصلية'],
  [/^Combine like terms and simplify$/, 'Regrouper les termes semblables et simplifier', 'نجمع الحدود المتشابهة ونبسط'],
  [/^Simplify$/, 'Simplifier', 'نبسط'],
  [/^Apply differentiation rules \(power, product, quotient, chain\)$/, 'Appliquer les règles de dérivation (puissance, produit, quotient, composée)', 'نطبق قواعد الاشتقاق (القوة، الضرب، القسمة، السلسلة)'],
  [/^Integrate term by term with the power rule (.+)$/, 'Intégrer terme à terme avec la règle des puissances $1', 'نكامل حدًا حدًا باستخدام قاعدة القوة $1'],
  [/^Evaluate F\((.+)\) − F\((.+)\)$/, 'Calculer F($1) − F($2)', 'نحسب F($1) − F($2)'],
  [/^Compute the definite integral numerically \(adaptive Simpson rule\)$/, 'Calculer l’intégrale numériquement (méthode de Simpson adaptative)', 'نحسب التكامل المحدد عدديًا (قاعدة سيمبسون التكيفية)'],
  [/^Write the augmented matrix for unknowns (.+)$/, 'Écrire la matrice augmentée pour les inconnues $1', 'نكتب المصفوفة الموسعة للمجاهيل $1'],
  [/^Eliminate (\w+) from the other equations$/, 'Éliminer $1 des autres équations', 'نحذف $1 من المعادلات الأخرى'],
  [/^Count n = (.+), sum = (.+)$/, 'Effectif n = $1, somme = $2', 'العدد n = $1، المجموع = $2'],
  [/^Mean = sum \/ n = (.+)$/, 'Moyenne = somme / n = $1', 'المتوسط = المجموع / n = $1'],
  [/^Sort the data; the median is (.+) \(Q1 = (.+), Q3 = (.+)\)$/, 'Trier les données ; la médiane vaut $1 (Q1 = $2, Q3 = $3)', 'نرتب البيانات؛ الوسيط هو $1 (Q1 = $2، Q3 = $3)'],
  [/^Population variance = (.+); sample variance = (.+)$/, 'Variance de la population = $1 ; variance de l’échantillon = $2', 'تباين المجتمع = $1؛ تباين العينة = $2'],
  [/^Express (.+) and (.+) in SI base units$/, 'Exprimer $1 et $2 en unités SI de base', 'نعبر عن $1 و$2 بوحدات SI الأساسية'],
  [/^Multiply by the conversion factor (.+)$/, 'Multiplier par le facteur de conversion $1', 'نضرب في معامل التحويل $1'],
  [/^Given (.+)$/, 'Donnée : $1', 'المعطى: $1'],
  [/^Use (.+)$/, 'Utiliser : $1', 'نستخدم: $1'],
  [/^Solve for (\w+): (.+)$/, 'Résoudre pour $1 : $2', 'نحل بالنسبة إلى $1: $2'],
  [/^List the elements present: (.+)$/, 'Lister les éléments présents : $1', 'نحدد العناصر الموجودة: $1'],
  [/^Write one conservation equation per element \(atoms in = atoms out\)$/, 'Écrire une équation de conservation par élément (atomes à gauche = atomes à droite)', 'نكتب معادلة انحفاظ لكل عنصر (الذرات في اليسار = الذرات في اليمين)'],
  [/^Solve the linear system for the smallest whole-number coefficients$/, 'Résoudre le système pour obtenir les plus petits coefficients entiers', 'نحل النظام الخطي لإيجاد أصغر معاملات صحيحة'],
  [/^Sum: (.+)$/, 'Somme : $1', 'المجموع: $1'],
  [/^Gravitational acceleration g = 9\.81 m\/s² \(standard value\) was assumed\.$/, 'On a supposé g = 9,81 m/s² (valeur standard).', 'افترضنا تسارع الجاذبية g = 9.81 م/ث² (القيمة القياسية).'],
  [/^Only real solutions in the interval \[−100, 100\] were searched\.$/, 'Seules les solutions réelles dans [−100, 100] ont été recherchées.', 'بُحث فقط عن الحلول الحقيقية في المجال [−100، 100].'],
  [/^Roots of degree ≥ 3 are computed numerically and rounded to 10 significant digits\.$/, 'Les racines de degré ≥ 3 sont calculées numériquement et arrondies à 10 chiffres significatifs.', 'تُحسب جذور الدرجة ≥ 3 عدديًا وتُقرّب إلى 10 أرقام معنوية.'],
  [/^No real solutions\. Complex solutions are shown\.$/, 'Pas de solution réelle. Les solutions complexes sont affichées.', 'لا توجد حلول حقيقية. تُعرض الحلول العقدية.'],
  [/^The expression is undefined or infinite \(for example, division by zero\)\.$/, 'L’expression est indéfinie ou infinie (par exemple, division par zéro).', 'العبارة غير معرفة أو لانهائية (مثل القسمة على صفر).'],
  [/^The integral may diverge on this interval\.$/, 'L’intégrale peut diverger sur cet intervalle.', 'قد يكون التكامل متباعدًا على هذا المجال.'],
  [/^Many solutions found; the equation may be periodic and have infinitely many\.$/, 'Nombreuses solutions : l’équation est peut-être périodique (une infinité de solutions).', 'وُجدت حلول كثيرة؛ قد تكون المعادلة دورية ولها عدد لانهائي من الحلول.'],
  [/^(\d+) complex root\(s\) omitted from the real solutions\.$/, '$1 racine(s) complexe(s) omise(s).', 'تم استبعاد $1 جذر عقدي من الحلول الحقيقية.'],
  [/^Rejected extraneous candidate\(s\): (.+) \(make a denominator zero or fail substitution\)\.$/, 'Solution(s) parasite(s) rejetée(s) : $1 (dénominateur nul ou vérification échouée).', 'رُفض الحل الدخيل: $1 (يجعل المقام صفرًا أو لا يحقق المعادلة).'],
  [/^Temperature conversion treats values as absolute temperatures, not differences\.$/, 'La conversion traite les valeurs comme des températures absolues, pas des écarts.', 'يعامل التحويل القيم كدرجات حرارة مطلقة وليس كفروق.'],
  [/^Standard atomic weights \(IUPAC conventional values\) were used\.$/, 'Masses atomiques standard (valeurs conventionnelles UICPA).', 'استُخدمت الكتل الذرية القياسية (القيم الاصطلاحية لـ IUPAC).'],
  [/^σ is the population standard deviation; s is the sample standard deviation \(n − 1\)\.$/, 'σ est l’écart-type de la population ; s celui de l’échantillon (n − 1).', 'σ هو الانحراف المعياري للمجتمع؛ و s للعينة (n − 1).'],
  [/^Value computed numerically\.$/, 'Valeur calculée numériquement.', 'القيمة محسوبة عدديًا.'],
];

export function localizeStep(text: string, locale: Locale): string {
  if (locale === 'en') return text;
  for (const [re, fr, ar] of RULES) {
    if (re.test(text)) return text.replace(re, locale === 'fr' ? fr : ar);
  }
  return text;
}
