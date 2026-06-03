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
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Updating Data

There is no CSV source pipeline now. Edit the JSON files directly:

- Serbian lexemes and forms: `data/languages/sr/lexicon.json`
- Serbian grammar help tables: `data/languages/sr/grammar.json`
- Native-language concepts: `data/languages/native/en/concepts.json` and `data/languages/native/ru/concepts.json`
- UI strings: `data/ui/en.json` and `data/ui/ru.json`

### Tag System

Every entry in `lexicon.json` has a `tags` array. Tags fall into three groups:

**Exercise tags** (determine which exercises use the word):
- `predicate_nominal` — noun used in biti and demonstrative construction exercises
- `plural` — noun appears in the plural study exercise
- `subject` — pronoun available as a subject

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

## Tests And Logs

The main test runner generates random exercises, checks grammar and answer validation rules, and writes the generated samples to `tests/exercise_log.json`:

```bash
node tests/test_runner.js
```

To inspect a random sample from the latest exercise log:

```bash
python tools/sample_logs.py
```

Keep both files: the test runner and the sample-log reader are the current sanity-check loop for generated tasks.

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
