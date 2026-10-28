import DOMPurify from 'dompurify';

// The renderer keeps raw HTML (comrak `unsafe`), so everything goes through here before it
// reaches the DOM. data-* attributes (sourcepos, math style), classes, ids, disabled checkboxes
// and SVG are allowed; scripts, styles, event handlers and `javascript:` URLs are not.
const CONFIG = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'style'],
  FORBID_ATTR: ['style'],
  ALLOW_DATA_ATTR: true,
};

export const sanitize = (html: string): string => DOMPurify.sanitize(html, CONFIG);
