import type { TimelineComment } from './types';

export function createTimelineComment(body: string, now = new Date().toISOString()): TimelineComment {
  return {
    id: crypto.randomUUID(),
    body: body.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTimelineComments(comments: readonly Partial<TimelineComment>[] | undefined) {
  if (!Array.isArray(comments)) return undefined;

  const normalized = comments
    .filter((comment) => comment && typeof comment === 'object')
    .map((comment, index) => {
      const createdAt = comment.createdAt || comment.updatedAt || new Date().toISOString();

      return {
        id: comment.id?.trim() || crypto.randomUUID(),
        body: comment.body?.trim() ?? '',
        createdAt,
        updatedAt: comment.updatedAt || createdAt,
      };
    })
    .filter((comment) => comment.body);

  return normalized.length ? normalized : undefined;
}

export function mergeTimelineComments(
  baseComments: readonly TimelineComment[] | undefined,
  localComments: readonly TimelineComment[] | undefined,
  remoteComments: readonly TimelineComment[] | undefined,
) {
  const result = new Map((remoteComments ?? []).map((comment) => [comment.id, comment]));
  const baseById = new Map((baseComments ?? []).map((comment) => [comment.id, comment]));
  const localById = new Map((localComments ?? []).map((comment) => [comment.id, comment]));

  for (const [id, localComment] of localById) {
    const baseComment = baseById.get(id);
    const remoteComment = result.get(id);
    if (!baseComment || changed(baseComment, localComment)) {
      result.set(id, chooseNewerComment(localComment, remoteComment));
    }
  }

  for (const [id, baseComment] of baseById) {
    if (localById.has(id)) continue;
    const remoteComment = result.get(id);
    if (!remoteComment || !changed(baseComment, remoteComment)) result.delete(id);
  }

  const comments = [...result.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return comments.length ? comments : undefined;
}

function chooseNewerComment(localComment: TimelineComment, remoteComment: TimelineComment | undefined) {
  if (!remoteComment) return localComment;
  return commentUpdatedAt(localComment) >= commentUpdatedAt(remoteComment) ? localComment : remoteComment;
}

function commentUpdatedAt(comment: TimelineComment) {
  return comment.updatedAt ?? comment.createdAt;
}

function changed(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}
