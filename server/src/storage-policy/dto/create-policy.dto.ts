import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  flag?: string;

  @IsOptional()
  @IsString()
  server?: string;

  @IsOptional()
  @IsString()
  bucketName?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean = false;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsNumber()
  maxSize?: number = 0;

  @IsOptional()
  @IsString()
  basePath?: string;

  @IsOptional()
  @IsString()
  virtualPath?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  nodeId?: number;
}
