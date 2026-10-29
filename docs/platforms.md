# Platform conventions

SimpleDotMD follows each desktop's habits instead of one menu for all. The menu tree is built
by `src/lib/presentation/menu/menuModel.ts` (pure, unit-tested per platform) and installed by
`src/lib/infrastructure/tauri/tauriMenu.ts`.

|                      | macOS                                                               | Windows                        | Linux (GNOME / KDE)         |
| -------------------- | ------------------------------------------------------------------- | ------------------------------ | --------------------------- |
| Where the menu lives | App menu bar (top of the screen)                                    | Inside the window              | Inside the window           |
| App menu             | About, Settings… ⌘,, Services, Hide, Hide Others, Show All, Quit ⌘Q | —                              | —                           |
| Settings             | App menu                                                            | File → Settings… (Ctrl+,)      | Edit → Preferences (Ctrl+,) |
| Quit                 | App menu → Quit ⌘Q                                                  | File → Exit (Alt+F4 closes)    | File → Quit (Ctrl+Q)        |
| About                | App menu                                                            | Help → About                   | Help → About                |
| Window menu          | Minimize, Zoom, Bring All to Front                                  | —                              | —                           |
| Mnemonics            | —                                                                   | Alt+letter (`&File`)           | Alt+letter (`&File`)        |
| Full screen          | View → Enter Full Screen ⌃⌘F (system item)                          | View → Full Screen F11         | View → Full Screen F11      |
| Shortcut display     | ⌘⇧S                                                                 | Ctrl+Shift+S                   | Ctrl+Shift+S                |
| Window title         | `notes.md` (unsaved dot in the close button, proxy icon)            | `*notes.md - SimpleDotMD`      | `*notes.md - SimpleDotMD`   |
| Open with…           | `CFBundleDocumentTypes`                                             | Installer registers the ProgId | `.desktop` with `MimeType`  |

Undo, Redo, Cut, Copy, Paste and Select All are the system's own items everywhere, so they act
on whatever has focus (editor, text field, preview selection).

Quit is the app command `app.quit`, not the system's own item (which would exit without asking).
Every way out (Quit, the close button, Alt+F4, the Dock's Quit) first asks about unsaved changes
(save / discard / cancel). Windows has no Quit accelerator: Alt+F4 is the window's own close.
Rust holds back exits the system requests (`RunEvent::ExitRequested` without a code) and emits
`quit-requested`; `quit_app` exits for good once the user agreed.

A shortcut can reach the app twice on some desktops — through the native menu and through the
page. `app.runCommand` drops the second arrival of the same command within 200 ms.
