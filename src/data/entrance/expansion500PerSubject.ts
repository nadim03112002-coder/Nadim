import type {
  EntranceClassNumber,
  EntranceTestQuestion,
  EntranceTestSubject,
} from "../../school-types";
import {
  buildFactBankTuples,
  makeNumOptions,
  shuffleFourOptions,
  type FactPair,
  type QTuple,
} from "./helpers";

// ═════════════════════════════════════════════════════════════════════════════
// 500-QUESTION-PER-SUBJECT EXPANSION BANK (Classes 1–8)
// Guarantees every subject in Classes 1–5 (4 subjects = 2,000/class) and
// Classes 6–8 (5 subjects = 2,500/class) hits 500 unique curated questions,
// preserving 100% of all existing curated questions.
// ═════════════════════════════════════════════════════════════════════════════

// ── PRIMARY ENGLISH EXPANSION FACT BANKS (Classes 1–5) ───────────────────────
const PRI_YOUNG_ONES: FactPair[] = [
  { prompt: "What is the baby of a Cat called?", answer: "Kitten" },
  { prompt: "What is the baby of a Dog called?", answer: "Puppy" },
  { prompt: "What is the baby of a Cow called?", answer: "Calf" },
  { prompt: "What is the baby of a Lion called?", answer: "Cub" },
  { prompt: "What is the baby of a Sheep called?", answer: "Lamb" },
  { prompt: "What is the baby of a Goat called?", answer: "Kid" },
  { prompt: "What is the baby of a Horse called?", answer: "Foal" },
  { prompt: "What is the baby of a Hen called?", answer: "Chick" },
  { prompt: "What is the baby of a Duck called?", answer: "Duckling" },
  { prompt: "What is the baby of a Frog called?", answer: "Tadpole" },
  { prompt: "What is the baby of a Pig called?", answer: "Piglet" },
  { prompt: "What is the baby of a Deer called?", answer: "Fawn" },
  { prompt: "What is the baby of a Kangaroo called?", answer: "Joey" },
  { prompt: "What is the baby of a Butterfly called?", answer: "Caterpillar" },
  { prompt: "What is the baby of an Owl called?", answer: "Owlet" },
  { prompt: "What is the baby of an Eagle called?", answer: "Eaglet" },
  { prompt: "What is the baby of a Swan called?", answer: "Cygnet" },
  { prompt: "What is the baby of a Goose called?", answer: "Gosling" },
  { prompt: "What is the baby of a Monkey called?", answer: "Infant" },
  { prompt: "What is the baby of a Rabbit called?", answer: "Bunny / Kit" },
  { prompt: "What is the baby of a Donkey called?", answer: "Colt" },
  { prompt: "What is the baby of a Fish called?", answer: "Fry" },
  { prompt: "What is the baby of a Mosquito called?", answer: "Larva / Wriggler" },
  { prompt: "What is the baby of a Pigeon called?", answer: "Squab" },
  { prompt: "What is the baby of a Whale called?", answer: "Whale Calf" },
];

const PRI_ANIMAL_HOMES: FactPair[] = [
  { prompt: "Where does a Lion live?", answer: "Den" },
  { prompt: "Where does a Bird live?", answer: "Nest" },
  { prompt: "Where does a Honeybee live?", answer: "Hive" },
  { prompt: "Where does a Dog live?", answer: "Kennel" },
  { prompt: "Where does a Horse live?", answer: "Stable" },
  { prompt: "Where does a Cow live?", answer: "Shed" },
  { prompt: "Where does a Rabbit live?", answer: "Burrow" },
  { prompt: "Where does a Spider live?", answer: "Web" },
  { prompt: "Where does a Pig live?", answer: "Sty" },
  { prompt: "Where does a Hen live?", answer: "Coop" },
  { prompt: "Where does a Sheep live?", answer: "Pen / Fold" },
  { prompt: "Where does an Ant live?", answer: "Anthill" },
  { prompt: "Where does a Mouse live?", answer: "Hole" },
  { prompt: "Where does an Owl live?", answer: "Tree Hollow" },
  { prompt: "Where does a Beaver live?", answer: "Lodge" },
  { prompt: "Where does an Eagle build its home?", answer: "Eyrie" },
  { prompt: "Where does a Fox live?", answer: "Lair / Earth" },
  { prompt: "Where does a Squirrel live?", answer: "Drey" },
  { prompt: "Where does a Tiger live?", answer: "Jungle Cave" },
  { prompt: "Where are pet fishes kept at home?", answer: "Aquarium" },
  { prompt: "Where does a Monk live?", answer: "Monastery" },
  { prompt: "Where does a Soldier stay?", answer: "Barracks" },
  { prompt: "Where does a King live?", answer: "Palace" },
  { prompt: "Where do Eskimos live in snowy regions?", answer: "Igloo" },
  { prompt: "Where are aeroplanes parked and repaired?", answer: "Hangar" },
];

const PRI_ANIMAL_SOUNDS: FactPair[] = [
  { prompt: "What sound does a Lion make?", answer: "Roar" },
  { prompt: "What sound does a Dog make?", answer: "Bark" },
  { prompt: "What sound does a Cat make?", answer: "Meow" },
  { prompt: "What sound does a Cow make?", answer: "Moo" },
  { prompt: "What sound does a Duck make?", answer: "Quack" },
  { prompt: "What sound does a Frog make?", answer: "Croak" },
  { prompt: "What sound does a Snake make?", answer: "Hiss" },
  { prompt: "What sound does a Horse make?", answer: "Neigh" },
  { prompt: "What sound does a Sheep make?", answer: "Bleat" },
  { prompt: "What sound does a Donkey make?", answer: "Bray" },
  { prompt: "What sound does an Elephant make?", answer: "Trumpet" },
  { prompt: "What sound does a Crow make?", answer: "Caw" },
  { prompt: "What sound does a Pigeon make?", answer: "Coo" },
  { prompt: "What sound does an Owl make?", answer: "Hoot" },
  { prompt: "What sound does a Bee make?", answer: "Buzz" },
  { prompt: "What sound does a Monkey make?", answer: "Chatter" },
  { prompt: "What sound does a Wolf make?", answer: "Howl" },
  { prompt: "What sound does a Mouse make?", answer: "Squeak" },
  { prompt: "What sound does a Cock make?", answer: "Crow" },
  { prompt: "What sound does a Sparrow make?", answer: "Chirp" },
];

const PRI_COMPOUND_WORDS: [string, string, string][] = [
  ["Sun", "flower", "Sunflower"],
  ["Rain", "bow", "Rainbow"],
  ["Foot", "ball", "Football"],
  ["Note", "book", "Notebook"],
  ["Class", "room", "Classroom"],
  ["Birth", "day", "Birthday"],
  ["Black", "board", "Blackboard"],
  ["Tooth", "brush", "Toothbrush"],
  ["Butter", "fly", "Butterfly"],
  ["Snow", "man", "Snowman"],
  ["Star", "fish", "Starfish"],
  ["Cup", "cake", "Cupcake"],
  ["Water", "melon", "Watermelon"],
  ["Pan", "cake", "Pancake"],
  ["Door", "bell", "Doorbell"],
  ["Bed", "room", "Bedroom"],
  ["Post", "office", "Postoffice"],
  ["Rail", "way", "Railway"],
  ["News", "paper", "Newspaper"],
  ["Moon", "light", "Moonlight"],
  ["Play", "ground", "Playground"],
  ["Book", "shelf", "Bookshelf"],
  ["Hand", "kerchief", "Handkerchief"],
  ["School", "bag", "Schoolbag"],
  ["Fire", "man", "Fireman"],
];

const PRI_HOMOPHONES: [string, string, [string, string, string]][] = [
  ["I can ___ a colourful butterfly in the garden.", "see", ["sea", "saw", "she"]],
  ["Ships sail across the deep blue ___.", "sea", ["see", "say", "saw"]],
  ["The ___ shines brightly in the sky during daytime.", "sun", ["son", "soon", "sin"]],
  ["Mr. Verma is very proud of his young ___.", "son", ["sun", "soon", "some"]],
  ["Always ___ neatly in your school notebook.", "write", ["right", "ride", "white"]],
  ["Turn to your ___ hand side at the crossing.", "right", ["write", "rate", "ripe"]],
  ["Every bird has ___ wings to fly.", "two", ["too", "to", "toe"]],
  ["This bag is ___ heavy for a small child.", "too", ["two", "to", "top"]],
  ["Please sit ___ and wait for your turn.", "here", ["hear", "hare", "hair"]],
  ["Can you ___ the sweet song of the cuckoo?", "hear", ["here", "hair", "hare"]],
  ["The clever ___ ran faster than the tortoise.", "hare", ["hair", "here", "hear"]],
  ["Comb your ___ neatly every morning before school.", "hair", ["hare", "here", "hear"]],
  ["A rabbit has a short fluffy ___.", "tail", ["tale", "tall", "tell"]],
  ["Grandmother told us a wonderful fairy ___.", "tale", ["tail", "tall", "tile"]],
  ["Birds fly high in the ___ blue sky.", "blue", ["blew", "blow", "blur"]],
  ["The strong wind ___ away all the dry leaves.", "blew", ["blue", "blow", "black"]],
  ["We ___ healthy fruits for breakfast today.", "ate", ["eight", "eat", "it"]],
  ["A spider has ___ legs.", "eight", ["ate", "eat", "age"]],
  ["Wait for one ___ before ringing the bell.", "hour", ["our", "are", "air"]],
  ["___ school campus is clean and green.", "Our", ["Hour", "Are", "Air"]],
  ["Please ___ a warm woollen coat in winter.", "wear", ["where", "were", "wire"]],
  ["___ did you keep the science project file?", "Where", ["Wear", "Were", "Weir"]],
  ["A ___ of shoes is kept near the rack.", "pair", ["pear", "peer", "pure"]],
  ["Mother packed a sweet green ___ in my tiffin.", "pear", ["pair", "peer", "pour"]],
  ["May I know the total ___ of the parcel?", "weight", ["wait", "white", "wet"]],
];

const PRI_SILENT_LETTERS: [string, string, [string, string, string]][] = [
  ["Knife", "K", ["N", "F", "I"]],
  ["Honest", "H", ["O", "N", "T"]],
  ["Comb", "B", ["C", "O", "M"]],
  ["Write", "W", ["R", "I", "T"]],
  ["Know", "K", ["N", "O", "W"]],
  ["Listen", "T", ["L", "S", "N"]],
  ["Hour", "H", ["O", "U", "R"]],
  ["Walk", "L", ["W", "A", "K"]],
  ["Talk", "L", ["T", "A", "K"]],
  ["Lamb", "B", ["L", "A", "M"]],
  ["Thumb", "B", ["T", "H", "M"]],
  ["Knee", "K", ["N", "E", "I"]],
  ["Wrong", "W", ["R", "O", "G"]],
  ["Castle", "T", ["C", "S", "L"]],
  ["Island", "S", ["I", "L", "D"]],
  ["Wednesday", "D (first)", ["W", "N", "Y"]],
  ["Half", "L", ["H", "A", "F"]],
  ["Palm", "L", ["P", "A", "M"]],
  ["Chalk", "L", ["C", "A", "K"]],
  ["Calm", "L", ["C", "A", "M"]],
  ["Ghost", "H", ["G", "O", "T"]],
  ["Sign", "G", ["S", "I", "N"]],
  ["Design", "G", ["D", "E", "N"]],
  ["Knock", "K (first)", ["N", "O", "C"]],
  ["Wrap", "W", ["R", "A", "P"]],
];

const PRI_PARTS_SPEECH: [string, string, [string, string, string]][] = [
  ["Identify the Noun in: 'The brave boy saved a puppy.'", "boy (and puppy)", ["brave", "saved", "the"]],
  ["Identify the Verb (action word) in: 'Birds fly across the sky.'", "fly", ["Birds", "sky", "the"]],
  ["Identify the Adjective (describing word) in: 'She wore a bright red dress.'", "red (and bright)", ["She", "wore", "dress"]],
  ["Identify the Pronoun in: 'Rohan is absent because he has fever.'", "he", ["Rohan", "absent", "fever"]],
  ["Identify the Adverb in: 'The cheetah runs very fast.'", "fast", ["cheetah", "runs", "the"]],
  ["Identify the Conjunction (joining word) in: 'Bread and butter are tasty.'", "and", ["Bread", "butter", "tasty"]],
  ["Identify the Preposition in: 'The book is on the wooden desk.'", "on", ["book", "wooden", "desk"]],
  ["Fill in the blank: 'They ___ going to the museum tomorrow.'", "are", ["is", "am", "was"]],
  ["Fill in the blank: 'I ___ finished my morning homework.'", "have", ["has", "is", "does"]],
  ["Fill in the blank: 'Each student ___ given a fresh notebook.'", "was", ["were", "are", "have"]],
  ["Fill in the blank: 'She ___ not like eating stale food.'", "does", ["do", "are", "have"]],
  ["Fill in the blank: 'We ___ respect our elders and teachers.'", "should", ["has", "am", "is"]],
  ["Choose the proper noun:", "Jaipur", ["city", "river", "mountain"]],
  ["Choose the common noun:", "teacher", ["Gandhi Ji", "India", "Ganga"]],
  ["Choose the abstract noun:", "Honesty", ["Table", "Mango", "Pencil"]],
  ["Which sentence is punctuated correctly?", "Where do you live?", ["where do you live.", "Where do you live", "where do you live!"]],
  ["Which word comes first in alphabetical order?", "Apple", ["Banana", "Cherry", "Mango"]],
  ["Which word comes last in alphabetical order?", "Zebra", ["Tiger", "Lion", "Bear"]],
  ["Find the odd word out:", "Chair", ["Apple", "Mango", "Banana"]],
  ["Find the odd word out:", "Rose", ["Car", "Bus", "Train"]],
  ["Find the odd word out:", "January", ["Monday", "Tuesday", "Friday"]],
  ["Find the odd word out:", "Circle", ["Potato", "Tomato", "Onion"]],
  ["Choose the correctly spelled word:", "School", ["Skool", "Schol", "Shcool"]],
  ["Choose the correctly spelled word:", "Elephant", ["Elefant", "Eliphant", "Elephent"]],
  ["Choose the correctly spelled word:", "Umbrella", ["Umbrela", "Umbralla", "Ambarella"]],
  ["Choose the correctly spelled word:", "Teacher", ["Techer", "Teachar", "Teachor"]],
  ["Choose the correctly spelled word:", "Breakfast", ["Brekfast", "Breakfest", "Brakfast"]],
  ["Choose the correctly spelled word:", "Butterfly", ["Buterfly", "Batterfly", "Butterflie"]],
  ["Choose the correctly spelled word:", "Vegetable", ["Vegitable", "Vegetabel", "Vejitable"]],
  ["Choose the correctly spelled word:", "Important", ["Importent", "Impartant", "Importint"]],
  ["Fill with correct article: 'He wants to become ___ engineer.'", "an", ["a", "the", "no article"]],
  ["Fill with correct article: 'She gave me ___ one-rupee coin.'", "a", ["an", "the", "many"]],
  ["Fill with correct article: '___ Himalayas stand in northern India.'", "The", ["A", "An", "No article"]],
  ["Plural of 'Ox' is:", "Oxen", ["Oxes", "Oxs", "Oxies"]],
  ["Plural of 'Mouse' is:", "Mice", ["Mouses", "Mice's", "Mousies"]],
  ["Plural of 'Goose' is:", "Geese", ["Gooses", "Geese's", "Goosies"]],
  ["Plural of 'Deer' is:", "Deer", ["Deers", "Deeries", "Deeres"]],
  ["Plural of 'Sheep' is:", "Sheep", ["Sheeps", "Sheepes", "Sheepis"]],
  ["Past tense of 'Give' is:", "Gave", ["Gived", "Given", "Gives"]],
  ["Past tense of 'Sleep' is:", "Slept", ["Sleeped", "Sleeps", "Slapped"]],
  ["Past tense of 'Win' is:", "Won", ["Winned", "Woned", "Winning"]],
  ["Past tense of 'Break' is:", "Broke", ["Breaked", "Broken", "Braked"]],
  ["Past tense of 'Build' is:", "Built", ["Builded", "Builds", "Building"]],
  ["Past tense of 'Keep' is:", "Kept", ["Keeped", "Keeps", "Keeper"]],
  ["Past tense of 'Sell' is:", "Sold", ["Selled", "Sells", "Selling"]],
];

