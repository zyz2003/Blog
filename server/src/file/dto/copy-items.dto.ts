import { IsArray, IsString } from 'class-validator';

export class CopyItemsDto {
  @IsArray()
  @IsString({ each: true })
  sourceIDs: string[];

  @IsString()
  destinationID: string;
}
