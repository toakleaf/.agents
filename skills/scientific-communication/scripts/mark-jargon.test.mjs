import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isAllowed, loadWordBank } from "./mark-jargon.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, "mark-jargon.mjs");

function run(arguments_) {
  return spawnSync(process.execPath, [script, ...arguments_], {
    encoding: "utf8",
  });
}

function readStoredWords(filename) {
  const csv = fs.readFileSync(filename, "utf8").trimEnd().split(/\r?\n/);
  assert.equal(csv.shift(), "word,age_of_acquisition,frequency_per_million");
  return new Set(csv.map((line) => line.slice(0, line.indexOf(","))));
}

test("marks a word outside the selected bank", () => {
  const result = run(["--level", "1", "--text", "The quantum cat."]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "The [[quantum]] cat.");
});

test("uses different reading levels", () => {
  const firstGrade = run(["--level", "1", "--text", "A cell."]);
  const fifthGrade = run(["--level", "5", "--text", "A cell."]);
  assert.equal(firstGrade.stdout, "A [[cell]].");
  assert.equal(fifthGrade.stdout, "A cell.");
});

test("supports the twelfth-grade level", () => {
  const fifthGrade = run(["--level", "5", "--text", "A client."]);
  const twelfthGrade = run(["--level", "12", "--text", "A client."]);
  assert.equal(fifthGrade.stdout, "A [[client]].");
  assert.equal(twelfthGrade.stdout, "A client.");
});

test("uses twelfth grade when level is omitted", () => {
  const result = run(["--text", "A client."]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "A client.");
});

test("supports file input, file output, and custom markers", () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mark-jargon-"));
  const input = path.join(tempDirectory, "input.md");
  const output = path.join(tempDirectory, "output.md");
  fs.writeFileSync(input, "The quantum cat.", "utf8");

  const result = run([
    "--level", "1",
    "--input", input,
    "--output", output,
    "--prefix", "<jargon>",
    "--suffix", "</jargon>",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(fs.readFileSync(output, "utf8"), "The <jargon>quantum</jargon> cat.");
});

test("preserves markup by default", () => {
  const text = "Use `quantumFlux` at https://example.com/quantum.";
  const result = run(["--level", "1", "--text", text]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "Use `quantumFlux` at https://example.com/quantum.");
});

test("accepts simple word forms", () => {
  const result = run(["--level", "1", "--text", "Cats and dog's cat-like toys."]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "Cats and dog's cat-like toys.");
});

test("fifth grade includes every first-grade word", () => {
  const references = path.resolve(directory, "..", "references");
  const firstGrade = loadWordBank(1, references);
  const fifthGrade = loadWordBank(5, references);
  assert.deepEqual([...firstGrade].filter((word) => !fifthGrade.has(word)), []);
});

test("twelfth grade includes every lower-grade word", () => {
  const references = path.resolve(directory, "..", "references");
  const fifthGrade = loadWordBank(5, references);
  const twelfthGrade = loadWordBank(12, references);
  assert.deepEqual([...fifthGrade].filter((word) => !twelfthGrade.has(word)), []);
});

test("grade files store only new words", () => {
  const references = path.resolve(directory, "..", "references");
  const banks = [
    readStoredWords(path.join(references, "1st-grade-words.csv")),
    readStoredWords(path.join(references, "5th-grade-words.csv")),
    readStoredWords(path.join(references, "12th-grade-words.csv")),
  ];

  for (let left = 0; left < banks.length; left += 1) {
    for (let right = left + 1; right < banks.length; right += 1) {
      assert.deepEqual([...banks[left]].filter((word) => banks[right].has(word)), []);
    }
  }
});

test("higher levels load lower-level banks additively", () => {
  const references = fs.mkdtempSync(path.join(os.tmpdir(), "word-banks-"));
  const header = "word,age_of_acquisition,frequency_per_million\n";
  fs.writeFileSync(path.join(references, "1st-grade-words.csv"), `${header}alpha,7,1\n`);
  fs.writeFileSync(path.join(references, "5th-grade-words.csv"), `${header}beta,11,1\n`);

  const words = loadWordBank(5, references);
  assert.equal(words.has("alpha"), true);
  assert.equal(words.has("beta"), true);
});

test("adds regular and irregular plurals", () => {
  const references = path.resolve(directory, "..", "references");
  const firstGrade = loadWordBank(1, references);
  assert.equal(isAllowed("cats", firstGrade), true);
  assert.equal(isAllowed("boxes", firstGrade), true);
  assert.equal(isAllowed("geese", firstGrade), true);
  assert.equal(isAllowed("mice", firstGrade), true);
});

test("accepts derivations with at most three added letters", () => {
  const words = new Set(["help", "cat"]);
  assert.equal(isAllowed("helpful", words), true);
  assert.equal(isAllowed("xhelpxx", words), true);
  assert.equal(isAllowed("helpfully", words), false);
  assert.equal(isAllowed("cats", words), true);
  assert.equal(isAllowed("scat", words), false);
});

test("accepts hyphenations and two-word compounds", () => {
  const words = new Set(["shoe", "box", "cat", "like"]);
  assert.equal(isAllowed("shoebox", words), true);
  assert.equal(isAllowed("cat-like", words), true);
  assert.equal(isAllowed("shoehorn", words), false);
});

test("requires exactly one input source", () => {
  const result = run(["--level", "1", "--text", "cat", "--input", "input.txt"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one of --text or --input/);
});

test("prints help without other required options", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--no-protect-markup/);
});

test("rejects unknown options", () => {
  const result = run(["--level", "1", "--text", "cat", "--wat"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --wat/);
});
