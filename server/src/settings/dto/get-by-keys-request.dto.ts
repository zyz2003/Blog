import { IsArray, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GetByKeysRequestDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  keys!: string[];
}
