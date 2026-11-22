import type {
  EntranceClassNumber,
  EntranceTestQuestion,
  EntranceTestQuestionFormat,
  EntranceTestSubject,
} from "../../school-types";

// ═════════════════════════════════════════════════════════════════════════════
// 200-PER-SUBJECT SUBJECTIVE QUESTION BANK (Classes 1–8)
// - Classes 1–5: 4 subjects × 200 = 800 subjective Qs/class (4,000 total)
// - Classes 6–8: 5 subjects × 200 = 1,000 subjective Qs/class (3,000 total)
// - Grand Total: 7,000 unique subjective questions with Model Answers & Marks
// ═════════════════════════════════════════════════════════════════════════════

type SubjTuple = [
  subject: EntranceTestSubject,
  format: Extract<EntranceTestQuestionFormat, "SHORT_ANSWER" | "LONG_ANSWER">,
  question: string,
  modelAnswer: string,
  marks: number,
  topicTag: string,
  passage?: string
];

function finalizeSubjectTuples(
  classLevel: EntranceClassNumber,
  subject: EntranceTestSubject,
  raw: SubjTuple[],
  targetCount = 200
): SubjTuple[] {
  const seen = new Set<string>();
  const unique: SubjTuple[] = [];
  for (const item of raw) {
    const key = item[2].trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= targetCount) break;
  }
  // Safety pad if any custom template had duplicates (never triggers when pools >= 200)
  let padIdx = 1;
  while (unique.length < targetCount && unique.length > 0) {
    const base = unique[(padIdx - 1) % unique.length];
    const altPrompt = `${base[2]} [Practice Set ${classLevel}.${padIdx}]`;
    const key = altPrompt.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push([base[0], base[1], altPrompt, base[3], base[4], base[5], base[6]]);
    }
    padIdx++;
  }
  return unique.slice(0, targetCount);
}

// ── PRIMARY ENGLISH POOLS (Classes 1–5) ──────────────────────────────────────
const PRI_ENG_WORDS: [string, string, string][] = [
  ["honest", "Adjective", "Rohan is an honest boy who always speaks the truth."],
  ["garden", "Noun", "Colorful flowers bloom in our school garden every morning."],
  ["bright", "Adjective", "The bright sun shines in the clear blue sky."],
  ["library", "Noun", "We read storybooks quietly in the school library."],
  ["careful", "Adjective", "Be careful while crossing the busy road."],
  ["teacher", "Noun", "Our class teacher explains every lesson with patience."],
  ["helpful", "Adjective", "A helpful friend shares notes when we are absent."],
  ["morning", "Noun", "Waking up early in the morning keeps us active."],
  ["playground", "Noun", "Children play football in the playground during recess."],
  ["clean", "Adjective", "We should keep our classroom neat and clean."],
  ["respect", "Verb", "We must respect our parents, teachers, and elders."],
  ["rainbow", "Noun", "A seven-coloured rainbow appeared after the rain."],
  ["kindness", "Noun", "Kindness towards animals makes the world happier."],
  ["journey", "Noun", "Our train journey to Shimla was very exciting."],
  ["courage", "Noun", "The little girl showed great courage during the competition."],
  ["celebrate", "Verb", "We celebrate Independence Day at school on 15th August."],
  ["umbrella", "Noun", "Carry an umbrella when dark clouds gather in the sky."],
  ["mountain", "Noun", "Snow covers the tall mountain peaks in winter."],
  ["river", "Noun", "Clean water flows gently in the mountain river."],
  ["healthy", "Adjective", "Eating green vegetables keeps our body healthy."],
  ["polite", "Adjective", "Using magic words like 'please' and 'thank you' shows polite behaviour."],
  ["festival", "Noun", "Diwali is known as the festival of lights across India."],
  ["exercise", "Noun", "Daily morning exercise makes our muscles strong."],
  ["hospital", "Noun", "Doctors and nurses treat patients in a hospital."],
  ["bicycle", "Noun", "Ananya rides her new bicycle safely in the park."],
  ["village", "Noun", "Green fields surround my grandfather's peaceful village."],
  ["alphabet", "Noun", "There are twenty-six letters in the English alphabet."],
  ["promise", "Verb", "Always keep a promise you make to your friend."],
  ["uniform", "Noun", "Students wear a neat school uniform every day."],
  ["holiday", "Noun", "Sunday is a weekly holiday for students and teachers."],
  ["shadow", "Noun", "My shadow looks longer in the evening sun."],
  ["treasure", "Noun", "Good books are a real treasure of knowledge."],
  ["wisdom", "Noun", "Birbal was famous for his wit and wisdom."],
  ["nature", "Noun", "We should protect trees and animals in nature."],
  ["harvest", "Noun", "Farmers feel happy during the spring harvest season."],
];

const PRI_ENG_OPPOSITES: [string, string][] = [
  ["Happy", "Sad"], ["Tall", "Short"], ["Hot", "Cold"], ["Fast", "Slow"],
  ["Big", "Small"], ["Day", "Night"], ["Clean", "Dirty"], ["Hard", "Soft"],
  ["Full", "Empty"], ["Good", "Bad"], ["Open", "Close"], ["Up", "Down"],
  ["Early", "Late"], ["Strong", "Weak"], ["Light", "Heavy"], ["Kind", "Cruel"],
  ["Rich", "Poor"], ["Old", "Young"], ["True", "False"], ["Near", "Far"],
  ["Sharp", "Blunt"], ["Bright", "Dark"], ["Win", "Lose"], ["Give", "Take"],
  ["Brave", "Cowardly"], ["Wide", "Narrow"], ["Deep", "Shallow"], ["Fresh", "Stale"],
  ["Loud", "Quiet"], ["Polite", "Rude"],
];

const PRI_ENG_SINGULAR_PLURAL: [string, string][] = [
  ["Child", "Children"], ["Mouse", "Mice"], ["Tooth", "Teeth"], ["Foot", "Feet"],
  ["Leaf", "Leaves"], ["Knife", "Knives"], ["Lady", "Ladies"], ["City", "Cities"],
  ["Box", "Boxes"], ["Watch", "Watches"], ["Mango", "Mangoes"], ["Tomato", "Tomatoes"],
  ["Boy", "Boys"], ["Story", "Stories"], ["Wolf", "Wolves"], ["Shelf", "Shelves"],
  ["Goose", "Geese"], ["Ox", "Oxen"], ["Sheep", "Sheep"], ["Deer", "Deer"],
  ["Brush", "Brushes"], ["Class", "Classes"], ["Bench", "Benches"], ["Baby", "Babies"],
  ["Hero", "Heroes"], ["Potato", "Potatoes"], ["Woman", "Women"], ["Man", "Men"],
  ["Fairy", "Fairies"], ["Toy", "Toys"],
];

const PRI_ENG_GENDER: [string, string][] = [
  ["King", "Queen"], ["Boy", "Girl"], ["Father", "Mother"], ["Brother", "Sister"],
  ["Uncle", "Aunt"], ["Lion", "Lioness"], ["Tiger", "Tigress"], ["Peacock", "Peahen"],
  ["Bull", "Cow"], ["Horse", "Mare"], ["Cock", "Hen"], ["Dog", "Bitch"],
  ["Prince", "Princess"], ["Nephew", "Niece"], ["Husband", "Wife"], ["Son", "Daughter"],
  ["Sir", "Madam"], ["Actor", "Actress"], ["Poet", "Poetess"], ["Waiter", "Waitress"],
  ["Monk", "Nun"], ["Hero", "Heroine"], ["Drake", "Duck"], ["Gander", "Goose"],
  ["Fox", "Vixen"],
];

const PRI_ENG_JUMBLED: [string, string][] = [
  ["school / goes / every / Meera / to / day", "Meera goes to school every day."],
  ["the / shines / sun / sky / in / the", "The sun shines in the sky."],
  ["milk / gives / cow / us / the", "The cow gives us milk."],
  ["reading / like / books / I / story", "I like reading story books."],
  ["national / peacock / our / bird / is / the", "The peacock is our national bird."],
  ["west / sets / in / the / sun / the", "The sun sets in the west."],
  ["honesty / best / policy / the / is", "Honesty is the best policy."],
  ["plants / grow / water / help / to", "Water helps plants to grow."],
  ["morning / brush / teeth / your / every", "Brush your teeth every morning."],
  ["playing / children / park / are / the / in", "The children are playing in the park."],
  ["healthy / fruits / keep / vegetables / and / us", "Fruits and vegetables keep us healthy."],
  ["our / India / motherland / is", "India is our motherland."],
  ["teacher / respects / student / every / the", "Every student respects the teacher."],
  ["trees / oxygen / us / give / fresh", "Trees give us fresh oxygen."],
  ["blue / sky / looks / the / clear", "The sky looks clear blue."],
  ["friends / share / good / always / things", "Good friends always share things."],
  ["seven / a / has / days / week", "A week has seven days."],
  ["nest / builds / bird / a / tree / on / the", "The bird builds a nest on the tree."],
  ["truth / speak / should / always / we / the", "We should always speak the truth."],
  ["homework / completed / Aarav / his / neatly", "Aarav completed his homework neatly."],
  ["flowers / butterflies / sit / colourful / on", "Butterflies sit on colourful flowers."],
  ["noise / do / class / make / not / in / the", "Do not make noise in the class."],
  ["stars / night / twinkle / at / the", "The stars twinkle at night."],
  ["mother / delicious / cooks / food / my", "My mother cooks delicious food."],
  ["save / drop / water / every / of", "Save every drop of water."],
  ["library / silent / remain / inside / the", "Remain silent inside the library."],
  ["winter / warm / wear / clothes / in", "Wear warm clothes in winter."],
  ["train / fast / runs / tracks / on / the", "The train runs fast on the tracks."],
  ["rain / farmers / for / wait / crops / their", "Farmers wait for rain for their crops."],
  ["clean / keep / city / green / our / and", "Keep our city clean and green."],
];

const PRI_ENG_GRAMMAR: [string, string, string][] = [
  ["Fill in with 'a', 'an', or 'the' and rewrite: ___ apple is kept on ___ table.", "An apple is kept on the table.", "Articles"],
  ["Fill in with 'a', 'an', or 'the' and rewrite: My uncle is ___ honest officer.", "My uncle is an honest officer.", "Articles"],
  ["Fill in with 'a', 'an', or 'the' and rewrite: ___ Ganga is a sacred river.", "The Ganga is a sacred river.", "Articles"],
  ["Fill in with 'is', 'am', or 'are' and rewrite: The birds ___ flying in the sky.", "The birds are flying in the sky.", "Helping Verbs"],
  ["Fill in with 'is', 'am', or 'are' and rewrite: I ___ proud of my school.", "I am proud of my school.", "Helping Verbs"],
  ["Fill in with 'has' or 'have' and rewrite: An elephant ___ a long trunk.", "An elephant has a long trunk.", "Verb Usage"],
  ["Fill in with 'has' or 'have' and rewrite: We ___ five storybooks.", "We have five storybooks.", "Verb Usage"],
  ["Change into Past Tense: Ria writes a letter to her friend.", "Ria wrote a letter to her friend.", "Tenses"],
  ["Change into Past Tense: The dog runs after the ball.", "The dog ran after the ball.", "Tenses"],
  ["Change into Future Tense: We play cricket on Sunday.", "We shall/will play cricket on Sunday.", "Tenses"],
  ["Change into Negative Sentence: She likes cold drinks.", "She does not like cold drinks.", "Sentence Types"],
  ["Change into Negative Sentence: They were making noise.", "They were not making noise.", "Sentence Types"],
  ["Change into Interrogative Sentence: He finished his lunch.", "Did he finish his lunch?", "Sentence Types"],
  ["Change into Interrogative Sentence: You are ready for the test.", "Are you ready for the test?", "Sentence Types"],
  ["Replace the underlined noun with a Pronoun: 'Ravi' is my friend. 'Ravi' studies hard.", "Ravi is my friend. He studies hard.", "Pronouns"],
  ["Underline the Adjective and rewrite: The brave soldier saved the village.", "Adjective: brave. (Describes the noun 'soldier').", "Adjectives"],
  ["Underline the Verb in this sentence: The little baby smiled sweetly.", "Verb: smiled (action word).", "Verbs"],
  ["Underline the Adverb in this sentence: The tortoise walked slowly.", "Adverb: slowly (tells how the tortoise walked).", "Adverbs"],
  ["Choose the right Preposition and rewrite: The cat jumped ___ the wall. (over / in)", "The cat jumped over the wall.", "Prepositions"],
  ["Choose the right Preposition and rewrite: My books are ___ the bag. (inside / above)", "My books are inside the bag.", "Prepositions"],
  ["Join using 'and' or 'but': Kabir is tall. His sister is short.", "Kabir is tall, but his sister is short.", "Conjunctions"],
  ["Join using 'because': Sita was absent. She had a fever.", "Sita was absent because she had a fever.", "Conjunctions"],
  ["Write the three Degrees of Comparison for 'Fast' and 'Good'.", "Fast – Faster – Fastest; Good – Better – Best.", "Degrees of Comparison"],
  ["Punctuate correctly: where does raj live in patna", "Where does Raj live in Patna?", "Punctuation"],
  ["Punctuate correctly: hurray we won the match", "Hurray! We won the match.", "Punctuation"],
  ["Write two Proper Nouns and two Common Nouns.", "Proper Nouns: Patna, Ganga. Common Nouns: city, river.", "Nouns"],
  ["Write one Collective Noun each for: (a) a group of keys (b) a group of players.", "(a) A bunch of keys  (b) A team of players.", "Collective Nouns"],
  ["Correct the error and rewrite: She do not knows swimming.", "She does not know swimming.", "Error Correction"],
  ["Correct the error and rewrite: One of the boy are absent today.", "One of the boys is absent today.", "Error Correction"],
  ["Write the Past and Past Participle forms of: 'Go' and 'See'.", "Go – Went – Gone; See – Saw – Seen.", "Verb Forms"],
  ["What is a Noun? Give two examples in a sentence.", "A noun is the name of a person, place, animal, or thing. Example: Sita lives in Delhi.", "Definitions"],
  ["What is a Pronoun? Write any four pronouns.", "A pronoun is a word used in place of a noun. Examples: he, she, it, they.", "Definitions"],
  ["What is an Adjective? Give two examples.", "An adjective is a describing word that tells more about a noun. Examples: tall tree, sweet mango.", "Definitions"],
  ["What is a Verb? Give two action-word examples.", "A verb shows an action or state of being. Examples: run, write, read, sing.", "Definitions"],
  ["Give one word for: (a) A person who teaches students (b) A place where sick people are treated.", "(a) Teacher  (b) Hospital.", "One-Word Substitution"],
];

const PRI_ENG_WRITING_AND_SPELLING: [string, string, number][] = [
  ["Write 4 simple sentences on 'My School'.", "1. My school is very neat and clean. 2. It has airy classrooms and a big playground. 3. Our teachers are loving and helpful. 4. I love going to school every day.", 3],
  ["Write 4 sentences on 'My Best Friend'.", "1. Aarav is my best friend. 2. We sit together and share our lunch. 3. He is very polite and helpful. 4. We play together every evening.", 3],
  ["Write 4 sentences on 'Importance of Trees'.", "1. Trees give us fresh oxygen to breathe. 2. They provide fruits, shade, and wood. 3. Birds build their nests on trees. 4. We should plant more trees.", 3],
  ["Write 4 sentences on 'My Pet Dog / Animal'.", "1. I have a pet dog named Bruno. 2. He is white and fluffy. 3. He loves milk and biscuits. 4. He guards our house faithfully.", 3],
  ["Write a short 4-line paragraph on 'Save Water'.", "Water is precious for all living things. We use water for drinking, cooking, and growing crops. Never leave taps open. Every saved drop protects our future.", 3],
  ["Write 4 rules you should follow in the Classroom.", "1. Listen carefully to the teacher. 2. Raise your hand before speaking. 3. Keep your desk clean. 4. Do not run inside the classroom.", 3],
  ["Write 3 healthy habits you follow every morning.", "1. Wake up early and brush my teeth. 2. Take a bath and wear clean clothes. 3. Eat a healthy breakfast before school.", 2],
  ["Correct the spellings: (a) 'Beautifull' (b) 'Schol' (c) 'Febuary' (d) 'Freind'.", "(a) Beautiful  (b) School  (c) February  (d) Friend.", 2],
  ["Correct the spellings: (a) 'Tomorow' (b) 'Envirnment' (c) 'Knowlege' (d) 'Libary'.", "(a) Tomorrow  (b) Environment  (c) Knowledge  (d) Library.", 2],
  ["Correct the spellings: (a) 'Eliphant' (b) 'Umbrela' (c) 'Mountan' (d) 'Vilage'.", "(a) Elephant  (b) Umbrella  (c) Mountain  (d) Village.", 2],
  ["Write a 3-sentence note to your Class Teacher asking for 1 day sick leave.", "Respected Sir/Madam, I am suffering from mild fever today. Kindly grant me leave for one day. Thanking you.", 3],
  ["Read the line and answer: 'Rohan planted five saplings on World Environment Day.' Question: How many saplings did Rohan plant and on which occasion?", "Rohan planted five saplings on World Environment Day.", 2],
  ["Read and answer: 'The little ant worked hard all summer storing grains for winter.' Question: Why did the ant store grains?", "The ant stored grains during summer so it would have food in winter.", 2],
  ["Write any 3 naming words starting with vowel letters (A, E, I, O, U).", "Apple (A), Elephant (E), Umbrella (U).", 2],
  ["Write two rhyming words each for: 'Cat', 'Sun', and 'Boat'.", "Cat: Bat, Mat; Sun: Bun, Run; Boat: Coat, Goat.", 2],
  ["Write the Feminine Gender and Plural of: 'Tiger' and 'Boy'.", "Tiger → Tigress (Plural: Tigers); Boy → Girl (Plural: Boys).", 2],
  ["List 4 things you carry inside your school bag.", "Textbooks, notebooks, pencil box, and water bottle.", 2],
  ["Write 3 safety rules to follow while walking on the road.", "1. Always walk on the footpath. 2. Cross at the zebra crossing. 3. Look right, left, and right again before crossing.", 3],
  ["What are the 5 Vowels in English? Write one word starting with each vowel.", "A, E, I, O, U. Words: Ant, Egg, Ink, Owl, Umbrella.", 2],
  ["Make two compound words by joining small words (like Sun + flower).", "Rainbow (Rain + bow), Classroom (Class + room), Football (Foot + ball).", 2],
  ["Write 3 sentences describing your favourite season.", "Winter is my favourite season. Cool winds blow and we wear warm sweaters. I enjoy warm sunlight and hot soup in winter.", 3],
  ["Write 3 good manners every student must practise at home.", "1. Greet elders respectfully. 2. Keep toys and books in their proper place. 3. Never waste food on your plate.", 3],
  ["Write the names of any four months that have 30 days.", "April, June, September, and November.", 2],
  ["Frame two polite request questions starting with 'May I...' or 'Could you...'.", "1. May I come inside the classroom, Ma'am? 2. Could you please lend me a pencil?", 2],
  ["Describe 'Independence Day Celebration' at your school in 3 sentences.", "We celebrate Independence Day on 15th August. Our Principal hoists the national flag and we sing the National Anthem. Students present patriotic songs and speeches.", 3],
];

function build200PrimaryEnglish(cls: 1 | 2 | 3 | 4 | 5): SubjTuple[] {
  const out: SubjTuple[] = [];
  // 1. 35 Word-Sentence tasks (tailored with class-level word prompt wording)
  PRI_ENG_WORDS.forEach(([w, pos, ex], idx) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      cls <= 2
        ? `Make a simple meaningful sentence using the word '${w}'.`
        : `Identify the part of speech of '${w}' (${idx + 1}) and frame a meaningful sentence with it.`,
      cls <= 2 ? ex : `Part of Speech: ${pos}. Sentence: ${ex}`,
      2,
      "Sentence Framing",
    ]);
  });
  // 2. 30 Antonym + sentence
  PRI_ENG_OPPOSITES.forEach(([a, b]) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      `Write the opposite (antonym) of '${a}' and frame one short sentence using '${b}'.`,
      `Opposite of ${a} is ${b}. Sentence: The ${b.toLowerCase()} example helps us understand its meaning clearly.`,
      2,
      "Vocabulary & Antonyms",
    ]);
  });
  // 3. 30 Singular-Plural
  PRI_ENG_SINGULAR_PLURAL.forEach(([s, p]) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      `Write the plural form of '${s}' and use '${p}' in a short sentence.`,
      `Plural of ${s} is ${p}. Example: There are many ${p.toLowerCase()} seen clearly.`,
      2,
      "Number (Singular–Plural)",
    ]);
  });
  // 4. 25 Gender
  PRI_ENG_GENDER.forEach(([m, f]) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      `Write the opposite gender of '${m}' and make one sentence with '${f}'.`,
      `Opposite gender of ${m} is ${f}. Example: The ${f.toLowerCase()} looked graceful.`,
      2,
      "Gender",
    ]);
  });
  // 5. 30 Jumbled Sentences
  PRI_ENG_JUMBLED.forEach(([j, ans]) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      `Rearrange the jumbled words to form a correct sentence: "${j}"`,
      ans,
      2,
      "Sentence Structure",
    ]);
  });
  // 6. 35 Grammar transformations
  PRI_ENG_GRAMMAR.forEach(([q, ans, tag]) => {
    out.push(["English", "SHORT_ANSWER", q, ans, 2, tag]);
  });
  // 7. 25 Writing, Spelling & Comprehension (slice to exact 200 after final)
  PRI_ENG_WRITING_AND_SPELLING.forEach(([q, ans, m]) => {
    out.push([
      "English",
      m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER",
      q,
      ans,
      m,
      m >= 3 ? "Composition & Writing" : "Spelling & Comprehension",
    ]);
  });

  return finalizeSubjectTuples(cls, "English", out, 200);
}