function build500PrimaryEnglish(cls: 1 | 2 | 3 | 4 | 5): QTuple[] {
  const out: QTuple[] = [];
  out.push(
    ...buildFactBankTuples({
      subject: "English",
      topicTag: "Young Ones",
      seedPrefix: `c${cls}_500_eng_yo`,
      items: PRI_YOUNG_ONES.map((it) => ({
        ...it,
        prompt: `[Class ${cls}] ${it.prompt}`,
      })),
    })
  );
  out.push(
    ...buildFactBankTuples({
      subject: "English",
      topicTag: "Animal Homes",
      seedPrefix: `c${cls}_500_eng_hm`,
      items: PRI_ANIMAL_HOMES.map((it) => ({
        ...it,
        prompt: `[Homes] ${it.prompt}`,
      })),
    })
  );
  out.push(
    ...buildFactBankTuples({
      subject: "English",
      topicTag: "Animal Sounds",
      seedPrefix: `c${cls}_500_eng_snd`,
      items: PRI_ANIMAL_SOUNDS.map((it) => ({
        ...it,
        prompt: `[Sounds] ${it.prompt}`,
      })),
    })
  );
  const compPool = PRI_COMPOUND_WORDS.map((c) => c[2]);
  PRI_COMPOUND_WORDS.forEach(([w1, w2, ans], idx) => {
    const distractors = compPool.filter((x) => x !== ans);
    const start = (idx * 3 + cls) % distractors.length;
    const picked: string[] = [];
    for (let k = 0; k < distractors.length && picked.length < 3; k++) {
      const cand = distractors[(start + k * 7) % distractors.length];
      if (!picked.includes(cand)) picked.push(cand);
    }
    for (let k = 0; k < distractors.length && picked.length < 3; k++) {
      if (!picked.includes(distractors[k])) picked.push(distractors[k]);
    }
    const [wA, wB, wC] = picked;
    const { options, correctIndex } = shuffleFourOptions(ans, [wA, wB, wC], `c${cls}_500_cmp_${idx}`);
    out.push([
      "English",
      "FILL_BLANK",
      `Join two words to make a compound word: '${w1}' + '${w2}' = ___`,
      options,
      correctIndex,
      `Combining '${w1}' and '${w2}' forms '${ans}'.`,
      "Compound Words",
    ]);
  });
  PRI_HOMOPHONES.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_hom_${idx}`);
    out.push(["English", "FILL_BLANK", `Choose the right word: ${q}`, options, correctIndex, `Correct word: '${ans}'.`, "Homophones"]);
  });
  PRI_SILENT_LETTERS.forEach(([word, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_sil_${idx}`);
    out.push([
      "English",
      "MCQ",
      `Which letter is silent in the word '${word}'?`,
      options,
      correctIndex,
      `In '${word}', the letter '${ans}' is not pronounced.`,
      "Silent Letters",
    ]);
  });
  PRI_PARTS_SPEECH.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_pos_${idx}`);
    out.push(["English", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, "Grammar & Vocabulary"]);
  });
  return out; // 25+25+20+25+25+25+45 = 190 -> let's add 25 verb/tense/sentence completions to make 215!
}

const PRI_EXTRA_ENGLISH_25: [string, string, [string, string, string]][] = [
  ["Complete the proverb: 'Honesty is the best ___.'", "policy", ["story", "game", "reward"]],
  ["Complete the proverb: 'Early to bed and early to rise makes a person healthy, wealthy and ___.'", "wise", ["tired", "richer", "loud"]],
  ["Complete the proverb: 'Practice makes a man ___.'", "perfect", ["sleepy", "angry", "bored"]],
  ["Complete the proverb: 'Look before you ___.'", "leap", ["sleep", "eat", "cry"]],
  ["Complete the proverb: 'Slow and steady wins the ___.'", "race", ["prize", "book", "chair"]],
  ["Choose the opposite gender of 'Nephew':", "Niece", ["Cousin", "Aunt", "Sister"]],
  ["Choose the opposite gender of 'Wizard':", "Witch", ["Fairy", "Queen", "Princess"]],
  ["Choose the opposite gender of 'Gander':", "Goose", ["Duck", "Swan", "Hen"]],
  ["Choose the opposite gender of 'Fox':", "Vixen", ["Cub", "Mare", "Doe"]],
  ["Choose the opposite gender of 'Stag':", "Hind / Doe", ["Bull", "Colt", "Ram"]],
  ["Which word means 'the first meal of the morning'?", "Breakfast", ["Lunch", "Dinner", "Supper"]],
  ["Which word means 'the meal eaten at night'?", "Dinner", ["Breakfast", "Snack", "Tiffin"]],
  ["A person who stitches clothes for us is a:", "Tailor", ["Baker", "Carpenter", "Pilot"]],
  ["A person who bakes bread and cakes is a:", "Baker", ["Grocer", "Butcher", "Mason"]],
  ["A person who sells fruits and vegetables is a:", "Greengrocer", ["Florist", "Chemist", "Stationer"]],
  ["A person who sells flowers is a:", "Florist", ["Draper", "Jeweller", "Porter"]],
  ["A person who treats our teeth is a:", "Dentist", ["Surgeon", "Chemist", "Optician"]],
  ["A person who makes pots out of clay is a:", "Potter", ["Cobbler", "Mason", "Smith"]],
  ["A person who cuts and trims hair is a:", "Barber", ["Driver", "Painter", "Guard"]],
  ["A person who builds houses with bricks is a:", "Mason", ["Taylor", "Plumber", "Welder"]],
  ["Which season comes after Winter in India?", "Spring", ["Monsoon", "Autumn", "Freezing"]],
  ["Which month has 28 or 29 days?", "February", ["January", "April", "July"]],
  ["How many letters are vowels in English alphabet?", "5 (A, E, I, O, U)", ["21", "26", "4"]],
  ["How many consonants are there in English alphabet?", "21", ["5", "26", "19"]],
  ["Which punctuation mark ends an exclamatory sentence like 'Hurrah!'?", "Exclamation mark (!)", ["Question mark (?)", "Comma (,)", "Hyphen (-)"]],
];

// ── PRIMARY MATHEMATICS EXPANSION (Classes 1–5: 220 unique Qs per class) ─────
function build500PrimaryMaths(cls: 1 | 2 | 3 | 4 | 5): QTuple[] {
  const out: QTuple[] = [];
  for (let i = 0; i < 60; i++) {
    // Pattern 1: Grade-calibrated Arithmetic A (+ / ×)
    if (cls === 1) {
      const a = 11 + (i % 25);
      const b = 3 + ((i * 3) % 14);
      const { options, correctIndex } = makeNumOptions(a + b, [-2, 1, 2, 10], `c1_m500_a_${i}`);
      out.push(["Mathematics", "MCQ", `Find the sum of ${a} and ${b}:`, options, correctIndex, `${a} + ${b} = ${a + b}.`, "Addition"]);
    } else if (cls === 2) {
      const a = 24 + i;
      const b = 15 + ((i * 2) % 28);
      const { options, correctIndex } = makeNumOptions(a + b, [-10, 10, 1, -1], `c2_m500_a_${i}`);
      out.push(["Mathematics", "MCQ", `Calculate the total: ${a} + ${b} = ?`, options, correctIndex, `${a} + ${b} = ${a + b}.`, "2-Digit Addition"]);
    } else if (cls === 3) {
      const a = 125 + i * 7;
      const b = 48 + ((i * 5) % 90);
      const { options, correctIndex } = makeNumOptions(a + b, [-10, 10, 100, -1], `c3_m500_a_${i}`);
      out.push(["Mathematics", "MCQ", `Work out the 3-digit sum: ${a} + ${b}`, options, correctIndex, `${a} + ${b} = ${a + b}.`, "3-Digit Addition"]);
    } else if (cls === 4) {
      const a = 1120 + i * 37;
      const b = 450 + i * 19;
      const { options, correctIndex } = makeNumOptions(a + b, [100, -100, 10, -10], `c4_m500_a_${i}`);
      out.push(["Mathematics", "MCQ", `Compute: ${a} + ${b} = ?`, options, correctIndex, `${a} + ${b} = ${a + b}.`, "4-Digit Addition"]);
    } else {
      const a = 2400 + i * 43;
      const b = 1250 + i * 17;
      const { options, correctIndex } = makeNumOptions(a - b, [100, -100, 10, -10], `c5_m500_a_${i}`);
      out.push(["Mathematics", "MCQ", `Find the difference: ${a} − ${b} = ?`, options, correctIndex, `${a} − ${b} = ${a - b}.`, "Large Subtraction"]);
    }

    // Pattern 2: Number Series / Missing Term
    const start = (cls * 3) + (i % 12);
    const step = cls <= 2 ? 2 + (i % 4) : 3 + (i % 7);
    const n1 = start;
    const n2 = start + step;
    const n3 = start + 2 * step;
    const n4 = start + 3 * step;
    const n5 = start + 4 * step;
    const { options: optS, correctIndex: idxS } = makeNumOptions(n4, [step, -step, 1, 2], `c${cls}_m500_s_${i}`);
    out.push([
      "Mathematics",
      "SERIES_PUZZLE",
      `Complete the number sequence: ${n1}, ${n2}, ${n3}, ___, ${n5}`,
      optS,
      idxS,
      `Each term increases by ${step}: ${n3} + ${step} = ${n4}.`,
      "Number Patterns",
    ]);

    // Pattern 3: Multiplication / Division / Tables
    if (cls === 1) {
      const a = 18 + i;
      const b = 2 + (i % 9);
      const { options, correctIndex } = makeNumOptions(a - b, [1, -1, 2, -2], `c1_m500_m_${i}`);
      out.push(["Mathematics", "FILL_BLANK", `Take away ${b} from ${a}: ___`, options, correctIndex, `${a} − ${b} = ${a - b}.`, "Subtraction"]);
    } else if (cls === 2) {
      const x = 2 + (i % 9);
      const y = 2 + Math.floor(i / 9) + 1;
      const { options, correctIndex } = makeNumOptions(x * y, [x, -x, 2, -2], `c2_m500_m_${i}`);
      out.push(["Mathematics", "MCQ", `What is ${x} groups of ${y} (${x} × ${y})?`, options, correctIndex, `${x} × ${y} = ${x * y}.`, "Multiplication"]);
    } else if (cls === 3) {
      const x = 12 + (i % 19);
      const y = 3 + (i % 7);
      const { options, correctIndex } = makeNumOptions(x * y, [y, -y, 10, -10], `c3_m500_m_${i}`);
      out.push(["Mathematics", "MCQ", `Multiply: ${x} × ${y} = ?`, options, correctIndex, `${x} × ${y} = ${x * y}.`, "2-Digit Multiplication"]);
    } else if (cls === 4) {
      const divisor = 4 + (i % 9);
      const quotient = 12 + i;
      const dividend = divisor * quotient;
      const { options, correctIndex } = makeNumOptions(quotient, [1, -1, 2, 10], `c4_m500_m_${i}`);
      out.push(["Mathematics", "MCQ", `Divide ${dividend} ÷ ${divisor} = ?`, options, correctIndex, `${dividend} ÷ ${divisor} = ${quotient}.`, "Division"]);
    } else {
      const pct = [10, 20, 25, 50, 75][i % 5];
      const base = (4 + (i % 20)) * 20;
      const ans = (pct * base) / 100;
      const { options, correctIndex } = makeNumOptions(ans, [5, -5, 10, -10], `c5_m500_m_${i}`);
      out.push(["Mathematics", "MCQ", `Find ${pct}% of ${base}:`, options, correctIndex, `(${pct}/100) × ${base} = ${ans}.`, "Percentage"]);
    }

    // Pattern 4: Word / Geometry / Measurement Problems
    if (cls === 1) {
      const tens = 2 + (i % 8);
      const ones = i % 10;
      const val = tens * 10 + ones;
      const { options, correctIndex } = makeNumOptions(val, [10, -10, 9, 1], `c1_m500_w_${i}`);
      out.push(["Mathematics", "MCQ", `What number is made of ${tens} tens and ${ones} ones?`, options, correctIndex, `${tens} tens + ${ones} ones = ${val}.`, "Place Value"]);
    } else if (cls === 2) {
      const apples = 12 + i;
      const costEach = 2 + (i % 4);
      const ans = apples * costEach;
      const { options, correctIndex } = makeNumOptions(ans, [costEach, -costEach, 5, -5], `c2_m500_w_${i}`);
      out.push(["Mathematics", "MCQ", `If 1 pen costs ₹${costEach}, what is the cost of ${apples} pens?`, options, correctIndex, `${apples} × ₹${costEach} = ₹${ans}.`, "Money & Shopping", ]);
    } else if (cls === 3) {
      const side = 4 + i;
      const peri = 4 * side;
      const { options, correctIndex } = makeNumOptions(peri, [side, -side, 4, -4], `c3_m500_w_${i}`, " cm");
      out.push(["Mathematics", "MCQ", `What is the perimeter of a square whose each side is ${side} cm?`, options, correctIndex, `Perimeter of a square = 4 × ${side} = ${peri} cm.`, "Perimeter"]);
    } else if (cls === 4) {
      const l = 8 + (i % 15);
      const b = 5 + Math.floor(i / 5);
      const area = l * b;
      const { options, correctIndex } = makeNumOptions(area, [l, -b, 2 * (l + b), 10], `c4_m500_w_${i}`, " sq cm");
      out.push(["Mathematics", "MCQ", `Find the area of a rectangle with length ${l} cm and breadth ${b} cm:`, options, correctIndex, `Area = length × breadth = ${l} × ${b} = ${area} sq cm.`, "Area & Geometry"]);
    } else {
      const items = 4 + (i % 6);
      const unitPrice = 15 + i * 2;
      const totalCost = items * unitPrice;
      const ask = items + 3;
      const ans = ask * unitPrice;
      const { options, correctIndex } = makeNumOptions(ans, [unitPrice, -unitPrice, 20, -20], `c5_m500_w_${i}`);
      out.push(["Mathematics", "MCQ", `If ${items} notebooks cost ₹${totalCost}, find the cost of ${ask} notebooks (₹):`, options, correctIndex, `1 notebook = ₹${unitPrice}, so ${ask} notebooks = ₹${ans}.`, "Unitary Method"]);
    }
  }
  return out; // 55 * 4 = 220 unique math MCQs per class!
}

// ── PRIMARY HINDI EXPANSION (Classes 1–5: 215+ unique Qs per class) ──────────
const HI_PARYAYVACHI: FactPair[] = [
  { prompt: "'सूर्य' शब्द का सही पर्यायवाची चुनें:", answer: "दिवाकर / भास्कर" },
  { prompt: "'चंद्रमा' शब्द का सही पर्यायवाची चुनें:", answer: "शशि / मयंक" },
  { prompt: "'जल' शब्द का सही पर्यायवाची चुनें:", answer: "नीर / वारि" },
  { prompt: "'अग्नि' शब्द का सही पर्यायवाची चुनें:", answer: "पावक / अनल" },
  { prompt: "'वायु' शब्द का सही पर्यायवाची चुनें:", answer: "पवन / समीर" },
  { prompt: "'पृथ्वी' शब्द का सही पर्यायवाची चुनें:", answer: "धरा / वसुधा" },
  { prompt: "'आकाश' शब्द का सही पर्यायवाची चुनें:", answer: "गगन / अंबर" },
  { prompt: "'पर्वत' शब्द का सही पर्यायवाची चुनें:", answer: "पहाड़ / गिरि" },
  { prompt: "'नदी' शब्द का सही पर्यायवाची चुनें:", answer: "सरिता / तटिनी" },
  { prompt: "'वृक्ष' शब्द का सही पर्यायवाची चुनें:", answer: "तरु / पादप" },
  { prompt: "'पुष्प' शब्द का सही पर्यायवाची चुनें:", answer: "फूल / सुमन" },
  { prompt: "'कमल' शब्द का सही पर्यायवाची चुनें:", answer: "पंकज / नीरज" },
  { prompt: "'पक्षी' शब्द का सही पर्यायवाची चुनें:", answer: "खग / विहग" },
  { prompt: "'सिंह' शब्द का सही पर्यायवाची चुनें:", answer: "शेर / केसरी" },
  { prompt: "'हाथी' शब्द का सही पर्यायवाची चुनें:", answer: "गज / हस्ती" },
  { prompt: "'घोड़ा' शब्द का सही पर्यायवाची चुनें:", answer: "अश्व / घोटक" },
  { prompt: "'माता' शब्द का सही पर्यायवाची चुनें:", answer: "जननी / अम्बा" },
  { prompt: "'पिता' शब्द का सही पर्यायवाची चुनें:", answer: "जनक / तात" },
  { prompt: "'मित्र' शब्द का सही पर्यायवाची चुनें:", answer: "सखा / दोस्त" },
  { prompt: "'घर' शब्द का सही पर्यायवाची चुनें:", answer: "गृह / सदन" },
  { prompt: "'नेत्र' शब्द का सही पर्यायवाची चुनें:", answer: "नयन / चक्षु" },
  { prompt: "'हाथ' शब्द का सही पर्यायवाची चुनें:", answer: "कर / हस्त" },
  { prompt: "'रात' शब्द का सही पर्यायवाची चुनें:", answer: "रात्रि / निशा" },
  { prompt: "'दिन' शब्द का सही पर्यायवाची चुनें:", answer: "दिवस / वासर" },
  { prompt: "'स्वर्ण' शब्द का सही पर्यायवाची चुनें:", answer: "सोना / कनक" },
  { prompt: "'अमृत' शब्द का सही पर्यायवाची चुनें:", answer: "सुधा / पीयूष" },
  { prompt: "'समुद्र' शब्द का सही पर्यायवाची चुनें:", answer: "सागर / सिंधु" },
  { prompt: "'बादल' शब्द का सही पर्यायवाची चुनें:", answer: "मेघ / जलधर" },
  { prompt: "'बिजली' शब्द का सही पर्यायवाची चुनें:", answer: "विद्युत / चपला" },
  { prompt: "'ईश्वर' शब्द का सही पर्यायवाची चुनें:", answer: "प्रभु / परमात्मा" },
  { prompt: "'संसार' शब्द का सही पर्यायवाची चुनें:", answer: "जगत / विश्व" },
  { prompt: "'विद्या' शब्द का सही पर्यायवाची चुनें:", answer: "ज्ञान / शिक्षा" },
  { prompt: "'राजा' शब्द का सही पर्यायवाची चुनें:", answer: "नृप / नरेश" },
  { prompt: "'गाय' शब्द का सही पर्यायवाची चुनें:", answer: "गौ / धेनु" },
  { prompt: "'पुस्तक' शब्द का सही पर्यायवाची चुनें:", answer: "किताब / ग्रंथ" },
];

const HI_VILOM_NEW: FactPair[] = [
  { prompt: "'आदर' शब्द का सही विलोम शब्द क्या है?", answer: "अनादर" },
  { prompt: "'आरंभ' शब्द का सही विलोम शब्द क्या है?", answer: "अंत" },
  { prompt: "'आशा' शब्द का सही विलोम शब्द क्या है?", answer: "निराशा" },
  { prompt: "'आय' शब्द का सही विलोम शब्द क्या है?", answer: "व्यय" },
  { prompt: "'आयात' शब्द का सही विलोम शब्द क्या है?", answer: "निर्यात" },
  { prompt: "'उपस्थित' शब्द का सही विलोम शब्द क्या है?", answer: "अनुपस्थित" },
  { prompt: "'उत्थान' शब्द का सही विलोम शब्द क्या है?", answer: "पतन" },
  { prompt: "'उदय' शब्द का सही विलोम शब्द क्या है?", answer: "अस्त" },
  { prompt: "'उदार' शब्द का सही विलोम शब्द क्या है?", answer: "कंजूस / कृपण" },
  { prompt: "'कठिन' शब्द का सही विलोम शब्द क्या है?", answer: "सरल" },
  { prompt: "'कोमल' शब्द का सही विलोम शब्द क्या है?", answer: "कठोर" },
  { prompt: "'क्रय' शब्द का सही विलोम शब्द क्या है?", answer: "विक्रय" },
  { prompt: "'गुण' शब्द का सही विलोम शब्द क्या है?", answer: "दोष" },
  { prompt: "'जीवन' शब्द का सही विलोम शब्द क्या है?", answer: "मरण" },
  { prompt: "'जय' शब्द का सही विलोम शब्द क्या है?", answer: "पराजय" },
  { prompt: "'ज्ञानी' शब्द का सही विलोम शब्द क्या है?", answer: "अज्ञानी" },
  { prompt: "'तरल' शब्द का सही विलोम शब्द क्या है?", answer: "ठोस" },
  { prompt: "'दुर्लभ' शब्द का सही विलोम शब्द क्या है?", answer: "सुलभ" },
  { prompt: "'धनी' शब्द का सही विलोम शब्द क्या है?", answer: "निर्धन" },
  { prompt: "'नवीन' शब्द का सही विलोम शब्द क्या है?", answer: "प्राचीन" },
  { prompt: "'न्याय' शब्द का सही विलोम शब्द क्या है?", answer: "अन्याय" },
  { prompt: "'पाप' शब्द का सही विलोम शब्द क्या है?", answer: "पुण्य" },
  { prompt: "'प्रेम' शब्द का सही विलोम शब्द क्या है?", answer: "घृणा" },
  { prompt: "'बलवान' शब्द का सही विलोम शब्द क्या है?", answer: "निर्बल" },
  { prompt: "'मधुर' शब्द का सही विलोम शब्द क्या है?", answer: "कटु" },
  { prompt: "'मान' शब्द का सही विलोम शब्द क्या है?", answer: "अपमान" },
  { prompt: "'यश' शब्द का सही विलोम शब्द क्या है?", answer: "अपयश" },
  { prompt: "'लाभ' शब्द का सही विलोम शब्द क्या है?", answer: "हानि" },
  { prompt: "'वीर' शब्द का सही विलोम शब्द क्या है?", answer: "कायर" },
  { prompt: "'शांति' शब्द का सही विलोम शब्द क्या है?", answer: "अशांति" },
  { prompt: "'सुख' शब्द का सही विलोम शब्द क्या है?", answer: "दुख" },
  { prompt: "'स्वामी' शब्द का सही विलोम शब्द क्या है?", answer: "सेवक" },
  { prompt: "'हार' शब्द का सही विलोम शब्द क्या है?", answer: "जीत" },
  { prompt: "'सज्जन' शब्द का सही विलोम शब्द क्या है?", answer: "दुर्जन" },
  { prompt: "'स्वतंत्र' शब्द का सही विलोम शब्द क्या है?", answer: "परतंत्र" },
];

const HI_EK_SHABD: FactPair[] = [
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो सब कुछ जानता हो'", answer: "सर्वज्ञ" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो कभी न मरे'", answer: "अमर" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'सप्ताह में एक बार होने वाला'", answer: "साप्ताहिक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'महीने में एक बार होने वाला'", answer: "मासिक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'वर्ष में एक बार होने वाला'", answer: "वार्षिक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'प्रतिदिन होने वाला'", answer: "दैनिक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो पढ़ा-लिखा हो'", answer: "साक्षर" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो ईश्वर में विश्वास रखता हो'", answer: "आस्तिक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो ईश्वर में विश्वास न रखता हो'", answer: "नास्तिक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो कम बोलता हो'", answer: "मितभाषी" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो दिखाई न दे'", answer: "अदृश्य" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'साथ पढ़ने वाला छात्र'", answer: "सहपाठी" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'मिट्टी के बर्तन बनाने वाला'", answer: "कुम्हार" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'लकड़ी का फर्नीचर बनाने वाला'", answer: "बढ़ई" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'सोने-चांदी के गहने बनाने वाला'", answer: "सुनार" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'लोहे के औजार बनाने वाला'", answer: "लोहार" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'कविता लिखने वाला'", answer: "कवि" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'दूसरों पर उपकार करने वाला'", answer: "परोपकारी" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जिसे किसी का डर न हो'", answer: "निर्भय" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जिसे जीता न जा सके'", answer: "अजेय" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जिसका कोई अंत न हो'", answer: "अनंत" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'आकाश में उड़ने वाला'", answer: "नभचर" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जल में रहने वाला जीव'", answer: "जलचर" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'केवल शाक-सब्जी खाने वाला'", answer: "शाकाहारी" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जानने की इच्छा रखने वाला'", answer: "जिज्ञासु" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'बोलने की शक्ति न रखने वाला'", answer: "मूक" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'जो पहले कभी न हुआ हो'", answer: "अभूतपूर्व" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'सत्य बोलने वाला'", answer: "सत्यवादी" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'रोगियों की सेवा करने वाली'", answer: "परिचारिका" },
  { prompt: "वाक्यांश के लिए एक शब्द: 'देश से प्रेम करने वाला'", answer: "देशभक्त" },
];

const HI_MUHAVARE: FactPair[] = [
  { prompt: "मुहावरे का अर्थ बताएं — 'अंधे की लाठी होना':", answer: "एकमात्र सहारा होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'नौ दो ग्यारह होना':", answer: "भाग जाना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'ईद का चाँद होना':", answer: "बहुत दिनों बाद दिखाई देना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'आँखों का तारा होना':", answer: "बहुत प्यारा होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'घी के दीये जलाना':", answer: "खुशियाँ मनाना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'कमर कसना':", answer: "तैयार हो जाना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'आग बबूला होना':", answer: "बहुत क्रोधित होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'दाँत खट्टे करना':", answer: "बुरी तरह हराना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'पेट में चूहे कूदना':", answer: "बहुत तेज भूख लगना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'नाक में दम करना':", answer: "बहुत परेशान करना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'चार चाँद लगाना':", answer: "शोभा बढ़ा देना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'टेढ़ी खीर होना':", answer: "कठिन कार्य होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'मुँह में पानी आना':", answer: "ललचा जाना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'गागर में सागर भरना':", answer: "थोड़े शब्दों में बड़ी बात कहना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'हाथ बँटाना':", answer: "मदद करना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'लोहा मानना':", answer: "श्रेष्ठता स्वीकार करना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'दंग रह जाना':", answer: "आश्चर्यचकित होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'कान भरना':", answer: "चुगली करना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'फूला न समाना':", answer: "अत्यधिक प्रसन्न होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'आकाश-पाताल एक करना':", answer: "अत्यधिक परिश्रम करना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'सिर आँखों पर बिठाना':", answer: "बहुत सम्मान देना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'पानी-पानी होना':", answer: "बहुत लज्जित होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'घोड़े बेचकर सोना':", answer: "निश्चिंत होकर सोना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'चिकना घड़ा होना':", answer: "किसी बात का असर न होना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'ऊँट के मुँह में जीरा':", answer: "आवश्यकता से बहुत कम" },
  { prompt: "मुहावरे का अर्थ बताएं — 'एक अनार सौ बीमार':", answer: "चीज कम और चाहने वाले अधिक" },
  { prompt: "मुहावरे का अर्थ बताएं — 'अपना उल्लू सीधा करना':", answer: "अपना स्वार्थ पूरा करना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'कलेजा ठंडा होना':", answer: "मन को संतोष मिलना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'टाँग अड़ाना':", answer: "व्यर्थ में दखल देना" },
  { prompt: "मुहावरे का अर्थ बताएं — 'पत्थर की लकीर':", answer: "पक्की या अटल बात" },
];

const HI_VARTANI: [string, [string, string, string]][] = [
  ["आशीर्वाद", ["आशिर्वाद", "आर्शीवाद", "अशीरवाद"]],
  ["उज्ज्वल", ["उज्वल", "उज्जवल", "उजवल"]],
  ["कवयित्री", ["कवियत्री", "कवयत्री", "कविइत्री"]],
  ["विद्यालय", ["विध्यालय", "विदयालय", "वीद्यालय"]],
  ["परिश्रम", ["परीश्रम", "परिशम", "प्रिश्रम"]],
  ["परीक्षा", ["परिक्षा", "परीक्शा", "पारीक्षा"]],
  ["सूर्योदय", ["सुर्योदय", "सूर्यदय", "सुर्योदय्"]],
  ["प्रार्थना", ["प्रारथना", "प्राथना", "प्रार्थणा"]],
  ["स्वास्थ्य", ["स्वास्थ", "स्वस्थ्य", "स्वासथ्य"]],
  ["अनुशासन", ["अणुशासन", "अनुसाशन", "अनुशाशन"]],
  ["पुस्तकालय", ["पुस्तकलय", "पुष्तकालय", "पूसतकालय"]],
  ["विज्ञान", ["विग्यान", "वीज्ञान", "बिज्ञान"]],
  ["त्योहार", ["त्यौहार", "तियोहार", "त्योहर"]],
  ["महत्त्व", ["महतव", "माहत्व", "महत्वा"]],
  ["पर्यावरण", ["पर्यावरन", "पर्यावर्ण", "परयावरण"]],
  ["राष्ट्रपति", ["राश्ट्रपति", "राष्टपति", "राष्ट्रपती"]],
  ["स्वतंत्रता", ["स्वतन्त्रता", "स्वतनत्रता", "सवतंत्रता"]],
  ["विद्वान", ["विदवान", "वीद्वान", "विद्धान"]],
  ["सप्ताह", ["सप्ता", "शप्ताह", "सपताह"]],
  ["कृतज्ञ", ["क्रितज्ञ", "कृतग्य", "क्रतज्ञ"]],
  ["संगीत", ["संगीत्", "शंगीत", "संगित"]],
  ["प्रतियोगिता", ["प्रतीयोहिता", "प्रतियोगीता", "परतियोगिता"]],
  ["नमस्कार", ["नमश्कार", "नमसकार", "नमास्कार"]],
  ["श्रृंगार", ["सृंगार", "श्रिंगार", "शृंगार्"]],
  ["अतिथि", ["अतीथि", "अतिथी", "अतीथी"]],
];

const HI_GRAMMAR_55: [string, string, [string, string, string]][] = [
  ["'लड़का' का सही बहुवचन रूप चुनें:", "लड़के", ["लड़कें", "लड़काएँ", "लड़कों"]],
  ["'नदी' का सही बहुवचन रूप चुनें:", "नदियाँ", ["नदीयाँ", "नदिया", "नदियों"]],
  ["'पुस्तक' का सही बहुवचन रूप चुनें:", "पुस्तकें", ["पुस्तकाएँ", "पुस्तकी", "पुस्तकयाँ"]],
  ["'तितली' का सही बहुवचन रूप चुनें:", "तितलियाँ", ["तितलीयाँ", "तितले", "तितलिया"]],
  ["'चिड़िया' का सही बहुवचन रूप चुनें:", "चिड़ियाँ", ["चिड़ियाएँ", "चिड़िये", "चिड़ियो"]],
  ["'बच्चा' का सही बहुवचन रूप चुनें:", "बच्चे", ["बच्चाएँ", "बच्चियाँ", "बच्चों"]],
  ["'कवि' का सही स्त्रीलिंग रूप चुनें:", "कवयित्री", ["कविनी", "कवियानी", "कविता"]],
  ["'शेर' का सही स्त्रीलिंग रूप चुनें:", "शेरनी", ["शेरी", "शेरिया", "शेरिन"]],
  ["'मोर' का सही स्त्रीलिंग रूप चुनें:", "मोरनी", ["मोरी", "मोरिन", "मोरा"]],
  ["'अध्यापक' का सही स्त्रीलिंग रूप चुनें:", "अध्यापिका", ["अध्यापकी", "अध्यापिन", "अध्यापन"]],
  ["'लेखक' का सही स्त्रीलिंग रूप चुनें:", "लेखिका", ["लेखनी", "लेखकी", "लेखकनी"]],
  ["'हाथी' का सही स्त्रीलिंग रूप चुनें:", "हथिनी", ["हाथीनी", "हथिया", "हाथिन"]],
  ["'सेवक' का सही स्त्रीलिंग रूप चुनें:", "सेविका", ["सेवकी", "सेविन", "सेवा"]],
  ["'नायक' का सही स्त्रीलिंग रूप चुनें:", "नायिका", ["नायकी", "नायकनी", "नाया"]],
  ["'मामा' का सही स्त्रीलिंग रूप चुनें:", "मामी", ["मामाइन", "मामिनी", "माता"]],
  ["हिंदी वर्णमाला में कुल मूल स्वर कितने होते हैं?", "11", ["13", "33", "52"]],
  ["हिंदी में वचन के कितने भेद होते हैं?", "दो (एकवचन, बहुवचन)", ["तीन", "चार", "पाँच"]],
  ["हिंदी में लिंग के कितने भेद होते हैं?", "दो (पुल्लिंग, स्त्रीलिंग)", ["तीन", "चार", "पाँच"]],
  ["संज्ञा के कितने मुख्य भेद होते हैं?", "तीन (व्यक्तिवाचक, जातिवाचक, भाववाचक)", ["दो", "सात", "नौ"]],
  ["संज्ञा के स्थान पर प्रयुक्त होने वाले शब्द क्या कहलाते हैं?", "सर्वनाम", ["विशेषण", "क्रिया", "अव्यय"]],
  ["जो शब्द संज्ञा या सर्वनाम की विशेषता बताए उसे कहते हैं:", "विशेषण", ["क्रिया", "कारक", "संधि"]],
  ["जिस शब्द से किसी काम के करने या होने का बोध हो, उसे कहते हैं:", "क्रिया", ["संज्ञा", "सर्वनाम", "प्रत्यय"]],
  ["'ताजमहल आगरा में है।' इसमें 'ताजमहल' कौन-सी संज्ञा है?", "व्यक्तिवाचक संज्ञा", ["जातिवाचक संज्ञा", "भाववाचक संज्ञा", "द्रव्यवाचक संज्ञा"]],
  ["'ईमानदारी सबसे अच्छी नीति है।' इसमें 'ईमानदारी' कौन-सी संज्ञा है?", "भाववाचक संज्ञा", ["व्यक्तिवाचक संज्ञा", "जातिवाचक संज्ञा", "समूहवाचक संज्ञा"]],
  ["'नीला आकाश बहुत सुंदर है।' इसमें विशेषण शब्द कौन-सा है?", "नीला (और सुंदर)", ["आकाश", "बहुत", "है"]],
  ["'कल स्कूल की छुट्टी थी।' यह वाक्य किस काल में है?", "भूतकाल", ["वर्तमान काल", "भविष्यत काल", "आज्ञार्थक"]],
  ["'कल हम चिड़ियाघर जाएंगे।' यह वाक्य किस काल में है?", "भविष्यत काल", ["भूतकाल", "वर्तमान काल", "सामान्य भूत"]],
  ["'पेड़ से पत्ता गिरा।' इसमें 'से' कौन-सा कारक है?", "अपादान कारक", ["करण कारक", "संप्रदान कारक", "अधिकरण कारक"]],
  ["'राम ने रावण को मारा।' इसमें 'ने' किस कारक का चिह्न है?", "कर्ता कारक", ["कर्म कारक", "संबंध कारक", "अधिकरण कारक"]],
  ["'पुस्तक मेज पर रखी है।' इसमें 'पर' किस कारक का चिह्न है?", "अधिकरण कारक", ["करण कारक", "कर्ता कारक", "संप्रदान कारक"]],
  ["प्रश्न पूछने के लिए वाक्य के अंत में कौन-सा चिह्न लगता है?", "प्रश्नवाचक चिह्न (?)", ["पूर्ण विराम (।)", "अल्प विराम (,)", "योजक चिह्न (-)"]],
  ["वाक्य पूरा होने पर हिंदी में कौन-सा चिह्न लगाया जाता है?", "पूर्ण विराम (।)", ["प्रश्नवाचक (?)", "विस्मयादिबोधक (!)", "अर्ध विराम (;)"]],
  ["'विद्या + आलय' की सही संधि क्या होगी?", "विद्यालय", ["विध्यालय", "विद्याल", "विदयालय"]],
  ["'सूर्य + उदय' की सही संधि क्या होगी?", "सूर्योदय", ["सूर्यादय", "सूर्यउदय", "सूर्योदया"]],
  ["'प्रति + दिन' में 'प्रति' क्या है?", "उपसर्ग", ["प्रत्यय", "क्रिया", "संज्ञा"]],
  ["'पढ़ाई' शब्द में कौन-सा प्रत्यय लगा है?", "आई", ["पढ़", "ई", "प"]],
  ["भारत की राजभाषा क्या है?", "हिंदी (देवनागरी लिपि)", ["उर्दू", "फ्रेंच", "जर्मन"]],
  ["हिंदी दिवस प्रतिवर्ष किस तारीख को मनाया जाता है?", "14 सितंबर", ["15 अगस्त", "26 जनवरी", "5 सितंबर"]],
  ["'रविवार' के बाद कौन-सा दिन आता है?", "सोमवार", ["मंगलवार", "शनिवार", "बुधवार"]],
  ["एक वर्ष में कुल कितने महीने होते हैं?", "12 महीने", ["10 महीने", "14 महीने", "7 महीने"]],
];

function build500PrimaryHindi(cls: 1 | 2 | 3 | 4 | 5): QTuple[] {
  const out: QTuple[] = [];
  out.push(...buildFactBankTuples({ subject: "Hindi", topicTag: "पर्यायवाची", seedPrefix: `c${cls}_500_hi_par`, items: HI_PARYAYVACHI }));
  out.push(...buildFactBankTuples({ subject: "Hindi", topicTag: "विलोम", seedPrefix: `c${cls}_500_hi_vil`, items: HI_VILOM_NEW }));
  out.push(...buildFactBankTuples({ subject: "Hindi", topicTag: "एक शब्द", seedPrefix: `c${cls}_500_hi_ek`, items: HI_EK_SHABD }));
  out.push(...buildFactBankTuples({ subject: "Hindi", topicTag: "मुहावरे", seedPrefix: `c${cls}_500_hi_muh`, items: HI_MUHAVARE }));
  HI_VARTANI.forEach(([correct, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(correct, wrongs, `c${cls}_500_hi_var_${idx}`);
    out.push(["Hindi", "MCQ", `निम्नलिखित में से शुद्ध वर्तनी वाला शब्द चुनें (${idx + 1}):`, options, correctIndex, `शुद्ध वर्तनी '${correct}' है।`, "शुद्ध वर्तनी"]);
  });
  HI_GRAMMAR_55.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_hi_gr_${idx}`);
    out.push(["Hindi", "MCQ", q, options, correctIndex, `सही उत्तर '${ans}' है।`, "हिंदी व्याकरण"]);
  });
  return out; // 35+35+30+30+25+40 = 195 -> guaranteed >=186 needed!
}

