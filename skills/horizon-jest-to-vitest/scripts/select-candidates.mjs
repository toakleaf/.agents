#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_TRACKING_FILE =
  "/private/tmp/horizon-jest-to-vitest-migrated-files.txt";
const UNIT_ROOT = "horizon/java/com/r9/horizon/ui/";
const MAPPING_PATTERN = /^(horizon\/\S+) -> (horizon\/\S+)$/;
const RESTRICTED_IMPORT_PATTERN =
  /(?:from\s+|require\(\s*)['"](?:highcharts(?:\/|['"])|@highcharts\/)/;
const SPECIALIZED_NAME_PATTERN =
  /\.(?:visual|integration|e2e|perf|performance|benchmark)\.test\.(?:ts|tsx)$/;
const LOCK_RETRY_MILLISECONDS = 50;
const LOCK_ATTEMPTS = 600;

function usage() {
  return `Usage: node select-candidates.mjs [options]

Options:
  --repo-root PATH       Repository root. Defaults to the current directory.
  --tracking-file PATH   Live reservation file.
  --count N              Primary batch size. Defaults to 250.
  --reserve-count N      Replacement pool size. Defaults to 100.
  --output PATH          Write a TSV manifest instead of printing it.
  --prune-merged         Remove reservations tracked as Vitest tests here.
  --reserve-selected     Add the primary and reserve groups to live reservations.
  --reserve-manifest PATH  Reserve exact paths listed one per line or in TSV form, then exit.
  --release-manifest PATH  Release paths listed one per line or in TSV form, then exit.
  --help                 Show this message.
`;
}

function parseInteger(value, option, { allowZero }) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${option} must be an integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(`${option} is out of range`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    trackingFile: DEFAULT_TRACKING_FILE,
    count: 250,
    reserveCount: 100,
    output: undefined,
    pruneMerged: false,
    reserveSelected: false,
    reserveManifest: undefined,
    releaseManifest: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`${argument} requires a value`);
      }
      return argv[index];
    };

    switch (argument) {
      case "--repo-root":
        options.repoRoot = nextValue();
        break;
      case "--tracking-file":
        options.trackingFile = nextValue();
        break;
      case "--count":
        options.count = parseInteger(nextValue(), argument, {
          allowZero: false,
        });
        break;
      case "--reserve-count":
        options.reserveCount = parseInteger(nextValue(), argument, {
          allowZero: true,
        });
        break;
      case "--output":
        options.output = nextValue();
        break;
      case "--prune-merged":
        options.pruneMerged = true;
        break;
      case "--reserve-selected":
        options.reserveSelected = true;
        break;
      case "--reserve-manifest":
        options.reserveManifest = nextValue();
        break;
      case "--release-manifest":
        options.releaseManifest = nextValue();
        break;
      case "--help":
        process.stdout.write(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`unknown option: ${argument}`);
    }
  }
  return options;
}

function gitFiles(repoRoot, pathspecs) {
  const output = execFileSync("git", ["ls-files", "-z", "--", ...pathspecs], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split("\0").filter(Boolean);
}

function isUnitVitest(testPath) {
  return (
    /\.vi\.test\.(?:ts|tsx)$/.test(testPath) &&
    !/\.visual\.vi\.test\.(?:ts|tsx)$/.test(testPath)
  );
}

function toVitestPath(testPath) {
  const match = testPath.match(/^(.*)\.test\.(ts|tsx)$/);
  if (!match) {
    throw new Error(`not a TypeScript Jest test: ${testPath}`);
  }
  return `${match[1]}.vi.test.${match[2]}`;
}

function readReservations(trackingFile, { allowStaleCount }) {
  if (!existsSync(trackingFile)) {
    throw new Error(`tracking file is missing: ${trackingFile}`);
  }

  let declaredCount;
  const mappings = [];
  const lines = readFileSync(trackingFile, "utf8").split(/\r?\n/);
  for (const [zeroBasedLine, rawLine] of lines.entries()) {
    const lineNumber = zeroBasedLine + 1;
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("Horizon Jest") ||
      line.startsWith("Commits:")
    ) {
      continue;
    }
    if (line.startsWith("Count:")) {
      const value = line.slice("Count:".length).trim();
      if (!/^\d+$/.test(value)) {
        throw new Error(`invalid Count on line ${lineNumber}`);
      }
      declaredCount = Number(value);
      continue;
    }
    const match = line.match(MAPPING_PATTERN);
    if (!match) {
      throw new Error(`invalid tracking line ${lineNumber}: ${rawLine}`);
    }
    const [, oldPath, newPath] = match;
    if (toVitestPath(oldPath) !== newPath) {
      throw new Error(`invalid mapping on line ${lineNumber}: ${rawLine}`);
    }
    mappings.push([oldPath, newPath]);
  }

  if (declaredCount === undefined) {
    throw new Error("tracking file has no Count header");
  }
  if (
    new Set(mappings.map((mapping) => mapping.join("\0"))).size !==
    mappings.length
  ) {
    throw new Error("tracking file contains duplicate mappings");
  }
  if (!allowStaleCount && declaredCount !== mappings.length) {
    throw new Error(
      `tracking Count is ${declaredCount}, but the file contains ${mappings.length} mappings`,
    );
  }
  return mappings;
}

