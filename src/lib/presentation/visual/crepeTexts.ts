// Crepe ships English labels for its floating UI (slash menu, selection toolbar, link and code
// block tools); these settings replace them with ours. Icons and the table and block handles
// have no text to translate.
import { CrepeFeature, type CrepeConfig } from '@milkdown/crepe';
import type { Translate } from '$lib/ports';

type FeatureConfigs = NonNullable<CrepeConfig['featureConfigs']>;

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export function crepeTexts(t: Translate): FeatureConfigs {
  const headings = Object.fromEntries(
    HEADING_LEVELS.map((level) => [`h${level}`, { label: t('visual.menu.heading', { level }) }]),
  );
  return {
    [CrepeFeature.Placeholder]: { text: t('visual.placeholder') },
    [CrepeFeature.BlockEdit]: {
      textGroup: {
        label: t('visual.menu.textGroup'),
        text: { label: t('visual.menu.text') },
        ...headings,
        quote: { label: t('visual.menu.quote') },
        divider: { label: t('visual.menu.divider') },
      },
      listGroup: {
        label: t('visual.menu.listGroup'),
        bulletList: { label: t('visual.menu.bulletList') },
        orderedList: { label: t('visual.menu.orderedList') },
        taskList: { label: t('visual.menu.taskList') },
      },
      advancedGroup: {
        label: t('visual.menu.advancedGroup'),
        // Images need somewhere to store the file, which this app does not have yet.
        image: null,
        codeBlock: { label: t('visual.menu.codeBlock') },
        table: { label: t('visual.menu.table') },
        math: { label: t('visual.menu.math') },
      },
    },
    [CrepeFeature.Toolbar]: {
      boldLabel: t('visual.toolbar.bold'),
      italicLabel: t('visual.toolbar.italic'),
      strikethroughLabel: t('visual.toolbar.strikethrough'),
      codeLabel: t('visual.toolbar.code'),
      linkLabel: t('visual.toolbar.link'),
      latexLabel: t('visual.toolbar.math'),
    },
    [CrepeFeature.LinkTooltip]: { inputPlaceholder: t('visual.link.placeholder') },
    [CrepeFeature.CodeMirror]: {
      searchPlaceholder: t('visual.code.searchLanguage'),
      noResultText: t('visual.code.noResult'),
      copyText: t('visual.code.copy'),
      previewLabel: t('visual.code.preview'),
      previewLoading: t('visual.code.previewLoading'),
      previewToggleText: (previewOnly) =>
        previewOnly ? t('visual.code.showSource') : t('visual.code.hideSource'),
    },
  };
}
