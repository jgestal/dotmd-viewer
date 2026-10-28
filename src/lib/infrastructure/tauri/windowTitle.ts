// Window titles follow each desktop's habit: macOS shows the document name alone (the close
// button carries the unsaved dot); Windows and Linux show "*name - App" with an asterisk.
export const APP_NAME = 'DotMD Viewer';

export const formatWindowTitle = (
  name: string,
  edited: boolean,
  isMac: boolean,
  hasDocument: boolean,
): string => {
  if (!hasDocument || name === APP_NAME) return APP_NAME;
  if (isMac) return name;
  return `${edited ? '*' : ''}${name} - ${APP_NAME}`;
};

export const runsOnMac = (): boolean =>
  typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
