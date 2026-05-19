import { t } from "../i18n/i18n.js";
import { loadSettings, saveSettings, resetSettings } from "../storage/storage.js";
import { reloadApp } from "../app.js";

export function renderSettings(container) {
  const settings = loadSettings();

  container.innerHTML = "";
  container.className = "screen-enter";

  // Header
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <button class="btn-back" id="btn-back">←</button>
    <div class="header-title">${t("settings_ui.title")}</div>
    <div style="width: 40px"></div> <!-- spacer for alignment -->
  `;
  container.appendChild(header);

  const content = document.createElement("div");
  content.style.marginTop = "16px";

  // Section: Language
  const langSection = document.createElement("div");
  langSection.className = "settings-section";
  langSection.innerHTML = `
    <h3>${t("settings_ui.native_lang")}</h3>
    <div class="settings-row">
      <select id="sel-lang" style="width:100%; padding:8px; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-family:var(--font-ui);">
        <option value="ru" ${settings.nativeLanguage === "ru" ? "selected" : ""}>Русский</option>
        <option value="en" ${settings.nativeLanguage === "en" ? "selected" : ""}>English</option>
      </select>
    </div>
  `;
  content.appendChild(langSection);

  // Section: Script
  const scriptSection = document.createElement("div");
  scriptSection.className = "settings-section";
  scriptSection.innerHTML = `
    <h3>${t("settings_ui.script")}</h3>
    <div class="settings-row">
      <div class="toggle-group" id="grp-script" style="width:100%; display:flex;">
        <button style="flex:1" data-val="cyr" ${settings.scriptMode === "cyr" ? 'class="active"' : ''}>${t("settings_ui.script_cyr")}</button>
        <button style="flex:1" data-val="lat" ${settings.scriptMode === "lat" ? 'class="active"' : ''}>${t("settings_ui.script_lat")}</button>
        <button style="flex:1" data-val="mixed" ${settings.scriptMode === "mixed" ? 'class="active"' : ''}>${t("settings_ui.script_mixed")}</button>
      </div>
    </div>
  `;
  content.appendChild(scriptSection);

  // Reset Button
  const resetBtn = document.createElement("button");
  resetBtn.className = "btn btn-secondary";
  resetBtn.style.width = "100%";
  resetBtn.style.marginTop = "24px";
  resetBtn.textContent = t("settings_ui.reset_settings");
  resetBtn.addEventListener("click", () => {
    resetSettings();
    reloadApp();
  });
  content.appendChild(resetBtn);

  container.appendChild(content);

  // Listeners
  header.querySelector("#btn-back").addEventListener("click", () => {
    location.hash = "#menu";
  });

  content.querySelector("#sel-lang").addEventListener("change", async (e) => {
    settings.nativeLanguage = e.target.value;
    saveSettings(settings);
    await reloadApp(); // Re-render whole app to apply language
  });

  content.querySelector("#grp-script").addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      content.querySelectorAll("#grp-script button").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      settings.scriptMode = e.target.dataset.val;
      saveSettings(settings);
    }
  });

}
