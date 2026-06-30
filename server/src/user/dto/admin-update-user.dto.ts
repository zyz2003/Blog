import { IsOptional, IsString, IsEmail, IsNumber, IsIn } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  userGroupID?: string;

  @IsOptional()
  @IsNumber()
  @IsIn([1, 2, 3])
  status?: number;
}
