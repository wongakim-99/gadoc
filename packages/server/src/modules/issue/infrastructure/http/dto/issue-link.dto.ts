import { IsIn, IsMongoId } from 'class-validator';
export class IssueLinkDto {
    @IsIn(['document', 'message'])
    kind: 'document' | 'message';
    @IsMongoId()
    resourceId: string;
}