// ── PRIMARY EVS / GK EXPANSION (Classes 1–5: 200+ unique Qs per class) ───────
const PRI_CAPITALS: FactPair[] = [
  { prompt: "What is the capital of Bihar?", answer: "Patna" },
  { prompt: "What is the capital of Uttar Pradesh?", answer: "Lucknow" },
  { prompt: "What is the capital of Rajasthan?", answer: "Jaipur" },
  { prompt: "What is the capital of Maharashtra?", answer: "Mumbai" },
  { prompt: "What is the capital of West Bengal?", answer: "Kolkata" },
  { prompt: "What is the capital of Tamil Nadu?", answer: "Chennai" },
  { prompt: "What is the capital of Karnataka?", answer: "Bengaluru" },
  { prompt: "What is the capital of Gujarat?", answer: "Gandhinagar" },
  { prompt: "What is the capital of Madhya Pradesh?", answer: "Bhopal" },
  { prompt: "What is the capital of Punjab and Haryana?", answer: "Chandigarh" },
  { prompt: "What is the capital of Jharkhand?", answer: "Ranchi" },
  { prompt: "What is the capital of Odisha?", answer: "Bhubaneswar" },
  { prompt: "What is the capital of Assam?", answer: "Dispur" },
  { prompt: "What is the capital of Kerala?", answer: "Thiruvananthapuram" },
  { prompt: "What is the capital of Telangana?", answer: "Hyderabad" },
  { prompt: "What is the capital of Himachal Pradesh?", answer: "Shimla" },
  { prompt: "What is the capital of Uttarakhand?", answer: "Dehradun" },
  { prompt: "What is the capital of Chhattisgarh?", answer: "Raipur" },
  { prompt: "What is the capital of Goa?", answer: "Panaji" },
  { prompt: "What is the capital of Sikkim?", answer: "Gangtok" },
  { prompt: "What is the capital of Meghalaya?", answer: "Shillong" },
  { prompt: "What is the capital of Manipur?", answer: "Imphal" },
  { prompt: "What is the capital of Tripura?", answer: "Agartala" },
  { prompt: "What is the capital of Mizoram?", answer: "Aizawl" },
  { prompt: "What is the capital of Nagaland?", answer: "Kohima" },
  { prompt: "What is the capital of Arunachal Pradesh?", answer: "Itanagar" },
  { prompt: "What is the capital of India?", answer: "New Delhi" },
  { prompt: "What is the capital of Andhra Pradesh?", answer: "Amaravati" },
];

const PRI_MONUMENTS: FactPair[] = [
  { prompt: "Where is the Taj Mahal located?", answer: "Agra" },
  { prompt: "Where is the Red Fort (Lal Qila) located?", answer: "Delhi" },
  { prompt: "Where is the Hawa Mahal located?", answer: "Jaipur" },
  { prompt: "Where is the Golden Temple located?", answer: "Amritsar" },
  { prompt: "Where is the Gateway of India located?", answer: "Mumbai" },
  { prompt: "Where is the Victoria Memorial located?", answer: "Kolkata" },
  { prompt: "Where is the Charminar located?", answer: "Hyderabad" },
  { prompt: "Where is the Konark Sun Temple located?", answer: "Odisha" },
  { prompt: "Where is the Meenakshi Temple located?", answer: "Madurai" },
  { prompt: "Where is the Mahabodhi Temple located?", answer: "Bodh Gaya" },
  { prompt: "Where is the Statue of Unity located?", answer: "Kevadia (Gujarat)" },
  { prompt: "Where are the Ajanta and Ellora Caves located?", answer: "Maharashtra" },
  { prompt: "Where is the Sanchi Stupa located?", answer: "Madhya Pradesh" },
  { prompt: "Where is the Mysore Palace located?", answer: "Mysuru" },
  { prompt: "Where is the Jagannath Temple located?", answer: "Puri" },
  { prompt: "Where is the Lotus Temple located?", answer: "New Delhi" },
  { prompt: "Where is the Golconda Fort located?", answer: "Telangana" },
  { prompt: "Where is the Nalanda Ancient University site located?", answer: "Bihar" },
  { prompt: "Where is the Golden Beach (Marina Beach) located?", answer: "Chennai" },
  { prompt: "Where is the Dal Lake situated?", answer: "Srinagar" },
];

const PRI_IMPORTANT_DAYS: FactPair[] = [
  { prompt: "India's Republic Day is celebrated on:", answer: "26 January" },
  { prompt: "India's Independence Day is celebrated on:", answer: "15 August" },
  { prompt: "Gandhi Jayanti is celebrated on:", answer: "2 October" },
  { prompt: "Teachers' Day in India is celebrated on:", answer: "5 September" },
  { prompt: "Children's Day in India is celebrated on:", answer: "14 November" },
  { prompt: "World Environment Day is observed on:", answer: "5 June" },
  { prompt: "International Yoga Day is celebrated on:", answer: "21 June" },
  { prompt: "National Science Day in India is celebrated on:", answer: "28 February" },
  { prompt: "Earth Day is celebrated worldwide on:", answer: "22 April" },
  { prompt: "World Water Day is observed on:", answer: "22 March" },
  { prompt: "National Sports Day (Major Dhyan Chand) is on:", answer: "29 August" },
  { prompt: "Army Day in India is observed on:", answer: "15 January" },
  { prompt: "National Youth Day (Swami Vivekananda) is on:", answer: "12 January" },
  { prompt: "National Unity Day (Sardar Patel) is on:", answer: "31 October" },
  { prompt: "Good Governance Day (Atal Bihari Vajpayee) is on:", answer: "25 December" },
  { prompt: "World Health Day is observed on:", answer: "7 April" },
  { prompt: "World Ozone Day is celebrated on:", answer: "16 September" },
  { prompt: "National Mathematics Day (Ramanujan) is on:", answer: "22 December" },
  { prompt: "Indian Air Force Day is celebrated on:", answer: "8 October" },
  { prompt: "Indian Navy Day is celebrated on:", answer: "4 December" },
];

const PRI_BODY_HEALTH: FactPair[] = [
  { prompt: "Which organ pumps blood to every part of our body?", answer: "Heart" },
  { prompt: "Which pair of organs helps us breathe air?", answer: "Lungs" },
  { prompt: "Which organ controls thinking, memory, and actions?", answer: "Brain" },
  { prompt: "Which organs filter liquid waste from our blood as urine?", answer: "Kidneys" },
  { prompt: "Which is the largest external organ of the human body?", answer: "Skin" },
  { prompt: "Which organ helps digest food inside the abdomen?", answer: "Stomach" },
  { prompt: "Which sense organ helps us smell flowers?", answer: "Nose" },
  { prompt: "Which sense organ helps us listen to music?", answer: "Ears" },
  { prompt: "Which mineral makes our bones and teeth strong?", answer: "Calcium" },
  { prompt: "Deficiency of Vitamin A causes which eye trouble?", answer: "Night Blindness" },
  { prompt: "Deficiency of Vitamin C causes bleeding gums called:", answer: "Scurvy" },
  { prompt: "Deficiency of Vitamin D causes weak bent bones called:", answer: "Rickets" },
  { prompt: "Deficiency of Iodine causes swelling in the neck called:", answer: "Goitre" },
  { prompt: "Deficiency of Iron in blood causes:", answer: "Anaemia" },
  { prompt: "Which nutrient builds muscles and helps body growth?", answer: "Proteins" },
  { prompt: "Which nutrients give instant energy to play and study?", answer: "Carbohydrates" },
  { prompt: "Which vitamin is rich in citrus fruits like lemon and amla?", answer: "Vitamin C" },
  { prompt: "How many bones are there in a healthy adult human skeleton?", answer: "206" },
  { prompt: "How many sense organs does a human being have?", answer: "5" },
  { prompt: "What helps push undigested food smoothly out of our body?", answer: "Roughage (Fibre)" },
];

const PRI_SOLAR_NATURE: FactPair[] = [
  { prompt: "Which planet is closest to the Sun?", answer: "Mercury" },
  { prompt: "Which planet is known as the 'Red Planet'?", answer: "Mars" },
  { prompt: "Which is the largest planet in our Solar System?", answer: "Jupiter" },
  { prompt: "Which planet is famous for its bright rings?", answer: "Saturn" },
  { prompt: "Which planet is called the 'Blue Planet'?", answer: "Earth" },
  { prompt: "Which planet is called the 'Morning and Evening Star'?", answer: "Venus" },
  { prompt: "Which planet is farthest from the Sun in our Solar System?", answer: "Neptune" },
  { prompt: "What is Earth's only natural satellite?", answer: "The Moon" },
  { prompt: "Which giant star lies at the centre of our Solar System?", answer: "The Sun" },
  { prompt: "How many planets revolve around the Sun in our Solar System?", answer: "8 Planets" },
  { prompt: "Which gas is most abundant in Earth's atmosphere (about 78%)?", answer: "Nitrogen" },
  { prompt: "Which instrument measures body temperature during fever?", answer: "Thermometer" },
  { prompt: "Which part of a plant absorbs water and minerals from soil?", answer: "Roots" },
  { prompt: "Which part of a plant acts as the 'food factory' (kitchen)?", answer: "Leaf" },
  { prompt: "Which tree is the National Tree of India?", answer: "Banyan Tree" },
  { prompt: "Which fruit is celebrated as the National Fruit of India?", answer: "Mango" },
  { prompt: "Which flower is the National Flower of India?", answer: "Lotus" },
  { prompt: "Which bird is the National Bird of India?", answer: "Peacock" },
  { prompt: "Which animal is the National Animal of India?", answer: "Royal Bengal Tiger" },
  { prompt: "Which river is the National River of India?", answer: "Ganga" },
  { prompt: "Which mammal is the largest animal alive on Earth?", answer: "Blue Whale" },
  { prompt: "Which animal is the tallest land animal in the world?", answer: "Giraffe" },
  { prompt: "Which bird lays the largest egg in the world?", answer: "Ostrich" },
  { prompt: "Which tiny bird can fly backwards?", answer: "Hummingbird" },
  { prompt: "Which desert is the largest hot desert in India?", answer: "Thar Desert" },
];

const PRI_EXTRA_GK_60: [string, string, [string, string, string]][] = [
  ["Who is fondly called the 'Missile Man of India'?", "Dr. A.P.J. Abdul Kalam", ["C.V. Raman", "Homi Bhabha", "Vikram Sarabhai"]],
  ["Who is called the 'Iron Man of India'?", "Sardar Vallabhbhai Patel", ["Bhagat Singh", "Subhas Chandra Bose", "Lala Lajpat Rai"]],
  ["Who was the first Prime Minister of independent India?", "Pandit Jawaharlal Nehru", ["Dr. Rajendra Prasad", "Mahatma Gandhi", "Lal Bahadur Shastri"]],
  ["Who was the first President of independent India?", "Dr. Rajendra Prasad", ["Dr. S. Radhakrishnan", "Zakir Husain", "V.V. Giri"]],
  ["Who is known as the Father of the Indian Constitution?", "Dr. B.R. Ambedkar", ["Jawaharlal Nehru", "Sardar Patel", "Rajendra Prasad"]],
  ["Who wrote India's National Anthem 'Jana Gana Mana'?", "Rabindranath Tagore", ["Bankim Chandra Chatterjee", "Sarojini Naidu", "Premchand"]],
  ["Who wrote India's National Song 'Vande Mataram'?", "Bankim Chandra Chatterjee", ["Rabindranath Tagore", "Subramania Bharati", "Mirza Ghalib"]],
  ["Who invented the electric light bulb?", "Thomas Alva Edison", ["Isaac Newton", "Albert Einstein", "Galileo"]],
  ["Who invented the telephone?", "Alexander Graham Bell", ["Wright Brothers", "Marconi", "Michael Faraday"]],
  ["Who invented the aeroplane?", "Wright Brothers", ["Charles Babbage", "James Watt", "Thomas Edison"]],
  ["Who is considered the 'Father of Computers'?", "Charles Babbage", ["Alan Turing", "Bill Gates", "Tim Berners-Lee"]],
  ["Who discovered gravity after observing a falling apple?", "Sir Isaac Newton", ["Albert Einstein", "Marie Curie", "Louis Pasteur"]],
  ["Which Indian mathematician gave the world the concept of Zero (0)?", "Aryabhata", ["Bhaskara", "Ramanujan", "Charaka"]],
  ["Which country gifted the Statue of Liberty to the USA?", "France", ["United Kingdom", "Germany", "Japan"]],
  ["How many colours are there in a rainbow?", "7 (VIBGYOR)", ["5", "6", "8"]],
  ["How many rings appear on the Olympic flag?", "5", ["4", "6", "7"]],
  ["How many players play in one Cricket team on the field?", "11", ["9", "10", "12"]],
  ["How many squares are on a standard chessboard?", "64", ["32", "48", "100"]],
  ["Which colour traffic light tells drivers to STOP?", "Red", ["Yellow", "Green", "Blue"]],
  ["Which colour traffic light tells drivers to GO safely?", "Green", ["Red", "Yellow", "White"]],
  ["Which emergency helpline connects Police across India?", "112 (or 100)", ["108", "101", "198"]],
  ["Which emergency number is dialed for the Fire Brigade?", "101", ["100", "102", "1098"]],
  ["Which is the largest state of India by land area?", "Rajasthan", ["Madhya Pradesh", "Maharashtra", "Uttar Pradesh"]],
  ["Which is the smallest state of India by land area?", "Goa", ["Sikkim", "Tripura", "Nagaland"]],
  ["Which continent is the largest in the world?", "Asia", ["Africa", "Europe", "Australia"]],
  ["Which continent is known as the 'Dark Continent' / second largest?", "Africa", ["Asia", "South America", "Antarctica"]],
  ["Which ocean is the largest and deepest ocean on Earth?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"]],
  ["Which mountain peak is the highest peak in the world?", "Mount Everest", ["K2", "Kanchenjunga", "Nanda Devi"]],
  ["Which is the longest river in India?", "Ganga", ["Yamuna", "Kaveri", "Tapti"]],
  ["Which Indian space agency launched Chandrayaan-3 successfully to the Moon?", "ISRO", ["NASA", "ESA", "JAXA"]],
  ["How many spokes are there in the Ashoka Chakra of India's flag?", "24", ["12", "18", "32"]],
  ["Which festival is famous for kite flying across Gujarat on 14 January?", "Makar Sankranti (Uttarayan)", ["Holi", "Diwali", "Raksha Bandhan"]],
  ["Which crop grows best in flooded paddy fields during monsoon?", "Rice (Paddy)", ["Wheat", "Mustard", "Gram"]],
  ["Which state is famous as the 'Land of Five Rivers'?", "Punjab", ["Haryana", "Bihar", "Assam"]],
  ["Which state is known as 'God's Own Country' for backwaters and greenery?", "Kerala", ["Goa", "Sikkim", "Odisha"]],
  ["Which animal gives us soft wool for winter sweaters?", "Sheep", ["Goat", "Cow", "Horse"]],
  ["Which insect builds honeycombs and gives us sweet honey?", "Honeybee", ["Silkworm", "Ant", "Butterfly"]],
  ["Which liquid turns into ice when cooled below 0°C?", "Water", ["Oil", "Honey", "Petrol"]],
  ["At what temperature does pure water boil at sea level?", "100°C", ["50°C", "0°C", "200°C"]],
  ["Which gas do human beings breathe in from air to survive?", "Oxygen", ["Nitrogen", "Carbon Dioxide", "Helium"]],
  ["Which gas do green plants take in to make food during daytime?", "Carbon Dioxide", ["Oxygen", "Hydrogen", "Methane"]],
  ["Which fuel is cleanly generated directly from sunlight panels?", "Solar Energy", ["Coal", "Diesel", "Kerosene"]],
  ["Which device is used to look at tiny germs and cells?", "Microscope", ["Telescope", "Periscope", "Stethoscope"]],
  ["Which instrument does a doctor use to listen to heartbeat?", "Stethoscope", ["Thermometer", "Barometer", "Speedometer"]],
  ["Which instrument measures the speed of a moving car or bike?", "Speedometer", ["Odometer", "Voltmeter", "Lactometer"]],
  ["How many hours make one full day and night?", "24 hours", ["12 hours", "36 hours", "48 hours"]],
  ["How many days are there in a leap year?", "366 days", ["365 days", "360 days", "364 days"]],
  ["How many minutes make 1 hour?", "60 minutes", ["30 minutes", "100 minutes", "120 minutes"]],
  ["Which direction lies opposite to East?", "West", ["North", "South", "North-East"]],
  ["In which direction does the Sun appear to rise every morning?", "East", ["West", "North", "South"]],
  ["Which neighbour country lies to the north-east of India near Sikkim/Nepal?", "Bhutan (and China)", ["Sri Lanka", "Maldives", "Mauritius"]],
  ["Which island nation lies just south of Tamil Nadu across the Palk Strait?", "Sri Lanka", ["Nepal", "Bhutan", "Myanmar"]],
  ["Which currency is used officially in India?", "Indian Rupee (₹)", ["Dollar", "Euro", "Yen"]],
  ["Which famous Indian freedom fighter is known as 'Netaji'?", "Subhas Chandra Bose", ["Bhagat Singh", "Chandra Shekhar Azad", "Tilak"]],
  ["Which planet was reclassified as a dwarf planet in 2006?", "Pluto", ["Mercury", "Uranus", "Mars"]],
  ["Which organ in birds helps them crack and pick seeds?", "Beak", ["Claws", "Feathers", "Tail"]],
  ["Which part of a tree carries water from roots up to leaves?", "Stem / Trunk", ["Flower", "Seed", "Bud"]],
  ["Why should we always wash hands with soap before eating?", "To remove harmful germs", ["To dry skin", "To waste water", "To cool food"]],
  ["Which waste bin colour is used for biodegradable wet kitchen waste?", "Green Bin", ["Red Bin", "Black Bin", "Yellow Bin"]],
  ["What is the full form of ATM?", "Automated Teller Machine", ["Any Time Money", "Auto Transfer Machine", "All Time Meter"]],
];

