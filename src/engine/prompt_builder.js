export class PromptBuilder {
  constructor() {
    this.language = "ru";
    this.concepts = {};
    this.templates = {};
  }

  async load(lang) {
    this.language = lang;
    try {
      const [cResp, tResp] = await Promise.all([
        fetch(`data/languages/native/${lang}/concepts.json`),
        fetch(`data/languages/native/${lang}/promptTemplates.json`)
      ]);
      this.concepts = await cResp.json();
      this.templates = await tResp.json();
    } catch (e) {
      console.error(`Failed to load native language ${lang}`, e);
    }
  }

  getConcept(conceptId) {
    return this.concepts[conceptId] || null;
  }

  _addArticle(word) {
    if (!word) return "";
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    // Very basic heuristic for a/an. A real app might use a dictionary.
    const isVowelSound = vowels.includes(word[0].toLowerCase());
    return (isVowelSound ? "an " : "a ") + word;
  }

  build(templateId, ctx) {
    const tplMap = this.templates[templateId];
    if (!tplMap) return `[Missing template ${templateId}]`;

    // Try to find the specific template rule: e.g. "1sg", or fallback to "default"
    const ruleKey = `${ctx.person || ""}${ctx.number || ""}`; // e.g. "1sg", "3pl"
    let tpl = tplMap[ruleKey] || tplMap["default"] || "";

    if (!tpl) return `[Empty template]`;

    const subC = this.getConcept(ctx.subjectId);
    const predC = this.getConcept(ctx.predicateId);

    let subjectStr = subC ? (subC.forms.subject || subC.forms.sg || subC.labels.default) : `[${ctx.subjectId}]`;
    let predStrSg = predC ? (predC.forms.sg || predC.labels.default) : `[${ctx.predicateId}]`;
    let predStrPl = predC ? (predC.forms.pl || predC.labels.default) : `[${ctx.predicateId}]`;

    // Apply Russian natural phrasing for neuter pronouns (it_n / they_n)
    if (this.language === "ru") {
      if (ctx.subjectId === "it_n") {
        subjectStr = "это";
      } else if (ctx.subjectId === "they_n" && ctx.number === "pl") {
        subjectStr = "это";
      }
    }

    // Apply English articles
    if (this.language === "en" && predC && predC.type === "noun") {
      const sc = ctx.predicateSemanticClass;
      if (sc !== "country" && sc !== "city" && sc !== "name") {
        predStrSg = this._addArticle(predStrSg);
      }
    }

    let res = tpl
      .replace(/{subject}/g, subjectStr)
      .replace(/{predicate_sg}/g, predStrSg)
      .replace(/{predicate_pl}/g, predStrPl);

    return res.charAt(0).toUpperCase() + res.slice(1);
  }
}
