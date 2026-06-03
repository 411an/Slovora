/**
 * Plural Exercise — multiple-choice quiz for Serbian plural forms.
 * User sees a word in native language + its Serbian singular translation,
 * and picks the correct plural form from options.
 *
 * Data source: lexicon.json (entries with tag "plural") + concepts.json (translations).
 * Fake (incorrect) options are generated via plural_generator.js.
 */

import { t } from "../i18n/i18n.js";
import { loadSettings, recordAttempt } from "../storage/storage.js";
import { generateFakePlurals } from "../engine/plural_generator.js";
import { renderPluralHelp } from "./plural_help.js";

function shuffle(arr) {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

/** Get native-language label for a lexeme via conceptId. */
function getNativeLabel(concept, lang) {
  if (!concept) return "[?]";
  return concept.labels?.default || concept.forms?.sg || "[?]";
}

/**
 * Generate options: 1 correct + N fake.
 * @param {object} lexeme   — lexicon entry with forms.nom_sg, forms.nom_pl
 * @param {object} concept  — native concept with translation
 * @param {object} settings
 * @param {Array} allLexemes — all plural-tagged lexemes (for fallback distractors)
 * @param {number} fakeCount
 * @returns {Array<{text:string, isCorrect:boolean}>}
 */
function generateOptions(lexeme, concept, settings, allLexemes, fakeCount = 5) {
  const scriptMode = settings.scriptMode || "cyr";
  const sgCyr = lexeme.forms.nom_sg.cyr;
  const sgLat = lexeme.forms.nom_sg.lat;
  const plCyr = lexeme.forms.nom_pl.cyr;
  const plLat = lexeme.forms.nom_pl.lat;

  let correctText;
  let sgForFakes;
  let crossScriptFakes = [];

  if (scriptMode === "mixed") {
    correctText = Math.random() < 0.5 ? plCyr : plLat;
    const fakesCyr = generateFakePlurals(sgCyr, plCyr, fakeCount + 3);
    const fakesLat = generateFakePlurals(sgLat, plLat, fakeCount + 3);
    const allFakes = [];
    const maxLen = Math.max(fakesCyr.length, fakesLat.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < fakesCyr.length) allFakes.push(fakesCyr[i]);
      if (i < fakesLat.length) allFakes.push(fakesLat[i]);
    }
    sgForFakes = sgCyr;
    crossScriptFakes = shuffle(allFakes);
  } else {
    correctText = scriptMode === "cyr" ? plCyr : plLat;
    sgForFakes = scriptMode === "cyr" ? sgCyr : sgLat;
  }

  const usedLower = new Set();
  usedLower.add(correctText.toLowerCase());
  const correctTwin = correctText === plCyr ? plLat.toLowerCase() : plCyr.toLowerCase();
  usedLower.add(correctTwin);

  const options = [{ text: correctText, isCorrect: true }];

  const fakePool = scriptMode === "mixed"
    ? crossScriptFakes
    : generateFakePlurals(sgForFakes, correctText, fakeCount + 5);

  for (const fake of fakePool) {
    if (options.length >= fakeCount + 1) break;
    const lower = fake.toLowerCase().trim();
    if (usedLower.has(lower)) continue;
    if (lower === sgCyr.toLowerCase() || lower === sgLat.toLowerCase()) continue;
    usedLower.add(lower);
    options.push({ text: fake, isCorrect: false });
  }

  // Fallback: pull plural forms from other lexicon entries
  if (options.length < fakeCount + 1) {
    const others = allLexemes.filter(e => e.id !== lexeme.id);
    for (const other of shuffle(others)) {
      if (options.length >= fakeCount + 1) break;
      let distractorText;
      if (scriptMode === "mixed") {
        distractorText = Math.random() < 0.5
          ? other.forms.nom_pl.cyr : other.forms.nom_pl.lat;
      } else {
        distractorText = scriptMode === "cyr"
          ? other.forms.nom_pl.cyr : other.forms.nom_pl.lat;
      }
      const lower = distractorText.toLowerCase().trim();
      if (usedLower.has(lower)) continue;
      usedLower.add(lower);
      options.push({ text: distractorText, isCorrect: false });
    }
  }

  return shuffle(options);
}

