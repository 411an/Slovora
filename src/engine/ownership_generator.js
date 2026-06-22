import { srTextFromLatin } from "./serbian_script.js";

export const OWNERSHIP_FORM_KEYS = [
  "nom_sg_m",
  "gen_sg_m",
  "dat_sg_m",
  "acc_sg_m",
  "acc_sg_m_anim",
  "voc_sg_m",
  "ins_sg_m",
  "loc_sg_m",
  "nom_sg_f",
  "gen_sg_f",
  "dat_sg_f",
  "acc_sg_f",
  "voc_sg_f",
  "ins_sg_f",
  "loc_sg_f",
  "nom_sg_n",
  "gen_sg_n",
  "dat_sg_n",
  "acc_sg_n",
  "voc_sg_n",
  "ins_sg_n",
  "loc_sg_n",
  "nom_pl_m",
  "gen_pl_m",
  "dat_pl_m",
  "acc_pl_m",
  "voc_pl_m",
  "ins_pl_m",
  "loc_pl_m",
  "nom_pl_f",
  "gen_pl_f",
  "dat_pl_f",
  "acc_pl_f",
  "voc_pl_f",
  "ins_pl_f",
  "loc_pl_f",
  "nom_pl_n",
  "gen_pl_n",
  "dat_pl_n",
  "acc_pl_n",
  "voc_pl_n",
  "ins_pl_n",
  "loc_pl_n",
];

const CASE_TO_NOUN_FORM = {
  nom: { sg: "nom_sg", pl: "nom_pl" },
};

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

function getNativeForm(entry, formKey) {
  if (!entry?.forms) return entry?.label || "";
  return entry.forms[formKey] || entry.forms.default || entry.label || "";
}

function getSerbianForm(entry, formKey, script) {
  const lat = entry?.forms?.[formKey] || "";
  return srTextFromLatin(lat, script);
}

function uniqueByText(options) {
  const byText = new Map();
  for (const option of options) {
    const key = option.text.toLowerCase().trim();
    if (!key) continue;

    const existing = byText.get(key);
    if (
      !existing ||
      (option.isCorrect && !existing.isCorrect) ||
      (option.isExpected && !existing.isExpected)
    ) {
      byText.set(key, option);
    }
  }
  return Array.from(byText.values());
}

function takeOptions(correctOption, candidates, targetCount) {
  const unique = uniqueByText([correctOption, ...shuffle(candidates)]);
  const correctText = correctOption.text.toLowerCase().trim();
  const withCorrectFirst = [
    ...unique.filter((option) => option.text.toLowerCase().trim() === correctText).slice(0, 1),
    ...unique.filter((option) => option.text.toLowerCase().trim() !== correctText),
  ];
  return shuffle(withCorrectFirst.slice(0, targetCount));
}

export function getAgreementKey({ caseKey = "nom", number, gender, animate = false }) {
  if (caseKey === "acc" && number === "sg" && gender === "m" && animate) {
    return "acc_sg_m_anim";
  }
  return `${caseKey}_${number}_${gender}`;
}

export function getOwnershipSignature(round) {
  return [
    round.caseKey,
    round.number,
    round.noun.id,
    round.owner.id,
    round.agreementKey,
  ].join("|");
}

export function getOwnershipCandidates(lexicon, promptBuilder) {
  return lexicon.query({
    type: "noun",
    subtype: "common",
    custom: (entry) => {
      const concept = promptBuilder.getConcept(entry.conceptId);
      const nativeSg = concept?.forms?.sg?.trim().toLowerCase();
      const nativePl = concept?.forms?.pl?.trim().toLowerCase();
      return Boolean(
        entry.grammar?.gender &&
        entry.forms?.nom_sg?.cyr &&
        entry.forms?.nom_sg?.lat &&
        entry.forms?.nom_pl?.cyr &&
        entry.forms?.nom_pl?.lat &&
        nativeSg &&
        nativePl &&
        nativeSg !== nativePl
      );
    },
  });
}

function buildQuestionOptions(question, correctFormKey, script, targetCount) {
  const correctText = getSerbianForm(question, correctFormKey, script);
  const correct = {
    kind: "question",
    id: `question:${correctFormKey}:${correctText.toLowerCase()}`,
    formKey: correctFormKey,
    text: correctText,
    buttonText: `${correctText}?`,
    isCorrect: true,
    isExpected: true,
  };
  const candidates = Object.entries(question.forms).map(([formKey]) => {
    const text = getSerbianForm(question, formKey, script);
    return {
      kind: "question",
      id: `question:${formKey}:${text.toLowerCase()}`,
      formKey,
      text,
      buttonText: `${text}?`,
      isCorrect: formKey === correctFormKey && text.toLowerCase() === correctText.toLowerCase(),
    };
  });
  return takeOptions(correct, candidates, targetCount);
}

