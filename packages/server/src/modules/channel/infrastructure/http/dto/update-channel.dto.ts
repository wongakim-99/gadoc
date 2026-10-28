import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class UpdateChannelDto {
    @IsString() @MinLength(1) @MaxLength(100) name!: string;
    @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
