// Which modal dialog is open (settings, keyboard shortcuts, about): purely local UI state.
export type DialogName = 'settings' | 'shortcuts' | 'about';

let current = $state<DialogName | null>(null);

export const dialogs = {
  get current(): DialogName | null {
    return current;
  },
  open(name: DialogName): void {
    current = name;
  },
  close(): void {
    current = null;
  },
};
