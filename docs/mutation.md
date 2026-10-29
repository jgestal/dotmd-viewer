# Mutation testing

Mutation testing changes the code in small ways (a `<` becomes `<=`, a string becomes empty, a
regex loses an anchor) and runs the tests again. A mutant that no test notices "survives" and
shows a rule the tests do not pin down. The business rules must keep a score of at least 85 %
(the build fails below it) and aim for 95 %.

## TypeScript (StrykerJS)

- Command: `npm run test:mutation` (config in `stryker.config.mjs`). The HTML report is written to
  `reports/mutation/index.html` and the clear-text table to the console. `reports/` and
  `.stryker-tmp/` are git-ignored.
- Scope: `src/lib/domain/**` and `src/lib/application/**` (tests excluded), mutated against the
  whole Vitest suite with per-test coverage analysis.
- Thresholds: high 95, low 85, break 85.

### Scores

Initial run (before T57): **94.22 %** (1,658 mutants; 91 survived, 4 without coverage).

Final run: **99.02 %** (1,658 mutants: 1,621 killed, 3 timed out, 16 survived, 0 without
coverage, 15 compile errors, 3 ignored). The same result came from the full suite and from the
domain and application tests on their own.

| File                        | Score      | Killed | Timeout | Survived |
| --------------------------- | ---------- | -----: | ------: | -------: |
| **All files**               | **99.02**  |   1621 |       3 |       16 |
| **application**             | **100.00** |    509 |       0 |        0 |
| application/documents.ts    | 100.00     |    162 |       0 |        0 |
| application/drop.ts         | 100.00     |     41 |       0 |        0 |
| application/htmlExport.ts   | 100.00     |     26 |       0 |        0 |
| application/images.ts       | 100.00     |     32 |       0 |        0 |
| application/openRequests.ts | 100.00     |     19 |       0 |        0 |
| application/preferences.ts  | 100.00     |     11 |       0 |        0 |
| application/printing.ts     | 100.00     |     44 |       0 |        0 |
| application/workspace.ts    | 100.00     |    174 |       0 |        0 |
| **domain**                  | **98.59**  |   1112 |       3 |       16 |
| domain/document.ts          | 100.00     |     72 |       0 |        0 |
| domain/errors.ts            | 98.00      |     49 |       0 |        1 |
| domain/htmlExport.ts        | 100.00     |     44 |       0 |        0 |
| domain/images.ts            | 95.31      |     61 |       0 |        3 |
| domain/markdownLines.ts     | 99.11      |    111 |       0 |        1 |
| domain/openRequests.ts      | 100.00     |     17 |       0 |        0 |
| domain/outline.ts           | 98.55      |    202 |       2 |        3 |
| domain/paths.ts             | 99.38      |    161 |       0 |        1 |
| domain/preferences.ts       | 100.00     |    127 |       0 |        0 |
| domain/printing.ts          | 100.00     |     13 |       0 |        0 |
| domain/recents.ts           | 100.00     |     17 |       0 |        0 |
| domain/slides.ts            | 94.29      |     65 |       1 |        4 |
| domain/statistics.ts        | 97.09      |    100 |       0 |        3 |
| domain/theme.ts             | 100.00     |     13 |       0 |        0 |
| domain/workspace.ts         | 100.00     |     60 |       0 |        0 |

Every survivor is listed under "Equivalent mutants" below. `slides.ts` is the only file below 95 %,
and all four of its survivors are equivalent.

The 15 "errors" are mutants that do not type-check (Stryker drops them from the score), and the 3
ignored mutants are the `Stryker disable` comments listed below.

### What the new tests pin down

The surviving mutants were killed by tests that assert exact values at the edges of each rule:

- **statistics**: each line-syntax regex at its anchor and its quantifier (`  > quoted`,
  `>>quoted`, `10. item`, `-   item`, `  [x] done`, `see [x] here`, `a # b`, `#   Title`),
  collapsed reference links, multi-character footnote labels, `http` (not only `https`)
  autolinks and bare URLs, a single `=`, and table pipes as word breaks.
- **outline**: multi-word emphasis of each kind, `_emphasis_` at the start, full reference links,
  trimmed code spans, a backtick inside a double-backtick span, closing hashes only at the very end,
  whitespace-only lines ending a paragraph, Setext underlines that must fill the line, and every
  alternative of the "not a paragraph" rule (one-space indent, `a > b`, `12 apples`, `_`,
  `--- notes`, `1.`, `10.`, `1)`, `***`, `_ _ _`, `##`, an empty `#`).
- **markdownLines**: blank lines between front matter keys, trailing spaces after the closing
  fence, and top-level lines that only contain YAML syntax in the middle.
- **paths**: `dirName('')`, separator choice for a base without separators, trimming of every
  leading and trailing separator, roots with nothing left after `..`, empty and `.` relative paths,
  drive letters only at the start, and the case-sensitive default of `retargetPath`.
- **document**: `retargetDocument` (it had no test), the absent `name` key of `newDocument` and the
  exact saved text of `markUnsaved`.
- **preferences**: every value of every enumeration is accepted and an empty string is rejected.
- **images / htmlExport**: a colon later in a relative path is not a scheme; `.png` alone is a PNG.
- **application**: `.html` / `.pdf` only count at the end of the chosen name, the case-sensitive
  default of `createDocuments`, dotted folder names and dot files on rename, and recents outside a
  renamed item left untouched.

