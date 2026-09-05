#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);
const WORD_PATTERN = /\p{L}+(?:['’\-\u2010\u2011]\p{L}+)*/gu;
const PROTECTED_PATTERN = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|https?:\/\/[^\s<]+|<[^>\n]+>|\]\([^)]+\)/g;
const CAPITALIZED_PATTERN = /^\p{Lu}/u;
const MARKERS = {
  brackets: ["[[", "]]"],
  markdown: ["**", "**"],
  html: ["<mark>", "</mark>"],
  ansi: ["\u001b[33m", "\u001b[0m"],
};
const BANK_FILES = {
  1: "1st-grade-words.csv",
  5: "5th-grade-words.csv",
};
const DEFAULT_LEVEL = 5;
const HELP_TEXT = `Usage:
  mark-jargon [--level <1|5>] (--text <text> | --input <file>) [options]

Options:
  -l, --level <1|5>       Reading level used for the check. Default: 5.
      --text <text>       Text to check.
  -i, --input <file>      UTF-8 text file to check.
  -o, --output <file>     Write to a file instead of stdout.
      --style <name>      brackets, markdown, html, or ansi. Default: brackets.
      --prefix <text>     Custom marker placed before each flagged word.
      --suffix <text>     Custom marker placed after each flagged word.
      --ignore-capitalized
                          Leave capitalized words unmarked.
      --no-protect-markup Check Markdown code, links, URLs, and HTML tags too.
  -h, --help              Show this help.
`;
const VALUE_OPTIONS = new Map([
  ["--level", "level"],
  ["-l", "level"],
  ["--text", "text"],
  ["--input", "input"],
  ["-i", "input"],
  ["--output", "output"],
  ["-o", "output"],
  ["--style", "style"],
  ["--prefix", "prefix"],
  ["--suffix", "suffix"],
]);
const BOOLEAN_OPTIONS = new Map([
  ["--ignore-capitalized", ["ignoreCapitalized", true]],
  ["--no-ignore-capitalized", ["ignoreCapitalized", false]],
  ["--protect-markup", ["protectMarkup", true]],
  ["--no-protect-markup", ["protectMarkup", false]],
]);

export function normalizeWord(word) {
  return word
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[\u2010\u2011]/g, "-");
}

export function loadWordBank(level, referencesDirectory) {
  const bankFilename = BANK_FILES[level];
  if (!bankFilename) {
    throw new Error(`Unsupported reading level: ${level}`);
  }

  const csvPath = path.join(referencesDirectory, bankFilename);
  const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/);
  if (lines[0] !== "word,age_of_acquisition,frequency_per_million") {
    throw new Error(`Unexpected word-bank header in ${csvPath}`);
  }

  const words = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    words.add(line.slice(0, line.indexOf(",")));
  }
  return words;
}

function simpleForms(word) {
  const forms = new Set([word]);

  if (word.endsWith("'s")) forms.add(word.slice(0, -2));
  if (word.endsWith("s'")) forms.add(word.slice(0, -1));
  if (word.endsWith("ies") && word.length > 3) forms.add(`${word.slice(0, -3)}y`);
  if (word.endsWith("es") && word.length > 2) forms.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 1) forms.add(word.slice(0, -1));

  const contraction = word.match(/^(.+)'(m|re|ve|ll|d)$/);
  if (contraction) forms.add(contraction[1]);

  const irregularContractions = {
    "can't": "can",
    "couldn't": "could",
    "didn't": "did",
    "doesn't": "does",
    "don't": "do",
    "hadn't": "had",
    "hasn't": "has",
    "haven't": "have",
    "isn't": "is",
    "mustn't": "must",
    "shouldn't": "should",
    "wasn't": "was",
    "weren't": "were",
    "won't": "will",
    "wouldn't": "would",
  };
  if (irregularContractions[word]) forms.add(irregularContractions[word]);

  return forms;
}

export function isAllowed(word, wordBank) {
  const normalized = normalizeWord(word);
  if ([...simpleForms(normalized)].some((form) => wordBank.has(form))) {
    return true;
  }

  if (normalized.includes("-")) {
    return normalized
      .split("-")
      .every((part) => [...simpleForms(part)].some((form) => wordBank.has(form)));
  }

  return false;
}

