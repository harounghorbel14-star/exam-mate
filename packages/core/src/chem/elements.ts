export type ElementCategory =
  | 'alkali-metal' | 'alkaline-earth' | 'transition-metal' | 'post-transition' | 'metalloid'
  | 'nonmetal' | 'halogen' | 'noble-gas' | 'lanthanide' | 'actinide';

export interface ChemicalElement {
  z: number;
  symbol: string;
  name: { en: string; fr: string; ar: string };
  mass: number;
  category: ElementCategory;
  group: number | null;
  period: number;
}

// Z|Symbol|English|French|Arabic|standard atomic weight|category code|group|period
// Category codes: a=alkali, e=alkaline-earth, t=transition, p=post-transition, m=metalloid,
// n=nonmetal, h=halogen, g=noble gas, l=lanthanide, c=actinide. Masses: IUPAC conventional values.
const RAW = `1|H|Hydrogen|Hydrogène|هيدروجين|1.008|n|1|1
2|He|Helium|Hélium|هيليوم|4.0026|g|18|1
3|Li|Lithium|Lithium|ليثيوم|6.94|a|1|2
4|Be|Beryllium|Béryllium|بيريليوم|9.0122|e|2|2
5|B|Boron|Bore|بورون|10.81|m|13|2
6|C|Carbon|Carbone|كربون|12.011|n|14|2
7|N|Nitrogen|Azote|نيتروجين|14.007|n|15|2
8|O|Oxygen|Oxygène|أكسجين|15.999|n|16|2
9|F|Fluorine|Fluor|فلور|18.998|h|17|2
10|Ne|Neon|Néon|نيون|20.180|g|18|2
11|Na|Sodium|Sodium|صوديوم|22.990|a|1|3
12|Mg|Magnesium|Magnésium|مغنيسيوم|24.305|e|2|3
13|Al|Aluminium|Aluminium|ألومنيوم|26.982|p|13|3
14|Si|Silicon|Silicium|سيليكون|28.085|m|14|3
15|P|Phosphorus|Phosphore|فوسفور|30.974|n|15|3
16|S|Sulfur|Soufre|كبريت|32.06|n|16|3
17|Cl|Chlorine|Chlore|كلور|35.45|h|17|3
18|Ar|Argon|Argon|أرغون|39.948|g|18|3
19|K|Potassium|Potassium|بوتاسيوم|39.098|a|1|4
20|Ca|Calcium|Calcium|كالسيوم|40.078|e|2|4
21|Sc|Scandium|Scandium|سكانديوم|44.956|t|3|4
22|Ti|Titanium|Titane|تيتانيوم|47.867|t|4|4
23|V|Vanadium|Vanadium|فاناديوم|50.942|t|5|4
24|Cr|Chromium|Chrome|كروم|51.996|t|6|4
25|Mn|Manganese|Manganèse|منغنيز|54.938|t|7|4
26|Fe|Iron|Fer|حديد|55.845|t|8|4
27|Co|Cobalt|Cobalt|كوبالت|58.933|t|9|4
28|Ni|Nickel|Nickel|نيكل|58.693|t|10|4
29|Cu|Copper|Cuivre|نحاس|63.546|t|11|4
30|Zn|Zinc|Zinc|زنك|65.38|t|12|4
31|Ga|Gallium|Gallium|غاليوم|69.723|p|13|4
32|Ge|Germanium|Germanium|جرمانيوم|72.630|m|14|4
33|As|Arsenic|Arsenic|زرنيخ|74.922|m|15|4
34|Se|Selenium|Sélénium|سيلينيوم|78.971|n|16|4
35|Br|Bromine|Brome|بروم|79.904|h|17|4
36|Kr|Krypton|Krypton|كريبتون|83.798|g|18|4
37|Rb|Rubidium|Rubidium|روبيديوم|85.468|a|1|5
38|Sr|Strontium|Strontium|سترونشيوم|87.62|e|2|5
39|Y|Yttrium|Yttrium|إتريوم|88.906|t|3|5
40|Zr|Zirconium|Zirconium|زركونيوم|91.224|t|4|5
41|Nb|Niobium|Niobium|نيوبيوم|92.906|t|5|5
42|Mo|Molybdenum|Molybdène|موليبدنوم|95.95|t|6|5
43|Tc|Technetium|Technétium|تكنيشيوم|98|t|7|5
44|Ru|Ruthenium|Ruthénium|روثينيوم|101.07|t|8|5
45|Rh|Rhodium|Rhodium|روديوم|102.91|t|9|5
46|Pd|Palladium|Palladium|بالاديوم|106.42|t|10|5
47|Ag|Silver|Argent|فضة|107.87|t|11|5
48|Cd|Cadmium|Cadmium|كادميوم|112.41|t|12|5
49|In|Indium|Indium|إنديوم|114.82|p|13|5
50|Sn|Tin|Étain|قصدير|118.71|p|14|5
51|Sb|Antimony|Antimoine|أنتيمون|121.76|m|15|5
52|Te|Tellurium|Tellure|تيلوريوم|127.60|m|16|5
53|I|Iodine|Iode|يود|126.90|h|17|5
54|Xe|Xenon|Xénon|زينون|131.29|g|18|5
55|Cs|Caesium|Césium|سيزيوم|132.91|a|1|6
56|Ba|Barium|Baryum|باريوم|137.33|e|2|6
57|La|Lanthanum|Lanthane|لانثانوم|138.91|l||6
58|Ce|Cerium|Cérium|سيريوم|140.12|l||6
59|Pr|Praseodymium|Praséodyme|براسيوديميوم|140.91|l||6
60|Nd|Neodymium|Néodyme|نيوديميوم|144.24|l||6
61|Pm|Promethium|Prométhium|بروميثيوم|145|l||6
62|Sm|Samarium|Samarium|ساماريوم|150.36|l||6
63|Eu|Europium|Europium|يوروبيوم|151.96|l||6
64|Gd|Gadolinium|Gadolinium|غادولينيوم|157.25|l||6
65|Tb|Terbium|Terbium|تربيوم|158.93|l||6
66|Dy|Dysprosium|Dysprosium|ديسبروسيوم|162.50|l||6
67|Ho|Holmium|Holmium|هولميوم|164.93|l||6
68|Er|Erbium|Erbium|إربيوم|167.26|l||6
69|Tm|Thulium|Thulium|ثوليوم|168.93|l||6
70|Yb|Ytterbium|Ytterbium|إتيربيوم|173.05|l||6
71|Lu|Lutetium|Lutécium|لوتيتيوم|174.97|l||6
72|Hf|Hafnium|Hafnium|هافنيوم|178.49|t|4|6
73|Ta|Tantalum|Tantale|تنتالوم|180.95|t|5|6
74|W|Tungsten|Tungstène|تنغستن|183.84|t|6|6
75|Re|Rhenium|Rhénium|رينيوم|186.21|t|7|6
76|Os|Osmium|Osmium|أوزميوم|190.23|t|8|6
77|Ir|Iridium|Iridium|إيريديوم|192.22|t|9|6
78|Pt|Platinum|Platine|بلاتين|195.08|t|10|6
79|Au|Gold|Or|ذهب|196.97|t|11|6
80|Hg|Mercury|Mercure|زئبق|200.59|t|12|6
81|Tl|Thallium|Thallium|ثاليوم|204.38|p|13|6
82|Pb|Lead|Plomb|رصاص|207.2|p|14|6
83|Bi|Bismuth|Bismuth|بزموت|208.98|p|15|6
84|Po|Polonium|Polonium|بولونيوم|209|p|16|6
85|At|Astatine|Astate|أستاتين|210|h|17|6
86|Rn|Radon|Radon|رادون|222|g|18|6
87|Fr|Francium|Francium|فرانسيوم|223|a|1|7
88|Ra|Radium|Radium|راديوم|226|e|2|7
89|Ac|Actinium|Actinium|أكتينيوم|227|c||7
90|Th|Thorium|Thorium|ثوريوم|232.04|c||7
91|Pa|Protactinium|Protactinium|بروتكتينيوم|231.04|c||7
92|U|Uranium|Uranium|يورانيوم|238.03|c||7
93|Np|Neptunium|Neptunium|نبتونيوم|237|c||7
94|Pu|Plutonium|Plutonium|بلوتونيوم|244|c||7
95|Am|Americium|Américium|أمريسيوم|243|c||7
96|Cm|Curium|Curium|كوريوم|247|c||7
97|Bk|Berkelium|Berkélium|بركيليوم|247|c||7
98|Cf|Californium|Californium|كاليفورنيوم|251|c||7
99|Es|Einsteinium|Einsteinium|أينشتاينيوم|252|c||7
100|Fm|Fermium|Fermium|فرميوم|257|c||7
101|Md|Mendelevium|Mendélévium|مندليفيوم|258|c||7
102|No|Nobelium|Nobélium|نوبليوم|259|c||7
103|Lr|Lawrencium|Lawrencium|لورنسيوم|266|c||7
104|Rf|Rutherfordium|Rutherfordium|رذرفورديوم|267|t|4|7
105|Db|Dubnium|Dubnium|دوبنيوم|268|t|5|7
106|Sg|Seaborgium|Seaborgium|سيبورغيوم|269|t|6|7
107|Bh|Bohrium|Bohrium|بوريوم|270|t|7|7
108|Hs|Hassium|Hassium|هاسيوم|269|t|8|7
109|Mt|Meitnerium|Meitnérium|مايتنريوم|278|t|9|7
110|Ds|Darmstadtium|Darmstadtium|دارمشتاتيوم|281|t|10|7
111|Rg|Roentgenium|Roentgenium|رونتجينيوم|282|t|11|7
112|Cn|Copernicium|Copernicium|كوبرنيسيوم|285|t|12|7
113|Nh|Nihonium|Nihonium|نيهونيوم|286|p|13|7
114|Fl|Flerovium|Flérovium|فليروفيوم|289|p|14|7
115|Mc|Moscovium|Moscovium|موسكوفيوم|290|p|15|7
116|Lv|Livermorium|Livermorium|ليفرموريوم|293|p|16|7
117|Ts|Tennessine|Tennesse|تينيسين|294|h|17|7
118|Og|Oganesson|Oganesson|أوغانيسون|294|g|18|7`;

const CATEGORY: Record<string, ElementCategory> = {
  a: 'alkali-metal', e: 'alkaline-earth', t: 'transition-metal', p: 'post-transition', m: 'metalloid',
  n: 'nonmetal', h: 'halogen', g: 'noble-gas', l: 'lanthanide', c: 'actinide',
};

export const ELEMENTS: ChemicalElement[] = RAW.split('\n').map((line) => {
  const [z, symbol, en, fr, ar, mass, cat, group, period] = line.split('|') as string[];
  return {
    z: Number(z), symbol: symbol!, name: { en: en!, fr: fr!, ar: ar! }, mass: Number(mass),
    category: CATEGORY[cat!]!, group: group ? Number(group) : null, period: Number(period),
  };
});

export const ELEMENT_BY_SYMBOL: Map<string, ChemicalElement> = new Map(ELEMENTS.map((e) => [e.symbol, e]));
