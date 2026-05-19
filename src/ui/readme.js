import { t, getCurrentLang } from "../i18n/i18n.js";

const README_BY_LANG = {
  en: "README.md",
  ru: "README.ru.md",
};

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInline(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function appendParagraph(container, lines) {
  if (!lines.length) return;
  const p = document.createElement("p");
  p.innerHTML = formatInline(lines.join(" "));
  container.appendChild(p);
  lines.length = 0;
}

function appendList(container, items) {
  if (!items.length) return;
  const list = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = formatInline(item);
    list.appendChild(li);
  }
  container.appendChild(list);
  items.length = 0;
}

function renderMarkdown(markdown) {
  const root = document.createElement("div");
  root.className = "readme-content";

  const paragraph = [];
  const listItems = [];
  let codeBlock = null;

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("```")) {
      appendParagraph(root, paragraph);
      appendList(root, listItems);
      if (codeBlock) {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeBlock.join("\n");
        pre.appendChild(code);
        root.appendChild(pre);
        codeBlock = null;
      } else {
        codeBlock = [];
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.push(line);
      continue;
    }

    if (!line.trim()) {
      appendParagraph(root, paragraph);
      appendList(root, listItems);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      appendParagraph(root, paragraph);
      appendList(root, listItems);
      const level = String(Math.min(heading[1].length + 1, 4));
      const h = document.createElement(`h${level}`);
      h.innerHTML = formatInline(heading[2]);
      root.appendChild(h);
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      appendParagraph(root, paragraph);
      listItems.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      appendParagraph(root, paragraph);
      listItems.push(numbered[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  appendParagraph(root, paragraph);
  appendList(root, listItems);
  return root;
}

export async function renderReadme(container) {
  container.innerHTML = "";
  container.className = "screen-enter";

  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <button class="btn-back" id="btn-back">←</button>
    <div class="header-title">${t("readme_ui.title")}</div>
    <div style="width: 40px"></div>
  `;
  container.appendChild(header);

  const content = document.createElement("div");
  content.className = "readme-shell";
  container.appendChild(content);

  header.querySelector("#btn-back").addEventListener("click", () => {
    location.hash = "#menu";
  });

  const lang = getCurrentLang();
  const path = README_BY_LANG[lang] || README_BY_LANG.en;

  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    content.appendChild(renderMarkdown(await resp.text()));
  } catch (e) {
    const p = document.createElement("p");
    p.className = "feedback error";
    p.textContent = t("readme_ui.load_error");
    content.appendChild(p);
  }
}