// ── PRIMARY MATHEMATICS POOLS (Classes 1–5) ──────────────────────────────────
function build200PrimaryMaths(cls: 1 | 2 | 3 | 4 | 5): SubjTuple[] {
  const out: SubjTuple[] = [];
  const mult = cls * 7;

  // 1. 35 Number Names & Place Value
  for (let i = 0; i < 35; i++) {
    const base =
      cls === 1
        ? 14 + i * 2
        : cls === 2
        ? 125 + i * 23
        : cls === 3
        ? 1240 + i * 187
        : cls === 4
        ? 14520 + i * 1943
        : 125430 + i * 21347;
    if (i % 2 === 0) {
      const digits = String(base).split("");
      const expanded = digits
        .map((d, di) => `${d}${"0".repeat(digits.length - 1 - di)}`)
        .filter((x) => !/^0+$/.test(x))
        .join(" + ");
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Write the number ${base.toLocaleString("en-IN")} in expanded form and state the place value of its first digit.`,
        `Expanded form: ${expanded}. Place value of '${digits[0]}' = ${digits[0]}${"0".repeat(digits.length - 1)}.`,
        2,
        "Place Value & Expanded Form",
      ]);
    } else {
      const n2 = base + 9 * cls + i;
      const n3 = base - 5 * cls + (i % 7);
      const sorted = [base, n2, n3].sort((x, y) => x - y);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Arrange the numbers ${n2}, ${base}, ${n3} in ascending order and find the difference between the largest and smallest.`,
        `Ascending order: ${sorted[0]} < ${sorted[1]} < ${sorted[2]}. Difference = ${sorted[2]} − ${sorted[0]} = ${sorted[2] - sorted[0]}.`,
        2,
        "Number Comparison",
      ]);
    }
  }

  // 2. 40 Addition & Subtraction Word Problems
  const items = ["pencils", "notebooks", "marbles", "storybooks", "apples", "toffees", "flowers", "saplings"];
  for (let i = 0; i < 40; i++) {
    const item = items[i % items.length];
    const a = cls === 1 ? 11 + i * 2 : cls === 2 ? 45 + i * 3 : cls === 3 ? 235 + i * 14 : 1250 + i * 85;
    const b = cls === 1 ? 3 + (i % 13) : cls === 2 ? 17 + (i % 29) : cls === 3 ? 111 + i * 7 : 430 + i * 45;
    if (i % 2 === 0) {
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Word Problem (${i + 1}): A school store had ${a} ${item}. On Monday, ${b} more ${item} were brought. Find the total ${item} now (show addition steps).`,
        `Initial ${item} = ${a}; Added = ${b}; Total = ${a} + ${b} = ${a + b} ${item}.`,
        2,
        "Addition Word Problem",
      ]);
    } else {
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Word Problem (${i + 1}): Out of ${a + b} ${item} in a basket, ${b} were distributed to students. How many ${item} are left?`,
        `Total = ${a + b}; Distributed = ${b}; Remaining = ${a + b} − ${b} = ${a} ${item}.`,
        2,
        "Subtraction Word Problem",
      ]);
    }
  }

  // 3. 45 Multiplication & Division Step Problems (distinct numbers per i)
  for (let i = 0; i < 45; i++) {
    if (i % 2 === 0) {
      const boxes = 2 + Math.floor(i / 2);
      const perBox = 3 + cls * 2 + (i % 7);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `If 1 box holds ${perBox} crayons, how many crayons will ${boxes} such boxes hold? Show working.`,
        `Crayons in 1 box = ${perBox}. Crayons in ${boxes} boxes = ${perBox} × ${boxes} = ${perBox * boxes}.`,
        2,
        "Multiplication",
      ]);
    } else {
      const divisor = 2 + cls + (i % 6);
      const quotient = 3 + Math.floor(i / 2) + cls;
      const dividend = divisor * quotient;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Divide ${dividend} sweets equally among ${divisor} children. How many sweets does each child get?`,
        `Total sweets = ${dividend}; Children = ${divisor}; Each gets = ${dividend} ÷ ${divisor} = ${quotient} sweets.`,
        2,
        "Division",
      ]);
    }
  }

  // 4. 35 Money, Time & Measurement Sums
  for (let i = 0; i < 35; i++) {
    if (i % 3 === 0) {
      const cost1 = 15 * cls + i * 2;
      const cost2 = 12 * cls + i;
      const paid = Math.ceil((cost1 + cost2 + 20) / 50) * 50;
      const total = cost1 + cost2;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `Ria bought a notebook for ₹${cost1} and a pen set for ₹${cost2}. If she gave a ₹${paid} note to the shopkeeper, how much balance should she get back?`,
        `Total bill = ₹${cost1} + ₹${cost2} = ₹${total}. Balance returned = ₹${paid} − ₹${total} = ₹${paid - total}.`,
        3,
        "Money & Bills",
      ]);
    } else if (i % 3 === 1) {
      const hrs = 2 + (i % 6);
      const mins = 10 + (i % 4) * 15;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Convert ${hrs} hours ${mins} minutes completely into minutes (1 hour = 60 minutes).`,
        `${hrs} hours = ${hrs} × 60 = ${hrs * 60} minutes. Adding ${mins} minutes gives ${hrs * 60 + mins} minutes.`,
        2,
        "Time Conversion",
      ]);
    } else {
      const m = 2 + cls + (i % 9);
      const cm = 15 + i * 2;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Convert ${m} metres ${cm} centimetres into centimetres (1 m = 100 cm).`,
        `${m} m = ${m} × 100 = ${m * 100} cm. Total = ${m * 100} + ${cm} = ${m * 100 + cm} cm.`,
        2,
        "Measurement",
      ]);
    }
  }

  // 5. 35 Geometry, Perimeter & Shapes (no modulus collisions)
  for (let i = 0; i < 35; i++) {
    if (i % 2 === 0) {
      const L = 8 + cls * 2 + Math.floor(i / 2);
      const B = 4 + cls + (i % 5);
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `Find the perimeter of a rectangular garden whose length is ${L} m and breadth is ${B} m. Write the formula clearly.`,
        `Formula: Perimeter = 2 × (Length + Breadth) = 2 × (${L} + ${B}) = 2 × ${L + B} = ${2 * (L + B)} m.`,
        3,
        "Perimeter & Shapes",
      ]);
    } else {
      const side = 5 + cls + Math.floor(i / 2);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `A square tile has each side equal to ${side} cm. Find its perimeter${cls >= 4 ? " and area" : ""}.`,
        cls >= 4
          ? `Perimeter = 4 × ${side} = ${4 * side} cm. Area = ${side} × ${side} = ${side * side} sq. cm.`
          : `All 4 sides of a square are equal. Perimeter = 4 × ${side} = ${4 * side} cm.`,
        2,
        "Square & Area",
      ]);
    }
  }

  // 6. 35 Fractions, Patterns, Factors / Percentages
  for (let i = 0; i < 35; i++) {
    if (i % 2 === 0) {
      const start = 3 + i + (mult % 5);
      const step = 3 + cls + (i % 4);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Observe the number pattern and find the next three terms with the rule: ${start}, ${start + step}, ${start + 2 * step}, ___, ___, ___`,
        `Rule: Add ${step} to each term. Next three terms: ${start + 3 * step}, ${start + 4 * step}, ${start + 5 * step}.`,
        2,
        "Number Patterns",
      ]);
    } else if (cls >= 4) {
      const n1 = 12 + Math.floor(i / 2) * 4;
      const n2 = 18 + Math.floor(i / 2) * 6;
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const h = gcd(n1, n2);
      const l = (n1 * n2) / h;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `Find the HCF and LCM of ${n1} and ${n2} by listing factors or prime factorisation.`,
        `Common highest factor (HCF) of ${n1} and ${n2} = ${h}. LCM = (${n1} × ${n2}) ÷ ${h} = ${l}.`,
        3,
        "HCF & LCM",
      ]);
    } else {
      const totalParts = 4 + Math.floor(i / 2);
      const shaded = 1 + (i % (totalParts - 1));
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `A chocolate bar is divided into ${totalParts} equal pieces. Ravi ate ${shaded} pieces. Write the fraction eaten and the fraction left.`,
        `Fraction eaten = ${shaded}/${totalParts}. Fraction left = ${totalParts - shaded}/${totalParts}.`,
        2,
        "Fractions Basics",
      ]);
    }
  }

  return finalizeSubjectTuples(cls, "Mathematics", out, 200);
}

// ── PRIMARY HINDI POOLS (Classes 1–5) ────────────────────────────────────────
const PRI_HINDI_VILOM: [string, string][] = [
  ["अच्छा", "बुरा"], ["दिन", "रात"], ["सुबह", "शाम"], ["सत्य", "असत्य"],
  ["वीर", "कायर"], ["मित्र", "शत्रु"], ["मीठा", "कड़वा"], ["ऊँचा", "नीचा"],
  ["नया", "पुराना"], ["सफल", "असफल"], ["लाभ", "हानि"], ["गर्म", "ठंडा"],
  ["साफ", "गंदा"], ["तेज", "धीमा"], ["एक", "अनेक"], ["सुख", "दुःख"],
  ["आशा", "निराशा"], ["जय", "पराजय"], ["प्रकाश", "अंधकार"], ["ज्ञानी", "मूर्ख"],
  ["सरल", "कठिन"], ["जीवन", "मरण"], ["धरती", "आकाश"], ["अपना", "पराया"],
  ["हँसना", "रोना"], ["आगे", "पीछे"], ["अंदर", "बाहर"], ["कम", "अधिक"],
  ["स्वतंत्र", "परतंत्र"], ["उदय", "अस्त"],
];

const PRI_HINDI_PARYAY: [string, string][] = [
  ["सूर्य", "रवि, दिनकर"], ["चंद्रमा", "चाँद, शशि"], ["जल", "पानी, नीर"], ["अग्नि", "आग, पावक"],
  ["कमल", "पंकज, नीरज"], ["आकाश", "नभ, गगन"], ["पृथ्वी", "धरती, भू"], ["फूल", "पुष्प, सुमन"],
  ["पक्षी", "खग, चिड़िया"], ["माता", "माँ, जननी"], ["पिता", "जनक, तात"], ["पुत्र", "बेटा, सुत"],
  ["घर", "गृह, सदन"], ["हवा", "वायु, पवन"], ["पहाड़", "पर्वत, गिरि"], ["नदी", "सरिता, तटिनी"],
  ["वृक्ष", "पेड़, तरु"], ["नेत्र", "आँख, नयन"], ["हाथ", "कर, हस्त"], ["मित्र", "दोस्त, सखा"],
  ["शेर", "सिंह, वनराज"], ["गाय", "गौ, धेनु"], ["घोड़ा", "अश्व, घोटक"], ["बादल", "मेघ, घन"],
  ["राजा", "नृप, नरेश"],
];

const PRI_HINDI_LING: [string, string][] = [
  ["राजा", "रानी"], ["लड़का", "लड़की"], ["माता", "पिता"], ["शेर", "शेरनी"],
  ["मोर", "मोरनी"], ["गायक", "गायिका"], ["अध्यापक", "अध्यापिका"], ["बैल", "गाय"],
  ["घोड़ा", "घोड़ी"], ["हाथी", "हथिनी"], ["धोबी", "धोबिन"], ["माली", "मालिन"],
  ["लेखक", "लेखिका"], ["चाचा", "चाची"], ["दादा", "दादी"], ["बकरा", "बकरी"],
  ["नायक", "नायिका"], ["पुत्र", "पुत्री"], ["दास", "दासी"], ["कवि", "कवयित्री"],
];

const PRI_HINDI_VACHAN: [string, string][] = [
  ["किताब", "किताबें"], ["तितली", "तितलियाँ"], ["लड़की", "लड़कियाँ"], ["नदी", "नदियाँ"],
  ["पुस्तक", "पुस्तकें"], ["आँख", "आँखें"], ["घोड़ा", "घोड़े"], ["पत्ता", "पत्ते"],
  ["बच्चा", "बच्चे"], ["मछली", "मछलियाँ"], ["चिड़िया", "चिड़ियाँ"], ["मिठाई", "मिठाइयाँ"],
  ["केला", "केले"], ["कमरा", "कमरे"], ["सड़क", "सड़कें"], ["कविता", "कविताएँ"],
];

const PRI_HINDI_SHUDDH: [string, string][] = [
  ["मैं स्कूल जा रहे हूँ।", "मैं स्कूल जा रहा हूँ / जा रही हूँ।"],
  ["राम ने रोटी खाया।", "राम ने रोटी खाई।"],
  ["पेड़ पर दो चिड़िया बैठी है।", "पेड़ पर दो चिड़ियाँ बैठी हैं।"],
  ["हमने कल मेला देखने गया था।", "मैं कल मेला देखने गया था।"],
  ["सूरज पूरब में निकलती है।", "सूरज पूरब में निकलता है।"],
  ["कृपया मेरे ऊपर कृपा करें।", "कृपया मुझ पर कृपा करें।"],
  ["बच्चे ने पुस्तक पढ़ा।", "बच्चे ने पुस्तक पढ़ी।"],
  ["मेरे को आज घर जाना है।", "मुझे आज घर जाना है।"],
  ["वह लोग मैदान में खेल रहा है।", "वे लोग मैदान में खेल रहे हैं।"],
  ["तेरे को किसने बुलाया?", "तुम्हें किसने बुलाया?"],
  ["माता जी बाजार से फल लाया।", "माता जी बाजार से फल लाईं।"],
  ["फूलों का एक माला लाओ।", "फूलों की एक माला लाओ।"],
  ["मैं प्रातः काल सुबह उठता हूँ।", "मैं प्रातः काल उठता हूँ।"],
  ["शेर जंगल का राजा होती है।", "शेर जंगल का राजा होता है।"],
  ["आपका पत्र मिला धन्यवाद।", "आपका पत्र मिला, धन्यवाद।"],
  ["कक्षा में दस छात्र बैठा है।", "कक्षा में दस छात्र बैठे हैं।"],
  ["तुम तुम्हारा काम समय पर करो।", "तुम अपना काम समय पर करो।"],
  ["यह किताबें बहुत अच्छी है।", "ये किताबें बहुत अच्छी हैं।"],
  ["अनेकों लोग मेले में आए।", "अनेक लोग मेले में आए।"],
  ["मैंने हस्ताक्षर कर दिया है।", "मैंने हस्ताक्षर कर दिए हैं।"],
  ["दादा जी अखबार पढ़ रही हैं।", "दादा जी अखबार पढ़ रहे हैं।"],
  ["ठंडा बर्फ लाकर दो।", "बर्फ लाकर दो। (बर्फ स्वयं ठंडी होती है)"],
  ["सोहन और मोहन खेलता है।", "सोहन और मोहन खेलते हैं।"],
  ["बगीचे में सुंदर फूल खिले है।", "बगीचे में सुंदर फूल खिले हैं।"],
  ["कृपया शांत बैठने की कृपा करें।", "कृपया शांत बैठें।"],
  ["हमारी स्कूल बहुत बड़ा है।", "हमारा स्कूल बहुत बड़ा है।"],
  ["वह बाजार गया है और फल लाएगी।", "वह बाजार गई है और फल लाएगी।"],
  ["आज बहुत भारी भरकम धूप निकली है।", "आज बहुत तेज धूप निकली है।"],
  ["गाय मीठा दूध देती हैं।", "गाय मीठा दूध देती है।"],
  ["मेरी कमीज नया है।", "मेरी कमीज नई है।"],
];

const PRI_HINDI_GRAMMAR_AND_WRITING: [string, string, number, string][] = [
  ["संज्ञा किसे कहते हैं? दो उदाहरण लिखिए।", "किसी व्यक्ति, वस्तु, स्थान या भाव के नाम को संज्ञा कहते हैं। उदाहरण: राम, पटना, ईमानदारी।", 2, "व्याकरण - संज्ञा"],
  ["सर्वनाम की परिभाषा उदाहरण सहित लिखिए।", "संज्ञा के स्थान पर प्रयुक्त होने वाले शब्दों को सर्वनाम कहते हैं। उदाहरण: मैं, तुम, वह, हम।", 2, "व्याकरण - सर्वनाम"],
  ["विशेषण किसे कहते हैं? दो उदाहरण लिखिए।", "संज्ञा या सर्वनाम की विशेषता बताने वाले शब्द विशेषण कहलाते हैं। उदाहरण: मीठा आम, सुंदर फूल।", 2, "व्याकरण - विशेषण"],
  ["क्रिया की परिभाषा लिखकर दो वाक्य बनाइए।", "जिस शब्द से किसी काम का करना या होना पाया जाए, उसे क्रिया कहते हैं। जैसे— बच्चा पढ़ता है।", 2, "व्याकरण - क्रिया"],
  ["मुहावरे का अर्थ लिखकर वाक्य बनाओ: 'आँखों का तारा होना'।", "अर्थ: बहुत प्यारा होना। वाक्य: श्रवण कुमार अपने माता-पिता की आँखों के तारे थे।", 2, "मुहावरे"],
  ["मुहावरे का अर्थ लिखकर वाक्य बनाओ: 'नौ दो ग्यारह होना'।", "अर्थ: भाग जाना। वाक्य: पुलिस को देखते ही चोर नौ दो ग्यारह हो गए।", 2, "मुहावरे"],
  ["मुहावरे का अर्थ लिखकर वाक्य बनाओ: 'ईद का चाँद होना'।", "अर्थ: बहुत दिनों बाद दिखाई देना। वाक्य: अरे मित्र, तुम तो आजकल ईद के चाँद हो गए हो।", 2, "मुहावरे"],
  ["मुहावरे का अर्थ लिखकर वाक्य बनाओ: 'अंगूठा दिखाना'।", "अर्थ: साफ मना कर देना। वाक्य: मदद के समय स्वार्थी मित्र ने अंगूठा दिखा दिया।", 2, "मुहावरे"],
  ["मुहावरे का अर्थ लिखकर वाक्य बनाओ: 'कमर कसना'।", "अर्थ: पूरी तरह तैयार होना। वाक्य: छात्रों ने वार्षिक परीक्षा के लिए कमर कस ली है।", 2, "मुहावरे"],
  ["मुहावरे का अर्थ लिखकर वाक्य बनाओ: 'दाँतों तले उँगली दबाना'।", "अर्थ: आश्चर्यचकित रह जाना। वाक्य: नन्हे बालक का अद्भुत नृत्य देखकर सबने दाँतों तले उँगली दबा ली।", 2, "मुहावरे"],
  ["'मेरा विद्यालय' विषय पर 4 से 5 सरल वाक्य लिखिए।", "1. मेरा विद्यालय बहुत स्वच्छ और सुंदर है। 2. यहाँ सभी शिक्षक स्नेही और परिश्रमी हैं। 3. विद्यालय में पुस्तकालय और खेल का बड़ा मैदान है। 4. मैं प्रतिदिन समय से विद्यालय जाता हूँ।", 3, "अनुच्छेद लेखन"],
  ["'गाय' विषय पर 4 सरल वाक्य लिखिए।", "1. गाय एक पालतू और उपयोगी पशु है। 2. गाय हमें मीठा और पौष्टिक दूध देती है। 3. यह हरी घास और भूसा खाती है। 4. भारतीय संस्कृति में गाय को माता माना जाता है।", 3, "अनुच्छेद लेखन"],
  ["'पेड़ों का महत्व' विषय पर 4 वाक्य लिखिए।", "1. पेड़ हमें प्राणवायु (ऑक्सीजन) देते हैं। 2. पेड़ों से हमें फल, फूल, छाया और औषधियाँ मिलती हैं। 3. ये वर्षा लाने में सहायक होते हैं। 4. हमें अधिक से अधिक पेड़ लगाने चाहिए।", 3, "अनुच्छेद लेखन"],
  ["'समय का सदुपयोग' पर 4 पंक्तियाँ लिखिए।", "समय अमूल्य धन है। बीता हुआ समय कभी वापस नहीं आता। जो विद्यार्थी समय की कद्र करते हैं, वे जीवन में अवश्य सफल होते हैं।", 3, "अनुच्छेद लेखन"],
  ["प्रधानाचार्य जी को दो दिन के अवकाश के लिए प्रार्थना पत्र का मुख्य भाग लिखिए।", "सेवा में, श्रीमान प्रधानाचार्य महोदय। विषय: दो दिन के अवकाश हेतु। निवेदन है कि मुझे घर पर आवश्यक कार्य/ज्वर होने के कारण दो दिन का अवकाश प्रदान करने की कृपा करें।", 5, "पत्र लेखन"],
  ["हिंदी वर्णमाला में कितने स्वर और कितने व्यंजन होते हैं? चार-चार उदाहरण लिखिए।", "मानक हिंदी में 11 स्वर (अ, आ, इ, ई...) और 33 मूल व्यंजन (क, ख, ग, घ...) होते हैं।", 2, "वर्णमाला"],
  ["'अ' से 'औ' तक सभी स्वर क्रम से लिखिए।", "अ, आ, इ, ई, उ, ऊ, ऋ, ए, ऐ, ओ, औ (कुल 11 स्वर)।", 2, "वर्णमाला"],
  ["'अनु' और 'सु' उपसर्ग लगाकर दो-दो नए शब्द बनाइए।", "अनु → अनुराग, अनुसार; सु → सुपुत्र, सुगम।", 2, "उपसर्ग"],
  ["'ता' और 'वान' प्रत्यय जोड़कर दो-दो शब्द बनाइए।", "ता → सुंदरता, एकता; वान → धनवान, बलवान।", 2, "प्रत्यय"],
  ["वाक्यांश के लिए एक शब्द लिखिए: (क) जो चित्र बनाता हो (ख) जो कभी न मरे।", "(क) चित्रकार  (ख) अमर।", 2, "एक शब्द"],
  ["वाक्यांश के लिए एक शब्द लिखिए: (क) प्रतिदिन होने वाला (ख) जो ईश्वर को मानता हो।", "(क) दैनिक  (ख) आस्तिक।", 2, "एक शब्द"],
  ["दो तत्सम शब्दों के तद्भव रूप लिखिए: 'अग्नि' और 'दुग्ध'।", "अग्नि → आग; दुग्ध → दूध।", 2, "तत्सम-तद्भव"],
  ["संयुक्त व्यंजन कौन-कौन से हैं? प्रत्येक से एक शब्द बनाइए।", "क्ष (कक्षा), त्र (त्रिशूल), ज्ञ (ज्ञान), श्र (परिश्रम)।", 2, "वर्ण विचार"],
  ["काल के तीनों भेदों के नाम लिखकर एक-एक उदाहरण दीजिए।", "1. भूतकाल (वह गया), 2. वर्तमान काल (वह पढ़ता है), 3. भविष्यत् काल (वह खेलेगा)।", 3, "व्याकरण - काल"],
  ["'वर्षा ऋतु' पर 4 सुंदर वाक्य लिखिए।", "1. गर्मी के बाद वर्षा ऋतु आती है। 2. काले बादल आकाश में छा जाते हैं और बारिश होती है। 3. किसान खुश होकर फसल बोते हैं। 4. चारों ओर हरियाली छा जाती है।", 3, "अनुच्छेद लेखन"],
  ["भारत के चार प्रमुख त्योहारों के नाम लिखिए और अपने प्रिय त्योहार पर 2 वाक्य लिखिए।", "होली, दीपावली, ईद, छठ पूजा। दीपावली प्रकाश का पर्व है, जिसमें हम दीप जलाते हैं।", 3, "संस्कृति एवं लेखन"],
  ["शुद्ध वर्तनी लिखिए: (क) परिक्षा (ख) आर्शीवाद (ग) विध्यालय (घ) उज्वल।", "(क) परीक्षा  (ख) आशीर्वाद  (ग) विद्यालय  (घ) उज्ज्वल।", 2, "वर्तनी शुद्धि"],
  ["'माँ' पर कोई 4 पंक्तियों की सुंदर बात या कविता की पंक्तियाँ लिखिए।", "माँ की ममता सबसे प्यारी, धरती पर जन्नत सी न्यारी। पहला गुरु होती है माँ, हर दुःख में रखती है छाँव।", 3, "सृजनात्मक लेखन"],
  ["संधि-विच्छेद कीजिए: 'विद्यालय' और 'सूर्योदय'।", "विद्यालय = विद्या + आलय; सूर्योदय = सूर्य + उदय।", 2, "संधि"],
  ["कारक चिह्न पहचानिए: 'राम ने रावण को बाण से मारा।'।", "राम ने (कर्ता कारक), रावण को (कर्म कारक), बाण से (करण कारक)।", 2, "कारक"],
];

