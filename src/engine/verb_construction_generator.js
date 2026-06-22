import { srTextFromLatin } from "./serbian_script.js";

const SUBJECT_IDS = ["ja", "ti", "mi", "vi", "on", "ona", "oni", "one"];
const INTRO_TAG = "da_locative_intro";
const ACTION_TAG = "about_locative";
const DEPENDENT_NOUN_TAG = "dependent_noun";
const TOTAL_OPTION_CARDS = 19;
const LOCATIVE_FORM = { sg: "loc_sg", pl: "loc_pl" };
const NOUN_DISTRACTOR_FORMS = [
  "nom_sg",
  "gen_sg",
  "dat_sg",
  "acc_sg",
  "ins_sg",
  "loc_sg",
  "nom_pl",
  "gen_pl",
  "dat_pl",
  "acc_pl",
  "ins_pl",
  "loc_pl",
];

const RU_INTRO = {
  voleti: {
    "1sg": "люблю",
    "2sg": "любишь",
    "3sg": "любит",
    "1pl": "любим",
    "2pl": "любите",
    "3pl": "любят",
  },
  želeti: {
    "1sg": "хочу",
    "2sg": "хочешь",
    "3sg": "хочет",
    "1pl": "хотим",
    "2pl": "хотите",
    "3pl": "хотят",
  },
};

const RU_ACTION = {
  pričati: "рассказывать",
  čitati: "читать",
  razgovarati: "разговаривать",
  pisati: "писать",
  znati: "знать",
  učiti: "узнавать",
};

const EN_ACTION = {
  pričati: "talk",
  čitati: "read",
  razgovarati: "talk",
  pisati: "write",
  znati: "know",
  učiti: "learn",
};

let cardCounter = 0;