function markWords(text, options) {
  const {
    wordBank,
    prefix,
    suffix,
    ignoreCapitalized = false,
  } = options;

  return text.replace(WORD_PATTERN, (word) => {
    if (ignoreCapitalized && CAPITALIZED_PATTERN.test(word)) return word;
    return isAllowed(word, wordBank) ? word : `${prefix}${word}${suffix}`;
  });
}

export function markJargon(text, options) {
  if (!options.protectMarkup) return markWords(text, options);

  let result = "";
  let position = 0;
  for (const match of text.matchAll(PROTECTED_PATTERN)) {
    result += markWords(text.slice(position, match.index), options);
    result += match[0];
    position = match.index + match[0].length;
  }
  result += markWords(text.slice(position), options);
  return result;
}

function parseArguments(rawArguments) {
  const arguments_ = {
    level: DEFAULT_LEVEL,
    style: "brackets",
    ignoreCapitalized: false,
    protectMarkup: true,
  };

  for (let index = 0; index < rawArguments.length; index += 1) {
    const rawOption = rawArguments[index];
    const equalsIndex = rawOption.indexOf("=");
    const option = equalsIndex === -1 ? rawOption : rawOption.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : rawOption.slice(equalsIndex + 1);

    if (option === "--help" || option === "-h") {
      if (inlineValue !== undefined) throw new Error(`${option} does not take a value.`);
      arguments_.help = true;
      continue;
    }

    if (BOOLEAN_OPTIONS.has(option)) {
      if (inlineValue !== undefined) throw new Error(`${option} does not take a value.`);
      const [name, value] = BOOLEAN_OPTIONS.get(option);
      arguments_[name] = value;
      continue;
    }

    const name = VALUE_OPTIONS.get(option);
    if (!name) throw new Error(`Unknown option: ${rawOption}`);

    let value = inlineValue;
    if (value === undefined) {
      index += 1;
      value = rawArguments[index];
    }
    if (value === undefined) throw new Error(`Missing value for ${option}.`);
    arguments_[name] = value;
  }

  if (arguments_.help) return arguments_;
  if (!["1", "5"].includes(String(arguments_.level))) {
    throw new Error("Set --level to 1 or 5.");
  }
  arguments_.level = Number(arguments_.level);

  const inputCount = Number(arguments_.text !== undefined) + Number(arguments_.input !== undefined);
  if (inputCount !== 1) {
    throw new Error("Set exactly one of --text or --input.");
  }
  if (arguments_.input === "") throw new Error("--input cannot be empty.");
  if (!Object.hasOwn(MARKERS, arguments_.style)) {
    throw new Error(`Unknown style: ${arguments_.style}`);
  }
  const hasPrefix = arguments_.prefix !== undefined;
  const hasSuffix = arguments_.suffix !== undefined;
  if (hasPrefix !== hasSuffix) {
    throw new Error("Set --prefix and --suffix together.");
  }

  return arguments_;
}

export function run(rawArguments = process.argv.slice(2)) {
  const arguments_ = parseArguments(rawArguments);
  if (arguments_.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }
  const referencesDirectory = path.resolve(directory, "..", "references");
  const wordBank = loadWordBank(arguments_.level, referencesDirectory);
  const text = arguments_.input
    ? fs.readFileSync(path.resolve(arguments_.input), "utf8")
    : arguments_.text;
  const [defaultPrefix, defaultSuffix] = MARKERS[arguments_.style];
  const marked = markJargon(text, {
    wordBank,
    prefix: arguments_.prefix ?? defaultPrefix,
    suffix: arguments_.suffix ?? defaultSuffix,
    ignoreCapitalized: arguments_.ignoreCapitalized,
    protectMarkup: arguments_.protectMarkup,
  });

  if (arguments_.output) {
    fs.writeFileSync(path.resolve(arguments_.output), marked, "utf8");
  } else {
    process.stdout.write(marked);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`mark-jargon: ${error.message}\nRun mark-jargon --help for usage.\n`);
    process.exitCode = 1;
  }
}