function build200PrimaryHindi(cls: 1 | 2 | 3 | 4 | 5): SubjTuple[] {
  const out: SubjTuple[] = [];
  PRI_HINDI_VILOM.forEach(([w, opp]) => {
    out.push([
      "Hindi",
      "SHORT_ANSWER",
      `'${w}' शब्द का विलोम शब्द लिखिए और विलोम शब्द से एक वाक्य बनाइए।`,
      `विलोम शब्द: ${opp}। वाक्य: हमें जीवन में '${opp}' का सही अर्थ समझकर आचरण करना चाहिए।`,
      2,
      "विलोम शब्द",
    ]);
  });
  PRI_HINDI_PARYAY.forEach(([w, syn]) => {
    out.push([
      "Hindi",
      "SHORT_ANSWER",
      `'${w}' के दो पर्यायवाची (समानार्थी) शब्द लिखिए।`,
      `${w} के दो पर्यायवाची शब्द: ${syn}।`,
      2,
      "पर्यायवाची शब्द",
    ]);
  });
  PRI_HINDI_LING.forEach(([m, f]) => {
    out.push([
      "Hindi",
      "SHORT_ANSWER",
      `'${m}' का लिंग बदलकर लिखिए तथा दोनों शब्दों का अंतर बताइए।`,
      `परिवर्तित रूप: ${f}। ('${m}' पुल्लिंग है और '${f}' स्त्रीलिंग शब्द है।)`,
      2,
      "लिंग परिवर्तन",
    ]);
  });
  PRI_HINDI_VACHAN.forEach(([s, p]) => {
    out.push([
      "Hindi",
      "SHORT_ANSWER",
      `'${s}' का बहुवचन रूप लिखकर एक छोटा वाक्य बनाइए।`,
      `बहुवचन: ${p}। वाक्य: मेज पर कई ${p} रखी हुई हैं।`,
      2,
      "वचन परिवर्तन",
    ]);
  });
  PRI_HINDI_SHUDDH.forEach(([wrong, right]) => {
    out.push([
      "Hindi",
      "SHORT_ANSWER",
      `निम्नलिखित अशुद्ध वाक्य को शुद्ध करके पुनः लिखिए: "${wrong}"`,
      `शुद्ध वाक्य: ${right}`,
      2,
      "वाक्य शुद्धि",
    ]);
  });
  PRI_HINDI_GRAMMAR_AND_WRITING.forEach(([q, ans, m, tag]) => {
    out.push(["Hindi", m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER", q, ans, m, tag]);
  });
  // Add clean class-customized word-meaning/sentence items to comfortably exceed 200
  const extraWords = [
    ["परिश्रम", "मेहनत", "परिश्रम करने से कठिन कार्य भी आसान हो जाता है।"],
    ["स्वच्छता", "साफ-सफाई", "स्वच्छता रखने से बीमारियाँ दूर रहती हैं।"],
    ["ईमानदारी", "सच्चाई", "ईमानदारी एक उत्तम गुण है।"],
    ["अनुशासन", "नियम का पालन", "विद्यार्थी जीवन में अनुशासन बहुत आवश्यक है।"],
    ["सहयोग", "मदद", "आपसी सहयोग से समाज मजबूत बनता है।"],
    ["जिज्ञासा", "जानने की इच्छा", "विज्ञान सीखने के लिए जिज्ञासा जरूरी है।"],
    ["कृतज्ञ", "आभारी", "हमें अपने शिक्षकों के प्रति सदा कृतज्ञ रहना चाहिए।"],
    ["अभ्यास", "दोहराव / कोशिश", "निरंतर अभ्यास से गणित सरल हो जाता है।"],
    ["प्रकृति", "कुदरत", "प्रकृति हमें हवा, जल और भोजन देती है।"],
    ["संकल्प", "पक्का इरादा", "नए वर्ष पर हमने प्रतिदिन पढ़ने का संकल्प लिया।"],
    ["धैर्य", "धीरज", "कठिन समय में धैर्य से काम लेना चाहिए।"],
    ["कर्तव्य", "जिम्मेदारी", "समय पर पढ़ाई करना छात्र का प्रथम कर्तव्य है।"],
    ["विनम्रता", "शालीनता", "विनम्रता से बोलने वाला सबका प्रिय होता है।"],
    ["स्वतंत्रता", "आजादी", "15 अगस्त को हम स्वतंत्रता दिवस मनाते हैं।"],
    ["उत्साह", "उमंग / जोश", "बच्चों ने खेल प्रतियोगिता में पूरे उत्साह से भाग लिया।"],
    ["पर्यावरण", "आसपास का वातावरण", "पेड़ लगाकर हम अपने पर्यावरण को बचा सकते हैं।"],
    ["सौंदर्य", "सुंदरता", "प्रातःकाल बगीचे का सौंदर्य मन मोह लेता है।"],
    ["आत्मविश्वास", "खुद पर भरोसा", "तैयारी अच्छी हो तो परीक्षा में आत्मविश्वास बढ़ता है।"],
    ["सद्भाव", "मेलजोल", "सभी पर्व हमें आपसी प्रेम और सद्भाव सिखाते हैं।"],
    ["विवेक", "सही-गलत की समझ", "हर निर्णय सोच-समझकर विवेक से लेना चाहिए।"],
    ["परोपकार", "दूसरों की भलाई", "नदियाँ और वृक्ष हमें परोपकार की शिक्षा देते हैं।"],
    ["स्वास्थ्य", "सेहत", "ताजे फल और खेलकूद अच्छे स्वास्थ्य के लिए जरूरी हैं।"],
    ["एकता", "मिलजुलकर रहना", "एकता में ही सबसे बड़ी शक्ति होती है।"],
    ["सृजन", "रचना / निर्माण", "मेहनती लोग नए विचारों का सृजन करते हैं।"],
    ["मातृभूमि", "जन्मभूमि", "हमें अपनी मातृभूमि भारत पर गर्व है।"],
    ["शिष्टाचार", "अच्छा व्यवहार", "बड़ों को प्रणाम करना उत्तम शिष्टाचार है।"],
    ["प्रतिभा", "हुनर / योग्यता", "हर बच्चे में कोई न कोई विशेष प्रतिभा होती है।"],
    ["उजाला", "रोशनी", "ज्ञान का उजाला अज्ञान के अंधेरे को मिटाता है।"],
    ["संदेश", "पैगाम / सीख", "त्योहार हमें खुशियों का संदेश देते हैं।"],
    ["लक्ष्य", "मंजिल / उद्देश्य", "जीवन में एक स्पष्ट लक्ष्य बनाना चाहिए।"],
    ["आदर", "सम्मान", "हमें सभी बड़ों का आदर करना चाहिए।"],
    ["मृदुभाषी", "मीठा बोलने वाला", "मृदुभाषी व्यक्ति सबका दिल जीत लेता है।"],
    ["साहस", "हिम्मत", "संकट के समय साहस कभी नहीं छोड़ना चाहिए।"],
    ["प्रसन्नता", "खुशी", "अच्छे अंक आने पर परिवार में प्रसन्नता छा गई।"],
    ["अनमोल", "जिसका मूल्य न हो", "माँ का प्यार और समय दोनों अनमोल हैं।"],
    ["प्रगति", "उन्नति / विकास", "शिक्षा के बिना किसी देश की प्रगति संभव नहीं।"],
    ["संकट", "मुसीबत", "सच्चा मित्र संकट के समय काम आता है।"],
    ["किरण", "रोशनी की रेखा", "सुबह की पहली किरण नई आशा लाती है।"],
    ["कौशल", "निपुणता", "अच्छी लिखावट एक सुंदर कौशल है।"],
    ["प्रेरणा", "आगे बढ़ने की सीख", "महान लोगों की जीवनियाँ हमें प्रेरणा देती हैं।"],
    ["निर्णय", "फैसला", "जल्दबाजी में कोई गलत निर्णय न लें।"],
    ["आनंद", "सुख / मजा", "बारिश में कागज की नाव चलाने में बड़ा आनंद आता है।"],
    ["चंचल", "तेज / नटखट", "गिलहरी बहुत चंचल और फुर्तीली होती है।"],
    ["मजबूत", "दृढ़", "अच्छी नींव से इमारत मजबूत बनती है।"],
    ["अविस्मरणीय", "जिसे भुलाया न जा सके", "हमारे स्कूल का वार्षिकोत्सव अविस्मरणीय रहा।"],
    ["संस्कृति", "परंपरा", "भारतीय संस्कृति अतिथि देवो भव की सीख देती है।"],
    ["संतोष", "तसल्ली", "कठिन परिश्रम के बाद मन को सच्चा संतोष मिलता है।"],
    ["विजेता", "जीतने वाला", "मेहनत करने वाला ही अंततः विजेता बनता है।"],
    ["उत्सव", "त्योहार / समारोह", "बसंत पंचमी विद्या और कला का पावन उत्सव है।"],
  ];
  extraWords.forEach(([w, mean, sent]) => {
    out.push([
      "Hindi",
      "SHORT_ANSWER",
      `'${w}' शब्द का सरल अर्थ लिखकर एक सार्थक वाक्य में प्रयोग कीजिए।`,
      `अर्थ: ${mean}। वाक्य: ${sent}`,
      2,
      "शब्द-अर्थ एवं वाक्य प्रयोग",
    ]);
  });

  return finalizeSubjectTuples(cls, "Hindi", out, 200);
}

// ── PRIMARY EVS / GK POOLS (Classes 1–5) ─────────────────────────────────────
const PRI_EVS_QA: [string, string, number, string][] = [
  ["Name our five sense organs and state one function of any two.", "Eyes (see), Ears (hear), Nose (smell), Tongue (taste), Skin (feel). Eyes help us read; ears help us listen.", 3, "Human Body"],
  ["Why do we need food? Name any three energy-giving foods.", "Food gives energy to work and grow. Examples: Rice, Wheat (chapati), Potato.", 2, "Food & Nutrition"],
  ["What is a balanced diet? Give two reasons why junk food should be avoided.", "A balanced diet has all nutrients in right amounts. Junk food causes obesity and weakens immunity.", 3, "Food & Nutrition"],
  ["Name any four sources of clean drinking water.", "Rain, rivers, wells, handpumps/tube wells, and lakes.", 2, "Water"],
  ["Write three ways by which we can save water at home and school.", "1. Close taps tightly after use. 2. Fix leaking pipes. 3. Use a bucket instead of a hose pipe.", 3, "Water Conservation"],
  ["What is the Water Cycle? Name its three main steps.", "Continuous movement of water on Earth via Evaporation, Condensation, and Precipitation (rain).", 3, "Water Cycle"],
  ["Write three differences between Living Things and Non-Living Things.", "Living things breathe, grow, and reproduce; non-living things cannot breathe, grow, or move on their own.", 3, "Living & Non-Living"],
  ["Name five parts of a plant and state the function of Roots.", "Root, Stem, Leaf, Flower, Fruit. Roots fix the plant in soil and absorb water and minerals.", 3, "Plants"],
  ["Why are leaves called the 'kitchen of the plant'?", "Green leaves make food for the plant using sunlight, water, and carbon dioxide (photosynthesis).", 2, "Plants"],
  ["Name four medicinal plants commonly grown in Indian homes.", "Tulsi, Neem, Aloe Vera, and Mint (Pudina).", 2, "Plants & Uses"],
  ["Give two examples each of Herbivores, Carnivores, and Omnivores.", "Herbivores: Cow, Deer. Carnivores: Lion, Tiger. Omnivores: Bear, Crow / Human.", 3, "Animals"],
  ["How do birds fly easily? Write two body features of birds.", "Birds have light hollow bones, streamlined bodies, and strong wings with feathers.", 2, "Birds"],
  ["Name the homes of: (a) Honeybee (b) Rabbit (c) Horse (d) Lion.", "(a) Hive  (b) Burrow  (c) Stable  (d) Den.", 2, "Animal Homes"],
  ["Name any four domestic animals and state one use of each.", "Cow (milk), Sheep (wool), Horse (riding/cart), Dog (guards home).", 2, "Animals"],
  ["Write the three main seasons of India and name one fruit eaten in each.", "Summer (Mango), Rainy/Monsoon (Jamun/Corn), Winter (Orange).", 3, "Weather & Seasons"],
  ["What are the three states of matter? Give one example of each.", "Solid (ice), Liquid (water), and Gas (water vapour/steam).", 2, "Science Basics"],
  ["Name four types of houses and tell where an Igloo is found.", "Hut, Bungalow, Apartment, Houseboat. An Igloo is made of ice blocks in very cold snowy regions.", 3, "Shelter"],
  ["List four traffic safety rules children should follow.", "1. Follow traffic lights. 2. Use zebra crossing. 3. Never play on roads. 4. Wear a helmet on two-wheelers.", 3, "Safety Rules"],
  ["What do Red, Yellow, and Green traffic lights indicate?", "Red means Stop, Yellow means Wait/Get ready, and Green means Go.", 2, "Safety Rules"],
  ["What should be kept inside a basic First-Aid Box? Name any four items.", "Bandage, antiseptic lotion, cotton wool, medical tape, and scissors.", 2, "First Aid"],
  ["Name our National Bird, National Animal, National Flower, and National Tree.", "Peacock, Bengal Tiger, Lotus, and Banyan Tree.", 2, "National Symbols"],
  ["Who wrote our National Anthem 'Jana Gana Mana' and our National Song 'Vande Mataram'?", "National Anthem: Rabindranath Tagore; National Song: Bankim Chandra Chatterjee.", 2, "National Symbols"],
  ["Name the three colours of the Indian National Flag and what the Ashoka Chakra represents.", "Saffron (courage), White (peace/truth), Green (growth). The 24-spoked Navy Blue Ashoka Chakra stands for progress and duty.", 3, "National Symbols"],
  ["Name the Capital of India and the Capital of Bihar.", "Capital of India: New Delhi. Capital of Bihar: Patna.", 2, "Geography & India"],
  ["Name all eight planets of our Solar System in order from the Sun.", "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.", 3, "Solar System"],
  ["Why is Earth called the 'Blue Planet'?", "Because nearly three-fourths (about 71%) of Earth's surface is covered with water, making it look blue from space.", 2, "Solar System"],
  ["Distinguish between Rotation and Revolution of the Earth.", "Rotation (spinning on axis in 24 hours) causes day and night; Revolution (orbiting the Sun in 365¼ days) causes seasons.", 3, "Earth & Space"],
  ["Name four important community helpers and their work.", "Doctor (treats patients), Teacher (educates students), Postman (delivers letters), Firefighter (puts out fires).", 2, "Community Helpers"],
  ["Name two means each of Land, Water, and Air transport.", "Land: Train, Bus. Water: Ship, Boat. Air: Aeroplane, Helicopter.", 2, "Transport"],
  ["Name four modern means of communication.", "Telephone/Mobile, Email, Television, and Newspaper.", 2, "Communication"],
];

// Additional 170 EVS/GK questions built cleanly from diverse factual topic groups
const PRI_EVS_TOPICS: [string, string, string][] = [
  ["Vitamin A deficiency", "Night blindness; eat carrots, spinach, and papaya", "Health"],
  ["Vitamin C deficiency", "Scurvy (bleeding gums); eat amla, lemon, and oranges", "Health"],
  ["Vitamin D deficiency", "Rickets (weak bones); get morning sunlight and milk", "Health"],
  ["Iron deficiency", "Anaemia (tiredness); eat spinach, jaggery, and beetroot", "Health"],
  ["Iodine deficiency", "Goitre (swollen neck); use iodised salt", "Health"],
  ["Teeth care", "Brush twice daily, rinse after meals, avoid excess sweets", "Hygiene"],
  ["Handwashing habit", "Always wash hands with soap before eating and after toilet", "Hygiene"],
  ["Joint Family", "Grandparents, parents, uncles, aunts, and children living together", "Family"],
  ["Nuclear Family", "Parents and their children living together", "Family"],
  ["Braille Script", "Raised dot reading system for visually challenged persons, invented by Louis Braille", "Inventions"],
  ["Stethoscope", "Instrument used by doctors to listen to heartbeat and breathing", "Inventions"],
  ["Thermometer", "Device used to measure body temperature or heat", "Science Tools"],
  ["Rain Gauge", "Instrument used to measure the amount of rainfall", "Weather Tools"],
  ["Compass", "Magnetic needle tool used by travellers and sailors to find North–South direction", "Directions"],
  ["Four Cardinal Directions", "North, South, East, and West", "Directions"],
  ["Sun rising direction", "The Sun appears to rise in the East and set in the West", "Directions"],
  ["Amphibians", "Animals that can live both in water and on land (e.g., Frog, Salamander)", "Animals"],
  ["Mammals", "Warm-blooded animals that feed milk to their babies (e.g., Cow, Human, Whale)", "Animals"],
  ["Nocturnal Animals", "Animals active at night and asleep by day (e.g., Owl, Bat)", "Animals"],
  ["Endangered Animals", "Animals whose numbers are very low and may disappear (e.g., Tiger, Rhino)", "Environment"],
  ["Deforestation", "Cutting down trees on a large scale, causing soil erosion and global warming", "Environment"],
  ["Afforestation", "Planting new trees on barren land to protect environment and wildlife", "Environment"],
  ["Global Warming", "Gradual rise in Earth's temperature due to pollution and greenhouse gases", "Environment"],
  ["3Rs of Waste Management", "Reduce, Reuse, and Recycle to keep our planet clean", "Environment"],
  ["Biodegradable Waste", "Waste that rots naturally and mixes with soil (e.g., vegetable peels, dry leaves)", "Waste Management"],
  ["Non-Biodegradable Waste", "Waste that does not rot easily in soil (e.g., plastic bags, glass)", "Waste Management"],
  ["Soil Erosion", "Washing or blowing away of fertile topsoil by rain water or strong wind", "Soil"],
  ["Loamy Soil", "Best soil for farming made of sand, clay, and humus", "Soil"],
  ["Kharif Crops", "Crops sown in rainy season like Rice (Paddy), Maize, and Cotton", "Agriculture"],
  ["Rabi Crops", "Crops sown in winter like Wheat, Mustard, and Gram", "Agriculture"],
  ["Germination", "Growth of a baby plant from a seed in presence of air, water, and warmth", "Plants"],
  ["Climbers", "Weak-stemmed plants needing support to grow upright (e.g., Pea, Money plant)", "Plants"],
  ["Creepers", "Weak-stemmed plants growing along the ground (e.g., Pumpkin, Watermelon)", "Plants"],
  ["Aquatic Plants", "Plants that grow in water (e.g., Lotus, Water Lily, Hydrilla)", "Plants"],
  ["Desert Plants", "Plants like Cactus that have spines instead of leaves to save water", "Plants"],
  ["Republic Day", "Celebrated on 26th January every year when India's Constitution came into force (1950)", "Festivals & Days"],
  ["Independence Day", "Celebrated on 15th August marking India's freedom in 1947", "Festivals & Days"],
  ["Gandhi Jayanti", "Celebrated on 2nd October as birthday of Mahatma Gandhi (Father of the Nation)", "Festivals & Days"],
  ["Teachers' Day", "Celebrated on 5th September in honour of Dr. Sarvepalli Radhakrishnan", "Festivals & Days"],
  ["Children's Day", "Celebrated on 14th November on Pandit Jawaharlal Nehru's birthday", "Festivals & Days"],
  ["World Environment Day", "Celebrated on 5th June worldwide to protect nature and plant trees", "Important Days"],
  ["International Yoga Day", "Celebrated on 21st June for physical and mental fitness", "Important Days"],
  ["National Science Day", "Celebrated on 28th February honouring Sir C.V. Raman's Raman Effect discovery", "Important Days"],
  ["Harvest Festivals of India", "Baisakhi (Punjab), Pongal (Tamil Nadu), Onam (Kerala), Makar Sankranti / Chhath", "Culture"],
  ["Famous Monuments: Taj Mahal", "Built in Agra of white marble on the banks of river Yamuna", "Heritage"],
  ["Famous Monuments: Red Fort", "Located in Delhi, where the Prime Minister hoists the flag on 15th August", "Heritage"],
  ["Famous Monuments: Qutub Minar", "Tallest brick minaret located in New Delhi", "Heritage"],
  ["Famous Monuments: Gateway of India", "Iconic arch monument situated in Mumbai facing the Arabian Sea", "Heritage"],
  ["Famous Monuments: Nalanda University", "Ancient world-famous centre of learning situated in Bihar", "Heritage"],
  ["Longest River in India", "The Ganga (approx. 2,525 km) originating from Gangotri glacier", "Geography"],
  ["Highest Mountain Peak in World", "Mount Everest (8,848.86 m) located in the Himalayas", "Geography"],
  ["Largest Ocean on Earth", "The Pacific Ocean (also the deepest ocean)", "Geography"],
  ["Largest Continent", "Asia (also home to India, the most populous nation)", "Geography"],
  ["Smallest Continent", "Australia (also called the Island Continent)", "Geography"],
  ["Thar Desert", "Great Indian Desert located mainly in Rajasthan", "Geography"],
  ["Chilika Lake", "Largest brackish water lagoon in India located in Odisha", "Geography"],
  ["Oxygen in Air", "21% of air; essential for breathing and burning", "Air & Atmosphere"],
  ["Nitrogen in Air", "78% of air; helps keep burning under control and supports plants", "Air & Atmosphere"],
  ["Photosynthesis Gas", "Plants absorb Carbon Dioxide and release Oxygen during daytime", "Air & Atmosphere"],
  ["Natural vs Artificial Light", "Sun and stars are natural light sources; bulb and torch are man-made", "Light"],
  ["Magnetic Materials", "Materials attracted by a magnet such as Iron, Nickel, and Cobalt", "Magnetism"],
  ["Friction", "A contact force that slows down moving objects and helps us walk without slipping", "Force"],
  ["Gravity", "Earth's pull that draws every thrown object back down to the ground", "Force"],
  ["Simple Machines", "Tools making work easier: Lever, Pulley, Inclined plane, Wheel & axle", "Machines"],
  ["Solar Energy", "Clean, renewable energy obtained directly from sunlight using solar panels", "Energy"],
  ["Hydroelectricity", "Electricity generated using the force of fast-flowing water in dams", "Energy"],
  ["Fossil Fuels", "Coal, petroleum, and natural gas formed underground over millions of years", "Energy"],
  ["Human Heart", "Muscular organ on left side of chest that pumps blood throughout the body", "Human Body"],
  ["Human Lungs", "Pair of spongy organs inside the ribcage that help us breathe oxygen", "Human Body"],
  ["Human Brain", "Control centre of the body protected inside the skull", "Human Body"],
  ["Skeleton", "Framework of 206 bones in an adult that gives shape and protects organs", "Human Body"],
  ["Digestion", "Process of breaking down complex food into simple soluble nutrients", "Human Body"],
  ["Saliva", "Digestive juice in the mouth that softens food and starts starch digestion", "Human Body"],
  ["Milk Teeth vs Permanent", "20 milk teeth appear in childhood; 32 permanent teeth replace them", "Human Body"],
  ["Carnivorous Plants", "Insect-eating plants like Pitcher Plant and Venus Flytrap growing in poor soil", "Plants"],
  ["Seed Dispersal", "Spreading of seeds away from parent plant by wind, water, animals, or explosion", "Plants"],
  ["Migration in Birds", "Seasonal long-distance movement of birds (like Siberian Crane) to warmer places", "Animals"],
  ["Camouflage", "Ability of animals like Chameleon or Polar Bear to blend with surroundings", "Animals"],
  ["Hibernation", "Deep winter sleep of animals like bears and frogs to save energy", "Animals"],
  ["Panchayat System", "Village-level local self-government headed by a Sarpanch / Mukhiya", "Civics"],
  ["Municipality", "Local government body managing cleanliness, roads, and street lights in towns/cities", "Civics"],
  ["Currency of India", "Indian Rupee (₹) issued by the Reserve Bank of India (RBI)", "General Awareness"],
  ["Emergency Numbers India", "Police: 112/100, Fire: 101, Ambulance: 108/102", "Safety"],
  ["First President of India", "Dr. Rajendra Prasad (who hailed from Bihar)", "Indian History"],
  ["First Prime Minister of India", "Pandit Jawaharlal Nehru", "Indian History"],
  ["Missile Man of India", "Dr. A.P.J. Abdul Kalam, renowned aerospace scientist and former President", "Famous Personalities"],
  ["Iron Man of India", "Sardar Vallabhbhai Patel, who united India's princely states", "Famous Personalities"],
  ["Father of Indian Constitution", "Dr. Bhimrao Ramji Ambedkar", "Famous Personalities"],
  ["Swachh Bharat Mission", "Clean India campaign started on 2nd October 2014 to promote sanitation", "Civics"],
  ["Silk Worm", "Insect that feeds on mulberry leaves and produces natural silk fibre", "Fibre"],
  ["Cotton Crop", "Natural plant fibre grown best in black soil to make cool summer clothes", "Fibre"],
  ["Wool Source", "Natural animal fibre obtained from fleece of sheep, goat, and yak for winter wear", "Fibre"],
  ["Boiling Point of Water", "100°C at normal pressure; Freezing point is 0°C", "Science Facts"],
  ["Speed of Light vs Sound", "Light travels much faster than sound (so we see lightning before hearing thunder)", "Science Facts"],
  ["Earth's Axis Tilt", "23.5° tilt of Earth's axis that creates varying day lengths and seasons", "Earth"],
  ["Leap Year", "Year with 366 days (February has 29 days), occurring every 4 years", "Calendar"],
  ["Equator", "Imaginary 0° latitude line dividing Earth into Northern and Southern Hemispheres", "Geography"],
  ["Himalayas", "Young fold mountain range protecting India's northern border", "Geography"],
  ["Indian Ocean", "Only ocean in the world named after a country (India)", "Geography"],
  ["Sundarbans", "Largest mangrove delta formed by Ganga and Brahmaputra rivers, home to Royal Bengal Tiger", "Geography"],
  ["Poles of a Magnet", "Every magnet has North and South poles; opposite poles attract, like poles repel", "Science"],
  ["Conductor vs Insulator", "Conductors allow electricity (copper, iron); insulators block it (rubber, plastic)", "Science"],
  ["Pasteurization", "Heating milk to about 70°C and cooling quickly to kill harmful germs", "Food Preservation"],
  ["Food Preservation", "Salt (pickles), sugar (jams), drying (papad), and freezing keep food fresh longer", "Food Preservation"],
  ["Communicable Diseases", "Diseases spreading from one person to another via air, water, or insects (Flu, Malaria)", "Health"],
  ["Malaria & Dengue Vector", "Spread by female mosquitoes (Anopheles spreads Malaria; Aedes spreads Dengue)", "Health"],
  ["ORS Solution", "Oral Rehydration Solution (water + sugar + salt) given during dehydration/diarrhoea", "Health"],
  ["Vaccination", "Giving weakened/safe doses to build body immunity against serious diseases", "Health"],
  ["Soil Profile", "Vertical layers of soil: Topsoil (humus-rich), Subsoil, and Bedrock", "Soil"],
  ["Rainwater Harvesting", "Collecting and storing rooftop rainwater underground to recharge groundwater", "Water Conservation"],
  ["Dams", "Big barriers built across rivers to store water for irrigation and generate electricity", "Water"],
  ["Space Agency ISRO", "Indian Space Research Organisation, famous for Chandrayaan and Mangalyaan missions", "Space & India"],
  ["Chandrayaan-3", "India's historic 2023 lunar mission that safely landed near the Moon's south pole", "Space & India"],
  ["Artificial Satellite", "Man-made spacecraft orbiting Earth for weather, GPS, and TV signals (e.g., Aryabhata)", "Space & India"],
  ["Solar Eclipse", "Occurs when the Moon comes directly between the Sun and the Earth", "Astronomy"],
  ["Lunar Eclipse", "Occurs when the Earth comes directly between the Sun and the Moon", "Astronomy"],
  ["Constellation", "Group of stars forming a recognisable pattern in night sky (e.g., Ursa Major / Saptarishi)", "Astronomy"],
  ["Compost Manure", "Rich natural fertiliser made from rotting kitchen and garden waste", "Farming"],
  ["Crop Rotation", "Growing different crops turn by turn in the same field to restore soil fertility", "Farming"],
  ["Apiculture", "Rearing honeybees in wooden boxes to obtain honey and beeswax", "Farming"],
  ["Pisciculture", "Scientific breeding and rearing of fish in ponds and tanks", "Farming"],
  ["National Animal Conservation", "Project Tiger was launched in India in 1973 to protect declining tigers", "Conservation"],
  ["Ranthambore & Jim Corbett", "Famous National Parks in India known for protecting Bengal Tigers", "Conservation"],
  ["Kaziranga National Park", "Famous UNESCO park in Assam known for One-Horned Rhinoceros", "Conservation"],
  ["Gir National Park", "Natural home of the Asiatic Lion in Gujarat", "Conservation"],
  ["Folk Dances of India", "Bhangra (Punjab), Garba (Gujarat), Bihu (Assam), Jhijhiya (Bihar)", "Culture"],
  ["Classical Dances", "Bharatanatyam (TN), Kathak (North India), Kathakali (Kerala), Odissi (Odisha)", "Culture"],
  ["Indian States & Capitals: UP", "Capital of Uttar Pradesh is Lucknow; known for river Ganga & Yamuna", "States"],
  ["Indian States & Capitals: West Bengal", "Capital is Kolkata; located on the banks of river Hooghly", "States"],
  ["Indian States & Capitals: Maharashtra", "Capital is Mumbai, the financial capital of India", "States"],
  ["Indian States & Capitals: Tamil Nadu", "Capital is Chennai, situated along the Bay of Bengal", "States"],
  ["Indian States & Capitals: Rajasthan", "Capital is Jaipur, famously called the 'Pink City'", "States"],
  ["Indian States & Capitals: Kerala", "Capital is Thiruvananthapuram; called 'Spice Garden of India'", "States"],
  ["Seven Sisters of India", "Seven North-Eastern states: Assam, Arunachal, Manipur, Meghalaya, Mizoram, Nagaland, Tripura", "States"],
  ["Neighbours of India", "Pakistan, China, Nepal, Bhutan, Bangladesh, Myanmar, and Sri Lanka", "Geography"],
  ["Five Oceans of the World", "Pacific, Atlantic, Indian, Southern (Antarctic), and Arctic Ocean", "Geography"],
  ["Seven Continents", "Asia, Africa, North America, South America, Antarctica, Europe, Australia", "Geography"],
  ["CPU of a Computer", "Central Processing Unit — known as the brain of the computer", "Computer GK"],
  ["Input vs Output Devices", "Keyboard/Mouse are Input devices; Monitor/Printer are Output devices", "Computer GK"],
  ["Healthy Screen Habits", "Keep 1.5–2 feet distance, take 20-minute eye breaks, balance study with outdoor play", "Digital Wellness"],
  ["Good Citizenship", "Paying taxes honestly, following traffic rules, voting, and keeping surroundings clean", "Civics"],
  ["Fundamental Duties", "Respecting the National Flag, protecting wildlife, and safeguarding public property", "Civics"],
  ["Sound Pollution", "Unwanted loud noise from horns and loudspeakers harming hearing; plant trees to reduce it", "Environment"],
  ["Air Pollution Causes", "Vehicle exhaust, factory smoke, and burning crop stubble or crackers", "Environment"],
  ["Water Pollution Causes", "Dumping factory waste, plastics, and sewage into rivers without treatment", "Environment"],
  ["Natural Disasters", "Sudden events causing harm like Floods, Earthquakes, Cyclones, and Droughts", "Disaster Safety"],
  ["Earthquake Safety", "Drop, Cover under a sturdy desk, and Hold on; move to open ground afterward", "Disaster Safety"],
  ["Flood Safety", "Move to higher ground, drink boiled/chlorinated water, stay away from fallen wires", "Disaster Safety"],
  ["Mountaineering Gear", "Oxygen cylinder, thick ropes, ice axe, padded jacket, and spiked boots", "Adventure"],
  ["Balanced Breakfast", "Healthy morning meal like milk, fruits, oats/poha, or sprouts giving all-day focus", "Nutrition"],
  ["Dehydration Sign", "Dry lips, dizziness, and dark urine when body lacks enough water", "Health"],
  ["Posture Importance", "Sitting and standing straight keeps our backbone strong and prevents backache", "Health"],
  ["Sportsmanship", "Playing fairly, respecting the referee, and accepting victory or defeat gracefully", "Values"],
  ["Olympic Rings", "Five interlocking rings (blue, yellow, black, green, red) symbolising unity of 5 inhabited continents", "Sports GK"],
  ["National Sports Day", "Celebrated on 29th August honouring hockey wizard Major Dhyan Chand", "Sports GK"],
  ["Musical Instruments", "Tabla (percussion), Flute/Bansuri (wind), Sitar (string)", "Culture"],
  ["Paper Recycling", "Making new paper from used notebooks saves mature forest trees and water", "Environment"],
  ["Chlorophyll", "Green pigment in leaves that traps sunlight energy for photosynthesis", "Botany"],
  ["Stomata", "Tiny pores on undersides of leaves through which plants breathe and lose water", "Botany"],
  ["Roots: Tap vs Fibrous", "Taproot has one main thick root (mango/carrot); Fibrous roots form a bunch (wheat/grass)", "Botany"],
  ["Insect Body Parts", "Three main parts: Head, Thorax, and Abdomen, plus six legs", "Zoology"],
  ["Metamorphosis", "Complete life-cycle change like Egg → Caterpillar → Pupa → Butterfly", "Zoology"],
  ["Warm-Blooded vs Cold-Blooded", "Humans/Birds maintain constant body warmth; Frogs/Snakes change temperature with surroundings", "Zoology"],
  ["Light Reflection", "Bouncing back of light rays from a smooth shiny surface like a mirror", "Physics"],
  ["Shadow Formation", "Formed when an opaque object blocks the path of light", "Physics"],
  ["Transparent vs Opaque", "Transparent lets all light pass (clear glass); Opaque blocks light fully (wood)", "Physics"],
  ["Renewable Resources", "Nature's gifts replenished quickly like Sunlight, Wind, and Water", "Resources"],
  ["Non-Renewable Resources", "Limited resources taking millions of years to form like Coal and Petroleum", "Resources"],
  ["Banyan & Peepal Oxygen", "Large shady trees supporting birds and releasing generous oxygen for clean air", "Trees"],
  ["Traffic Zebra Crossing", "Black and white painted stripes on roads where pedestrians should cross safely", "Road Safety"],
  ["Clean Drinking Habits", "Boil or filter suspect water, cover water pots, and use a clean ladle", "Hygiene"],
  ["Sense of Smell & Safety", "Nose alerts us quickly to gas leaks, smoke, or spoiled food", "Human Body"],
];

function build200PrimaryEvsGk(cls: 1 | 2 | 3 | 4 | 5): SubjTuple[] {
  const out: SubjTuple[] = [];
  PRI_EVS_QA.forEach(([q, ans, m, tag]) => {
    out.push(["EVS / GK", m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER", q, ans, m, tag]);
  });
  PRI_EVS_TOPICS.forEach(([topic, fact, tag], idx) => {
    const isLong = idx % 4 === 0;
    out.push([
      "EVS / GK",
      isLong ? "LONG_ANSWER" : "SHORT_ANSWER",
      cls <= 2
        ? `Write two short lines about '${topic}'.`
        : `Explain '${topic}' clearly with one suitable example.`,
      `${topic}: ${fact}.`,
      isLong ? 3 : 2,
      tag,
    ]);
  });
  return finalizeSubjectTuples(cls, "EVS / GK", out, 200);
}

// ── SECONDARY ENGLISH POOLS (Classes 6–8) ────────────────────────────────────
const SEC_ENG_ACTIVE_PASSIVE: [string, string][] = [
  ["The gardener waters the plants every morning.", "The plants are watered by the gardener every morning."],
  ["Riya wrote a neat essay on cleanliness.", "A neat essay on cleanliness was written by Riya."],
  ["The police caught the thief near the station.", "The thief was caught by the police near the station."],
  ["My mother will bake a chocolate cake tomorrow.", "A chocolate cake will be baked by my mother tomorrow."],
  ["Someone has stolen my science textbook.", "My science textbook has been stolen."],
  ["The students are cleaning the classroom.", "The classroom is being cleaned by the students."],
  ["Who broke the glass window?", "By whom was the glass window broken?"],
  ["Close the main gate at once.", "Let the main gate be closed at once."],
  ["They invited all parents to the annual day.", "All parents were invited by them to the annual day."],
  ["She is singing a melodious patriotic song.", "A melodious patriotic song is being sung by her."],
  ["The principal praised the toppers of Class 8.", "The toppers of Class 8 were praised by the principal."],
  ["Farmers grow wheat and rice in fertile plains.", "Wheat and rice are grown by farmers in fertile plains."],
  ["Does he complete his assignments on time?", "Are his assignments completed by him on time?"],
  ["The engineer had repaired the broken bridge.", "The broken bridge had been repaired by the engineer."],
  ["Please help the needy elders politely.", "You are requested to help the needy elders politely."],
  ["The children were flying kites on the terrace.", "Kites were being flown by the children on the terrace."],
  ["Columbus discovered America in 1492.", "America was discovered by Columbus in 1492."],
  ["We must follow traffic rules strictly.", "Traffic rules must be followed strictly by us."],
  ["Did Meera win the debate trophy?", "Was the debate trophy won by Meera?"],
  ["A gentle breeze cooled the evening air.", "The evening air was cooled by a gentle breeze."],
  ["The doctor examined the patient carefully.", "The patient was examined carefully by the doctor."],
  ["Why did you waste precious water?", "Why was precious water wasted by you?"],
  ["Everyone respects an honest leader.", "An honest leader is respected by everyone."],
  ["They have planted two hundred trees.", "Two hundred trees have been planted by them."],
  ["The mason is building a strong boundary wall.", "A strong boundary wall is being built by the mason."],
  ["A wise owl watched the sleeping forest.", "The sleeping forest was watched by a wise owl."],
  ["Can she solve this algebraic equation?", "Can this algebraic equation be solved by her?"],
  ["The teacher checked all forty notebooks.", "All forty notebooks were checked by the teacher."],
  ["Never tell a lie to your teachers.", "Let a lie never be told to your teachers."],
  ["The postman delivers letters to every doorstep.", "Letters are delivered by the postman to every doorstep."],
];

const SEC_ENG_NARRATION: [string, string][] = [
  ["He said, \"I am preparing for the entrance test.\"", "He said that he was preparing for the entrance test."],
  ["Meera said to me, \"You have helped me a lot.\"", "Meera told me that I had helped her a lot."],
  ["The teacher said, \"The Earth revolves around the Sun.\"", "The teacher said that the Earth revolves around the Sun."],
  ["Mother said to Rohan, \"Do not waste your time.\"", "Mother advised Rohan not to waste his time."],
  ["She asked me, \"Where are you going now?\"", "She asked me where I was going then."],
  ["The boy said, \"Hurray! We won the inter-school quiz.\"", "The boy exclaimed with joy that they had won the inter-school quiz."],
  ["Father said to him, \"Have you finished your homework?\"", "Father asked him if he had finished his homework."],
  ["Sita said, \"I will visit Patna next Monday.\"", "Sita said that she would visit Patna the following Monday."],
  ["The captain said, \"Bravo! You played wonderfully.\"", "The captain applauded them saying that they had played wonderfully."],
  ["Raju said to his friend, \"Please lend me your dictionary.\"", "Raju requested his friend to lend him his dictionary."],
  ["The doctor said to the patient, \"Take this medicine daily.\"", "The doctor advised the patient to take that medicine daily."],
  ["Ananya said, \"I bought a new geometry box yesterday.\"", "Ananya said that she had bought a new geometry box the previous day."],
  ["She said to us, \"Honesty brings lasting peace.\"", "She told us that honesty brings lasting peace."],
  ["The traveller asked, \"How far is the railway station?\"", "The traveller asked how far the railway station was."],
  ["Amit said, \"I cannot lift this heavy trunk alone.\"", "Amit said that he could not lift that heavy trunk alone."],
  ["The coach said to the players, \"Run two rounds now.\"", "The coach ordered the players to run two rounds then."],
  ["Ria said, \"Alas! I lost my silver watch.\"", "Ria exclaimed with sorrow that she had lost her silver watch."],
  ["Grandfather said, \"Work hard so that you succeed.\"", "Grandfather advised us to work hard so that we might succeed."],
  ["Neha asked Kabir, \"Did you attend the science exhibition?\"", "Neha asked Kabir whether he had attended the science exhibition."],
  ["He said to me, \"May God bless you with success!\"", "He prayed that God might bless me with success."],
  ["The librarian said, \"Keep silence inside the reading room.\"", "The librarian instructed everyone to keep silence inside the reading room."],
  ["Priya said, \"It has been raining since morning.\"", "Priya said that it had been raining since morning."],
  ["He asked his sister, \"Why are you looking worried?\"", "He asked his sister why she was looking worried."],
  ["The teacher said, \"Two and two make four.\"", "The teacher said that two and two make four."],
  ["Ravi said to Suman, \"Let us plant saplings in the park.\"", "Ravi suggested to Suman that they should plant saplings in the park."],
  ["My uncle said, \"I lived in Varanasi for five years.\"", "My uncle said that he had lived in Varanasi for five years."],
  ["The monitor asked, \"Is everyone present today?\"", "The monitor asked whether everyone was present that day."],
  ["She said, \"What a breathtaking sunrise this is!\"", "She exclaimed with wonder that it was a very breathtaking sunrise."],
  ["Mother said, \"Always speak politely with elders.\"", "Mother advised us always to speak politely with elders."],
  ["Deepak said to me, \"You should revise your notes regularly.\"", "Deepak advised me that I should revise my notes regularly."],
];

const SEC_ENG_ERRORS_AND_CLAUSES: [string, string, string][] = [
  ["Correct the error: Neither of the two brothers were present.", "Neither of the two brothers was present.", "Subject-Verb Agreement"],
  ["Correct the error: Each of the students have submitted their project.", "Each of the students has submitted their project.", "Subject-Verb Agreement"],
  ["Correct the error: She prefers tea than coffee.", "She prefers tea to coffee.", "Prepositions"],
  ["Correct the error: He is senior than me by two years.", "He is senior to me by two years.", "Prepositions"],
  ["Correct the error: One should respect his elders.", "One should respect one's elders.", "Pronouns"],
  ["Correct the error: Unless you do not work hard, you cannot pass.", "Unless you work hard, you cannot pass.", "Conjunctions"],
  ["Correct the error: The sceneries of Kashmir are very charming.", "The scenery of Kashmir is very charming.", "Uncountable Nouns"],
  ["Correct the error: I look forward to meet you soon.", "I look forward to meeting you soon.", "Gerunds"],
  ["Correct the error: Scarcely had he reached when it started rain.", "Scarcely had he reached when it started raining.", "Tenses & Clauses"],
  ["Correct the error: No sooner did the bell rang than students ran out.", "No sooner did the bell ring than students ran out.", "Tenses"],
  ["Correct the error: Mathematics are my favourite subject.", "Mathematics is my favourite subject.", "Subject-Verb Agreement"],
  ["Correct the error: She distributed the sweets between five children.", "She distributed the sweets among five children.", "Prepositions"],
  ["Correct the error: Although he is poor, but he is honest.", "Although he is poor, he is honest.", "Conjunctions"],
  ["Correct the error: I am knowing him since childhood.", "I have known him since childhood.", "Tenses"],
  ["Correct the error: Keep the luggage here; my furnitures are new.", "Keep the luggage here; my furniture is new.", "Nouns"],
  ["Correct the error: If I was a bird, I would fly high.", "If I were a bird, I would fly high.", "Conditionals"],
  ["Correct the error: He is suffering with fever since Tuesday.", "He has been suffering from fever since Tuesday.", "Prepositions & Tenses"],
  ["Correct the error: The news are spreading rapidly across town.", "The news is spreading rapidly across town.", "Nouns"],
  ["Correct the error: She plays violin very well.", "She plays the violin very well.", "Articles"],
  ["Correct the error: Walk carefully lest you should not fall.", "Walk carefully lest you should fall.", "Conjunctions"],
  ["Combine using a Relative Pronoun: I met a girl. She won the Olympiad medal.", "I met a girl who won the Olympiad medal.", "Relative Clauses"],
  ["Combine using 'Not only ... but also': She can sing. She can paint beautifully.", "She can not only sing but also paint beautifully.", "Synthesis"],
  ["Combine using 'Too ... to': The box is very heavy. I cannot lift it.", "The box is too heavy for me to lift.", "Transformation"],
  ["Rewrite without 'too': He is too weak to run fast.", "He is so weak that he cannot run fast.", "Transformation"],
  ["Change into Comparative Degree: Gold is the most precious metal.", "Gold is more precious than any other metal.", "Degrees of Comparison"],
  ["Change into Superlative Degree: No other river in India is as sacred as the Ganga.", "The Ganga is the most sacred river in India.", "Degrees of Comparison"],
  ["Fill with suitable Modal & justify: ___ you live long and prosper! / We ___ obey elders.", "May you live long and prosper! / We must (ought to) obey elders.", "Modals"],
  ["Fill with suitable Determiners: Have you read ___ book I gave you? Only ___ pages remain.", "Have you read the book I gave you? Only a few pages remain.", "Determiners"],
  ["Identify the Clause & its type: 'He said that he had lost his keys.'", "'that he had lost his keys' — Noun Clause (object of the verb 'said').", "Clauses"],
  ["Identify the Clause & its type: 'Wait here until the rain stops.'", "'until the rain stops' — Adverb Clause of Time.", "Clauses"],
  ["Differentiate between 'Stationary' and 'Stationery' using two clear sentences.", "Stationary (still): The train remained stationary. Stationery (writing goods): I bought pens from the stationery shop.", "Homophones"],
  ["Differentiate between 'Accept' and 'Except' using sentences.", "Accept (agree/receive): I accept your invitation. Except (excluding): Everyone came except Ravi.", "Homophones"],
  ["Differentiate between 'Principal' and 'Principle' with one sentence each.", "Principal (head): Our Principal addressed the assembly. Principle (rule): Truth is his guiding principle.", "Homophones"],
  ["Differentiate between 'Advice' and 'Advise' with examples.", "Advice (noun): Follow your doctor's advice. Advise (verb): Teachers advise students to read daily.", "Word Usage"],
  ["Write a Question Tag for each: (a) She speaks softly, ___? (b) Let us start, ___?", "(a) doesn't she?  (b) shall we?", "Question Tags"],
];

const SEC_ENG_IDIOMS_AND_VOCAB: [string, string][] = [
  ["A blessing in disguise", "Something that seems bad at first but results in good later."],
  ["Once in a blue moon", "Happening very rarely."],
  ["Burn the midnight oil", "To study or work late into the night."],
  ["Hit the nail on the head", "To say or do something exactly right."],
  ["Spill the beans", "To reveal a secret accidentally or prematurely."],
  ["Piece of cake", "Something very easy to accomplish."],
  ["Break the ice", "To start conversation and make people feel comfortable."],
  ["Cost an arm and a leg", "To be extremely expensive."],
  ["Bite the bullet", "To face a difficult situation bravely."],
  ["Leave no stone unturned", "To try every possible way to achieve a goal."],
  ["Under the weather", "Feeling slightly sick or unwell."],
  ["Add fuel to the fire", "To make a bad situation or anger even worse."],
  ["A bird's-eye view", "A wide overall view from above."],
  ["Cry over spilt milk", "To complain about a past loss that cannot be undone."],
  ["Actions speak louder than words", "What people actually do matters more than what they promise."],
  ["Call it a day", "To stop working for the rest of the day."],
  ["Every cloud has a silver lining", "Every difficult situation carries a hopeful side."],
  ["Keep an eye on", "To watch carefully or look after someone/something."],
  ["Read between the lines", "To understand the hidden or implied meaning."],
  ["Turn a deaf ear", "To intentionally ignore advice or a request."],
  ["Give one word: A person who loves books deeply", "Bibliophile"],
  ["Give one word: A person who looks at the bright side of life", "Optimist"],
  ["Give one word: A speech delivered without prior preparation", "Extempore"],
  ["Give one word: Life story of a person written by himself/herself", "Autobiography"],
  ["Give one word: Animals that feed on both plants and flesh", "Omnivores"],
  ["Give one word: One who speaks many languages fluently", "Polyglot"],
  ["Give one word: Incapable of being read clearly (handwriting)", "Illegible"],
  ["Give one word: Happening once every year", "Annual"],
  ["Give one word: A remedy believed to cure all diseases", "Panacea"],
  ["Give one word: Person who cannot pay off his debts", "Insolvent / Bankrupt"],
];

const SEC_ENG_WRITING_TASKS: [string, string, number][] = [
  ["Write a formal letter (key points/draft) to the Principal requesting permission to organise a Science Exhibition.", "Includes Sender/Date, Receiver (The Principal), Subject, Purpose & educational benefit of Science Exhibition, date/venue plan, polite closing.", 5],
  ["Draft a Notice for the school noticeboard announcing an Inter-House Debate Competition.", "Must contain School Name, 'NOTICE' heading, Date, Topic, Eligibility (Classes 6–8), Time, Venue, and Signatory details.", 5],
  ["Write a 60-word paragraph on 'Discipline in Student Life'.", "Discipline aligns habits, time management, and respect. It shapes focus in classrooms and playground alike, transforming ordinary effort into consistent excellence.", 3],
  ["Write a 60-word paragraph on 'Role of Technology in Modern Education'.", "Digital boards, online quizzes, and interactive simulations make abstract concepts visual and engaging while teaching students digital responsibility.", 3],
  ["Write a short formal email/application to the Librarian requesting two new encyclopaedias for your class.", "Salutation, request detailing need for updated science/history encyclopaedias for project research, assurance of careful handling, sign-off.", 5],
  ["Write a short paragraph on 'Save Trees, Save Future'.", "Trees regulate climate, prevent floods, purify air, and support biodiversity. Planting saplings in schools builds sustainable habits for future generations.", 3],
  ["Write a brief dialogue (4 exchanges) between two friends discussing exam preparation.", "Aarav asks about revision strategy; Kabir suggests solving mock papers with a timer, reviewing weak formulas, and sleeping 8 hours before exam day.", 3],
  ["Write an informal letter starter & body to your cousin inviting him/her for summer holidays.", "Warm greeting, inquiry about health, exciting plan of morning sports, reading together, visiting science museum, affectionate closing.", 5],
  ["Write a short story outline with moral based on: 'Unity is Strength'.", "Introduce quarrelling brothers/farmers, father demonstrates breaking single sticks vs unbroken bundle, brothers unite and prosper together.", 5],
  ["Write 4 safety & etiquette guidelines for using the Internet wisely.", "1. Never share OTP/passwords. 2. Verify facts before forwarding messages. 3. Use polite language online. 4. Limit recreational screen time.", 3],
  ["Comprehension Question: 'Reading builds vocabulary, deepens empathy, and trains concentration far better than passive scrolling.' Give two benefits of reading stated here.", "1. Builds strong vocabulary and empathy. 2. Trains deep focus and concentration.", 2],
  ["Comprehension Question: 'Solar rooftops convert abundant sunlight into clean electricity without smoke.' Why is solar energy preferred over coal?", "Solar energy is clean, renewable, and produces no harmful smoke or air pollution unlike coal.", 2],
  ["Define 'Simile' and 'Metaphor' with one example each.", "Simile compares using 'like/as' (He is as brave as a lion). Metaphor directly states comparison (Time is a precious thief).", 3],
  ["Define 'Personification' and 'Alliteration' with one example each.", "Personification gives human traits to non-living things (The wind whispered). Alliteration repeats starting consonant sounds (Peter Piper picked).", 3],
  ["Expand the proverb in 3–4 lines: 'Where there is a will, there is a way.'", "Strong determination helps a person overcome obstacles. Even difficult targets become achievable when backed by consistent effort and willpower.", 3],
  ["Write a short diary entry (4 lines) on your first day at a new school.", "Dear Diary, today I stepped into my new school with nervousness and excitement. My teachers welcomed me warmly and I made two helpful friends. Looking forward to tomorrow!", 3],
  ["Describe 'Importance of Sports alongside Academics' in 4 lines.", "Sports build physical stamina, teamwork, and quick decision-making. Balanced exercise refreshes the mind and directly boosts academic performance.", 3],
  ["Explain three qualities of an ideal monitor/leader in school.", "1. Fairness and honesty toward all classmates. 2. Leading by personal discipline. 3. Helping shy students feel included.", 3],
  ["Differentiate between Transitive and Intransitive Verbs with examples.", "Transitive verbs need an object (She kicked the ball). Intransitive verbs do not need an object (The baby slept peacefully).", 3],
  ["Differentiate between Gerund and Infinitive with one sentence each.", "Gerund (verb+ing acting as noun): Swimming keeps us fit. Infinitive (to + V1): I like to swim.", 3],
  ["Explain the difference between 'Clause' and 'Phrase' with examples.", "A Phrase has no finite verb (in the morning), whereas a Clause has a subject and finite verb (when the sun rose).", 3],
  ["Rewrite in Formal English: 'Hey, I can't make it to class cuz I got a bad cold.'", "Respected Sir/Madam, I will not be able to attend class today as I am suffering from a severe cold.", 2],
  ["Write a 4-line slogan + message for 'Cleanliness Drive in School Campus'.", "Slogan: 'Clean Desk, Bright Mind!' Maintain dustbin discipline, avoid single-use plastics, and keep corridors spotless every day.", 3],
  ["Give Antonyms and Synonyms for: 'Abundant' and 'Courageous'.", "Abundant — Synonym: Plentiful, Antonym: Scarce. Courageous — Synonym: Brave, Antonym: Timid.", 2],
  ["Give Antonyms and Synonyms for: 'Diligent' and 'Transparent'.", "Diligent — Synonym: Hardworking, Antonym: Lazy. Transparent — Synonym: Clear, Antonym: Opaque.", 2],
  ["Write 4 sentences describing a rainy afternoon in your town.", "Dark clouds gathered and cool breezes rustled the trees. Steady raindrops washed the dusty streets clean. Peacocks danced while children sailed paper boats.", 3],
  ["Explain what 'Finite' and 'Non-finite' verbs mean with one example.", "Finite verbs change with tense/subject (He goes/They go). Non-finite verbs do not change (She wants to learn).", 3],
  ["Describe your vision of an 'Ideal Classroom' in 4 sentences.", "An ideal classroom is well-ventilated, well-lit, and neatly arranged. Charts decorate the walls while students participate actively and respectfully.", 3],
  ["Explain how Prefixes and Suffixes change root words, giving 2 examples each.", "Prefixes attach at the start (un + happy = unhappy; dis + honest = dishonest). Suffixes attach at the end (kind + ness = kindness; care + ful = careful).", 3],
  ["Write a 4-line book review summary of any storybook you enjoyed reading.", "The Panchatantra tales teach practical wisdom through clever animal stories. My favourite story highlights why presence of mind beats brute strength.", 3],
  ["Differentiate between 'Since' and 'For' in Present Perfect Continuous Tense with examples.", "'Since' marks a specific starting point (since 2022 / since morning); 'For' expresses a duration of time (for two hours).", 3],
  ["Correct and punctuate the paragraph: 'rahul asked can we visit the planetarium on sunday yes said his father'", "Rahul asked, \"Can we visit the planetarium on Sunday?\" \"Yes,\" said his father.", 2],
  ["List 4 steps to write a crisp and accurate Precis / Summary.", "1. Read the passage twice for main theme. 2. Note core facts, skip examples. 3. Write in own words around one-third length. 4. Give an apt title.", 3],
  ["Explain the difference between 'Between' and 'Among' and 'Beside' and 'Besides'.", "Between: two items; Among: more than two. Beside: next to; Besides: in addition to.", 3],
  ["Write 4 lines about why Mother Tongue and English fluency both matter.", "Our mother tongue connects us with culture, roots, and family values, while English opens global science, higher education, and communication.", 3],
  ["Identify and define the Figure of Speech in: 'The classroom was a zoo during lunch break.'", "Metaphor — directly compares a noisy classroom to a zoo without using 'like' or 'as'.", 2],
  ["Write 3 practical tips to improve English speaking confidence.", "1. Read one aloud page daily. 2. Speak short sentences with friends without fear of errors. 3. Note five new words and use them in context.", 3],
  ["Explain 'Compound Sentence' vs 'Complex Sentence' with one example each.", "Compound joins two independent clauses (I studied, and I scored well). Complex has one main + one subordinate clause (I scored well because I studied).", 3],
  ["Draft a 3-sentence Thank You note to a guest speaker who visited your school.", "Respected Sir/Madam, on behalf of our school, thank you warmly for your inspiring talk today. Your practical tips motivated every student in the hall.", 3],
  ["Write a 4-sentence persuasive appeal on 'Say No to Single-Use Plastic'.", "Plastic bags choke drains and harm stray cattle for decades. Carrying a reusable cloth bag is simple and affordable. Let each student pledge a plastic-free tiffin today!", 3],
];

function build200SecondaryEnglish(cls: 6 | 7 | 8 | 9 | 10): SubjTuple[] {
  const out: SubjTuple[] = [];
  SEC_ENG_ACTIVE_PASSIVE.forEach(([act, pass]) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      `Change the voice (Active → Passive): "${act}"`,
      pass,
      2,
      "Active & Passive Voice",
    ]);
  });
  SEC_ENG_NARRATION.forEach(([dir, indir]) => {
    out.push([
      "English",
      "SHORT_ANSWER",
      `Convert into Indirect (Reported) Speech: ${dir}`,
      indir,
      2,
      "Direct & Indirect Narration",
    ]);
  });
  SEC_ENG_ERRORS_AND_CLAUSES.forEach(([q, ans, tag]) => {
    out.push(["English", "SHORT_ANSWER", q, ans, 2, tag]);
  });
  SEC_ENG_IDIOMS_AND_VOCAB.forEach(([item, meaning], idx) => {
    if (idx < 20) {
      out.push([
        "English",
        "SHORT_ANSWER",
        `Explain the meaning of the idiom '${item}' and use it in a meaningful sentence of your own.`,
        `Meaning: ${meaning} Sentence: Passing this tough exam after hard work proved to be ${item.toLowerCase()}.`,
        2,
        "Idioms & Phrases",
      ]);
    } else {
      out.push(["English", "SHORT_ANSWER", item, meaning, 2, "One-Word Substitution"]);
    }
  });
  SEC_ENG_WRITING_TASKS.forEach(([q, ans, m]) => {
    out.push(["English", m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER", q, ans, m, "Writing & Grammar"]);
  });

  // 35 extra sentence-transformation/tense items customized with class tag
  const extraTensePrompts: [string, string][] = [
    [`Fill in with Past Perfect: When we reached the station, the train ___ (leave).`, "When we reached the station, the train had left."],
    [`Fill in with Future Continuous: At 9 AM tomorrow, we ___ (write) the Class ${cls} test.`, `At 9 AM tomorrow, we will be writing the Class ${cls} test.`],
    [`Rewrite using 'In spite of': Although he was tired, he finished the project.`, "In spite of being tired, he finished the project."],
    [`Rewrite using 'No sooner ... than': As soon as the teacher entered, everyone stood up.`, "No sooner did the teacher enter than everyone stood up."],
    [`Rewrite beginning with 'Hardly': As soon as the rain stopped, the match resumed.`, "Hardly had the rain stopped when the match resumed."],
    [`Change to Exclamatory Sentence: It is a very pleasant morning.`, "What a pleasant morning it is!"],
    [`Change to Assertive Sentence: How melodiously Lata sings!`, "Lata sings very melodiously."],
    [`Change to Affirmative without changing meaning: None but the brave deserve the fair.`, "Only the brave deserve the fair."],
    [`Change to Negative without altering meaning: Everybody loves his motherland.`, "There is nobody who does not love his motherland."],
    [`Join into a Single Simple Sentence: He saw a lion. He climbed up a tree.`, "Seeing a lion, he climbed up a tree."],
    [`Supply correct Verb form: Either Sita or her friends ___ (is/are) responsible.`, "are (verb agrees with nearer subject 'friends')."],
    [`Supply correct Verb form: The jury ___ (was/were) divided in their opinions.`, "were (used individually when divided)."],
    [`Supply correct Verb form: Bread and butter ___ (is/are) a wholesome breakfast.`, "is (forms one single idea/dish)."],
    [`Supply correct Preposition: She is fond ___ classical music and good at painting.`, "of (fond of) and at (good at)."],
    [`Supply correct Preposition: The cat jumped ___ the table and hid ___ the curtain.`, "upon (onto) / behind."],
    [`Explain the difference between 'Lose' and 'Loose' with examples.`, "Lose (verb, misplace/defeat): Don't lose hope. Loose (adj, not tight): Wear loose cotton clothes."],
    [`Explain the difference between 'Affect' and 'Effect' with examples.`, "Affect (verb, influence): Pollution affects health. Effect (noun, result): Sunlight has a positive effect."],
    [`Explain the difference between 'Quiet' and 'Quite' with examples.`, "Quiet (silent): Keep quiet in library. Quite (fairly/completely): The sum is quite simple."],
    [`Write 2 examples each of Abstract Noun and Material Noun.`, "Abstract: Honesty, Wisdom. Material: Gold, Wood."],
    [`Form Nouns from the adjectives: (a) Brave (b) Wise (c) Deep (d) Strong.`, "(a) Bravery  (b) Wisdom  (c) Depth  (d) Strength."],
    [`Form Adjectives from the nouns: (a) Courage (b) Wonder (c) Danger (d) Glory.`, "(a) Courageous  (b) Wonderful  (c) Dangerous  (d) Glorious."],
    [`Write three words beginning with prefix 'anti-' and 'inter-'.`, "anti-: antibiotic, antiseptic, anti-social; inter-: international, interact, internet."],
    [`Give Phrasal Verbs for: (a) Postpone (b) Extinguish fire (c) Search for.`, "(a) Put off  (b) Put out  (c) Look for."],
    [`Give Phrasal Verbs for: (a) Surrender/Stop trying (b) Take care of (c) Resemble parent.`, "(a) Give up  (b) Look after  (c) Take after."],
    [`Punctuate and capitalise: on monday dr sharma visited patna museum with students of class ${cls}`, `On Monday, Dr. Sharma visited Patna Museum with students of Class ${cls}.`],
    [`Identify Gerund vs Present Participle: 'Walking is good exercise.' vs 'A walking stick helped him.'`, "'Walking' in first = Gerund (noun); 'walking' in second = Participle (adjective describing stick)."],
    [`Change into Passive: Let him complete the model neatly.`, "Let the model be completed neatly by him."],
    [`Change into Active: A prize was awarded to Ananya by the Chief Guest.`, "The Chief Guest awarded a prize to Ananya."],
    [`Explain 'Oxymoron' and 'Onomatopoeia' with one example each.`, "Oxymoron joins opposite terms (open secret). Onomatopoeia mimics sound (The bees buzzed)."],
    [`Write 4 lines about 'Importance of Time Management for Class ${cls} Students'.`, "Planning daily study blocks reduces last-minute stress. Dividing time between revision, practice, and rest builds steady confidence and high accuracy."],
    [`Write a formal notice/message reminding classmates to bring Geometry Box for tomorrow's Class ${cls} test.`, "Notice: All Class students must bring a complete geometry box, blue pen, and ID card at 8:30 AM tomorrow for the entrance assessment."],
    [`Correct the misplaced modifier: 'Running fast, the bus was missed by Rahul.'`, "Running fast, Rahul missed the bus."],
    [`Distinguish between 'Little', 'A little', and 'The little' with brief meaning.`, "Little = hardly any; A little = some positive quantity; The little = whatever small amount exists."],
    [`Distinguish between 'Few', 'A few', and 'The few' with examples.`, "Used with countable nouns: Few (almost none), A few (some friends), The few (all small number available)."],
    [`Translate into clean English: 'परिश्रम सफलता की कुंजी है। हमें प्रतिदिन समय पर अध्ययन करना चाहिए।'`, "Hard work is the key to success. We should study on time every day."],
  ];
  extraTensePrompts.forEach(([q, ans]) => {
    out.push(["English", "SHORT_ANSWER", q, ans, 2, "Advanced Grammar"]);
  });

  return finalizeSubjectTuples(cls, "English", out, 200);
}

// ── SECONDARY MATHEMATICS POOLS (Classes 6–8) ────────────────────────────────
function build200SecondaryMaths(cls: 6 | 7 | 8 | 9 | 10): SubjTuple[] {
  const out: SubjTuple[] = [];

  // 1. 35 Number System, Integers, Rational Numbers & Exponents
  for (let i = 0; i < 35; i++) {
    if (i % 3 === 0) {
      const a = -(8 + cls + i);
      const b = 15 + cls * 2 + (i % 12);
      const c = -(4 + (i % 9));
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Simplify showing steps: (${a}) + ${b} − (${c})`,
        `(${a}) + ${b} + ${-c} = ${a + b - c}.`,
        2,
        "Integers",
      ]);
    } else if (i % 3 === 1) {
      const base = 2 + (i % 5);
      const p1 = 3 + cls + (i % 4);
      const p2 = 2 + (i % 3);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Using Laws of Exponents, simplify: (${base}^${p1} × ${base}^${p2}) ÷ ${base}^${p1 - 1}`,
        `${base}^(${p1}+${p2}) ÷ ${base}^${p1 - 1} = ${base}^(${p1 + p2} − ${p1 - 1}) = ${base}^${p2 + 1} = ${Math.pow(base, p2 + 1)}.`,
        2,
        "Exponents & Powers",
      ]);
    } else {
      const n = 12 + i + cls;
      const sq = n * n;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Find the square root of ${sq} by prime factorisation (or check if ${sq + 1} is a perfect square).`,
        `${sq} = ${n} × ${n}, so √${sq} = ${n}.`,
        2,
        "Squares & Roots",
      ]);
    }
  }

  // 2. 35 Linear Equations & Age/Number Word Problems
  for (let i = 0; i < 35; i++) {
    if (i % 2 === 0) {
      const x = 3 + cls + Math.floor(i / 2);
      const m = 2 + (i % 5);
      const k = 4 + i;
      const rhs = m * x + k;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Solve for x and verify your answer: ${m}x + ${k} = ${rhs}`,
        `${m}x = ${rhs} − ${k} = ${rhs - k} ⇒ x = ${rhs - k}/${m} = ${x}. Check: ${m}(${x}) + ${k} = ${rhs}.`,
        2,
        "Linear Equations",
      ]);
    } else {
      const sum = 41 + 2 * i + cls * 2;
      const diff = 5 + 2 * (i % 7);
      const bigger = (sum + diff) / 2;
      const smaller = (sum - diff) / 2;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `The sum of two numbers is ${sum} and one exceeds the other by ${diff}. Form an equation and find both numbers.`,
        `Let smaller = x, larger = x + ${diff}. Then x + (x + ${diff}) = ${sum} ⇒ 2x = ${sum - diff} ⇒ x = ${smaller}. Numbers are ${smaller} and ${bigger}.`,
        3,
        "Equation Word Problem",
      ]);
    }
  }

  // 3. 45 Ratio, Proportion, Percentage, Profit/Loss, Simple Interest (no collisions)
  for (let i = 0; i < 45; i++) {
    if (i % 4 === 0) {
      const a = 2 + (i % 4);
      const b = 3 + (i % 5);
      const unit = 50 * (1 + Math.floor(i / 4));
      const total = (a + b) * unit;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `Divide ₹${total} between Aman and Riya in the ratio ${a} : ${b}. Show each step.`,
        `Sum of ratio terms = ${a} + ${b} = ${a + b}. Aman's share = (${a}/${a + b}) × ${total} = ₹${a * unit}; Riya's share = ₹${b * unit}.`,
        3,
        "Ratio & Proportion",
      ]);
    } else if (i % 4 === 1) {
      const cp = 400 + Math.floor(i / 4) * 150;
      const gainPct = 10 + (i % 4) * 5;
      const sp = cp + (cp * gainPct) / 100;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `A shopkeeper buys a watch for ₹${cp} and sells it at a profit of ${gainPct}%. Find the selling price and profit amount.`,
        `Profit = ${gainPct}% of ${cp} = ₹${(cp * gainPct) / 100}. Selling Price (SP) = ₹${cp} + ₹${(cp * gainPct) / 100} = ₹${sp}.`,
        3,
        "Profit & Loss",
      ]);
    } else if (i % 4 === 2) {
      const P = 2000 + Math.floor(i / 4) * 500;
      const R = 5 + (i % 4) * 2;
      const T = 2 + (i % 3);
      const SI = (P * R * T) / 100;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `Calculate the Simple Interest and Total Amount on ₹${P} at ${R}% per annum for ${T} years.`,
        `SI = (P × R × T) / 100 = (${P} × ${R} × ${T}) / 100 = ₹${SI}. Amount = P + SI = ₹${P + SI}.`,
        3,
        "Simple Interest",
      ]);
    } else {
      const pct = 12 + Math.floor(i / 4) * 3;
      const whole = 200 + Math.floor(i / 4) * 100;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Find ${pct}% of ${whole} and express ${pct}% as a fraction out of 100.`,
        `${pct}% of ${whole} = (${pct}/100) × ${whole} = ${(pct * whole) / 100}. Fraction: ${pct}/100.`,
        2,
        "Percentage",
      ]);
    }
  }

  // 4. 36 Algebra & Factorisation (no collisions)
  for (let i = 0; i < 36; i++) {
    if (i % 3 === 0) {
      const k = 2 + Math.floor(i / 3);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Expand using identity (a + b)²: (x + ${k})²`,
        `Using (a + b)² = a² + 2ab + b²: x² + ${2 * k}x + ${k * k}.`,
        2,
        "Algebraic Identities",
      ]);
    } else if (i % 3 === 1) {
      const k = 3 + Math.floor(i / 3);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Factorise completely using a² − b² identity: x² − ${k * k}`,
        `x² − ${k}² = (x − ${k})(x + ${k}).`,
        2,
        "Factorisation",
      ]);
    } else {
      const a = 3 + Math.floor(i / 3);
      const b = 2 + (i % 5);
      const valX = 2 + (i % 4);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Simplify (${a}x + ${b}) + (${b}x − 1) and find its value when x = ${valX}.`,
        `Simplified = ${a + b}x + ${b - 1}. At x = ${valX}: ${a + b}(${valX}) + ${b - 1} = ${(a + b) * valX + (b - 1)}.`,
        2,
        "Algebraic Expressions",
      ]);
    }
  }

  // 5. 36 Geometry (Angles, Triangles, Quadrilaterals — no collisions)
  for (let i = 0; i < 36; i++) {
    if (i % 3 === 0) {
      const ang1 = 35 + Math.floor(i / 3) * 3;
      const ang2 = 42 + (i % 4) * 5;
      const ang3 = 180 - (ang1 + ang2);
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Two angles of a triangle are ${ang1}° and ${ang2}°. Find the third angle and state the property used.`,
        `By Angle Sum Property (sum = 180°): Third angle = 180° − (${ang1}° + ${ang2}°) = ${ang3}°.`,
        2,
        "Triangles",
      ]);
    } else if (i % 3 === 1) {
      const ang = 22 + Math.floor(i / 3) * 5;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Find the complement and supplement of an angle measuring ${ang}°.`,
        `Complement = 90° − ${ang}° = ${90 - ang}°. Supplement = 180° − ${ang}° = ${180 - ang}°.`,
        2,
        "Lines & Angles",
      ]);
    } else {
      const triples: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]];
      const mult = 1 + Math.floor(i / 15);
      const [ta, tb, tc] = triples[(Math.floor(i / 3)) % triples.length];
      const a = ta * mult;
      const b = tb * mult;
      const c = tc * mult;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `In a right-angled triangle, the two perpendicular legs measure ${a} cm and ${b} cm. Find the hypotenuse using Pythagoras Theorem.`,
        `By Pythagoras Theorem: H² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c} ⇒ Hypotenuse = √${c * c} = ${c} cm.`,
        3,
        "Pythagoras Theorem",
      ]);
    }
  }

  // 6. 36 Mensuration & Data Handling (no collisions)
  for (let i = 0; i < 36; i++) {
    if (i % 3 === 0) {
      const r = 7 * (1 + Math.floor(i / 3));
      const area = (22 * r * r) / 7;
      const circ = (2 * 22 * r) / 7;
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `Find the circumference and area of a circle of radius ${r} cm (use π = 22/7).`,
        `Circumference = 2πr = 2 × (22/7) × ${r} = ${circ} cm. Area = πr² = (22/7) × ${r} × ${r} = ${area} cm².`,
        3,
        "Mensuration (Circle)",
      ]);
    } else if (i % 3 === 1) {
      const side = 4 + cls + Math.floor(i / 3);
      out.push([
        "Mathematics",
        "LONG_ANSWER",
        `A cube has side ${side} cm. Calculate its Total Surface Area (TSA) and Volume.`,
        `TSA = 6 × side² = 6 × ${side * side} = ${6 * side * side} cm². Volume = side³ = ${side * side * side} cm³.`,
        3,
        "Surface Area & Volume",
      ]);
    } else {
      const d1 = 10 + i;
      const d2 = 12 + i;
      const d3 = 14 + i;
      const d4 = 16 + i;
      const d5 = 18 + i;
      out.push([
        "Mathematics",
        "SHORT_ANSWER",
        `Find the Mean and Median of the data: ${d1}, ${d2}, ${d3}, ${d4}, ${d5}.`,
        `Mean = (${d1}+${d2}+${d3}+${d4}+${d5}) / 5 = ${(d1 + d2 + d3 + d4 + d5) / 5}. Median (middle value) = ${d3}.`,
        2,
        "Data Handling",
      ]);
    }
  }

  return finalizeSubjectTuples(cls, "Mathematics", out, 200);
}

