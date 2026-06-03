"""
Verify Serbian noun declensions against srLexv13 dictionary.
Streams the 1GB dictionary file, collects forms for lexicon nouns,
and checks Latin + Cyrillic correctness.

Usage: python tools/verify_against_dict.py
Output: tools/dict_verify_report.txt
"""
import json, os, sys, re
from collections import defaultdict

# ── Config ──
DICT_PATH    = "srLexv13"
LEXICON_PATH = "data/languages/sr/lexicon.json"
REPORT_PATH  = "tools/dict_verify_report.txt"
CORRECTIONS_PATH = "tools/dict_corrections.json"

# ── Cyrillic conversion ──
CYR_TO_LAT = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","ђ":"đ","е":"e","ж":"ž","з":"z",
    "и":"i","ј":"j","к":"k","л":"l","љ":"lj","м":"m","н":"n","њ":"nj","о":"o",
    "п":"p","р":"r","с":"s","т":"t","ћ":"ć","у":"u","ф":"f","х":"h","ц":"c",
    "ч":"č","џ":"dž","ш":"š"
}
LAT_TO_CYR = {v: k for k, v in CYR_TO_LAT.items()}
# Multi-char lat mappings (must be tried first)
LAT_MULTI = {"lj": "љ", "nj": "њ", "dž": "џ", "Lj": "Љ", "Nj": "Њ", "Dž": "Џ",
             "LJ": "Љ", "NJ": "Њ", "DŽ": "Џ"}

def lat_to_cyr(text):
    """Convert Latin Serbian text to Cyrillic."""
    if not text:
        return ""
    result = []
    i = 0
    while i < len(text):
        matched = False
        for length in (2, 1):
            chunk = text[i:i+length]
            if chunk in LAT_MULTI:
                result.append(LAT_MULTI[chunk])
                i += length
                matched = True
                break
        if not matched:
            ch = text[i]
            cyr = LAT_TO_CYR.get(ch.lower(), ch)
            if ch.isupper():
                cyr = cyr.upper() if len(cyr) == 1 else cyr[0].upper() + cyr[1:]
            result.append(cyr)
            i += 1
    return "".join(result)


# ── Case/Number mapping from dictionary format to our keys ──
CASE_MAP = {
    ("nominative",  "singular"):   "nom_sg",
    ("genitive",    "singular"):   "gen_sg",
    ("dative",      "singular"):   "dat_sg",
    ("accusative",  "singular"):   "acc_sg",
    ("vocative",    "singular"):   "voc_sg",
    ("instrumental","singular"):   "ins_sg",
    ("locative",    "singular"):   "loc_sg",
    ("nominative",  "plural"):     "nom_pl",
    ("genitive",    "plural"):     "gen_pl",
    ("dative",      "plural"):     "dat_pl",
    ("accusative",  "plural"):     "acc_pl",
    ("vocative",    "plural"):     "voc_pl",
    ("instrumental","plural"):     "ins_pl",
    ("locative",    "plural"):     "loc_pl",
}

def parse_grammar(grammar_str):
    """Parse 'Type=common|Gender=feminine|Number=singular|Case=instrumental' into dict."""
    result = {}
    for part in grammar_str.split("|"):
        if "=" in part:
            k, v = part.split("=", 1)
            result[k.strip().lower()] = v.strip().lower()
    return result


# ── Load lexicon and collect lemmas ──
print("Loading lexicon...")
with open(LEXICON_PATH, "r", encoding="utf-8") as f:
    lexicon = json.load(f)

# Build lemma sets from all nouns
lemmas_sg = set()      # search by nom_sg.lat
lemmas_pl = {}         # fallback: {nom_pl.lat: entry} for pluralia tantum
noun_by_lemma = defaultdict(list)
pluralia_entries = []  # entries where nom_sg has no dict match

for entry in lexicon:
    if entry.get("type") != "noun":
        continue
    lat_sg = entry.get("forms", {}).get("nom_sg", {}).get("lat", "")
    lat_pl = entry.get("forms", {}).get("nom_pl", {}).get("lat", "")
    if lat_sg:
        lemmas_sg.add(lat_sg.lower())
        noun_by_lemma[lat_sg.lower()].append(entry)
    if lat_pl and lat_pl.lower() not in lemmas_sg:
        lemmas_pl[lat_pl.lower()] = entry

print(f"Found {len(lemmas_sg)} unique nom_sg lemmas + {len(lemmas_pl)} nom_pl fallbacks")


# ── Pass 1: search dictionary by lemma (column 2) ──
print(f"Streaming {DICT_PATH} — Pass 1: searching by nom_sg lemma...")
dict_forms = defaultdict(lambda: defaultdict(set))
alt_lemmas = defaultdict(set)  # {our_search_word: {set of actual dict lemmas where col1==our_search_word}}

