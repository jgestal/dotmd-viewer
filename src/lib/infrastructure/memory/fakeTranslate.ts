import type { Translate } from '../../ports';

/** Returns the key, followed by the variables as JSON when there are any: `greeting {"name":"Ada"}`. */
export const fakeTranslate: Translate = (key, vars) =>
  vars === undefined ? key : `${key} ${JSON.stringify(vars)}`;
