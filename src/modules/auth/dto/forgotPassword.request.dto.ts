import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ForgotPasswordRequest } from 'src/entity';

export class ForgotPasswordRequestDto implements ForgotPasswordRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
