---
name: scientific-communication
description: >-
  Summarize, rewrite, simplify, or explain complex, jargon-heavy text in plain language.
---

# Scientific communication

## Rule 1: Use only common English words

For this skill, jargon is any word or acronym that is neither a proper noun nor included in the word bank for the chosen grade level. Use jargon only when all these conditions are met:

- Base all communication on words that readers recognize and understand.
- Use the supplied word banks as practical estimates of word frequency and reading level.
- Unless an exception below applies, every word must appear in the word bank for the chosen grade level.
- Grade-level banks store only the words added at that level. The marker combines them, so a higher level includes every word from each lower available level without duplicating entries in the CSV files.
- Common forms of listed words are allowed. These include regular and irregular plurals, tenses, possessives such as "the dog's bone," contractions such as "don't," hyphenated forms such as "cat-like," and easily understood derivatives like "partial" or "helpful."
- A derived word matches when it contains a listed base of at least four letters and has no more than three unmatched letters. A hyphenated word may match each part separately. A closed compound such as "shoebox" may match two listed words.
- See [methodology](references/methodology.md) for the cutoffs, source, and limits of these estimates.

Use `./scripts/mark-jargon.mjs` to mark words that are absent from a selected word bank. It accepts text from `--text` or a file from `--input`. It writes to stdout unless `--output` is set.

The marker uses twelfth grade by default and supports these word-bank files:

- [First-grade words](./references/1st-grade-words.csv)
- [Fifth-grade words](./references/5th-grade-words.csv)
- [Twelfth-grade words](./references/12th-grade-words.csv)

See [jargon marker](./references/jargon-marker.md) for options and examples.

## Exceptions to rule 1

### Explanation

Jargon can be used if and only if it is properly explained first. (Or very shortly after usage)

1. Explain each jargon term in plain language before using it.
2. Each later use must remain interchangeable with that definition. If substituting the definition makes the sentence unclear or incorrect, revise the definition or explain the term again.
3. Limit the number of jargon terms in each sentence and paragraph.

#### Jargon definition repetition

Assume readers are learning each jargon term for the first time. Repeat its definition, or a simpler version of it, when doing so will help readers remember the meaning. Do not repeat it so often that it slows the writing.

Repeat a definition:

1. In long texts, when readers may have forgotten it.
2. Before a section that uses the term often.

### Proper nouns

- You may use words outside the word bank for proper nouns, including names and other terms that require capitalization.

### Ideophones, onomatopoeias, common slang etc...

- It is ok to use words that are not on the common list if they are Ideophones and onomatopoeias
  - Examples: jiggle, bang
- Commonly understood slang can also be acceptible, but should be used very rarely, and only if senior citezens and gradeschoolers alike will understand it
  - Examples: wonky, nerd

## Rule 2: Use analogies and metaphors to explain abstract concepts

When a concept is highly abstract or otherwise opaque to someone not well studied in the area it can be helpful to analogize back to common experience.

- Use sparingly
- Don't stretch too far
- Best used when trying to visualize or make tangible abstract concepts
  - Examples: Public key cryptography is like a padlock anyone can close but only you can open, or like mixing paint colors that can't practically be unmixed.
