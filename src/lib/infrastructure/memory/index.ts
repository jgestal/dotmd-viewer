// In-memory adapters: test doubles for every port, with scripted answers and call records.
import { fakeTranslate } from './fakeTranslate';
import { MemoryContextMenu } from './memoryContextMenu';
import { MemoryDialogs } from './memoryDialogs';
import { MemoryFileSystem } from './memoryFileSystem';
import { MemoryOpener } from './memoryOpener';
import { MemoryNotifier } from './memoryNotifier';
import { MemoryOpenRequests } from './memoryOpenRequests';
import { MemoryPreferencesStore } from './memoryPreferencesStore';
import { MemoryRenderer } from './memoryRenderer';
import { MemoryWatcher } from './memoryWatcher';
import { MemoryWindow } from './memoryWindow';

export * from './browserDropTarget';
export * from './fakeTranslate';
export * from './memoryContextMenu';
export * from './memoryDialogs';
export * from './memoryFileSystem';
export * from './memoryMenu';
export * from './memoryNotifier';
export * from './memoryOpener';
export * from './memoryOpenRequests';
export * from './memoryPreferencesStore';
export * from './memoryRenderer';
export * from './memoryWatcher';
export * from './memoryWindow';

export interface MemoryServices {
  readonly fs: MemoryFileSystem;
  readonly watcher: MemoryWatcher;
  readonly renderer: MemoryRenderer;
  readonly dialogs: MemoryDialogs;
  readonly window: MemoryWindow;
  readonly preferences: MemoryPreferencesStore;
  readonly openRequests: MemoryOpenRequests;
  readonly opener: MemoryOpener;
  readonly contextMenu: MemoryContextMenu;
  readonly notifier: MemoryNotifier;
  readonly translate: typeof fakeTranslate;
}

/** One of each double, wired together: the watcher listens to `fs.simulateExternalWrite`. */
export const createMemoryServices = (): MemoryServices => {
  const fs = new MemoryFileSystem();
  return {
    fs,
    watcher: new MemoryWatcher(fs),
    renderer: new MemoryRenderer(),
    dialogs: new MemoryDialogs(),
    window: new MemoryWindow(),
    preferences: new MemoryPreferencesStore(),
    openRequests: new MemoryOpenRequests(),
    opener: new MemoryOpener(),
    contextMenu: new MemoryContextMenu(),
    notifier: new MemoryNotifier(),
    translate: fakeTranslate,
  };
};
