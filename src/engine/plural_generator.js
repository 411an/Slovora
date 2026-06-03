/**
 * Plural Generator — generates fake plural forms for the plural exercise.
 *
 * Rules for generating fake (incorrect) plural forms:
 *
 * ── If word ends in a CONSONANT ──
 * 1) + "и"
 * 2) + "ови"
 * 3) + "е"
 * 4) + "еви"
 * 5) + "аци"
 * 6) + "оци"
 * 7) If ends in -АТ/-АЦ/-АК: remove ending, randomly add -ЦОВИ/-КОВИ/-И
 *    Otherwise: + "ици"
 *
 * ── If word ends in a VOWEL ──
 * For final "о":
 *   → "а", "е", "и", "оли", "ови", "ове", "ци", "аца", "ова"
 * For final "е":
 *   → "ена", "ета", "ићи", "еса", "а", "еве", "еци", "еви", "ево"
 * For final "а":
 *   → "ине", "ива", "ина", "еве", "о", "е", "еци", "ова", "иво"
 *
 * CRITICAL RULE: Generated fake words MUST NOT match the correct answer.
 * If a generated form equals the correct answer, it is discarded immediately.
 */

// ── Character set helpers ──────────────────────────────────────

const CYR_VOWELS = ["а", "е", "и", "о", "у"];
const LAT_VOWELS = ["a", "e", "i", "o", "u"];

const CYR_TO_LAT = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ђ": "đ",
  "е": "e", "ж": "ž", "з": "z", "и": "i", "ј": "j", "к": "k",
  "л": "l", "љ": "lj", "м": "m", "н": "n", "њ": "nj", "о": "o",
  "п": "p", "р": "r", "с": "s", "т": "t", "ћ": "ć", "у": "u",
  "ф": "f", "х": "h", "ц": "c", "ч": "č", "џ": "dž", "ш": "š"
};

const LAT_TO_CYR = {};
for (const [cyr, lat] of Object.entries(CYR_TO_LAT)) {
  LAT_TO_CYR[lat] = cyr;
}

function isCyrillic(str) {
  if (!str) return false;
  return /[а-яђјљњћџш]/i.test(str);
}

function isVowel(char, isCyr) {
  const vowels = isCyr ? CYR_VOWELS : LAT_VOWELS;
  return vowels.includes(char.toLowerCase());
}

function lastChar(str) {
  return str ? str[str.length - 1] : "";
}

function withoutLast(str) {
  return str ? str.slice(0, -1) : "";
}

/**
 * Generate fake plural forms for a given singular word.
 * @param {string} sgWord — singular form (cyr or lat)
 * @param {string} correctPl — the correct plural form (same script as sgWord)
 * @param {number} count — how many fake forms to generate
 * @returns {string[]} array of unique fake plural forms
 */
export function generateFakePlurals(sgWord, correctPl, count) {
  if (!sgWord || !correctPl) return [];

  const isCyr = isCyrillic(sgWord);
  const correctLower = correctPl.toLowerCase().trim();
  const sgLower = sgWord.toLowerCase().trim();

  const candidates = [];

  const last = lastChar(sgLower);
  const endsInVowel = isVowel(last, isCyr);

  if (endsInVowel) {
    // Vowel-ending rules
    const base = withoutLast(sgLower);

    if (last === "о" || last === "o") {
      const suffixes = ["а", "е", "и", "оли", "ови", "ове", "ци", "аца", "ова"];
      for (const s of suffixes) {
        const mapped = isCyr ? s : mapLatSuffix(s);
        candidates.push(base + mapped);
      }
    }

    if (last === "е" || last === "e") {
      const suffixes = ["ена", "ета", "ићи", "еса", "а", "еве", "еци", "еви", "ево"];
      for (const s of suffixes) {
        const mapped = isCyr ? s : mapLatSuffix(s);
        candidates.push(base + mapped);
      }
    }

    if (last === "а" || last === "a") {
      const suffixes = ["ине", "ива", "ина", "еве", "о", "е", "еци", "ова", "иво"];
      for (const s of suffixes) {
        const mapped = isCyr ? s : mapLatSuffix(s);
        candidates.push(base + mapped);
      }
    }
  } else {
    // Consonant-ending rules
    // 1) + "и"
    candidates.push(sgLower + (isCyr ? "и" : "i"));
    // 2) + "ови"
    candidates.push(sgLower + (isCyr ? "ови" : "ovi"));
    // 3) + "е"
    candidates.push(sgLower + (isCyr ? "е" : "e"));
    // 4) + "еви"
    candidates.push(sgLower + (isCyr ? "еви" : "evi"));
    // 5) + "аци"
    candidates.push(sgLower + (isCyr ? "аци" : "aci"));
    // 6) + "оци"
    candidates.push(sgLower + (isCyr ? "оци" : "oci"));

    // 7) If ends in -АТ/-АЦ/-АК (-at/-ac/-ak):
    const last2 = sgLower.slice(-2).toLowerCase();
    const last3 = sgLower.slice(-3).toLowerCase();

    if (isCyr) {
      if (last3 === "аат" || last3 === "еат") {
        // -ат ending — this is a special case, let's look at last 2
      }
    }

    // Check for -at/-ac/-ak endings (Latin and Cyrillic)
    const atEndings = isCyr ? ["ат", "ац", "ак"] : ["at", "ac", "ak"];
    let matchedEnding = null;
    for (const ending of atEndings) {
      if (sgLower.endsWith(ending)) {
        matchedEnding = ending;
        break;
      }
    }

    if (matchedEnding) {
      const stem = sgLower.slice(0, -matchedEnding.length);
      const opts = isCyr
        ? [stem + "цови", stem + "кови", stem + "и"]
        : [stem + "covi", stem + "kovi", stem + "i"];
      for (const o of opts) {
        candidates.push(o);
      }
    } else {
      // Otherwise: + "ици" / "ici"
      candidates.push(sgLower + (isCyr ? "ици" : "ici"));
    }
  }

  // Filter out candidates that match the correct answer
  const filtered = [];
  const seen = new Set();
  for (const c of candidates) {
    const cl = c.toLowerCase().trim();
    if (cl === correctLower) continue; // CRITICAL: must not match correct answer
    if (cl === sgLower) continue;       // must not match the singular form
    if (seen.has(cl)) continue;
    if (!cl || cl.length < 2) continue;
    seen.add(cl);
    filtered.push(c);
  }

  // If we don't have enough, try adding more variations
  if (filtered.length < count) {
    const extraSuffixes = isCyr
      ? ["ићи", "ета", "овићи", "ица", "аћи"]
      : ["ići", "eta", "ovići", "ica", "aći"];
    for (const s of extraSuffixes) {
      if (filtered.length >= count) break;
      const candidate = sgLower + s;
      const cl = candidate.toLowerCase().trim();
      if (cl === correctLower || cl === sgLower || seen.has(cl)) continue;
      seen.add(cl);
      filtered.push(candidate);
    }
  }

  // Shuffle and return
  return shuffle(filtered).slice(0, count);
}

/**
 * Map Cyrillic suffix to Latin.
 */
function mapLatSuffix(cyrSuffix) {
  let result = "";
  for (const ch of cyrSuffix) {
    result += CYR_TO_LAT[ch] || ch;
  }
  return result;
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
 * Pick a random subset of entries from the plural data.
 */
export function pickRandomEntries(data, count) {
  return shuffle([...data]).slice(0, count);
}
