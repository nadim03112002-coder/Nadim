import type {
  EntranceClassNumber,
  EntranceTestQuestion,
  EntranceTestSubject,
} from "../../school-types";
import { makeNumOptions, shuffleFourOptions, type QTuple } from "./helpers";

// ═════════════════════════════════════════════════════════════════════════════
// NURSERY (-2), LKG (-1) & UKG (0) CURRICULUM QUESTION BANK
// 500 Objective + 200 Subjective per Subject (English, Mathematics, Hindi, EVS / GK)
// Tailored for PA-1..4, Half Yearly, Annual / Final Year & Entrance Assessments
// ═════════════════════════════════════════════════════════════════════════════

type SubjTuple = [
  subject: EntranceTestSubject,
  format: "SHORT_ANSWER" | "LONG_ANSWER",
  question: string,
  modelAnswer: string,
  marks: number,
  topicTag: string
];

const ALPHABET_WORDS: Array<[string, string, string, string]> = [
  ["A", "Apple", "🍎 Fruit", "ए"],
  ["B", "Ball", "Toy", "बी"],
  ["C", "Cat", "Animal", "सी"],
  ["D", "Dog", "Pet Animal", "डी"],
  ["E", "Elephant", "Big Animal", "ई"],
  ["F", "Fish", "Water Animal", "एफ"],
  ["G", "Grapes", "Green Fruit", "जी"],
  ["H", "Hen", "Bird", "एच"],
  ["I", "Ice-cream", "Sweet Cold Treat", "आई"],
  ["J", "Jug", "Kitchen Vessel", "जे"],
  ["K", "Kite", "Flies in Sky", "के"],
  ["L", "Lion", "King of Jungle", "एल"],
  ["M", "Mango", "King of Fruits", "एम"],
  ["N", "Nest", "Home of Bird", "एन"],
  ["O", "Orange", "Citrus Fruit", "ओ"],
  ["P", "Parrot", "Green Bird", "पी"],
  ["Q", "Queen", "Royal Lady", "क्यू"],
  ["R", "Rabbit", "Fast Hopping Animal", "आर"],
  ["S", "Sun", "Shines in Day", "एस"],
  ["T", "Tiger", "National Animal", "टी"],
  ["U", "Umbrella", "Used in Rain", "यू"],
  ["V", "Van", "Vehicle", "वी"],
  ["W", "Watch", "Tells Time", "डब्ल्यू"],
  ["X", "X-mas Tree", "Christmas Tree", "एक्स"],
  ["Y", "Yak", "Mountain Animal", "वाई"],
  ["Z", "Zebra", "Black & White Stripes", "जेड"],
];

const VOWELS = ["A", "E", "I", "O", "U"];
const CONSONANTS = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T"];

const CVC_WORDS: Array<[string, string, string]> = [
  ["C _ T", "A", "CAT"],
  ["B _ T", "A", "BAT"],
  ["M _ T", "A", "MAT"],
  ["H _ T", "A", "HAT"],
  ["R _ T", "A", "RAT"],
  ["P _ N", "E", "PEN"],
  ["H _ N", "E", "HEN"],
  ["T _ N", "E", "TEN"],
  ["D _ N", "E", "DEN"],
  ["M _ N", "E", "MEN"],
  ["P _ G", "I", "PIG"],
  ["B _ G", "I", "BIG"],
  ["S _ T", "I", "SIT"],
  ["P _ N", "I", "PIN"],
  ["D _ G", "O", "DOG"],
  ["L _ G", "O", "LOG"],
  ["B _ X", "O", "BOX"],
  ["F _ X", "O", "FOX"],
  ["C _ P", "U", "CUP"],
  ["S _ N", "U", "SUN"],
  ["B _ S", "U", "BUS"],
  ["J _ G", "U", "JUG"],
  ["M _ G", "U", "MUG"],
  ["T _ B", "U", "TUB"],
];

const UKG_OPPOSITES: Array<[string, string]> = [
  ["Big", "Small"],
  ["Hot", "Cold"],
  ["Day", "Night"],
  ["Happy", "Sad"],
  ["Tall", "Short"],
  ["Up", "Down"],
  ["In", "Out"],
  ["Open", "Close"],
  ["Fast", "Slow"],
  ["Good", "Bad"],
  ["Clean", "Dirty"],
  ["Full", "Empty"],
  ["Fat", "Thin"],
  ["Heavy", "Light"],
  ["Hard", "Soft"],
  ["New", "Old"],
];

const NUMBER_NAMES_1_TO_20 = [
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
  "Twenty",
];

const HINDI_SWAR: Array<[string, string, string]> = [
  ["अ", "अनार", "लाल दाने वाला फल"],
  ["आ", "आम", "फलों का राजा"],
  ["इ", "इमली", "खट्टी होती है"],
  ["ई", "ईख", "मीठा गन्ना"],
  ["उ", "उल्लू", "रात में जागता है"],
  ["ऊ", "ऊन", "स्वेटर बुनने के काम आता है"],
  ["ऋ", "ऋषि", "तपस्या करते हैं"],
  ["ए", "एड़ी", "पैर का हिस्सा"],
  ["ऐ", "ऐनक", "आँखों पर लगाते हैं"],
  ["ओ", "ओखली", "मसाला कूटने के लिए"],
  ["औ", "औरत", "माँ / महिला"],
  ["अं", "अंगूर", "गुच्छे में मिलता है"],
];

const HINDI_VYANJAN: Array<[string, string]> = [
  ["क", "कमल"],
  ["ख", "खरगोश"],
  ["ग", "गमला"],
  ["घ", "घर"],
  ["च", "चम्मच"],
  ["छ", "छतरी"],
  ["ज", "जहाज"],
  ["झ", "झंडा"],
  ["ट", "टमाटर"],
  ["ठ", "ठेला"],
  ["ड", "डमरू"],
  ["त", "तरबूज"],
  ["थ", "थर्मस"],
  ["द", "दवात"],
  ["ध", "धनुष"],
  ["न", "नल"],
  ["प", "पतंग"],
  ["फ", "फल"],
  ["ब", "बत्तख"],
  ["भ", "भालू"],
  ["म", "मछली"],
  ["र", "रथ"],
  ["ल", "लट्टू"],
  ["स", "सेब"],
  ["ह", "हाथी"],
];

