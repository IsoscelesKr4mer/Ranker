import type { RankItem, MergeSortState, ComparisonPair, MergeSortSnapshot } from '@/types';

export function createMergeSortState(items: RankItem[]): MergeSortState {
  const n = items.length;
  return {
    lists: items.map(item => [item]),
    listIndex: 0,
    leftPointer: 0,
    rightPointer: 0,
    merged: [],
    comparisons: 0,
    estimatedTotal: n > 1 ? Math.ceil(n * Math.log2(n)) : 0,
    history: [],
  };
}

export function getProgress(state: MergeSortState): { comparisons: number; estimatedTotal: number; progress: number; isComplete: boolean } {
  return {
    comparisons: state.comparisons,
    estimatedTotal: state.estimatedTotal,
    progress: state.estimatedTotal > 0 ? Math.min(state.comparisons / state.estimatedTotal, 1) : 1,
    isComplete: state.lists.length <= 1,
  };
}

export function getResult(state: MergeSortState): RankItem[] | null {
  if (state.lists.length === 1) return state.lists[0];
  return null;
}

export function getNextComparison(state: MergeSortState): ComparisonPair | null {
  if (state.lists.length <= 1) return null;

  // We need to find a valid comparison
  let s = { ...state };
  // Auto-advance past exhausted sublists
  while (s.listIndex < s.lists.length - 1) {
    const left = s.lists[s.listIndex];
    const right = s.lists[s.listIndex + 1];

    if (s.leftPointer < left.length && s.rightPointer < right.length) {
      return { left: left[s.leftPointer], right: right[s.rightPointer] };
    }

    // One side is exhausted — this shouldn't normally happen if choose() handles it
    return null;
  }

  return null;
}

// Deep clone helper for snapshots
function snapshot(state: MergeSortState): MergeSortSnapshot {
  return {
    lists: state.lists.map(l => [...l]),
    listIndex: state.listIndex,
    leftPointer: state.leftPointer,
    rightPointer: state.rightPointer,
    merged: [...state.merged],
    comparisons: state.comparisons,
  };
}

export function choose(state: MergeSortState, side: 'left' | 'right'): MergeSortState {
  if (state.lists.length <= 1) return state;

  const newState: MergeSortState = {
    ...state,
    lists: state.lists.map(l => [...l]),
    merged: [...state.merged],
    history: [...state.history, snapshot(state)],
  };

  const left = newState.lists[newState.listIndex];
  const right = newState.lists[newState.listIndex + 1];

  if (side === 'left') {
    newState.merged.push(left[newState.leftPointer]);
    newState.leftPointer++;
  } else {
    newState.merged.push(right[newState.rightPointer]);
    newState.rightPointer++;
  }

  newState.comparisons++;

  // Check if either side is exhausted
  if (newState.leftPointer >= left.length) {
    newState.merged = newState.merged.concat(right.slice(newState.rightPointer));
    finishMerge(newState);
  } else if (newState.rightPointer >= right.length) {
    newState.merged = newState.merged.concat(left.slice(newState.leftPointer));
    finishMerge(newState);
  }

  return newState;
}

function finishMerge(state: MergeSortState): void {
  state.lists.splice(state.listIndex, 2, state.merged);
  state.merged = [];
  state.leftPointer = 0;
  state.rightPointer = 0;
  state.listIndex++;

  if (state.listIndex >= state.lists.length - 1) {
    state.listIndex = 0;
  }
}

export function undo(state: MergeSortState): MergeSortState | null {
  if (state.history.length === 0) return null;

  const prev = state.history[state.history.length - 1];
  return {
    ...prev,
    estimatedTotal: state.estimatedTotal,
    history: state.history.slice(0, -1),
  };
}

export function removeItem(state: MergeSortState, itemId: string): MergeSortState {
  // Remove from all sublists
  const newLists = state.lists
    .map(list => list.filter(item => item.id !== itemId))
    .filter(list => list.length > 0);

  const n = newLists.reduce((sum, l) => sum + l.length, 0);

  return {
    lists: newLists,
    listIndex: 0,
    leftPointer: 0,
    rightPointer: 0,
    merged: [],
    comparisons: state.comparisons,
    estimatedTotal: n > 1 ? Math.ceil(n * Math.log2(n)) : 0,
    history: [], // Clear history on remove since state shape changed
  };
}