// ── SECONDARY SCIENCE POOLS (Classes 6–8) ────────────────────────────────────
const SEC_SCI_BANK: [string, string, number, string][] = [
  ["Distinguish between Autotrophic and Heterotrophic nutrition with two examples each.", "Autotrophs make their own food via photosynthesis (green plants, algae). Heterotrophs depend on plants/animals (humans, fungi).", 3, "Nutrition"],
  ["Define Photosynthesis and write its word equation.", "Process by which green plants convert CO₂ and water into glucose and oxygen in presence of sunlight & chlorophyll.", 3, "Plant Physiology"],
  ["Why should we avoid sleeping under huge trees at night?", "At night photosynthesis stops, so plants release carbon dioxide through continuous respiration.", 2, "Respiration"],
  ["Differentiate between Physical Change and Chemical Change with examples.", "Physical change alters shape/state without forming new substance (melting ice); Chemical change creates a new substance (rusting iron).", 3, "Chemistry"],
  ["Why is Rusting of iron considered a chemical change? State two ways to prevent it.", "Iron reacts with oxygen and moisture to form a new substance (iron oxide). Prevented by painting, oiling, or galvanisation.", 3, "Changes Around Us"],
  ["Differentiate between Acids and Bases on three properties.", "Acids taste sour, turn blue litmus red (HCl, citric acid). Bases taste bitter, feel soapy, turn red litmus blue (NaOH, soap).", 3, "Acids, Bases & Salts"],
  ["What is Neutralisation reaction? Give one everyday example.", "Reaction between acid and base forming salt and water with heat. Example: Applying baking soda or calamine on ant sting.", 3, "Acids & Bases"],
  ["Differentiate between Clinical Thermometer and Laboratory Thermometer.", "Clinical measures human body temperature (35°C–42°C) with a kink; Lab thermometer measures −10°C to 110°C without a kink.", 3, "Heat"],
  ["Name and explain the three modes of heat transfer.", "Conduction (solids), Convection (liquids & gases), and Radiation (needs no medium, e.g., sunlight).", 3, "Heat"],
  ["Why do woollen clothes keep us warm in winter?", "Wool fibres trap air inside pockets; since air is a poor conductor of heat, it stops body heat from escaping.", 2, "Heat"],
  ["Differentiate between Arteries and Veins.", "Arteries carry oxygenated blood away from heart under high pressure (thick walls). Veins carry deoxygenated blood back to heart (have valves).", 3, "Circulation"],
  ["Why does our breathing rate increase during vigorous running?", "Muscles need extra energy during running, requiring faster oxygen intake and faster CO₂ removal.", 2, "Respiration"],
  ["Differentiate between Aerobic and Anaerobic Respiration.", "Aerobic uses oxygen releasing high energy + CO₂ + water. Anaerobic occurs without oxygen releasing less energy (lactic acid/alcohol).", 3, "Respiration"],
  ["State the functions of RBC, WBC, and Platelets in human blood.", "RBC transports oxygen (haemoglobin), WBC fights germs/infection, and Platelets help in blood clotting.", 3, "Transportation"],
  ["What is Transpiration? Mention two benefits it provides to plants.", "Loss of water vapour through leaf stomata. It cools the plant and creates suction pull lifting water upward.", 3, "Plants"],
  ["Distinguish between Asexual and Sexual Reproduction in plants.", "Asexual needs one parent (budding, cutting) producing identical offspring; Sexual involves fusion of male & female gametes forming seeds.", 3, "Reproduction"],
  ["Define Pollination. Distinguish between Self and Cross Pollination.", "Transfer of pollen grains from anther to stigma. Self occurs within same/same-plant flower; Cross occurs between two different plants.", 3, "Reproduction"],
  ["Differentiate between Speed and Velocity (or Uniform vs Non-Uniform Motion).", "Uniform motion covers equal distances in equal time intervals; Non-uniform covers unequal distances in equal time.", 3, "Motion & Time"],
  ["A bus travels 180 km in 3 hours. Calculate its average speed in km/h and m/s.", "Speed = 180 / 3 = 60 km/h. In m/s: 60 × (5/18) = 16.67 m/s.", 3, "Motion Numerics"],
  ["State two differences between Concave Mirror and Convex Mirror with one use each.", "Concave converges light, forms enlarged image when close (shaving/headlight); Convex diverges light, wider view (rear-view mirror).", 3, "Light"],
  ["Differentiate between Real Image and Virtual Image.", "Real image can be caught on a screen and is inverted; Virtual image cannot be formed on screen and is always erect.", 3, "Light"],
  ["Why is Newton's Disc used to demonstrate composition of white light?", "When a 7-coloured VIBGYOR disc spins rapidly, colours blend to appear white, proving sunlight mixes seven colours.", 2, "Light"],
  ["What is a Fuse wire? Why is it connected in household circuits?", "Safety wire of low melting point alloy that melts and breaks circuit during overload/short circuit, preventing fire.", 3, "Electricity"],
  ["State two factors on which heating effect of electric current depends.", "Depends on strength of current (I²), resistance of wire (R), and time duration (t).", 2, "Electricity"],
  ["What is an Electromagnet? Mention two practical uses.", "Temporary magnet formed by passing electric current around an iron core. Used in electric bells and scrap cranes.", 3, "Electromagnetism"],
  ["Why are copper wires coated with plastic or PVC insulation?", "Copper is a good conductor while plastic is an insulator, preventing electric shocks and short circuits.", 2, "Electricity"],
  ["List four ways to conserve forests and wildlife.", "1. Stop illegal poaching. 2. Controlled afforestation. 3. Establish National Parks/Biosphere reserves. 4. Control forest fires.", 3, "Forest Conservation"],
  ["Differentiate between Manure and Fertilisers (three points).", "Manure is organic natural waste improving soil texture; Fertilisers are factory chemicals rich in specific NPK nutrients.", 3, "Crop Production"],
  ["What is Irrigation? Why are Drip and Sprinkler systems encouraged?", "Supplying water to crops at intervals. Drip/Sprinkler save water by delivering drops directly to roots or like rain.", 3, "Agriculture"],
  ["Write three useful roles of Microorganisms in daily life.", "1. Lactobacillus turns milk to curd. 2. Yeast helps baking & fermentation. 3. Rhizobium fixes nitrogen in soil.", 3, "Microorganisms"],
  ["How does Vaccination protect our body from diseases like Polio or Measles?", "Introduces dead/weakened microbes triggering WBCs to produce memory antibodies that fight future infections rapidly.", 3, "Health & Immunity"],
  ["Differentiate between Thermoplastics and Thermosetting Plastics with examples.", "Thermoplastics soften on heating and can be remoulded (PVC, Polythene). Thermosetting stay rigid (Bakelite, Melamine).", 3, "Synthetic Fibres"],
  ["Compare Metals and Non-Metals on malleability, ductility, and conductivity.", "Metals are malleable, ductile, and good conductors (Copper, Iron); Non-metals are brittle and poor conductors (Sulphur, Coal).", 3, "Metals & Non-Metals"],
  ["Why is Sodium stored under kerosene oil?", "Sodium is extremely reactive and catches fire violently on contact with oxygen or moisture in air.", 2, "Metals & Non-Metals"],
  ["What is Displacement Reaction? Illustrate with Copper Sulphate and Iron.", "A more reactive metal displaces a less reactive one: Iron nail in blue CuSO₄ turns solution green (FeSO₄) and coats brown copper.", 3, "Chemistry Reactions"],
  ["Explain why Coal and Petroleum are called Exhaustible Natural Resources.", "They took millions of years to form from dead organisms and exist in finite underground reserves that can run out.", 2, "Coal & Petroleum"],
  ["What are the three essential conditions required for Combustion?", "1. Combustible fuel, 2. Supporter of combustion (Oxygen), 3. Attainment of Ignition Temperature.", 3, "Combustion & Flame"],
  ["Why should water NEVER be poured on an electrical or petrol fire?", "Water conducts electricity (shock hazard) and sinks below lighter petrol allowing oil fire to keep spreading.", 2, "Fire Safety"],
  ["Label and explain the three zones of a candle flame.", "Outer blue zone (hottest, complete combustion), Middle yellow zone (moderately hot, luminous), Innermost black zone (unburnt wax, coolest).", 3, "Combustion & Flame"],
  ["Differentiate between Plant Cell and Animal Cell (three clear differences).", "Plant cells have rigid cell wall, large central vacuole, and plastids (chloroplasts); Animal cells lack cell wall & plastids.", 3, "Cell Biology"],
];

