import { t } from "../i18n/i18n.js";
import { loadStats, resetStats } from "../storage/storage.js";

export function renderStats(container) {
  const stats = loadStats();

  container.innerHTML = "";
  container.className = "screen-enter";

  // Header
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <button class="btn-back" id="btn-back">←</button>
    <div class="header-title">${t("stats_ui.title")}</div>
    <div style="width: 40px"></div>
  `;
  container.appendChild(header);

  const content = document.createElement("div");
  content.style.marginTop = "16px";

  // Recent 25
  const recentTotal = stats.recent.length;
  const recentCorrect = stats.recent.filter((r) => r.correct).length;
  const recentPercent = recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 100) : 0;

  // Total
  const allTotal = stats.total.attempts;
  const allCorrect = stats.total.correct;
  const allPercent = allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : 0;

  content.innerHTML = `
    <div class="settings-section">
      <h3>${t("stats_ui.recent_attempts").replace("25", recentTotal)}</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${recentPercent}%</div>
          <div class="stat-label">Точность</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${recentCorrect}/${recentTotal}</div>
          <div class="stat-label">Правильных</div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>За всё время</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${allPercent}%</div>
          <div class="stat-label">Точность</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${allCorrect}/${allTotal}</div>
          <div class="stat-label">Правильных</div>
        </div>
      </div>
    </div>
  `;

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.className = "btn btn-secondary";
  resetBtn.style.width = "100%";
  resetBtn.style.marginTop = "16px";
  resetBtn.textContent = t("stats_ui.reset");
  resetBtn.addEventListener("click", () => {
    if (confirm(t("stats_ui.reset_confirm"))) {
      resetStats();
      renderStats(container);
    }
  });
  content.appendChild(resetBtn);

  container.appendChild(content);

  // Listeners
  header.querySelector("#btn-back").addEventListener("click", () => {
    location.hash = "#menu";
  });
}
