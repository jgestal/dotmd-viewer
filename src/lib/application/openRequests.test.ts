import { describe, expect, it } from 'vitest';
import type { OpenRequest } from '../domain/openRequests';
import {
  handleOpenRequests,
  openRequested,
  runRequestedActions,
  type RequestTarget,
} from './openRequests';

/** Records what the requests asked the app to do; `missing` files fail to open. */
const recordingTarget = (missing: readonly string[] = []) => {
  const calls: string[] = [];
  const target: RequestTarget = {
    openPaths: async (paths) => void calls.push(`openPaths ${paths.join(',')}`),
    openFile: async (path) => {
      calls.push(`openFile ${path}`);
      return !missing.includes(path);
    },
    exportPdfTo: async (path) => void calls.push(`exportPdfTo ${path}`),
    print: async () => void calls.push('print'),
    newDocument: async () => void calls.push('newDocument'),
  };
  return { target, calls };
};

const mixed: readonly OpenRequest[] = [
  { action: 'exportPdf', path: '/w/a.md' },
  { action: 'open', path: '/w/notes' },
  { action: 'print', path: '/w/b.md' },
  { action: 'open', path: '/w/c.md' },
  { action: 'new' },
];

describe('openRequested', () => {
  it('opens every plain request together and runs no action', async () => {
    const { target, calls } = recordingTarget();
    await openRequested(mixed, target);
    expect(calls).toEqual(['openPaths /w/notes,/w/c.md']);
  });

  it('does nothing when only actions are asked for', async () => {
    const { target, calls } = recordingTarget();
    await openRequested([{ action: 'new' }], target);
    expect(calls).toEqual([]);
  });
});

describe('runRequestedActions', () => {
  it('opens each file before running its action, in order', async () => {
    const { target, calls } = recordingTarget();
    await runRequestedActions(mixed, target);
    expect(calls).toEqual([
      'openFile /w/a.md',
      'exportPdfTo /w/a.pdf',
      'openFile /w/b.md',
      'print',
      'newDocument',
    ]);
  });

  it('exports to the destination asked for', async () => {
    const { target, calls } = recordingTarget();
    await runRequestedActions(
      [{ action: 'exportPdf', path: '/w/a.md', out: '/out/x.pdf' }],
      target,
    );
    expect(calls).toEqual(['openFile /w/a.md', 'exportPdfTo /out/x.pdf']);
  });

  it('skips the action of a file that did not open and goes on with the next', async () => {
    const { target, calls } = recordingTarget(['/w/a.md']);
    await runRequestedActions(
      [
        { action: 'exportPdf', path: '/w/a.md' },
        { action: 'print', path: '/w/a.md' },
        { action: 'print', path: '/w/b.md' },
      ],
      target,
    );
    expect(calls).toEqual(['openFile /w/a.md', 'openFile /w/a.md', 'openFile /w/b.md', 'print']);
  });
});

describe('handleOpenRequests', () => {
  it('opens the plain requests first, then runs the actions', async () => {
    const { target, calls } = recordingTarget();
    await handleOpenRequests(mixed, target);
    expect(calls).toEqual([
      'openPaths /w/notes,/w/c.md',
      'openFile /w/a.md',
      'exportPdfTo /w/a.pdf',
      'openFile /w/b.md',
      'print',
      'newDocument',
    ]);
  });
});