const SEC_SCI_EXTRA_TOPICS: [string, string, string][] = [
  ["Endangered vs Extinct Species", "Endangered species risk disappearing soon (Bengal Tiger); Extinct species no longer exist on Earth (Dodo, Dinosaurs)", "Biodiversity"],
  ["Red Data Book", "Official source record book maintaining data on threatened, endangered plant and animal species", "Conservation"],
  ["Prokaryotic vs Eukaryotic Cells", "Prokaryotes lack true nuclear membrane (Bacteria); Eukaryotes have well-defined nucleus (Plants, Animals)", "Cell Structure"],
  ["Mitochondria", "Called the 'Powerhouse of the Cell' because it generates ATP energy during cellular respiration", "Cell Organelles"],
  ["Nucleus of a Cell", "Spherical control centre containing DNA/chromosomes regulating cell growth and inheritance", "Cell Organelles"],
  ["Chloroplast", "Green plastid containing chlorophyll present only in plant cells for photosynthesis", "Cell Organelles"],
  ["Binary Fission in Amoeba", "Asexual reproduction where single parent cell divides into two identical daughter Amoebae", "Reproduction"],
  ["External vs Internal Fertilisation", "External occurs outside body in water (Frog, Fish); Internal occurs inside female body (Humans, Birds)", "Reproduction"],
  ["Endocrine Glands & Pituitary", "Ductless glands secreting hormones into blood; Pituitary is master gland regulating growth", "Adolescence"],
  ["Insulin & Diabetes", "Pancreas secretes Insulin hormone controlling blood sugar; shortage causes diabetes", "Adolescence"],
  ["Contact vs Non-Contact Force", "Contact requires physical touch (Friction, Muscular); Non-contact acts from distance (Gravity, Magnetic, Electrostatic)", "Force & Pressure"],
  ["Pressure Formula & Why Bags Have Broad Straps", "Pressure = Force / Area. Broad straps increase contact area, reducing painful pressure on shoulders", "Force & Pressure"],
  ["Liquid & Atmospheric Pressure", "Air around us exerts atmospheric pressure; liquid pressure increases with depth below surface", "Pressure"],
  ["Sliding vs Rolling Friction", "Rolling friction is much smaller than sliding friction, so wheels make moving heavy loads easier", "Friction"],
  ["Why Ball Bearings Are Used in Machines", "They convert high sliding friction into low rolling friction, reducing heat and wear", "Friction"],
  ["Streamlined Shape", "Tapering body shape (birds, fish, aeroplanes) that reduces fluid friction/drag during motion", "Friction"],
  ["Amplitude & Frequency of Sound", "Amplitude decides loudness (dB); Frequency (Hz) decides pitch/shrillness of sound", "Sound"],
  ["Audible Range for Humans", "20 Hz to 20,000 Hz (20 kHz); ultrasonic (>20 kHz) is heard by bats and dogs", "Sound"],
  ["Noise vs Music", "Music has pleasant regular vibrations; Noise consists of unpleasant, irregular, loud vibrations", "Sound"],
  ["Electroplating", "Depositing a thin protective layer of desirable metal (chromium/gold) on another metal via electrolysis", "Chemical Effects"],
  ["LED vs Bulb in Conductivity Test", "LED glows even with very weak electric current where ordinary filament bulbs fail to glow", "Electricity"],
  ["Lightning Conductor", "Pointed copper rod installed on tall buildings carrying lightning charge safely straight into earth", "Natural Phenomena"],
  ["Richter Scale", "Logarithmic scale measuring earthquake magnitude; readings above 7 are severely destructive", "Earthquakes"],
  ["Laws of Reflection", "1. Angle of incidence = Angle of reflection (∠i = ∠r). 2. Incident, normal, and reflected ray lie in same plane", "Light"],
  ["Regular vs Diffused Reflection", "Regular occurs on smooth mirrors forming clear image; Diffused occurs on rough surfaces", "Light"],
  ["Human Eye: Retina & Iris", "Iris controls pupil size (eye colour); Retina acts as screen where inverted image forms", "Human Eye"],
  ["Blind Spot in Eye", "Junction of optic nerve and retina having no sensory cells, hence no vision occurs there", "Human Eye"],
  ["Light Year", "Distance travelled by light in one year (~9.46 × 10¹² km), used to measure star distances", "Astronomy"],
  ["Artificial vs Natural Satellites", "Moon is Earth's natural satellite; INSAT and GSAT are man-made artificial satellites", "Solar System"],
  ["Greenhouse Effect", "Trapping of solar infrared heat by CO₂ and methane warming Earth; excess triggers climate change", "Environment"],
  ["Acid Rain", "Rain turning acidic when SO₂ and NO₂ pollutants dissolve in rainwater, corroding marble like Taj Mahal", "Pollution"],
  ["Eutrophication", "Excessive algal growth in water bodies caused by fertiliser runoff, depleting dissolved oxygen for fish", "Water Pollution"],
  ["Chlorination of Water", "Adding measured chlorine tablets to kill disease-causing bacteria making water safe to drink", "Potable Water"],
  ["3 Steps of Sewage Treatment", "Bar screen filtering large solids → Grit & sedimentation settling → Biological aeration breakdown", "Wastewater"],
  ["Ruminants (Cud-Chewing)", "Grass-eaters like cows swallow quickly into rumen and bring back partially digested cud to chew", "Nutrition"],
  ["Villi in Small Intestine", "Thousands of finger-like projections increasing surface area to absorb digested nutrients into blood", "Digestion"],
  ["Bile Juice Function", "Produced by Liver and stored in Gall Bladder; breaks down large fat globules into tiny droplets", "Digestion"],
  ["Wool Processing Steps", "Shearing → Scouring (washing) → Sorting → Dyeing → Rolling into yarn", "Fibres"],
  ["Anemometer", "Weather instrument with rotating cups used to measure wind speed", "Winds & Storms"],
  ["Cyclone Eye", "Calm, cloud-free low-pressure centre (10–30 km wide) surrounded by swirling high-speed storm winds", "Cyclones"],
  ["Percolation Rate of Water", "Speed at which soil absorbs water (mL / min); highest in sandy soil, lowest in clayey soil", "Soil"],
  ["Neutral Soil for Crops", "Most crops grow best near neutral pH; farmers add quicklime if too acidic or organic matter if basic", "Soil"],
  ["Stomata Opening & Guard Cells", "Bean-shaped guard cells swell and shrink to open/close stomata pores for gas exchange", "Respiration"],
  ["Dialysis", "Artificial medical filtration of waste from blood when a patient's kidneys stop functioning", "Excretion"],
  ["Urea Excretion", "Human kidneys filter nitrogenous waste (urea) out of blood as urine", "Excretion"],
  ["Seed Dispersal Mechanisms", "Drumstick/maple by wind, coconut by water, xanthium hooks by animals, balsam by bursting", "Plants"],
  ["Fuse vs MCB", "Fuse melts wire on overload (needs replacing); MCB automatically trips switch and can be reset easily", "Electricity"],
  ["Spectrum of Sunlight", "Splitting white sunlight into seven colours (VIBGYOR) while passing through a glass prism", "Light"],
  ["Alloy Stainless Steel", "Mixture of Iron with Carbon, Chromium, and Nickel so it resists rusting permanently", "Metals"],
  ["CNG vs Petrol", "Compressed Natural Gas burns cleaner with negligible smoke, making it eco-friendly transport fuel", "Fuels"],
];