function writeReservations(trackingFile, mappings) {
  const body = mappings
    .map(([oldPath, newPath]) => `${oldPath} -> ${newPath}`)
    .join("\n");
  const contents = `Horizon Jest -> Vitest live reservations\nCount: ${mappings.length}\n\n${
    body ? `${body}\n` : ""
  }`;
  const temporaryFile = `${trackingFile}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryFile, contents);
    renameSync(temporaryFile, trackingFile);
  } catch (error) {
    if (existsSync(temporaryFile)) {
      unlinkSync(temporaryFile);
    }
    throw error;
  }
}

function isProcessRunning(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

function acquireTrackingLock(trackingFile) {
  const lockFile = `${trackingFile}.lock`;
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      const descriptor = openSync(lockFile, "wx");
      writeFileSync(descriptor, `${process.pid}\n`);
      return { descriptor, lockFile };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }

      let stale = true;
      try {
        const ownerPid = Number(readFileSync(lockFile, "utf8").trim());
        stale = !isProcessRunning(ownerPid);
      } catch (readError) {
        if (
          !(readError instanceof Error) ||
          !("code" in readError) ||
          readError.code !== "ENOENT"
        ) {
          throw readError;
        }
      }

      if (stale) {
        try {
          unlinkSync(lockFile);
        } catch (unlinkError) {
          if (
            !(unlinkError instanceof Error) ||
            !("code" in unlinkError) ||
            unlinkError.code !== "ENOENT"
          ) {
            throw unlinkError;
          }
        }
        continue;
      }
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        LOCK_RETRY_MILLISECONDS,
      );
    }
  }
  throw new Error(`timed out waiting for reservation lock: ${lockFile}`);
}

function releaseTrackingLock({ descriptor, lockFile }) {
  closeSync(descriptor);
  try {
    unlinkSync(lockFile);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

function reservationPathsFromManifest(manifestFile) {
  const paths = new Set();
  for (const rawLine of readFileSync(manifestFile, "utf8").split(/\r?\n/)) {
    const testPath = rawLine.trim().split("\t").at(-1);
    if (!testPath) continue;
    if (/\.vi\.test\.(?:ts|tsx)$/.test(testPath)) {
      paths.add(testPath);
      paths.add(testPath.replace(/\.vi\.test\.(ts|tsx)$/, ".test.$1"));
    } else if (/\.test\.(?:ts|tsx)$/.test(testPath)) {
      paths.add(testPath);
      paths.add(toVitestPath(testPath));
    } else {
      throw new Error(`release manifest contains a non-test path: ${testPath}`);
    }
  }
  return paths;
}

function reservationMappingsFromManifest(manifestFile) {
  const mappings = [];
  for (const rawLine of readFileSync(manifestFile, "utf8").split(/\r?\n/)) {
    const testPath = rawLine.trim().split("\t").at(-1);
    if (!testPath) continue;
    if (/\.vi\.test\.(?:ts|tsx)$/.test(testPath)) {
      mappings.push([
        testPath.replace(/\.vi\.test\.(ts|tsx)$/, ".test.$1"),
        testPath,
      ]);
    } else if (/\.test\.(?:ts|tsx)$/.test(testPath)) {
      mappings.push([testPath, toVitestPath(testPath)]);
    } else {
      throw new Error(`reserve manifest contains a non-test path: ${testPath}`);
    }
  }
  return mappings;
}

function candidateRank(testPath) {
  return [testPath.endsWith(".tsx") ? 1 : 0, testPath];
}

function compareRanks(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(options.repoRoot);
  const trackingFile = path.resolve(options.trackingFile);
  const mutatesReservations =
    options.pruneMerged ||
    options.reserveSelected ||
    options.reserveManifest !== undefined ||
    options.releaseManifest !== undefined;
  const trackingLock = mutatesReservations
    ? acquireTrackingLock(trackingFile)
    : undefined;

  try {
    const vitestPaths = new Set(
      gitFiles(repoRoot, [
        "horizon/**/*.vi.test.ts",
        "horizon/**/*.vi.test.tsx",
      ]).filter(isUnitVitest),
    );

    let reservations = readReservations(trackingFile, {
      allowStaleCount:
        options.pruneMerged || options.reserveManifest !== undefined,
    });
    if (options.pruneMerged) {
      reservations = reservations.filter(
        ([, newPath]) => !vitestPaths.has(newPath),
      );
      writeReservations(trackingFile, reservations);
    }
    if (options.releaseManifest) {
      const releasedPaths = reservationPathsFromManifest(
        path.resolve(options.releaseManifest),
      );
      const remaining = reservations.filter(
        ([oldPath, newPath]) =>
          !releasedPaths.has(oldPath) && !releasedPaths.has(newPath),
      );
      const releasedCount = reservations.length - remaining.length;
      if (releasedCount === 0 && releasedPaths.size > 0) {
        throw new Error("release manifest did not match any live reservation");
      }
      writeReservations(trackingFile, remaining);
      process.stderr.write(
        `released ${releasedCount} live reservations; ${remaining.length} remain\n`,
      );
      return;
    }
    if (options.reserveManifest) {
      const requestedMappings = reservationMappingsFromManifest(
        path.resolve(options.reserveManifest),
      );
      const existingMappings = new Set(
        reservations.map((mapping) => mapping.join("\0")),
      );
      const reservedPaths = new Set(reservations.flat());
      const additions = [];
      for (const mapping of requestedMappings) {
        if (existingMappings.has(mapping.join("\0"))) continue;
        if (mapping.some((testPath) => reservedPaths.has(testPath))) {
          throw new Error(
            `reserve manifest conflicts with a live reservation: ${mapping.join(" -> ")}`,
          );
        }
        additions.push(mapping);
        mapping.forEach((testPath) => reservedPaths.add(testPath));
      }
      reservations = [...reservations, ...additions];
      writeReservations(trackingFile, reservations);
      process.stderr.write(
        `reserved ${additions.length} new mappings; ${reservations.length} remain\n`,
      );
      return;
    }

    const reservedPaths = new Set(reservations.flat());
    const candidates = [];
    const jestFiles = gitFiles(repoRoot, [
      `${UNIT_ROOT}**/*.test.ts`,
      `${UNIT_ROOT}**/*.test.tsx`,
    ]);
    for (const testPath of jestFiles) {
      if (
        path.basename(testPath).includes(".vi.") ||
        SPECIALIZED_NAME_PATTERN.test(testPath)
      ) {
        continue;
      }
      const vitestPath = toVitestPath(testPath);
      if (
        reservedPaths.has(testPath) ||
        reservedPaths.has(vitestPath) ||
        vitestPaths.has(vitestPath)
      ) {
        continue;
      }
      candidates.push({ testPath, rank: candidateRank(testPath) });
    }
    candidates.sort((left, right) => compareRanks(left.rank, right.rank));

    const requested = options.count + options.reserveCount;
    if (candidates.length < requested) {
      throw new Error(
        `found ${candidates.length} candidates, fewer than the requested ${requested}`,
      );
    }
    const primary = candidates
      .slice(0, options.count)
      .map(({ testPath }) => testPath);
    const reserve = candidates
      .slice(options.count, requested)
      .map(({ testPath }) => testPath);
    const selectedHighchartsCount = [...primary, ...reserve].filter(
      (testPath) =>
        RESTRICTED_IMPORT_PATTERN.test(
          readFileSync(path.join(repoRoot, testPath), "utf8"),
        ),
    ).length;

    if (options.reserveSelected) {
      const selectedMappings = [...primary, ...reserve].map((testPath) => [
        testPath,
        toVitestPath(testPath),
      ]);
      writeReservations(trackingFile, [...reservations, ...selectedMappings]);
    }

    const output = [
      ...primary.map((testPath) => `primary\t${testPath}`),
      ...reserve.map((testPath) => `reserve\t${testPath}`),
    ].join("\n");
    if (options.output) {
      writeFileSync(path.resolve(options.output), `${output}\n`);
    } else {
      process.stdout.write(`${output}\n`);
    }

    process.stderr.write(
      `selected ${primary.length} primary and ${reserve.length} reserve files from ${candidates.length} candidates; ` +
        `${vitestPaths.size} tracked unit Vitest files and ${reservations.length} prior live reservations excluded` +
        `${options.reserveSelected ? " and all selected files reserved" : ""}; ` +
        `${selectedHighchartsCount} selected Highcharts tests require a no-verify commit\n`,
    );
  } finally {
    if (trackingLock) releaseTrackingLock(trackingLock);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
