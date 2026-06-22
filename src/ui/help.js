import { t, getCurrentLang } from "../i18n/i18n.js";

import { renderMarkdown } from "./plural_help.js";

let grammarData = null;

async function loadGrammar() {
  if (grammarData) return grammarData;
  try {
    const resp = await fetch("data/languages/sr/grammar.json", { cache: "no-store" });
    grammarData = await resp.json();
    return grammarData;
  } catch (e) {
    console.error("Failed to load grammar.json", e);
    return null;
  }
}

export async function renderHelp(exercise) {
  const grammar = await loadGrammar();
  if (!grammar) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const content = document.createElement("div");
  content.className = "modal-content modal-content-wide";
  content.style.maxWidth = "1000px";
  overlay.appendChild(content);

  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("h2");
  title.textContent = t("exercise_ui.help");

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = "✕";
  closeBtn.addEventListener("click", () => document.body.removeChild(overlay));

  header.appendChild(title);
  header.appendChild(closeBtn);
  content.appendChild(header);

  // If no tables available
  if (!exercise || !exercise.availableHelpTables || exercise.availableHelpTables.length === 0) {
    const p = document.createElement("p");
    p.textContent = t("exercise_ui.help_missing");
    content.appendChild(p);
    document.body.appendChild(overlay);
    return;
  }

  // Tabs for available tables
  const lang = getCurrentLang();
  const availableTableKeys = exercise.availableHelpTables.filter(key => grammar.tables[key]);
  let currentTableKey = availableTableKeys.includes(exercise.defaultHelpTable)
    ? exercise.defaultHelpTable
    : availableTableKeys[0];

  if (!currentTableKey) {
    const p = document.createElement("p");
    p.textContent = t("exercise_ui.help_missing");
    content.appendChild(p);
    document.body.appendChild(overlay);
    return;
  }

  const tabContainer = document.createElement("div");
  tabContainer.className = "tab-selector";
  content.appendChild(tabContainer);

  const tableContainer = document.createElement("div");
  content.appendChild(tableContainer);

  function renderTabs() {
    tabContainer.innerHTML = "";
    availableTableKeys.forEach(key => {
      const tableData = grammar.tables[key];

      const btn = document.createElement("button");
      btn.textContent = tableData.title[lang] || tableData.title.ru;
      if (key === currentTableKey) btn.classList.add("active");

      btn.addEventListener("click", () => {
        currentTableKey = key;
        renderTabs();
        renderTable();
      });
      tabContainer.appendChild(btn);
    });
  }

  function renderTable() {
    tableContainer.innerHTML = "";
    const tableData = grammar.tables[currentTableKey];
    if (!tableData) return;
    if (tableData.kind === "markdown") {
      renderMarkdownTable(tableData);
      return;
    }

    const table = document.createElement("table");
    table.className = "grammar-table";

    // Extract headers from the first row keys
    if (tableData.rows.length === 0) return;
    const firstRow = tableData.rows[0];
    const keys = Object.keys(firstRow);
    const columns = tableData.columns || {};

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    keys.forEach(k => {
      // Language-filtered columns: skip if suffix doesn't match current lang
      if ((k.endsWith("_ru") || k.endsWith("_en")) && !k.endsWith(`_${lang}`)) return;

      const th = document.createElement("th");

      // Use localized column name from table definition if available
      if (columns[k] && columns[k][lang]) {
        th.textContent = columns[k][lang];
      } else if (columns[k] && columns[k].ru) {
        th.textContent = columns[k].ru;
      } else {
        // Fallback: format key name
        let prettyKey = k.replace(/_/g, " ");
        if (prettyKey.endsWith(" cyr")) prettyKey = prettyKey.replace(" cyr", " (Cyr)");
        if (prettyKey.endsWith(" lat")) prettyKey = prettyKey.replace(" lat", " (Lat)");
        th.textContent = prettyKey;
      }

      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    tableData.rows.forEach(row => {
      const tr = document.createElement("tr");
      keys.forEach(k => {
        if (k.endsWith("_ru") && lang !== "ru") return;
        if (k.endsWith("_en") && lang !== "en") return;

        const td = document.createElement("td");
        td.textContent = row[k] || "";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableContainer.appendChild(table);

    if (Array.isArray(tableData.notes) && tableData.notes.length) {
      const notes = document.createElement("div");
      notes.className = "grammar-notes";
      tableData.notes.forEach(note => {
        const p = document.createElement("p");
        if (typeof note === "string") {
          p.textContent = note;
        } else {
          p.textContent = note[lang] || note.ru || note.en || "";
        }
        if (p.textContent) notes.appendChild(p);
      });
      tableContainer.appendChild(notes);
    }
  }

  async function renderMarkdownTable(tableData) {
    const url = tableData.files?.[lang] || tableData.files?.ru || tableData.files?.en;
    if (!url) return;
    const requestedTableKey = currentTableKey;

    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
      const md = await resp.text();
      if (currentTableKey !== requestedTableKey) return;
      tableContainer.innerHTML = "";
      tableContainer.appendChild(renderMarkdown(md));
    } catch (e) {
      if (currentTableKey !== requestedTableKey) return;
      console.error("Failed to load help markdown:", e);
      const p = document.createElement("p");
      p.textContent = t("exercise_ui.help_missing");
      tableContainer.appendChild(p);
    }
  }

  renderTabs();
  renderTable();

  // Close on outside click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });

  document.body.appendChild(overlay);
}
