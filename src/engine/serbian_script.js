const LAT_TO_CYR_SINGLE = {
  a: "а",
  b: "б",
  c: "ц",
  č: "ч",
  ć: "ћ",
  d: "д",
  đ: "ђ",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "ј",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  š: "ш",
  t: "т",
  u: "у",
  v: "в",
  z: "з",
  ž: "ж",
};

const LAT_TO_CYR_DIGRAPH = {
  dž: "џ",
  lj: "љ",
  nj: "њ",
};

function applyCase(source, cyrLower) {
  if (source === source.toUpperCase()) return cyrLower.toUpperCase();
  const first = source[0];
  if (first === first.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return cyrLower[0].toUpperCase() + cyrLower.slice(1);
  }
  return cyrLower;
}

export function latToCyr(text) {
  if (!text) return "";

  let result = "";
  let i = 0;

  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    const pairLower = pair.toLowerCase();

    if (LAT_TO_CYR_DIGRAPH[pairLower]) {
      result += applyCase(pair, LAT_TO_CYR_DIGRAPH[pairLower]);
      i += 2;
      continue;
    }

    const char = text[i];
    const lower = char.toLowerCase();
    const mapped = LAT_TO_CYR_SINGLE[lower];
    result += mapped ? applyCase(char, mapped) : char;
    i += 1;
  }

  return result;
}

export function srTextFromLatin(text, script) {
  return script === "cyr" ? latToCyr(text) : text;
}
