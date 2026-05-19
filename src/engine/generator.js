/**
 * Exercise Generator — builds runtime exercises from templates.
 */

import { createCard } from "./card.js";

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chooseScript(settings) {
  if (settings.scriptMode === "mixed") {
    return Math.random() < 0.5 ? "cyr" : "lat";
  }
  return settings.scriptMode || "cyr";
}

function bitiFormKey(formType, person, number) {
  return `present_${formType}_${person}${number}`;
}

function nounFormKey(number) {
  return number === "pl" ? "nom_pl" : "nom_sg";
}

function buildExpectedMeta(cards) {
  return cards.map((c) => ({
    slot: c.type, lexemeId: c.lexemeId,
    formKey: c.formKey, cardInstanceId: c.cardInstanceId,
  }));
}

function wrapResult(template, script, prompt, expectedCards, allCards) {
  shuffle(allCards);
  return {
    templateId: template.id,
    instruction: template.instruction,
    prompt, script,
    expected: buildExpectedMeta(expectedCards),
    expectedCards,
    cards: allCards,
    defaultHelpTable: template.defaultHelpTable,
    availableHelpTables: template.availableHelpTables,
  };
}

// ─── Templates ───────────────────────────────────────────────────

const TEMPLATES = {};

// 1. Краткая форма biti
TEMPLATES["biti-short-basic"] = {
  id: "biti-short-basic",
  instruction: { ru: "Собери утверждение с краткой формой biti.", en: "Build a statement with the short form of biti." },
  defaultHelpTable: "sr.biti.short.present",
  availableHelpTables: ["sr.biti.short.present", "sr.biti.full.present", "sr.pronouns.basic"],

  generate(lexicon, promptBuilder, settings) {
    const script = chooseScript(settings);
    const pronoun = pickRandom(lexicon.query({ type: "pronoun", tags: ["subject"] }));
    const pG = pronoun.grammar;

    const pf = { tags: ["predicate_nominal"], canPredicateFor: "human_subject" };
    if (pG.person === 3 && pG.gender) pf.gender = pG.gender;
    const nf = nounFormKey(pG.number);
    let preds = lexicon.query(pf).filter((p) => p.forms?.[nf]?.[script]);
    if (!preds.length) { delete pf.gender; preds = lexicon.query(pf).filter((p) => p.forms?.[nf]?.[script]); }
    const pred = pickRandom(preds);

    const biti = lexicon.byId.get("biti");
    const bk = bitiFormKey("short", pG.person, pG.number);

    const exp = [createCard(pronoun, "nom", script), createCard(biti, bk, script), createCard(pred, nf, script)];
    const prompt = promptBuilder.build(this.id, {
      person: pG.person,
      number: pG.number,
      subjectId: pronoun.conceptId,
      predicateId: pred.conceptId,
      predicateSemanticClass: pred.semantics?.semanticClass
    });

    const dist = [];
    if (settings.difficulty === "hard") {
      const wrongBiti = shuffle(Object.keys(biti.forms).filter((k) => k.startsWith("present_short_") && k !== bk));
      for (let i = 0; i < Math.min(2, wrongBiti.length); i++) {
        if (biti.forms[wrongBiti[i]]?.[script]) dist.push(createCard(biti, wrongBiti[i], script));
      }
      const wrongN = shuffle(lexicon.query({ tags: ["predicate_nominal"], canPredicateFor: "human_subject" }).filter((n) => n.id !== pred.id && n.forms?.[nf]?.[script]));
      for (let i = 0; i < Math.min(2, wrongN.length); i++) dist.push(createCard(wrongN[i], nf, script));
      if (Math.random() < 0.5) {
        const wp = pickRandom(lexicon.query({ type: "pronoun", tags: ["subject"] }).filter((p) => p.id !== pronoun.id && p.forms?.nom?.[script]));
        if (wp) dist.push(createCard(wp, "nom", script));
      }
    }

    return wrapResult(this, script, prompt, exp, [...exp, ...dist.slice(0, 5)]);
  },
};