export function renderPlural(container, lexicon, promptBuilder) {
  const settings = loadSettings();
  const lang = settings.nativeLanguage || "ru";

  // Get all plural-tagged nouns from lexicon
  const allLexemes = lexicon.query({ type: "noun", tags: ["plural"] })
    .filter(e => e.forms?.nom_sg?.cyr && e.forms?.nom_pl?.cyr);

  if (allLexemes.length === 0) {
    container.innerHTML = "<p>No plural data loaded.</p>";
    return;
  }

  container.innerHTML = "";
  container.className = "screen-enter";

  // ── Header ──
  const header = document.createElement("div");
  header.className = "header";
  const title = (t("exercises.plural") || {}).title || "Plural";

  const btnBack = document.createElement("button");
  btnBack.className = "btn-back";
  btnBack.textContent = "←";
  btnBack.addEventListener("click", () => { location.hash = "#menu"; });

  const titleEl = document.createElement("div");
  titleEl.className = "header-title";
  titleEl.textContent = title;

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "header-actions";
  const btnHelp = document.createElement("button");
  btnHelp.className = "btn-icon";
  btnHelp.title = t("exercise_ui.help");
  btnHelp.textContent = "?";
  btnHelp.addEventListener("click", () => { renderPluralHelp(lang); });
  actionsDiv.appendChild(btnHelp);

  header.appendChild(btnBack);
  header.appendChild(titleEl);
  header.appendChild(actionsDiv);
  container.appendChild(header);

  // ── Content & action bar ──
  const content = document.createElement("div");
  content.style.cssText = "flex:1; display:flex; flex-direction:column;";
  container.appendChild(content);

  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";
  container.appendChild(actionBar);

  // ── State ──
  let currentLexeme = null;
  let currentConcept = null;
  let options = [];
  let selectedIdx = -1;
  let isChecked = false;
  let showError = false;
  let lastId = null;
  const FAKE_COUNT = 5;

  function loadNewRound() {
    isChecked = false;
    selectedIdx = -1;
    showError = false;

    const candidates = lastId
      ? allLexemes.filter(e => e.id !== lastId)
      : allLexemes;
    currentLexeme = candidates[Math.floor(Math.random() * candidates.length)];
    lastId = currentLexeme.id;
    currentConcept = promptBuilder.getConcept(currentLexeme.conceptId);

    options = generateOptions(currentLexeme, currentConcept, settings, allLexemes, FAKE_COUNT);
    if (options.length < 2) { loadNewRound(); return; }
    renderBoard();
  }

  function renderBoard() {
    content.innerHTML = "";

    // ── Prompt: native word + Serbian singular ──
    const promptDiv = document.createElement("div");
    promptDiv.className = "plural-prompt";

    const nativeWord = getNativeLabel(currentConcept, lang);
    const script = settings.scriptMode || "cyr";
    let srWord;
    if (script === "cyr") {
      srWord = currentLexeme.forms.nom_sg.cyr;
    } else if (script === "lat") {
      srWord = currentLexeme.forms.nom_sg.lat;
    } else {
      srWord = currentLexeme.forms.nom_sg.cyr + " / " + currentLexeme.forms.nom_sg.lat;
    }

    promptDiv.innerHTML = `
      <div class="plural-native-word">${escapeHtml(nativeWord)}</div>
      <div class="plural-sr-word">${escapeHtml(srWord)}</div>
      <div class="plural-instruction">${t("plural_ui.instruction")}</div>
    `;
    content.appendChild(promptDiv);

    // ── Options grid ──
    const grid = document.createElement("div");
    grid.className = "plural-options-grid";

    options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "plural-option";
      if (isChecked && opt.isCorrect) btn.classList.add("correct");
      if (selectedIdx === idx) {
        btn.classList.add("selected");
        if (!isChecked && showError) btn.classList.add("incorrect");
      }
      btn.textContent = opt.text;
      btn.disabled = isChecked;
      btn.addEventListener("click", () => {
        if (isChecked) return;
        showError = false;
        selectedIdx = selectedIdx === idx ? -1 : idx;
        renderBoard();
      });
      grid.appendChild(btn);
    });
    content.appendChild(grid);

    // ── Feedback ──
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

      const correctDiv = document.createElement("div");
      correctDiv.className = "plural-correct-form";
      let correctDisplay;
      if (settings.scriptMode === "cyr") {
        correctDisplay = currentLexeme.forms.nom_pl.cyr;
      } else if (settings.scriptMode === "lat") {
        correctDisplay = currentLexeme.forms.nom_pl.lat;
      } else {
        correctDisplay = currentLexeme.forms.nom_pl.cyr + " / " + currentLexeme.forms.nom_pl.lat;
      }
      correctDiv.innerHTML = `<span class="plural-arrow">→</span><span class="plural-form">${escapeHtml(correctDisplay)}</span>`;
      content.appendChild(correctDiv);
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
    } else {
      const btnCheck = document.createElement("button");
      btnCheck.className = "btn btn-primary";
      btnCheck.textContent = t("exercise_ui.check");
      btnCheck.addEventListener("click", handleCheck);
      actionBar.appendChild(btnCheck);
    }
  }

  function handleCheck() {
    if (selectedIdx < 0 || isChecked) return;
    const selected = options[selectedIdx];
    if (!selected.isCorrect) {
      showError = true;
      recordAttempt("plural", false);
      renderBoard();
      return;
    }
    isChecked = true;
    recordAttempt("plural", true);
    renderBoard();
  }

  loadNewRound();
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
