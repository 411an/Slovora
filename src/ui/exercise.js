import { t } from "../i18n/i18n.js";
import { generateExerciseAvoidingRepeat } from "../engine/generator.js";
import { checkAnswer, getErrorMessage } from "../engine/checker.js";
import { loadSettings, recordAttempt } from "../storage/storage.js";
import { renderHelp } from "./help.js";

let currentExercise = null;
let userCards = [];
const lastExerciseSignatures = new Map();

export function renderExercise(container, lexicon, promptBuilder, templateId) {
  const settings = loadSettings();

  container.innerHTML = "";
  container.className = "screen-enter";

  // Header
  const header = document.createElement("div");
  header.className = "header";

  const titleData = t(`exercises.${templateId}`);
  const title = titleData ? (titleData.title || titleData) : templateId;

  header.innerHTML = `
    <button class="btn-back" id="btn-back">←</button>
    <div class="header-title">${title}</div>
    <div class="header-actions">
      <button class="btn-icon" id="btn-help" title="${t("exercise_ui.help")}">?</button>
    </div>
  `;
  container.appendChild(header);

  // Content area
  const content = document.createElement("div");
  content.style.flex = "1";
  container.appendChild(content);

  // Actions area (bottom)
  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";
  container.appendChild(actionBar);

  // Difficulty toggle
  const diffToggle = document.createElement("div");
  diffToggle.className = "difficulty-toggle";
  diffToggle.innerHTML = `
    <label>${t("exercise_ui.difficulty")}</label>
    <div class="toggle-group">
      <button data-val="easy" ${settings.difficulty === "easy" ? 'class="active"' : ''}>${t("exercise_ui.easy")}</button>
      <button data-val="hard" ${settings.difficulty === "hard" ? 'class="active"' : ''}>${t("exercise_ui.hard")}</button>
    </div>
  `;
  container.appendChild(diffToggle);

  // State
  let isChecked = false;
  let isAnimating = false;

  function loadNewExercise() {
    isChecked = false;
    isAnimating = false;
    userCards = [];
    const result = generateExerciseAvoidingRepeat(
      templateId,
      lexicon,
      promptBuilder,
      settings,
      lastExerciseSignatures.get(templateId)
    );
    currentExercise = result.exercise;
    lastExerciseSignatures.set(templateId, result.signature);
    renderContent();
  }

  function renderContent() {
    content.innerHTML = `
      <div class="exercise-instruction">${currentExercise.instruction[settings.nativeLanguage] || currentExercise.instruction.ru}</div>
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

    // Render cards
    currentExercise.cards.forEach(card => {
      const cardEl = document.createElement("div");
      cardEl.className = "word-card";
      cardEl.dataset.id = card.cardInstanceId;

      const textSpan = document.createElement("span");
      textSpan.textContent = card.display;
      cardEl.appendChild(textSpan);

      cardEl.addEventListener("click", () => handleCardClick(card));
      poolEl.appendChild(cardEl);
    });

    renderActionBar();
  }

  function handleCardClick(card) {
    if (isChecked || isAnimating) return; // Prevent interaction after check

    const inAnswerIdx = userCards.findIndex(c => c.cardInstanceId === card.cardInstanceId);

    if (inAnswerIdx >= 0) {
      // Remove from answer
      userCards.splice(inAnswerIdx, 1);
    } else {
      // Add to answer
      userCards.push(card);
    }

    updateCardZones();
  }

  function updateCardZones() {
    const poolEl = content.querySelector("#pool");
    const answerEl = content.querySelector("#answer");

    // Clear answer zone
    answerEl.innerHTML = "";
    if (userCards.length === 0) {
      answerEl.classList.add("empty");
    } else {
      answerEl.classList.remove("empty");
      // Add cards to answer zone
      userCards.forEach(card => {
        const cloned = poolEl.querySelector(`[data-id="${card.cardInstanceId}"]`).cloneNode(true);
        cloned.classList.add("in-answer");
        cloned.addEventListener("click", () => handleCardClick(card));
        answerEl.appendChild(cloned);
      });
    }

    // Update pool visual state
    const poolCards = poolEl.querySelectorAll(".word-card");
    poolCards.forEach(el => {
      const id = el.dataset.id;
      if (userCards.find(c => c.cardInstanceId === id)) {
        el.classList.add("placed");
      } else {
        el.classList.remove("placed");
      }
    });
  }

  function renderActionBar() {
    actionBar.innerHTML = "";
    if (isChecked) {
      const btnNext = document.createElement("button");
      btnNext.className = "btn btn-primary";
      btnNext.textContent = t("exercise_ui.next");
      btnNext.addEventListener("click", loadNewExercise);
      actionBar.appendChild(btnNext);
    } else {
      const btnCheck = document.createElement("button");
      btnCheck.className = "btn btn-primary";
      btnCheck.textContent = t("exercise_ui.check");
      btnCheck.addEventListener("click", handleCheck);
      actionBar.appendChild(btnCheck);
    }
  }

  function handleCheck() {
    if (userCards.length === 0 || isAnimating) return;

    const result = checkAnswer(currentExercise, userCards);
    recordAttempt(templateId, result.correct);

    const answerEl = content.querySelector("#answer");
    const fbEl = content.querySelector("#feedback");
    const placedCards = answerEl.querySelectorAll(".word-card");

    if (result.correct) {
      isChecked = true;
      fbEl.textContent = t("exercise_ui.correct");
      fbEl.className = "feedback success";
      fbEl.style.display = "block";
      placedCards.forEach(el => el.classList.add("correct"));
      renderActionBar();
    } else {
      // Build error text
      const errTexts = result.errors.map(e => getErrorMessage(e, settings.nativeLanguage));
      const uniqueErrs = [...new Set(errTexts)];
      fbEl.textContent = `${t("exercise_ui.incorrect")}: ${uniqueErrs.join(" ")}`;
      fbEl.className = "feedback error";
      fbEl.style.display = "block";

      // Mark incorrect cards
      result.errors.forEach(err => {
        if (err.slot !== undefined && err.slot < placedCards.length) {
          placedCards[err.slot].classList.add("incorrect");
        }
      });

      // Block interactions and reset cards after a short delay
      isAnimating = true;
      setTimeout(() => {
        userCards = [];
        updateCardZones();
        isAnimating = false;
      }, 1200);
    }
  }

  // Bind static events
  header.querySelector("#btn-back").addEventListener("click", () => {
    location.hash = "#menu";
  });

  header.querySelector("#btn-help").addEventListener("click", () => {
    renderHelp(currentExercise);
  });

  diffToggle.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const val = e.target.dataset.val;
      settings.difficulty = val;
      // Need to save so it persists
      import("../storage/storage.js").then(s => {
         const currentSettings = s.loadSettings();
         currentSettings.difficulty = val;
         s.saveSettings(currentSettings);
      });

      diffToggle.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");

      loadNewExercise();
    });
  });

  // Start
  loadNewExercise();
}
