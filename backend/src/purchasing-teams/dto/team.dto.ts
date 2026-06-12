import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

export class AddMemberDto {
  @IsInt()
  userId: number;
}

export class AddScopeDto {
  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  componentCode?: string;
}