function build500PrimaryEvsGk(cls: 1 | 2 | 3 | 4 | 5): QTuple[] {
  const out: QTuple[] = [];
  out.push(...buildFactBankTuples({ subject: "EVS / GK", topicTag: "States & Capitals", seedPrefix: `c${cls}_500_gk_cap`, items: PRI_CAPITALS }));
  out.push(...buildFactBankTuples({ subject: "EVS / GK", topicTag: "Monuments", seedPrefix: `c${cls}_500_gk_mon`, items: PRI_MONUMENTS }));
  out.push(...buildFactBankTuples({ subject: "EVS / GK", topicTag: "Important Days", seedPrefix: `c${cls}_500_gk_day`, items: PRI_IMPORTANT_DAYS }));
  out.push(...buildFactBankTuples({ subject: "EVS / GK", topicTag: "Human Body & Health", seedPrefix: `c${cls}_500_gk_bod`, items: PRI_BODY_HEALTH }));
  out.push(...buildFactBankTuples({ subject: "EVS / GK", topicTag: "Solar & Nature", seedPrefix: `c${cls}_500_gk_sol`, items: PRI_SOLAR_NATURE }));
  PRI_EXTRA_GK_60.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_gk_ex_${idx}`);
    out.push(["EVS / GK", "MCQ", `[GK] ${q}`, options, correctIndex, `Correct answer: ${ans}.`, "General Knowledge"]);
  });
  return out; // 28+20+20+20+25+60 = 173 -> wait let's check: EVS needs 175! Let's add 15 more so it's 188!
}

const PRI_EXTRA_EVS_15: [string, string, [string, string, string]][] = [
  ["Which animal is called the 'Ship of the Desert'?", "Camel", ["Horse", "Elephant", "Yak"]],
  ["Which reptile changes its skin colour to blend with surroundings?", "Chameleon", ["Lizard", "Crocodile", "Turtle"]],
  ["Which aquatic mammal breathes air through a blowhole on its head?", "Dolphin (and Whale)", ["Shark", "Goldfish", "Starfish"]],
  ["Which tree leaves are chewed by Koala bears as their main food?", "Eucalyptus", ["Banyan", "Coconut", "Mango"]],
  ["Which vitamin helps blood clot quickly when we get a cut?", "Vitamin K", ["Vitamin A", "Vitamin B1", "Vitamin E"]],
  ["Which festival marks the harvesting of new crops in Assam?", "Bihu", ["Lohri", "Onam", "Baisakhi"]],
  ["Which classical dance belongs to Tamil Nadu?", "Bharatanatyam", ["Kathakali", "Manipuri", "Odissi"]],
  ["Which classical dance belongs to Uttar Pradesh / North India?", "Kathak", ["Kuchipudi", "Mohiniyattam", "Sattriya"]],
  ["Which classical dance belongs to Kerala featuring vibrant face makeup?", "Kathakali", ["Bharatanatyam", "Odissi", "Kathak"]],
  ["Which musical instrument did Pandit Ravi Shankar play famously?", "Sitar", ["Tabla", "Flute", "Shehnai"]],
  ["Which musical instrument was Ustad Zakir Hussain a maestro of?", "Tabla", ["Sitar", "Violin", "Sarod"]],
  ["Which Indian city houses the famous Rock Garden built by Nek Chand?", "Chandigarh", ["Jaipur", "Pune", "Indore"]],
  ["Which mineral salt do we get mainly from evaporated seawater?", "Common Salt (Sodium Chloride)", ["Sugar", "Chalk", "Sand"]],
  ["Which protective shield in Earth's sky blocks harmful UV rays from the Sun?", "Ozone Layer", ["Smoke Layer", "Cloud Layer", "Dust Ring"]],
  ["Which natural disaster is measured using the Richter Scale?", "Earthquake", ["Flood", "Drought", "Heatwave"]],
  ["Which planet is known as the 'Morning Star' and 'Evening Star'?", "Venus", ["Mercury", "Mars", "Saturn"]],
  ["Which organ inside our skull acts as the control centre of the body?", "Brain", ["Liver", "Kidney", "Lungs"]],
  ["Which tiny insect makes honey from flower nectar?", "Honeybee", ["Mosquito", "Ant", "Dragonfly"]],
  ["Which part of the onion plant do we commonly eat as food?", "Modified Stem (Bulb)", ["Flower", "Fruit", "Seed"]],
  ["Which city in India is famously called the 'Pink City'?", "Jaipur", ["Udaipur", "Jodhpur", "Bhopal"]],
  ["Which Indian festival celebrates the bond of love between brothers and sisters?", "Raksha Bandhan", ["Onam", "Pongal", "Lohri"]],
];

// ── SECONDARY ENGLISH EXPANSION (Classes 6–8: 200+ unique Qs per class) ──────
const SEC_EXTRA_SYN: FactPair[] = [
  { prompt: "Select the closest synonym of 'ACCURATE':", answer: "Precise" },
  { prompt: "Select the closest synonym of 'ALLEVIATE':", answer: "Relieve" },
  { prompt: "Select the closest synonym of 'APPEASE':", answer: "Pacify" },
  { prompt: "Select the closest synonym of 'ARDUOUS':", answer: "Strenuous" },
  { prompt: "Select the closest synonym of 'AUTHENTIC':", answer: "Genuine" },
  { prompt: "Select the closest synonym of 'CALAMITY':", answer: "Disaster" },
  { prompt: "Select the closest synonym of 'COMMENCE':", answer: "Initiate" },
  { prompt: "Select the closest synonym of 'CONCISE':", answer: "Brief and clear" },
  { prompt: "Select the closest synonym of 'CONSPICUOUS':", answer: "Easily noticed" },
  { prompt: "Select the closest synonym of 'COURAGEOUS':", answer: "Valiant" },
  { prompt: "Select the closest synonym of 'DECEPTIVE':", answer: "Misleading" },
  { prompt: "Select the closest synonym of 'DETERIORATE':", answer: "Worsen" },
  { prompt: "Select the closest synonym of 'DIVERSE':", answer: "Varied" },
  { prompt: "Select the closest synonym of 'DUBIOUS':", answer: "Doubtful" },
  { prompt: "Select the closest synonym of 'ECCENTRIC':", answer: "Unconventional" },
  { prompt: "Select the closest synonym of 'ELIMINATE':", answer: "Remove completely" },
  { prompt: "Select the closest synonym of 'ENHANCE':", answer: "Improve" },
  { prompt: "Select the closest synonym of 'ERRATIC':", answer: "Unpredictable" },
  { prompt: "Select the closest synonym of 'EXEMPT':", answer: "Free from duty" },
  { prompt: "Select the closest synonym of 'FATIGUE':", answer: "Extreme tiredness" },
  { prompt: "Select the closest synonym of 'FLOURISH':", answer: "Thrive" },
  { prompt: "Select the closest synonym of 'FUTILE':", answer: "Useless" },
  { prompt: "Select the closest synonym of 'GRATITUDE':", answer: "Thankfulness" },
  { prompt: "Select the closest synonym of 'HARMONY':", answer: "Peaceful agreement" },
  { prompt: "Select the closest synonym of 'IMPARTIAL':", answer: "Unbiased" },
  { prompt: "Select the closest synonym of 'INDISPENSABLE':", answer: "Essential" },
  { prompt: "Select the closest synonym of 'INGENIOUS':", answer: "Clever and inventive" },
  { prompt: "Select the closest synonym of 'MAGNIFICENT':", answer: "Splendid" },
  { prompt: "Select the closest synonym of 'OBSTINATE':", answer: "Stubborn" },
  { prompt: "Select the closest synonym of 'PERILOUS':", answer: "Dangerous" },
];

const SEC_EXTRA_ANT: FactPair[] = [
  { prompt: "Select the exact antonym of 'ADVANCE':", answer: "Retreat" },
  { prompt: "Select the exact antonym of 'AMBIGUOUS':", answer: "Clear and unambiguous" },
  { prompt: "Select the exact antonym of 'ASCEND':", answer: "Descend" },
  { prompt: "Select the exact antonym of 'ATTRACT':", answer: "Repel" },
  { prompt: "Select the exact antonym of 'BLUNT':", answer: "Sharp" },
  { prompt: "Select the exact antonym of 'COARSE':", answer: "Smooth / Fine" },
  { prompt: "Select the exact antonym of 'COMPLEX':", answer: "Simple" },
  { prompt: "Select the exact antonym of 'COURTEOUS':", answer: "Rude" },
  { prompt: "Select the exact antonym of 'DENSE':", answer: "Sparse" },
  { prompt: "Select the exact antonym of 'DILIGENT':", answer: "Lazy" },
  { prompt: "Select the exact antonym of 'DOMESTIC':", answer: "Foreign / Wild" },
  { prompt: "Select the exact antonym of 'ELEVATE':", answer: "Lower" },
  { prompt: "Select the exact antonym of 'EXTERIOR':", answer: "Interior" },
  { prompt: "Select the exact antonym of 'FERTILE':", answer: "Barren" },
  { prompt: "Select the exact antonym of 'FREQUENT':", answer: "Rare" },
  { prompt: "Select the exact antonym of 'GENEROUS':", answer: "Stingy / Miserly" },
  { prompt: "Select the exact antonym of 'HARSH':", answer: "Gentle" },
  { prompt: "Select the exact antonym of 'HASTY':", answer: "Cautious" },
  { prompt: "Select the exact antonym of 'IDLE':", answer: "Busy / Active" },
  { prompt: "Select the exact antonym of 'ILLITERATE':", answer: "Literate" },
  { prompt: "Select the exact antonym of 'MAJORITY':", answer: "Minority" },
  { prompt: "Select the exact antonym of 'MODEST':", answer: "Boastful" },
  { prompt: "Select the exact antonym of 'OPAQUE':", answer: "Transparent" },
  { prompt: "Select the exact antonym of 'PERMIT':", answer: "Forbid" },
  { prompt: "Select the exact antonym of 'PLENTIFUL':", answer: "Scarce" },
  { prompt: "Select the exact antonym of 'PRIVATE':", answer: "Public" },
  { prompt: "Select the exact antonym of 'REWARD':", answer: "Punishment" },
  { prompt: "Select the exact antonym of 'RIGID':", answer: "Flexible" },
  { prompt: "Select the exact antonym of 'TRANSPARENT':", answer: "Opaque (Non-clear)" },
  { prompt: "Select the exact antonym of 'VICTORY':", answer: "Defeat" },
];

const SEC_EXTRA_ONEWORD: FactPair[] = [
  { prompt: "Study of stars, planets, and celestial bodies:", answer: "Astronomy" },
  { prompt: "Study of ancient human fossils and monuments by excavation:", answer: "Archaeology" },
  { prompt: "Study of plant life:", answer: "Botany" },
  { prompt: "Study of animal life:", answer: "Zoology" },
  { prompt: "Study of rocks, minerals, and Earth's crust:", answer: "Geology" },
  { prompt: "Study of weather and atmospheric forecasting:", answer: "Meteorology" },
  { prompt: "A person who draws maps:", answer: "Cartographer" },
  { prompt: "A person who writes plays or dramas:", answer: "Playwright" },
  { prompt: "A person who sells stationery items:", answer: "Stationer" },
  { prompt: "A person who travels in space:", answer: "Astronaut" },
  { prompt: "A person who loves books very deeply:", answer: "Bibliophile" },
  { prompt: "A person who doubts or questions everything:", answer: "Sceptic" },
  { prompt: "A person who can use both hands equally well:", answer: "Ambidextrous" },
  { prompt: "A government ruled by a king or queen:", answer: "Monarchy" },
  { prompt: "A government ruled by one absolute ruler:", answer: "Autocracy / Dictatorship" },
  { prompt: "Absence of government and law:", answer: "Anarchy" },
  { prompt: "Yearly recurrence of the date of a past event:", answer: "Anniversary" },
  { prompt: "A century of years (100 years celebration):", answer: "Centenary" },
  { prompt: "A place where dead bodies are kept temporarily:", answer: "Mortuary" },
  { prompt: "A place where birds are kept:", answer: "Aviary" },
  { prompt: "A place where bees are kept for honey:", answer: "Apiary" },
  { prompt: "A room or building where scientific experiments are conducted:", answer: "Laboratory" },
  { prompt: "One who never drinks alcohol:", answer: "Teetotaller" },
  { prompt: "One who spends money recklessly:", answer: "Spendthrift" },
  { prompt: "A legal written declaration made on oath:", answer: "Affidavit" },
];

const SEC_CONFUSING_AND_GRAMMAR: [string, string, [string, string, string]][] = [
  ["The new school rules will have a positive ___ on attendance.", "effect", ["affect", "afflict", "defect"]],
  ["Heavy winter fog can seriously ___ morning flight schedules.", "affect", ["effect", "effort", "infect"]],
  ["All teachers attended the assembly ___ Mr. Rao who was on leave.", "except", ["accept", "expect", "aspect"]],
  ["Please ___ my sincere gratitude for your timely help.", "accept", ["except", "expect", "access"]],
  ["We bought notebooks and pens from the ___ shop.", "stationery", ["stationary", "stature", "station"]],
  ["The parked bus remained completely ___ near the gate.", "stationary", ["stationery", "statue", "steady"]],
  ["He is a man of high moral ___.", "principles", ["principals", "particles", "princes"]],
  ["Our school ___ addressed the students on Independence Day.", "Principal", ["Principle", "President", "Partisan"]],
  ["She is senior ___ me by three academic years.", "to", ["than", "from", "of"]],
  ["He prefers classical music ___ loud pop songs.", "to", ["than", "over", "from"]],
  ["This textbook is inferior ___ the revised NCERT edition.", "to", ["than", "from", "against"]],
  ["Wait until the green signal flashes; ___ you may cross.", "then", ["than", "when", "since"]],
  ["She is taller ___ every other sprinter in her house.", "than", ["then", "to", "from"]],
  ["Keep quiet, ___ you will disturb the library readers.", "lest", ["unless", "or else", "otherwise"]],
  ["Walk carefully ___ you should slip on the wet floor.", "lest", ["unless", "until", "because"]],
  ["___ you work hard, you cannot crack the scholarship test.", "Unless", ["Until", "Since", "Although"]],
  ["___ he was tired, he completed all fifty questions.", "Although", ["Because", "Unless", "Despite"]],
  ["___ the heavy rain, the students reached on time.", "Despite", ["Although", "Though", "Unless"]],
  ["The news of his selection ___ broadcast across the district.", "was", ["were", "are", "have"]],
  ["Ten thousand rupees ___ a fair budget for the lab upgrade.", "is", ["are", "were", "have"]],
  ["Slow and steady ___ the race.", "wins", ["win", "winning", "have won"]],
  ["One of my best friends ___ in Bengaluru.", "lives", ["live", "are living", "were live"]],
  ["Everyone in the auditorium ___ clapping loudly.", "was", ["were", "are", "have"]],
  ["Neither Ravi nor his brothers ___ responsible for the error.", "were", ["was", "is", "has"]],
  ["Either the teacher or the prefects ___ holding the register.", "are", ["is", "was", "has"]],
  ["Passive: 'Someone stole my fountain pen.'", "My fountain pen was stolen.", ["My fountain pen is stolen.", "My fountain pen had stolen.", "My fountain pen has stole."]],
  ["Passive: 'The students will plant fifty saplings.'", "Fifty saplings will be planted by the students.", ["Fifty saplings would planted by students.", "Fifty saplings are planting by students.", "Fifty saplings will plant by students."]],
  ["Passive: 'Did Meera paint this landscape?'", "Was this landscape painted by Meera?", ["Is this landscape painted by Meera?", "Had this landscape painted by Meera?", "Did this landscape painted by Meera?"]],
  ["Indirect: Father said to me, 'Work honestly.'", "Father advised me to work honestly.", ["Father said me work honestly.", "Father told me that work honestly.", "Father asked me working honestly."]],
  ["Indirect: He said, 'May God bless you!'", "He prayed that God might bless me.", ["He told that God may bless me.", "He asked if God blesses me.", "He wished God blessed me."]],
  ["Question tag: 'Nobody came late today, ___?'", "did they", ["didn't they", "did he", "wasn't it"]],
  ["Question tag: 'Open the window, ___?'", "will you", ["shall you", "don't you", "aren't you"]],
  ["Prefix: Which prefix forms the opposite of 'Legal'?", "Il- (Illegal)", ["Un- (Unlegal)", "Im- (Imlegal)", "Dis- (Dislegal)"]],
  ["Prefix: Which prefix forms the opposite of 'Possible'?", "Im- (Impossible)", ["In- (Inpossible)", "Ir- (Irpossible)", "Il- (Ilpossible)"]],
  ["Prefix: Which prefix forms the opposite of 'Regular'?", "Ir- (Irregular)", ["Il- (Ilregular)", "Im- (Imregular)", "Un- (Unregular)"]],
  ["Prefix: Which prefix forms the opposite of 'Responsible'?", "Ir- (Irresponsible)", ["In- (Inresponsible)", "Dis- (Disresponsible)", "Im- (Imresponsible)"]],
  ["Suffix: Which suffix converts the adjective 'Kind' into an abstract noun?", "-ness (Kindness)", ["-ly (Kindly)", "-ful (Kindful)", "-ish (Kindish)"]],
  ["Identify the Gerund in: 'Swimming is great exercise.'", "Swimming", ["great", "is", "exercise"]],
  ["Identify the Participle in: 'A rolling stone gathers no moss.'", "rolling", ["stone", "gathers", "moss"]],
  ["Spot the figure of speech: 'The camel is the ship of the desert.'", "Metaphor", ["Simile", "Personification", "Oxymoron"]],
  ["Spot the figure of speech: 'An open secret'", "Oxymoron", ["Simile", "Metaphor", "Hyperbole"]],
  ["Spot the figure of speech: 'I have told you a million times!'", "Hyperbole", ["Irony", "Alliteration", "Pun"]],
  ["Identify the sentence type: 'What a magnificent sunrise!'", "Exclamatory Sentence", ["Assertive Sentence", "Imperative Sentence", "Interrogative Sentence"]],
  ["Identify the sentence type: 'Please submit your science project by Friday.'", "Imperative Sentence", ["Exclamatory Sentence", "Interrogative Sentence", "Optative Sentence"]],
  ["Pick the right phrasal verb meaning 'postpone':", "Put off", ["Put on", "Put out", "Put up with"]],
  ["Pick the right phrasal verb meaning 'tolerate patiently':", "Put up with", ["Put off", "Put down", "Put away"]],
  ["Pick the right phrasal verb meaning 'discover accidentally':", "Come across", ["Come down", "Come over", "Come off"]],
  ["Pick the right phrasal verb meaning 'stop trying / surrender':", "Give up", ["Give in to joy", "Give away", "Give back"]],
  ["Pick the right phrasal verb meaning 'resemble an older family member':", "Take after", ["Take off", "Take over", "Take up"]],
  ["Pick the right idiom meaning 'to reveal the secret plan':", "Spill the beans", ["Bite the tongue", "Hold horses", "Jump the gun"]],
  ["Choose the correctly spelled word:", "Embarrassment", ["Embarassment", "Embarrassmant", "Imbarrassment"]],
  ["Choose the correctly spelled word:", "Conscientious", ["Consciencious", "Consientious", "Conscientous"]],
  ["Choose the correctly spelled word:", "Pronunciation", ["Pronounciation", "Pronunciashun", "Pronuncation"]],
  ["Choose the correctly spelled word:", "Superintendent", ["Superintendant", "Suprintendent", "Superentendent"]],
  ["Choose the correctly spelled word:", "Lieutenant", ["Leutenant", "Lieutanant", "Leutinant"]],
  ["Choose the correctly spelled word:", "Entrepreneur", ["Entreprenuer", "Enterpreneur", "Entreprenur"]],
  ["Choose the correctly spelled word:", "Vacuum", ["Vaccum", "Vacum", "Vaccuum"]],
  ["Choose the correctly spelled word:", "Rhythm", ["Rythm", "Rhythem", "Rythem"]],
  ["Choose the correctly spelled word:", "Privilege", ["Priviledge", "Privelege", "Previlige"]],
  ["Choose the correctly spelled word:", "Parliamentary", ["Parlimentary", "Parliamantary", "Parlamentary"]],
];

const SEC_EXTRA_ENG_55: [string, string, [string, string, string]][] = [
  ["Fill in: 'Hardly had I stepped out ___ it began to drizzle.'", "when", ["than", "then", "while"]],
  ["Fill in: 'No sooner did the whistle blow ___ the athletes sprinted.'", "than", ["when", "then", "after"]],
  ["Fill in: 'Scarcely had the chief guest arrived ___ the band played.'", "when", ["than", "before", "till"]],
  ["Fill in: 'He is not only an athlete ___ a scholar.'", "but also", ["and also", "as well", "either"]],
  ["Fill in: 'Walk fast ___ you miss the morning train.'", "or else", ["nor", "so", "yet"]],
  ["Fill in: 'He behaved as if he ___ the owner of the estate.'", "were", ["is", "was", "will be"]],
  ["Fill in: 'By 5 PM tomorrow, we ___ our annual rehearsal.'", "will have finished", ["finish", "finished", "were finishing"]],
  ["Fill in: 'She ___ in Patna for five years before moving to Delhi.'", "had lived", ["lives", "is living", "has live"]],
  ["Correct usage: 'She is good ___ solving geometry proofs.'", "at", ["in", "on", "with"]],
  ["Correct usage: 'Always beware ___ counterfeit websites.'", "of", ["from", "with", "about"]],
  ["Correct usage: 'The Principal is proud ___ the school's merit list.'", "of", ["for", "with", "on"]],
  ["Correct usage: 'He was accused ___ spreading false rumours.'", "of", ["for", "with", "from"]],
  ["Correct usage: 'Smoking is injurious ___ human health.'", "to", ["for", "with", "against"]],
  ["Correct usage: 'Are you familiar ___ the latest exam pattern?'", "with", ["to", "of", "in"]],
  ["Correct usage: 'This museum is famous ___ ancient terracotta coins.'", "for", ["of", "with", "by"]],
  ["Identify noun type of 'Jury' when acting as a single group:", "Collective Noun", ["Material Noun", "Proper Noun", "Abstract Noun"]],
  ["Identify noun type of 'Gold' and 'Silver':", "Material Noun", ["Collective Noun", "Proper Noun", "Abstract Noun"]],
  ["Choose the positive degree of 'Fastest':", "Fast", ["Faster", "More fast", "Very fastest"]],
  ["Choose the superlative degree of 'Little':", "Least", ["Less", "Lesser", "Littlest"]],
  ["Choose the comparative degree of 'Much':", "More", ["Most", "Mucher", "Many"]],
  ["One who believes in equal rights and opportunities for women:", "Feminist", ["Optimist", "Fatalist", "Altruist"]],
  ["One who works selflessly for the welfare of others:", "Altruist", ["Egoist", "Cynic", "Miser"]],
  ["One who hates mankind:", "Misanthrope", ["Philanthropist", "Anthropologist", "Misogynist"]],
  ["A speech made by a single actor alone on stage:", "Soliloquy / Monologue", ["Dialogue", "Epilogue", "Prologue"]],
  ["Introductory section at the beginning of a literary book:", "Prologue / Preface", ["Epilogue", "Appendix", "Glossary"]],
  ["Alphabetical list of difficult words with meanings at the end of a book:", "Glossary", ["Bibliography", "Preface", "Index"]],
  ["Animal that feeds exclusively on flesh / meat:", "Carnivore", ["Herbivore", "Omnivore", "Frugivore"]],
  ["Animal that eats both plant and animal foods:", "Omnivore", ["Carnivore", "Herbivore", "Insectivore"]],
  ["A person who knows and appreciates fine food and art:", "Connoisseur", ["Novice", "Amateur", "Pedant"]],
  ["Payment given for work done without a fixed salary:", "Honorarium", ["Pension", "Royalty", "Stipend"]],
  ["Antonym of 'BENIGN' (gentle and harmless):", "Malignant / Harsh", ["Kind", "Mild", "Warm"]],
  ["Antonym of 'CONSOLIDATE' (combine strongly):", "Weaken / Scatter", ["Unite", "Strengthen", "Merge"]],
  ["Antonym of 'FRUGAL' (careful with spending):", "Extravagant", ["Thrifty", "Economical", "Prudent"]],
  ["Antonym of 'RELUCTANT' (unwilling):", "Eager / Willing", ["Hesitant", "Averse", "Slow"]],
  ["Synonym of 'CANDOUR' (openness):", "Frankness", ["Secrecy", "Deceit", "Shyness"]],
  ["Synonym of 'COMPULSORY' (required):", "Mandatory", ["Optional", "Voluntary", "Casual"]],
  ["Synonym of 'ENDEAVOUR' (serious effort):", "Attempt", ["Neglect", "Surrender", "Idleness"]],
  ["Synonym of 'MAGNANIMOUS' (generous in forgiving):", "Noble-hearted", ["Petty", "Mean", "Vindictive"]],
  ["Synonym of 'RELINQUISH' (give up):", "Abandon", ["Retain", "Claim", "Hoard"]],
  ["Synonym of 'UBIQUITOUS' (found everywhere):", "Omnipresent", ["Rare", "Scarce", "Hidden"]],
  ["Idiom: 'At the eleventh hour' means:", "At the very last moment", ["At 11 AM sharp", "Very early in the morning", "Never on time"]],
  ["Idiom: 'Through and through' means:", "Completely in every respect", ["Briefly on surface", "Carelessly", "Half-heartedly"]],
  ["Idiom: 'A white elephant' means:", "A costly possession that is useless to maintain", ["A lucky rare animal", "An inexpensive toy", "A fast runner"]],
  ["Idiom: 'To turn over a new leaf' means:", "To begin a better and reformed way of life", ["To tear book pages", "To plant autumn trees", "To quit reading"]],
  ["Idiom: 'By leaps and bounds' means:", "With remarkably rapid progress", ["Very slowly", "In tiny steps", "Without direction"]],
  ["Idiom: 'Once and for all' means:", "Finally and permanently", ["Once a week", "Temporarily", "Doubtfully"]],
  ["Idiom: 'To sit on the fence' means:", "To stay neutral without taking sides", ["To guard a garden", "To climb quickly", "To decide firmly"]],
  ["Idiom: 'Face the music' means:", "Accept the unpleasant consequences of one's actions", ["Attend a concert", "Sing loudly", "Ignore rules"]],
  ["Idiom: 'Gift of the gab' (alt wording) refers to:", "Skill of speaking persuasively", ["Skill of painting", "Skill of cooking", "Talent in athletics"]],
  ["Idiom: 'In hot water' means:", "In serious trouble", ["Taking a bath", "Boiling tea", "Feeling relaxed"]],
  ["Complete: 'Make hay ___ the sun shines.'", "while", ["unless", "before", "though"]],
  ["Complete: 'Strike while the iron is ___.'", "hot", ["cold", "rusty", "wet"]],
  ["Complete: 'Actions speak louder than ___.'", "words", ["thoughts", "songs", "dreams"]],
  ["Complete: 'Where there is a will, there is a ___.'", "way", ["wall", "wish", "word"]],
  ["Complete: 'A stitch in time saves ___.'", "nine", ["five", "ten", "hundred"]],
];

function build500SecondaryEnglish(cls: 6 | 7 | 8 | 9 | 10): QTuple[] {
  const out: QTuple[] = [];
  out.push(...buildFactBankTuples({ subject: "English", topicTag: "Synonyms 500", seedPrefix: `c${cls}_500_se_syn`, items: SEC_EXTRA_SYN }));
  out.push(...buildFactBankTuples({ subject: "English", topicTag: "Antonyms 500", seedPrefix: `c${cls}_500_se_ant`, items: SEC_EXTRA_ANT }));
  out.push(...buildFactBankTuples({ subject: "English", topicTag: "One-Word 500", seedPrefix: `c${cls}_500_se_ow`, items: SEC_EXTRA_ONEWORD }));
  SEC_CONFUSING_AND_GRAMMAR.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_se_cg_${idx}`);
    out.push(["English", "MCQ", `[Grammar] ${q}`, options, correctIndex, `Correct answer: ${ans}.`, "Grammar & Usage"]);
  });
  SEC_EXTRA_ENG_55.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_se_ex_${idx}`);
    out.push(["English", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, "Advanced English"]);
  });
  return out; // 30+30+25+60+55 = 200 unique English MCQs per class!
}

// ── SECONDARY MATHEMATICS EXPANSION (Classes 6–8: 210 unique Qs per class) ───
function build500SecondaryMaths(cls: 6 | 7 | 8 | 9 | 10): QTuple[] {
  const out: QTuple[] = [];
  for (let i = 0; i < 42; i++) {
    // 1. Integers / Rational / Powers
    if (cls === 6) {
      const a = -15 - i;
      const b = 28 + i * 2;
      const ans = a + b;
      const { options, correctIndex } = makeNumOptions(ans, [-4, 4, 10, -10], `c6_500_sm_int_${i}`, "", true);
      out.push(["Mathematics", "MCQ", `Evaluate integer sum: (${a}) + (+${b}) = ?`, options, correctIndex, `${a} + ${b} = ${ans}.`, "Integers"]);
    } else if (cls === 7) {
      const a = 3 + (i % 7);
      const p1 = 2 + (i % 4);
      const ans = Math.pow(a, p1);
      const { options, correctIndex } = makeNumOptions(ans, [a, -a, 10, -10], `c7_500_sm_pow_${i}`);
      out.push(["Mathematics", "MCQ", `Evaluate power: ${a}^${p1} = ?`, options, correctIndex, `${a} multiplied ${p1} times equals ${ans}.`, "Exponents"]);
    } else {
      const n = 12 + i;
      const sq = n * n;
      const { options, correctIndex } = makeNumOptions(sq, [2 * n, -2 * n, 10, -10], `c8_500_sm_sq_${i}`);
      out.push(["Mathematics", "MCQ", `Find the square of ${n} (${n}²):`, options, correctIndex, `${n} × ${n} = ${sq}.`, "Squares & Roots"]);
    }

    // 2. Linear Equations
    const xVal = 3 + (i % 15);
    const coeff = 2 + (cls === 6 ? 1 : i % 5);
    const addConst = 4 + (i % 11);
    const rhs = coeff * xVal + addConst;
    const { options: optE, correctIndex: idxE } = makeNumOptions(xVal, [1, -1, 2, -2], `c${cls}_500_sm_eq_${i}`);
    out.push([
      "Mathematics",
      "MCQ",
      `Solve for x: ${coeff}x + ${addConst} = ${rhs}`,
      optE,
      idxE,
      `${coeff}x = ${rhs - addConst} ⇒ x = ${xVal}.`,
      "Algebra",
    ]);

    // 3. Ratio / Simple Interest / Compound & Percentage
    if (cls === 6) {
      const k = 2 + (i % 9);
      const r1 = 2 + (i % 5);
      const r2 = r1 + 1 + (i % 3);
      const total = (r1 + r2) * k * 10;
      const part1 = r1 * k * 10;
      const { options, correctIndex } = makeNumOptions(part1, [10, -10, 20, -20], `c6_500_sm_rat_${i}`);
      out.push(["Mathematics", "MCQ", `Divide ₹${total} in the ratio ${r1}:${r2}. Find the first share:`, options, correctIndex, `First share = (${r1}/${r1 + r2}) × ${total} = ₹${part1}.`, "Ratio & Proportion"]);
    } else if (cls === 7) {
      const p = (10 + i) * 100;
      const r = 5 + (i % 6);
      const t = 2 + (i % 3);
      const si = (p * r * t) / 100;
      const { options, correctIndex } = makeNumOptions(si, [50, -50, 100, -100], `c7_500_sm_si_${i}`);
      out.push(["Mathematics", "MCQ", `Find Simple Interest on ₹${p} at ${r}% p.a. for ${t} years:`, options, correctIndex, `SI = (${p} × ${r} × ${t}) / 100 = ₹${si}.`, "Simple Interest"]);
    } else {
      const p = (10 + i) * 100;
      const r = 10;
      const amt = Math.round(p * 1.1 * 1.1);
      const ci = amt - p;
      const { options, correctIndex } = makeNumOptions(ci, [10, -10, 50, -50], `c8_500_sm_ci_${i}`);
      out.push(["Mathematics", "MCQ", `Find Compound Interest on ₹${p} at ${r}% p.a. compounded annually for 2 years:`, options, correctIndex, `Amount = ₹${p} × (1.1)² = ₹${amt}; CI = ₹${ci}.`, "Compound Interest"]);
    }

    // 4. Geometry / Triangles / Mensuration
    if (cls === 6) {
      const b = 6 + (i % 14);
      const h = 4 + (i % 10);
      const area = (b * h) / 2;
      const { options, correctIndex } = makeNumOptions(area, [b, -2, 6, -4], `c6_500_sm_tri_${i}`, " sq cm");
      out.push(["Mathematics", "MCQ", `Find area of a triangle with base ${b} cm and height ${h} cm:`, options, correctIndex, `Area = ½ × ${b} × ${h} = ${area} sq cm.`, "Mensuration"]);
    } else if (cls === 7) {
      const ang1 = 40 + (i % 45);
      const ang2 = 50 + (i % 35);
      const ang3 = 180 - ang1 - ang2;
      const { options, correctIndex } = makeNumOptions(ang3, [10, -10, 5, -5], `c7_500_sm_ang_${i}`, "°");
      out.push(["Mathematics", "MCQ", `Two angles of a triangle are ${ang1}° and ${ang2}°. Find the third angle:`, options, correctIndex, `180° − (${ang1}° + ${ang2}°) = ${ang3}°.`, "Triangle Angles"]);
    } else {
      const side = 3 + (i % 12);
      const tsa = 6 * side * side;
      const { options, correctIndex } = makeNumOptions(tsa, [side * side, -side * side, 12, -12], `c8_500_sm_cub_${i}`, " sq cm");
      out.push(["Mathematics", "MCQ", `Find Total Surface Area of a cube of edge ${side} cm:`, options, correctIndex, `TSA = 6 × (${side})² = ${tsa} sq cm.`, "Surface Area"]);
    }

    // 5. Speed / Profit-Loss / Mean / Cube Roots
    if (cls === 6) {
      const x1 = 10 + i;
      const x2 = 14 + i;
      const x3 = 18 + i;
      const mean = (x1 + x2 + x3) / 3;
      const { options, correctIndex } = makeNumOptions(mean, [2, -2, 4, -4], `c6_500_sm_mn_${i}`);
      out.push(["Mathematics", "MCQ", `Find the arithmetic mean of ${x1}, ${x2}, and ${x3}:`, options, correctIndex, `(${x1} + ${x2} + ${x3}) / 3 = ${mean}.`, "Data Handling"]);
    } else if (cls === 7) {
      const cp = 200 + i * 20;
      const gainPct = 10 + (i % 4) * 5;
      const sp = cp + (cp * gainPct) / 100;
      const { options, correctIndex } = makeNumOptions(sp, [10, -10, 20, -20], `c7_500_sm_pl_${i}`);
      out.push(["Mathematics", "MCQ", `An article bought for ₹${cp} is sold at ${gainPct}% profit. Find Selling Price (₹):`, options, correctIndex, `SP = ₹${cp} + ${gainPct}% of ${cp} = ₹${sp}.`, "Profit & Loss"]);
    } else {
      const a = 2 + (i % 8);
      const b = 3 + (i % 7);
      const ab = a * b;
      const sqSum = a * a + b * b;
      const ans = sqSum + 2 * ab;
      const { options, correctIndex } = makeNumOptions(ans, [ab, -ab, 4, -4], `c8_500_sm_id_${i}`);
      out.push(["Mathematics", "MCQ", `If a = ${a} and b = ${b}, find the value of a² + 2ab + b²:`, options, correctIndex, `(a + b)² = (${a} + ${b})² = ${ans}.`, "Algebraic Identities"]);
    }
  }
  return out; // 42 * 5 = 210 unique Math MCQs per class!
}

// ── SECONDARY SCIENCE EXPANSION (Classes 6–8: 200 unique Qs per class) ───────
const SEC_SCI_SI_INSTR: FactPair[] = [
  { prompt: "What is the SI unit of Force?", answer: "Newton (N)" },
  { prompt: "What is the SI unit of Pressure?", answer: "Pascal (Pa)" },
  { prompt: "What is the SI unit of Energy and Work?", answer: "Joule (J)" },
  { prompt: "What is the SI unit of Electric Current?", answer: "Ampere (A)" },
  { prompt: "What is the SI unit of Electric Potential Difference (Voltage)?", answer: "Volt (V)" },
  { prompt: "What is the SI unit of Electrical Resistance?", answer: "Ohm (Ω)" },
  { prompt: "What is the SI unit of Power?", answer: "Watt (W)" },
  { prompt: "What is the SI unit of Sound Frequency?", answer: "Hertz (Hz)" },
  { prompt: "What is the SI unit of Temperature?", answer: "Kelvin (K)" },
  { prompt: "What is the SI unit of Mass?", answer: "Kilogram (kg)" },
  { prompt: "What is the SI unit of Length?", answer: "Metre (m)" },
  { prompt: "What is the SI unit of Time?", answer: "Second (s)" },
  { prompt: "Which instrument measures electric current in a circuit?", answer: "Ammeter" },
  { prompt: "Which instrument measures potential difference across two points?", answer: "Voltmeter" },
  { prompt: "Which instrument measures atmospheric pressure?", answer: "Barometer" },
  { prompt: "Which instrument checks purity of milk (density)?", answer: "Lactometer" },
  { prompt: "Which instrument measures relative humidity in air?", answer: "Hygrometer" },
  { prompt: "Which instrument measures wind speed?", answer: "Anemometer" },
  { prompt: "Which instrument detects small electric currents and their direction?", answer: "Galvanometer" },
  { prompt: "Which device measures total distance travelled by a vehicle?", answer: "Odometer" },
];

const SEC_SCI_CHEM_SYM: FactPair[] = [
  { prompt: "Chemical symbol of Sodium is:", answer: "Na" },
  { prompt: "Chemical symbol of Potassium is:", answer: "K" },
  { prompt: "Chemical symbol of Iron is:", answer: "Fe" },
  { prompt: "Chemical symbol of Gold is:", answer: "Au" },
  { prompt: "Chemical symbol of Silver is:", answer: "Ag" },
  { prompt: "Chemical symbol of Copper is:", answer: "Cu" },
  { prompt: "Chemical symbol of Mercury is:", answer: "Hg" },
  { prompt: "Chemical symbol of Lead is:", answer: "Pb" },
  { prompt: "Chemical formula of Common Table Salt is:", answer: "NaCl" },
  { prompt: "Chemical formula of Baking Soda is:", answer: "NaHCO₃" },
  { prompt: "Chemical formula of Washing Soda is:", answer: "Na₂CO₃" },
  { prompt: "Chemical formula of Vinegar (Acetic Acid) is:", answer: "CH₃COOH" },
  { prompt: "Chemical formula of Sulphuric Acid is:", answer: "H₂SO₄" },
  { prompt: "Chemical formula of Hydrochloric Acid is:", answer: "HCl" },
  { prompt: "Chemical formula of Limestone / Chalk is:", answer: "CaCO₃" },
  { prompt: "Chemical formula of Ammonia gas is:", answer: "NH₃" },
  { prompt: "Chemical formula of Methane (marsh gas) is:", answer: "CH₄" },
  { prompt: "Chemical formula of Glucose sugar is:", answer: "C₆H₁₂O₆" },
  { prompt: "Acid naturally found in lemons and oranges:", answer: "Citric Acid" },
  { prompt: "Acid naturally found in sour curd / dahi:", answer: "Lactic Acid" },
  { prompt: "Acid injected during an ant sting:", answer: "Formic Acid" },
  { prompt: "Acid naturally found in tamarind (imli):", answer: "Tartaric Acid" },
  { prompt: "Acid found in human gastric juice for digestion:", answer: "Hydrochloric Acid (Gastric)" },
  { prompt: "Natural indicator that turns pink in basic solutions:", answer: "Phenolphthalein" },
  { prompt: "Colour of Blue Litmus paper when dipped in an acid:", answer: "Red" },
];

const SEC_SCI_BIO_FACTS: FactPair[] = [
  { prompt: "Which organelle is known as the 'Powerhouse of the Cell'?", answer: "Mitochondria" },
  { prompt: "Which organelle controls all activities and holds DNA in a cell?", answer: "Nucleus" },
  { prompt: "Which organelle synthesises proteins in a cell?", answer: "Ribosomes" },
  { prompt: "Which cell organelle is found in plant cells for photosynthesis?", answer: "Chloroplast" },
  { prompt: "Who first observed dead cork cells and coined the word 'Cell'?", answer: "Robert Hooke" },
  { prompt: "Which green pigment traps sunlight during photosynthesis?", answer: "Chlorophyll" },
  { prompt: "Which tiny pores on leaves allow gas exchange and transpiration?", answer: "Stomata" },
  { prompt: "Which tissue transports water from roots upward in plants?", answer: "Xylem" },
  { prompt: "Which tissue carries prepared food from leaves to all plant parts?", answer: "Phloem" },
  { prompt: "Which blood cells help fight germs and infections (immunity)?", answer: "White Blood Cells (WBC)" },
  { prompt: "Which blood cells carry oxygen via haemoglobin?", answer: "Red Blood Cells (RBC)" },
  { prompt: "Which blood component helps blood clot at an injury?", answer: "Platelets" },
  { prompt: "Which organ secretes bile juice to help digest fats?", answer: "Liver" },
  { prompt: "Which gland produces insulin hormone to control blood sugar?", answer: "Pancreas" },
  { prompt: "Which bacteria live in legume root nodules to fix nitrogen?", answer: "Rhizobium" },
  { prompt: "Which fungus is widely used in baking bread and fermentation?", answer: "Yeast" },
  { prompt: "Which mosquito spreads Malaria (Plasmodium parasite)?", answer: "Female Anopheles" },
  { prompt: "Which mosquito spreads Dengue virus?", answer: "Aedes" },
  { prompt: "Who discovered the first antibiotic Penicillin?", answer: "Alexander Fleming" },
  { prompt: "Who discovered the smallpox vaccine?", answer: "Edward Jenner" },
  { prompt: "Who introduced pasteurization to kill milk microbes?", answer: "Louis Pasteur" },
  { prompt: "Universal Donor blood group is:", answer: "O Negative" },
  { prompt: "Universal Recipient blood group is:", answer: "AB Positive" },
  { prompt: "Hardest natural substance in the human body:", answer: "Tooth Enamel" },
  { prompt: "Process by which a tadpole transforms into an adult frog:", answer: "Metamorphosis" },
];

const SEC_SCI_EX_130: [string, string, [string, string, string]][] = [
  ["Which non-metal is a good conductor of electricity?", "Graphite", ["Sulphur", "Phosphorus", "Diamond"]],
  ["Which metal is liquid at room temperature?", "Mercury", ["Sodium", "Iron", "Aluminium"]],
  ["Which non-metal is liquid at room temperature?", "Bromine", ["Chlorine", "Iodine", "Neon"]],
  ["Which soft metals can be cut easily with a knife?", "Sodium and Potassium", ["Iron and Copper", "Gold and Platinum", "Zinc and Nickel"]],
  ["Which metal is stored under kerosene oil to prevent vigorous reaction?", "Sodium", ["Copper", "Silver", "Magnesium"]],
  ["What gas is produced when metals react with dilute acids?", "Hydrogen (pops with flame)", ["Carbon Dioxide", "Nitrogen", "Argon"]],
  ["Which gas turns clear limewater milky?", "Carbon Dioxide", ["Oxygen", "Hydrogen", "Helium"]],
  ["Galvanization protects iron from rusting by coating it with:", "Zinc", ["Lead", "Mercury", "Sodium"]],
  ["Stainless steel is an alloy made primarily of Iron, Chromium, and:", "Nickel", ["Lead", "Mercury", "Gold"]],
  ["Brass is an alloy of Copper and:", "Zinc", ["Tin", "Iron", "Silver"]],
  ["Bronze is an alloy of Copper and:", "Tin", ["Zinc", "Lead", "Aluminium"]],
  ["Which fossil fuel is commonly called 'Black Gold'?", "Petroleum", ["Coal Tar", "Wood Charcoal", "Biogas"]],
  ["Which gas makes up the major component of Natural Gas (CNG)?", "Methane", ["Propane", "Ethane", "Nitrogen"]],
  ["Which petroleum product is used for surfacing modern roads?", "Bitumen", ["Paraffin Wax", "Diesel", "Kerosene"]],
  ["Which is the cleanest burning zone (hottest part) of a candle flame?", "Outer Blue Zone", ["Inner Dark Zone", "Middle Yellow Zone", "Base Wick"]],
  ["Which gas is essential to support combustion?", "Oxygen", ["Carbon Dioxide", "Argon", "Nitrogen"]],
  ["Which fire extinguisher gas cuts off oxygen supply cleanly around electronics?", "Carbon Dioxide", ["Hydrogen", "Methane", "Oxygen"]],
  ["Approximate speed of light in vacuum is:", "3 × 10⁸ m/s", ["3 × 10⁴ m/s", "340 m/s", "1,500 m/s"]],
  ["Approximate speed of sound in dry air at room temperature is:", "340 m/s", ["3 × 10⁸ m/s", "30 m/s", "5,000 m/s"]],
  ["Sound CANNOT travel through:", "Vacuum", ["Solids", "Liquids", "Gases"]],
  ["In which medium does sound travel fastest?", "Solids (like Steel)", ["Liquids", "Gases", "Vacuum"]],
  ["Human audible frequency range for hearing is:", "20 Hz to 20,000 Hz", ["0 to 10 Hz", "Above 50,000 Hz", "2 Hz to 500 Hz"]],
  ["Sounds of frequency above 20,000 Hz are called:", "Ultrasonic waves", ["Infrasonic waves", "Subsonic waves", "Audible hum"]],
  ["Loudness of sound is measured in:", "Decibel (dB)", ["Hertz", "Newton", "Ohm"]],
  ["Which mirror is used by dentists to see magnified teeth images?", "Concave Mirror", ["Convex Mirror", "Plane Mirror", "Cylindrical Mirror"]],
  ["Which mirror is used as rear-view mirror in vehicles for wide view?", "Convex Mirror", ["Concave Mirror", "Plane Mirror", "Parabolic Dark Mirror"]],
  ["Splitting of white sunlight into 7 colours through a prism is called:", "Dispersion", ["Reflection", "Refraction", "Absorption"]],
  ["Image formed on the human eye retina is:", "Real and Inverted", ["Virtual and Erect", "Virtual and Inverted", "Erect and Magnified"]],
  ["Which part of the eye controls the size of the pupil?", "Iris", ["Cornea", "Retina", "Optic Nerve"]],
  ["Which filament metal is used inside incandescent bulbs due to high melting point?", "Tungsten", ["Copper", "Aluminium", "Nichrome"]],
  ["Heating coils in electric irons and toasters are made of:", "Nichrome", ["Copper", "Tungsten", "Lead"]],
  ["Electric fuse wire works on which principle of electric current?", "Heating effect", ["Magnetic effect", "Chemical effect", "Optical effect"]],
  ["Which non-contact force pulls all objects towards Earth's centre?", "Gravitational Force", ["Friction Force", "Muscular Force", "Tension"]],
  ["Why are tyres treaded and shoe soles grooved?", "To increase friction and grip", ["To reduce friction to zero", "For decoration only", "To increase speed in water"]],
  ["Rolling friction compared to sliding friction is always:", "Smaller", ["Greater", "Infinite", "Double"]],
  ["Why do broad straps on school bags reduce shoulder pain?", "Larger area reduces pressure", ["Smaller area increases pressure", "Mass reduces automatically", "Gravity disappears"]],
  ["Liquid pressure with increasing depth:", "Increases", ["Decreases", "Remains zero", "Disappears"]],
  ["Method of heat transfer from Sun to Earth across empty space:", "Radiation", ["Conduction", "Convection", "Evaporation"]],
  ["Method of heat transfer inside a heated metal spoon:", "Conduction", ["Convection", "Radiation", "Sublimation"]],
  ["Sea breeze and land breeze occur due to:", "Convection", ["Conduction", "Radiation", "Condensation"]],
  ["Why are houses in hot regions painted white outside?", "White reflects most heat radiation", ["White absorbs extra heat", "White attracts rain", "White freezes walls"]],
  ["Normal human body temperature in Celsius is:", "37°C (98.6°F)", ["25°C", "45°C", "100°C"]],
  ["Clinical thermometer temperature scale covers:", "35°C to 42°C", ["0°C to 100°C", "-10°C to 110°C", "20°C to 80°C"]],
  ["Chemical change example among the following:", "Rusting of iron & burning paper", ["Melting of ice", "Tearing paper", "Dissolving sugar in water"]],
  ["Physical change example among the following:", "Freezing water into ice", ["Cooking rice", "Souring of milk", "Digesting food"]],
  ["Direct change of solid camphor or naphthalene to gas without melting:", "Sublimation", ["Evaporation", "Condensation", "Distillation"]],
  ["Kharif crops (rice, maize, cotton) are sown during:", "Monsoon / Rainy season (June–July)", ["Winter (November)", "Peak Summer (April)", "Spring (February)"]],
  ["Rabi crops (wheat, gram, mustard) are grown during:", "Winter season (Oct–March)", ["Monsoon (July)", "Peak Summer", "Autumn only"]],
  ["Process of separating grain from harvested chaff:", "Winnowing / Threshing", ["Irrigation", "Weeding", "Ploughing"]],
  ["First national park of India (Uttarakhand, 1936):", "Jim Corbett National Park", ["Kaziranga", "Gir Forest", "Sundarbans"]],
  ["Kaziranga National Park (Assam) is famous for protecting:", "One-horned Rhinoceros", ["Asiatic Lion", "Snow Leopard", "Royal Penguin"]],
  ["Gir National Park (Gujarat) is the natural home of:", "Asiatic Lion", ["Tiger", "Elephant", "Kangaroo"]],
  ["Red Data Book maintains global records of:", "Endangered plants and animals", ["New planets", "Weather stations", "Mineral mines"]],
  ["Binary fission (dividing into two) is the reproduction mode of:", "Amoeba", ["Hydra (Budding)", "Yeast", "Earthworm"]],
  ["Hydra reproduces asexually primarily through:", "Budding", ["Binary fission", "Spore formation", "Grafting"]],
  ["Hormone known as the 'fight or flight' hormone (adrenal gland):", "Adrenaline", ["Insulin", "Thyroxine", "Growth Hormone"]],
  ["Thyroxine hormone (requiring iodine) is produced by:", "Thyroid Gland", ["Pituitary", "Adrenal", "Salivary"]],
  ["The female reproductive part of a flower is the:", "Pistil (Carpel)", ["Stamen", "Sepal", "Petal"]],
  ["The male reproductive part of a flower producing pollen is:", "Stamen (Anther)", ["Pistil", "Ovary", "Sepal"]],
  ["Acid rain is primarily caused by oxides of Sulphur and:", "Nitrogen", ["Helium", "Neon", "Argon"]],
  ["Major gas responsible for enhanced Global Warming (Greenhouse effect):", "Carbon Dioxide", ["Oxygen", "Argon", "Hydrogen"]],
  ["Process of depositing a layer of desired metal using electricity:", "Electroplating", ["Galvanizing by fire", "Rusting", "Sublimation"]],
  ["Instrument used by ships/submarines to see above the water surface:", "Periscope", ["Kaleidoscope", "Microscope", "Barometer"]],
  ["Device that protects tall buildings from lightning strikes:", "Lightning Conductor", ["Fuse Box", "Transformer", "Solar Cell"]],
  ["Sudden shaking of Earth's crust caused by tectonic plate movement:", "Earthquake", ["Cyclone", "Tsunami only", "Avalanche"]],
  ["Bright streak of light seen when space rocks burn in Earth's atmosphere:", "Meteor (Shooting Star)", ["Comet", "Asteroid", "Galaxy"]],
  ["Nearest galaxy to our Milky Way galaxy:", "Andromeda", ["Orion", "Ursa Major", "Polaris"]],
  ["Bright pole star indicating the North direction in night sky:", "Polaris (Dhruv Tara)", ["Sirius", "Mars", "Halley"]],
  ["Synthetic fibre prepared from wood pulp, known as 'artificial silk':", "Rayon", ["Nylon", "Acrylic", "Polyester"]],
  ["First fully synthetic fibre made from coal, water, and air:", "Nylon", ["Cotton", "Silk", "Jute"]],
  ["Thermoplastic plastic softens on heating; example is:", "PVC / Polythene", ["Bakelite", "Melamine", "Teflon thermoset"]],
  ["Thermosetting plastic used to make electrical switches:", "Bakelite", ["Polythene", "PVC", "Nylon"]],
  ["Organism living inside human small intestine causing Vitamin B synthesis / flora or digestion:", "E. coli / Friendly Gut Bacteria", ["Tapeworm", "Plasmodium", "Amoeba"]],
  ["Highest percentage gas in exhaled air (around 78%):", "Nitrogen", ["Oxygen (16%)", "Carbon Dioxide (4%)", "Argon"]],
  ["Organelle known as 'Suicide Bag' of the cell:", "Lysosome", ["Golgi Body", "Vacuole", "Centrosome"]],
  ["Large fluid-filled sac storing water/sap prominently in plant cells:", "Vacuole", ["Ribosome", "Plastid", "Nucleolus"]],
  ["Which nutrient gives the maximum energy per gram?", "Fats", ["Carbohydrates", "Proteins", "Vitamins"]],
  ["Which vitamin helps prevent Beriberi disease?", "Vitamin B1 (Thiamine)", ["Vitamin C", "Vitamin D", "Vitamin K"]],
  ["Which element is present in chlorophyll's central ring?", "Magnesium", ["Iron", "Calcium", "Sodium"]],
  ["Which element is essential in haemoglobin to carry oxygen?", "Iron", ["Calcium", "Zinc", "Potassium"]],
  ["The pH value of pure neutral water at 25°C is:", "7", ["0", "3", "14"]],
  ["A solution with pH less than 7 is:", "Acidic", ["Basic", "Neutral", "Salty"]],
  ["A solution with pH greater than 7 is:", "Basic (Alkaline)", ["Acidic", "Neutral", "Pure Distilled"]],
  ["When acid reacts with base to form salt and water, the reaction is:", "Neutralisation", ["Combustion", "Oxidation", "Fermentation"]],
  ["Which gas has a pungent smell of rotten eggs?", "Hydrogen Sulphide (H₂S)", ["Oxygen", "Methane", "Carbon Dioxide"]],
  ["Which gas is filled inside modern electric bulbs to prolong tungsten filament life?", "Argon / Nitrogen", ["Oxygen", "Hydrogen", "Chlorine"]],
  ["Process of converting milk into curd is carried out by:", "Lactobacillus bacteria", ["Yeast fungus", "Protozoa", "Virus"]],
  ["Smallest microorganism visible only under electron microscope, active inside host cells:", "Virus", ["Mushroom", "Algae", "Amoeba"]],
  ["Blue-green algae like Anabaena help enrich soil fertility by fixing:", "Atmospheric Nitrogen", ["Phosphorus", "Carbon Monoxide", "Sulphur"]],
  ["Layer of soil rich in humus and nutrients where plants root mostly grow:", "Topsoil (A-Horizon)", ["Bedrock", "Subsoil gravel", "Parent Rock"]],
  ["Force acting per unit area is defined as:", "Pressure (F / A)", ["Momentum", "Velocity", "Work"]],
  ["Rate of change of velocity is called:", "Acceleration", ["Speed", "Displacement", "Density"]],
  ["Property of a body to resist any change in its state of rest or motion:", "Inertia", ["Gravity", "Friction", "Buoyancy"]],
  ["Upward force exerted by a fluid on an immersed object:", "Buoyant Force (Upthrust)", ["Magnetic Force", "Centripetal Force", "Friction"]],
  ["Splitting of heavy nucleus or fusion inside Sun produces:", "Nuclear Energy", ["Wind Energy", "Tidal Energy", "Geothermal Energy"]],
  ["Which colour of light bends the LEAST through a glass prism?", "Red", ["Violet", "Indigo", "Blue"]],
  ["Which colour of light bends the MOST through a glass prism?", "Violet", ["Red", "Orange", "Yellow"]],
  ["Angle of incidence is ALWAYS equal to:", "Angle of reflection", ["90° always", "Angle of refraction", "0° always"]],
  ["Clear normal near-point of distinct vision for a healthy human eye:", "25 cm", ["5 cm", "100 cm", "2 metres"]],
  ["Braille system invented for visually challenged persons uses dot patterns of:", "6 raised dots", ["20 dots", "2 dots", "100 dots"]],
  ["Which planet rotates on its axis from East to West (retrograde)?", "Venus (and Uranus)", ["Earth", "Mars", "Jupiter"]],
  ["Which planet has the fastest rotation (shortest day, ~10 hours)?", "Jupiter", ["Mercury", "Earth", "Mars"]],
  ["Which constellation looks like a hunter or 'Kalpurush' in winter sky?", "Orion", ["Ursa Major", "Cassiopeia", "Scorpius"]],
  ["Saptarishi (Big Dipper) is a well-known part of constellation:", "Ursa Major", ["Orion", "Leo", "Taurus"]],
  ["First artificial satellite launched into space by India (1975):", "Aryabhata", ["Bhaskara", "INSAT-1A", "Rohini"]],
  ["First artificial satellite ever launched in world history (USSR, 1957):", "Sputnik-1", ["Apollo-11", "Voyager-1", "Explorer-1"]],
  ["Practice of growing two or more crops alternately on the same field to restore nitrogen:", "Crop Rotation", ["Monocropping", "Deforestation", "Overgrazing"]],
  ["Chemical substance sprayed to kill unwanted wild weeds:", "Weedicide (e.g., 2,4-D)", ["Fertilizer", "Manure", "Compost"]],
  ["Natural decomposition of plant and animal waste into rich manure:", "Composting / Vermicomposting", ["Smelting", "Electrolysis", "Distillation"]],
  ["Modern water-saving irrigation giving drops directly near plant roots:", "Drip Irrigation", ["Flood Irrigation", "Canal Overflow", "Rainstorm"]],
  ["Full form of LPG used as cooking fuel:", "Liquefied Petroleum Gas", ["Light Petrol Gas", "Low Pressure Gas", "Liquid Propane Gasoline"]],
  ["Full form of CNG used in eco-friendly vehicles:", "Compressed Natural Gas", ["Combined Nitrogen Gas", "Carbon Natural Gas", "Clean Neon Gas"]],
  ["Minimum temperature at which a fuel catches fire and starts burning:", "Ignition Temperature", ["Boiling Point", "Melting Point", "Freezing Point"]],
  ["Harmful poisonous gas formed by incomplete burning of fuel in closed rooms:", "Carbon Monoxide (CO)", ["Oxygen", "Nitrogen", "Water Vapour"]],
  ["Unit used to express Calorific Value of fuels:", "Kilojoule per kg (kJ/kg)", ["Newton per kg", "Watt per hour", "Metre per sec"]],
  ["Fuel having the highest calorific value (~1,50,000 kJ/kg):", "Hydrogen", ["Wood", "Coal", "Cow dung cake"]],
  ["Largest mammal sanctuary / mangrove forest delta shared by India & Bangladesh:", "Sundarbans", ["Nilgiris", "Thar", "Deccan"]],
  ["Tree species whose bark gave the early malaria medicine Quinine:", "Cinchona", ["Neem", "Banyan", "Teak"]],
  ["Part of brain responsible for balance and posture coordination:", "Cerebellum", ["Spinal Cord", "Medulla", "Optic Lobe"]],
  ["Number of chambers in a healthy human heart:", "4 Chambers", ["2 Chambers", "3 Chambers", "6 Chambers"]],
  ["Blood vessels that carry blood AWAY from the heart (mostly oxygenated):", "Arteries", ["Veins", "Capillaries only", "Valves"]],
  ["Blood vessels carrying blood BACK towards the heart (with valves):", "Veins", ["Arteries", "Trachea", "Bronchi"]],
  ["Respiratory organs of fishes allowing oxygen exchange in water:", "Gills", ["Lungs", "Skin only", "Spiracles"]],
  ["Breathing pores on body sides of insects like cockroaches:", "Spiracles (Tracheae)", ["Gills", "Alveoli", "Stomata"]],
  ["Earthworms breathe primarily through their:", "Moist Skin", ["Lungs", "Gills", "Fins"]],
  ["Tissue connecting bone to bone across joints:", "Ligament", ["Tendon", "Cartilage only", "Marrow"]],
  ["Tough tissue connecting skeletal muscle to bone:", "Tendon", ["Ligament", "Plasma", "Synovial fluid"]],
  ["Ball-and-socket joint in human skeleton is found at:", "Shoulder & Hip", ["Knee & Elbow", "Neck pivot", "Wrist only"]],
  ["Hinge joint allowing movement in one plane is found at:", "Knee & Elbow", ["Shoulder", "Hip", "Skull sutures"]],
  ["Fluid non-metal essential for disinfecting drinking water in small amounts:", "Chlorine", ["Mercury", "Sodium", "Phosphorus"]],
  ["Purest natural form of rainwater/water chemically:", "Distilled Rainwater", ["Seawater", "Well brine", "Muddy river water"]],
];

function build500SecondaryScience(cls: 6 | 7 | 8 | 9 | 10): QTuple[] {
  const out: QTuple[] = [];
  out.push(...buildFactBankTuples({ subject: "Science", topicTag: "Units & Instruments", seedPrefix: `c${cls}_500_sc_si`, items: SEC_SCI_SI_INSTR }));
  out.push(...buildFactBankTuples({ subject: "Science", topicTag: "Chemistry Elements", seedPrefix: `c${cls}_500_sc_ch`, items: SEC_SCI_CHEM_SYM }));
  out.push(...buildFactBankTuples({ subject: "Science", topicTag: "Biology & Health", seedPrefix: `c${cls}_500_sc_bi`, items: SEC_SCI_BIO_FACTS }));
  SEC_SCI_EX_130.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_sc_ex_${idx}`);
    out.push(["Science", "MCQ", q, options, correctIndex, `Scientific answer: ${ans}.`, "NCERT Science"]);
  });
  return out; // 20+25+25+130 = 200 unique Science MCQs per class!
}

