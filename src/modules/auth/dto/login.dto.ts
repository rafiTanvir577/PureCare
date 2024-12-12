import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsEmail, IsObject, ValidateNested } from 'class-validator';
import { LoginRequest } from 'src/entity';

export class LoginRequestMetaDataDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  platform: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  timezone: string;
}

export class LoginRequestDto implements LoginRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  deviceToken: string;

  @ApiProperty({
    default: {
      platform: 'Linux',
      timezone: 'Asia/Dhaka',
    },
  })
  @Type(() => LoginRequestMetaDataDto)
  @ValidateNested()
  @IsNotEmpty()
  @IsObject()
  metaData: LoginRequestMetaDataDto;
}
