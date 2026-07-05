import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateUploadSessionDto {
  @IsString()
  uri: string;

  @IsNumber()
  @Min(0)
  size: number;

  @IsString()
  policy_id: string;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean = false;
}
