import { useState, useCallback, useRef } from 'react';
import type { RankItem, MergeSortState, ComparisonPair } from '@/types';
import { createMergeSortState, getNextComparison, choose, undo, getProgress, getResult, removeItem } from '@/lib/mergeSort';

export function useRanking() {
  const [sortState, setSortState] = useState<MergeSortState | null>(null);
  const [comparison, setComparison] = useState<ComparisonPair | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeout = useRef<number | null>(null);

  const startRanking = useCallback((items: RankItem[]) => {
    // Shuffle items randomly before starting
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const state = createMergeSortState(shuffled);
    setSortState(state);
    setComparison(getNextComparison(state));
  }, []);

  const makeChoice = useCallback((side: 'left' | 'right') => {
    if (!sortState || isAnimating) return;

    setIsAnimating(true);

    // Delay to allow animation
    animationTimeout.current = window.setTimeout(() => {
      const newState = choose(sortState, side);
      setSortState(newState);

      const progress = getProgress(newState);
      if (progress.isComplete) {
        setComparison(null);
      } else {
        setComparison(getNextComparison(newState));
      }

      setIsAnimating(false);
    }, 280);
  }, [sortState, isAnimating]);

  const undoChoice = useCallback(() => {
    if (!sortState || isAnimating) return;
    const prevState = undo(sortState);
    if (prevState) {
      setSortState(prevState);
      setComparison(getNextComparison(prevState));
    }
  }, [sortState, isAnimating]);

  const removeFromRanking = useCallback((itemId: string) => {
    if (!sortState || isAnimating) return;
    const newState = removeItem(sortState, itemId);
    setSortState(newState);

    const progress = getProgress(newState);
    if (progress.isComplete) {
      setComparison(null);
    } else {
      setComparison(getNextComparison(newState));
    }
  }, [sortState, isAnimating]);

  const progress = sortState ? getProgress(sortState) : null;
  const result = sortState ? getResult(sortState) : null;
  const canUndo = sortState ? sortState.history.length > 0 : false;

  return {
    sortState,
    comparison,
    progress,
    result,
    isAnimating,
    canUndo,
    startRanking,
    makeChoice,
    undoChoice,
    removeFromRanking,
  };
}
