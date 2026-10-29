import { readFileSync } from 'node:fs';
import { browser, $, expect } from '@wdio/globals';

// The OS window title is native and invisible to WebDriver, so the in-app header (file name
// and unsaved marker) stands in for it. PDF export opens a native save dialog and is covered
// by unit tests instead.
const documentPath = process.env.E2E_DOCUMENT as string;
const TYPED = 'Typed by the smoke test. ';

// Windows and Linux only, where Mod is Ctrl.
const sendShortcut = (key: string) => browser.keys(['Control', key]);

describe('opening a Markdown file from the command line', () => {
  it('shows the file name, its heading and rendered maths', async () => {
    await expect($('h1.title')).toHaveText(expect.stringContaining('sample'));
    await expect($('article.markdown-body h1')).toHaveText('Smoke Heading');
    await expect($('article.markdown-body .katex')).toExist();
    await expect($('article.markdown-body table')).toExist();
  });

  it('shows the source in the code editor, flags edits and saves them', async () => {
    await sendShortcut('e');
    await sendShortcut('2');
    const content = $('.cm-content');
    await expect(content).toHaveText(expect.stringContaining('# Smoke Heading'));

    await content.click();
    await browser.keys(['Control', 'Home']);
    await browser.keys(TYPED.split(''));
    await expect($('h1.title .dirty')).toExist();

    await sendShortcut('s');
    await expect($('h1.title .dirty')).not.toExist();
    expect(readFileSync(documentPath, 'utf8')).toContain(TYPED);
  });

  it('shows the code and the preview side by side in split mode', async () => {
    await sendShortcut('3');
    await expect($('.split .cm-content')).toExist();
    await expect($('.split article.markdown-body')).toExist();
  });
});