line_count = 0
matched_lines = 0

with open(DICT_PATH, "r", encoding="utf-8", errors="replace") as f:
    for line in f:
        line_count += 1
        if line_count % 5_000_000 == 0:
            print(f"  ... {line_count:,} lines, {matched_lines:,} matched so far")

        parts = line.strip().split("\t")
        if len(parts) < 4:
            continue

        wordform = parts[0].strip()
        lemma = parts[1].strip().lower()
        grammar_str = parts[3].strip()

        # Collect alternative lemma mappings: if wordform equals our search word
        # but dictionary lemma is different, store it for pass 2
        wf_lower = wordform.lower()
        if wf_lower in lemmas_sg and lemma != wf_lower:
            alt_lemmas[wf_lower].add(lemma)

        if lemma not in lemmas_sg:
            continue

        matched_lines += 1
        g = parse_grammar(grammar_str)
        case = g.get("case", "")
        number = g.get("number", "")
        key = CASE_MAP.get((case, number))
        if key:
            dict_forms[lemma][key].add(wordform)

found_in_pass1 = set(dict_forms.keys())
not_found_sg = lemmas_sg - found_in_pass1
print(f"Pass 1 done. {line_count:,} lines, {len(found_in_pass1)} lemmas found, {len(not_found_sg)} not found.")