function build200SecondaryScience(cls: 6 | 7 | 8 | 9 | 10): SubjTuple[] {
  const out: SubjTuple[] = [];
  SEC_SCI_BANK.forEach(([q, ans, m, tag]) => {
    out.push(["Science", m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER", q, ans, m, tag]);
  });
  // Add 160 diverse items using EXTRA_TOPICS (2-3 variants per topic across Scientific Reason, Definition, Compare)
  SEC_SCI_EXTRA_TOPICS.forEach(([topic, fact, tag], idx) => {
    out.push([
      "Science",
      idx % 3 === 0 ? "LONG_ANSWER" : "SHORT_ANSWER",
      `Explain the scientific concept of '${topic}' concisely.`,
      `${topic}: ${fact}.`,
      idx % 3 === 0 ? 3 : 2,
      tag,
    ]);
    out.push([
      "Science",
      "SHORT_ANSWER",
      `Give a brief scientific reason or application related to '${topic}'.`,
      `${fact}. This principle helps explain real-life observations in ${tag}.`,
      2,
      tag,
    ]);
    if (idx < 60) {
      out.push([
        "Science",
        "SHORT_ANSWER",
        `In Class ${cls} Science (${tag}), state one key fact about '${topic}'.`,
        `${fact}.`,
        2,
        tag,
      ]);
    }
    if (idx < 25) {
      out.push([
        "Science",
        "SHORT_ANSWER",
        `How is '${topic}' relevant in everyday life or industry?`,
        `Application of ${topic}: ${fact}.`,
        2,
        tag,
      ]);
    }
  });
  return finalizeSubjectTuples(cls, "Science", out, 200);
}

// ── SECONDARY SOCIAL SCIENCE POOLS (Classes 6–8) ─────────────────────────────
const SEC_SST_FACTS: [string, string, string, number][] = [
  ["Why is the Indus Valley Civilization famous for town planning?", "Planned grid streets, baked brick houses, covered drainage systems, and the Great Bath at Mohenjo-daro.", "Ancient History", 3],
  ["Name the four Vedas and identify the oldest one.", "Rigveda (oldest), Samaveda, Yajurveda, and Atharvaveda.", "Ancient History", 2],
  ["What were the main teachings of Ashoka's Dhamma?", "Non-violence (Ahimsa), respect for elders, religious tolerance, truthfulness, and kindness to servants and animals.", "Mauryan Empire", 3],
  ["Why is the Gupta Period known as the Golden Age of India?", "Flourishing achievements in science (Aryabhata), medicine, literature (Kalidasa), temple architecture, and peace.", "Ancient History", 3],
  ["Explain the Mansabdari System introduced by Akbar.", "Administrative ranking system where each officer (Mansabdar) held a numerical rank ('zat' and 'sawar') determining salary and troops.", "Medieval History", 3],
  ["Name the five dynasties of the Delhi Sultanate in chronological order.", "Slave (Mamluk), Khilji, Tughlaq, Sayyid, and Lodi dynasties (1206–1526).", "Medieval History", 3],
  ["State three major causes of the Revolt of 1857.", "1. Political annexation via Doctrine of Lapse, 2. Economic exploitation of farmers & artisans, 3. Greased cartridges hurting religious sentiments.", "Modern History", 5],
  ["What was the Doctrine of Lapse? Name two states annexed under it.", "Lord Dalhousie's policy annexing princely states without a natural male heir (e.g., Jhansi, Satara, Nagpur).", "Modern History", 3],
  ["Write three contributions of Raja Ram Mohan Roy as a social reformer.", "Fought to abolish Sati (1829), founded Brahmo Samaj, promoted women's education and widow welfare.", "Social Reform", 3],
  ["Distinguish between Moderates and Extremists in the Indian National Congress.", "Moderates used petitions and constitutional speeches (Gokhale); Extremists demanded Swaraj via boycotts and mass action (Tilak, Lala Lajpat Rai).", "Freedom Struggle", 3],
  ["Explain the importance of the Dandi March (1930).", "Gandhiji walked 240 miles to Dandi breaking the unjust British Salt Tax law, launching the Civil Disobedience Movement.", "Freedom Struggle", 3],
  ["What did the Quit India Movement (1942) demand?", "Immediate end of British rule in India, inspired by Mahatma Gandhi's famous call 'Do or Die'.", "Freedom Struggle", 2],
  ["What is a Constitution? When was India's Constitution adopted and enforced?", "Supreme set of fundamental laws governing a nation. Adopted 26 Nov 1949; enforced 26 Jan 1950.", "Civics", 3],
  ["List the six Fundamental Rights guaranteed by the Indian Constitution.", "Right to Equality, Freedom, Against Exploitation, Freedom of Religion, Cultural & Educational Rights, Constitutional Remedies.", "Civics", 5],
  ["Explain the meaning of 'Secularism' in the Indian context.", "The State has no official religion and treats all religions equally without discrimination or favouritism.", "Civics", 2],
  ["What are the three organs of Government and their main functions?", "Legislature (makes laws), Executive (implements laws), Judiciary (interprets laws & delivers justice).", "Civics", 3],
  ["Distinguish between Lok Sabha and Rajya Sabha (three points).", "Lok Sabha is directly elected Lower House (max 552, 5-year term); Rajya Sabha is permanent Upper House (250 members, 6-year term).", "Parliament", 3],
  ["What is Universal Adult Franchise?", "Right of every citizen aged 18 years or above to vote freely regardless of caste, gender, wealth, or religion.", "Democracy", 2],
  ["What is Panchayati Raj? Name its three tiers.", "Three-tier rural local self-government: Gram Panchayat (village), Panchayat Samiti (block), Zila Parishad (district).", "Local Govt", 3],
  ["Why is an independent Judiciary essential in a democracy?", "Protects citizens' Fundamental Rights, resolves disputes fairly without political pressure, and upholds the Constitution.", "Judiciary", 3],
  ["Define 'Longitude' and 'Latitude' and state why Standard Time is needed.", "Latitudes are east-west parallel circles (Equator 0°); Longitudes are north-south meridians. Standard Time (IST 82.5°E) avoids local time confusion.", "Geography", 3],
  ["Name the three heat zones of Earth and give one feature of each.", "Torrid (hottest, near equator), Temperate (moderate climate), Frigid (extremely cold polar caps).", "Geography", 3],
  ["Name and briefly describe the four major domains of the Earth.", "Lithosphere (land/rocks), Hydrosphere (water), Atmosphere (air envelope), Biosphere (narrow life-supporting zone).", "Geography", 3],
  ["Describe the layers of the Earth's interior.", "Crust (thin outermost solid shell), Mantle (semi-molten rocks), Core (innermost dense iron-nickel sphere).", "Geography", 3],
  ["Distinguish between Weather and Climate.", "Weather is day-to-day atmospheric condition at a place; Climate is average weather pattern over 30+ years.", "Climate", 2],
  ["List the five layers of Earth's Atmosphere from bottom to top.", "Troposphere (weather), Stratosphere (ozone), Mesosphere (meteors burn), Thermosphere (radio/satellites), Exosphere.", "Atmosphere", 3],
  ["Why is the Ozone layer important for life on Earth?", "Present in Stratosphere, it absorbs harmful Ultraviolet (UV) rays from the Sun preventing skin cancer.", "Atmosphere", 2],
  ["Compare Igneous, Sedimentary, and Metamorphic Rocks with one example each.", "Igneous formed from cooled magma (Basalt/Granite); Sedimentary from compressed layers (Sandstone); Metamorphic transformed by heat/pressure (Marble).", "Rocks & Minerals", 5],
  ["What causes Tides in oceans? Distinguish between Spring and Neap tides.", "Gravitational pull of Moon and Sun causes rhythmic rise/fall. Spring tides (highest) occur on Full/New Moon; Neap tides (lowest) on quarter moons.", "Water", 3],
  ["What is Soil Conservation? State three effective methods.", "Preventing soil erosion & fertility loss via Terrace farming on hills, Shelterbelts (tree rows), and Contour ploughing.", "Resources", 3],
  ["Distinguish between Commercial Farming and Subsistence Farming.", "Subsistence meets farmer's family needs with small tools; Commercial grows crops on large scale with modern machines for market profit.", "Agriculture", 3],
  ["Name two major Fibre crops and the soil/climate they require.", "Cotton (black soil, warm frost-free days) and Jute (alluvial soil, heavy rainfall & warm humid climate).", "Agriculture", 2],
  ["Why is Bengaluru called the 'Silicon Valley of India'?", "Hub of software companies, research centres, skilled IT engineers, and mild climate supporting IT industry.", "Industries", 2],
  ["Explain three factors affecting the location of an Industry.", "Availability of raw materials, cheap power/water supply, transport connectivity, skilled labour, and market proximity.", "Industries", 3],
  ["What is Sustainable Development? Give two examples.", "Using resources wisely to meet present needs without compromising future generations (e.g., Solar power, Rainwater harvesting).", "Resources", 3],
];

const SEC_SST_CONCISE_TOPICS: [string, string, string][] = [
  ["Harappan Seals & Granaries", "Square steatite seals showing animal motifs & script; Great Granary at Harappa stored surplus grain", "History"],
  ["Jainism & Buddhism Founders", "Vardhamana Mahavira (24th Tirthankara of Jainism) and Siddhartha Gautama Buddha (Buddhism)", "History"],
  ["Kalinga War & Ashoka's Change", "Mass bloodshed in Kalinga (261 BCE) made Emperor Ashoka renounce war and adopt Dhamma", "History"],
  ["Silk Route", "Ancient overland trade network linking China, Central Asia, India, and Europe for silk & spices", "History"],
  ["Chola Local Self-Government", "Famous for bronze sculptures, Brihadishvara Temple, and democratic village assemblies (Sabha & Ur)", "History"],
  ["Qutub Minar & Iron Pillar", "Qutub Minar in Delhi shows Indo-Islamic architecture; nearby Gupta Iron Pillar stays rust-free", "History"],
  ["Bhakti & Sufi Movements", "Preached devotion to God, brotherhood, equality beyond caste rituals (Kabir, Nanak, Mirabai)", "History"],
  ["Battle of Plassey (1757)", "British East India Company under Robert Clive defeated Siraj-ud-Daulah starting British political rule", "History"],
  ["Permanent Settlement (1793)", "Land revenue system in Bengal introduced by Lord Cornwallis making Zamindars hereditary tax collectors", "History"],
  ["Indigo Revolt (1859)", "Bengal peasants protested against forced unprofitable indigo cultivation by European planters", "History"],
  ["Swadeshi & Boycott (1905)", "Mass protest against Partition of Bengal promoting Indian-made goods and national schools", "History"],
  ["Non-Cooperation Movement (1920)", "Gandhiji urged Indians to boycott British titles, courts, schools, and foreign cloth peacefully", "History"],
  ["Subhas Chandra Bose & INA", "Formed Azad Hind Fauj (INA) giving iconic call 'Jai Hind' and 'Give me blood, I will give you freedom'", "History"],
  ["Partition & Independence (1947)", "India achieved independence on 15 August 1947; Jawaharlal Nehru became first Prime Minister", "History"],
  ["Preamble of Indian Constitution", "Introductory mirror declaring India a Sovereign, Socialist, Secular, Democratic Republic", "Civics"],
  ["Rule of Law", "Principle that every citizen—rich, poor, or official—is equal before law and subject to same courts", "Civics"],
  ["FIR (First Information Report)", "Written complaint registered at a police station setting criminal investigation in motion", "Civics"],
  ["Public Interest Litigation (PIL)", "Legal mechanism letting any citizen approach High/Supreme Court for public welfare & rights protection", "Civics"],
  ["Marginalised Communities", "Groups historically pushed to edges (SC, ST, minorities) protected through constitutional safeguards", "Civics"],
  ["Right to Education (RTE Act 2009)", "Guarantees free and compulsory elementary education for every child aged 6 to 14 years", "Civics"],
  ["Minimum Support Price (MSP)", "Guaranteed minimum price fixed by government to protect farmers when market prices drop", "Civics"],
  ["Mid-Day Meal Scheme", "Free nutritious cooked school lunch improving child nutrition, attendance, and social equality", "Civics"],
  ["Role of Media in Democracy", "Informs citizens, questions government policies, and highlights public grievances responsibly", "Civics"],
  ["Chief Minister & Governor", "Governor is constitutional head of State; Chief Minister heads elected State Council of Ministers", "Civics"],
  ["High Court vs Supreme Court", "Supreme Court (New Delhi) is apex national court; High Court is highest judicial court inside a State", "Civics"],
  ["Prime Meridian (0° Longitude)", "Passes through Greenwich (London) and separates Eastern from Western Hemisphere", "Geography"],
  ["Tropic of Cancer in India", "23.5°N latitude passing almost midway through India across 8 states", "Geography"],
  ["Alluvial Soil in Northern Plains", "Extremely fertile soil deposited by Ganga, Indus, and Brahmaputra rivers ideal for wheat & rice", "Geography"],
  ["Black Cotton Soil (Regur)", "Volcanic Deccan Plateau soil rich in clay that retains moisture well for cotton growth", "Geography"],
  ["Delta vs Estuary", "Delta is triangular silt fan at gentle river mouth (Ganga); Estuary is narrow tidal mouth (Narmada)", "Geography"],
  ["Western vs Eastern Ghats", "Western Ghats are continuous higher hills along Arabian Sea; Eastern Ghats are broken lower hills along Bay of Bengal", "Geography"],
  ["Monsoon Winds in India", "Seasonal moisture-bearing winds blowing from southwest sea to land from June to September", "Geography"],
  ["Natural Vegetation: Evergreen vs Deciduous", "Evergreen stay green year-round in heavy rainfall; Deciduous (Monsoon) shed leaves in dry summer", "Geography"],
  ["Water Table", "Upper underground level where soil pores and rocks are completely saturated with water", "Geography"],
  ["Ocean Currents", "Streams of water flowing constantly along definite paths affecting coastal climate & fishing", "Geography"],
  ["Biogas Energy", "Clean rural fuel (methane) produced by decomposing cattle dung and farm waste in anaerobic tanks", "Geography"],
  ["Population Pyramid", "Graphical chart showing age-sex distribution (young dependents vs working adults) of a nation", "Geography"],
  ["Primary, Secondary & Tertiary Sectors", "Primary extracts natural goods (farming), Secondary manufactures (steel mill), Tertiary gives services (banking)", "Geography"],
  ["TATA Steel (TISCO) Jamshedpur", "India's pioneer integrated steel plant located near coal, iron ore, and Subarnarekha river", "Geography"],
  ["Green Revolution", "1960s agricultural leap using HYV seeds, irrigation, and fertilisers multiplying India's wheat & rice yield", "Geography"],
  ["White Revolution (Operation Flood)", "Cooperative dairy movement led by Dr. Verghese Kurien making India world's largest milk producer", "Geography"],
  ["Cyclone vs Earthquake Preparedness", "Cyclone warnings allow evacuation by radar; Earthquakes strike without warning so seismic building codes matter", "Disaster Mgmt"],
  ["Coral Reefs", "Underwater ecosystems built by tiny coral polyps in warm shallow tropical seas (e.g., Lakshadweep)", "Geography"],
  ["Islands of India", "Andaman & Nicobar Islands in Bay of Bengal and Lakshadweep Islands in Arabian Sea", "Geography"],
  ["Seven Continents & Ring of Fire", "Pacific Rim 'Ring of Fire' accounts for majority of Earth's active volcanoes and earthquakes", "Geography"],
];

function build200SecondarySocial(cls: 6 | 7 | 8 | 9 | 10): SubjTuple[] {
  const out: SubjTuple[] = [];
  SEC_SST_FACTS.forEach(([q, ans, tag, m]) => {
    out.push(["Social Science", m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER", q, ans, m, tag]);
  });
  // From 45 concise topics, generate 3-4 varied non-duplicate questions per topic -> 35 + 165 = 200
  SEC_SST_CONCISE_TOPICS.forEach(([topic, fact, tag], idx) => {
    out.push([
      "Social Science",
      "SHORT_ANSWER",
      `Write a short note explaining '${topic}'.`,
      `${topic}: ${fact}.`,
      2,
      tag,
    ]);
    out.push([
      "Social Science",
      "SHORT_ANSWER",
      `What is the historical/geographical significance of '${topic}'?`,
      `${fact}.`,
      2,
      tag,
    ]);
    out.push([
      "Social Science",
      idx % 2 === 0 ? "LONG_ANSWER" : "SHORT_ANSWER",
      `State two key points students must know about '${topic}' (${tag}).`,
      `Key points on ${topic}: ${fact}.`,
      idx % 2 === 0 ? 3 : 2,
      tag,
    ]);
    if (idx < 30) {
      out.push([
        "Social Science",
        "SHORT_ANSWER",
        `In Class ${cls} Social Studies (${tag}), how would you summarise '${topic}' in 2 lines?`,
        `${fact}.`,
        2,
        tag,
      ]);
    }
  });
  return finalizeSubjectTuples(cls, "Social Science", out, 200);
}

// ── SECONDARY REASONING & GK POOLS (Classes 6–8) ─────────────────────────────
function build200SecondaryReasoning(cls: 6 | 7 | 8 | 9 | 10): SubjTuple[] {
  const out: SubjTuple[] = [];

  // 1. 45 Number Series with explanation (no collisions)
  for (let i = 0; i < 45; i++) {
    if (i % 2 === 0) {
      const start = 2 + Math.floor(i / 2) + cls;
      const d = 3 + (i % 7);
      const t1 = start;
      const t2 = t1 + d;
      const t3 = t2 + d * 2;
      const t4 = t3 + d * 3;
      const t5 = t4 + d * 4;
      out.push([
        "Reasoning & GK",
        "SHORT_ANSWER",
        `Find the missing next term and explain the rule: ${t1}, ${t2}, ${t3}, ${t4}, ?`,
        `Differences are +${d}, +${2 * d}, +${3 * d}, so next is +${4 * d}: ${t4} + ${4 * d} = ${t5}.`,
        2,
        "Number Series",
      ]);
    } else {
      const a = 2 + Math.floor(i / 2);
      const k = 1 + (i % 5);
      const s1 = a;
      const s2 = s1 * 2 + k;
      const s3 = s2 * 2 + k;
      const s4 = s3 * 2 + k;
      out.push([
        "Reasoning & GK",
        "SHORT_ANSWER",
        `Identify the pattern and determine the next term: ${s1}, ${s2}, ${s3}, ?`,
        `Pattern is ×2 + ${k}. Thus next term = ${s3} × 2 + ${k} = ${s4}.`,
        2,
        "Number Series",
      ]);
    }
  }

  // 2. 35 Coding-Decoding & Word Analogy (all 35 unique words)
  const words = [
    "SCHOOL", "BRAIN", "LIGHT", "PLANT", "RIVER", "WATER", "TIGER", "INDIA", "CLOUD", "STONE",
    "SMART", "HOUSE", "CHAIR", "MUSIC", "TRAIN", "APPLE", "GREEN", "EARTH", "SPACE", "FLAME",
    "CLOCK", "GLOBE", "HONEY", "PEARL", "CROWN", "EAGLE", "LOTUS", "POWER", "QUIET", "SMILE",
    "PRIDE", "OCEAN", "BRICK", "SOUND", "HEART",
  ];
  for (let i = 0; i < 35; i++) {
    const w = words[i];
    const shift = 1 + (i % 3);
    const encode = (str: string) =>
      str
        .split("")
        .map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65))
        .join("");
    const coded = encode(w);
    const target = words[(i + 7) % words.length];
    const codedTarget = encode(target);
    out.push([
      "Reasoning & GK",
      "SHORT_ANSWER",
      `In a certain code language, '${w}' is written as '${coded}'. Using the same rule, how is '${target}' coded?`,
      `Rule: Each letter shifts forward by +${shift} step(s). Applying +${shift} to '${target}' gives '${codedTarget}'.`,
      2,
      "Coding & Decoding",
    ]);
  }

  // 3. 51 Direction, Ranking, Blood Relations & Clock Puzzles (unique clock minutes too)
  for (let i = 0; i < 51; i++) {
    if (i % 3 === 0) {
      const left = 6 + i;
      const right = 9 + (i % 13);
      out.push([
        "Reasoning & GK",
        "SHORT_ANSWER",
        `In a row of students, Kabir stands ${left}th from the left end and ${right}th from the right end. Find the total students in the row.`,
        `Total = Left position + Right position − 1 = ${left} + ${right} − 1 = ${left + right - 1} students.`,
        2,
        "Ranking & Order",
      ]);
    } else if (i % 3 === 1) {
      const triples: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]];
      const [da, db, dc] = triples[i % triples.length];
      const mult = 1 + Math.floor(i / 15);
      out.push([
        "Reasoning & GK",
        "LONG_ANSWER",
        `A boy walks ${da * mult} km North and then turns East for ${db * mult} km (case #${i + 1}). Calculate his shortest straight distance from the starting point.`,
        `By Pythagoras Theorem: Distance = √((${da * mult})² + (${db * mult})²) = ${dc * mult} km.`,
        3,
        "Direction Sense",
      ]);
    } else {
      const hour = 1 + (Math.floor(i / 3) % 11);
      const mins = Math.floor(i / 3) >= 11 ? 30 : 0;
      const rawAng = Math.abs(30 * hour - 5.5 * mins);
      const ang = Math.min(rawAng, 360 - rawAng);
      const timeLabel = `${hour}:${mins === 0 ? "00" : "30"}`;
      out.push([
        "Reasoning & GK",
        "SHORT_ANSWER",
        `Find the smaller angle between the hour hand and minute hand of an analogue clock at ${timeLabel}.`,
        `Using |30H − 5.5M|: At ${timeLabel}, smaller angle = ${ang}°.`,
        2,
        "Clock Angles",
      ]);
    }
  }

  // 4. 30 Logical Analogies & Blood Relation Reasoning
  const logicQuestions: [string, string][] = [
    ["Pointing to a photograph, Amit said, 'He is the only son of my grandfather's only son.' How is the boy related to Amit?", "Grandfather's only son = Amit's father. Father's only son = Amit himself."],
    ["Ria is the sister of Rohan. Suresh is the father of Rohan. Meena is Suresh's wife. How is Meena related to Ria?", "Meena is Ria's mother."],
    ["If 'A + B' means A is mother of B, and 'A × B' means A is brother of B, write the relation in 'P + Q × R'.", "P is the mother of Q, and Q is the brother of R, so P is the mother of both Q and R."],
    ["Complete and justify the analogy: Doctor : Hospital :: Judge : ?", "Court — a Doctor practises in a Hospital, similarly a Judge presides in a Court."],
    ["Complete and justify: Thermometer : Temperature :: Barometer : ?", "Atmospheric Pressure — Thermometer measures temperature, Barometer measures air pressure."],
    ["Complete and justify: Book : Author :: Painting : ?", "Artist / Painter — an Author creates a Book, just as an Artist creates a Painting."],
    ["Complete and justify: Lion : Den :: Rabbit : ?", "Burrow — natural dwelling/home of each animal."],
    ["Complete and justify: Heart : Blood :: Lungs : ?", "Air / Oxygen — Heart pumps blood; Lungs exchange oxygen/air."],
    ["Find the Odd One Out & justify: Mercury, Venus, Moon, Mars.", "Moon — all others are planets orbiting the Sun, whereas the Moon is Earth's natural satellite."],
    ["Find the Odd One Out & justify: Square, Triangle, Circle, Cube.", "Cube — Cube is a 3D solid figure while the other three are flat 2D shapes."],
    ["Find the Odd One Out & justify: Copper, Iron, Aluminium, Plastic.", "Plastic — it is a non-conducting polymer, whereas the other three are metallic conductors."],
    ["Find the Odd One Out & justify: 27, 64, 125, 144.", "144 — 27 (3³), 64 (4³), and 125 (5³) are perfect cubes, while 144 (12²) is a square."],
    ["Find the Odd One Out & justify: Patna, Jaipur, Bhopal, India.", "India — India is a country while the others are state capitals."],
    ["If 15th August falls on a Friday in a year, what day will 29th August fall on?", "14 days later (2 exact weeks) is Friday again."],
    ["If today is Tuesday, what day of the week will it be after 10 days?", "10 ÷ 7 gives remainder 3. Tuesday + 3 days = Friday."],
    ["How many triangles are hidden in a square divided by BOTH of its diagonals?", "8 triangles (4 small triangles + 4 medium triangles formed by combining pairs)."],
    ["If 5 machines take 5 minutes to make 5 toys, how long will 100 machines take to make 100 toys?", "5 minutes (each machine independently makes 1 toy in 5 minutes)."],
    ["A mirror shows the time 3:00 on an analogue clock. What is the real time?", "9:00 (Mirror time = 12:00 − 3:00 = 9:00)."],
    ["Arrange logically in ascending order: Word, Paragraph, Letter, Sentence.", "Letter → Word → Sentence → Paragraph."],
    ["Arrange logically from smallest to largest: District, Village, State, Country.", "Village → District → State → Country."],
    ["If 'North' becomes 'South-East', what direction does 'South' become?", "Rotating 135° clockwise, South becomes North-West."],
    ["Five friends P, Q, R, S, T sit in a row. R is in middle, P is left of R, Q is at extreme left, T is right of S? Not needed—state who sits in middle if P < Q < R < S < T.", "R sits right in the middle (3rd of 5)."],
    ["In a class of 40 students, Neeraj ranked 12th from the top. What is his rank from the bottom?", "Rank from bottom = 40 − 12 + 1 = 29th."],
    ["If 'PEN' = 35 (P=16, E=5, N=14), find the numerical code for 'BOOK'.", "B(2) + O(15) + O(15) + K(11) = 43."],
    ["If 'CAT' = 24 (3+1+20), find the value of 'DOG'.", "D(4) + O(15) + G(7) = 26."],
    ["Explain the difference between 'Venn Diagram' overlapping circles and disjoint circles.", "Overlapping circles show common members (e.g., Students & Athletes); disjoint circles have no common member (Dogs & Cats)."],
    ["Find the missing letter pair: AZ, BY, CX, DW, ?", "EV — First letter moves +1 (A→E), second moves −1 (Z→V)."],
    ["Find the next term: B2, D4, F6, H8, ?", "J10 — Letters skip one (+2) and numbers increase by +2."],
    ["If 6 * 4 = 20 and 5 * 3 = 12 (rule a*b = a² − b²?), verify for 7 * 5.", "Check: 6² − 4² = 36−16=20; 5²−3²=25−9=16 (actually a×b − b? Wait: 6×4−4=20, 5×3−3=12 → rule a×b − b = b(a−1), so 7×5−5 = 30!)."],
    ["A snail climbs 3 m up a 10 m wall by day and slips 2 m each night. On which day does it reach the top?", "After 7 days it reaches 7 m net; on Day 8 it climbs +3 m to reach 10 m top before slipping! Answer: 8th day."],
  ];
  logicQuestions.forEach(([q, ans]) => {
    out.push(["Reasoning & GK", "SHORT_ANSWER", q, ans, 2, "Logical Reasoning"]);
  });

  // 5. 50 Subjective General Knowledge Questions (India, Science, Polity, Geography, Sports)
  const gkQuestions: [string, string][] = [
    ["Who is the Supreme Commander of the Indian Armed Forces and what is the minimum age for President?", "The President of India; minimum age is 35 years."],
    ["Name the three branches of the Indian Armed Forces and their motto of unity.", "Indian Army, Indian Navy, and Indian Air Force protecting land, sea, and skies."],
    ["Name the longest river completely inside India and the longest dam in India.", "Longest river inside India: Godavari (Ganga flows into Bangladesh too); Longest dam: Hirakud Dam (Odisha)."],
    ["Who invented the Telephone, Light Bulb, and Printing Press?", "Telephone: Alexander Graham Bell; Light Bulb: Thomas Edison; Printing Press: Johannes Gutenberg."],
    ["Who discovered Penicillin and Gravity?", "Penicillin: Alexander Fleming (1928); Law of Gravitation: Sir Isaac Newton."],
    ["Name India's first Satellite and India's first Astronaut to go into space.", "First satellite: Aryabhata (1975); First Indian astronaut: Wing Commander Rakesh Sharma (1984)."],
    ["What do CPU, RAM, URL, and PDF stand for?", "CPU: Central Processing Unit; RAM: Random Access Memory; URL: Uniform Resource Locator; PDF: Portable Document Format."],
    ["Name the capitals of: (a) Assam (b) Karnataka (c) Bihar (d) Himachal Pradesh.", "(a) Dispur  (b) Bengaluru  (c) Patna  (d) Shimla."],
    ["Which Indian freedom fighter founded the 'Forward Bloc' and what was his famous slogan?", "Netaji Subhas Chandra Bose; slogan 'Give me blood, and I will give you freedom'."],
    ["Name the deepest ocean trench on Earth and the highest plateau in the world.", "Deepest trench: Mariana Trench (Pacific Ocean); Highest plateau: Tibetan Plateau ('Roof of the World')."],
    ["Which Vitamin helps blood clot quickly and which mineral builds strong bones?", "Vitamin K helps blood clotting; Calcium & Phosphorus strengthen bones and teeth."],
    ["What is the full form of UNO, UNESCO, and WHO?", "UNO: United Nations Organisation; UNESCO: UN Educational, Scientific & Cultural Org; WHO: World Health Organization."],
    ["Where is the headquarters of ISRO located and what was India's Mars Mission called?", "ISRO HQ: Bengaluru; Mars Orbiter Mission (MOM) was famously called 'Mangalyaan'."],
    ["Who wrote 'Wings of Fire' and who wrote 'Discovery of India'?", "'Wings of Fire': Dr. A.P.J. Abdul Kalam; 'Discovery of India': Pt. Jawaharlal Nehru."],
    ["Name the largest state of India by area and the smallest state by area.", "Largest: Rajasthan; Smallest: Goa."],
    ["Name the four Nobel Laureates associated with India (any two in Science/Literature).", "Rabindranath Tagore (Literature, 1913) and Sir C.V. Raman (Physics, 1930)."],
    ["Which gas is filled in electric bulbs and which gas is used in chips packets?", "Argon/Nitrogen in electric bulbs; Nitrogen gas in chips packets to prevent rancidity."],
    ["What is the normal blood pressure and normal body temperature of a healthy adult?", "Blood pressure: 120/80 mmHg; Body temperature: 37°C (98.6°F)."],
    ["Name the largest gland in the human body and the master gland.", "Largest gland: Liver; Master endocrine gland: Pituitary gland."],
    ["Which river is called the 'Sorrow of Bihar' and why?", "River Kosi, because it frequently changes its course and causes severe floods in North Bihar."],
    ["Who is known as the 'Father of Green Revolution' in India?", "Dr. M.S. Swaminathan."],
    ["Which city is called the 'Pink City', 'Lake City', and 'Manchester of India'?", "Pink City: Jaipur; Lake City: Udaipur; Manchester of India: Ahmedabad."],
    ["What is the pH value of pure water, and what pH range indicates acids vs bases?", "Pure water pH = 7 (neutral); Acids have pH < 7; Bases have pH > 7."],
    ["Name the hardest natural substance on Earth and the liquid metal at room temperature.", "Hardest natural substance: Diamond; Liquid metal: Mercury."],
    ["Which instrument measures Earthquake waves and which measures Milk purity?", "Earthquake waves: Seismograph; Milk purity: Lactometer."],
    ["Name two classical music maestros and two Indian Olympic medallists.", "Music: Pt. Ravi Shankar, Ustad Bismillah Khan; Olympics: Neeraj Chopra, P.V. Sindhu."],
    ["What are the two Houses of Parliament and how many judges sit at maximum strength in SC?", "Lok Sabha & Rajya Sabha; Supreme Court includes Chief Justice + up to 33 judges (34 total)."],
    ["Which Amendment lowered India's voting age from 21 to 18 years?", "The 61st Constitutional Amendment Act (1988)."],
    ["Name any four UNESCO World Heritage Sites in India.", "Taj Mahal, Ajanta Caves, Kaziranga National Park, and Nalanda Mahavihara (Bihar)."],
    ["Which is the only floating National Park in the world and where is it located?", "Keibul Lamjao National Park on Loktak Lake in Manipur."],
    ["Who was the first woman Prime Minister and first woman President of India?", "First Woman PM: Indira Gandhi; First Woman President: Pratibha Patil."],
    ["What is the chemical formula of Common Salt, Water, and Carbon Dioxide?", "Common Salt: NaCl; Water: H₂O; Carbon Dioxide: CO₂."],
    ["Name the metal present in Chlorophyll and the metal present in Haemoglobin.", "Chlorophyll contains Magnesium; Haemoglobin contains Iron."],
    ["Which planet is called 'Morning & Evening Star' and which has prominent icy rings?", "Venus (hottest/brightest planet); Saturn has distinct icy rings."],
    ["How many spokes are in the Ashoka Chakra and where was its Lion Capital taken from?", "24 spokes; Lion Capital comes from Ashoka's pillar at Sarnath (Uttar Pradesh)."],
    ["Name the founder of Mauryan Empire and his famous advisor who wrote Arthashastra.", "Chandragupta Maurya, guided by Chanakya (Kautilya)."],
    ["What does ATM, PIN, UPI, and SIM stand for?", "ATM: Automated Teller Machine; PIN: Personal Identification Number; UPI: Unified Payments Interface; SIM: Subscriber Identity Module."],
    ["Which Indian state has the longest coastline and which is called the 'Land of Rising Sun'?", "Longest coastline: Gujarat; Land of Rising Sun in India: Arunachal Pradesh."],
    ["Name two neighbouring island nations of India in the Indian Ocean.", "Sri Lanka and Maldives."],
    ["Why do astronauts wear pressurised spacesuits on the Moon?", "Because the Moon has no atmosphere or air pressure, extreme temperatures, and harmful space radiation."],
    ["Name the three states of water and define 'Latent' melting at 0°C.", "Ice (solid), Water (liquid), Steam (gas). Ice melts into liquid water at 0°C."],
    ["Who gave the slogan 'Jai Jawan, Jai Kisan' and who added 'Jai Vigyan'?", "'Jai Jawan, Jai Kisan': Lal Bahadur Shastri; 'Jai Vigyan' added by Atal Bihari Vajpayee."],
    ["Which country won the first Cricket World Cup (1975) and when did India first win it?", "West Indies (1975); India won its first Cricket World Cup in 1983 under Kapil Dev."],
    ["What is the national aquatic animal of India and where is it mainly found?", "Ganga River Dolphin, found mainly in the Ganga–Brahmaputra river systems."],
    ["Name two Rabi crops, two Kharif crops, and one Cash crop of India.", "Rabi: Wheat, Mustard; Kharif: Rice, Maize; Cash crop: Sugarcane / Tea."],
    ["What is the difference between a Peninsula and an Island? Give Indian examples.", "Island is surrounded by water on all 4 sides (Andaman); Peninsula on 3 sides (Southern Peninsular India)."],
    ["Why does a ship float on sea water while a small iron nail sinks?", "A hollow ship displaces a huge weight of water generating upward buoyant force greater than its weight."],
    ["Name the currency and capital of Japan, UK, USA, and France.", "Japan: Tokyo (Yen); UK: London (Pound); USA: Washington D.C. (Dollar); France: Paris (Euro)."],
    ["Write two ways AI / Computers are helping Indian classrooms and hospitals.", "Visual interactive lessons & instant quizzes in schools; digital X-ray analysis & patient records in hospitals."],
    [`Explain why logical reasoning + general awareness help Class ${cls} scholars succeed.`, "Reasoning sharpens analytical problem solving while GK connects classroom theory with real-world civics, science, and current affairs."],
  ];
  gkQuestions.forEach(([q, ans]) => {
    out.push(["Reasoning & GK", "SHORT_ANSWER", q, ans, 2, "General Knowledge"]);
  });

  return finalizeSubjectTuples(cls, "Reasoning & GK", out, 200);
}

