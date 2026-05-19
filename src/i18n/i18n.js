/**
 * i18n — simple internationalization module.
 */

let _strings = {};
let _lang = "en";

export async function loadLanguage(lang) {
  _lang = lang;
  try {
    const resp = await fetch(`data/ui/${lang}.json`);
    _strings = await resp.json();
  } catch (e) {
    console.warn(`i18n: failed to load ${lang}, falling back to en`);
    if (lang !== "en") {
      const resp = await fetch("data/ui/en.json");
      _strings = await resp.json();
    }
  }
}

/**
 * Get a translated string by dot-path key.
 * Example: t("menu.title") -> "Choose an exercise"
 */
export function t(key) {
  const parts = key.split(".");
  let val = _strings;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined) return key;
  }
  return val;
}

export function getCurrentLang() {
  return _lang;
}