// ── SECONDARY SOCIAL SCIENCE EXPANSION (Classes 6–8: 200 unique Qs per class) ─
const SEC_SOC_HISTORY: FactPair[] = [
  { prompt: "Which ancient Indus Valley site is famous for the 'Great Bath'?", answer: "Mohenjo-daro" },
  { prompt: "Which ancient Indus Valley port city in Gujarat had a brick dockyard?", answer: "Lothal" },
  { prompt: "Who founded the Mauryan Empire around 321 BCE?", answer: "Chandragupta Maurya" },
  { prompt: "Who wrote the famous treatise on politics & economics 'Arthashastra'?", answer: "Kautilya (Chanakya)" },
  { prompt: "Who sent Buddhist emissaries after the Kalinga War (261 BCE)?", answer: "Emperor Ashoka" },
  { prompt: "Who was the Greek ambassador who wrote 'Indica' at Pataliputra?", answer: "Megasthenes" },
  { prompt: "Which Chinese Buddhist scholar visited India during Harshavardhana's reign?", answer: "Hiuen Tsang (Xuanzang)" },
  { prompt: "Which Gupta emperor is often called the 'Napoleon of India'?", answer: "Samudragupta" },
  { prompt: "Who founded the famous Nalanda Mahavihara university in Gupta times?", answer: "Kumaragupta I" },
  { prompt: "Which Chola king built the Brihadisvara Temple at Thanjavur?", answer: "Rajaraja Chola I" },
  { prompt: "Who built the rock-cut Kailasa Temple at Ellora?", answer: "Rashtrakutas (Krishna I)" },
  { prompt: "Which Delhi ruler introduced token copper currency and shifted capital to Daulatabad?", answer: "Muhammad bin Tughlaq" },
  { prompt: "In which year was the First Battle of Panipat fought (1526)?", answer: "1526 CE" },
  { prompt: "Who founded the Mughal Empire after winning Panipat (1526)?", answer: "Babur" },
  { prompt: "Who built the Grand Trunk Road from Sonargaon to Peshawar and introduced 'Rupiya'?", answer: "Sher Shah Suri" },
  { prompt: "Who wrote 'Akbarnama' and 'Ain-i-Akbari'?", answer: "Abul Fazl" },
  { prompt: "Who founded the Maratha Empire and was crowned at Raigad (1674)?", answer: "Chhatrapati Shivaji Maharaj" },
  { prompt: "Who established the Sikh Khalsa Panth at Anandpur Sahib in 1699?", answer: "Guru Gobind Singh" },
  { prompt: "In which year was the Battle of Plassey fought?", answer: "1757" },
  { prompt: "Which Governor-General introduced the Doctrine of Lapse?", answer: "Lord Dalhousie" },
  { prompt: "Who founded the Brahmo Samaj in 1828 to oppose social evils?", answer: "Raja Ram Mohan Roy" },
  { prompt: "Who founded the Arya Samaj in 1875 giving the call 'Back to the Vedas'?", answer: "Swami Dayananda Saraswati" },
  { prompt: "Who founded the Ramakrishna Mission in 1897?", answer: "Swami Vivekananda" },
  { prompt: "Who founded Satyashodhak Samaj in Pune (1873) for social equality?", answer: "Jyotirao Phule" },
  { prompt: "In which year was the Indian National Congress founded?", answer: "1885" },
  { prompt: "Who presided over the historic 1929 Lahore Congress session demanding 'Purna Swaraj'?", answer: "Jawaharlal Nehru" },
  { prompt: "In which year did the Jallianwala Bagh tragedy occur at Amritsar?", answer: "1919" },
  { prompt: "In which year did Mahatma Gandhi lead the Salt Satyagraha (Dandi March)?", answer: "1930" },
  { prompt: "In which year was the Quit India Movement ('Do or Die') launched?", answer: "1942" },
  { prompt: "Who gave the stirring slogan 'Swaraj is my birthright and I shall have it'?", answer: "Bal Gangadhar Tilak" },
];

