/**
 * Plural Help — wide modal window that renders .md help files
 * for the Serbian plural rules.
 */

import { t } from "../i18n/i18n.js";

const HELP_FILES = {
  ru: "data/languages/sr/serbian_plural_rules_latin_ru.md",
  en: "data/languages/sr/serbian_plural_rules_latin_en.md",
};

let cachedMd = {};

async function loadMarkdown(lang) {
  if (cachedMd[lang]) return cachedMd[lang];
  const url = HELP_FILES[lang] || HELP_FILES.ru;
  try {
    const resp = await fetch(url, { cache: "no-store" });
    const text = await resp.text();
    cachedMd[lang] = text;
    return text;
  } catch (e) {
    console.error("Failed to load plural help markdown:", e);
    return null;
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render Markdown to HTML elements.
 * Supports: h1-h4, tables, paragraphs, unordered lists, bold, italic, inline code,
 * code blocks (```), links.
 */
export function renderMarkdown(md) {
  const root = document.createElement("div");
  root.className = "plural-help-content";

  const lines = md.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  let paragraphLines = [];
  let listItems = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let tableRows = [];
  let inTable = false;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const p = document.createElement("p");
    p.innerHTML = formatInline(paragraphLines.join(" "));
    root.appendChild(p);
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    const ul = document.createElement("ul");
    for (const item of listItems) {
      const li = document.createElement("li");
      li.innerHTML = formatInline(item);
      ul.appendChild(li);
    }
    root.appendChild(ul);
    listItems = [];
  }

  function flushTable() {
    if (tableRows.length < 2) { tableRows = []; return; }

    const table = document.createElement("table");
    table.className = "grammar-table";

    // Header row
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    const headerCells = parseTableRow(tableRows[0]);
    for (const cell of headerCells) {
      const th = document.createElement("th");
      th.innerHTML = formatInline(cell);
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Separator row (|---|---|) is at index 1, skip it
    const tbody = document.createElement("tbody");
    for (let r = 2; r < tableRows.length; r++) {
      const cells = parseTableRow(tableRows[r]);
      if (cells.length === 0) continue;
      const tr = document.createElement("tr");
      for (const cell of cells) {
        const td = document.createElement("td");
        td.innerHTML = formatInline(cell);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    root.appendChild(table);
    tableRows = [];
  }

  function formatInline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function parseTableRow(line) {
    // Remove leading/trailing | and split by |
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split("|").map(c => c.trim());
  }

  function isTableSeparator(line) {
    return /^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(line.trim());
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        flushParagraph();
        flushList();
        flushTable();
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeBlockLines.join("\n");
        pre.appendChild(code);
        root.appendChild(pre);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Start code block
        flushParagraph();
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      i++;
      continue;
    }

    // Table detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushParagraph();
      flushList();
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      i++;
      continue;
    } else if (inTable) {
      flushTable();
      inTable = false;
      // Don't increment i, re-process this line
    }

    // Headings
    if (line.startsWith("#### ")) {
      flushParagraph(); flushList(); flushTable();
      const h4 = document.createElement("h4");
      h4.innerHTML = formatInline(line.slice(5));
      root.appendChild(h4);
      i++; continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph(); flushList(); flushTable();
      const h3 = document.createElement("h3");
      h3.innerHTML = formatInline(line.slice(4));
      root.appendChild(h3);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph(); flushList(); flushTable();
      const h2 = document.createElement("h2");
      h2.innerHTML = formatInline(line.slice(3));
      root.appendChild(h2);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph(); flushList(); flushTable();
      const h1 = document.createElement("h1");
      h1.innerHTML = formatInline(line.slice(2));
      root.appendChild(h1);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      flushParagraph(); flushList(); flushTable();
      const hr = document.createElement("hr");
      root.appendChild(hr);
      i++; continue;
    }

    // List items
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph(); flushTable();
      const text = line.replace(/^\s*[-*+]\s+/, "");
      listItems.push(text);
      i++; continue;
    }

    // Numbered list items
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph(); flushTable();
      const text = line.replace(/^\s*\d+\.\s+/, "");
      listItems.push(text);
      i++; continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      flushTable();
      i++; continue;
    }

    // Regular paragraph text
    paragraphLines.push(line);
    i++;
  }

  // Flush remaining
  flushParagraph();
  flushList();
  flushTable();
  if (inTable) flushTable();

  return root;
}

export async function renderPluralHelp(lang) {
  const md = await loadMarkdown(lang);
  if (!md) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const content = document.createElement("div");
  content.className = "modal-content modal-content-wide";
  overlay.appendChild(content);

  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("h2");
  title.textContent = t("plural_ui.help_title") || t("exercise_ui.help");

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = "✕";
  closeBtn.addEventListener("click", () => document.body.removeChild(overlay));

  header.appendChild(title);
  header.appendChild(closeBtn);
  content.appendChild(header);

  // Render markdown
  const mdContent = renderMarkdown(md);
  content.appendChild(mdContent);

  // Close on outside click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });

  document.body.appendChild(overlay);
}