// 2. Demonstrative: ovo
TEMPLATES["demonstrative-basic"] = {
  id: "demonstrative-basic",
  instruction: { ru: "Собери конструкцию с «ово».", en: "Build a sentence with ovo." },
  defaultHelpTable: "sr.demonstratives.basic",
  availableHelpTables: ["sr.demonstratives.basic", "sr.biti.short.present"],

  generate(lexicon, promptBuilder, settings) {
    const script = chooseScript(settings);
    const dem = lexicon.byId.get("ovo");
    const preds = lexicon.query({ tags: ["predicate_nominal"], canPredicateFor: "demonstrative_subject" }).filter((p) => p.forms?.nom_sg?.[script]);
    const pred = pickRandom(preds);
    const biti = lexicon.byId.get("biti");

    const exp = [createCard(dem, "base", script), createCard(biti, "present_short_3sg", script), createCard(pred, "nom_sg", script)];
    const prompt = promptBuilder.build(this.id, {
      person: 3,
      number: "sg",
      subjectId: dem.conceptId,
      predicateId: pred.conceptId,
      predicateSemanticClass: pred.semantics?.semanticClass
    });

    const dist = [];
    if (settings.difficulty === "hard") {
      for (const d of lexicon.query({ type: "demonstrative" }).filter((d) => d.id !== dem.id && d.forms?.base?.[script]).slice(0, 2)) {
        dist.push(createCard(d, "base", script));
      }
      const wn = shuffle(lexicon.query({ tags: ["predicate_nominal"], canPredicateFor: "demonstrative_subject" }).filter((n) => n.id !== pred.id && n.forms?.nom_sg?.[script]));
      for (let i = 0; i < Math.min(2, wn.length); i++) dist.push(createCard(wn[i], "nom_sg", script));
      const wb = pickRandom(Object.keys(biti.forms).filter((k) => k.startsWith("present_short_") && k !== "present_short_3sg"));
      if (wb && biti.forms[wb]?.[script]) dist.push(createCard(biti, wb, script));
    }

    return wrapResult(this, script, prompt, exp, [...exp, ...dist.slice(0, 5)]);
  },
};

// 3. Вопрос с da li
TEMPLATES["da-li-question"] = {
  id: "da-li-question",
  instruction: { ru: "Задай вопрос с «да ли».", en: "Ask a question with \"da li\"." },
  defaultHelpTable: "sr.biti.short.present",
  availableHelpTables: ["sr.biti.short.present", "sr.demonstratives.basic"],

  generate(lexicon, promptBuilder, settings) {
    const script = chooseScript(settings);
    const pronoun = pickRandom(lexicon.query({ type: "pronoun", tags: ["subject"] }));
    const pG = pronoun.grammar;
    const nf = nounFormKey(pG.number);
    const pf = { tags: ["predicate_nominal"], canPredicateFor: "human_subject" };
    if (pG.person === 3 && pG.gender) pf.gender = pG.gender;
    const pred = pickRandom(lexicon.query(pf).filter((p) => p.forms?.[nf]?.[script]));

    const daLi = lexicon.byId.get("da_li");
    const biti = lexicon.byId.get("biti");
    const bk = bitiFormKey("short", pG.person, pG.number);

    const exp = [createCard(daLi, "base", script), createCard(biti, bk, script)];
    if (pG.person === 3) exp.push(createCard(pronoun, "nom", script));
    exp.push(createCard(pred, nf, script));

    const prompt = promptBuilder.build(this.id, {
      person: pG.person,
      number: pG.number,
      subjectId: pronoun.conceptId,
      predicateId: pred.conceptId,
      predicateSemanticClass: pred.semantics?.semanticClass
    });

    const dist = [];
    if (settings.difficulty === "hard") {
      const wb = shuffle(Object.keys(biti.forms).filter((k) => k.startsWith("present_short_") && k !== bk));
      for (let i = 0; i < Math.min(2, wb.length); i++) { if (biti.forms[wb[i]]?.[script]) dist.push(createCard(biti, wb[i], script)); }
      const wn = shuffle(lexicon.query({ tags: ["predicate_nominal"], canPredicateFor: "human_subject" }).filter((n) => n.id !== pred.id && n.forms?.[nf]?.[script]));
      for (let i = 0; i < Math.min(2, wn.length); i++) dist.push(createCard(wn[i], nf, script));
    }

    return wrapResult(this, script, prompt, exp, [...exp, ...dist.slice(0, 5)]);
  },
};