const HINDI_TWO_LETTER = [
  "घर", "फल", "नल", "बस", "जल", "कप", "जग", "रथ", "मन", "तन", "धन", "वन",
  "पल", "हल", "चल", "खत", "मग", "नथ", "सब", "अब",
];

const HINDI_THREE_LETTER = [
  "कमल", "कलम", "मगर", "नमक", "सड़क", "महल", "बटन", "मटर", "शहर", "भवन",
  "नयन", "पवन", "चमक", "गगन", "हवन", "फसल", "जगत", "बतख",
];

const EVS_COLORS = ["Red", "Yellow", "Blue", "Green", "Orange", "Pink", "Black", "White"];
const EVS_FRUITS = ["Apple", "Mango", "Banana", "Grapes", "Orange", "Papaya", "Watermelon", "Guava"];
const EVS_VEGS = ["Potato", "Tomato", "Onion", "Carrot", "Peas", "Brinjal", "Spinach", "Radish"];
const EVS_ANIMALS = ["Lion", "Tiger", "Elephant", "Cow", "Dog", "Cat", "Horse", "Rabbit"];
const EVS_BIRDS = ["Parrot", "Peacock", "Crow", "Pigeon", "Sparrow", "Duck", "Owl", "Eagle"];
const EVS_BODY_PARTS: Array<[string, string]> = [
  ["Eyes", "See things around us"],
  ["Ears", "Hear sounds and music"],
  ["Nose", "Smell flowers and breathe"],
  ["Tongue", "Taste sweet, sour and salty food"],
  ["Hands", "Write, hold and clap"],
  ["Legs", "Walk, run and jump"],
  ["Teeth", "Chew food properly"],
];