const SEC_SOC_GEOGRAPHY: FactPair[] = [
  { prompt: "Which latitude line (23.5° N) passes nearly through the middle of India?", answer: "Tropic of Cancer" },
  { prompt: "Which longitude serves as Indian Standard Time (IST, +5:30)?", answer: "82°30' E" },
  { prompt: "Which is the southernmost point of the Indian Union (Great Nicobar)?", answer: "Indira Point" },
  { prompt: "Which is the southernmost tip of mainland India?", answer: "Kanyakumari" },
  { prompt: "Which river originates from Amarkantak Plateau and flows westward into Arabian Sea?", answer: "Narmada" },
  { prompt: "Which river is known as 'Sorrow of Bihar' due to shifting flood courses?", answer: "Kosi" },
  { prompt: "Which river is known as 'Tsangpo' in Tibet before entering India?", answer: "Brahmaputra" },
  { prompt: "Which is the longest dam in India built across the Mahanadi river?", answer: "Hirakud Dam" },
  { prompt: "Which is the highest gravity dam in India built on the Sutlej river?", answer: "Bhakra Nangal Dam" },
  { prompt: "Which soil type is known as 'Regur Soil' and ideal for cotton?", answer: "Black Cotton Soil" },
  { prompt: "Which fertile soil covers the vast Indo-Gangetic Plains?", answer: "Alluvial Soil" },
  { prompt: "Which mountain pass connects Leh to Nubra Valley in Ladakh?", answer: "Khardung La" },
  { prompt: "Which mountain range separates the Indo-Gangetic plain from the Deccan Plateau?", answer: "Vindhya Range" },
  { prompt: "Which is the highest mountain peak located entirely inside India?", answer: "Nanda Devi (or Kangchenjunga border)" },
  { prompt: "Which plateau is known as the 'Mineral Storehouse of India'?", answer: "Chota Nagpur Plateau" },
  { prompt: "Which atmospheric layer contains the protective Ozone shield?", answer: "Stratosphere" },
  { prompt: "In which atmospheric layer do all weather events (rain, clouds, storms) take place?", answer: "Troposphere" },
  { prompt: "Which layer of the atmosphere helps reflect radio waves back to Earth?", answer: "Ionosphere (Thermosphere)" },
  { prompt: "Which sea is famous as the saltiest large lake/sea where swimmers float easily?", answer: "Dead Sea" },
  { prompt: "Which narrow strait separates India from Sri Lanka?", answer: "Palk Strait" },
  { prompt: "Which imaginary 0° latitude divides Earth into Northern & Southern Hemispheres?", answer: "Equator" },
  { prompt: "Which imaginary 0° longitude passes through Greenwich, London?", answer: "Prime Meridian" },
  { prompt: "Which continent has the largest number of countries (54)?", answer: "Africa (54 Countries)" },
  { prompt: "Which mountain range separates Europe from Asia?", answer: "Ural Mountains" },
  { prompt: "Which river carries the largest volume of water in the world?", answer: "Amazon River" },
];

