import { t } from "../i18n/i18n.js";
import { loadSettings, recordAttempt } from "../storage/storage.js";
import {
  checkOwnershipAnswer,
  generateOwnershipRound
} from "../engine/ownership_generator.js";

let dataCache = new Map();
let lastSignature = "";

async function loadOwnershipData(lang) {
  const key = lang || "en";
  if (dataCache.has(key)) return dataCache.get(key);

  const [srResp, nativeResp] = await Promise.all([
    fetch("data/languages/sr/possessives.json"),
    fetch(`data/languages/native/${key}/owners.json`),
  ]);
  const data = {
    sr: await srResp.json(),
    native: await nativeResp.json(),
  };
  dataCache.set(key, data);
  return data;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createSlot(text) {
  const span = document.createElement("span");
  span.className = text ? "ownership-slot filled" : "ownership-slot";
  span.textContent = text || "___";
  return span;
}

function isComplete(selected) {
  return Boolean(selected.question && selected.owner && selected.noun);
}

export async function renderOwnership(container, lexicon, promptBuilder) {
  const settings = loadSettings();
  const lang = settings.nativeLanguage || "en";
  const ownershipData = await loadOwnershipData(lang);

  container.innerHTML = "";
  container.className = "screen-enter";

  const header = document.createElement("div");
  header.className = "header";

  const titleData = t("exercises.ownership");
  const title = titleData ? titleData.title || "Ownership" : "Ownership";

  const btnBack = document.createElement("button");
  btnBack.className = "btn-back";
  btnBack.textContent = "←";
  btnBack.addEventListener("click", () => {
    location.hash = "#menu";
  });

  const titleEl = document.createElement("div");
  titleEl.className = "header-title";
  titleEl.textContent = title;

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "header-actions";

  header.appendChild(btnBack);
  header.appendChild(titleEl);
  header.appendChild(actionsDiv);
  container.appendChild(header);

  const content = document.createElement("div");
  content.style.cssText = "flex:1; display:flex; flex-direction:column;";
  container.appendChild(content);

  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";
  container.appendChild(actionBar);

  let round = null;
  let selected = { question: null, owner: null, noun: null };
  let isChecked = false;
  let showError = false;

  function loadNewRound() {
    const result = generateOwnershipRound({
      lexicon,
      promptBuilder,
      settings,
      srData: ownershipData.sr,
      nativeData: ownershipData.native,
      previousSignature: lastSignature,
    });
    round = result.round;
    lastSignature = result.signature;
    selected = { question: null, owner: null, noun: null };
    isChecked = false;
    showError = false;
    renderBoard();
  }

  function renderSentence() {
    const sentence = document.createElement("div");
    sentence.className = "ownership-sentence";

    sentence.appendChild(createSlot(selected.question ? capitalize(selected.question.text) : ""));
    sentence.append(` ${round.verb} ${round.to} `);
    sentence.appendChild(createSlot(selected.noun?.text || ""));
    sentence.append("?");

    sentence.appendChild(document.createElement("br"));
    sentence.append(`${capitalize(round.to)} ${round.verb} `);
    sentence.appendChild(createSlot(selected.owner?.text || ""));
    sentence.append(" ");
    sentence.appendChild(createSlot(selected.noun?.text || ""));
    sentence.append(".");

    return sentence;
  }

  function renderOptionColumn(kind, titleKey, options) {
    const column = document.createElement("div");
    column.className = "ownership-column";

    const label = document.createElement("div");
    label.className = "ownership-column-title";
    label.textContent = t(titleKey);
    column.appendChild(label);

    for (const option of options) {
      const btn = document.createElement("button");
      btn.className = "ownership-option";
      btn.textContent = option.buttonText || option.text;
      btn.disabled = isChecked;
      if (selected[kind]?.id === option.id) btn.classList.add("selected");
      if (isChecked && option.isCorrect) btn.classList.add("correct");
      btn.addEventListener("click", () => {
        if (isChecked) return;
        showError = false;
        selected[kind] = selected[kind]?.id === option.id ? null : option;
        renderBoard();
      });
      column.appendChild(btn);
    }

    return column;
  }

  function renderBoard() {
    content.innerHTML = "";

    const prompt = document.createElement("div");
    prompt.className = "ownership-native-prompt";

    const nativeQuestion = document.createElement("div");
    nativeQuestion.className = "ownership-native-line";
    nativeQuestion.textContent = round.nativePrompt.question;
    prompt.appendChild(nativeQuestion);

    const nativeAnswer = document.createElement("div");
    nativeAnswer.className = "ownership-native-line answer";
    nativeAnswer.textContent = round.nativePrompt.answer;
    prompt.appendChild(nativeAnswer);
    content.appendChild(prompt);

    content.appendChild(renderSentence());

    const columns = document.createElement("div");
    columns.className = "ownership-columns";
    columns.appendChild(renderOptionColumn(
      "question",
      "ownership_ui.question_column",
      round.options.question
    ));
    columns.appendChild(renderOptionColumn(
      "owner",
      "ownership_ui.owner_column",
      round.options.owner
    ));
    columns.appendChild(renderOptionColumn(
      "noun",
      "ownership_ui.noun_column",
      round.options.noun
    ));
    content.appendChild(columns);

    if (showError && !isChecked) {
      const fb = document.createElement("div");
      fb.className = "feedback error";
      fb.style.display = "block";
      fb.textContent = t("exercise_ui.incorrect");
      content.appendChild(fb);
    }

    if (isChecked) {
      const fb = document.createElement("div");
      fb.className = "feedback success";
      fb.style.display = "block";
      fb.textContent = t("exercise_ui.correct");
      content.appendChild(fb);
    }

    renderActionBar();
  }

  function renderActionBar() {
    actionBar.innerHTML = "";

    if (isChecked) {
      const btnNext = document.createElement("button");
      btnNext.className = "btn btn-primary";
      btnNext.textContent = t("exercise_ui.next");
      btnNext.addEventListener("click", loadNewRound);
      actionBar.appendChild(btnNext);
      return;
    }

    const btnCheck = document.createElement("button");
    btnCheck.className = "btn btn-primary";
    btnCheck.textContent = t("exercise_ui.check");
    btnCheck.disabled = !isComplete(selected);
    btnCheck.addEventListener("click", handleCheck);
    actionBar.appendChild(btnCheck);
  }

  function handleCheck() {
    if (!isComplete(selected) || isChecked) return;

    const correct = checkOwnershipAnswer(round, selected);
    recordAttempt("ownership", correct);

    if (correct) {
      isChecked = true;
      showError = false;
    } else {
      selected = { question: null, owner: null, noun: null };
      showError = true;
    }

    renderBoard();
  }

  loadNewRound();
}
