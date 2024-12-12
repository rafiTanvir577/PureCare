import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ResetPasswordRequest } from 'src/entity';

export class ResetPasswordRequestDto implements ResetPasswordRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one numeric digit, and one special character',
  })
  password: string;
}
