// What the app shows when it runs in a plain browser (`npm run dev` without Tauri): a small
// workspace to click around in, and dialogs answered with the browser's own prompts. It makes
// the UI reviewable and screenshot-able without a native window.
import type { Dialogs, ExternalOpener, UnsavedChoice } from '../../ports';
import { DEMO_IMAGE_URL } from './demoImage';
import type { MemoryAssetUrls } from './memoryAssetUrls';
import { MemoryFileSystem } from './memoryFileSystem';

export const DEMO_FOLDER = '/demo';

const files: Readonly<Record<string, string>> = {
  'Welcome.md': `---
title: Welcome
tags: [demo]
---

# Welcome to SimpleDotMD

A **simple** viewer for *Markdown*, with ==highlights==, ~~mistakes~~ and \`inline code\`.

## Lists

- [x] Read Markdown
- [ ] Edit it when you want
- Export to PDF

1. First
2. Second

## Table

| Feature  | Supported |
| :------- | :-------: |
| Tables   |    yes    |
| Footnotes[^1] | yes  |

[^1]: Like this one.

> [!NOTE]
> Callouts work too.

## Maths

Inline $e^{i\\pi} + 1 = 0$ and display:

$$
\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Code

\`\`\`ts
export const greet = (name: string): string => \`Hello, \${name}!\`;
\`\`\`

## Image

Local images sit next to the document:

![SimpleDotMD icon](assets/icon.png)

## Diagram

\`\`\`mermaid
graph LR
  A[Open] --> B{Edit?}
  B -- yes --> C[Save]
  B -- no --> D[Read]
\`\`\`
`,
  'Slides.md': `# A short deck

Use the **Slides** layout to present.

---

## Second slide

- One point
- Another point

---

## Thanks

Made with SimpleDotMD.
`,
  'notes/Ideas.md': `# Ideas

Some *notes* in a sub-folder.

## Later

Nothing yet.
`,
  'notes/Todo.txt': 'Plain text files open too.\n',
};

/** The demo image's bytes, so exports can embed it as they would a file on disk. */
const demoImageBytes = (): Uint8Array =>
  Uint8Array.from(atob(DEMO_IMAGE_URL.slice(DEMO_IMAGE_URL.indexOf(',') + 1)), (char) =>
    char.charCodeAt(0),
  );

export const seedDemo = (fs: MemoryFileSystem, assetUrls: MemoryAssetUrls): void => {
  fs.seedFolder(DEMO_FOLDER);
  assetUrls.seed(`${DEMO_FOLDER}/assets/icon.png`, DEMO_IMAGE_URL);
  fs.seedBinary(`${DEMO_FOLDER}/assets/icon.png`, demoImageBytes());
  for (const [name, content] of Object.entries(files))
    fs.seedFile(`${DEMO_FOLDER}/${name}`, content);
};

/** Dialogs answered with `prompt`/`confirm`, good enough to exercise the flows in a browser. */
export class BrowserDialogs implements Dialogs {
  async openFile(): Promise<string | null> {
    return prompt('Open file', `${DEMO_FOLDER}/Welcome.md`);
  }

  async openFolder(): Promise<string | null> {
    return prompt('Open folder', DEMO_FOLDER);
  }

  async saveFile(defaultPath: string): Promise<string | null> {
    return prompt('Save as', defaultPath);
  }

  async askUnsaved(fileName: string): Promise<UnsavedChoice> {
    if (confirm(`Save the changes to “${fileName}”?`)) return 'save';
    return confirm('Discard the changes?') ? 'discard' : 'cancel';
  }

  async confirm(title: string, message: string): Promise<boolean> {
    return confirm(`${title}\n\n${message}`);
  }

  async alert(title: string, message: string): Promise<void> {
    alert(`${title}\n\n${message}`);
  }
}

/** External links open in a new browser tab. */
export class BrowserOpener implements ExternalOpener {
  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
