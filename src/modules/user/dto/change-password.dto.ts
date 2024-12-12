import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ChangePasswordRequest } from 'src/entity';

export class ChangePasswordRequestDto implements ChangePasswordRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/, {
    message: 'New password must be at least 8 characters and contain at least one letter and one number or symbol.',
  })
  newPassword: string;
}