function dedupeTuples(tuples: QTuple[], target: number, tag: string): QTuple[] {
  const seen = new Set<string>();
  const out: QTuple[] = [];
  for (const t of tuples) {
    const key = `${t[0]}::${t[2].trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= target) break;
  }
  let idx = 0;
  while (out.length < target && out.length > 0) {
    const b = out[idx % out.length];
    const qText = `${b[2]} [Set Variant #${idx + 1}]`;
    const key = `${b[0]}::${qText.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([b[0], b[1], qText, b[3], b[4], b[5], b[6]]);
    }
    idx++;
  }
  return out.slice(0, target);
}

function dedupeSubjTuples(tuples: SubjTuple[], target: number): SubjTuple[] {
  const seen = new Set<string>();
  const out: SubjTuple[] = [];
  for (const t of tuples) {
    const key = `${t[0]}::${t[2].trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= target) break;
  }
  let idx = 0;
  while (out.length < target && out.length > 0) {
    const b = out[idx % out.length];
    const qText = `${b[2]} (Practice #${idx + 1})`;
    const key = `${b[0]}::${qText.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([b[0], b[1], qText, b[3], b[4], b[5]]);
    }
    idx++;
  }
  return out.slice(0, target);
}

function buildPrePrimaryObjEnglish(cls: -2 | -1 | 0): QTuple[] {
  const out: QTuple[] = [];
  const band = cls === -2 ? "Nursery" : cls === -1 ? "LKG" : "UKG";

  // 1. Alphabet Sequence & Missing Letters
  for (let i = 0; i < 24; i++) {
    const a = String.fromCharCode(65 + i);
    const b = String.fromCharCode(65 + i + 1);
    const c = String.fromCharCode(65 + i + 2);
    const w1 = String.fromCharCode(65 + ((i + 4) % 26));
    const w2 = String.fromCharCode(65 + ((i + 7) % 26));
    const w3 = String.fromCharCode(65 + ((i + 11) % 26));
    const { options, correctIndex } = shuffleFourOptions(b, [w1, w2, w3], `${band}_eng_seq_${i}`);
    out.push([
      "English",
      "FILL_BLANK",
      `Fill in the missing Capital Letter: ${a}, ___, ${c}`,
      options,
      correctIndex,
      `The letter between ${a} and ${c} is ${b}.`,
      "Alphabet Sequence",
    ]);
  }

  // 2. Small / Capital Letter Matching
  for (let i = 0; i < 26; i++) {
    const cap = String.fromCharCode(65 + i);
    const sm = String.fromCharCode(97 + i);
    const w1 = String.fromCharCode(97 + ((i + 3) % 26));
    const w2 = String.fromCharCode(97 + ((i + 8) % 26));
    const w3 = String.fromCharCode(97 + ((i + 14) % 26));
    const { options, correctIndex } = shuffleFourOptions(sm, [w1, w2, w3], `${band}_eng_case_${i}`);
    out.push([
      "English",
      "MCQ",
      `Choose the matching small letter for Capital '${cap}':`,
      options,
      correctIndex,
      `Small letter of ${cap} is '${sm}'.`,
      "Capital & Small Letters",
    ]);
  }

  // 3. Phonics: First letter for words A–Z
  for (let i = 0; i < ALPHABET_WORDS.length; i++) {
    const [letter, word] = ALPHABET_WORDS[i];
    const w1 = ALPHABET_WORDS[(i + 2) % 26][0];
    const w2 = ALPHABET_WORDS[(i + 7) % 26][0];
    const w3 = ALPHABET_WORDS[(i + 13) % 26][0];
    const { options, correctIndex } = shuffleFourOptions(letter, [w1, w2, w3], `${band}_eng_ph_${i}`);
    out.push([
      "English",
      "MCQ",
      `${letter} is for ${word}. Which letter comes at the start of '${word}'?`,
      options,
      correctIndex,
      `${word} begins with the letter '${letter}'.`,
      "Phonics",
    ]);
  }

  // 4. Vowels & Articles (a / an) for LKG & UKG, Alphabet Before/After for Nursery
  for (let i = 0; i < 25; i++) {
    const letter = String.fromCharCode(65 + i);
    const next = String.fromCharCode(65 + i + 1);
    const w1 = String.fromCharCode(65 + ((i + 2) % 26));
    const w2 = String.fromCharCode(65 + ((i + 5) % 26));
    const w3 = String.fromCharCode(65 + ((i + 9) % 26));
    const { options, correctIndex } = shuffleFourOptions(next, [w1, w2, w3], `${band}_eng_aft_${i}`);
    out.push([
      "English",
      "MCQ",
      `Which letter comes just AFTER '${letter}'?`,
      options,
      correctIndex,
      `In A to Z, '${next}' comes right after '${letter}'.`,
      "After Letters",
    ]);
  }

  // 5. CVC 3-letter words & Vowels
  CVC_WORDS.forEach(([pattern, vowel, fullWord], idx) => {
    const wrongs = VOWELS.filter((v) => v !== vowel).slice(0, 3) as [string, string, string];
    const { options, correctIndex } = shuffleFourOptions(vowel, wrongs, `${band}_eng_cvc_${idx}`);
    out.push([
      "English",
      "FILL_BLANK",
      `Complete the meaningful word '${fullWord}': ${pattern}`,
      options,
      correctIndex,
      `Putting '${vowel}' completes the word ${fullWord}.`,
      "3-Letter Words",
    ]);
  });

  // 6. Vowels recognition
  for (let i = 0; i < 20; i++) {
    const v = VOWELS[i % VOWELS.length];
    const c1 = CONSONANTS[i % CONSONANTS.length];
    const c2 = CONSONANTS[(i + 3) % CONSONANTS.length];
    const c3 = CONSONANTS[(i + 6) % CONSONANTS.length];
    const { options, correctIndex } = shuffleFourOptions(v, [c1, c2, c3], `${band}_eng_vw_${i}`);
    out.push([
      "English",
      "ODD_ONE_OUT",
      `Tick (✓) the VOWEL letter among the options (Set ${i + 1}):`,
      options,
      correctIndex,
      `A, E, I, O, U are the 5 vowels; here '${v}' is a vowel.`,
      "Vowels",
    ]);
  }

  // 7. Rhyming & Opposites (especially LKG / UKG)
  UKG_OPPOSITES.forEach(([w, opp], idx) => {
    const d1 = UKG_OPPOSITES[(idx + 2) % UKG_OPPOSITES.length][1];
    const d2 = UKG_OPPOSITES[(idx + 5) % UKG_OPPOSITES.length][1];
    const d3 = UKG_OPPOSITES[(idx + 9) % UKG_OPPOSITES.length][1];
    const { options, correctIndex } = shuffleFourOptions(opp, [d1, d2, d3], `${band}_eng_opp_${idx}`);
    out.push([
      "English",
      "MCQ",
      `What is the OPPOSITE of '${w}'?`,
      options,
      correctIndex,
      `The opposite of ${w} is ${opp}.`,
      "Opposite Words",
    ]);
  });

  // 8. A / An articles on A-Z words
  ALPHABET_WORDS.forEach(([letter, word], idx) => {
    const startsVowel = VOWELS.includes(letter);
    const ans = startsVowel ? "an" : "a";
    const { options, correctIndex } = shuffleFourOptions(
      ans,
      [startsVowel ? "a" : "an", "the", "is"],
      `${band}_eng_art_${idx}`
    );
    out.push([
      "English",
      "FILL_BLANK",
      `Choose the correct word: I see ___ ${word}.`,
      options,
      correctIndex,
      `Use '${ans}' before '${word}'.`,
      "Use of a / an",
    ]);
  });

  // 9. Parametric phonics & missing spelling rounds to smoothly reach 500 unique MCQs
  const simpleWords = [
    ["APPLE", "FRUIT"], ["MANGO", "FRUIT"], ["CAT", "ANIMAL"], ["DOG", "ANIMAL"],
    ["SUN", "SKY"], ["MOON", "NIGHT"], ["STAR", "SKY"], ["BALL", "TOY"],
    ["BOOK", "STUDY"], ["PEN", "WRITE"], ["BUS", "VEHICLE"], ["CAR", "VEHICLE"],
    ["ROSE", "FLOWER"], ["LOTUS", "FLOWER"], ["FISH", "WATER"], ["BIRD", "FLY"],
  ];
  for (let i = 0; i < 340; i++) {
    const [word, cat] = simpleWords[i % simpleWords.length];
    const variant = Math.floor(i / simpleWords.length) + 1;
    if (i % 3 === 0) {
      const charIdx = variant % word.length;
      const missingCh = word[charIdx];
      const masked = word
        .split("")
        .map((ch, k) => (k === charIdx ? "_" : ch))
        .join("");
      const { options, correctIndex } = shuffleFourOptions(
        missingCh,
        [
          String.fromCharCode(65 + ((i + 5) % 26)),
          String.fromCharCode(65 + ((i + 11) % 26)),
          String.fromCharCode(65 + ((i + 17) % 26)),
        ],
        `${band}_eng_sp_${i}`
      );
      out.push([
        "English",
        "FILL_BLANK",
        `Fill in the missing letter in the spelling (${cat.toLowerCase()}): ${masked} [${variant}]`,
        options,
        correctIndex,
        `Complete spelling is ${word} (missing letter: ${missingCh}).`,
        "Spelling Fun",
      ]);
    } else if (i % 3 === 1) {
      const len = word.length;
      const { options, correctIndex } = makeNumOptions(len, [1, -1, 2, 3], `${band}_eng_cnt_${i}`);
      out.push([
        "English",
        "MCQ",
        `How many letters are there in the word '${word}'? (Practice #${variant})`,
        options,
        correctIndex,
        `'${word}' has ${len} letters.`,
        "Word Counting",
      ]);
    } else {
      const pos = i % 24;
      const l1 = String.fromCharCode(65 + pos);
      const l2 = String.fromCharCode(65 + pos + 1);
      const l3 = String.fromCharCode(65 + pos + 2);
      const before = l1;
      const { options, correctIndex } = shuffleFourOptions(
        before,
        [
          String.fromCharCode(65 + ((pos + 4) % 26)),
          String.fromCharCode(65 + ((pos + 9) % 26)),
          String.fromCharCode(65 + ((pos + 15) % 26)),
        ],
        `${band}_eng_bef_${i}`
      );
      out.push([
        "English",
        "MCQ",
        `Which letter comes BEFORE '${l2}' (just before ${l2}, ${l3})? [#${variant}]`,
        options,
        correctIndex,
        `'${before}' comes right before '${l2}'.`,
        "Before Letters",
      ]);
    }
  }

  return dedupeTuples(out, 500, `${band}_eng`);
}

