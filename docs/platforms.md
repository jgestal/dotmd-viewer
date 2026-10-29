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

## File manager actions and the command line

Right-clicking a Markdown file offers **Open**, **Export to PDF** and **Print** with SimpleDotMD.
Every entry runs the app's command line, which also works on its own:

```sh
simpledotmd notes.md                               # open (files or folders)
simpledotmd --export-pdf notes.md [--out out.pdf]  # write notes.pdf next to it (or --out), reveal it
simpledotmd --print notes.md                       # open it and show the print dialog
simpledotmd --new                                  # start an empty document
```

`src-tauri/src/open_requests.rs` parses the arguments (`requests_from_args`, unit-tested) into
open requests (`open`, `exportPdf`, `print`, `new`). They take the same road as a double-click:
launch arguments wait until the frontend listens, and a second launch hands its arguments to the
running window (single instance) and brings it forward. `src/lib/application/openRequests.ts`
carries them out: plain opens first, then each action opens its file and runs on it. At start-up
the actions wait until the window is on screen. An export started this way uses the current page
size and layout, never asks where to save, and replaces a PDF of the same name.

**macOS — Finder services.** `src-tauri/Info.plist` declares three services (`NSServices`, for
`net.daringfireball.markdown` files) and `src-tauri/src/finder_services.rs` registers the object
that answers them. They show under right-click ▸ **Services** (or **Quick Actions**), in English,
or in Spanish from `es.lproj/ServicesMenu.strings`. macOS lists them once the app is in
`/Applications` and has run once; they can be switched off in System Settings ▸ Keyboard ▸
Keyboard Shortcuts ▸ Services. There is no custom Dock menu (New Document, Open…): Tauri has no
API for it and it would mean patching tao's application delegate, while the Dock already lists
recent documents through `NSDocumentController` (`os_recents.rs`).

**Windows — Explorer verbs.** The NSIS installer hooks (`src-tauri/bundle/windows/hooks.nsh`)
write `HKCU\Software\Classes\SystemFileAssociations\.md\shell\SimpleDotMD.{Open,ExportPdf,Print}`
(and the same for `.markdown`) with the app's icon and the command
`"…\simpledotmd.exe" --export-pdf "%1"`; the uninstaller removes them. A registry verb has a single
label, so it is written in the installer's language: Spanish when Windows is in Spanish, English
otherwise. Windows 11 lists them under **Show more options**. The MSI (WiX) package does not add
them; use the setup `.exe` for this integration.

**Linux.** The launcher (`bundle/linux/simpledotmd.desktop`) has a **New Document** action
(`--new`) in the dock or app grid's right-click menu. The .deb and .rpm install a KDE Dolphin
service menu (`/usr/share/kio/servicemenus/simpledotmd-export.desktop`) with **SimpleDotMD ▸
Export to PDF / Print** for `text/markdown` files. GNOME Files (Nautilus) has no packaged
equivalent; add a script instead, which then shows under right-click ▸ **Scripts**:

```sh
mkdir -p ~/.local/share/nautilus/scripts
script=~/.local/share/nautilus/scripts/"Export to PDF with SimpleDotMD"
printf '#!/bin/sh\nfor f in "$@"; do simpledotmd --export-pdf "$f"; done\n' > "$script"
chmod +x "$script"
```
