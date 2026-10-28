import { extractMentionTokens } from './mention-extraction';

describe('mention token boundaries', () => {
    it('does not turn an email address or URL into a broadcast mention', () => {
        expect(extractMentionTokens('hello@all mail+tag@everyone https://example.com/@channel')).toEqual([]);
    });
    it('keeps ordinary Korean and English mentions, punctuation and repeated calls', () => {
        expect(extractMentionTokens('안녕 @ALICE, @승찬! @all')).toEqual(['alice', '승찬', 'all']);
        expect(extractMentionTokens('@bob')).toEqual(['bob']);
        expect(extractMentionTokens('@bob')).toEqual(['bob']);
    });
});