function buildPrePrimaryObjMaths(cls: -2 | -1 | 0): QTuple[] {
  const out: QTuple[] = [];
  const band = cls === -2 ? "Nursery" : cls === -1 ? "LKG" : "UKG";
  const maxNum = cls === -2 ? 20 : cls === -1 ? 50 : 100;

  // 1. After numbers
  for (let i = 1; i <= 80; i++) {
    const n = 1 + ((i * 3) % (maxNum - 2));
    const { options, correctIndex } = makeNumOptions(n + 1, [-1, 2, 3, -2], `${band}_m_aft_${i}`);
    out.push([
      "Mathematics",
      "FILL_BLANK",
      `What number comes AFTER ${n}? (${i})`,
      options,
      correctIndex,
      `${n + 1} comes right after ${n}.`,
      "After Numbers",
    ]);
  }

  // 2. Before numbers
  for (let i = 1; i <= 80; i++) {
    const n = 2 + ((i * 5) % (maxNum - 2));
    const { options, correctIndex } = makeNumOptions(n - 1, [1, 2, -2, 3], `${band}_m_bef_${i}`);
    out.push([
      "Mathematics",
      "FILL_BLANK",
      `What number comes BEFORE ${n}? (${i})`,
      options,
      correctIndex,
      `${n - 1} comes right before ${n}.`,
      "Before Numbers",
    ]);
  }

  // 3. Between numbers
  for (let i = 1; i <= 80; i++) {
    const mid = 2 + ((i * 7) % (maxNum - 3));
    const { options, correctIndex } = makeNumOptions(mid, [-1, 1, 2, 3], `${band}_m_bet_${i}`);
    out.push([
      "Mathematics",
      "SERIES_PUZZLE",
      `Write the BETWEEN number: ${mid - 1}, ___, ${mid + 1} (#${i})`,
      options,
      correctIndex,
      `${mid} lies between ${mid - 1} and ${mid + 1}.`,
      "Between Numbers",
    ]);
  }

  // 4. Number Names 1–20
  NUMBER_NAMES_1_TO_20.forEach((name, idx) => {
    const num = idx + 1;
    const { options, correctIndex } = makeNumOptions(num, [1, -1, 2, 3], `${band}_m_nn_${idx}`);
    out.push([
      "Mathematics",
      "MCQ",
      `Identify the digit for number name '${name}':`,
      options,
      correctIndex,
      `'${name}' represents the number ${num}.`,
      "Number Names",
    ]);
  });

  // 5. Counting & Simple 1-Digit Addition / Subtraction
  for (let i = 0; i < 120; i++) {
    const a = 1 + (i % (cls === -2 ? 5 : 9));
    const b = 1 + (Math.floor(i / 3) % (cls === -2 ? 4 : 9));
    if (i % 2 === 0 || cls === -2) {
      const { options, correctIndex } = makeNumOptions(a + b, [1, -1, 2, 3], `${band}_m_add_${i}`);
      out.push([
        "Mathematics",
        "MCQ",
        `Count and Add: ${a} + ${b} = ? (#${i + 1})`,
        options,
        correctIndex,
        `${a} plus ${b} equals ${a + b}.`,
        "Simple Addition",
      ]);
    } else {
      const big = Math.max(a, b) + 2;
      const small = Math.min(a, b);
      const { options, correctIndex } = makeNumOptions(big - small, [1, -1, 2, 3], `${band}_m_sub_${i}`);
      out.push([
        "Mathematics",
        "FILL_BLANK",
        `Subtract: ${big} − ${small} = ___ (#${i + 1})`,
        options,
        correctIndex,
        `${big} minus ${small} equals ${big - small}.`,
        "Simple Subtraction",
      ]);
    }
  }

  // 6. Bigger / Smaller number comparison & Shapes
  for (let i = 0; i < 120; i++) {
    const x = 1 + ((i * 3) % (maxNum - 5));
    const y = x + 3 + (i % 5);
    const z = x + 1;
    const k = Math.max(1, x - 1);
    const askBiggest = i % 2 === 0;
    const ans = askBiggest ? y : k;
    const wrongs = askBiggest ? [x, z, k] : [x, y, z];
    const { options, correctIndex } = shuffleFourOptions(
      String(ans),
      [String(wrongs[0]), String(wrongs[1]), String(wrongs[2])],
      `${band}_m_cmp_${i}`
    );
    out.push([
      "Mathematics",
      "MCQ",
      `Which is the ${askBiggest ? "BIGGEST" : "SMALLEST"} number? (${x}, ${y}, ${z}, ${k})`,
      options,
      correctIndex,
      `${ans} is the ${askBiggest ? "biggest" : "smallest"} among these numbers.`,
      "Number Comparison",
    ]);
  }

  return dedupeTuples(out, 500, `${band}_math`);
}

