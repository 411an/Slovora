# Slovora - Serbian Language Trainer

Slovora is a small single page app for practicing Serbian grammar and vocabulary with card-based exercises. The interface supports English and Russian native-language prompts; English is the default.

## Architecture

The app is intentionally lightweight:

- Frontend: vanilla JavaScript ES modules, HTML, and CSS.
- Routing: hash-based routes such as `#menu`, `#exercise/biti-short-basic`, `#false-friends`, and `#readme`.
- Runtime data: browser-loaded JSON files under `data/`.
- Exercise engine: generation, prompts, and answer checking live under `src/engine/`.

Slovora uses concept IDs to connect Serbian lexemes with native-language labels. The Serbian lexicon in `data/languages/sr/lexicon.json` stores forms and grammar metadata. Native-language concept files in `data/languages/native/en/concepts.json` and `data/languages/native/ru/concepts.json` provide prompt text for those same concepts.

## Running Locally

Because the app uses ES modules and `fetch()`, run it through a local static server from the project root:

```bash
python -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Updating Data

There is no CSV source pipeline now. Edit the JSON files directly:

- Serbian lexemes and forms: `data/languages/sr/lexicon.json`
- Serbian adjective paradigms: `data/languages/sr/adjectives.json`
- Serbian verb paradigms: `data/languages/sr/verbs.json`
- Serbian possessive/question paradigms: `data/languages/sr/possessives.json`
- Serbian grammar help tables: `data/languages/sr/grammar.json`
- Native-language concepts: `data/languages/native/en/concepts.json` and `data/languages/native/ru/concepts.json`
- Native-language possessive owner labels: `data/languages/native/en/owners.json` and `data/languages/native/ru/owners.json`
- UI strings: `data/ui/en.json` and `data/ui/ru.json`

### Local srLexv13 Notes

The large `srLexv13` dictionary is local-only and is ignored by Git. Local helper scripts and notes live under `local_srlex/`, which is also ignored. Use this dictionary for preparing new trainer data, then commit only the compact JSON files under `data/`.

`srLexv13` is tab-separated. The useful columns are:

- Column 1: surface form, for example `volim`.
- Column 2: lemma/base form, for example `voleti`.
- Column 3: compact grammar tag, for example `Vmr1s`.
- Column 4: expanded dictionary features, for example `Type=main|VForm=present|Person=first|Number=singular`.
- Column 5: coarse part of speech, for example `VERB`, `NOUN`, or `ADJ`.
- Column 6: Universal Dependencies features.
- Columns 7-8: corpus frequency data.

Prefer column 4 and column 5 when building scripts. The compact tag is useful for quick reading, but the expanded features are less ambiguous.

### Russian OpenCorpora Notes

Russian noun case forms are enriched locally from `local_srlex/dict.opcorpora.txt` by `local_srlex/extract_russian_concept_forms.py`. The script writes native case keys such as `nom_sg`, `loc_sg`, and `loc_pl` into `data/languages/native/ru/concepts.json`.

Native display forms may include clarifiers in parentheses, for example `утята (выводок)` and `утята (штучно)`. These clarifiers are UI labels, not dictionary words. The extractor strips the parenthetical part only for matching, so both display forms can match OpenCorpora `УТЯТА` while the visible labels stay unchanged.

### Adjectives From srLexv13

Adjectives are stored in `data/languages/sr/adjectives.json`. The current file was generated from `srLexv13` and keeps:

- positive-degree agreement forms;
- normal Serbian Latin letters `č/ć/š/đ/ž`;
- both definite and indefinite paradigms where the dictionary has them;
- one primary learner form plus dictionary alternatives when several variants exist;
- metadata similar to nouns: `type`, `tags`, `grammar`, and `semantics.canDescribe`.

When extracting adjectives from `srLexv13`, filter by:

- column 5: `ADJ`;
- column 4: `Degree=positive`;
- column 4: `Type=general` for ordinary adjectives.

The current extractor intentionally excludes dictionary quantity/accent marks such as `â`, but keeps ordinary Serbian diacritics. It also prefers Ekavian and adjective+noun attributive endings as primary forms. For example, `svetlim` is primary for adjective+noun plural dative/instrumental/locative contexts, while variants such as `svetlima` stay in `alternatives`.

### Verbs From srLexv13

The basic `biti` exercises still use `biti` from `data/languages/sr/lexicon.json`. Ordinary verb data for construction exercises lives in `data/languages/sr/verbs.json`. The current verb construction exercise builds sentences such as `volim da čitam o mostu`, using:

- intro verbs tagged `da_locative_intro`, currently `voleti` and `želeti`;
- action verbs tagged `about_locative`, such as `čitati`, `pisati`, `pričati`, `razgovarati`, `znati`, and `učiti`;
- noun locative forms from `lexicon.json`;
- Russian noun locative forms from `data/languages/native/ru/concepts.json` when the native UI is Russian.

When extracting verbs from `srLexv13`, filter strictly by column 5: `VERB`. A lemma lookup alone is not enough: for `voleti`, the dictionary also contains participial adjectives such as `voljen` (`ADJ`) and `voleći` (`ADV`).

Verb compact tags seen in `srLexv13` follow this pattern:

- `V` = verb.
- second character `m` = main verb (`Type=main`). In the current dictionary scan, all `VERB` rows were `Type=main`.
- third character marks `VForm`: `r` present, `m` imperative, `p` participle, `n` infinitive, `f` future, `a` aorist, `e` imperfect.
- finite forms then use person and number: `1s`, `2s`, `3s`, `1p`, `2p`, `3p`.
- participles use `-` plus number and gender: `sm`, `sf`, `sn`, `pm`, `pf`, `pn`.

Examples:

- `Vmr1s`: main verb, present, first person singular, as in `volim`.
- `Vmr3s`: main verb, present, third person singular, as in `voli`.
- `Vmm2s`: main verb, imperative, second person singular, also `voli`.
- `Vmp-sn`: main verb, active past participle, singular neuter, as in `volelo`.
- `Vmn`: main verb, infinitive, as in `voleti`.
- `Vmf1s`: main verb, future, first person singular, as in `voleću`.

The same surface form can appear in multiple rows. For example, `voli` can be present third person singular (`Vmr3s`) or imperative second person singular (`Vmm2s`). Future scripts should key forms by expanded features such as `present.3sg` or `imperative.2sg`, not by surface text alone.

`verbs.json` separates plain verbs from `se` constructions:

- `verbs`: ordinary verbs such as `raditi`, `zvoniti`, `trčati`, and `ići`.
- `seVerbs`: reserved for a later dedicated construction exercise, currently including `zvati se`, `baviti se`, `šaliti se`, and `seliti se`.

Verb entries also tag their present-tense first-person singular ending for easy filtering:

- `present_1sg_im`, for example `volim`, `radim`, `zvonim`;
- `present_1sg_em`, for example `pišem`, `zovem`;
- `present_1sg_am`, for example `čitam`, `gledam`, `treniram`.

The help table for these three present-tense patterns is `sr.verbs.present.patterns`. The verb construction exercise also attaches `sr.nouns.locative.basic` and the detailed plural Markdown help through `sr.nouns.plural.full`.

### Tag System

Every entry in `lexicon.json` has a `tags` array. Tags fall into three groups:

**Exercise tags** (determine which exercises use the word):
- `predicate_nominal` — noun used in biti and demonstrative construction exercises
- `plural` — noun appears in the plural study exercise
- `subject` — pronoun available as a subject
- `dependent_noun` - context-dependent noun, such as "part/piece/choice", excluded from standalone topic prompts in the verb construction exercise
- `da_locative_intro` - verb can introduce a `da` construction followed by an action about a topic
- `about_locative` - verb can take `o + locative` as a topic complement

**Grammar tags** (describe form or paradigm):
- `biti_full_form`, `biti_short_form` — long/short form of the verb biti

**Semantic tags** (meaning classification):
- `personal` — personal pronoun (I, you, he...)
- `person`, `place`, `object`, `substance` — noun semantic class
- `demonstrative` — demonstrative word; refined by a specific tag (`demonstrative_ovo`)

**Identifying tags**:
- `biti` — the biti lexeme itself
- `question_da_li` — the da li particle
- `demonstrative_ovo` — specifically the demonstrative "ovo"

`basic` and `A1` are level tags, reserved for future difficulty filtering.

The demonstrative exercise is intentionally limited to `ovo` / `this` / `это`. Distance-based demonstratives are not part of the current exercise set.

## False Friends

The Russian-only False Friends game uses `data/languages/sr/falsefriends.json`. It builds rounds from carefully grouped pairs, avoids meaning collisions inside a round, supports split pairs for homonyms, and shows notes through the hint mode.

## Shorts (Short Words)

A multiple-choice quiz for short Serbian words of place and time (e.g. и / i, а / a, кад / kad). The user sees a native sentence with a highlighted word and picks the correct Serbian equivalent from 10 options. Data lives in `data/languages/sr/shorts.json`. Available for both English and Russian interfaces.

## Plural Study

The Plural Study exercise helps learn Serbian plural forms. A word is shown in the native language along with its Serbian singular translation, and the user picks the correct plural from several options.

- Data source: entries tagged `plural` in `data/languages/sr/lexicon.json`.
- Fake (incorrect) plural forms are generated algorithmically based on Serbian noun morphology rules (`src/engine/plural_generator.js`). Generated forms that match the correct answer are discarded immediately.
- Supports Cyrillic, Latin, and Mixed script modes.
- Help window (`?` button) renders detailed plural rules from `data/languages/sr/serbian_plural_rules_latin_*.md`.

## Ownership

The Ownership exercise practices Serbian possessive/question agreement: `čiji/čija/čije` plus possessive forms such as `moj`, `naš`, `njihov`, and a noun form. Data lives in:

- Serbian paradigms: `data/languages/sr/possessives.json`;
- native owner labels: `data/languages/native/en/owners.json` and `data/languages/native/ru/owners.json`;
- noun forms: `data/languages/sr/lexicon.json`.

The Serbian possessive agrees with the owned noun, not with the owner. For example, `njihove flaše` is correct because `flaše` is feminine plural; it does not specify whether the owners are men, women, or children. Native owner data therefore keeps one neutral `their` / `их` owner instead of separate gendered owner-group variants.

## Verb Construction: da + o + Locative

The Verb Construction exercise builds sentences like `volim da čitam o mostu` and `želimo da razgovaramo o ulicama`. It uses six expected cards:

1. subject pronoun;
2. intro verb (`voleti` or `želeti`);
3. `da`;
4. action verb;
5. `o`;
6. locative noun form.

The round always offers 19 cards: 6 correct cards plus 13 balanced distractors across pronouns, both verbs, other action verbs, and noun forms. The global Easy/Hard difficulty setting is intentionally not shown in this exercise because the card count is fixed.

For Russian prompts, the generator requires Russian `loc_sg` / `loc_pl` in `data/languages/native/ru/concepts.json`. If a Russian noun lacks locative prompt data, it is not selected for this exercise. This prevents fallback prompts such as `Тема: ...` from appearing in normal rounds.

## Tests And Logs

The main test runner generates random exercises, checks grammar and answer validation rules, runs a few static data contract checks, and writes the generated samples to `tests/exercise_log.json`:

```bash
node tests/test_runner.js
```

To inspect a random sample from the latest exercise log:

```bash
python tools/sample_logs.py
```

Keep both files: the test runner and the sample-log reader are the current sanity-check loop for generated tasks.

Current static checks include important data contracts such as `flasa.nom_pl = flaše` and unique native owner mappings for each Serbian possessive owner.

## Project Structure

- `data/` - JSON data loaded by the browser.
- `src/app.js` - app entry point and hash router.
- `src/engine/` - lexicon loading, exercise generation, prompt building, and checking.
- `src/ui/` - menu, exercise, settings, stats, help, False Friends, Shorts, Plural, and README screens.
- `tests/test_runner.js` - random exercise validation.
- `tests/exercise_log.json` - generated exercise log used for review.
- `tools/sample_logs.py` - random log sampler.
- `README.md` - English README.
- `README.ru.md` - Russian README.
