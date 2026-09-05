import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(directory, "mark-jargon.mjs");

function run(arguments_) {
  return spawnSync(process.execPath, [script, ...arguments_], {
    encoding: "utf8",
  });
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

test("uses fifth grade when level is omitted", () => {
  const result = run(["--text", "A cell."]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "A cell.");
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
