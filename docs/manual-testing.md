# Manual testing

Automated tests cover the business rules, the UI logic and a WebDriver smoke run on Windows and Linux. What
they cannot see is the operating system around the app: menus, dialogs, file managers, printing and the
installers. Run this checklist on each system before publishing a release, with the installer from the draft
release, and tick each box. Note the system version next to each column.

Use `docs/screenshots` and any Markdown folder with images, maths and a Mermaid diagram as test material; the
built-in guide (Help ▸ User Guide) works too.

## 1. Install and first launch

| Check                                                                                 | macOS | Windows | Linux |
| ------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| The installer runs (Gatekeeper / SmartScreen / `chmod +x` steps from the README work) |  [ ]  |   [ ]   |  [ ]  |
| The app icon looks right in the Dock / taskbar / launcher and in the file manager     |  [ ]  |   [ ]   |  [ ]  |
| First launch opens the User Guide in Split view; the window appears without a flash   |  [ ]  |   [ ]   |  [ ]  |
| Second launch reopens the last file; the window keeps its size and position           |  [ ]  |   [ ]   |  [ ]  |
| The language follows the system (English or Spanish) and can be changed in Settings   |  [ ]  |   [ ]   |  [ ]  |

## 2. Opening documents

| Check                                                                                      | macOS | Windows | Linux |
| ------------------------------------------------------------------------------------------ | :---: | :-----: | :---: |
| File ▸ Open… and File ▸ Open Folder… show the native dialogs                               |  [ ]  |   [ ]   |  [ ]  |
| Double-clicking a `.md` file opens it (after choosing SimpleDotMD as default or Open With) |  [ ]  |   [ ]   |  [ ]  |
| Opening a second file while the app runs reuses the same window                            |  [ ]  |   [ ]   |  [ ]  |
| Dropping a file, several files and a folder on the window opens them                       |  [ ]  |   [ ]   |  [ ]  |
| Dropping a file on the Dock icon (macOS) opens it                                          |  [ ]  |    –    |   –   |
| File ▸ Open Recent lists recent files; the system's recent documents list them too         |  [ ]  |   [ ]   |  [ ]  |
| A file edited by another program reloads; with unsaved changes the app asks first          |  [ ]  |   [ ]   |  [ ]  |

## 3. Sidebar

