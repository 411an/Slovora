/**
 * Lexicon — загрузка, индексация и запросы к словарю.
 *
 * Индексы:
 *   byId   : Map<string, Lexeme>
 *   byType : Map<string, Lexeme[]>
 *   byTag  : Map<string, Lexeme[]>
 */

export class Lexicon {
  constructor() {
    /** @type {Lexeme[]} */
    this.entries = [];
    /** @type {Map<string, object>} */
    this.byId = new Map();
    /** @type {Map<string, object[]>} */
    this.byType = new Map();
    /** @type {Map<string, object[]>} */
    this.byTag = new Map();
  }

  /**
   * Load lexicon from a URL (browser) or from a raw array (Node tests).
   * @param {string|object[]} source — URL string or pre-parsed array
   */
  async load(source) {
    if (typeof source === "string") {
      const resp = await fetch(source);
      this.entries = await resp.json();
    } else if (Array.isArray(source)) {
      this.entries = source;
    } else {
      throw new Error("Lexicon.load: expected URL string or array");
    }
    this._buildIndices();
  }

  /** Build lookup indices after loading. */
  _buildIndices() {
    this.byId.clear();
    this.byType.clear();
    this.byTag.clear();

    for (const entry of this.entries) {
      // By ID
      this.byId.set(entry.id, entry);

      // By type
      if (!this.byType.has(entry.type)) {
        this.byType.set(entry.type, []);
      }
      this.byType.get(entry.type).push(entry);

      // By tag
      if (entry.tags) {
        for (const tag of entry.tags) {
          if (!this.byTag.has(tag)) {
            this.byTag.set(tag, []);
          }
          this.byTag.get(tag).push(entry);
        }
      }
    }
  }

  /**
   * Query lexemes by a combination of filters.
   * All provided filters must match (AND logic).
   *
   * @param {object} filter
   * @param {string}   [filter.type]             — lexeme type (noun, pronoun, etc.)
   * @param {string[]} [filter.tags]             — all tags must be present
   * @param {string}   [filter.gender]           — grammar.gender must match
   * @param {string}   [filter.canPredicateFor]  — semantics.canPredicateFor must contain this value
   * @param {string}   [filter.subtype]          — subtype must match
   * @param {Function} [filter.custom]           — arbitrary predicate (lexeme) => boolean
   * @returns {object[]}
   */
  query(filter) {
    let candidates = this.entries;

    // Narrow by type index first (fast path)
    if (filter.type) {
      candidates = this.byType.get(filter.type) || [];
    }

    return candidates.filter((lex) => {
      // Tags: all must be present
      if (filter.tags) {
        for (const t of filter.tags) {
          if (!lex.tags || !lex.tags.includes(t)) return false;
        }
      }

      // Gender
      if (filter.gender && lex.grammar?.gender !== filter.gender) {
        return false;
      }

      // Semantic predicate compatibility
      if (filter.canPredicateFor) {
        const cps = lex.semantics?.canPredicateFor;
        if (!cps || !cps.includes(filter.canPredicateFor)) return false;
      }

      // Subtype
      if (filter.subtype && lex.subtype !== filter.subtype) {
        return false;
      }

      // Custom predicate
      if (filter.custom && !filter.custom(lex)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get a specific form string in a given script.
   * @param {string} lexemeId
   * @param {string} formKey  — e.g. "nom_sg", "base", "present_short_1sg"
   * @param {string} script   — "cyr" or "lat"
   * @returns {string|null}
   */
  getForm(lexemeId, formKey, script) {
    const lex = this.byId.get(lexemeId);
    if (!lex) return null;
    const form = lex.forms?.[formKey];
    if (!form) return null;
    return form[script] || null;
  }

  /**
   * Get the full form object for a lexeme.
   * @param {string} lexemeId
   * @param {string} formKey
   * @returns {object|null}  — { cyr, lat, grammar? }
   */
  getFormObject(lexemeId, formKey) {
    const lex = this.byId.get(lexemeId);
    if (!lex) return null;
    return lex.forms?.[formKey] || null;
  }
}