# ── Pass 2: for unfound nom_sg lemmas, try alternative dictionary lemmas ──
if not_found_sg and alt_lemmas:
    # Build set of alternative lemmas to look up
    new_lemmas = set()
    wf_to_alt = {}  # {our_search_word: real_dict_lemma}
    for wf in not_found_sg:
        alts = alt_lemmas.get(wf, set())
        for alt in alts:
            if alt not in found_in_pass1:
                new_lemmas.add(alt)
                wf_to_alt[wf] = alt
                break  # take first alternative

    if new_lemmas:
        print(f"Pass 2: re-streaming for {len(new_lemmas)} alternative lemmas (e.g. sto→stol)...")
        line_count2 = 0
        with open(DICT_PATH, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line_count2 += 1
                parts = line.strip().split("\t")
                if len(parts) < 4:
                    continue
                lemma = parts[1].strip().lower()
                if lemma not in new_lemmas:
                    continue
                wordform = parts[0].strip()
                grammar_str = parts[3].strip()
                g = parse_grammar(grammar_str)
                case = g.get("case", "")
                number = g.get("number", "")
                key = CASE_MAP.get((case, number))
                if key:
                    dict_forms[lemma][key].add(wordform)

        # Remap alternative lemmas back to our search words
        for orig_wf, real_lemma in wf_to_alt.items():
            if dict_forms[real_lemma]:
                dict_forms[orig_wf] = dict_forms[real_lemma]
                found_in_pass1.add(orig_wf)
                not_found_sg.discard(orig_wf)

        print(f"Pass 2 done. Now {len(not_found_sg)} still not found via nom_sg.")


# ── Pass 3: for pluralia tantum, search by nom_pl.lat ──
if not_found_sg:
    # For words still not found: check if they have nom_pl, search by that
    pl_search = {}
    for wf in list(not_found_sg):
        for entry in noun_by_lemma.get(wf, []):
            pl_lat = entry.get("forms", {}).get("nom_pl", {}).get("lat", "")
            if pl_lat and pl_lat.lower() != wf:
                pl_search[pl_lat.lower()] = (wf, entry)

    if pl_search:
        print(f"Pass 3: searching {len(pl_search)} unfound words via nom_pl...")
        # Re-stream for these nom_pl forms — look them up in column 2 (lemma)
        new_pl_lemmas = set(pl_search.keys())
        pl_found = set()

        line_count3 = 0
        with open(DICT_PATH, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line_count3 += 1
                parts = line.strip().split("\t")
                if len(parts) < 4:
                    continue
                lemma = parts[1].strip().lower()
                if lemma not in new_pl_lemmas:
                    continue
                wordform = parts[0].strip()
                grammar_str = parts[3].strip()
                g = parse_grammar(grammar_str)
                case = g.get("case", "")
                number = g.get("number", "")
                # For pluralia tantum, we only care about plural forms
                key = CASE_MAP.get((case, number))
                if key and "pl" in key:  # only plural forms
                    dict_forms[lemma][key].add(wordform)
                    pl_found.add(lemma)

        # Remap back
        for pl_lemma, (orig_wf, entry) in pl_search.items():
            if dict_forms[pl_lemma]:
                dict_forms[orig_wf] = dict_forms[pl_lemma]
                found_in_pass1.add(orig_wf)
                not_found_sg.discard(orig_wf)

        print(f"Pass 3 done. Now {len(not_found_sg)} still not found.")

# ── Log completely unfound entries ──
still_not_found = []
for lemma_lower in sorted(not_found_sg):
    for entry in noun_by_lemma.get(lemma_lower, []):
        still_not_found.append(entry["id"])

if still_not_found:
    print(f"\n*** {len(still_not_found)} nouns completely not found in dictionary ***")
    for nid in still_not_found:
        print(f"  - {nid}")

print(f"\nDone streaming. {len(dict_forms)} lemmas with data collected.")


# ── Compare ──
report_lines = []
corrections = []
total_checked = 0
total_errors = 0
total_no_dict = 0
total_no_form = 0

FORM_KEYS = ["nom_sg","gen_sg","dat_sg","acc_sg","voc_sg","ins_sg","loc_sg",
             "nom_pl","gen_pl","dat_pl","acc_pl","voc_pl","ins_pl","loc_pl"]

for lemma_lower, entries in sorted(noun_by_lemma.items()):
    dict_entry = dict_forms.get(lemma_lower, {})

    if not dict_entry:
        total_no_dict += 1
        report_lines.append(f"\n{'─'*60}")
        report_lines.append(f"LEMMA: {lemma_lower} — NOT FOUND in dictionary")
        for entry in entries:
            report_lines.append(f"  id={entry['id']}")
        continue

    for entry in entries:
        total_checked += 1
        nid = entry["id"]
        lex_forms = entry.get("forms", {})
        errors = []

        for key in FORM_KEYS:
            dict_words = dict_entry.get(key, set())
            lex_word = lex_forms.get(key, {}).get("lat", "")

            if not lex_word:
                continue  # skip empty forms (pluralia tantum)

            if not dict_words:
                if key in ["nom_sg"]:
                    continue  # nom_sg is always there, we matched by it
                total_no_form += 1

            if lex_word.lower() not in {w.lower() for w in dict_words} and dict_words:
                errors.append((key, lex_word, sorted(dict_words)))

        if errors:
            total_errors += 1
            report_lines.append(f"\n{'─'*60}")
            report_lines.append(f"ID: {nid} | lemma: {lemma_lower}")
            report_lines.append(f"  Dictionary forms: {', '.join(sorted(dict_entry.get('nom_sg', set())))}")

            # Build correction
            corrected_forms = {}
            for key in FORM_KEYS:
                lex_val = lex_forms.get(key, {})
                dict_words = dict_entry.get(key, set())
                if dict_words and lex_val.get("lat", "").lower() not in {w.lower() for w in dict_words}:
                    correct_lat = sorted(dict_words)[0]  # pick first/most common
                    correct_cyr = lat_to_cyr(correct_lat)
                    corrected_forms[key] = {"cyr": correct_cyr, "lat": correct_lat}
                    report_lines.append(f"  ✗ {key}: [{lex_val.get('cyr','')}/{lex_val.get('lat','')}] → [{correct_cyr}/{correct_lat}]")
                else:
                    # Keep existing
                    corrected_forms[key] = lex_val

            corrections.append({"id": nid, "forms": corrected_forms})
        else:
            report_lines.append(f"  ✓ {nid} — all forms match dictionary")


# ── Write report ──
report_lines.insert(0, f"Dictionary Verification Report")
report_lines.insert(1, f"{'='*60}")
report_lines.insert(2, f"Lexicon: {LEXICON_PATH}")
report_lines.insert(3, f"Dictionary: {DICT_PATH}")
report_lines.insert(4, f"Total nouns checked: {total_checked}")
report_lines.insert(5, f"Nouns with errors: {total_errors}")
report_lines.insert(6, f"Lemmas not in dictionary (even after pass 2): {total_no_dict}")
report_lines.insert(7, f"Missing form keys in dictionary: {total_no_form}")
report_lines.insert(8, f"Corrections saved to: {CORRECTIONS_PATH}")
report_lines.insert(9, "")
if still_not_found:
    report_lines.insert(10, f"*** COMPLETELY NOT FOUND (needs manual fix): {', '.join(still_not_found)} ***")
    report_lines.insert(11, "")

with open(REPORT_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))

print(f"\nReport saved to: {REPORT_PATH}")
print(f"Total checked: {total_checked} | Errors: {total_errors} | Not in dict: {total_no_dict}")
if still_not_found:
    print(f"*** MANUAL FIX NEEDED for: {', '.join(still_not_found)} ***")

# ── Save corrections ──
with open(CORRECTIONS_PATH, "w", encoding="utf-8") as f:
    json.dump(corrections, f, ensure_ascii=False, indent=2)

print(f"Corrections saved to: {CORRECTIONS_PATH} ({len(corrections)} nouns)")
