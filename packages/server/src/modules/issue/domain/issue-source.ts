import { createHash } from 'node:crypto';

/** Stable team-wide source identity; never a document or copied issue row. */
export function issueSourceId(teamId: string) {
    return createHash('sha256').update(`slacord-issue-source:${teamId}`).digest('hex').slice(0, 24);
}

export const ISSUE_STATUS_LABELS = { todo: '할 일', in_progress: '진행 중', in_review: '리뷰 중', done: '완료' };
export const ISSUE_PRIORITY_LABELS = { low: '낮음', medium: '보통', high: '높음', urgent: '긴급' };
