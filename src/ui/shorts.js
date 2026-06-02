/**
 * Shorts Exercise — multiple-choice quiz for short words of place and time.
 * User sees a native sentence with a highlighted word and picks the Serbian
 * translation from 10 options. No generation — data from shorts.json.
 */

import { t, getCurrentLang } from "../i18n/i18n.js";
import { loadSettings, recordAttempt } from "../storage/storage.js";
import { renderHelp } from "./help.js";

let shortsData = null;

async function loadShortsData() {
  if (shortsData) return shortsData;
  const resp = await fetch("data/languages/sr/shorts.json");
  shortsData = await resp.json();
  return shortsData;
}

function shuffle(arr) {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

/**
 * Highlight all occurrences of a word inside a sentence (case-insensitive).
 * For single-character words (e.g. "а", "и", "I"), splits by whitespace and
 * matches tokens exactly to avoid false matches inside other words (e.g. "чай").
 * For longer words, uses a regex with word-boundary-like behavior.
 * Wraps matches with <mark>.
 */
function highlightWord(sentence, word) {
  if (!word || !sentence) return sentence;

  // Single-character words: token-based matching to avoid sub-word false positives
  if (word.length === 1) {
    const lowerWord = word.toLowerCase();
    return sentence
      .split(/(\s+)/) // preserve whitespace
      .map((part) => {
        // Only try to match non-whitespace tokens
        if (/^\s+$/.test(part)) return part;
        // Strip leading/trailing punctuation for comparison
        const stripped = part.replace(/^[«"'(]*|[»"'),;:.!?]*$/g, "");
        if (stripped.toLowerCase() === lowerWord) {
          // Find the exact position of the word within the token (may have surrounding punct)
          const idx = part.toLowerCase().indexOf(lowerWord);
          if (idx === -1) return part;
          const before = part.slice(0, idx);
          const match = part.slice(idx, idx + word.length);
          const after = part.slice(idx + word.length);
          return before + "<mark>" + match + "</mark>" + after;
        }
        return part;
      })
      .join("");
  }

  // Multi-character words: use regex (works for phrases with spaces too)
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  return sentence.replace(regex, (match) => `<mark>${match}</mark>`);
}

/**
 * Build an array of 10 options (1 correct + 9 distractors).
 * Respects scriptMode. Avoids cross-script duplicates (e.g. "danas" + "данас").
 */
function generateOptions(entry, allData, settings) {
  const scriptMode = settings.scriptMode || "cyr";

  let correctText;
  if (scriptMode === "cyr") {
    correctText = entry.sr.cyr;
  } else if (scriptMode === "lat") {
    correctText = entry.sr.lat;
  } else {
    correctText = Math.random() < 0.5 ? entry.sr.cyr : entry.sr.lat;
  }

  const correctOption = { id: entry.id, text: correctText, isCorrect: true };

  const usedTexts = new Set([correctText.toLowerCase()]);
  const correctTwin =
    correctText === entry.sr.cyr ? entry.sr.lat.toLowerCase() : entry.sr.cyr.toLowerCase();
  usedTexts.add(correctTwin);

  const candidates = allData.filter((e) => e.id !== entry.id);
  const shuffledCandidates = shuffle(candidates);
  const distractors = [];

  for (const cand of shuffledCandidates) {
    if (distractors.length >= 9) break;

    let candText;
    if (scriptMode === "cyr") {
      candText = cand.sr.cyr;
    } else if (scriptMode === "lat") {
      candText = cand.sr.lat;
    } else {
      candText = Math.random() < 0.5 ? cand.sr.cyr : cand.sr.lat;
    }

    const candLower = candText.toLowerCase();
    const candTwin =
      candText === cand.sr.cyr ? cand.sr.lat.toLowerCase() : cand.sr.cyr.toLowerCase();

    if (usedTexts.has(candLower) || usedTexts.has(candTwin)) continue;

    usedTexts.add(candLower);
    usedTexts.add(candTwin);
    distractors.push({ id: cand.id, text: candText, isCorrect: false });
  }

  // Fallback: fill remaining slots ignoring strict twin check
  if (distractors.length < 9) {
    for (const cand of shuffledCandidates) {
      if (distractors.length >= 9) break;
      if (distractors.some((d) => d.id === cand.id)) continue;

      let candText;
      if (scriptMode === "cyr") {
        candText = cand.sr.cyr;
      } else if (scriptMode === "lat") {
        candText = cand.sr.lat;
      } else {
        candText = Math.random() < 0.5 ? cand.sr.cyr : cand.sr.lat;
      }
      distractors.push({ id: cand.id, text: candText, isCorrect: false });
    }
  }

  return shuffle([correctOption, ...distractors.slice(0, 9)]);
}

export async function renderShorts(container) {
  const settings = loadSettings();
  const data = await loadShortsData();
  const lang = settings.nativeLanguage || "ru";

  container.innerHTML = "";
  container.className = "screen-enter";

  // ── Header ──────────────────────────────────────────────────
  const header = document.createElement("div");
  header.className = "header";
  const titleData = t("exercises.shorts");
  const title = titleData ? titleData.title || "Shorts" : "Shorts";

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

  const btnHelp = document.createElement("button");
  btnHelp.className = "btn-icon";
  btnHelp.title = t("exercise_ui.help");
  btnHelp.textContent = "?";
  btnHelp.onclick = () => {
    renderHelp({
      availableHelpTables: ["sr.spatial.where"],
      defaultHelpTable: "sr.spatial.where"
    });
  };

  actionsDiv.appendChild(btnHelp);
  header.appendChild(btnBack);
  header.appendChild(titleEl);
  header.appendChild(actionsDiv);
  container.appendChild(header);

  // ── Content zone ────────────────────────────────────────────
  const content = document.createElement("div");
  content.style.cssText = "flex:1; display:flex; flex-direction:column;";
  container.appendChild(content);

  // ── Action bar (bottom) ─────────────────────────────────────
  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";
  container.appendChild(actionBar);

  // ── State ───────────────────────────────────────────────────
  let currentEntry = null;
  let options = [];
  let selectedIdx = -1;
  let isChecked = false;
  let showError = false;
  let lastEntryId = null;

  function loadNewRound() {
    isChecked = false;
    selectedIdx = -1;
    showError = false;

    const candidates = lastEntryId
      ? data.filter((e) => e.id !== lastEntryId)
      : data;
    currentEntry = candidates[Math.floor(Math.random() * candidates.length)];
    lastEntryId = currentEntry.id;

    options = generateOptions(currentEntry, data, settings);
    renderBoard();
  }

  function renderBoard() {
    content.innerHTML = "";

    // ── Instruction ─────────────────────────────────────────
    const instruction = document.createElement("div");
    instruction.className = "exercise-instruction";
    instruction.textContent = t("shorts_ui.instruction");
    content.appendChild(instruction);

    // ── Prompt with highlighted word ────────────────────────
    const promptDiv = document.createElement("div");
    promptDiv.className = "shorts-prompt";
    const rawExample = currentEntry.example[lang] || currentEntry.example.ru;
    const rawHighlight = currentEntry.highlight[lang] || currentEntry.highlight.ru;
    promptDiv.innerHTML = highlightWord(rawExample, rawHighlight);
    content.appendChild(promptDiv);

    // ── Options grid ────────────────────────────────────────
    const grid = document.createElement("div");
    grid.className = "shorts-options-grid";

    options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "shorts-option";

      if (isChecked && opt.isCorrect) {
        btn.classList.add("correct");
      }

      if (selectedIdx === idx) {
        btn.classList.add("selected");
        if (!isChecked && showError) {
          btn.classList.add("incorrect");
        }
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

    // ── Error feedback ──────────────────────────────────────
    if (showError && !isChecked) {
      const fb = document.createElement("div");
      fb.className = "feedback error";
      fb.style.display = "block";
      fb.textContent = t("exercise_ui.incorrect");
      content.appendChild(fb);
    }

    // ── Success feedback + examples ─────────────────────────
    if (isChecked) {
      const fb = document.createElement("div");
      fb.className = "feedback success";
      fb.style.display = "block";
      fb.textContent = t("exercise_ui.correct");
      content.appendChild(fb);

      const examplesDiv = document.createElement("div");
      examplesDiv.className = "shorts-examples";

      const examplesTitle = document.createElement("div");
      examplesTitle.className = "shorts-examples-title";
      examplesTitle.textContent = t("shorts_ui.examples_title");
      examplesDiv.appendChild(examplesTitle);

      const scriptMode = settings.scriptMode || "cyr";

      if (scriptMode === "cyr" || scriptMode === "mixed") {
        const exCyr = document.createElement("div");
        exCyr.className = "shorts-example-item";
        exCyr.textContent = currentEntry.example_sr.cyr;
        examplesDiv.appendChild(exCyr);
      }

      if (scriptMode === "lat" || scriptMode === "mixed") {
        const exLat = document.createElement("div");
        exLat.className = "shorts-example-item";
        exLat.textContent = currentEntry.example_sr.lat;
        examplesDiv.appendChild(exLat);
      }

      content.appendChild(examplesDiv);
    }

    renderActionBar();
  }

  function renderActionBar() {
    actionBar.innerHTML = "";

    if (isChecked) {
      const btnNext = document.createElement("button");
      btnNext.className = "btn btn-primary";
      btnNext.style.width = "100%";
      btnNext.textContent = t("shorts_ui.continue");
      btnNext.addEventListener("click", loadNewRound);
      actionBar.appendChild(btnNext);
    } else {
      const btnCheck = document.createElement("button");
      btnCheck.className = "btn btn-primary";
      btnCheck.style.width = "100%";
      btnCheck.textContent = t("exercise_ui.check");
      btnCheck.disabled = selectedIdx < 0;
      btnCheck.addEventListener("click", handleCheck);
      actionBar.appendChild(btnCheck);
    }
  }

  function handleCheck() {
    if (selectedIdx < 0 || isChecked) return;

    const chosen = options[selectedIdx];
    const correct = chosen.isCorrect;

    recordAttempt("shorts", correct);

    if (correct) {
      isChecked = true;
      showError = false;
    } else {
      showError = true;
      selectedIdx = -1;
    }

    renderBoard();
  }

  // ── Initial load ────────────────────────────────────────────
  loadNewRound();
}