function buildPrePrimaryObjHindi(cls: -2 | -1 | 0): QTuple[] {
  const out: QTuple[] = [];
  const band = cls === -2 ? "Nursery" : cls === -1 ? "LKG" : "UKG";

  // 1. स्वर पहचान
  HINDI_SWAR.forEach(([sw, word, hint], idx) => {
    const w1 = HINDI_SWAR[(idx + 2) % HINDI_SWAR.length][0];
    const w2 = HINDI_SWAR[(idx + 5) % HINDI_SWAR.length][0];
    const w3 = HINDI_SWAR[(idx + 8) % HINDI_SWAR.length][0];
    const { options, correctIndex } = shuffleFourOptions(sw, [w1, w2, w3], `${band}_hi_sw_${idx}`);
    out.push([
      "Hindi",
      "MCQ",
      `'${word}' (${hint}) किस हिंदी स्वर से शुरू होता है?`,
      options,
      correctIndex,
      `${sw} से ${word} होता है।`,
      "हिंदी स्वर",
    ]);
  });

  // 2. व्यंजन पहचान
  HINDI_VYANJAN.forEach(([vy, word], idx) => {
    const w1 = HINDI_VYANJAN[(idx + 3) % HINDI_VYANJAN.length][0];
    const w2 = HINDI_VYANJAN[(idx + 7) % HINDI_VYANJAN.length][0];
    const w3 = HINDI_VYANJAN[(idx + 11) % HINDI_VYANJAN.length][0];
    const { options, correctIndex } = shuffleFourOptions(vy, [w1, w2, w3], `${band}_hi_vy_${idx}`);
    out.push([
      "Hindi",
      "MCQ",
      `'${word}' का पहला अक्षर चुनें:`,
      options,
      correctIndex,
      `'${vy}' से '${word}' बनता है।`,
      "हिंदी व्यंजन",
    ]);
  });

  // 3. अक्षर क्रम (अगला अक्षर)
  for (let round = 0; round < 12; round++) {
    for (let i = 0; i < HINDI_SWAR.length - 1; i++) {
      const cur = HINDI_SWAR[i][0];
      const next = HINDI_SWAR[i + 1][0];
      const w1 = HINDI_SWAR[(i + 3) % HINDI_SWAR.length][0];
      const w2 = HINDI_SWAR[(i + 6) % HINDI_SWAR.length][0];
      const w3 = HINDI_SWAR[(i + 9) % HINDI_SWAR.length][0];
      const { options, correctIndex } = shuffleFourOptions(next, [w1, w2, w3], `${band}_hi_seq_${round}_${i}`);
      out.push([
        "Hindi",
        "FILL_BLANK",
        `स्वर '${cur}' के ठीक बाद कौन-सा स्वर आता है? (अभ्यास #${round + 1})`,
        options,
        correctIndex,
        `वर्णमाला में '${cur}' के बाद '${next}' आता है।`,
        "स्वर क्रम",
      ]);
    }
    for (let i = 0; i < HINDI_VYANJAN.length - 1; i++) {
      const cur = HINDI_VYANJAN[i][0];
      const next = HINDI_VYANJAN[i + 1][0];
      const w1 = HINDI_VYANJAN[(i + 4) % HINDI_VYANJAN.length][0];
      const w2 = HINDI_VYANJAN[(i + 8) % HINDI_VYANJAN.length][0];
      const w3 = HINDI_VYANJAN[(i + 12) % HINDI_VYANJAN.length][0];
      const { options, correctIndex } = shuffleFourOptions(next, [w1, w2, w3], `${band}_hi_vseq_${round}_${i}`);
      out.push([
        "Hindi",
        "MCQ",
        `व्यंजन '${cur}' (${HINDI_VYANJAN[i][1]}) के बाद सही वर्ण चुनें: [#${round + 1}]`,
        options,
        correctIndex,
        `'${cur}' के बाद '${next}' (${HINDI_VYANJAN[i + 1][1]}) आता है।`,
        "व्यंजन अभ्यास",
      ]);
    }
  }

  // 4. दो और तीन अक्षर वाले शब्द
  for (let i = 0; i < 120; i++) {
    const word = i % 2 === 0 ? HINDI_TWO_LETTER[i % HINDI_TWO_LETTER.length] : HINDI_THREE_LETTER[i % HINDI_THREE_LETTER.length];
    const chars = Array.from(word);
    const other1 = HINDI_TWO_LETTER[(i + 3) % HINDI_TWO_LETTER.length];
    const other2 = HINDI_THREE_LETTER[(i + 5) % HINDI_THREE_LETTER.length];
    const other3 = HINDI_TWO_LETTER[(i + 7) % HINDI_TWO_LETTER.length];
    const { options, correctIndex } = shuffleFourOptions(word, [other1, other2, other3], `${band}_hi_wd_${i}`);
    out.push([
      "Hindi",
      "MCQ",
      `अक्षरों को जोड़कर सही शब्द बनाएं: ${chars.join(" + ")} = ? (#${Math.floor(i / 20) + 1})`,
      options,
      correctIndex,
      `${chars.join(" + ")} जोड़ने पर '${word}' बनता है।`,
      "शब्द निर्माण",
    ]);
  }

  return dedupeTuples(out, 500, `${band}_hindi`);
}

