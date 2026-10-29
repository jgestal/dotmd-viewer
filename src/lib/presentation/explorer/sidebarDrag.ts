// The one drag controller of the sidebar, wired to the app: moves, favourites and drag out.
import { app } from '../app.svelte';
import { moveEntry } from '../contextMenu/entryActions';
import { DragController } from './dragController.svelte';
import type { DragSource, DropTarget } from './dragMove';
import { explorer } from './explorer.svelte';

function drop(source: DragSource, target: DropTarget): void {
  if (target.action === 'move') void moveEntry(source.path, target.folder);
  else if (target.action === 'favourite') app.toggleFavourite(source.path, source.entryKind);
  else if (source.kind === 'favourite') app.moveFavourite(source.index, target.to);
}

export const sidebarDrag = new DragController({
  isFavourite: (path) => app.isFavourite(path),
  drop,
  expand: (folder) => explorer.expand(folder),
  dragOut: (paths) => void app.dragOut(paths),
});
