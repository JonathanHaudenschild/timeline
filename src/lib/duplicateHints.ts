export type DuplicateCandidate = {
  id: string;
  title: string;
  body?: string;
  meta: string;
};

export type DuplicateDraft = {
  id?: string;
  title: string;
  body?: string;
};

export type DuplicateHint = DuplicateCandidate & {
  score: number;
};

export function findDuplicateHints(
  draft: DuplicateDraft,
  candidates: readonly DuplicateCandidate[],
  excludeIds: readonly string[] = [],
  limit = 3,
): DuplicateHint[] {
  const title = normalizeText(draft.title);
  const body = normalizeText(draft.body ?? '');
  if (title.length < 4 && body.length < 10) return [];

  const excluded = new Set([draft.id, ...excludeIds].filter(Boolean));

  return candidates
    .filter((candidate) => !excluded.has(candidate.id))
    .map((candidate) => ({
      ...candidate,
      score: duplicateScore(
        { title, body },
        {
          title: normalizeText(candidate.title),
          body: normalizeText(candidate.body ?? ''),
        },
      ),
    }))
    .filter((candidate) => candidate.score >= 0.52)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

function duplicateScore(
  draft: { title: string; body: string },
  candidate: { title: string; body: string },
) {
  const titleScore = Math.max(
    diceCoefficient(draft.title, candidate.title),
    tokenOverlap(draft.title, candidate.title),
    substringScore(draft.title, candidate.title),
  );
  const bodyScore = Math.max(
    tokenOverlap(draft.body, candidate.body),
    substringScore(draft.body, candidate.body),
  );

  return Math.max(titleScore, bodyScore * 0.72, titleScore * 0.82 + bodyScore * 0.18);
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`*_~#[\]()>{}|:;,.!?+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value: string) {
  return value.split(' ').filter((word) => word.length > 2);
}

function tokenOverlap(left: string, right: string) {
  const leftWords = new Set(words(left));
  const rightWords = new Set(words(right));
  if (!leftWords.size || !rightWords.size) return 0;

  let shared = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) shared += 1;
  }

  return shared / Math.max(leftWords.size, rightWords.size);
}

function substringScore(left: string, right: string) {
  if (left.length < 4 || right.length < 4) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  return 0;
}

function diceCoefficient(left: string, right: string) {
  if (left.length < 3 || right.length < 3) return left === right ? 1 : 0;
  if (left === right) return 1;

  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  if (!leftPairs.size || !rightPairs.size) return 0;

  let shared = 0;
  const remaining = new Map(rightPairs);
  for (const [pair, count] of leftPairs) {
    const available = remaining.get(pair) ?? 0;
    if (!available) continue;
    const matched = Math.min(count, available);
    shared += matched;
    remaining.set(pair, available - matched);
  }

  return (2 * shared) / (pairCount(leftPairs) + pairCount(rightPairs));
}

function bigrams(value: string) {
  const compact = value.replace(/\s+/g, ' ');
  const pairs = new Map<string, number>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    const pair = compact.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }

  return pairs;
}

function pairCount(pairs: Map<string, number>) {
  let count = 0;
  for (const value of pairs.values()) count += value;
  return count;
}
