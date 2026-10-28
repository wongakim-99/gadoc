import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANNOUNCEMENT_REPOSITORY, type IAnnouncementRepository } from '../../domain/announcement.port';

@Injectable()
export class ManageAnnouncementUseCase {
    constructor(@Inject(ANNOUNCEMENT_REPOSITORY) private readonly repo: IAnnouncementRepository) {}

    async requireInTeam(teamId: string, id: string) {
        if (!/^[a-f\d]{24}$/i.test(id)) throw new NotFoundException('공지를 찾을 수 없습니다.');
        const announcement = await this.repo.findById(id);
        if (!announcement || announcement.teamId !== teamId) throw new NotFoundException('공지를 찾을 수 없습니다.');
        return announcement;
    }

    private async requireManage(teamId: string, id: string, actorId: string, role: string) {
        const announcement = await this.requireInTeam(teamId, id);
        if (role !== 'owner' && role !== 'admin' && (role !== 'member' || announcement.createdBy !== actorId)) {
            throw new ForbiddenException('작성자 또는 워크스페이스 관리자만 공지를 수정·삭제할 수 있습니다.');
        }
        return announcement;
    }

    async update(teamId: string, id: string, actorId: string, role: string, fields: { title: string; content: string }) {
        await this.requireManage(teamId, id, actorId, role);
        const title = fields.title.trim(), content = fields.content.trim();
        if (!title || !content) throw new BadRequestException('제목과 내용을 입력해 주세요.');
        const result = await this.repo.updateContent(id, teamId, title, content);
        if (!result) throw new NotFoundException('공지를 찾을 수 없습니다.');
        return result;
    }

    async delete(teamId: string, id: string, actorId: string, role: string) {
        await this.requireManage(teamId, id, actorId, role);
        if (!(await this.repo.deleteById(id))) throw new NotFoundException('공지를 찾을 수 없습니다.');
        return { deleted: true };
    }
}
