import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from './../../../helper/responseService/service.response.interface';
import { UserDto } from './user.dto';

export class SingleUserResponseDto implements SuccessResponse<UserDto> {
  @ApiProperty()
  data: UserDto;
}

export class AllUserResponseDto implements SuccessResponse<UserDto[]> {
  @ApiProperty({ type: UserDto, isArray: true })
  data: UserDto[];
}
