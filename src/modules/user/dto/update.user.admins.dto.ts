import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { UpdateUserAdmins } from 'src/entity';

export class UpdateUserAdminsDto implements UpdateUserAdmins {
  @ApiProperty()
  @IsNotEmpty()
  adminId: string;
}
