import { expect, it } from 'vitest';
import { workspaceSlug } from './workspaceSlug';

it('gives Korean-only names a usable unique slug instead of empty text or hyphens', () => {
    expect(workspaceSlug('개발팀', 'one')).toBe('workspace-one');
    expect(workspaceSlug('기획 팀', 'two')).toBe('workspace-two');
});
it('normalizes punctuation and whitespace in ASCII names', () => {
    expect(workspaceSlug('  Product & Design! ', 'unused')).toBe('product-design');
});
