import { IsString, IsOptional } from 'class-validator';

export class DeleteUploadSessionDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  uri?: string;
}