function buildOwnerOptions(srOwners, correctOwner, correctFormKey, script, targetCount) {
  const correctText = getSerbianForm(correctOwner, correctFormKey, script);
  const correct = {
    kind: "owner",
    id: `owner:${correctOwner.id}:${correctFormKey}:${correctText.toLowerCase()}`,
    ownerId: correctOwner.id,
    formKey: correctFormKey,
    text: correctText,
    buttonText: correctText,
    isCorrect: true,
    isExpected: true,
  };
  const sameOwnerForms = Object.entries(correctOwner.forms).map(([formKey]) => {
    const text = getSerbianForm(correctOwner, formKey, script);
    return {
      kind: "owner",
      id: `owner:${correctOwner.id}:${formKey}:${text.toLowerCase()}`,
      ownerId: correctOwner.id,
      formKey,
      text,
      buttonText: text,
      isCorrect: formKey === correctFormKey && text.toLowerCase() === correctText.toLowerCase(),
    };
  });

  const sameOwnerOptions = takeOptions(correct, sameOwnerForms, targetCount);
  if (sameOwnerOptions.length >= targetCount) return sameOwnerOptions;

  const fallbackForms = srOwners
    .filter((owner) => owner.id !== correctOwner.id)
    .flatMap((owner) => Object.entries(owner.forms).map(([formKey]) => {
      const text = getSerbianForm(owner, formKey, script);
      return {
        kind: "owner",
        id: `owner:${owner.id}:${formKey}:${text.toLowerCase()}`,
        ownerId: owner.id,
        formKey,
        text,
        buttonText: text,
        isCorrect: false,
      };
    }));

  return takeOptions(correct, [...sameOwnerForms, ...fallbackForms], targetCount);
}

function buildNounOptions(noun, correctFormKey, script, targetCount) {
  const correctText = noun.forms[correctFormKey]?.[script] || "";
  const correct = {
    kind: "noun",
    id: `noun:${noun.id}:${correctFormKey}:${correctText.toLowerCase()}`,
    nounId: noun.id,
    formKey: correctFormKey,
    text: correctText,
    buttonText: correctText,
    isCorrect: true,
    isExpected: true,
  };
  const candidates = Object.entries(noun.forms).map(([formKey, form]) => {
    const text = form?.[script] || "";
    return {
      kind: "noun",
      id: `noun:${noun.id}:${formKey}:${text.toLowerCase()}`,
      nounId: noun.id,
      text,
      buttonText: text,
      isCorrect: formKey === correctFormKey && text.toLowerCase() === correctText.toLowerCase(),
      formKey,
    };
  });
  return takeOptions(correct, candidates, targetCount);
}

function buildNativePrompt({ nativeData, nativeOwner, nativeConcept, formKey, number }) {
  const nounText = nativeConcept.forms[number] || nativeConcept.labels?.default || "";
  const questionText = getNativeForm(nativeData.question, formKey);
  const ownerText = getNativeForm(nativeOwner, formKey);
  const clarifier = nativeOwner.clarifier ? ` (${nativeOwner.clarifier})` : "";

  return {
    question: `${capitalize(questionText)} ${nounText}?`,
    answer: `${capitalize(ownerText)} ${nounText}${clarifier}.`,
  };
}

export function generateOwnershipRound({
  lexicon,
  promptBuilder,
  settings,
  srData,
  nativeData,
  previousSignature = "",
  maxAttempts = 12,
}) {
  const candidates = getOwnershipCandidates(lexicon, promptBuilder);
  const srOwners = srData.owners || [];
  const nativeOwners = nativeData.owners || [];

  if (!candidates.length) throw new Error("No ownership noun candidates");
  if (!srOwners.length || !nativeOwners.length) throw new Error("No ownership owner data");

  let round = null;
  let signature = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const script = chooseScript(settings);
    const caseKey = "nom";
    const number = Math.random() < 0.5 ? "sg" : "pl";
    const noun = pickRandom(candidates);
    const nativeConcept = promptBuilder.getConcept(noun.conceptId);
    const nativeOwner = pickRandom(nativeOwners);
    const srOwner = srOwners.find((owner) => owner.id === nativeOwner.srOwnerId);
    if (!srOwner) throw new Error(`Missing Serbian owner data: ${nativeOwner.srOwnerId}`);

    const gender = noun.grammar.gender;
    const animate = Boolean(noun.grammar.animate);
    const agreementKey = getAgreementKey({ caseKey, number, gender, animate });
    const nounFormKey = CASE_TO_NOUN_FORM[caseKey]?.[number];

    const expected = {
      question: {
        text: getSerbianForm(srData.question, agreementKey, script),
      },
      owner: {
        text: getSerbianForm(srOwner, agreementKey, script),
      },
      noun: {
        text: noun.forms[nounFormKey]?.[script] || "",
      },
    };

    const verb = srTextFromLatin(number === "pl" ? "su" : "je", script);
    const to = srTextFromLatin("to", script);
    const nativePrompt = buildNativePrompt({
      nativeData,
      nativeOwner,
      nativeConcept,
      formKey: agreementKey,
      number,
    });

    round = {
      templateId: "ownership",
      script,
      caseKey,
      number,
      agreementKey,
      nounFormKey,
      verb,
      to,
      noun,
      owner: nativeOwner,
      srOwner,
      nativePrompt,
      expected,
      options: {
        question: buildQuestionOptions(srData.question, agreementKey, script, 5),
        owner: buildOwnerOptions(srOwners, srOwner, agreementKey, script, 5),
        noun: buildNounOptions(noun, nounFormKey, script, 5),
      },
    };

    signature = getOwnershipSignature(round);
    if (signature !== previousSignature) break;
  }

  return { round, signature };
}

export function checkOwnershipAnswer(round, selected) {
  return Boolean(
    selected?.question?.isCorrect &&
    selected?.owner?.isCorrect &&
    selected?.noun?.isCorrect &&
    selected.question.text === round.expected.question.text &&
    selected.owner.text === round.expected.owner.text &&
    selected.noun.text === round.expected.noun.text
  );
}
