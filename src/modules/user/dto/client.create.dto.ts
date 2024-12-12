import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { SignupByInvitationRequest } from 'src/entity';

export class SignupByInvitationRequestDto implements SignupByInvitationRequest {
  @ApiProperty()
  @IsOptional()
  firstName: string;

  @ApiProperty()
  @IsOptional()
  lastName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one numeric digit, and one special character',
  })
  password: string;
}
