/**
 * Slovora — Main Application Entry Point
 * Hash-based SPA routing: #menu, #exercise/:id, #settings, #stats
 */

import { Lexicon } from "./engine/lexicon.js";
import { loadLanguage } from "./i18n/i18n.js";
import { loadSettings } from "./storage/storage.js";
import { renderMenu } from "./ui/menu.js";
import { renderExercise } from "./ui/exercise.js";
import { renderSettings } from "./ui/settings.js";
import { renderStats } from "./ui/stats.js";
import { renderFalseFriends } from "./ui/false_friends.js";
import { renderShorts } from "./ui/shorts.js";
import { renderReadme } from "./ui/readme.js";
import { PromptBuilder } from "./engine/prompt_builder.js";

const app = document.getElementById("app");

/** @type {Lexicon} */
let lexicon = null;
let promptBuilder = null;

async function init() {
  const settings = loadSettings();
  await loadLanguage(settings.nativeLanguage);

  lexicon = new Lexicon();
  await lexicon.load("data/languages/sr/lexicon.json");

  promptBuilder = new PromptBuilder();
  await promptBuilder.load(settings.nativeLanguage);

  window.addEventListener("hashchange", route);
  route();
}

function route() {
  const hash = location.hash || "#menu";

  if (hash === "#menu") {
    renderMenu(app);
  } else if (hash.startsWith("#exercise/")) {
    const templateId = hash.replace("#exercise/", "");
    renderExercise(app, lexicon, promptBuilder, templateId);
  } else if (hash === "#false-friends") {
    renderFalseFriends(app);
  } else if (hash === "#shorts") {
    renderShorts(app);
  } else if (hash === "#settings") {
    renderSettings(app);
  } else if (hash === "#stats") {
    renderStats(app);
  } else if (hash === "#readme") {
    renderReadme(app);
  } else {
    location.hash = "#menu";
  }
}

// Re-export for UI modules that need to reload i18n
export async function reloadApp() {
  const settings = loadSettings();
  await Promise.all([
    loadLanguage(settings.nativeLanguage),
    promptBuilder.load(settings.nativeLanguage)
  ]);
  route();
}

export function getLexicon() {
  return lexicon;
}

init();
