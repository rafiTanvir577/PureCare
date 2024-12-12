import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WaitingListUser, WaitingListUserAuthenticationCodeTypes } from 'src/entity/waiting-list.entity';

export class SendAuthenticationCodeRequestDto implements Partial<WaitingListUser> {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Please provide a valid phone number with country code.(https://en.wikipedia.org/wiki/E.164)',
  })
  @IsString()
  @IsOptional()
  phone: string;
}

export class VerifyAuthenticationCodeRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authenticationCode: string;

  @ApiProperty({
    default: WaitingListUserAuthenticationCodeTypes.AUTHENTICATION_CODE,
  })
  @IsString()
  @IsEnum(WaitingListUserAuthenticationCodeTypes)
  @IsNotEmpty()
  type: string;
}
