import { IsBoolean } from 'class-validator';

export class ArchiveChannelDto {
    @IsBoolean()
    isArchived: boolean;
}
