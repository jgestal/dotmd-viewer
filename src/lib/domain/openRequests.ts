// What the operating system asks the app to do from outside the window: open files (launch
// arguments, Finder, a second instance) or run an action on one from the file manager's context
// menu or the command line (`--export-pdf`, `--print`, `--new`).
import { pdfFileName } from './printing';

/**
 * Open a file or folder, export a file to PDF (`out`, or next to it), print a file, or start an
 * empty document.
 */
export type OpenRequest =
  | { readonly action: 'open'; readonly path: string }
  | { readonly action: 'exportPdf'; readonly path: string; readonly out?: string }
  | { readonly action: 'print'; readonly path: string }
  | { readonly action: 'new' };

/** A request that does something beyond opening. */
export type ActionRequest = Exclude<OpenRequest, { action: 'open' }>;

const isAction = (request: OpenRequest): request is ActionRequest => request.action !== 'open';

/** The files and folders to open, in the order they were asked for. */
export const pathsToOpen = (requests: readonly OpenRequest[]): string[] =>
  requests.flatMap((request) => (request.action === 'open' ? [request.path] : []));

/** The actions to run, in the order they were asked for. */
export const actionsToRun = (requests: readonly OpenRequest[]): ActionRequest[] =>
  requests.filter(isAction);

/** Where an export writes its PDF: the destination asked for, or next to the file with its name. */
export const pdfDestination = ({ path, out }: { path: string; out?: string }): string =>
  out ?? pdfFileName(path);
