import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from 'src/entity';

class GetMyProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, enum: UserStatus })
  @IsEnum(UserStatus)
  status: string;

  @ApiProperty()
  profile: object;
}

export class GetMyProfileResponseDto {
  @ApiProperty()
  data: GetMyProfileDto;
}