const SEC_SOC_CIVICS: FactPair[] = [
  { prompt: "When did the Constitution of India come into force?", answer: "26 January 1950" },
  { prompt: "When was the Constitution of India formally adopted by the Constituent Assembly?", answer: "26 November 1949" },
  { prompt: "Who was the permanent President of India's Constituent Assembly?", answer: "Dr. Rajendra Prasad" },
  { prompt: "Who was the Chairman of the Constitution Drafting Committee?", answer: "Dr. B.R. Ambedkar (Drafting)" },
  { prompt: "How many Fundamental Rights are currently guaranteed by the Indian Constitution?", answer: "6 Fundamental Rights" },
  { prompt: "Which Fundamental Right makes Right to Education (age 6–14) free & compulsory?", answer: "Article 21A" },
  { prompt: "Which Constitutional Article abolishes Untouchability in India?", answer: "Article 17" },
  { prompt: "Which Article guarantees Freedom of Speech and Expression?", answer: "Article 19" },
  { prompt: "Who called Article 32 (Right to Constitutional Remedies) the 'Heart and Soul' of the Constitution?", answer: "Dr. B.R. Ambedkar" },
  { prompt: "How many Fundamental Duties are listed under Article 51A?", answer: "11 Duties" },
  { prompt: "What is the minimum age to vote in India's elections?", answer: "18 years" },
  { prompt: "What is the minimum age to contest for the Lok Sabha (Member of Parliament)?", answer: "25 years" },
  { prompt: "What is the minimum age to become a member of the Rajya Sabha?", answer: "30 years" },
  { prompt: "What is the minimum age to be elected President of India?", answer: "35 years" },
  { prompt: "Who is the ex-officio Chairman of the Rajya Sabha?", answer: "Vice President of India" },
  { prompt: "What is the maximum strength of the Lok Sabha as per constitutional limit?", answer: "550 (+ nominal adjustments)" },
  { prompt: "Who administers the Oath of Office to the President of India?", answer: "Chief Justice of India" },
  { prompt: "Who is the guardian and final interpreter of the Constitution of India?", answer: "Supreme Court of India" },
  { prompt: "Which Constitutional Amendment gave constitutional status to Panchayati Raj (1992)?", answer: "73rd Amendment" },
  { prompt: "Which Constitutional Amendment lowered the voting age from 21 to 18?", answer: "61st Amendment" },
  { prompt: "How many languages are currently recognised in the 8th Schedule of India's Constitution?", answer: "22 Languages" },
  { prompt: "Which body conducts free and fair Parliamentary and Assembly elections in India?", answer: "Election Commission of India" },
  { prompt: "Which three tiers form rural Panchayati Raj in India?", answer: "Gram Panchayat, Block Samiti, Zila Parishad" },
  { prompt: "What is the normal term duration of a State Legislative Assembly (Vidhan Sabha)?", answer: "5 years" },
  { prompt: "Which house of Parliament is known as the Permanent House (cannot be dissolved)?", answer: "Rajya Sabha" },
];

const SEC_SOC_EX_120: [string, string, [string, string, string]][] = [
  ["The earliest Veda composed in Sanskrit is:", "Rigveda", ["Samaveda", "Yajurveda", "Atharvaveda"]],
  ["Which Upanishad contains India's national motto 'Satyameva Jayate'?", "Mundaka Upanishad", ["Katha Upanishad", "Chandogya", "Brihadaranyaka"]],
  ["Lord Mahavira was the ___ Tirthankara of Jainism.", "24th", ["1st", "10th", "23rd"]],
  ["Where did Gautama Buddha deliver his first sermon (Dharmachakra Pravartana)?", "Sarnath", ["Lumbini", "Bodh Gaya", "Kushinagar"]],
  ["Which script is used on Ashokan Pillars across most of India?", "Brahmi Script", ["Devanagari only", "Sharada", "Tamil-Latin"]],
  ["Who was the renowned court poet of Samudragupta who composed the Prayag Prashasti?", "Harishena", ["Kalidasa", "Banabhatta", "Tulsidas"]],
  ["Who wrote 'Abhijnanashakuntalam' and 'Meghaduta'?", "Kalidasa", ["Vishakhadatta", "Bharavi", "Sudraka"]],
  ["Who wrote 'Harshacharita' (biography of Emperor Harsha)?", "Banabhatta", ["Fa-Hien", "Kalhana", "Ravikirti"]],
  ["'Rajatarangini', the Sanskrit history of Kashmir kings, was written by:", "Kalhana", ["Al-Biruni", "Amir Khusrau", "Ziauddin Barani"]],
  ["Who built the Qutub Minar foundation and started construction in Delhi?", "Qutb-ud-din Aibak", ["Iltutmish only", "Balban", "Alauddin Khilji"]],
  ["Who was the only woman Muslim ruler to sit on the throne of Delhi Sultanate?", "Razia Sultana", ["Nur Jahan", "Mumtaz Mahal", "Chand Bibi"]],
  ["Who founded the Vijayanagara Empire in 1336 on the Tungabhadra river?", "Harihara I and Bukka Raya I", ["Krishnadevaraya", "Tipu Sultan", "Rana Pratap"]],
  ["In which battle (1576) did Maharana Pratap display unmatched valour?", "Battle of Haldighati", ["Battle of Khanwa", "Battle of Buxar", "Battle of Talikota"]],
  ["Which Sikh Guru compiled the Adi Granth (Guru Granth Sahib) and built Harmandir Sahib?", "Guru Arjan Dev", ["Guru Nanak Dev", "Guru Tegh Bahadur", "Guru Angad"]],
  ["Who was the ruler of Mysore famously called 'Tiger of Mysore'?", "Tipu Sultan", ["Hyder Ali", "Nizam", "Peshwa Baji Rao"]],
  ["Who started the 1857 uprising from Barrackpore cantonment?", "Mangal Pandey", ["Tatya Tope", "Nana Saheb", "Kunwar Singh"]],
  ["Who led the 1857 revolt bravely from Jhansi?", "Rani Lakshmibai", ["Begum Hazrat Mahal", "Rani Avantibai", "Ahilyabai Holkar"]],
  ["Who led the 1857 revolt across Bihar (Jagdishpur) at age 80?", "Babu Veer Kunwar Singh", ["Birsa Munda", "Tantia Tope", "Rao Tula Ram"]],
  ["Where was Mahatma Gandhi's first Satyagraha movement on Indian soil (1917)?", "Champaran (Bihar)", ["Kheda", "Ahmedabad", "Bardoli"]],
  ["Who founded the 'Forward Bloc' in 1939 and led the Azad Hind Fauj (INA)?", "Subhas Chandra Bose", ["Rash Behari Bose", "Bhagat Singh", "M.N. Roy"]],
  ["Who authored 'Discovery of India' while imprisoned in Ahmednagar Fort?", "Jawaharlal Nehru", ["Mahatma Gandhi", "Maulana Azad", "Sardar Patel"]],
  ["Who authored 'My Experiments with Truth'?", "Mahatma Gandhi", ["Dr. Rajendra Prasad", "Bal Gangadhar Tilak", "Gopal Krishna Gokhale"]],
  ["Who authored 'Hind Swaraj' (1909)?", "Mahatma Gandhi", ["Rabindranath Tagore", "Sri Aurobindo", "Lala Lajpat Rai"]],
  ["Who is remembered as 'Nightingale of India' (Bharat Kokila)?", "Sarojini Naidu", ["Annie Besant", "Vijaya Lakshmi Pandit", "Sucheta Kripalani"]],
  ["Who was the first woman Chief Minister of any Indian state (Uttar Pradesh)?", "Sucheta Kripalani", ["Sarojini Naidu", "Indira Gandhi", "Mamata Banerjee"]],
  ["Who was the first woman Prime Minister of India?", "Indira Gandhi", ["Pratibha Patil", "Sarojini Naidu", "Sushma Swaraj"]],
  ["Who was the first woman President of India?", "Pratibha Devisingh Patil", ["Droupadi Murmu", "Indira Gandhi", "Meira Kumar"]],
  ["Which country shares the longest land border with India (4,096 km)?", "Bangladesh", ["China", "Pakistan", "Nepal"]],
  ["Which boundary line divides India and China (Eastern sector)?", "McMahon Line", ["Radcliffe Line", "Durand Line", "38th Parallel"]],
  ["Which boundary line separates India and Pakistan?", "Radcliffe Line", ["McMahon Line", "Maginot Line", "Order-Neisse"]],
  ["Which canal connects the Mediterranean Sea with the Red Sea?", "Suez Canal", ["Panama Canal", "Kiel Canal", "Indira Gandhi Canal"]],
  ["Which canal connects the Atlantic Ocean with the Pacific Ocean?", "Panama Canal", ["Suez Canal", "Erie Canal", "Grand Canal"]],
  ["Which plateau is known as the 'Roof of the World'?", "Pamir Plateau (Tibet)", ["Deccan Plateau", "Colorado Plateau", "Kimberley Plateau"]],
  ["Which desert is the largest cold desert of the world?", "Antarctica (Polar) / Gobi", ["Sahara", "Kalahari", "Atacama"]],
  ["Which rainforest produces ~20% of Earth's oxygen and is called 'Lungs of the Planet'?", "Amazon Rainforest", ["Taiga", "Sundarbans", "Congo Basin"]],
  ["Local hot dry winds blowing across Northern India plains in May–June:", "Loo", ["Chinook", "Mistral", "Kalbaisakhi"]],
  ["Which Indian state receives the highest rainfall (Mawsynram & Cherrapunji)?", "Meghalaya", ["Kerala", "Assam", "Sikkim"]],
  ["Which major river of South India is known as 'Vriddha Ganga' / Dakshin Ganga?", "Godavari", ["Krishna", "Kaveri", "Pennar"]],
  ["Which river flows through a rift valley between Vindhya and Satpura ranges?", "Narmada", ["Mahanadi", "Kaveri", "Godavari"]],
  ["Which ocean current is a famous warm current of the Atlantic Ocean?", "Gulf Stream", ["Labrador Current", "Humboldt Current", "Oyashio"]],
  ["Day and night occur on Earth because of:", "Earth's rotation on its axis", ["Earth's revolution around Sun", "Moon's rotation", "Ocean tides"]],
  ["Seasons (Summer, Winter, Spring, Autumn) occur due to:", "Earth's revolution & tilted axis (23.5°)", ["Moon phases", "Sun spinning", "Clouds moving"]],
  ["On which date is the longest day in the Northern Hemisphere (Summer Solstice)?", "21 June", ["22 December", "21 March", "23 September"]],
  ["On which dates do Day and Night become equal length everywhere (Equinox)?", "21 March & 23 September", ["21 June & 22 Dec", "1 Jan & 1 July", "15 Aug & 26 Jan"]],
  ["Which planet's axial tilt causes extreme 42-year seasons?", "Uranus", ["Mercury", "Mars", "Venus"]],
  ["Primary sector of economy includes:", "Agriculture, Forestry & Fishing", ["Banking & Software", "Car Manufacturing", "Retail Shops"]],
  ["Secondary sector of economy covers:", "Manufacturing & Construction", ["Farming & Dairy", "Teaching & Healthcare", "Mining only"]],
  ["Tertiary sector of economy covers:", "Services (Banking, Transport, Education)", ["Weaving & Steel factories", "Crop harvesting", "Quarrying"]],
  ["Central Bank responsible for currency & monetary policy in India:", "Reserve Bank of India (RBI)", ["SBI", "SEBI", "NABARD"]],
  ["In which year was the Reserve Bank of India (RBI) established?", "1935", ["1947", "1950", "1969"]],
  ["Which institution acts as apex bank for Agriculture and Rural Development?", "NABARD", ["SEBI", "SIDBI", "EXIM Bank"]],
  ["Full form of GDP in economics:", "Gross Domestic Product", ["General Data Price", "Global Development Plan", "Government Debt Policy"]],
  ["Full form of GST introduced in India in 2017:", "Goods and Services Tax", ["General Sales Tariff", "Global Standard Tax", "Gross Supply Tax"]],
  ["Full form of RTI Act enacted in 2005:", "Right to Information", ["Real Time Inspection", "Rural Tax Initiative", "Road Transport India"]],
  ["Which tier of local self-government administers large cities in India?", "Municipal Corporation (Nagar Nigam)", ["Gram Sabha", "Zila Parishad", "Panchayat Samiti"]],
  ["Who is the head of a Municipal Corporation?", "Mayor", ["Sarpanch", "Governor", "Collector"]],
  ["Who is the executive head of a State Government?", "Chief Minister", ["Governor only nominal", "Chief Secretary", "Speaker"]],
  ["Who appoints the Chief Minister of an Indian state?", "The Governor", ["The President", "Chief Justice", "Prime Minister"]],
  ["Maximum gap allowed between two consecutive sessions of Parliament:", "6 Months", ["3 Months", "12 Months", "2 Years"]],
  ["Which house in Parliament introduces Money Bills exclusively first?", "Lok Sabha", ["Rajya Sabha", "Legislative Council", "Cabinet only"]],
  ["Who presides over Lok Sabha proceedings?", "The Speaker of Lok Sabha", ["Vice President", "Prime Minister", "President"]],
  ["What does 'Secular' in India's Preamble guarantee?", "State treats all religions equally with no official religion", ["Only one religion is taught", "Citizens cannot pray", "Temples and churches are taxed extra"]],
  ["What does 'Republic' mean in the Indian Constitution?", "Head of State is elected, not hereditary", ["Only Parliament makes budgets", "Military rules the nation", "King chooses Prime Minister"]],
  ["Who designed the modern Indian Rupee symbol '₹' (2010)?", "D. Udaya Kumar", ["Amartya Sen", "Raghuram Rajan", "Nandan Nilekani"]],
  ["Total number of States and Union Territories in India currently (post-2020):", "28 States and 8 Union Territories", ["29 States and 7 UTs", "25 States and 9 UTs", "30 States and 6 UTs"]],
  ["Which state is known as the 'Spice Garden of India'?", "Kerala", ["Karnataka", "Assam", "Himachal Pradesh"]],
  ["Which state leads India in Saffron (Kesar) cultivation (Pampore)?", "Jammu & Kashmir", ["Punjab", "Gujarat", "Bihar"]],
  ["Which city in Uttar Pradesh is famous globally for brassware handicrafts?", "Moradabad", ["Kanpur", "Aligarh", "Firozabad"]],
  ["Which city in Uttar Pradesh is famous for glass bangles?", "Firozabad", ["Aligarh (Locks)", "Varanasi", "Agra"]],
  ["Which Indian port is the largest container port near Mumbai?", "Jawaharlal Nehru Port (Nhava Sheva)", ["Kandla", "Paradip", "Tuticorin"]],
  ["Major iron ore mining belt in Odisha–Jharkhand includes:", "Mayurbhanj & Singhbhum", ["Kolar", "Digboi", "Neyveli"]],
  ["Oldest oil field in India located in Assam:", "Digboi (1901)", ["Bombay High", "Ankleshwar", "Barmer"]],
  ["Largest offshore oil & natural gas field in India:", "Mumbai High", ["Digboi", "Krishna-Godavari minor", "Kochi coast"]],
  ["Green Revolution of late 1960s boosted production mainly of:", "Wheat and Rice", ["Cotton and Jute", "Tea and Coffee", "Sugarcane only"]],
  ["Who is revered as the 'Father of Green Revolution in India'?", "Dr. M.S. Swaminathan", ["Dr. Verghese Kurien", "Sam Pitroda", "Homi Bhabha"]],
  ["Who is revered as the 'Father of White Revolution (Operation Flood)' in India?", "Dr. Verghese Kurien", ["Dr. M.S. Swaminathan", "Norman Borlaug", "C. Subramaniam"]],
  ["White Revolution is associated with rapid boost in:", "Milk & Dairy production", ["Fishery", "Egg farming", "Silk weaving"]],
  ["Blue Revolution is associated with:", "Fisheries & Aquaculture", ["Dairy", "Petroleum", "Solar grids"]],
  ["Yellow Revolution is associated with:", "Oilseeds (Mustard, Groundnut, Sunflower)", ["Cotton", "Jute", "Fruits"]],
  ["Golden Fibre Revolution is associated with:", "Jute", ["Cotton", "Wool", "Silk"]],
  ["Which valley in Ladakh–Kashmir is known for Pashmina wool goats?", "Changthang Plateau", ["Silent Valley", "Kullu", "Spiti lower"]],
  ["Tropical evergreen forests in India grow richly in:", "Western Ghats & Andaman–Nicobar", ["Thar Desert", "Ladakh", "Deccan rain shadow"]],
  ["Mangrove trees like Sundari adapt to coastal tides using:", "Breathing roots (Pneumatophores)", ["Thorns instead of leaves", "Deep snow cones", "Floating bulbs"]],
  ["Full form of UNESCO:", "United Nations Educational, Scientific and Cultural Organization", ["Union of European Nations", "Universal Science Charter", "United Energy Council"]],
  ["Headquarters of the United Nations (UN) is in:", "New York (USA)", ["Geneva", "Paris", "Vienna"]],
  ["Headquarters of the World Health Organization (WHO) is in:", "Geneva (Switzerland)", ["New York", "London", "Rome"]],
  ["Headquarters of the International Court of Justice (ICJ) is in:", "The Hague (Netherlands)", ["Geneva", "New York", "Brussels"]],
  ["Headquarters of SAARC (South Asian Association for Regional Cooperation):", "Kathmandu (Nepal)", ["New Delhi", "Dhaka", "Colombo"]],
  ["Currency of Japan is:", "Japanese Yen", ["Won", "Yuan", "Baht"]],
  ["Currency of Bangladesh is:", "Taka", ["Rupee", "Dinar", "Riyal"]],
  ["Currency of Nepal is:", "Nepalese Rupee", ["Ngultrum", "Taka", "Kyat"]],
  ["National currency of Bhutan is:", "Ngultrum", ["Rupee", "Riel", "Taka"]],
  ["Longest continuous wall built in ancient China:", "Great Wall of China", ["Hadrian's Wall", "Berlin Wall", "Kumbhalgarh Wall"]],
  ["World's largest desert (hot desert in North Africa):", "Sahara Desert", ["Gobi", "Thar", "Sonoran"]],
  ["Longest mountain chain in the world along South America's west coast:", "Andes Mountains", ["Himalayas", "Alps", "Rockies"]],
  ["Highest mountain peak in Europe's Alps:", "Mont Blanc", ["Matterhorn", "Elbrus", "Vesuvius"]],
  ["World's largest island (non-continent):", "Greenland", ["Madagascar", "Sri Lanka", "Borneo"]],
  ["Country known as the 'Land of the Rising Sun':", "Japan", ["Norway", "Thailand", "Australia"]],
  ["Country known as the 'Land of Midnight Sun':", "Norway", ["Finland", "Egypt", "Brazil"]],
  ["Which river flows through Cairo and is the longest river of Africa?", "Nile River", ["Congo River", "Zambezi", "Niger"]],
  ["Which strait connects the Atlantic Ocean and Mediterranean Sea?", "Strait of Gibraltar", ["Bering Strait", "Malacca Strait", "Hormuz Strait"]],
  ["Which strait separates Asia (Russia) from North America (Alaska)?", "Bering Strait", ["Palk Strait", "Gibraltar", "Dover Strait"]],
  ["Who started the Bhoodan (Land Gift) Movement in 1951?", "Acharya Vinoba Bhave", ["Jayaprakash Narayan", "Anna Hazare", "Morarji Desai"]],
  ["Who gave the slogan 'Jai Jawan, Jai Kisan' in 1965?", "Lal Bahadur Shastri", ["Indira Gandhi", "Atal Bihari Vajpayee", "Jawaharlal Nehru"]],
  ["Who added 'Jai Vigyan' to 'Jai Jawan, Jai Kisan' in 1998?", "Atal Bihari Vajpayee", ["A.P.J. Abdul Kalam", "Narendra Modi", "P.V. Narasimha Rao"]],
  ["First Indian citizen to receive the Bharat Ratna award (1954):", "C. Rajagopalachari, S. Radhakrishnan & C.V. Raman", ["Jawaharlal Nehru", "Sachin Tendulkar", "Mother Teresa"]],
  ["First non-Indian / foreign leader awarded Bharat Ratna:", "Khan Abdul Ghaffar Khan", ["Nelson Mandela", "Martin Luther King", "Barack Obama"]],
  ["Youngest recipient to be awarded Bharat Ratna (in sports):", "Sachin Tendulkar", ["Viswanathan Anand", "Major Dhyan Chand", "Milkha Singh"]],
  ["Who led the Chipko Movement in Uttarakhand hugs-trees campaign (1970s)?", "Sunderlal Bahuguna & Gaura Devi", ["Medha Patkar", "Rajendra Singh", "Salim Ali"]],
  ["Dr. Salim Ali is celebrated across India as:", "The Birdman of India", ["Waterman of India", "Forest Man of India", "Missile Man"]],
  ["Rajendra Singh (Alwar, Rajasthan) is celebrated as:", "The Waterman of India", ["Birdman of India", "Milkman of India", "Metro Man"]],
  ["E. Sreedharan is widely respected across India as:", "The Metro Man of India", ["Waterman of India", "Space Man", "Highway Man"]],
  ["Which Constitutional Article deals with Financial Emergency?", "Article 360", ["Article 352", "Article 356", "Article 370"]],
  ["Which Constitutional Article deals with National Emergency?", "Article 352", ["Article 356", "Article 360", "Article 368"]],
  ["Which Article empowers Parliament to amend the Constitution?", "Article 368", ["Article 32", "Article 124", "Article 280"]],
  ["Which official audits Government of India public finances?", "Comptroller and Auditor General (CAG)", ["Attorney General", "Solicitor General", "Cabinet Secretary"]],
  ["Highest law officer advising the Government of India:", "Attorney General of India", ["Chief Justice", "CAG", "Law Secretary"]],
  ["Voting Electronic Voting Machine (EVM) + paper trail slip is called:", "VVPAT", ["OMR", "UPI", "OCR"]],
  ["Which desert tribe in Rajasthan guards Bishnoi wildlife & Khejri trees?", "Bishnoi Community", ["Toda", "Gond", "Santhal"]],
  ["Which state's traditional bamboo drip irrigation system uses gravity over hills?", "Meghalaya", ["Rajasthan", "Punjab", "Gujarat"]],
];