function shuffle(arr) {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseScript(settings) {
  if (settings.scriptMode === "mixed") {
    return Math.random() < 0.5 ? "cyr" : "lat";
  }
  return settings.scriptMode || "cyr";
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function presentKeyForSubject(subject) {
  return `${subject.grammar.person}${subject.grammar.number}`;
}

function card({
  lexemeId,
  formKey,
  display,
  script,
  type,
  grammar = {},
  role,
  isExpected = false,
}) {
  cardCounter += 1;
  return {
    cardInstanceId: `verb_card_${cardCounter}`,
    lexemeId,
    formKey,
    display,
    language: "sr",
    script,
    type,
    role,
    grammar: { ...grammar },
    isExpected,
  };
}

function scriptForm(form, script) {
  return form?.[script] || "";
}

function makePronounCard(subject, script, isExpected = false) {
  return card({
    lexemeId: subject.id,
    formKey: "nom",
    display: scriptForm(subject.forms.nom, script),
    script,
    type: "pronoun",
    role: "subject",
    grammar: subject.grammar,
    isExpected,
  });
}

function makeVerbCard(verb, presentKey, script, role, isExpected = false) {
  const form = verb.forms?.present?.[presentKey];
  return card({
    lexemeId: verb.id,
    formKey: `present_${presentKey}`,
    display: scriptForm(form, script),
    script,
    type: "verb",
    role,
    grammar: {
      ...verb.grammar,
      person: Number(presentKey[0]),
      number: presentKey.slice(1),
    },
    isExpected,
  });
}

function makeParticleCard(id, text, script, isExpected = false) {
  return card({
    lexemeId: `particle:${id}`,
    formKey: "base",
    display: srTextFromLatin(text, script),
    script,
    type: "particle",
    role: id,
    isExpected,
  });
}

function makeNounCard(noun, formKey, script, isExpected = false) {
  return card({
    lexemeId: noun.id,
    formKey,
    display: scriptForm(noun.forms?.[formKey], script),
    script,
    type: "noun",
    role: "topic",
    grammar: noun.grammar,
    isExpected,
  });
}

function hasTag(entry, tag) {
  return entry?.tags?.includes(tag);
}

function getVerbsByTag(verbData, tag) {
  return (verbData?.verbs || []).filter((verb) => hasTag(verb, tag) && verb.forms?.present);
}

function getSubjectCandidates(lexicon) {
  return SUBJECT_IDS
    .map((id) => lexicon.byId.get(id))
    .filter((entry) => entry?.forms?.nom && entry.grammar?.person && entry.grammar?.number);
}

function getNativeText(concept, number) {
  return concept?.forms?.[number] || concept?.forms?.subject || concept?.labels?.default || "";
}

function russianAboutPreposition(word) {
  const lower = (word || "").trim().toLowerCase();
  if (/^[аеёиоуыэюя]/.test(lower)) return "об";
  return "о";
}

function russianLocativeTopic(concept, number) {
  const key = number === "pl" ? "loc_pl" : "loc_sg";
  const form = concept?.forms?.[key];
  if (!form) return "";
  return `${russianAboutPreposition(form)} ${form}`;
}

function getNounCandidates(lexicon, promptBuilder, number) {
  const locKey = LOCATIVE_FORM[number];
  return lexicon.query({
    type: "noun",
    subtype: "common",
    custom: (entry) => {
      if (hasTag(entry, DEPENDENT_NOUN_TAG)) return false;
      const concept = promptBuilder.getConcept(entry.conceptId);
      if (promptBuilder.language === "ru" && !russianLocativeTopic(concept, number)) return false;
      const native = getNativeText(concept, number).trim();
      const nativeSg = getNativeText(concept, "sg").trim().toLowerCase();
      const nativePl = getNativeText(concept, "pl").trim().toLowerCase();
      return Boolean(
        entry.forms?.[locKey]?.cyr &&
        entry.forms?.[locKey]?.lat &&
        native &&
        (number === "sg" || (nativePl && nativePl !== nativeSg))
      );
    },
  });
}

function buildNativePrompt({ promptBuilder, subject, introVerb, actionVerb, noun, number }) {
  const subjectConcept = promptBuilder.getConcept(subject.conceptId);
  const nounConcept = promptBuilder.getConcept(noun.conceptId);
  const subjectText = subjectConcept?.forms?.subject || subjectConcept?.labels?.default || subject.id;
  const nounText = getNativeText(nounConcept, number) || noun.id;
  const presentKey = presentKeyForSubject(subject);

  if (promptBuilder.language === "ru") {
    const introText = RU_INTRO[introVerb.id]?.[presentKey] || introVerb.labels?.ru || introVerb.id;
    const actionText = RU_ACTION[actionVerb.id] || actionVerb.labels?.ru || actionVerb.id;
    const locativeTopic = russianLocativeTopic(nounConcept, number);
    if (locativeTopic) {
      return `${capitalize(subjectText)} ${introText} ${actionText} ${locativeTopic}.`;
    }
    return `${capitalize(subjectText)} ${introText} ${actionText}. Тема: ${nounText}.`;
  }

  const is3sg = presentKey === "3sg";
  const introText = introVerb.id === "voleti"
    ? (is3sg ? "likes to" : "like to")
    : (is3sg ? "wants to" : "want to");
  const actionText = EN_ACTION[actionVerb.id] || actionVerb.labels?.en || actionVerb.id;
  return `${capitalize(subjectText)} ${introText} ${actionText} about ${nounText}.`;
}

function displayKey(option) {
  return option.display.trim().toLowerCase();
}

function takeUniqueCards(source, used, limit) {
  const accepted = [];
  for (const option of shuffle(source)) {
    const key = displayKey(option);
    if (!key || used.has(key)) continue;
    used.add(key);
    accepted.push(option);
    if (accepted.length >= limit) break;
  }
  return accepted;
}

function uniqueCards(expectedCards, distractorGroups, targetDistractors) {
  const used = new Set(expectedCards.map(displayKey));
  const accepted = [];

  for (const group of distractorGroups.primary) {
    accepted.push(...takeUniqueCards(group.cards, used, group.count));
  }

  if (accepted.length < targetDistractors) {
    accepted.push(
      ...takeUniqueCards(distractorGroups.overflow, used, targetDistractors - accepted.length)
    );
  }

  return shuffle([...expectedCards, ...accepted.slice(0, targetDistractors)]);
}

function buildDistractors({
  lexicon,
  promptBuilder,
  verbData,
  subject,
  introVerb,
  actionVerb,
  noun,
  number,
  presentKey,
  script,
  settings,
}) {
  const subjects = getSubjectCandidates(lexicon).filter((entry) => entry.id !== subject.id);
  const introVerbs = getVerbsByTag(verbData, INTRO_TAG);
  const actionVerbs = getVerbsByTag(verbData, ACTION_TAG);
  const nounCandidates = getNounCandidates(lexicon, promptBuilder, number);

  const pronounCards = subjects.map((item) => makePronounCard(item, script));
  const introFormCards = Object.keys(introVerb.forms.present)
    .filter((key) => key !== presentKey)
    .map((key) => makeVerbCard(introVerb, key, script, "intro"));
  const actionFormCards = Object.keys(actionVerb.forms.present)
    .filter((key) => key !== presentKey)
    .map((key) => makeVerbCard(actionVerb, key, script, "action"));
  const otherVerbCards = actionVerbs
    .filter((entry) => entry.id !== actionVerb.id)
    .map((item) => makeVerbCard(item, presentKey, script, "action"));
  const nounFormCards = NOUN_DISTRACTOR_FORMS
    .filter((key) => key !== LOCATIVE_FORM[number] && noun.forms?.[key])
    .map((formKey) => makeNounCard(noun, formKey, script));
  const otherNounCards = nounCandidates
    .filter((entry) => entry.id !== noun.id)
    .map((item) => makeNounCard(item, LOCATIVE_FORM[number], script));

  return {
    primary: [
      { count: 3, cards: pronounCards },
      { count: 2, cards: introFormCards },
      { count: 2, cards: actionFormCards },
      { count: 2, cards: otherVerbCards },
      { count: 2, cards: nounFormCards },
      { count: 2, cards: otherNounCards },
    ],
    overflow: [
      ...pronounCards,
      ...introFormCards,
      ...actionFormCards,
      ...otherVerbCards,
      ...nounFormCards,
      ...otherNounCards,
    ],
  };
}

function validVerbPair(introVerb, actionVerb) {
  return !(introVerb.id === "voleti" && actionVerb.id === "znati");
}

export function getVerbConstructionSignature(round) {
  return [
    round.subject.id,
    round.introVerb.id,
    round.actionVerb.id,
    round.noun.id,
    round.number,
  ].join("|");
}

export function generateVerbConstructionRound({
  lexicon,
  promptBuilder,
  settings,
  verbData,
  previousSignature = "",
  maxAttempts = 16,
}) {
  const subjects = getSubjectCandidates(lexicon);
  const introVerbs = getVerbsByTag(verbData, INTRO_TAG);
  const actionVerbs = getVerbsByTag(verbData, ACTION_TAG);

  if (!subjects.length) throw new Error("No subject pronouns for verb construction");
  if (!introVerbs.length) throw new Error("No da-locative intro verbs");
  if (!actionVerbs.length) throw new Error("No about-locative action verbs");

  let round = null;
  let signature = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const script = chooseScript(settings);
    const subject = pickRandom(subjects);
    const presentKey = presentKeyForSubject(subject);
    const introCandidates = shuffle(introVerbs);
    const actionCandidates = shuffle(actionVerbs);
    const introVerb = pickRandom(introCandidates);
    const actionVerb = pickRandom(actionCandidates.filter((verb) => validVerbPair(introVerb, verb)));
    const number = Math.random() < 0.5 ? "sg" : "pl";
    const nounCandidates = getNounCandidates(lexicon, promptBuilder, number);
    const noun = pickRandom(nounCandidates);

    if (!subject || !introVerb || !actionVerb || !noun) continue;
    if (!introVerb.forms?.present?.[presentKey] || !actionVerb.forms?.present?.[presentKey]) continue;

    const expectedCards = [
      makePronounCard(subject, script, true),
      makeVerbCard(introVerb, presentKey, script, "intro", true),
      makeParticleCard("da", "da", script, true),
      makeVerbCard(actionVerb, presentKey, script, "action", true),
      makeParticleCard("o", "o", script, true),
      makeNounCard(noun, LOCATIVE_FORM[number], script, true),
    ];
    const distractors = buildDistractors({
      lexicon,
      promptBuilder,
      verbData,
      subject,
      introVerb,
      actionVerb,
      noun,
      number,
      presentKey,
      script,
      settings,
    });

    round = {
      templateId: "verb-construction",
      script,
      subject,
      introVerb,
      actionVerb,
      noun,
      number,
      presentKey,
      expectedCards,
      cards: uniqueCards(expectedCards, distractors, TOTAL_OPTION_CARDS - expectedCards.length),
      prompt: buildNativePrompt({
        promptBuilder,
        subject,
        introVerb,
        actionVerb,
        noun,
        number,
      }),
      instruction: {
        ru: "Собери сербскую фразу с da и o + локатив.",
        en: "Build the Serbian sentence with da and o + locative.",
      },
      defaultHelpTable: "sr.verbs.present.patterns",
      availableHelpTables: [
        "sr.verbs.present.patterns",
        "sr.nouns.locative.basic",
        "sr.nouns.plural.full",
      ],
    };

    signature = getVerbConstructionSignature(round);
    if (signature !== previousSignature) break;
  }

  if (!round) throw new Error("Could not generate verb construction round");
  return { round, signature };
}
