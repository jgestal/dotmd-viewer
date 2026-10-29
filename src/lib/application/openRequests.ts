// Carrying out what the OS asked for from outside the window (see domain/openRequests.ts). Plain
// opens go together, like a drop, so the last folder and the last file win; each action then
// opens its file and runs on it. The app runs the two steps apart at start-up: files open before
// the window is shown, actions (which may show a print dialog) once it is on screen.
import {
  actionsToRun,
  pathsToOpen,
  pdfDestination,
  type ActionRequest,
  type OpenRequest,
} from '../domain/openRequests';

/** What the requests act on: the app's own actions. */
export interface RequestTarget {
  openPaths(paths: readonly string[]): Promise<void>;
  /** Opens the file; false when it did not end up open (missing, or the user kept their changes). */
  openFile(path: string): Promise<boolean>;
  /** Writes the open document as a PDF at `path`, without asking where. */
  exportPdfTo(path: string): Promise<void>;
  print(): Promise<void>;
  newDocument(): Promise<void>;
}

/** Opens the files and folders the requests name; actions are left to `runRequestedActions`. */
export const openRequested = async (
  requests: readonly OpenRequest[],
  target: RequestTarget,
): Promise<void> => {
  const paths = pathsToOpen(requests);
  if (paths.length > 0) await target.openPaths(paths);
};

/** Runs each action, one after the other, in the order asked for. */
export const runRequestedActions = async (
  requests: readonly OpenRequest[],
  target: RequestTarget,
): Promise<void> => {
  for (const request of actionsToRun(requests)) await runAction(request, target);
};

/** Both steps, for requests that arrive while the app is running. */
export const handleOpenRequests = async (
  requests: readonly OpenRequest[],
  target: RequestTarget,
): Promise<void> => {
  await openRequested(requests, target);
  await runRequestedActions(requests, target);
};

const runAction = async (request: ActionRequest, target: RequestTarget): Promise<void> => {
  if (request.action === 'new') return target.newDocument();
  if (!(await target.openFile(request.path))) return;
  if (request.action === 'print') return target.print();
  return target.exportPdfTo(pdfDestination(request));
};