// 4. Краткий ответ
TEMPLATES["short-answer"] = {
  id: "short-answer",
  instruction: { ru: "Дай краткий ответ.", en: "Give a short answer." },
  defaultHelpTable: "sr.biti.full.present",
  availableHelpTables: ["sr.biti.full.present", "sr.biti.short.present"],

  generate(lexicon, promptBuilder, settings) {
    const script = chooseScript(settings);
    const pronoun = pickRandom(lexicon.query({ type: "pronoun", tags: ["subject"] }));
    const pG = pronoun.grammar;
    const nf = nounFormKey(pG.number);
    const pf = { tags: ["predicate_nominal"], canPredicateFor: "human_subject" };
    if (pG.person === 3 && pG.gender) pf.gender = pG.gender;
    const pred = pickRandom(lexicon.query(pf).filter((p) => p.forms?.[nf]?.[script]));

    const biti = lexicon.byId.get("biti");
    const daLi = lexicon.byId.get("da_li");
    const bsk = bitiFormKey("short", pG.person, pG.number);

    const prompt = promptBuilder.build(this.id, {
      person: pG.person,
      number: pG.number,
      subjectId: pronoun.conceptId,
      predicateId: pred.conceptId,
      predicateSemanticClass: pred.semantics?.semanticClass
    });

    const blk = bitiFormKey("long", pG.person, pG.number);
    const exp = [createCard(biti, blk, script)];

    const dist = [];
    if (settings.difficulty === "hard") {
      const wk = shuffle(Object.keys(biti.forms).filter((k) => k.startsWith("present_long_") && k !== blk));
      for (let i = 0; i < Math.min(4, wk.length); i++) { if (biti.forms[wk[i]]?.[script]) dist.push(createCard(biti, wk[i], script)); }
    }

    return wrapResult(this, script, prompt, exp, [...exp, ...dist]);
  },
};

// 5. Полный ответ
TEMPLATES["full-answer"] = {
  id: "full-answer",
  instruction: { ru: "Дай полный ответ.", en: "Give a full answer." },
  defaultHelpTable: "sr.biti.full.present",
  availableHelpTables: ["sr.biti.full.present", "sr.biti.short.present", "sr.pronouns.basic"],

  generate(lexicon, promptBuilder, settings) {
    const script = chooseScript(settings);
    const pronoun = pickRandom(lexicon.query({ type: "pronoun", tags: ["subject"] }));
    const pG = pronoun.grammar;
    const nf = nounFormKey(pG.number);
    const pf = { tags: ["predicate_nominal"], canPredicateFor: "human_subject" };
    if (pG.person === 3 && pG.gender) pf.gender = pG.gender;
    const pred = pickRandom(lexicon.query(pf).filter((p) => p.forms?.[nf]?.[script]));

    const biti = lexicon.byId.get("biti");
    const daLi = lexicon.byId.get("da_li");
    const bsk = bitiFormKey("short", pG.person, pG.number);

    const prompt = promptBuilder.build(this.id, {
      person: pG.person,
      number: pG.number,
      subjectId: pronoun.conceptId,
      predicateId: pred.conceptId,
      predicateSemanticClass: pred.semantics?.semanticClass
    });

    const blk = bitiFormKey("long", pG.person, pG.number);
    const exp = [createCard(pronoun, "nom", script), createCard(biti, blk, script), createCard(pred, nf, script)];

    const dist = [];
    if (settings.difficulty === "hard") {
      const wb = shuffle(Object.keys(biti.forms).filter((k) => k.startsWith("present_long_") && k !== blk));
      for (let i = 0; i < Math.min(2, wb.length); i++) { if (biti.forms[wb[i]]?.[script]) dist.push(createCard(biti, wb[i], script)); }
      const wn = shuffle(lexicon.query({ tags: ["predicate_nominal"], canPredicateFor: "human_subject" }).filter((n) => n.id !== pred.id && n.forms?.[nf]?.[script]));
      for (let i = 0; i < Math.min(2, wn.length); i++) dist.push(createCard(wn[i], nf, script));
    }

    return wrapResult(this, script, prompt, exp, [...exp, ...dist.slice(0, 5)]);
  },
};

// ─── Public API ──────────────────────────────────────────────────

export function generateExercise(templateId, lexicon, promptBuilder, settings) {
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`Unknown template: "${templateId}"`);
  return t.generate(lexicon, promptBuilder, settings);
}

export function getExerciseSignature(exercise) {
  const expected = exercise.expected.map((card) => `${card.slot}:${card.lexemeId}:${card.formKey}`);
  return `${exercise.templateId}|${exercise.prompt}|${expected.join(",")}`;
}

export function generateExerciseAvoidingRepeat(
  templateId,
  lexicon,
  promptBuilder,
  settings,
  previousSignature,
  maxAttempts = 12
) {
  let exercise = null;
  let signature = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    exercise = generateExercise(templateId, lexicon, promptBuilder, settings);
    signature = getExerciseSignature(exercise);
    if (signature !== previousSignature) break;
  }

  return { exercise, signature };
}

export function getTemplateIds() { return Object.keys(TEMPLATES); }
export function getTemplate(id) { return TEMPLATES[id] || null; }
