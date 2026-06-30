import { IsString, IsNotEmpty, MinLength, IsOptional, IsEmail } from 'class-validator';

export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsString()
  @IsNotEmpty()
  userGroupID: string;
}
