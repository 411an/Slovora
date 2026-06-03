import { t } from "../i18n/i18n.js";
import { getTemplateIds } from "../engine/generator.js";
import { loadSettings } from "../storage/storage.js";

const ICONS = {
  "biti-short-basic": "🔤",
  "demonstrative-basic": "👉",
  "da-li-question": "❓",
  "short-answer": "💬",
  "full-answer": "📝",
  "false-friends": "🎭",
  "shorts": "⏳",
  "readme": "📖",
};

export function renderMenu(container) {
  const settings = loadSettings();
  const templates = getTemplateIds();

  container.innerHTML = "";
  container.className = "screen-enter";

  // Header
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <span class="header-logo">Slovora</span>
    <div class="header-actions">
      <button class="btn-icon" id="btn-stats" title="${t("menu.stats")}">📊</button>
      <button class="btn-icon" id="btn-settings" title="${t("menu.settings")}">⚙️</button>
    </div>
  `;
  container.appendChild(header);

  // Title
  const title = document.createElement("h2");
  title.textContent = t("menu.title");
  title.style.cssText = "font-size:1rem;color:var(--text-secondary);margin-bottom:4px;";
  container.appendChild(title);

  // Exercise grid
  const grid = document.createElement("div");
  grid.className = "menu-grid";

  for (const tid of templates) {
    const card = document.createElement("div");
    card.className = "menu-card";
    card.dataset.templateId = tid;

    const exData = t(`exercises.${tid}`) || {};
    card.innerHTML = `
      <div class="menu-card-icon">${ICONS[tid] || "📚"}</div>
      <div class="menu-card-text">
        <h3>${exData.title || tid}</h3>
        <p>${exData.desc || ""}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      location.hash = `#exercise/${tid}`;
    });

    grid.appendChild(card);
  }

  // False friends (only for Russian)
  if (settings.nativeLanguage === "ru") {
    const ffCard = document.createElement("div");
    ffCard.className = "menu-card";
    const ffData = t("exercises.false-friends") || {};
    ffCard.innerHTML = `
      <div class="menu-card-icon">${ICONS["false-friends"]}</div>
      <div class="menu-card-text">
        <h3>${ffData.title || "False friends"}</h3>
        <p>${ffData.desc || ""}</p>
      </div>
    `;
    ffCard.addEventListener("click", () => {
      location.hash = "#false-friends";
    });
    grid.appendChild(ffCard);
  }

  // Shorts (short words of place and time) — available for both languages
  const shortsCard = document.createElement("div");
  shortsCard.className = "menu-card";
  const shortsData = t("exercises.shorts") || {};
  shortsCard.innerHTML = `
      <div class="menu-card-icon">${ICONS.shorts}</div>
      <div class="menu-card-text">
        <h3>${shortsData.title || "Shorts"}</h3>
        <p>${shortsData.desc || ""}</p>
      </div>
    `;
  shortsCard.addEventListener("click", () => {
    location.hash = "#shorts";
  });
  grid.appendChild(shortsCard);

  // Plural — available for both languages
  const pluralCard = document.createElement("div");
  pluralCard.className = "menu-card";
  const pluralData = t("exercises.plural") || {};
  pluralCard.innerHTML = `
      <div class="menu-card-icon">🔄</div>
      <div class="menu-card-text">
        <h3>${pluralData.title || "Plural"}</h3>
        <p>${pluralData.desc || ""}</p>
      </div>
    `;
  pluralCard.addEventListener("click", () => {
    location.hash = "#plural";
  });
  grid.appendChild(pluralCard);

  const readmeCard = document.createElement("div");
  readmeCard.className = "menu-card";
  const readmeData = t("menu.readme");
  const readmeTitle = typeof readmeData === "object" ? readmeData.title : "README";
  const readmeDesc = typeof readmeData === "object" ? readmeData.desc : "";
  readmeCard.innerHTML = `
      <div class="menu-card-icon">${ICONS.readme}</div>
      <div class="menu-card-text">
        <h3>${readmeTitle}</h3>
        <p>${readmeDesc}</p>
      </div>
    `;
  readmeCard.addEventListener("click", () => {
    location.hash = "#readme";
  });
  grid.appendChild(readmeCard);

  container.appendChild(grid);

  // Event listeners
  container.querySelector("#btn-settings").addEventListener("click", () => {
    location.hash = "#settings";
  });
  container.querySelector("#btn-stats").addEventListener("click", () => {
    location.hash = "#stats";
  });
}