| Check                                                                                 | macOS | Windows | Linux |
| ------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| Explorer shows the folder; right-click: rename, move to trash, reveal, copy path      |  [ ]  |   [ ]   |  [ ]  |
| Dragging a file from the Explorer to the desktop / another app copies it              |  [ ]  |   [ ]   |  [ ]  |
| Favourites: star a file and a folder, reopen them after restarting                    |  [ ]  |   [ ]   |  [ ]  |
| Outline lists the headings and jumps to them; the sidebar resizes and hides (`Mod+\`) |  [ ]  |   [ ]   |  [ ]  |

## 4. Viewing and editing

| Check                                                                                    | macOS | Windows | Linux |
| ---------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| Preview renders tables, task lists, code highlighting, KaTeX maths and Mermaid           |  [ ]  |   [ ]   |  [ ]  |
| Local images (relative paths and `<picture>`) show; remote images show                   |  [ ]  |   [ ]   |  [ ]  |
| Edit (`Mod+E`), Code, Split (synchronised scrolling) and editing directly in the preview |  [ ]  |   [ ]   |  [ ]  |
| Continuous, Pages (A4 / Letter) and Slides layouts; slides navigate with the keyboard    |  [ ]  |   [ ]   |  [ ]  |
| Find and replace in the code editor; undo/redo from the Edit menu                        |  [ ]  |   [ ]   |  [ ]  |
| Status bar statistics update while typing                                                |  [ ]  |   [ ]   |  [ ]  |
| Dropping an image into a saved document copies it to `assets/` and inserts the link      |  [ ]  |   [ ]   |  [ ]  |
| Zoom in / out / reset                                                                    |  [ ]  |   [ ]   |  [ ]  |

## 5. Themes

| Check                                                                                     | macOS | Windows | Linux |
| ----------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| System, Light, Dark, Sepia and Night from View ▸ Theme, the header picker and `Mod+Alt+T` |  [ ]  |   [ ]   |  [ ]  |
| With System, changing the OS appearance switches the app while it runs                    |  [ ]  |   [ ]   |  [ ]  |
| The title bar (macOS: the app's own title strip) is readable in every theme               |  [ ]  |   [ ]   |  [ ]  |
| Mermaid diagrams and code blocks follow the theme                                         |  [ ]  |   [ ]   |  [ ]  |

## 6. Saving, export and print

| Check                                                                                 | macOS | Windows | Linux |
| ------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| Save, Save As; the window shows the edited state (macOS: dot in the close button)     |  [ ]  |   [ ]   |  [ ]  |
| Closing the window or quitting with unsaved changes asks Save / Don't Save / Cancel   |  [ ]  |   [ ]   |  [ ]  |
| Export to PDF: pages, maths, diagrams and images are right; the PDF opens             |  [ ]  |   [ ]   |  [ ]  |
| Export to HTML: the single file opens offline with styles, maths, diagrams and images |  [ ]  |   [ ]   |  [ ]  |
| Print shows the system print dialog with the paged document                           |  [ ]  |   [ ]   |  [ ]  |
| An encoded file (UTF-16, Windows-1252, BOM, CRLF) saves back with the same encoding   |  [ ]  |   [ ]   |  [ ]  |

## 7. Menus and context menus

| Check                                                                                   | macOS | Windows | Linux |
| --------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| Native menu bar: every item works and shows its shortcut; disabled items are greyed out |  [ ]  |   [ ]   |  [ ]  |
| macOS app menu: About, Settings, Services, Hide, Quit                                   |  [ ]  |    –    |   –   |
| Windows/Linux: Alt mnemonics, Help ▸ About, File ▸ Exit/Quit                            |   –   |   [ ]   |  [ ]  |
| Right-click in preview, code editor, on a link, an image and the document title         |  [ ]  |   [ ]   |  [ ]  |
| About shows the version and the credits (Juan Gestal, juan@gestal.es, gestal.es)        |  [ ]  |   [ ]   |  [ ]  |

## 8. File manager integration

| Check                                                                                                                             | macOS | Windows | Linux |
| --------------------------------------------------------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| macOS: Finder ▸ right-click a `.md` ▸ Services ▸ Open in / Export to PDF with / Print with SimpleDotMD (app in /Applications)     |  [ ]  |    –    |   –   |
| Windows: Explorer ▸ right-click a `.md` ▸ Open with / Export to PDF with / Print with SimpleDotMD (Windows 11: Show more options) |   –   |   [ ]   |   –   |
| Windows: uninstalling removes those entries                                                                                       |   –   |   [ ]   |   –   |
| Linux (KDE): Dolphin ▸ right-click ▸ Export to PDF / Print with SimpleDotMD                                                       |   –   |    –    |  [ ]  |
| Linux: the launcher's right-click "New Document" action                                                                           |   –   |    –    |  [ ]  |
| Command line: `simpledotmd --export-pdf file.md` writes `file.pdf` next to it and reveals it, also with the app already open      |  [ ]  |   [ ]   |  [ ]  |
| Command line: `simpledotmd --print file.md` and `simpledotmd --new`                                                               |  [ ]  |   [ ]   |  [ ]  |

## 9. Uninstall

| Check                                                                            | macOS | Windows | Linux |
| -------------------------------------------------------------------------------- | :---: | :-----: | :---: |
| Removing the app leaves the documents untouched; reinstalling keeps the settings |  [ ]  |   [ ]   |  [ ]  |

Write any failure as a GitHub issue with the system version, the steps and a screenshot.
