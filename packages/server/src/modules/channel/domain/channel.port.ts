import { ChannelEntity, ChannelType } from './channel.entity';

export interface IChannelRepository {
    setArchived(channelId: string, isArchived: boolean): Promise<ChannelEntity | null>;
    findById(id: string): Promise<ChannelEntity | null>;
    findByTeam(teamId: string): Promise<ChannelEntity[]>;
    findDirectChannel(teamId: string, memberIds: string[]): Promise<ChannelEntity | null>;
    save(data: {
        teamId: string;
        name: string;
        description: string | null;
        type: ChannelType;
        createdBy: string;
        memberIds: string[];
    }): Promise<ChannelEntity>;
    addMember(channelId: string, userId: string): Promise<ChannelEntity>;
    existsByNameInTeam(teamId: string, name: string): Promise<boolean>;
    findByExternalRef(teamId: string, source: string, externalId: string): Promise<ChannelEntity | null>;
    saveImported(data: {
        teamId: string; name: string; description: string | null; type: ChannelType;
        createdBy: string; memberIds: string[];
        externalSource: string; externalId: string;
    }): Promise<ChannelEntity>;
}

export const CHANNEL_REPOSITORY = Symbol('IChannelRepository');