### Equivalent mutants

These survive because no input can tell them apart from the original. Line numbers refer to the
current source.

| File:line                    | Mutator               | Mutation                                                    | Why it is equivalent                                                                                                                                                                                                |
| ---------------------------- | --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/errors.ts:29`        | ConditionalExpression | `typeof kind === 'string'` → `true`                         | `ERROR_KINDS.includes(kind)` is false for anything that is not one of its strings. The `typeof` check narrows the type for TypeScript.                                                                              |
| `domain/images.ts:54`        | ConditionalExpression | `address === ''` → `false`                                  | An empty address passes the scheme check and reaches `if (file === '') return null`, so the result is still `null`. The early return keeps the intent clear.                                                        |
| `domain/images.ts:54`        | StringLiteral         | `''` → `"Stryker was here!"`                                | Same as above: the empty address is still caught by `file === ''`.                                                                                                                                                  |
| `domain/images.ts:56`        | Regex                 | `/[?#].*$/` → `/[?#].*/`                                    | Not worth killing. Without the `m` flag, `.*` already runs to the end of the address. The two differ only when a line break follows `?` or `#`, and an `<img src>` never contains one (the URL parser strips them). |
| `domain/markdownLines.ts:27` | MethodExpression      | `line.trim() !== ''` → `line !== ''`                        | The same filter drops lines that start with whitespace (`!/^\s/`). A non-empty line that does not start with whitespace never trims to `''`.                                                                        |
| `domain/outline.ts:24`       | Regex                 | `ATX_HEADING` loses its final `$`                           | Not worth killing. `(.*)` is greedy and lines are already split on `\n`, `\r\n` and `\r`, so it reaches the end of the line. The only difference is a U+2028/U+2029 inside a heading line.                          |
| `domain/outline.ts:25`       | Regex                 | `ATX_CLOSING` `[ \t]+` → `[ \t]`                            | It leaves extra spaces before the closing hashes, and `plainText` trims them away.                                                                                                                                  |
| `domain/outline.ts:68`       | MethodExpression      | `match[2]!.trim()` → `match[2]!`                            | `plainText` trims its result, `ATX_CLOSING` accepts the leading `[ \t]+` in place of `^`, and no inline rule depends on whitespace at the ends.                                                                     |
| `domain/paths.ts:18`         | Regex                 | UNC root loses `^`                                          | `rootLength` only sees normalised paths, where repeated separators are collapsed and `//` can only appear as the UNC prefix.                                                                                        |
| `domain/slides.ts:39`        | EqualityOperator      | `i < bounds.length` → `i <= bounds.length`                  | The extra pass reads `bounds[bounds.length]` (`undefined`), so `end` is `NaN`, `start <= end` is false and nothing is pushed.                                                                                       |
| `domain/slides.ts:42`        | EqualityOperator      | `start <= end` → `start < end`                              | When `start === end` on a blank line, the next loop decrements `end` instead and the empty range is dropped all the same.                                                                                           |
| `domain/slides.ts:43`        | EqualityOperator      | `end >= start` → `end > start`                              | After the previous loop `lines[start]` is not blank, so stopping at `end === start` changes nothing.                                                                                                                |
| `domain/slides.ts:66`        | ConditionalExpression | `slides.length === 0` → `false`                             | With no slides, `findIndex` returns `-1` and the function returns `slides.length - 1`, which is `-1` too. The guard documents the empty case.                                                                       |
| `domain/statistics.ts:44`    | Regex (×3)            | `[*~]+` → `[*~]`; `_+` → `_` in each underscore alternative | `EMPHASIS_MARKER` replaces globally with `''`, and its lookarounds look at the original string. Removing a run one character at a time removes the same characters.                                                 |

### Ignored with `// Stryker disable next-line`

Only where every mutant of that mutator on the line is equivalent:

| File:line                    | Mutator       | Why                                                                                                   |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `domain/markdownLines.ts:39` | StringLiteral | `split()` always returns at least one line, so the `?? ''` fallback only exists for the type checker. |
| `domain/statistics.ts:31`    | ObjectLiteral | `'grapheme'` is the default granularity of `Intl.Segmenter`. The option is spelled out for readers.   |
| `domain/statistics.ts:46`    | Regex         | ``/`+/g`` → ``/`/g``: a global replacement removes the same backtick runs one backtick at a time.     |

### Notes

- Static mutants (module-level regexes and constants) run the whole suite. Under load, a flaky UI
  test can fail and "kill" such a mutant by accident. In this pass, nine static mutants in
  `markdownLines.ts` and `paths.ts` were reported killed in one run and survived in the next. They
  now have direct domain tests. To check the result, the run was repeated with Vitest limited to the
  domain and application tests (temporary config, not committed). It left exactly the equivalent
  mutants above (99.02 %).
- In a worktree whose `node_modules` is a symlink, Vite's `server.fs` guard rejects some `?inline`
  CSS imports of the component tests. There, run Stryker with a local Vitest config that sets
  `server.fs.strict: false` (`vitest: { configFile }` in a local Stryker config). A normal checkout
  needs nothing extra.

## Rust (cargo-mutants)

_Filled in by the Rust half of T57._
