// Static checker for the layered architecture. Pure: it works on in-memory sources,
// so the rules can be proven against fixtures without touching the file system.
import path from 'node:path/posix';

export interface SourceFile {
  /** Path relative to `src/`, with forward slashes (e.g. `lib/domain/document.ts`). */
  path: string;
  content: string;
}

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
const INVOKE_CALL = /\binvoke\s*[<(]/;
const TAURI_PACKAGE = /^@tauri-apps\//;
const RUNTIME_DECLARATION =
  /^\s*(?:export\s+)?(?:default\s+|declare\s+)?(?:async\s+)?(?:const|let|var|function|class|enum|abstract\s+class)\b|^\s*export\s+default\b/m;

const DOMAIN = 'lib/domain';
const PORTS = 'lib/ports';
const APPLICATION = 'lib/application';
const TAURI_INFRASTRUCTURE = 'lib/infrastructure/tauri';

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const importSpecifiers = (source: string): string[] =>
  [...stripComments(source).matchAll(IMPORT_SPECIFIER)].map((match) => match[1]);

/** Resolves an import to a path relative to `src/`; bare package specifiers are returned unchanged. */
export const resolveImport = (fromFile: string, specifier: string): string => {
  if (specifier.startsWith('$lib/')) return path.join('lib', specifier.slice('$lib/'.length));
  if (specifier.startsWith('.')) return path.join(path.dirname(fromFile), specifier);
  return specifier;
};

const isInside = (target: string, folder: string) =>
  target === folder || target.startsWith(`${folder}/`);
const isInsideAny = (target: string, folders: string[]) =>
  folders.some((folder) => isInside(target, folder));

const forbiddenImports = (file: SourceFile, allowedFolders: string[]) =>
  importSpecifiers(file.content)
    .filter((specifier) => !isInsideAny(resolveImport(file.path, specifier), allowedFolders))
    .map(
      (specifier) => `${file.path} imports '${specifier}' (allowed: ${allowedFolders.join(', ')})`,
    );

const filesIn = (files: SourceFile[], folder: string) =>
  files.filter((file) => isInside(file.path, folder));

export const checkDomain = (files: SourceFile[]): string[] =>
  filesIn(files, DOMAIN).flatMap((file) => forbiddenImports(file, [DOMAIN]));

export const checkApplication = (files: SourceFile[]): string[] =>
  filesIn(files, APPLICATION).flatMap((file) =>
    forbiddenImports(file, [DOMAIN, PORTS, APPLICATION]),
  );

export const checkPorts = (files: SourceFile[]): string[] =>
  filesIn(files, PORTS).flatMap((file) => {
    const runtime = RUNTIME_DECLARATION.test(stripComments(file.content))
      ? [`${file.path} declares runtime code; ports may only contain types and interfaces`]
      : [];
    return [...forbiddenImports(file, [DOMAIN, PORTS]), ...runtime];
  });

export const checkTauriIsolation = (files: SourceFile[]): string[] =>
  files
    .filter((file) => !isInside(file.path, TAURI_INFRASTRUCTURE))
    .flatMap((file) => {
      const code = stripComments(file.content);
      const tauriImports = importSpecifiers(code).filter((specifier) =>
        TAURI_PACKAGE.test(specifier),
      );
      const violations = tauriImports.map(
        (specifier) => `${file.path} imports '${specifier}' outside ${TAURI_INFRASTRUCTURE}`,
      );
      if (INVOKE_CALL.test(code))
        violations.push(`${file.path} calls invoke outside ${TAURI_INFRASTRUCTURE}`);
      return violations;
    });
