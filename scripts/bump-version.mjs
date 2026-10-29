// Sets SimpleDotMD's version everywhere it is written and turns the CHANGELOG's
// [Unreleased] section into that version. Usage: node scripts/bump-version.mjs <x.y.z>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+$/;
const APP_NAME = 'simpledotmd';

export function assertVersion(version) {
  if (!SEMVER.test(version)) {
    throw new Error(`Expected a version like 1.2.3, got "${version}"`);
  }
  return version;
}

export function bumpJsonVersion(json, version) {
  const data = JSON.parse(json);
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`;
}

// Only the version of the [package] table, not the `version = "2"` of dependencies.
export function bumpCargoToml(toml, version) {
  return toml.replace(/^(\[package\][^[]*?^version = ")[^"]*(")/m, `$1${version}$2`);
}

export function bumpCargoLock(lock, version) {
  return lock.replace(new RegExp(`(name = "${APP_NAME}"\\nversion = ")[^"]*(")`), `$1${version}$2`);
}

export function releaseChangelog(markdown, version, date) {
  const unreleased = '## [Unreleased]\n';
  if (!markdown.includes(unreleased)) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" heading');
  }
  if (markdown.includes(`## [${version}]`)) {
    throw new Error(`CHANGELOG.md already has a section for ${version}`);
  }
  return markdown.replace(unreleased, `${unreleased}\n## [${version}] - ${date}\n`);
}

const BUMPERS = {
  'package.json': bumpJsonVersion,
  'src-tauri/tauri.conf.json': bumpJsonVersion,
  'src-tauri/Cargo.toml': bumpCargoToml,
  'src-tauri/Cargo.lock': bumpCargoLock,
  'CHANGELOG.md': releaseChangelog,
};

// Pure: takes the current contents of every file and returns the new ones.
export function bumpVersion(files, version, date) {
  assertVersion(version);
  return Object.fromEntries(
    Object.entries(BUMPERS).map(([file, bump]) => [file, bump(files[file], version, date)]),
  );
}

function main(args) {
  const [version] = args;
  const files = Object.fromEntries(
    Object.keys(BUMPERS).map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]),
  );
  const bumped = bumpVersion(files, version, new Date().toISOString().slice(0, 10));
  for (const [file, content] of Object.entries(bumped)) {
    fs.writeFileSync(path.join(ROOT, file), content);
  }
  console.log(`Version set to ${version} in ${Object.keys(BUMPERS).join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
