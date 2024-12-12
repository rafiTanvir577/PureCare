import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AddDataEntryUserRequestDto, GetDataEntryUserQueryDto } from './dto/user.dto';
import { User as UserInfo } from 'src/decorators/auth.decorator';
import { SetPasswordRequestDto } from '../waiting-list/dto';
import { UpdateDataEntryUserRequestDto } from './dto/update.user.dto';
import { User } from 'src/entity';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { PermissionRequired } from 'src/decorators/permission.decorator';
import { PERMISSIONS } from 'src/entity/permissions.enum';
import { RolesGuard } from 'src/guards/roles.guard';
import { authConfig } from 'config/auth';

@ApiTags('Data Entry User')
@Controller('data-entry-user')
export class DataEntryUserController {
  constructor(private userService: UserService) {}

  @PermissionRequired(PERMISSIONS.ADD_DATA_ENTRY_USER)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('/add')
  async addUser(@Body() data: AddDataEntryUserRequestDto, @UserInfo() owner: User) {
    return await this.userService.addUser(owner.id, data);
  }

  @PermissionRequired(PERMISSIONS.VIEW_DATA_ENTRY_USER)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('/all')
  async getAllUser(@Query() query: GetDataEntryUserQueryDto) {
    return await this.userService.getAllUser({ ...query, dataEntry: true }); // Here, dataEntry is true for the data entry flag.
  }

  @PermissionRequired(PERMISSIONS.VIEW_DATA_ENTRY_USER)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Here, id means the lab data entry user id property',
  })
  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return await this.userService.getUser({ id, dataEntry: true }); // Here, dataEntry is true for the data entry flag.
  }

  @PermissionRequired(PERMISSIONS.UPDATE_DATA_ENTRY_USER_INFO)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('/:id/update')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Here, id means the lab data entry user id property',
  })
  async updateUserProfile(@Param('id') id: string, @Body() data: UpdateDataEntryUserRequestDto, @UserInfo() userInfo: User) {
    return await this.userService.updateUser(id, data, userInfo);
  }

  @PermissionRequired(PERMISSIONS.UPDATE_DATA_ENTRY_USER_INFO)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('/:id/send-change-password-email')
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Here, id means the lab data entry user id property',
  })
  async changePasswordEmail(@Param('id') id: string) {
    return await this.userService.changePasswordEmail(id);
  }

  @Patch('/set-password/:token')
  async setPassword(@Param('token') token: string, @Body() data: SetPasswordRequestDto) {
    return await this.userService.setPassword(token, data);
  }

  @Get('verify-new-email/:token')
  async verifyNewEmail(@Param('token') token: string, @Res() res: Response) {
    await this.userService.verifyNewEmail(token);
    return res.redirect(authConfig?.pc_ADMIN_BASE_URL + '/email-verification/success');
  }
}