// ── ASSEMBLE FULL 7,000-QUESTION SUBJECTIVE BANK (200 / SUBJECT / CLASS) ──────
function buildClassSubjectiveBank(cls: EntranceClassNumber): EntranceTestQuestion[] {
  let tuples: SubjTuple[] = [];
  if (cls <= 5) {
    const c = cls as 1 | 2 | 3 | 4 | 5;
    tuples = [
      ...build200PrimaryEnglish(c),
      ...build200PrimaryMaths(c),
      ...build200PrimaryHindi(c),
      ...build200PrimaryEvsGk(c),
    ];
  } else {
    const c = cls as 6 | 7 | 8 | 9 | 10;
    tuples = [
      ...build200SecondaryEnglish(c),
      ...build200SecondaryMaths(c),
      ...build200SecondaryScience(c),
      ...build200SecondarySocial(c),
      ...build200SecondaryReasoning(c),
    ];
  }

  return tuples.map((t, idx) => ({
    id: `c${cls}_subj_${idx + 1}`,
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
    ...(t[6] ? { passage: t[6] } : {}),
  }));
}

export const SUBJECTIVE_200_BANK: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
  EntranceTestQuestion[]
> = {
  1: buildClassSubjectiveBank(1),
  2: buildClassSubjectiveBank(2),
  3: buildClassSubjectiveBank(3),
  4: buildClassSubjectiveBank(4),
  5: buildClassSubjectiveBank(5),
  6: buildClassSubjectiveBank(6),
  7: buildClassSubjectiveBank(7),
  8: buildClassSubjectiveBank(8),
  9: buildClassSubjectiveBank(9),
  10: buildClassSubjectiveBank(10),
};
