/**
 * Storage — localStorage wrapper for stats and settings.
 */

const STATS_KEY = "slovora_stats";
const SETTINGS_KEY = "slovora_settings";

const DEFAULT_SETTINGS = {
  nativeLanguage: "en",
  targetLanguage: "sr",
  scriptMode: "cyr",
  difficulty: "easy",
};

const DEFAULT_STATS = {
  total: { correct: 0, attempts: 0 },
  recent: [],
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS };
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        total: parsed.total || { ...DEFAULT_STATS.total },
        recent: parsed.recent || [],
      };
    }
  } catch (e) { /* ignore */ }
  return { total: { ...DEFAULT_STATS.total }, recent: [] };
}

export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function resetStats() {
  localStorage.removeItem(STATS_KEY);
  return { total: { correct: 0, attempts: 0 }, recent: [] };
}

export function recordAttempt(templateId, correct) {
  const stats = loadStats();
  stats.total.attempts++;
  if (correct) stats.total.correct++;
  stats.recent.push({
    correct,
    templateId,
    timestamp: Date.now(),
  });
  // Keep only last 25
  if (stats.recent.length > 25) {
    stats.recent = stats.recent.slice(-25);
  }
  saveStats(stats);
  return stats;
}

export function getRecentStats() {
  const stats = loadStats();
  const recent = stats.recent;
  return {
    correct: recent.filter((r) => r.correct).length,
    attempts: recent.length,
  };
}
