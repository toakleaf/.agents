# Jargon marker

Run the script from the skill directory. It uses only built-in Node modules, so no install step is needed.

```bash
node scripts/mark-jargon.mjs --text "The mitochondria makes energy."
```

The script accepts exactly one input source:

- `--text "..."` checks text passed on the command line.
- `--input path` reads any UTF-8 text file, including `.txt` and `.md` files.

It writes marked text to stdout by default. Set `--output path` to write it to a file instead.

The script uses the fifth-grade word bank by default. Set `--level 1` to use the first-grade bank. Words absent from the selected bank are wrapped in double brackets by default. Use `--style markdown`, `--style html`, or `--style ansi` for another built-in marker. Set both `--prefix` and `--suffix` to define custom markers.

```bash
node scripts/mark-jargon.mjs \
  --level 5 \
  --input report.md \
  --output marked-report.md \
  --style html
```

Matching is case-insensitive. The script accepts common plurals, possessives, contractions, and hyphenated forms when their base words are in the selected bank.

Markdown code, links, URLs, and HTML tags are left unchanged by default. Pass `--no-protect-markup` to check them too. Pass `--ignore-capitalized` to leave capitalized words unmarked when they should be treated as proper nouns.

Run `node scripts/mark-jargon.mjs --help` for the full option list.
