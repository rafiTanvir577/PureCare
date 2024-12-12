import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AddUserRequest, DataEntryRole, DataEntryUserStatus, UpdateUserRequest } from 'src/entity';
import { DataEntryProfileDto } from './user.dto';
import { Type } from 'class-transformer';

export class UpdateUserRequestDto implements UpdateUserRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  profile: object;
}

export class UpdateDataEntryUserRequestDto implements AddUserRequest {
  @ApiProperty()
  @IsString()
  @IsOptional()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  @IsString()
  @IsOptional()
  email: string;

  @ApiProperty()
  @Type(() => DataEntryProfileDto)
  @ValidateNested()
  @IsObject()
  @IsOptional()
  profile: DataEntryProfileDto;

  @ApiProperty({ enum: DataEntryRole })
  @IsEnum(DataEntryRole)
  @IsString()
  @IsOptional()
  role: DataEntryRole;

  @ApiProperty({
    enum: DataEntryUserStatus,
    default: DataEntryUserStatus.ACTIVE,
  })
  @IsEnum(DataEntryUserStatus)
  @IsString()
  @IsOptional()
  status: DataEntryUserStatus;
}
