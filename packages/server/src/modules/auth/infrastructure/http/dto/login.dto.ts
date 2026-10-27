import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';
import { MaxLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @MaxLength(254)
    email: string;

    @ApiProperty({ example: 'password' })
    @IsString()
    @MaxLength(72)
    password: string;

    @ApiPropertyOptional({ example: true, description: '로그인 유지 (30일)' })
    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}
