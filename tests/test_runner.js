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

// ── Main ─────────────────────────────────────────────────────────

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

  // Preload prompt builders
  const pb_ru = new PromptBuilder();
  await pb_ru.load("ru");
  const pb_en = new PromptBuilder();
  await pb_en.load("en");

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
