/**
 * Computes the sort_order for a card dropped at `insertBeforeIndex` within a
 * column's task list (which must already exclude the task being moved). Using
 * the midpoint between neighbors keeps drag-and-drop O(1) — no reshuffling of
 * every other card's sort_order on each move.
 */
export function computeInsertSortOrder(
  tasksExcludingDragged: { sortOrder: number }[],
  insertBeforeIndex: number | null
): number {
  if (tasksExcludingDragged.length === 0) {
    return 1;
  }

  if (insertBeforeIndex === null || insertBeforeIndex >= tasksExcludingDragged.length) {
    return tasksExcludingDragged[tasksExcludingDragged.length - 1]!.sortOrder + 1;
  }

  if (insertBeforeIndex <= 0) {
    return tasksExcludingDragged[0]!.sortOrder - 1;
  }

  return (
    (tasksExcludingDragged[insertBeforeIndex - 1]!.sortOrder + tasksExcludingDragged[insertBeforeIndex]!.sortOrder) / 2
  );
}
