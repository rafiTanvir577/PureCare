import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { User } from 'src/entity';
import { UpdateUserRequestDto } from './dto/update.user.dto';
import { UserService } from './user.service';
import { ChangePasswordRequestDto } from './dto/change-password.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { SignupByInvitationRequestDto } from './dto/client.create.dto';
import { AllUserResponseDto, SingleUserResponseDto } from './dto/response.dto';
import { PermissionRequired } from 'src/decorators/permission.decorator';
import { PERMISSIONS } from 'src/entity/permissions.enum';
import { UpdateUserAdminsDto } from './dto/update.user.admins.dto';
import { authConfig } from 'config/auth';
import { User as UserInfo } from 'src/decorators/auth.decorator';
import { GetMyProfileResponseDto } from './dto/get.my-profile.dto';
import { GetMyFilesResponseDto } from './dto/file.response.dto';

const redirectUrl = authConfig?.pc_ADMIN_BASE_URL + authConfig?.FILE_UPLOAD_INVITE_URL;

@ApiTags('User')
@Controller('user')
@ApiBearerAuth()
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(new JwtAuthGuard())
  @ApiResponse({ type: AllUserResponseDto })
  @Get('/my-admins')
  async getAdmins(@UserInfo() userInfo: User) {
    return await this.userService.getAdmins(userInfo?.id);
  }

  @UseGuards(new JwtAuthGuard())
  @ApiResponse({ type: GetMyProfileResponseDto })
  @Get('/my-profile')
  async getProfile(@UserInfo() userInfo: User) {
    return await this.userService.getProfile(userInfo);
  }

  @ApiResponse({ type: GetMyFilesResponseDto })
  @PermissionRequired(PERMISSIONS.VIEW_FILES)
  @UseGuards(new JwtAuthGuard())
  @Get('my-files')
  @ApiQuery({
    name: 'page',
    type: Number,
    description: 'Page paramter is optional',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Limit paramter is optional',
    required: false,
  })
  @ApiQuery({
    name: 'adminId',
    type: String,
    description: 'Admin id is for further filtering',
    required: false,
  })
  async getFileList(@UserInfo() userInfo: User, @Query('page') page = 1, @Query('limit') limit = 10, @Query('adminId') adminId: string) {
    return await this.userService.getFileList(
      {
        adminId,
        user: userInfo?.id,
      },
      {
        page,
        limit,
      },
    );
  }

  @Patch('/update-profile')
  @UseGuards(new JwtAuthGuard())
  @ApiResponse({ type: SingleUserResponseDto })
  async updateUserProfile(@Body() data: UpdateUserRequestDto, @UserInfo() userInfo: User) {
    return await this.userService.updateUser(userInfo.id, data, userInfo);
  }

  @Patch('/change-password')
  @UseGuards(new JwtAuthGuard())
  async changePassword(@Body() passwordRequest: ChangePasswordRequestDto, @UserInfo() userInfo: User) {
    return await this.userService.changePassword(userInfo, passwordRequest);
  }

  @PermissionRequired(PERMISSIONS.VIEW_USERS)
  @UseGuards(RolesGuard)
  @Get('/all')
  @ApiResponse({ type: AllUserResponseDto })
  async findUser() {
    return await this.userService.getAllUser();
  }

  @Delete('/:id')
  @UseGuards(new JwtAuthGuard())
  async deleteUser(@Param('id') userId: string) {
    return await this.userService.deleteUser(userId);
  }

  @Get('/:role')
  @ApiResponse({ type: SingleUserResponseDto })
  @UseGuards(new JwtAuthGuard())
  async getUserByRole(@Param('role') role: string) {
    return await this.userService.getUser({ role });
  }

  @ApiParam({
    name: 'token',
    type: String,
    description: 'Token paramter is mandatory',
    required: true,
  })
  @Post('/set-password/:token')
  async signupByInvitation(@Param('token') token: string, @Body() data: SignupByInvitationRequestDto) {
    return await this.userService.signupByInvitation(token, data);
  }

  @Get('/:email/signup/invitation/status')
  async getSignupInvitationStatus(@Param('email') email: string) {
    return await this.userService.getSignupInvitationStatus(email);
  }

  @Get('/:email/file-upload/invitation/status')
  async getFileUploadInvitationStatus(@Param('email') email: string) {
    return await this.userService.getFileUploadInvitationStatus(email);
  }

  @Patch('/:id/update/admins')
  async updateUserAdmins(@Param('id') id: string, @Body() data: UpdateUserAdminsDto) {
    return await this.userService.updateUserAdmins({
      ...data,
      id,
    });
  }

  @Redirect(redirectUrl, HttpStatus.FOUND)
  @Get('/accept-invitation/:token')
  async acceptInvitaion(@Param('token') token: string) {
    const { data } = await this.userService.acceptInvitaion(token);
    //@ts-ignore
    return { url: data?.fileUploadLink, statusCode: HttpStatus.FOUND };
  }
}
