/**
 * Card Factory — creates runtime card instances from lexicon data.
 */

let _cardCounter = 0;

/**
 * Create a runtime card instance.
 *
 * @param {object} lexeme   — full lexeme object from lexicon
 * @param {string} formKey  — e.g. "nom_sg", "base", "present_short_1sg"
 * @param {string} script   — "cyr" or "lat"
 * @returns {object} runtime card
 */
export function createCard(lexeme, formKey, script) {
  const form = lexeme.forms?.[formKey];
  if (!form) {
    throw new Error(`No form "${formKey}" in lexeme "${lexeme.id}"`);
  }

  const display = form[script];
  if (!display) {
    throw new Error(`No "${script}" script for form "${formKey}" in lexeme "${lexeme.id}"`);
  }

  // For biti forms, grammar is nested inside the form object
  const grammar = form.grammar || lexeme.grammar || {};

  _cardCounter++;

  return {
    cardInstanceId: `card_${_cardCounter}`,
    lexemeId: lexeme.id,
    formKey,
    display,
    language: "sr",
    script,
    type: lexeme.type,
    grammar: { ...grammar },
    translations: lexeme.translations ? { ...lexeme.translations } : {},
  };
}

/**
 * Reset the card counter (useful for tests).
 */
export function resetCardCounter() {
  _cardCounter = 0;
}
