/**
 * Slovora Test Runner
 * Validates exercise generation and answer checking against grammar rules.
 * Run: node tests/test_runner.js
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Import engine modules ────────────────────────────────────────
import { Lexicon } from "../src/engine/lexicon.js";
import {
  generateExerciseAvoidingRepeat,
  getExerciseSignature,
  getTemplateIds
} from "../src/engine/generator.js";
import { checkAnswer } from "../src/engine/checker.js";
import { resetCardCounter } from "../src/engine/card.js";
import { PromptBuilder } from "../src/engine/prompt_builder.js";
import {
  checkOwnershipAnswer,
  generateOwnershipRound,
  getOwnershipSignature
} from "../src/engine/ownership_generator.js";
import {
  generateVerbConstructionRound,
  getVerbConstructionSignature
} from "../src/engine/verb_construction_generator.js";

// Node.js fetch mock for local files
global.fetch = async (url) => {
  const filePath = join(ROOT, url);
  const data = readFileSync(filePath, "utf-8");
  return {
    json: async () => JSON.parse(data)
  };
};

// ── Config ───────────────────────────────────────────────────────
const EXERCISES_PER_TEMPLATE = 50;
const OWNERSHIP_EXERCISES = 50;
const VERB_CONSTRUCTION_EXERCISES = 50;
const SETTINGS_VARIANTS = [
  { scriptMode: "cyr", difficulty: "easy", nativeLanguage: "ru" },
  { scriptMode: "lat", difficulty: "hard", nativeLanguage: "ru" },
  { scriptMode: "mixed", difficulty: "hard", nativeLanguage: "en" },
];

// ── Grammar validation rules ────────────────────────────────────

function validateBitiPerson(exercise, lexicon) {
  // Rule 1: biti form person/number must match the pronoun
  const exp = exercise.expectedCards;
  const bitiCard = exp.find((c) => c.lexemeId === "biti");
  const pronounCard = exp.find((c) => c.type === "pronoun");
  if (!bitiCard || !pronounCard) return null; // not applicable

  const bitiForm = lexicon.getFormObject("biti", bitiCard.formKey);
  if (!bitiForm?.grammar) return null;

  const pG = pronounCard.grammar;
  const bG = bitiForm.grammar;

  if (bG.person !== pG.person || bG.number !== pG.number) {
    return `Biti ${bitiCard.formKey} (${bG.person}${bG.number}) != pronoun ${pronounCard.lexemeId} (${pG.person}${pG.number})`;
  }
  return null;
}

function validateGenderAgreement(exercise, lexicon) {
  // Rule 2: if pronoun is 3rd person with gender, predicate gender must match
  const exp = exercise.expectedCards;
  const pronounCard = exp.find((c) => c.type === "pronoun");
  if (!pronounCard) return null;

  const pG = pronounCard.grammar;
  if (pG.person !== 3 || !pG.gender) return null;

  const nounCard = exp.find((c) => c.type === "noun");
  if (!nounCard) return null;

  const nounLex = lexicon.byId.get(nounCard.lexemeId);
  if (!nounLex) return null;

  if (nounLex.grammar?.gender !== pG.gender) {
    return `Pronoun ${pronounCard.lexemeId} gender=${pG.gender}, noun ${nounCard.lexemeId} gender=${nounLex.grammar?.gender}`;
  }
  return null;
}

function validateNumberForm(exercise, lexicon) {
  // Rule 3: noun form must match number (sg->nom_sg, pl->nom_pl)
  const exp = exercise.expectedCards;
  const pronounCard = exp.find((c) => c.type === "pronoun");
  const nounCard = exp.find((c) => c.type === "noun");
  if (!pronounCard || !nounCard) return null;

  const expectedForm = pronounCard.grammar.number === "pl" ? "nom_pl" : "nom_sg";
  if (nounCard.formKey !== expectedForm) {
    return `Pronoun number=${pronounCard.grammar.number}, but noun form=${nounCard.formKey} (expected ${expectedForm})`;
  }
  return null;
}

function validateSemantics(exercise, lexicon) {
  // Rule 4: semantic compatibility
  const tid = exercise.templateId;
  const nounCard = exercise.expectedCards.find((c) => c.type === "noun");
  if (!nounCard) return null;

  const nounLex = lexicon.byId.get(nounCard.lexemeId);
  if (!nounLex?.semantics?.canPredicateFor) return null;

  const cpf = nounLex.semantics.canPredicateFor;

  if (tid === "biti-short-basic" || tid === "da-li-question" || tid === "short-answer" || tid === "full-answer") {
    if (!cpf.includes("human_subject")) {
      return `Noun ${nounCard.lexemeId} canPredicateFor=[${cpf}] but template requires human_subject`;
    }
  }
  if (tid === "demonstrative-basic") {
    if (!cpf.includes("demonstrative_subject")) {
      return `Noun ${nounCard.lexemeId} canPredicateFor=[${cpf}] but template requires demonstrative_subject`;
    }
  }
  return null;
}

function validateNoGarbage(exercise, lexicon) {
  // Rule 5: no semantically absurd sentences (human pronoun + object noun)
  const exp = exercise.expectedCards;
  const pronounCard = exp.find((c) => c.type === "pronoun");
  const nounCard = exp.find((c) => c.type === "noun");
  if (!pronounCard || !nounCard) return null;

  const nounLex = lexicon.byId.get(nounCard.lexemeId);
  if (!nounLex?.semantics) return null;

  // Personal pronoun + object/substance = garbage
  if (pronounCard.type === "pronoun" && nounLex.semantics.semanticClass === "object") {
    return `Garbage: ${pronounCard.display} + ${nounCard.display} (person + object)`;
  }
  return null;
}

function validateDistractors(exercise) {
  // Rule 6: no distractor duplicates the correct answer
  const expIds = new Set(exercise.expectedCards.map((c) => `${c.lexemeId}:${c.formKey}`));
  const distractors = exercise.cards.filter(
    (c) => !exercise.expectedCards.some((e) => e.cardInstanceId === c.cardInstanceId)
  );
  for (const d of distractors) {
    if (expIds.has(`${d.lexemeId}:${d.formKey}`)) {
      return `Distractor duplicates answer: ${d.lexemeId}:${d.formKey}`;
    }
  }
  return null;
}

const RULES = [
  { name: "R1: Biti person/number", fn: validateBitiPerson },
  { name: "R2: Gender agreement", fn: validateGenderAgreement },
  { name: "R3: Number form", fn: validateNumberForm },
  { name: "R4: Semantics", fn: validateSemantics },
  { name: "R5: No garbage", fn: validateNoGarbage },
  { name: "R6: Distractor uniqueness", fn: validateDistractors },
];

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ownershipSentence(round) {
  return `${capitalize(round.expected.question.text)} ${round.verb} ${round.to} ${round.expected.noun.text}? ` +
    `${capitalize(round.to)} ${round.verb} ${round.expected.owner.text} ${round.expected.noun.text}.`;
}

function validateOwnershipOptions(round) {
  const errors = [];

  for (const [kind, options] of Object.entries(round.options)) {
    const displayKeys = options.map((option) => (option.buttonText || option.text).toLowerCase().trim());
    const uniqueKeys = new Set(displayKeys);
    if (uniqueKeys.size !== displayKeys.length) {
      errors.push({
        rule: "Ownership option uniqueness",
        error: `${kind} options contain duplicate display values`,
      });
    }

    const correctCount = options.filter((option) => option.isCorrect).length;
    if (correctCount !== 1) {
      errors.push({
        rule: "Ownership correct option count",
        error: `${kind} has ${correctCount} correct options`,
      });
    }

    const expectedText = round.expected[kind].text.toLowerCase().trim();
    const expectedTextMatches = options.filter((option) => option.text.toLowerCase().trim() === expectedText);
    if (expectedTextMatches.length !== 1) {
      errors.push({
        rule: "Ownership expected text uniqueness",
        error: `${kind} has ${expectedTextMatches.length} visible matches for ${round.expected[kind].text}`,
      });
    } else if (!expectedTextMatches[0].isCorrect) {
      errors.push({
        rule: "Ownership expected text priority",
        error: `${kind} kept a non-answer duplicate for ${round.expected[kind].text}`,
      });
    }

    const expectedFormKey = kind === "noun" ? round.nounFormKey : round.agreementKey;
    if (expectedTextMatches.length === 1 && expectedTextMatches[0].formKey !== expectedFormKey) {
      errors.push({
        rule: "Ownership expected form priority",
        error: `${kind} kept ${expectedTextMatches[0].formKey}, expected ${expectedFormKey}`,
      });
    }

    if (kind === "owner") {
      const sameOwnerCount = options.filter((option) => option.ownerId === round.srOwner.id).length;
      if (sameOwnerCount < Math.min(3, options.length)) {
        errors.push({
          rule: "Ownership owner-form spread",
          error: `owner column has only ${sameOwnerCount} forms for ${round.srOwner.id}`,
        });
      }
    }
  }

  return errors;
}

function validateVerbConstructionRound(round, verbData, lexicon) {
  const errors = [];
  const verbsById = new Map((verbData.verbs || []).map((verb) => [verb.id, verb]));
  const expected = round.expectedCards;

  if (expected.length !== 6) {
    errors.push({
      rule: "Verb construction expected length",
      error: `expected ${expected.length} cards instead of 6`,
    });
  }

  const expectedShape = [
    ["pronoun", "subject"],
    ["verb", "intro"],
    ["particle", "da"],
    ["verb", "action"],
    ["particle", "o"],
    ["noun", "topic"],
  ];
  for (let i = 0; i < Math.min(expected.length, expectedShape.length); i++) {
    const [type, role] = expectedShape[i];
    if (expected[i].type !== type || expected[i].role !== role) {
      errors.push({
        rule: "Verb construction expected shape",
        error: `slot ${i} has ${expected[i].type}/${expected[i].role}, expected ${type}/${role}`,
      });
    }
  }

  const displays = round.cards.map((card) => card.display.toLowerCase().trim());
  if (round.cards.length !== 19) {
    errors.push({
      rule: "Verb construction card count",
      error: `round has ${round.cards.length} cards instead of 19`,
    });
  }
  if (new Set(displays).size !== displays.length) {
    errors.push({
      rule: "Verb construction option uniqueness",
      error: "cards contain duplicate visible values",
    });
  }

  const expectedIds = new Set(expected.map((card) => card.cardInstanceId));
  const distractors = round.cards.filter((card) => !expectedIds.has(card.cardInstanceId));
  if (distractors.length === 0) {
    errors.push({
      rule: "Verb construction distractors",
      error: "round has no distractors",
    });
  }
  if (!distractors.some((card) => card.type === "verb") || !distractors.some((card) => card.type === "noun")) {
    errors.push({
      rule: "Verb construction distractor spread",
      error: "round must include verb and noun distractors",
    });
  }
  if (distractors.filter((card) => card.type === "pronoun").length < 3) {
    errors.push({
      rule: "Verb construction pronoun spread",
      error: "round must include at least 3 pronoun distractors",
    });
  }
  if (distractors.filter((card) => card.type === "verb" && card.role === "intro" && card.lexemeId === round.introVerb.id).length < 2) {
    errors.push({
      rule: "Verb construction intro-form spread",
      error: "round must include at least 2 form distractors for the intro verb",
    });
  }
  if (distractors.filter((card) => card.type === "verb" && card.role === "action" && card.lexemeId === round.actionVerb.id).length < 2) {
    errors.push({
      rule: "Verb construction action-form spread",
      error: "round must include at least 2 form distractors for the action verb",
    });
  }
  if (distractors.filter((card) => card.type === "verb" && card.role === "action" && card.lexemeId !== round.actionVerb.id).length < 2) {
    errors.push({
      rule: "Verb construction other-verb spread",
      error: "round must include at least 2 other action verb distractors",
    });
  }
  if (distractors.filter((card) => card.type === "noun").length < 2) {
    errors.push({
      rule: "Verb construction noun spread",
      error: "round must include noun distractors",
    });
  }

  for (const card of round.cards.filter((item) => item.type === "verb")) {
    const verb = verbsById.get(card.lexemeId);
    if (!verb) {
      errors.push({
        rule: "Verb construction verb lookup",
        error: `missing verb data for ${card.lexemeId}`,
      });
      continue;
    }
    const neededTag = card.role === "intro" ? "da_locative_intro" : "about_locative";
    if (!verb.tags?.includes(neededTag)) {
      errors.push({
        rule: "Verb construction verb tag",
        error: `${card.lexemeId}/${card.role} lacks ${neededTag}`,
      });
    }
  }

  const nounCard = expected.find((card) => card.type === "noun");
  const expectedNounForm = round.number === "pl" ? "loc_pl" : "loc_sg";
  if (nounCard?.formKey !== expectedNounForm) {
    errors.push({
      rule: "Verb construction locative noun",
      error: `noun form ${nounCard?.formKey}, expected ${expectedNounForm}`,
    });
  }
  const nounLex = nounCard ? lexicon.byId.get(nounCard.lexemeId) : null;
  if (nounLex?.tags?.includes("dependent_noun")) {
    errors.push({
      rule: "Verb construction independent noun",
      error: `noun ${nounCard.lexemeId} is tagged dependent_noun`,
    });
  }

  if (round.introVerb.id === "voleti" && round.actionVerb.id === "znati") {
    errors.push({
      rule: "Verb construction semantic pair",
      error: "voleti da znati is not allowed",
    });
  }

  return errors;
}

// ── Main ─────────────────────────────────────────────────────────

function validateStaticLexiconData(lexicon) {
  const errors = [];
  const bottle = lexicon.byId.get("flasa");
  if (bottle) {
    const expected = {
      nom_sg: ["флаша", "flaša"],
      nom_pl: ["флаше", "flaše"],
    };
    for (const [formKey, [cyr, lat]] of Object.entries(expected)) {
      const form = bottle.forms?.[formKey];
      if (form?.cyr !== cyr || form?.lat !== lat) {
        errors.push(`flasa.${formKey} is ${form?.cyr}/${form?.lat}, expected ${cyr}/${lat}`);
      }
    }
  }
  return errors;
}

function validateNativeOwnerData(nativeDataByLang) {
  const errors = [];
  for (const [lang, data] of Object.entries(nativeDataByLang)) {
    const seen = new Map();
    for (const owner of data.owners || []) {
      const previous = seen.get(owner.srOwnerId);
      if (previous) {
        errors.push(`${lang} owners duplicate srOwnerId ${owner.srOwnerId}: ${previous} and ${owner.id}`);
      }
      seen.set(owner.srOwnerId, owner.id);
    }
  }
  return errors;
}

async function main() {
  console.log("=== Slovora Test Runner ===\n");

  // Load lexicon
  const lexData = JSON.parse(readFileSync(join(ROOT, "data/languages/sr/lexicon.json"), "utf-8"));
  const lexicon = new Lexicon();
  await lexicon.load(lexData);
  console.log(`Lexicon loaded: ${lexicon.entries.length} entries\n`);

  const log = [];
  let totalPass = 0;
  let totalFail = 0;
  const failures = [];
  const previousSignatures = new Map();

  for (const error of validateStaticLexiconData(lexicon)) {
    totalFail++;
    failures.push({ tid: "static-data", error });
  }

  // Preload prompt builders
  const pb_ru = new PromptBuilder();
  await pb_ru.load("ru");
  const pb_en = new PromptBuilder();
  await pb_en.load("en");

  const verbData = JSON.parse(readFileSync(join(ROOT, "data/languages/sr/verbs.json"), "utf-8"));
  const templates = getTemplateIds();

  for (const tid of templates) {
    console.log(`--- Template: ${tid} ---`);
    let tPass = 0;
    let tFail = 0;

    for (const settings of SETTINGS_VARIANTS) {
      const count = Math.ceil(EXERCISES_PER_TEMPLATE / SETTINGS_VARIANTS.length);

      for (let i = 0; i < count; i++) {
        resetCardCounter();

        let exercise;
        let exerciseSignature;
        try {
          const pb = settings.nativeLanguage === "en" ? pb_en : pb_ru;
          const signatureKey = `${tid}:${settings.nativeLanguage}:${settings.scriptMode}:${settings.difficulty}`;
          const previousSignature = previousSignatures.get(signatureKey);
          const result = generateExerciseAvoidingRepeat(
            tid,
            lexicon,
            pb,
            settings,
            previousSignature
          );
          exercise = result.exercise;
          exerciseSignature = result.signature || getExerciseSignature(exercise);
          previousSignatures.set(signatureKey, exerciseSignature);
          if (previousSignature && exerciseSignature === previousSignature) {
            tFail++;
            totalFail++;
            failures.push({ tid, settings, error: "Immediate repeat generated" });
            continue;
          }
        } catch (err) {
          tFail++;
          totalFail++;
          failures.push({ tid, settings, error: `Generation error: ${err.message}` });
          continue;
        }

        const sentence = exercise.expectedCards.map((c) => c.display).join(" ");

        // Test 1: correct answer must be accepted
        const correctResult = checkAnswer(exercise, exercise.expectedCards);
        const correctAccepted = correctResult.correct === true;

        // Test 2: wrong answers must be rejected
        const wrongTests = [];

        // 2a: reversed order
        if (exercise.expectedCards.length > 1) {
          const reversed = [...exercise.expectedCards].reverse();
          const revResult = checkAnswer(exercise, reversed);
          wrongTests.push({
            answer: reversed.map((c) => c.display),
            checker_result: { correct: revResult.correct, errors: revResult.errors.map((e) => e.type) },
          });
        }

        // 2b: missing last card
        if (exercise.expectedCards.length > 1) {
          const incomplete = exercise.expectedCards.slice(0, -1);
          const incResult = checkAnswer(exercise, incomplete);
          wrongTests.push({
            answer: incomplete.map((c) => c.display),
            checker_result: { correct: incResult.correct, errors: incResult.errors.map((e) => e.type) },
          });
        }

        // Validate grammar rules
        const ruleResults = [];
        let exerciseOk = correctAccepted;

        for (const rule of RULES) {
          const err = rule.fn(exercise, lexicon);
          if (err) {
            exerciseOk = false;
            ruleResults.push({ rule: rule.name, error: err });
          }
        }

        // Check wrong answers were rejected
        for (const wt of wrongTests) {
          if (wt.checker_result.correct) {
            exerciseOk = false;
            ruleResults.push({ rule: "Wrong answer accepted", error: JSON.stringify(wt) });
          }
        }

        if (!correctAccepted) {
          exerciseOk = false;
          ruleResults.push({ rule: "Correct answer rejected", error: "checker returned false for correct answer" });
        }

        if (exerciseOk) {
          tPass++;
          totalPass++;
        } else {
          tFail++;
          totalFail++;
          failures.push({ tid, settings: { ...settings }, sentence, errors: ruleResults });
        }

        // Log entry
        log.push({
          timestamp: new Date().toISOString(),
          templateId: tid,
          script: exercise.script,
          native_language: settings.nativeLanguage,
          native_prompt: exercise.prompt,
          exercise_signature: exerciseSignature,
          difficulty: settings.difficulty,
          generated_sentence: sentence,
          expected_cards: exercise.expectedCards.map((c) => c.display),
          all_cards: exercise.cards.map((c) => c.display),
          correct_answer_accepted: correctAccepted,
          wrong_answers_tested: wrongTests,
          rule_violations: ruleResults,
        });
      }
    }

    const status = tFail === 0 ? "PASS" : "FAIL";
    console.log(`  ${status} (${tPass} passed, ${tFail} failed)\n`);
  }

  const srOwnershipData = JSON.parse(readFileSync(join(ROOT, "data/languages/sr/possessives.json"), "utf-8"));
  const ownershipNativeData = {
    ru: JSON.parse(readFileSync(join(ROOT, "data/languages/native/ru/owners.json"), "utf-8")),
    en: JSON.parse(readFileSync(join(ROOT, "data/languages/native/en/owners.json"), "utf-8")),
  };
  for (const error of validateNativeOwnerData(ownershipNativeData)) {
    totalFail++;
    failures.push({ tid: "static-data", error });
  }

  console.log("--- Template: ownership ---");
  let ownershipPass = 0;
  let ownershipFail = 0;

  for (const settings of SETTINGS_VARIANTS) {
    const count = Math.ceil(OWNERSHIP_EXERCISES / SETTINGS_VARIANTS.length);

    for (let i = 0; i < count; i++) {
      let round;
      let roundSignature;
      const signatureKey = `ownership:${settings.nativeLanguage}:${settings.scriptMode}:${settings.difficulty}`;
      const previousSignature = previousSignatures.get(signatureKey);

      try {
        const pb = settings.nativeLanguage === "en" ? pb_en : pb_ru;
        const result = generateOwnershipRound({
          lexicon,
          promptBuilder: pb,
          settings,
          srData: srOwnershipData,
          nativeData: ownershipNativeData[settings.nativeLanguage],
          previousSignature,
        });
        round = result.round;
        roundSignature = result.signature || getOwnershipSignature(round);
        previousSignatures.set(signatureKey, roundSignature);

        if (previousSignature && roundSignature === previousSignature) {
          ownershipFail++;
          totalFail++;
          failures.push({ tid: "ownership", settings, error: "Immediate repeat generated" });
          continue;
        }
      } catch (err) {
        ownershipFail++;
        totalFail++;
        failures.push({ tid: "ownership", settings, error: `Generation error: ${err.message}` });
        continue;
      }

      const correctSelection = {
        question: round.options.question.find((option) => option.isCorrect),
        owner: round.options.owner.find((option) => option.isCorrect),
        noun: round.options.noun.find((option) => option.isCorrect),
      };

      const ruleResults = validateOwnershipOptions(round);
      const correctAccepted = checkOwnershipAnswer(round, correctSelection);
      if (!correctAccepted) {
        ruleResults.push({
          rule: "Ownership correct answer",
          error: "checker returned false for the generated correct selection",
        });
      }

      const wrongTests = [];
      for (const kind of ["question", "owner", "noun"]) {
        const wrongOption = round.options[kind].find((option) => !option.isCorrect);
        if (!wrongOption) continue;
        const wrongSelection = { ...correctSelection, [kind]: wrongOption };
        const wrongAccepted = checkOwnershipAnswer(round, wrongSelection);
        wrongTests.push({
          changed: kind,
          answer: {
            question: wrongSelection.question.text,
            owner: wrongSelection.owner.text,
            noun: wrongSelection.noun.text,
          },
          checker_result: { correct: wrongAccepted },
        });
        if (wrongAccepted) {
          ruleResults.push({
            rule: "Ownership wrong answer accepted",
            error: `${kind} distractor was accepted`,
          });
        }
      }

      const sentence = ownershipSentence(round);

      if (ruleResults.length === 0) {
        ownershipPass++;
        totalPass++;
      } else {
        ownershipFail++;
        totalFail++;
        failures.push({ tid: "ownership", settings: { ...settings }, sentence, errors: ruleResults });
      }

      log.push({
        timestamp: new Date().toISOString(),
        templateId: "ownership",
        script: round.script,
        native_language: settings.nativeLanguage,
        native_prompt: `${round.nativePrompt.question} ${round.nativePrompt.answer}`,
        exercise_signature: roundSignature,
        difficulty: settings.difficulty,
        generated_sentence: sentence,
        expected_cards: [
          round.expected.question.text,
          round.expected.owner.text,
          round.expected.noun.text,
        ],
        all_cards: [
          ...round.options.question.map((option) => option.buttonText || option.text),
          ...round.options.owner.map((option) => option.buttonText || option.text),
          ...round.options.noun.map((option) => option.buttonText || option.text),
        ],
        correct_answer_accepted: correctAccepted,
        wrong_answers_tested: wrongTests,
        rule_violations: ruleResults,
      });
    }
  }

  console.log(`  ${ownershipFail === 0 ? "PASS" : "FAIL"} (${ownershipPass} passed, ${ownershipFail} failed)\n`);

  console.log("--- Template: verb-construction ---");
  let verbPass = 0;
  let verbFail = 0;

  for (const settings of SETTINGS_VARIANTS) {
    const count = Math.ceil(VERB_CONSTRUCTION_EXERCISES / SETTINGS_VARIANTS.length);

    for (let i = 0; i < count; i++) {
      let round;
      let roundSignature;
      const signatureKey = `verb-construction:${settings.nativeLanguage}:${settings.scriptMode}:${settings.difficulty}`;
      const previousSignature = previousSignatures.get(signatureKey);

      try {
        const pb = settings.nativeLanguage === "en" ? pb_en : pb_ru;
        const result = generateVerbConstructionRound({
          lexicon,
          promptBuilder: pb,
          settings,
          verbData,
          previousSignature,
        });
        round = result.round;
        roundSignature = result.signature || getVerbConstructionSignature(round);
        previousSignatures.set(signatureKey, roundSignature);

        if (previousSignature && roundSignature === previousSignature) {
          verbFail++;
          totalFail++;
          failures.push({ tid: "verb-construction", settings, error: "Immediate repeat generated" });
          continue;
        }
      } catch (err) {
        verbFail++;
        totalFail++;
        failures.push({ tid: "verb-construction", settings, error: `Generation error: ${err.message}` });
        continue;
      }

      const sentence = round.expectedCards.map((card) => card.display).join(" ");
      const correctResult = checkAnswer(round, round.expectedCards);
      const correctAccepted = correctResult.correct === true;
      const ruleResults = validateVerbConstructionRound(round, verbData, lexicon);
      if (settings.nativeLanguage === "ru" && round.prompt.includes("Тема:")) {
        ruleResults.push({
          rule: "Verb construction Russian locative prompt",
          error: "Russian prompt fell back to topic label instead of locative phrase",
        });
      }

      const wrongTests = [];
      if (round.expectedCards.length > 1) {
        const reversed = [...round.expectedCards].reverse();
        const revResult = checkAnswer(round, reversed);
        wrongTests.push({
          answer: reversed.map((card) => card.display),
          checker_result: { correct: revResult.correct, errors: revResult.errors.map((err) => err.type) },
        });
        if (revResult.correct) {
          ruleResults.push({
            rule: "Verb construction wrong answer accepted",
            error: "reversed answer was accepted",
          });
        }

        const incomplete = round.expectedCards.slice(0, -1);
        const incResult = checkAnswer(round, incomplete);
        wrongTests.push({
          answer: incomplete.map((card) => card.display),
          checker_result: { correct: incResult.correct, errors: incResult.errors.map((err) => err.type) },
        });
        if (incResult.correct) {
          ruleResults.push({
            rule: "Verb construction wrong answer accepted",
            error: "incomplete answer was accepted",
          });
        }
      }

      if (!correctAccepted) {
        ruleResults.push({
          rule: "Verb construction correct answer",
          error: "checker returned false for expected cards",
        });
      }

      if (ruleResults.length === 0) {
        verbPass++;
        totalPass++;
      } else {
        verbFail++;
        totalFail++;
        failures.push({ tid: "verb-construction", settings: { ...settings }, sentence, errors: ruleResults });
      }

      log.push({
        timestamp: new Date().toISOString(),
        templateId: "verb-construction",
        script: round.script,
        native_language: settings.nativeLanguage,
        native_prompt: round.prompt,
        exercise_signature: roundSignature,
        difficulty: settings.difficulty,
        generated_sentence: sentence,
        expected_cards: round.expectedCards.map((card) => card.display),
        all_cards: round.cards.map((card) => card.display),
        correct_answer_accepted: correctAccepted,
        wrong_answers_tested: wrongTests,
        rule_violations: ruleResults,
      });
    }
  }

  console.log(`  ${verbFail === 0 ? "PASS" : "FAIL"} (${verbPass} passed, ${verbFail} failed)\n`);

  // Write log
  const logPath = join(__dirname, "exercise_log.json");
  writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
  console.log(`Log written: ${logPath} (${log.length} entries)\n`);

  // Summary
  console.log("=== SUMMARY ===");
  console.log(`Total: ${totalPass + totalFail} | Pass: ${totalPass} | Fail: ${totalFail}`);

  if (failures.length > 0) {
    console.log(`\n=== FAILURES (${failures.length}) ===`);
    for (const f of failures.slice(0, 20)) {
      console.log(`  [${f.tid}] ${f.sentence || "N/A"}`);
      if (f.errors) {
        for (const e of f.errors) console.log(`    ${e.rule}: ${e.error}`);
      }
      if (f.error) console.log(`    ${f.error}`);
    }
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
    process.exit(1);
  } else {
    console.log("\nAll tests passed!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
