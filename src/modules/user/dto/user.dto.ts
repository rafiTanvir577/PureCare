import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Types } from 'mongoose';
import { User, Role, UserStatus, AddUserRequest, DataEntryRole, DataEntryUserStatus } from 'src/entity';

export class UserDto implements User {
  @ApiProperty()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsOptional()
  firstName: string;

  @ApiProperty()
  @IsOptional()
  lastName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ enum: Role })
  @IsNotEmpty()
  @IsString()
  role: Role;

  @ApiProperty()
  @IsOptional()
  profile?: object;

  @ApiProperty()
  @IsOptional()
  features?: Types.ObjectId[];

  @ApiProperty({ type: String, isArray: true })
  @IsOptional()
  admins?: string[];

  @ApiProperty({ type: String, enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status: UserStatus;
}

export class DataEntryProfileDto {
  @ApiProperty()
  @IsString({ message: 'Please upload a profile image' })
  @IsOptional()
  image?: string;
}

export class AddDataEntryUserRequestDto implements AddUserRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsOptional()
  @Type(() => DataEntryProfileDto)
  @ValidateNested()
  @IsObject()
  profile: DataEntryProfileDto;

  @ApiProperty({ enum: DataEntryRole })
  @IsEnum(DataEntryRole)
  @IsString()
  @IsNotEmpty()
  role: DataEntryRole;
}

export class GetDataEntryUserQueryDto {
  @ApiProperty({
    enum: DataEntryUserStatus,
    default: DataEntryUserStatus.ACTIVE,
  })
  @IsEnum(DataEntryUserStatus)
  @IsString()
  @IsNotEmpty()
  status: DataEntryUserStatus;
}