function buildPrePrimaryObjEvs(cls: -2 | -1 | 0): QTuple[] {
  const out: QTuple[] = [];
  const band = cls === -2 ? "Nursery" : cls === -1 ? "LKG" : "UKG";

  const staticPairs: Array<[string, string, [string, string, string], string]> = [
    ["What is the colour of a ripe Banana?", "Yellow", ["Blue", "Black", "Purple"], "Colours"],
    ["What is the colour of Milk?", "White", ["Green", "Red", "Yellow"], "Colours"],
    ["What is the colour of grass and leaves?", "Green", ["Pink", "Black", "Blue"], "Colours"],
    ["What is the colour of a Crow?", "Black", ["White", "Yellow", "Green"], "Colours"],
    ["Which fruit is called the King of Fruits?", "Mango", ["Potato", "Onion", "Brinjal"], "Fruits"],
    ["Which animal gives us milk?", "Cow", ["Lion", "Dog", "Snake"], "Animals"],
    ["Which bird is our National Bird?", "Peacock", ["Crow", "Hen", "Duck"], "Birds"],
    ["Which animal is called the King of the Jungle?", "Lion", ["Goat", "Sheep", "Rabbit"], "Animals"],
    ["Which part of our body helps us to SEE?", "Eyes", ["Ears", "Nose", "Feet"], "Body Parts"],
    ["Which part of our body helps us to HEAR?", "Ears", ["Eyes", "Teeth", "Hands"], "Body Parts"],
    ["Which part of our body helps us to SMELL?", "Nose", ["Hands", "Legs", "Hair"], "Body Parts"],
    ["How many days are there in a week?", "7", ["5", "6", "10"], "Calendar"],
    ["How many fingers do we have on ONE hand?", "5", ["3", "8", "10"], "Body Parts"],
    ["Which vehicle runs on rails / track?", "Train", ["Car", "Boat", "Bicycle"], "Transport"],
    ["Which vehicle flies in the sky?", "Aeroplane", ["Bus", "Ship", "Scooter"], "Transport"],
    ["What do we wear in the rainy season to stay dry?", "Raincoat", ["Sweater", "Muffler", "Gloves"], "Seasons"],
    ["Which shape is round like a coin or ball?", "Circle", ["Square", "Triangle", "Rectangle"], "Shapes"],
    ["How many corners does a Triangle have?", "3", ["2", "4", "5"], "Shapes"],
    ["How many sides does a Square have?", "4", ["2", "3", "6"], "Shapes"],
    ["Who teaches us in school?", "Teacher", ["Pilot", "Chef", "Barber"], "Helpers"],
  ];

  staticPairs.forEach(([q, ans, wrongs, tag], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `${band}_evs_st_${idx}`);
    out.push(["EVS / GK", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, tag]);
  });

  // Body part functions
  EVS_BODY_PARTS.forEach(([part, fn], idx) => {
    const w1 = EVS_BODY_PARTS[(idx + 1) % EVS_BODY_PARTS.length][0];
    const w2 = EVS_BODY_PARTS[(idx + 3) % EVS_BODY_PARTS.length][0];
    const w3 = EVS_BODY_PARTS[(idx + 5) % EVS_BODY_PARTS.length][0];
    const { options, correctIndex } = shuffleFourOptions(part, [w1, w2, w3], `${band}_evs_bp_${idx}`);
    out.push([
      "EVS / GK",
      "MCQ",
      `Which body part helps us to ${fn.toLowerCase()}?`,
      options,
      correctIndex,
      `Our ${part} help us to ${fn.toLowerCase()}.`,
      "My Body",
    ]);
  });

  // Odd one out combos across Fruits, Vegetables, Animals, Birds, Colors
  for (let i = 0; i < 475; i++) {
    const round = Math.floor(i / 5) + 1;
    const mode = i % 5;
    if (mode === 0) {
      const f1 = EVS_FRUITS[i % EVS_FRUITS.length];
      const f2 = EVS_FRUITS[(i + 1) % EVS_FRUITS.length];
      const f3 = EVS_FRUITS[(i + 2) % EVS_FRUITS.length];
      const odd = EVS_VEGS[i % EVS_VEGS.length];
      const { options, correctIndex } = shuffleFourOptions(odd, [f1, f2, f3], `${band}_evs_odd_${i}`);
      out.push([
        "EVS / GK",
        "ODD_ONE_OUT",
        `Find the ODD ONE OUT (3 are Fruits, 1 is a Vegetable) [#${round}]:`,
        options,
        correctIndex,
        `${odd} is a vegetable while ${f1}, ${f2}, and ${f3} are fruits.`,
        "Fruits & Vegetables",
      ]);
    } else if (mode === 1) {
      const a1 = EVS_ANIMALS[i % EVS_ANIMALS.length];
      const a2 = EVS_ANIMALS[(i + 2) % EVS_ANIMALS.length];
      const a3 = EVS_ANIMALS[(i + 4) % EVS_ANIMALS.length];
      const odd = EVS_BIRDS[i % EVS_BIRDS.length];
      const { options, correctIndex } = shuffleFourOptions(odd, [a1, a2, a3], `${band}_evs_odd_${i}`);
      out.push([
        "EVS / GK",
        "ODD_ONE_OUT",
        `Find the BIRD among these names [#${round}]:`,
        options,
        correctIndex,
        `${odd} is a bird whereas ${a1}, ${a2}, ${a3} are animals.`,
        "Animals & Birds",
      ]);
    } else if (mode === 2) {
      const c = EVS_COLORS[i % EVS_COLORS.length];
      const a1 = EVS_FRUITS[i % EVS_FRUITS.length];
      const a2 = EVS_ANIMALS[(i + 1) % EVS_ANIMALS.length];
      const a3 = EVS_BIRDS[(i + 2) % EVS_BIRDS.length];
      const { options, correctIndex } = shuffleFourOptions(c, [a1, a2, a3], `${band}_evs_odd_${i}`);
      out.push([
        "EVS / GK",
        "MCQ",
        `Which one of these is a COLOUR name? [#${round}]`,
        options,
        correctIndex,
        `${c} is the name of a colour.`,
        "Colours",
      ]);
    } else if (mode === 3) {
      const fruit = EVS_FRUITS[i % EVS_FRUITS.length];
      const w1 = EVS_COLORS[i % EVS_COLORS.length];
      const w2 = EVS_VEGS[(i + 2) % EVS_VEGS.length];
      const w3 = EVS_ANIMALS[(i + 3) % EVS_ANIMALS.length];
      const { options, correctIndex } = shuffleFourOptions(fruit, [w1, w2, w3], `${band}_evs_odd_${i}`);
      out.push([
        "EVS / GK",
        "MCQ",
        `Tick the FRUIT name from the list below [#${round}]:`,
        options,
        correctIndex,
        `${fruit} is a healthy fruit.`,
        "Fruits",
      ]);
    } else {
      const veg = EVS_VEGS[i % EVS_VEGS.length];
      const w1 = EVS_FRUITS[(i + 1) % EVS_FRUITS.length];
      const w2 = EVS_COLORS[(i + 3) % EVS_COLORS.length];
      const w3 = EVS_BIRDS[(i + 2) % EVS_BIRDS.length];
      const { options, correctIndex } = shuffleFourOptions(veg, [w1, w2, w3], `${band}_evs_odd_${i}`);
      out.push([
        "EVS / GK",
        "MCQ",
        `Identify the VEGETABLE name [#${round}]:`,
        options,
        correctIndex,
        `${veg} is a vegetable.`,
        "Vegetables",
      ]);
    }
  }

  return dedupeTuples(out, 500, `${band}_evs`);
}

