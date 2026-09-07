export type VotingBehaviorInput = {
  displayOrder?: unknown;
  selectionOrder?: unknown;
  searchUsed?: unknown;
  moveCount?: unknown;
  removeCount?: unknown;
  votingDurationMs?: unknown;
};

export type VotingBehaviorAssessment = {
  displayOrder: string[];
  selectionOrder: string[];
  searchUsed: boolean;
  moveCount: number;
  removeCount: number;
  votingDurationMs: number | null;
  behaviorScore: number;
  behaviorFlags: string[];
};

function cleanId(value: unknown) {
  return String(value || '').trim();
}

function boundedInteger(value: unknown, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(max, Math.floor(numeric)));
}

function boundedDuration(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.floor(numeric);
  if (rounded < 0 || rounded > 86_400_000) return null;
  return rounded;
}

function sanitizeDisplayOrder(raw: unknown, validSongIds: Set<string>) {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw.map(cleanId).filter(Boolean);
  if (cleaned.length !== validSongIds.size) return [];
  if (new Set(cleaned).size !== cleaned.length) return [];
  if (cleaned.some((id) => !validSongIds.has(id))) return [];
  return cleaned;
}

function sanitizeSelectionOrder(raw: unknown, validSongIds: Set<string>) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 200)
    .map(cleanId)
    .filter((id) => id && validSongIds.has(id));
}

function longestConsecutiveForwardRun(positions: number[]) {
  if (!positions.length) return 0;
  let longest = 1;
  let current = 1;
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index] === positions[index - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function forwardRatios(positions: number[]) {
  if (positions.length < 2) {
    return { consecutiveRatio: 0, monotonicRatio: 0 };
  }

  let consecutive = 0;
  let monotonic = 0;
  for (let index = 1; index < positions.length; index += 1) {
    const diff = positions[index] - positions[index - 1];
    if (diff === 1) consecutive += 1;
    if (diff > 0) monotonic += 1;
  }

  const pairs = positions.length - 1;
  return {
    consecutiveRatio: consecutive / pairs,
    monotonicRatio: monotonic / pairs,
  };
}

function finalSelectionOrder(selectionOrder: string[], finalRanking: string[]) {
  const finalSet = new Set(finalRanking);
  const lastIndex = new Map<string, number>();
  selectionOrder.forEach((songId, index) => {
    if (finalSet.has(songId)) lastIndex.set(songId, index);
  });

  return selectionOrder.filter(
    (songId, index) => finalSet.has(songId) && lastIndex.get(songId) === index
  );
}

export function assessVotingBehavior(input: {
  rawBehavior?: VotingBehaviorInput | null;
  validSongIds: Set<string>;
  finalRanking: string[];
}): VotingBehaviorAssessment {
  const raw = input.rawBehavior || {};
  const displayOrder = sanitizeDisplayOrder(raw.displayOrder, input.validSongIds);
  const selectionOrder = sanitizeSelectionOrder(raw.selectionOrder, input.validSongIds);
  const searchUsed = raw.searchUsed === true;
  const moveCount = boundedInteger(raw.moveCount, 500);
  const removeCount = boundedInteger(raw.removeCount, 500);
  const votingDurationMs = boundedDuration(raw.votingDurationMs);

  const flags: string[] = [];
  let score = 0;

  // Without a trustworthy full display order there is no useful mechanical-order analysis.
  if (displayOrder.length === input.validSongIds.size && displayOrder.length > 0) {
    const positionBySong = new Map(displayOrder.map((songId, index) => [songId, index]));
    const effectiveSelection = finalSelectionOrder(selectionOrder, input.finalRanking);
    const selectedPositions = effectiveSelection
      .map((songId) => positionBySong.get(songId))
      .filter((value): value is number => Number.isInteger(value));

    if (selectedPositions.length >= 6) {
      const { consecutiveRatio, monotonicRatio } = forwardRatios(selectedPositions);
      const longestRun = longestConsecutiveForwardRun(selectedPositions);

      if (consecutiveRatio >= 0.55) {
        score += 30;
        flags.push('selection_follows_display_order');
      } else if (consecutiveRatio >= 0.35) {
        score += 18;
        flags.push('selection_partly_follows_display_order');
      }

      if (longestRun >= 8) {
        score += 25;
        flags.push('long_consecutive_display_run');
      } else if (longestRun >= 6) {
        score += 18;
        flags.push('consecutive_display_run');
      } else if (longestRun >= 5) {
        score += 10;
        flags.push('short_consecutive_display_run');
      }

      if (monotonicRatio >= 0.9 && consecutiveRatio >= 0.25) {
        score += 15;
        flags.push('mostly_forward_through_display_list');
      }

      const topSongId = input.finalRanking[0] || null;
      const topSongFirstSelected = Boolean(topSongId && effectiveSelection[0] === topSongId);
      if (topSongFirstSelected && selectedPositions.length >= 7) {
        const fillerPositions = selectedPositions.slice(1);
        const fillerRatios = forwardRatios(fillerPositions);
        const fillerLongestRun = longestConsecutiveForwardRun(fillerPositions);

        if (fillerRatios.consecutiveRatio >= 0.45 && fillerLongestRun >= 5) {
          score += 20;
          flags.push('top_song_then_fill');
        }
      }
    }
  }

  if (votingDurationMs !== null) {
    if (votingDurationMs < 30_000) {
      score += 15;
      flags.push('very_fast_vote');
    } else if (votingDurationMs < 60_000) {
      score += 10;
      flags.push('fast_vote');
    } else if (votingDurationMs < 120_000) {
      score += 5;
      flags.push('fairly_fast_vote');
    }
  }

  // No reordering/removal is only contextual and gets a small weight if another pattern exists.
  if (score >= 18 && moveCount === 0 && removeCount === 0) {
    score += 5;
    flags.push('no_reordering');
  }

  return {
    displayOrder,
    selectionOrder,
    searchUsed,
    moveCount,
    removeCount,
    votingDurationMs,
    behaviorScore: Math.max(0, Math.min(100, score)),
    behaviorFlags: [...new Set(flags)],
  };
}
