import { t } from "../i18n/i18n.js";
import { checkAnswer, getErrorMessage } from "../engine/checker.js";
import {
  generateVerbConstructionRound,
  getVerbConstructionSignature
} from "../engine/verb_construction_generator.js";
import { loadSettings, recordAttempt } from "../storage/storage.js";
import { renderHelp } from "./help.js";

let verbDataCache = null;
let currentExercise = null;
let userCards = [];
let lastSignature = "";

const HELP_EXERCISE = {
  defaultHelpTable: "sr.verbs.present.patterns",
  availableHelpTables: [
    "sr.verbs.present.patterns",
    "sr.nouns.locative.basic",
    "sr.nouns.plural.full",
  ],
};

async function loadVerbData() {
  if (verbDataCache) return verbDataCache;
  const resp = await fetch("data/languages/sr/verbs.json", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`data/languages/sr/verbs.json: HTTP ${resp.status}`);
  }
  verbDataCache = await resp.json();
  return verbDataCache;
}

export async function renderVerbConstruction(container, lexicon, promptBuilder) {
  const settings = loadSettings();

  container.innerHTML = "";
  container.className = "screen-enter";

  const header = document.createElement("div");
  header.className = "header";

  const titleData = t("exercises.verb-construction");
  const title = titleData ? titleData.title || "Verb Construction" : "Verb Construction";

  header.innerHTML = `
    <button class="btn-back" id="btn-back">←</button>
    <div class="header-title">${title}</div>
    <div class="header-actions">
      <button class="btn-icon" id="btn-help" title="${t("exercise_ui.help")}">?</button>
    </div>
  `;
  container.appendChild(header);

  const content = document.createElement("div");
  content.style.flex = "1";
  container.appendChild(content);

  content.innerHTML = `<div class="exercise-instruction">${t("verb_construction_ui.loading")}</div>`;

  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";
  container.appendChild(actionBar);

  let isChecked = false;
  let isAnimating = false;
  let verbData = null;

  function renderLoadError(error) {
    console.error("Verb construction failed to load", error);
    content.innerHTML = "";
    const fb = document.createElement("div");
    fb.className = "feedback error";
    fb.style.display = "block";
    const detail = error?.message ? ` ${error.message}` : "";
    fb.textContent = `${t("verb_construction_ui.load_error")}${detail}`;
    content.appendChild(fb);
    actionBar.innerHTML = "";
  }

  function loadNewExercise() {
    isChecked = false;
    isAnimating = false;
    userCards = [];

    try {
      const result = generateVerbConstructionRound({
        lexicon,
        promptBuilder,
        settings,
        verbData,
        previousSignature: lastSignature,
      });
      currentExercise = result.round;
      lastSignature = result.signature || getVerbConstructionSignature(currentExercise);
      renderContent();
    } catch (error) {
      renderLoadError(error);
    }
  }

  function renderContent() {
    content.innerHTML = `
      <div class="exercise-instruction">${currentExercise.instruction[settings.nativeLanguage] || currentExercise.instruction.en}</div>
      <div class="exercise-prompt">${currentExercise.prompt}</div>

      <div class="card-zone-label">${t("exercise_ui.available_cards")}</div>
      <div class="card-zone card-pool" id="pool"></div>

      <div class="card-zone-label">${t("exercise_ui.your_answer")}</div>
      <div class="card-zone answer-zone" id="answer" data-placeholder="${t("exercise_ui.place_cards")}"></div>

      <div id="feedback" class="feedback" style="display:none"></div>
    `;

    const poolEl = content.querySelector("#pool");
    const answerEl = content.querySelector("#answer");
    if (userCards.length === 0) answerEl.classList.add("empty");

    for (const item of currentExercise.cards) {
      const cardEl = document.createElement("div");
      cardEl.className = "word-card";
      cardEl.dataset.id = item.cardInstanceId;

      const textSpan = document.createElement("span");
      textSpan.textContent = item.display;
      cardEl.appendChild(textSpan);

      cardEl.addEventListener("click", () => handleCardClick(item));
      poolEl.appendChild(cardEl);
    }

    renderActionBar();
  }

  function handleCardClick(card) {
    if (isChecked || isAnimating) return;

    const inAnswerIdx = userCards.findIndex((item) => item.cardInstanceId === card.cardInstanceId);
    if (inAnswerIdx >= 0) {
      userCards.splice(inAnswerIdx, 1);
    } else {
      userCards.push(card);
    }

    updateCardZones();
  }

  function updateCardZones() {
    const poolEl = content.querySelector("#pool");
    const answerEl = content.querySelector("#answer");

    answerEl.innerHTML = "";
    if (userCards.length === 0) {
      answerEl.classList.add("empty");
    } else {
      answerEl.classList.remove("empty");
      for (const item of userCards) {
        const source = poolEl.querySelector(`[data-id="${item.cardInstanceId}"]`);
        const cloned = source.cloneNode(true);
        cloned.classList.add("in-answer");
        cloned.addEventListener("click", () => handleCardClick(item));
        answerEl.appendChild(cloned);
      }
    }

    for (const el of poolEl.querySelectorAll(".word-card")) {
      const id = el.dataset.id;
      if (userCards.find((item) => item.cardInstanceId === id)) {
        el.classList.add("placed");
      } else {
        el.classList.remove("placed");
      }
    }
  }

  function renderActionBar() {
    actionBar.innerHTML = "";
    if (isChecked) {
      const btnNext = document.createElement("button");
      btnNext.className = "btn btn-primary";
      btnNext.textContent = t("exercise_ui.next");
      btnNext.addEventListener("click", loadNewExercise);
      actionBar.appendChild(btnNext);
      return;
    }

    const btnCheck = document.createElement("button");
    btnCheck.className = "btn btn-primary";
    btnCheck.textContent = t("exercise_ui.check");
    btnCheck.addEventListener("click", handleCheck);
    actionBar.appendChild(btnCheck);
  }

  function handleCheck() {
    if (userCards.length === 0 || isAnimating) return;

    const result = checkAnswer(currentExercise, userCards);
    recordAttempt("verb-construction", result.correct);

    const answerEl = content.querySelector("#answer");
    const fbEl = content.querySelector("#feedback");
    const placedCards = answerEl.querySelectorAll(".word-card");

    if (result.correct) {
      isChecked = true;
      fbEl.textContent = t("exercise_ui.correct");
      fbEl.className = "feedback success";
      fbEl.style.display = "block";
      placedCards.forEach((el) => el.classList.add("correct"));
      renderActionBar();
      return;
    }

    const errTexts = result.errors.map((err) => getErrorMessage(err, settings.nativeLanguage));
    const uniqueErrs = [...new Set(errTexts)];
    fbEl.textContent = `${t("exercise_ui.incorrect")}: ${uniqueErrs.join(" ")}`;
    fbEl.className = "feedback error";
    fbEl.style.display = "block";

    for (const err of result.errors) {
      if (err.slot !== undefined && err.slot < placedCards.length) {
        placedCards[err.slot].classList.add("incorrect");
      }
    }

    isAnimating = true;
    setTimeout(() => {
      userCards = [];
      updateCardZones();
      isAnimating = false;
    }, 1200);
  }

  header.querySelector("#btn-back").addEventListener("click", () => {
    location.hash = "#menu";
  });

  header.querySelector("#btn-help").addEventListener("click", () => {
    renderHelp(currentExercise || HELP_EXERCISE);
  });

  try {
    verbData = await loadVerbData();
    loadNewExercise();
  } catch (error) {
    renderLoadError(error);
  }
}
