import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateFileDto {
  @IsString()
  uri: string;

  @IsNumber()
  type: number;

  @IsOptional()
  @IsBoolean()
  err_on_conflict?: boolean = false;
}
