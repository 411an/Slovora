/**
 * Checker — verifies user answers against expected exercise slots.
 */

/**
 * Check user's answer against the exercise.
 *
 * @param {object}   exercise  — runtime exercise from generator
 * @param {object[]} userCards — array of card objects the user placed (in order)
 * @returns {object} { correct: boolean, errors: Array<{type, slot?, expected?, got?, card?}> }
 */
export function checkAnswer(exercise, userCards) {
  const expected = exercise.expectedCards;
  const errors = [];

  // Case: completely empty answer
  if (!userCards || userCards.length === 0) {
    for (let i = 0; i < expected.length; i++) {
      errors.push({
        type: "missing_card",
        slot: i,
        expected: expected[i].display,
      });
    }
    return { correct: false, errors };
  }

  // Case: too few cards
  if (userCards.length < expected.length) {
    // Check what's provided first
    for (let i = 0; i < userCards.length; i++) {
      if (userCards[i].cardInstanceId !== expected[i].cardInstanceId) {
        errors.push({
          type: "wrong_card",
          slot: i,
          expected: expected[i].display,
          got: userCards[i].display,
        });
      }
    }
    // Then mark missing
    for (let i = userCards.length; i < expected.length; i++) {
      errors.push({
        type: "missing_card",
        slot: i,
        expected: expected[i].display,
      });
    }
    return { correct: false, errors };
  }

  // Case: too many cards
  if (userCards.length > expected.length) {
    // Check expected slots first
    for (let i = 0; i < expected.length; i++) {
      if (i < userCards.length && userCards[i].cardInstanceId !== expected[i].cardInstanceId) {
        errors.push({
          type: "wrong_card",
          slot: i,
          expected: expected[i].display,
          got: userCards[i].display,
        });
      }
    }
    // Mark extras
    for (let i = expected.length; i < userCards.length; i++) {
      errors.push({
        type: "extra_card",
        card: userCards[i].display,
      });
    }
    return { correct: false, errors };
  }

  // Case: same length — check each slot
  let allCorrect = true;
  for (let i = 0; i < expected.length; i++) {
    if (userCards[i].cardInstanceId !== expected[i].cardInstanceId) {
      allCorrect = false;

      // Determine error type
      const errorType = _classifyError(expected, userCards, i);
      errors.push({
        type: errorType,
        slot: i,
        expected: expected[i].display,
        got: userCards[i].display,
      });
    }
  }

  return { correct: allCorrect, errors };
}

/**
 * Classify the type of error at a specific slot.
 * @private
 */
function _classifyError(expected, userCards, slot) {
  const expectedCard = expected[slot];
  const gotCard = userCards[slot];

  // Check if it's a reordering (card exists in expected but wrong position)
  const isInExpected = expected.some(
    (e) => e.cardInstanceId === gotCard.cardInstanceId
  );
  if (isInExpected) {
    return "wrong_order";
  }

  // Check if it's the same type but wrong form (e.g. wrong biti form)
  if (expectedCard.type === gotCard.type && expectedCard.lexemeId === gotCard.lexemeId) {
    return "wrong_form";
  }

  // Check if it's the same type but different word
  if (expectedCard.type === gotCard.type) {
    return "wrong_card";
  }

  // Generic mismatch
  return "wrong_card";
}

/**
 * Generate a human-readable error message.
 *
 * @param {object} error — single error from checkAnswer result
 * @param {string} lang  — "ru" or "en"
 * @returns {string}
 */
export function getErrorMessage(error, lang = "ru") {
  const messages = {
    wrong_order: {
      ru: "Неверный порядок слов.",
      en: "Wrong word order.",
    },
    wrong_form: {
      ru: "Здесь нужна другая форма глагола.",
      en: "A different verb form is needed here.",
    },
    wrong_card: {
      ru: "Эта карточка не подходит для этого места.",
      en: "This card doesn't belong here.",
    },
    extra_card: {
      ru: "Выбрано лишнее слово.",
      en: "Extra word selected.",
    },
    missing_card: {
      ru: "Не хватает слова.",
      en: "A word is missing.",
    },
  };

  const msg = messages[error.type];
  return msg ? msg[lang] || msg.ru : "Ошибка.";
}
