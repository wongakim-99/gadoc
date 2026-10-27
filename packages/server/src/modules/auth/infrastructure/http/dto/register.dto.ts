import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { MaxLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @MaxLength(254)
    email: string;

    @ApiProperty({ example: 'username', minLength: 2 })
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    username: string;

    @ApiProperty({ example: 'password', minLength: 6 })
    @IsString()
    @MinLength(6)
    @MaxLength(72)
    password: string;
}
