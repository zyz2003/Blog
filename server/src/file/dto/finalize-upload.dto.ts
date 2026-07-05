import { IsString, IsNumber } from 'class-validator';

export class FinalizeUploadDto {
  @IsString()
  uri: string;

  @IsString()
  policy_id: string;

  @IsNumber()
  size: number;
}
