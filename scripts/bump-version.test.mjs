import { describe, expect, it } from 'vitest';
import {
  assertVersion,
  bumpCargoLock,
  bumpCargoToml,
  bumpJsonVersion,
  bumpVersion,
  releaseChangelog,
} from './bump-version.mjs';

const CARGO_TOML = `[package]
name = "simpledotmd"
version = "0.0.1"
authors = ["Juan Gestal <juan@gestal.es>"]

[dependencies]
tauri = { version = "2", features = [] }
`;

const CARGO_LOCK = `[[package]]
name = "simpledotmd"
version = "0.0.1"
dependencies = [
 "serde",
]

[[package]]
name = "serde"
version = "1.0.0"
`;

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- A feature.

## [0.0.0] - 2026-01-01

- Earlier work.
`;

describe('assertVersion', () => {
  it('accepts a plain x.y.z version', () => {
    expect(assertVersion('1.2.3')).toBe('1.2.3');
    expect(assertVersion('10.0.12')).toBe('10.0.12');
  });

  it.each(['v1.2.3', '1.2', '1.2.3-beta.1', '1.2.3.4', '', 'undefined'])(
    'rejects %j',
    (version) => {
      expect(() => assertVersion(version)).toThrow('Expected a version like 1.2.3');
    },
  );
});

describe('bumpJsonVersion', () => {
  it('changes only the version and keeps two-space indentation and the final newline', () => {
    const json = '{\n  "name": "simpledotmd",\n  "version": "0.0.1",\n  "private": true\n}\n';

    expect(bumpJsonVersion(json, '0.1.0')).toBe(
      '{\n  "name": "simpledotmd",\n  "version": "0.1.0",\n  "private": true\n}\n',
    );
  });

  it('keeps the position of the version key', () => {
    const json = '{"version":"0.0.1","name":"x"}';

    expect(bumpJsonVersion(json, '0.2.0')).toBe('{\n  "version": "0.2.0",\n  "name": "x"\n}\n');
  });
});

describe('bumpCargoToml', () => {
  it('changes the package version and leaves dependency versions alone', () => {
    const bumped = bumpCargoToml(CARGO_TOML, '0.1.0');

    expect(bumped).toBe(CARGO_TOML.replace('version = "0.0.1"', 'version = "0.1.0"'));
    expect(bumped).toContain('tauri = { version = "2", features = [] }');
  });

  it('does not touch a version that only appears in another table', () => {
    const toml = '[dependencies]\ntauri = { version = "2" }\n\n[package]\nversion = "0.0.1"\n';

    expect(bumpCargoToml(toml, '0.3.0')).toBe(
      '[dependencies]\ntauri = { version = "2" }\n\n[package]\nversion = "0.3.0"\n',
    );
  });
});

describe('bumpCargoLock', () => {
  it('changes only the version of the application package', () => {
    expect(bumpCargoLock(CARGO_LOCK, '0.1.0')).toBe(
      CARGO_LOCK.replace(
        'name = "simpledotmd"\nversion = "0.0.1"',
        'name = "simpledotmd"\nversion = "0.1.0"',
      ),
    );
  });
});

describe('releaseChangelog', () => {
  it('turns the Unreleased entries into a dated version and leaves an empty Unreleased section', () => {
    expect(releaseChangelog(CHANGELOG, '0.1.0', '2026-10-29')).toBe(`# Changelog

## [Unreleased]

## [0.1.0] - 2026-10-29

### Added

- A feature.

## [0.0.0] - 2026-01-01

- Earlier work.
`);
  });

  it('refuses a changelog without an Unreleased heading', () => {
    expect(() => releaseChangelog('# Changelog\n\n## [0.0.0]\n', '0.1.0', '2026-10-29')).toThrow(
      '"## [Unreleased]" heading',
    );
  });

  it('refuses a version that already has a section', () => {
    expect(() =>
      releaseChangelog(`${CHANGELOG}\n## [0.1.0] - 2026-01-02\n`, '0.1.0', '2026-10-29'),
    ).toThrow('already has a section for 0.1.0');
  });
});

describe('bumpVersion', () => {
  const files = {
    'package.json': '{\n  "version": "0.0.1"\n}\n',
    'src-tauri/tauri.conf.json': '{\n  "version": "0.0.1"\n}\n',
    'src-tauri/Cargo.toml': CARGO_TOML,
    'src-tauri/Cargo.lock': CARGO_LOCK,
    'CHANGELOG.md': CHANGELOG,
  };

  it('returns every file bumped to the same version', () => {
    const bumped = bumpVersion(files, '0.1.0', '2026-10-29');

    expect(Object.keys(bumped).sort()).toEqual(Object.keys(files).sort());
    expect(bumped['package.json']).toBe('{\n  "version": "0.1.0"\n}\n');
    expect(bumped['src-tauri/tauri.conf.json']).toBe('{\n  "version": "0.1.0"\n}\n');
    expect(bumped['src-tauri/Cargo.toml']).toContain('version = "0.1.0"');
    expect(bumped['src-tauri/Cargo.lock']).toContain('version = "0.1.0"');
    expect(bumped['CHANGELOG.md']).toContain('## [0.1.0] - 2026-10-29');
  });

  it('does not change the input files', () => {
    const before = structuredClone(files);

    bumpVersion(files, '0.1.0', '2026-10-29');

    expect(files).toEqual(before);
  });

  it('rejects an invalid version before touching anything', () => {
    expect(() => bumpVersion(files, 'v0.1.0', '2026-10-29')).toThrow('Expected a version');
  });
});