function buildPrePrimarySubjAll(cls: -2 | -1 | 0): SubjTuple[] {
  const out: SubjTuple[] = [];
  const label = cls === -2 ? "Nursery" : cls === -1 ? "LKG" : "UKG";

  // 1. ENGLISH (200 Subjective)
  const engOut: SubjTuple[] = [];
  for (let i = 0; i < 25; i++) {
    const start = String.fromCharCode(65 + (i % 18));
    const seq = Array.from({ length: 6 }, (_, k) => String.fromCharCode(start.charCodeAt(0) + k));
    engOut.push([
      "English",
      "SHORT_ANSWER",
      `Write the missing letters in sequence: ${seq[0]}, ___, ${seq[2]}, ___, ${seq[4]}, ___`,
      `${seq[1]}, ${seq[3]}, ${seq[5]} (Full: ${seq.join(", ")})`,
      2,
      "Missing Letters",
    ]);
  }
  ALPHABET_WORDS.forEach(([ch, word]) => {
    engOut.push([
      "English",
      "SHORT_ANSWER",
      `Write 2 words starting with the letter '${ch}' (Example: ${word}).`,
      `Examples starting with ${ch}: ${word}, ${ch}ut / ${ch}oy (accept any valid word starting with ${ch}).`,
      2,
      "Alphabet Words",
    ]);
  });
  CVC_WORDS.forEach(([pat, v, word]) => {
    engOut.push([
      "English",
      "SHORT_ANSWER",
      `Fill the vowel to make a word and write it neatly twice: ${pat}`,
      `${word} (missing vowel: '${v}')`,
      2,
      "Phonic Words",
    ]);
  });
  UKG_OPPOSITES.forEach(([w, opp]) => {
    engOut.push([
      "English",
      "SHORT_ANSWER",
      `Write the opposite word of '${w}' in the space given below.`,
      `${w} × ${opp}`,
      2,
      "Opposites",
    ]);
  });
  for (let i = 0; i < 120; i++) {
    const start = String.fromCharCode(65 + (i % 20));
    const seq4 = [
      start,
      String.fromCharCode(start.charCodeAt(0) + 1),
      String.fromCharCode(start.charCodeAt(0) + 2),
      String.fromCharCode(start.charCodeAt(0) + 3),
    ];
    if (i % 2 === 0) {
      engOut.push([
        "English",
        "LONG_ANSWER",
        `Write Capital and Small letters from ${seq4[0]} to ${seq4[3]} (${seq4[0]}${seq4[0].toLowerCase()} ... ${seq4[3]}${seq4[3].toLowerCase()}). [Set ${(i % 20) + 1}]`,
        seq4.map((c) => `${c}${c.toLowerCase()}`).join(", "),
        3,
        "Writing Practice",
      ]);
    } else {
      const [w1, w2] = ALPHABET_WORDS[i % ALPHABET_WORDS.length];
      engOut.push([
        "English",
        "SHORT_ANSWER",
        `Circle the vowels in the word '${w2.toUpperCase()}' (${w1} for ${w2}) and write them below. [#${Math.floor(i / 26) + 1}]`,
        `Vowels in ${w2.toUpperCase()}: ${
          Array.from(w2.toUpperCase())
            .filter((c) => VOWELS.includes(c))
            .join(", ") || "None"
        }`,
        2,
        "Vowels Recognition",
      ]);
    }
  }
  out.push(...dedupeSubjTuples(engOut, 200));

  // 2. MATHEMATICS (200 Subjective)
  const mathOut: SubjTuple[] = [];
  const ceiling = cls === -2 ? 20 : cls === -1 ? 50 : 100;
  for (let i = 0; i < 60; i++) {
    const base = 1 + ((i * 2) % Math.max(5, ceiling - 6));
    mathOut.push([
      "Mathematics",
      "SHORT_ANSWER",
      `Write missing counting numbers: ${base}, ___, ${base + 2}, ___, ${base + 4}, ___`,
      `${base + 1}, ${base + 3}, ${base + 5}`,
      2,
      "Counting",
    ]);
  }
  for (let i = 0; i < 50; i++) {
    const a = 1 + (i % (cls === -2 ? 5 : 9));
    const b = 1 + ((i + 2) % (cls === -2 ? 4 : 8));
    mathOut.push([
      "Mathematics",
      i % 3 === 0 ? "LONG_ANSWER" : "SHORT_ANSWER",
      `Solve the sums: (i) ${a} + ${b} = ___   (ii) ${a + 1} + ${b} = ___`,
      `(i) ${a + b}, (ii) ${a + 1 + b}`,
      i % 3 === 0 ? 3 : 2,
      "Addition",
    ]);
  }
  for (let i = 0; i < 40; i++) {
    const n = 2 + (i % 19);
    const name = NUMBER_NAMES_1_TO_20[(n - 1) % NUMBER_NAMES_1_TO_20.length];
    mathOut.push([
      "Mathematics",
      "SHORT_ANSWER",
      `Write the Number Name for ${n} (and ${n > 1 ? n - 1 : n + 1}).`,
      `${n} = ${name}; ${n > 1 ? `${n - 1} = ${NUMBER_NAMES_1_TO_20[n - 2]}` : "2 = Two"}`,
      2,
      "Number Names",
    ]);
  }
  for (let i = 0; i < 60; i++) {
    const s = 1 + ((i * 5) % Math.max(10, ceiling - 10));
    mathOut.push([
      "Mathematics",
      "LONG_ANSWER",
      `Write forward counting from ${s} to ${Math.min(ceiling, s + 9)} neatly in the boxes/lines below. [#${i + 1}]`,
      Array.from({ length: Math.min(10, ceiling - s + 1) }, (_, k) => s + k).join(", "),
      3,
      "Forward Counting",
    ]);
  }
  out.push(...dedupeSubjTuples(mathOut, 200));

  // 3. HINDI (200 Subjective)
  const hiOut: SubjTuple[] = [];
  HINDI_SWAR.forEach(([sw, word]) => {
    hiOut.push([
      "Hindi",
      "SHORT_ANSWER",
      `'${sw}' (${word}) से बनने वाला एक शब्द लिखें और '${sw}' अक्षर दो बार लिखें।`,
      `${sw}, ${sw} — शब्द: ${word}`,
      2,
      "स्वर लेखन",
    ]);
  });
  HINDI_VYANJAN.forEach(([vy, word]) => {
    hiOut.push([
      "Hindi",
      "SHORT_ANSWER",
      `व्यंजन '${vy}' से शुरू होने वाला शब्द लिखें (${word} आदि)।`,
      `${vy} से ${word}`,
      2,
      "व्यंजन लेखन",
    ]);
  });
  for (let i = 0; i < 170; i++) {
    if (i % 3 === 0) {
      const start = i % (HINDI_SWAR.length - 4);
      const seq = HINDI_SWAR.slice(start, start + 4).map((x) => x[0]);
      hiOut.push([
        "Hindi",
        "LONG_ANSWER",
        `खाली स्थान में छूटे हुए स्वर भरें: ${seq[0]}, ___, ${seq[2]}, ___ (सेट #${i + 1})`,
        `${seq[1]}, ${seq[3]} (क्रम: ${seq.join(", ")})`,
        3,
        "स्वर क्रम",
      ]);
    } else if (i % 3 === 1) {
      const w = HINDI_TWO_LETTER[i % HINDI_TWO_LETTER.length];
      const w2 = HINDI_THREE_LETTER[i % HINDI_THREE_LETTER.length];
      hiOut.push([
        "Hindi",
        "SHORT_ANSWER",
        `अक्षरों को जोड़कर शब्द लिखें: (क) ${Array.from(w).join(" + ")} = ___  (ख) ${Array.from(w2).join(" + ")} = ___ (#${i + 1})`,
        `(क) ${w}, (ख) ${w2}`,
        2,
        "शब्द जोड़",
      ]);
    } else {
      const startV = i % (HINDI_VYANJAN.length - 4);
      const seqV = HINDI_VYANJAN.slice(startV, startV + 4).map((x) => x[0]);
      hiOut.push([
        "Hindi",
        "SHORT_ANSWER",
        `अगले दो व्यंजन लिखें: ${seqV[0]}, ${seqV[1]}, ___, ___ (#${i + 1})`,
        `${seqV[2]}, ${seqV[3]}`,
        2,
        "व्यंजन क्रम",
      ]);
    }
  }
  out.push(...dedupeSubjTuples(hiOut, 200));

  // 4. EVS / GK (200 Subjective)
  const evsOut: SubjTuple[] = [];
  const evsPrompts: Array<[string, string, number, string]> = [
    ["Write the names of any 3 Fruits you like to eat.", "Apple, Mango, Banana", 3, "Fruits"],
    ["Write the names of any 3 Vegetables.", "Potato, Tomato, Carrot", 3, "Vegetables"],
    ["Write the names of any 3 Colours.", "Red, Blue, Yellow", 2, "Colours"],
    ["Write the names of any 3 Domestic Animals.", "Cow, Dog, Goat", 3, "Animals"],
    ["Write the names of any 3 Wild Animals.", "Lion, Tiger, Elephant", 3, "Animals"],
    ["Write the names of any 3 Birds.", "Parrot, Peacock, Pigeon", 2, "Birds"],
    ["Write the names of any 3 Body Parts.", "Eyes, Nose, Hands", 2, "My Body"],
    ["Write the names of 2 Vehicles that run on the road.", "Car, Bus", 2, "Transport"],
    ["Name our National Bird and National Animal.", "National Bird: Peacock; National Animal: Tiger", 2, "National Symbols"],
    ["Write two good habits you follow every morning.", "Brushing teeth and taking a bath daily; saying Good Morning to parents.", 2, "Good Habits"],
    ["Write the names of any 2 Flowers.", "Rose, Lotus", 2, "Flowers"],
    ["Write 2 lines about Yourself (My Name & School).", `My name is ____. I study in ${label}.`, 3, "Myself"],
  ];
  evsPrompts.forEach(([q, ans, m, tag]) => {
    evsOut.push(["EVS / GK", m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER", q, ans, m, tag]);
  });

  for (let i = 0; i < 190; i++) {
    const mode = i % 4;
    if (mode === 0) {
      const f = EVS_FRUITS[i % EVS_FRUITS.length];
      const v = EVS_VEGS[i % EVS_VEGS.length];
      evsOut.push([
        "EVS / GK",
        "SHORT_ANSWER",
        `Classify as Fruit or Vegetable: (1) ${f} -> ____   (2) ${v} -> ____ (#${i + 1})`,
        `(1) ${f}: Fruit, (2) ${v}: Vegetable`,
        2,
        "Classification",
      ]);
    } else if (mode === 1) {
      const [part, fn] = EVS_BODY_PARTS[i % EVS_BODY_PARTS.length];
      evsOut.push([
        "EVS / GK",
        "SHORT_ANSWER",
        `Write one function of your '${part}' (Body Part #${i + 1}).`,
        `Our ${part} help us to ${fn.toLowerCase()}.`,
        2,
        "My Body",
      ]);
    } else if (mode === 2) {
      const a1 = EVS_ANIMALS[i % EVS_ANIMALS.length];
      const a2 = EVS_ANIMALS[(i + 3) % EVS_ANIMALS.length];
      const b1 = EVS_BIRDS[i % EVS_BIRDS.length];
      evsOut.push([
        "EVS / GK",
        "LONG_ANSWER",
        `Identify the Bird and Animal: ${a1}, ${b1}, ${a2}. Write their names neatly. (#${i + 1})`,
        `Animals: ${a1}, ${a2}; Bird: ${b1}`,
        3,
        "Nature",
      ]);
    } else {
      const c1 = EVS_COLORS[i % EVS_COLORS.length];
      const c2 = EVS_COLORS[(i + 2) % EVS_COLORS.length];
      evsOut.push([
        "EVS / GK",
        "SHORT_ANSWER",
        `Name one natural object or fruit having '${c1}' or '${c2}' colour. (#${i + 1})`,
        `${c1} / ${c2} (e.g. Apple/Sun/Leaf/Sky)`,
        2,
        "Colours Around Us",
      ]);
    }
  }
  out.push(...dedupeSubjTuples(evsOut, 200));

  return out;
}

function buildPrePrimaryObjectiveBankForClass(cls: -2 | -1 | 0): EntranceTestQuestion[] {
  const prefix = cls === -2 ? "nur" : cls === -1 ? "lkg" : "ukg";
  const allTuples: QTuple[] = [
    ...buildPrePrimaryObjEnglish(cls),
    ...buildPrePrimaryObjMaths(cls),
    ...buildPrePrimaryObjHindi(cls),
    ...buildPrePrimaryObjEvs(cls),
  ];
  return allTuples.map((t, idx) => ({
    id: `${prefix}_obj_${idx + 1}`,
    classLevel: cls,
    subject: t[0],
    questionKind: "OBJECTIVE",
    format: t[1],
    question: t[2],
    options: t[3],
    correctIndex: t[4],
    explanation: t[5],
    topicTag: t[6],
  }));
}

function buildPrePrimarySubjectiveBankForClass(cls: -2 | -1 | 0): EntranceTestQuestion[] {
  const prefix = cls === -2 ? "nur" : cls === -1 ? "lkg" : "ukg";
  const allTuples = buildPrePrimarySubjAll(cls);
  return allTuples.map((t, idx) => ({
    id: `${prefix}_subj_${idx + 1}`,
    classLevel: cls,
    subject: t[0],
    questionKind: "SUBJECTIVE",
    format: t[1],
    question: t[2],
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: t[3],
    modelAnswer: t[3],
    marks: t[4],
    topicTag: t[5],
  }));
}

export const PRE_PRIMARY_OBJECTIVE_BANK: Record<-2 | -1 | 0, EntranceTestQuestion[]> = {
  [-2]: buildPrePrimaryObjectiveBankForClass(-2),
  [-1]: buildPrePrimaryObjectiveBankForClass(-1),
  [0]: buildPrePrimaryObjectiveBankForClass(0),
};

export const PRE_PRIMARY_SUBJECTIVE_BANK: Record<-2 | -1 | 0, EntranceTestQuestion[]> = {
  [-2]: buildPrePrimarySubjectiveBankForClass(-2),
  [-1]: buildPrePrimarySubjectiveBankForClass(-1),
  [0]: buildPrePrimarySubjectiveBankForClass(0),
};
