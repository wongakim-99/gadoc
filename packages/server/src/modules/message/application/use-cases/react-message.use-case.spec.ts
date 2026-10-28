import { BadRequestException } from '@nestjs/common';
import { ReactMessageUseCase } from './react-message.use-case';

describe('reaction input boundary', () => {
    const repo = { toggleReaction: jest.fn() };
    const useCase = new ReactMessageUseCase(repo as any);
    beforeEach(() => {
        repo.toggleReaction.mockReset();
        repo.toggleReaction.mockResolvedValue({ id: 'message' });
    });
    it.each([null, {}, '', ' ', '\u0000', 'a'.repeat(101)])(
        'rejects invalid emoji before writing: %p',
        async (value) => {
            await expect(useCase.execute('message', value as string, 'actor')).rejects.toBeInstanceOf(
                BadRequestException,
            );
            expect(repo.toggleReaction).not.toHaveBeenCalled();
        },
    );
    it.each(['👍', '👩‍💻', ':team_wave:', '$literal-name'])('retains Unicode and custom names: %s', async (emoji) => {
        await useCase.execute('message', emoji, 'actor');
        expect(repo.toggleReaction).toHaveBeenCalledWith('message', emoji, 'actor');
    });
});
