import { t } from "../i18n/i18n.js";
import { loadSettings } from "../storage/storage.js";

let ffData = null;

async function loadFFData() {
  if (ffData) return ffData;
  const resp = await fetch("data/languages/sr/falsefriends.json");
  const rawData = await resp.json();
  ffData = rawData;
  return ffData;
}

function shuffle(arr) {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

function ensureFalseFriendsStyles() {
  if (document.getElementById("ff-locked-pair-styles")) return;

  const style = document.createElement("style");
  style.id = "ff-locked-pair-styles";
  style.textContent = `
    .word-card.ff-locked {
      cursor: default !important;
      position: relative;
      padding-right: 32px;
      user-select: none;
    }

    .word-card.ff-locked::after {
      content: "✓";
      position: absolute;
      right: 12px;
      color: var(--accent-light);
      font-weight: 700;
    }

    .word-card.ff-correct-flash {
      animation: ff-correct-flash 900ms ease-out;
    }

    @keyframes ff-correct-flash {
      0% {
        background: rgba(34, 197, 94, 0.22);
        border-color: rgba(34, 197, 94, 0.85);
        transform: scale(1.015);
      }
      65% {
        background: rgba(34, 197, 94, 0.12);
        border-color: rgba(34, 197, 94, 0.45);
        transform: scale(1);
      }
      100% {
        background: var(--card-bg);
        border-color: var(--border);
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}


function buildExerciseUnits(data) {
  const units = [];
  const activeCards = data.filter(card => card.active !== false);

  activeCards.forEach(card => {
    const collisionGroups = [
      ...(card.collision_groups || []),
      ...(card.batch_exclusion_groups || [])
    ];

    const trapPair = {
      left: {
        text: card.sr_trap.text,
        meaning_id: card.sr_trap.meaning_id,
        source: card
      },
      right: {
        text: card.ru_correct.text,
        meaning_id: card.ru_correct.meaning_id
      }
    };

    const falsePair = {
      left: {
        text: card.sr_for_ru_false.text,
        meaning_id: card.sr_for_ru_false.meaning_id,
        source: card
      },
      right: {
        text: card.ru_false.text,
        meaning_id: card.ru_false.meaning_id
      }
    };

    // Some homonym/polysemy cases are valid linguistically but impossible as
    // a single double-pair card because the same surface word would appear
    // twice on one side. For those, the JSON may set split_pairs=true, and
    // the exercise will include only one of the two pairs in a batch.
    if (card.split_pairs) {
      units.push({ pairs: [trapPair], meanings: [card.sr_trap.meaning_id], collisionGroups });
      units.push({ pairs: [falsePair], meanings: [card.ru_false.meaning_id], collisionGroups });
      return;
    }

    units.push({
      pairs: [trapPair, falsePair],
      meanings: [card.sr_trap.meaning_id, card.ru_false.meaning_id],
      collisionGroups
    });
  });

  return units;
}

function hasDuplicateValues(values) {
  return new Set(values).size !== values.length;
}

function unitHasInternalDuplicate(unit) {
  return hasDuplicateValues(unit.pairs.map(pair => pair.left.text)) ||
         hasDuplicateValues(unit.pairs.map(pair => pair.right.text));
}

function unitConflictsWithBatch(unit, usedMeanings, usedCollisionGroups, usedLeftTexts, usedRightTexts) {
  if (unit.meanings.some(meaning => usedMeanings.has(meaning))) return true;
  if (unit.collisionGroups.some(group => usedCollisionGroups.has(group))) return true;
  if (unit.pairs.some(pair => usedLeftTexts.has(pair.left.text))) return true;
  if (unit.pairs.some(pair => usedRightTexts.has(pair.right.text))) return true;
  return false;
}

function markUnitAsUsed(unit, usedMeanings, usedCollisionGroups, usedLeftTexts, usedRightTexts) {
  unit.meanings.forEach(meaning => usedMeanings.add(meaning));
  unit.collisionGroups.forEach(group => usedCollisionGroups.add(group));
  unit.pairs.forEach(pair => {
    usedLeftTexts.add(pair.left.text);
    usedRightTexts.add(pair.right.text);
  });
}

export async function renderFalseFriends(container) {
  const settings = loadSettings();
  const data = await loadFFData();

  container.innerHTML = "";
  container.className = "screen-enter";

  // Header
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <button class="btn-back" id="btn-back">←</button>
    <div class="header-title">${t("exercises.false-friends.title") || "Ложные друзья"}</div>
    <div style="width: 40px"></div>
  `;
  container.appendChild(header);

  const content = document.createElement("div");
  content.style.flex = "1";
  content.style.display = "flex";
  content.style.flexDirection = "column";
  container.appendChild(content);

  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";
  const checkBtn = document.createElement("button");
  checkBtn.className = "btn btn-primary";
  checkBtn.style.width = "100%";
  checkBtn.textContent = t("exercise_ui.check");
  actionBar.appendChild(checkBtn);
  container.appendChild(actionBar);

  let currentItems = [];
  let rightItems = [];
  let showHints = false;
  let selectedRightIdx = -1;
  let isAnimating = false;
  let draggingRightIdx = -1;

  ensureFalseFriendsStyles();

  function isPairCorrect(idx) {
    return currentItems[idx]?.meaning_id === rightItems[idx]?.meaning_id;
  }

  function lockNewlyCorrectMovedPairs() {
    let lockedSomething = false;

    for (let i = 0; i < rightItems.length; i++) {
      const item = rightItems[i];
      if (!item.locked && item.moved && isPairCorrect(i)) {
        item.locked = true;
        item.justLocked = true;
        lockedSomething = true;
      }
    }

    return lockedSomething;
  }

  function clearJustLockedFlagsSoon() {
    if (!rightItems.some(item => item.justLocked)) return;

    setTimeout(() => {
      rightItems.forEach(item => {
        item.justLocked = false;
      });

      content.querySelectorAll("#ff-right .ff-correct-flash").forEach(card => {
        card.classList.remove("ff-correct-flash");
      });
    }, 950);
  }

  function loadNewBatch() {
    showHints = false;
    selectedRightIdx = -1;
    isAnimating = false;

    const targetPairCount = 10;
    const selectedExercisePairs = [];
    const usedMeanings = new Set();
    const usedCollisionGroups = new Set();
    const usedLeftTexts = new Set();
    const usedRightTexts = new Set();

    const shuffledUnits = shuffle(buildExerciseUnits(data));

    for (const unit of shuffledUnits) {
      if (selectedExercisePairs.length >= targetPairCount) break;
      if (selectedExercisePairs.length + unit.pairs.length > targetPairCount) continue;
      if (unitHasInternalDuplicate(unit)) continue;
      if (unitConflictsWithBatch(unit, usedMeanings, usedCollisionGroups, usedLeftTexts, usedRightTexts)) continue;

      markUnitAsUsed(unit, usedMeanings, usedCollisionGroups, usedLeftTexts, usedRightTexts);
      selectedExercisePairs.push(...unit.pairs);
    }

    currentItems = shuffle(selectedExercisePairs.map(pair => pair.left));
    rightItems = shuffle(selectedExercisePairs.map(pair => ({
      ...pair.right,
      moved: false,
      locked: false,
      justLocked: false
    })));

    renderBoard();
  }

  function renderBoard() {
    content.innerHTML = `
      <div class="exercise-instruction" style="margin-bottom: 16px;">
        Сопоставь сербские слова с похожими на них русскими (ложными друзьями переводчика). Кликни на одно русское слово, затем на другое, чтобы поменять их местами (или перетащи мышкой).
      </div>
      <div class="ff-board" style="display: flex; gap: 12px; margin-bottom: 24px;">
        ${showHints ? `<div class="ff-col" id="ff-hints" style="width: 40px; display: flex; flex-direction: column; gap: 8px;"></div>` : ''}
        <div class="ff-col" id="ff-left" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>
        <div class="ff-col" id="ff-right" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    `;

    const leftCol = content.querySelector("#ff-left");
    const rightCol = content.querySelector("#ff-right");
    const hintsCol = content.querySelector("#ff-hints");

    currentItems.forEach((item, idx) => {
      // Left item (Fixed)
      const lCard = document.createElement("div");
      lCard.className = "word-card";
      lCard.style.width = "100%";
      lCard.style.justifyContent = "center";
      lCard.style.cursor = "default";
      lCard.style.fontSize = "0.95rem";
      lCard.textContent = item.text;
      leftCol.appendChild(lCard);

      // Right item (Draggable/Swappable)
      const rItem = rightItems[idx];
      const rCard = document.createElement("div");
      const rCardClasses = ["word-card"];
      if (selectedRightIdx === idx) rCardClasses.push("in-answer");
      if (rItem.locked) rCardClasses.push("ff-locked");
      if (rItem.justLocked) rCardClasses.push("ff-correct-flash");
      rCard.className = rCardClasses.join(" ");
      rCard.style.width = "100%";
      rCard.style.justifyContent = "center";
      rCard.style.fontSize = "0.95rem";
      rCard.style.textAlign = "center";
      rCard.style.cursor = rItem.locked ? "default" : "grab";
      rCard.textContent = rItem.text;
      rCard.dataset.snapIdx = idx;

      // Click to swap (Mobile fallback). Locked cards stay fixed.
      rCard.addEventListener("click", () => {
        if (isAnimating || rItem.locked) return;

        if (selectedRightIdx === -1) {
          selectedRightIdx = idx;
          renderBoard();
          return;
        }

        if (rightItems[selectedRightIdx]?.locked) {
          selectedRightIdx = -1;
          renderBoard();
          return;
        }

        if (selectedRightIdx !== idx) {
          const temp = rightItems[selectedRightIdx];
          rightItems[selectedRightIdx] = rightItems[idx];
          rightItems[idx] = temp;

          rightItems[selectedRightIdx].moved = true;
          rightItems[idx].moved = true;
          lockNewlyCorrectMovedPairs();
        }

        selectedRightIdx = -1;
        renderBoard();
      });

      // Drag and Drop (Real-time sorting)
      rCard.draggable = !rItem.locked;
      rCard.addEventListener("dragstart", (e) => {
        if (isAnimating || rItem.locked) {
          e.preventDefault();
          return;
        }
        draggingRightIdx = idx;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", idx);
        setTimeout(() => {
          rCard.classList.add("dragging");
          rCard.style.opacity = "0.4";
        }, 0);
      });

      rCard.addEventListener("dragend", () => {
        rCard.classList.remove("dragging");
        rCard.style.opacity = "1";

        // Re-sync array based on the new DOM order, but keep locked rows fixed.
        const rightItemsSnapshot = [...rightItems];
        const newOrder = Array.from(rightCol.children).map(c => parseInt(c.dataset.snapIdx));

        const draggedItem = Number.isInteger(draggingRightIdx)
          ? rightItemsSnapshot[draggingRightIdx]
          : null;
        if (draggedItem) draggedItem.moved = true;

        const unlockedItemsInDomOrder = newOrder
          .map(i => rightItemsSnapshot[i])
          .filter(item => !item.locked);

        let nextUnlockedIdx = 0;
        rightItems = rightItemsSnapshot.map((item, itemIdx) => {
          if (item.locked) return item;
          return unlockedItemsInDomOrder[nextUnlockedIdx++];
        });

        draggingRightIdx = -1;
        selectedRightIdx = -1;
        lockNewlyCorrectMovedPairs();
        renderBoard(); // full re-render to reset data states
      });

      rCard.addEventListener("dragover", (e) => {
        if (isAnimating || draggingRightIdx === -1) return;
        e.preventDefault();
        const draggingEl = rightCol.querySelector(".dragging");
        if (!draggingEl || draggingEl === rCard) return;

        const bounding = rCard.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);

        if (e.clientY - offset > 0) {
          rCard.after(draggingEl);
        } else {
          rCard.before(draggingEl);
        }
      });

      rightCol.appendChild(rCard);

      // Hint item
      if (showHints) {
        const hBtn = document.createElement("button");
        hBtn.className = "btn-icon";
        hBtn.style.width = "100%";
        hBtn.style.height = "44px"; // Match word-card min-height
        hBtn.textContent = "?";
        hBtn.addEventListener("click", () => showHintPopup(item.source));
        hintsCol.appendChild(hBtn);
      }
    });

    clearJustLockedFlagsSoon();
  }

  function showHintPopup(source) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    const modal = document.createElement("div");
    modal.className = "modal-content";
    modal.style.textAlign = "center";

    modal.innerHTML = `
      <h3 style="margin-bottom: 12px; color: var(--accent-light); font-size: 1.3rem;">${source.sr_trap.text} vs ${source.ru_false.text}</h3>
      <p style="margin-bottom: 16px; font-size: 1rem;">
        Сербское <strong style="color:var(--text-primary)">${source.sr_trap.text}</strong> означает <strong style="color:var(--accent-light)">${source.ru_correct.text}</strong>.
      </p>
      <div style="height: 1px; background: var(--border); margin: 16px 0;"></div>
      <p style="color: var(--text-secondary); font-size: 0.95rem;">
        А русское <strong style="color:var(--text-primary)">${source.ru_false.text}</strong> по-сербски будет <strong style="color:var(--accent-light)">${source.sr_for_ru_false.text}</strong>.
      </p>
      ${source.note ? `<p style="margin-top: 14px; color: var(--text-secondary); font-size: 0.9rem;">${source.note}</p>` : ''}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  checkBtn.addEventListener("click", () => {
    if (isAnimating) return;

    let allCorrect = true;
    const errors = [];

    for (let i = 0; i < currentItems.length; i++) {
      if (currentItems[i].meaning_id !== rightItems[i].meaning_id) {
        allCorrect = false;
        errors.push(i);
      }
    }

    if (allCorrect) {
      // Flash green and load new
      const rightCards = content.querySelectorAll("#ff-right .word-card");
      rightCards.forEach(c => {
        c.classList.remove("in-answer");
        c.classList.add("correct");
      });
      isAnimating = true;
      setTimeout(() => {
        loadNewBatch();
      }, 1000);
    } else {
      // Shake wrong ones
      const rightCards = content.querySelectorAll("#ff-right .word-card");
      errors.forEach(idx => {
        rightCards[idx].classList.remove("in-answer");
        rightCards[idx].classList.add("incorrect");
      });
      selectedRightIdx = -1;
      isAnimating = true;
      setTimeout(() => {
        showHints = true;
        isAnimating = false;
        renderBoard(); // Re-render to show hints and remove red classes
      }, 800);
    }
  });

  header.querySelector("#btn-back").addEventListener("click", () => {
    location.hash = "#menu";
  });

  loadNewBatch();
}