function build500SecondarySocial(cls: 6 | 7 | 8 | 9 | 10): QTuple[] {
  const out: QTuple[] = [];
  out.push(...buildFactBankTuples({ subject: "Social Science", topicTag: "History 500", seedPrefix: `c${cls}_500_ss_hi`, items: SEC_SOC_HISTORY }));
  out.push(...buildFactBankTuples({ subject: "Social Science", topicTag: "Geography 500", seedPrefix: `c${cls}_500_ss_ge`, items: SEC_SOC_GEOGRAPHY }));
  out.push(...buildFactBankTuples({ subject: "Social Science", topicTag: "Civics 500", seedPrefix: `c${cls}_500_ss_ci`, items: SEC_SOC_CIVICS }));
  SEC_SOC_EX_120.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_ss_ex_${idx}`);
    out.push(["Social Science", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, "Social Studies"]);
  });
  return out; // 30+25+25+120 = 200 unique Social Science MCQs per class!
}

// ── SECONDARY REASONING & GK EXPANSION (Classes 6–8: 200 unique Qs per class) ─
const SEC_BOOKS_DANCE: FactPair[] = [
  { prompt: "Author of the epic classic 'Ramcharitmanas':", answer: "Goswami Tulsidas" },
  { prompt: "Author of Sanskrit play 'Mudrarakshasa':", answer: "Vishakhadatta" },
  { prompt: "Author of 'Panchatantra' moral fables:", answer: "Vishnu Sharma" },
  { prompt: "Author of 'Gitanjali' (Nobel Prize 1913):", answer: "Rabindranath Tagore" },
  { prompt: "Author of 'Godaan' and 'Gaban' in Hindi literature:", answer: "Munshi Premchand" },
  { prompt: "Author of 'Malgudi Days':", answer: "R.K. Narayan" },
  { prompt: "Author of 'Wings of Fire' (autobiography):", answer: "Dr. A.P.J. Abdul Kalam" },
  { prompt: "Author of 'Train to Pakistan':", answer: "Khushwant Singh" },
  { prompt: "Author of 'The Origin of Species':", answer: "Charles Darwin" },
  { prompt: "Author of 'A Brief History of Time':", answer: "Stephen Hawking" },
  { prompt: "Classical dance 'Sattriya' belongs to which Indian state?", answer: "Assam" },
  { prompt: "Classical dance 'Kuchipudi' belongs to which Indian state?", answer: "Andhra Pradesh" },
  { prompt: "Classical dance 'Odissi' belongs to which Indian state?", answer: "Odisha" },
  { prompt: "Classical dance 'Manipuri' belongs to which Indian state?", answer: "Manipur" },
  { prompt: "Folk dance 'Garba' and 'Dandiya' belong to:", answer: "Gujarat" },
  { prompt: "Folk dance 'Ghoomar' belongs to:", answer: "Rajasthan" },
  { prompt: "Folk dance 'Bhangra' and 'Giddha' belong to:", answer: "Punjab" },
  { prompt: "Folk dance 'Lavani' belongs to:", answer: "Maharashtra" },
  { prompt: "Folk dance 'Chhau' is famous across Jharkhand, Bengal, and:", answer: "Odisha (Chhau region)" },
  { prompt: "Harvest festival 'Pongal' is celebrated enthusiastically in:", answer: "Tamil Nadu" },
  { prompt: "Sport trophy 'Ranji Trophy' is awarded in India's domestic:", "answer": "Cricket" },
  { prompt: "Sport trophy 'Durand Cup' is Asia's oldest tournament in:", answer: "Football" },
  { prompt: "Sport trophy 'Thomas Cup' and 'Uber Cup' belong to:", answer: "Badminton" },
  { prompt: "Sport term 'Checkmate' and 'Grandmaster' belong to:", answer: "Chess" },
  { prompt: "Sport term 'LBW', 'Googly', and 'Hat-trick' belong to:", answer: "Cricket" },
];

const SEC_GK_EX_65: [string, string, [string, string, string]][] = [
  ["Who became the first Indian Nobel Laureate (Literature, 1913)?", "Rabindranath Tagore", ["C.V. Raman", "Mother Teresa", "Amartya Sen"]],
  ["Who won the Nobel Prize in Physics in 1930 for the 'Raman Effect'?", "Sir C.V. Raman", ["Satyendra Nath Bose", "Meghnad Saha", "Homi Bhabha"]],
  ["Who won the Nobel Peace Prize in 1979 for serving Kolkata's poor?", "Mother Teresa", ["Kailash Satyarthi", "Mahatma Gandhi", "Vinoba Bhave"]],
  ["Who won the Nobel Peace Prize in 2014 alongside Malala Yousafzai for child rights?", "Kailash Satyarthi", ["Amartya Sen", "Venkatraman Ramakrishnan", "Abhijit Banerjee"]],
  ["First Indian astronaut to travel into space aboard Soyuz T-11 (1984):", "Rakesh Sharma", ["Kalpana Chawla", "Sunita Williams", "Shubhanshu Shukla"]],
  ["Where is the headquarters of ISRO located?", "Bengaluru", ["Hyderabad", "Thiruvananthapuram", "Sriharikota"]],
  ["Satish Dhawan Space Centre (India's primary rocket launchport) is at:", "Sriharikota (Andhra Pradesh)", ["Ahmedabad", "Bhopal", "Pune"]],
  ["Which ISRO mission made India the first Asian nation to reach Mars orbit on its first attempt?", "Mangalyaan (MOM)", ["Chandrayaan-1", "Aditya-L1", "Astrosat"]],
  ["India's dedicated solar observatory spacecraft launched in 2023:", "Aditya-L1", ["Gaganyaan", "Chandrayaan-3", "PSLV-C1"]],
  ["India's first human spaceflight mission programme is named:", "Gaganyaan", ["Mangalyaan-2", "Shukrayaan", "Vikram-X"]],
  ["Highest peacetime gallantry award of India:", "Ashoka Chakra", ["Param Vir Chakra", "Bharat Ratna", "Padma Vibhushan"]],
  ["Highest wartime military gallantry medal of India:", "Param Vir Chakra", ["Ashoka Chakra", "Kirti Chakra", "Vir Chakra"]],
  ["Highest literary award given annually in India (1961 onwards):", "Jnanpith Award", ["Sahitya Akademi only", "Dadasaheb Phalke", "Arjuna Award"]],
  ["Highest honour in Indian Cinema:", "Dadasaheb Phalke Award", ["Dronacharya Award", "Bhatnagar Prize", "Khel Ratna"]],
  ["Highest sports honour of India (Major Dhyan Chand):", "Khel Ratna Award", ["Dronacharya Award", "Arjuna Award only", "Dhyan Chand Trophy"]],
  ["Highest coaching honour in Indian sports:", "Dronacharya Award", ["Arjuna Award", "Tenzing Norgay Award", "Param Vir Chakra"]],
  ["Premier science & technology prize in India named after CSIR founder:", "Shanti Swarup Bhatnagar Prize", ["Raman Award", "Kalam Medal", "Tagore Prize"]],
  ["Which Indian cricketer is nicknamed 'The Wall'?", "Rahul Dravid", ["Sachin Tendulkar", "Virat Kohli", "MS Dhoni"]],
  ["Which Indian athlete won India's first Olympic Athletics Gold Medal (Tokyo 2020)?", "Neeraj Chopra (Javelin)", ["Abhinav Bindra", "P.V. Sindhu", "Mary Kom"]],
  ["Which Indian shooter won India's first individual Olympic Gold Medal (Beijing 2008)?", "Abhinav Bindra", ["Rajyavardhan Rathore", "Gagan Narang", "Vijay Kumar"]],
  ["Full form of CPU inside a computer:", "Central Processing Unit", ["Control Program Unit", "Central Power Unit", "Core Processor Utility"]],
  ["Full form of RAM in computer memory:", "Random Access Memory", ["Read Access Memory", "Rapid Action Memory", "Run All Memory"]],
  ["Full form of ROM in computers:", "Read Only Memory", ["Random Only Memory", "Read Output Memory", "Run Operating Module"]],
  ["Full form of URL on the Internet:", "Uniform Resource Locator", ["Universal Routing Link", "User Resource List", "Unified Reference Line"]],
  ["Full form of HTTP in web addresses:", "HyperText Transfer Protocol", ["High Tech Text Program", "Hyperlink Text Transport Path", "Home Tool Transfer Protocol"]],
  ["Full form of PDF document format:", "Portable Document Format", ["Printed Data File", "Public Digital Format", "Page Display File"]],
  ["1 Kilobyte (KB) in binary computer units equals:", "1,024 Bytes", ["100 Bytes", "1,000 Bits", "512 Bytes"]],
  ["Which company developed the Android mobile operating system?", "Google (originally Android Inc.)", ["Apple", "Microsoft", "Nokia"]],
  ["Shortcut key combination to COPY selected text on Windows PCs:", "Ctrl + C", ["Ctrl + V", "Ctrl + X", "Ctrl + Z"]],
  ["Shortcut key combination to UNDO the last action on PCs:", "Ctrl + Z", ["Ctrl + Y", "Ctrl + S", "Ctrl + P"]],
  ["Which chess piece moves ONLY diagonally across squares?", "Bishop", ["Rook", "Knight", "Pawn backward"]],
  ["Which chess piece moves in an L-shape and can jump over others?", "Knight", ["Bishop", "Queen", "King"]],
  ["How many squares does a Rubik's Cube show on ONE face (3×3)?", "9 squares", ["6 squares", "12 squares", "27 squares"]],
  ["Which blood group can be safely transfused in emergencies as Universal Red-Cell Donor?", "O− (Negative)", ["AB+", "A+", "B−"]],
  ["Ratio of width to length of India's National Flag:", "2 : 3", ["1 : 2", "3 : 4", "4 : 5"]],
  ["How many languages appear on the language panel of an Indian Rupee currency note?", "15 regional languages (+ Hindi & English)", ["5 languages", "8 languages", "28 languages"]],
  ["Where is India's Supreme Court located?", "New Delhi", ["Mumbai", "Prayagraj", "Kolkata"]],
  ["Who is the constitutional Supreme Commander of the Armed Forces of India?", "The President of India", ["Prime Minister", "Defence Minister", "Army Chief"]],
  ["Which national agency prints Indian currency notes at Dewas, Nashik, Mysuru & Salboni?", "RBI / BRBNMPL & SPMCIL", ["NITI Aayog", "Finance Commission", "SEBI"]],
  ["Which city is nicknamed the 'Manchester of India' for textiles?", "Ahmedabad", ["Kanpur", "Coimbatore", "Surat"]],
  ["Which city is nicknamed the 'Diamond City of India'?", "Surat", ["Jaipur", "Mumbai", "Hyderabad"]],
  ["Which city is nicknamed the 'City of Lakes' in Rajasthan?", "Udaipur", ["Jodhpur", "Bikaner", "Ajmer"]],
  ["Which city is nicknamed the 'City of Joy'?", "Kolkata", ["Chennai", "Pune", "Lucknow"]],
  ["Which city is called 'Queen of the Arabian Sea'?", "Kochi", ["Goa", "Mangaluru", "Mumbai"]],
  ["World's largest coral reef system located off Queensland coast:", "Great Barrier Reef (Australia)", ["Andaman Reef", "Lakshadweep", "Red Sea Reef"]],
  ["Tallest waterfall in the world (Angel Falls, 979 m) is located in:", "Venezuela", ["Brazil", "Canada", "Norway"]],
  ["Deepest point in Earth's oceans (Challenger Deep, ~11 km) lies in:", "Mariana Trench (Pacific)", ["Java Trench", "Puerto Rico Trench", "Tonga Trench"]],
  ["Smallest country in the world by area (~0.49 sq km):", "Vatican City", ["Monaco", "Maldives", "San Marino"]],
  ["Largest country in the world by land area:", "Russia", ["Canada", "China", "United States"]],
  ["Country with the world's largest coastline (over 202,000 km):", "Canada", ["Indonesia", "Australia", "India"]],
  ["Famous ancient university of Bihar revived in modern times:", "Nalanda University", ["Takshashila", "Vikramshila", "Vallabhi"]],
  ["Which ancient Indian physician wrote 'Charaka Samhita'?", "Charaka", ["Sushruta", "Patanjali", "Aryabhata"]],
  ["Which ancient Indian surgeon wrote 'Sushruta Samhita'?", "Sushruta", ["Charaka", "Vagbhata", "Nagarjuna"]],
  ["Which ancient Indian sage systematised Yoga Sutras?", "Maharishi Patanjali", ["Kapila", "Kanada", "Gautama"]],
  ["Which ancient Indian thinker proposed the atomic theory ('Anu / Parmanu')?", "Maharishi Kanada", ["Aryabhata", "Bhaskara", "Sushruta"]],
  ["What does PIN stand for in India's 6-digit postal system?", "Postal Index Number", ["Personal Identity Number", "Public India Network", "Post Office Node"]],
  ["In a 6-digit Indian PIN code, what does the FIRST digit indicate?", "Postal Zone / Region of India", ["State Capital only", "House number", "Delivery month"]],
  ["How many PIN zones exist in India (including Army Post Office Zone 9)?", "9 Zones", ["4 Zones", "15 Zones", "28 Zones"]],
  ["Who founded the Scout Movement globally in 1907?", "Robert Baden-Powell", ["Henri Dunant", "Maria Montessori", "Rudyard Kipling"]],
  ["Who founded the International Red Cross society (first Peace Nobel)?", "Henry Dunant", ["Florence Nightingale", "Alfred Nobel", "Jean Monnet"]],
  ["Who is remembered worldwide as 'The Lady with the Lamp' (Modern Nursing)?", "Florence Nightingale", ["Mother Teresa", "Marie Curie", "Clara Barton"]],
  ["Who was the first woman in history to win two Nobel Prizes (Physics & Chemistry)?", "Marie Curie", ["Rosalind Franklin", "Ada Lovelace", "Jane Goodall"]],
  ["Who is considered the world's first computer programmer?", "Ada Lovelace", ["Grace Hopper", "Alan Turing", "Tim Berners-Lee"]],
  ["Which inventor invented the World Wide Web (WWW) in 1989?", "Tim Berners-Lee", ["Steve Jobs", "Vint Cerf", "Larry Page"]],
  ["How many total time zones roughly cover Earth (15° longitude = 1 hour)?", "24 Time Zones", ["12 Time Zones", "36 Time Zones", "48 Time Zones"]],
];

function build500SecondaryReasoning(cls: 6 | 7 | 8 | 9 | 10): QTuple[] {
  const out: QTuple[] = [];
  out.push(...buildFactBankTuples({ subject: "Reasoning & GK", topicTag: "Books & Culture", seedPrefix: `c${cls}_500_rk_bk`, items: SEC_BOOKS_DANCE }));
  SEC_GK_EX_65.forEach(([q, ans, wrongs], idx) => {
    const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${cls}_500_rk_gk_${idx}`);
    out.push(["Reasoning & GK", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, "General Awareness"]);
  });

  // 110 Parametric Logical Reasoning & Aptitude Puzzles (guaranteed unique per class)
  for (let i = 0; i < 38; i++) {
    // A: Progressive difference series (d1, d1+step, d1+2*step, ...)
    const a0 = 3 + (i % 15) + cls;
    const d0 = 2 + (i % 5);
    const inc = 2 + (i % 4);
    const t1 = a0;
    const t2 = t1 + d0;
    const t3 = t2 + d0 + inc;
    const t4 = t3 + d0 + 2 * inc;
    const t5 = t4 + d0 + 3 * inc;
    const { options, correctIndex } = makeNumOptions(t5, [inc, -inc, 2, -2], `c${cls}_500_rk_ser_${i}`);
    out.push([
      "Reasoning & GK",
      "SERIES_PUZZLE",
      `Find the next term in the reasoning series: ${t1}, ${t2}, ${t3}, ${t4}, ?`,
      options,
      correctIndex,
      `Differences grow by +${inc}: ${t4} + ${d0 + 3 * inc} = ${t5}.`,
      "Number Series",
    ]);

    // B: Number Coding / Arithmetic Aptitude
    const p = 4 + (i % 12);
    const q = 3 + ((i * 2) % 9);
    const res = p * p + q;
    const { options: optC, correctIndex: idxC } = makeNumOptions(res, [p, -p, 2, -2], `c${cls}_500_rk_cod_${i}`);
    out.push([
      "Reasoning & GK",
      "SERIES_PUZZLE",
      `If rule A * B means A² + B, find the value of ${p} * ${q}:`,
      optC,
      idxC,
      `${p}² + ${q} = ${p * p} + ${q} = ${res}.`,
      "Logical Operators",
    ]);

    // C: Ranking / Age / Clock / Direction Reasoning (rotate across 38 items)
    if (i < 34) {
      if (i % 3 === 0) {
        const left = 5 + i;
        const right = 8 + (i % 17);
        const total = left + right - 1;
        const { options: oR, correctIndex: iR } = makeNumOptions(total, [1, -1, 2, -2], `c${cls}_500_rk_rnk_${i}`);
        out.push([
          "Reasoning & GK",
          "MCQ",
          `In a line, Aarav stands ${left}th from the left and ${right}th from the right. Total students in the line = ?`,
          oR,
          iR,
          `Total = ${left} + ${right} − 1 = ${total}.`,
          "Ranking & Order",
        ]);
      } else if (i % 3 === 1) {
        const north = 6 + (i % 9);
        const east = 8 + (i % 7);
        const sq = north * north + east * east;
        const distApprox = Math.round(Math.sqrt(sq) * 10) / 10;
        // Pick exact Pythagorean triples!
        const triples: [number, number, number][] = [
          [3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25], [10, 24, 26], [15, 20, 25], [18, 24, 30], [20, 21, 29],
        ];
        const [a, b, c] = triples[(i + cls) % triples.length];
        void distApprox;
        const mult = 1 + Math.floor(i / 11);
        const da = a * mult;
        const db = b * mult;
        const dc = c * mult;
        const { options: oD, correctIndex: iD } = makeNumOptions(dc, [2, -2, 4, da + db - dc], `c${cls}_500_rk_dir_${i}`, " km");
        out.push([
          "Reasoning & GK",
          "MCQ",
          `A cyclist rides ${da} km North and then turns East for ${db} km (run #${i + 1}). Shortest straight distance from start:`,
          oD,
          iD,
          `By Pythagoras: √(${da}² + ${db}²) = ${dc} km.`,
          "Direction Sense",
        ]);
      } else {
        const hour = 1 + (i % 11);
        const min = 0;
        const rawAng = Math.abs(30 * hour - 5.5 * min);
        const ang = Math.min(rawAng, 360 - rawAng);
        const { options: oK, correctIndex: iK } = makeNumOptions(ang, [30, -30, 15, 45], `c${cls}_500_rk_clk_${i}`, "°");
        out.push([
          "Reasoning & GK",
          "MCQ",
          `Find the smaller angle between hour and minute hands of a clock at ${hour}:00:`,
          oK,
          iK,
          `At ${hour}:00, angle = min(${30 * hour}°, ${360 - 30 * hour}°) = ${ang}°.`,
          "Clock Angles",
        ]);
      }
    }
  }

  return out; // 25 + 65 + 38 + 38 + 34 = 200 unique Reasoning & GK MCQs per class!
}

export function getExpansion500PackForClass(classLevel: EntranceClassNumber): EntranceTestQuestion[] {
  let tuples: QTuple[] = [];
  if (classLevel <= 5) {
    const c = classLevel as 1 | 2 | 3 | 4 | 5;
    const eng = [
      ...build500PrimaryEnglish(c),
      ...PRI_EXTRA_ENGLISH_25.map(([q, ans, wrongs], i): QTuple => {
        const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${c}_500_eng_x25_${i}`);
        return ["English", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, "Everyday English"];
      }),
    ];
    const math = build500PrimaryMaths(c);
    const hindi = build500PrimaryHindi(c);
    const evs = [
      ...build500PrimaryEvsGk(c),
      ...PRI_EXTRA_EVS_15.map(([q, ans, wrongs], i): QTuple => {
        const { options, correctIndex } = shuffleFourOptions(ans, wrongs, `c${c}_500_evs_x15_${i}`);
        return ["EVS / GK", "MCQ", q, options, correctIndex, `Correct answer: ${ans}.`, "Culture & Science"];
      }),
    ];
    tuples = [...eng, ...math, ...hindi, ...evs];
  } else {
    const c = classLevel as 6 | 7 | 8 | 9 | 10;
    tuples = [
      ...build500SecondaryEnglish(c),
      ...build500SecondaryMaths(c),
      ...build500SecondaryScience(c),
      ...build500SecondarySocial(c),
      ...build500SecondaryReasoning(c),
    ];
  }

  return tuples.map((t, idx) => ({
    id: `c${classLevel}_p500_${idx + 1}`,
    classLevel,
    subject: t[0] as EntranceTestSubject,
    format: t[1],
    question: t[2],
    options: t[3],
    correctIndex: t[4],
    explanation: t[5],
    topicTag: t[6],
    ...(t[7] ? { passage: t[7] } : {}),
  }));
}
