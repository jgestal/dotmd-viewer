import { $$, expect } from '@wdio/globals';

describe('opening a folder from the command line', () => {
  it('lists its files in the explorer', async () => {
    const names = $$('.tree .row .name');
    await expect(names).toBeElementsArrayOfSize(2);
    await expect(names[0]).toHaveText('first.md');
    await expect(names[1]).toHaveText('second.md');
  });
});
