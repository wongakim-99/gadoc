import { describe, expect, it } from 'vitest';
import { EMOJI_CATALOG, findEmojiChoices } from './emojiCatalog';

describe('emoji catalog', () => {
    it('keeps a unique, named local catalog without loading an external service', () => {
        expect(EMOJI_CATALOG.length).toBeGreaterThan(100);
        expect(new Set(EMOJI_CATALOG.map((choice) => choice.emoji)).size).toBe(EMOJI_CATALOG.length);
        expect(EMOJI_CATALOG.every((choice) => choice.name && choice.keywords)).toBe(true);
    });
    it('searches Korean, English aliases and literal emoji across all categories', () => {
        expect(findEmojiChoices('테스트', '추천').map((choice) => choice.emoji)).toEqual(['🧪']);
        expect(findEmojiChoices(':THUMBSUP:', '자연').map((choice) => choice.emoji)).toEqual(['👍']);
        expect(findEmojiChoices('🤝', '표정').map((choice) => choice.emoji)).toEqual(['🤝']);
        expect(findEmojiChoices('no-such-emoji', '추천')).toEqual([]);
    });
    it('preserves quick choices without duplicates and filters categories', () => {
        expect(findEmojiChoices('', '추천', ['👀', '👀', '🥳'])[0].emoji).toBe('👀');
        expect(findEmojiChoices('', '추천', ['👍']).filter((choice) => choice.emoji === '👍')).toHaveLength(1);
        expect(findEmojiChoices('', '상태').every((choice) => choice.category === '상태')).toBe(true);
    });
});
