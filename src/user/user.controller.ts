import { UserRole } from './../common/enums/user-role.enum';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles-auth-decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserLoginDto } from './dto/update-user-login.dto';
import { UpdateUserSalaryDto } from './dto/update-user-salary.dto';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const COMPANY_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY];

const ALL_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY];

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Create user' })
  @Roles(...ADMIN_ROLES)
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @ApiOperation({ summary: 'Get all users' })
  @Roles(...ADMIN_ROLES)
  @ApiQuery({ name: 'role', required: false })
  @Get('all')
  getAllUsers(@Query('role') role: string) {
    return this.userService.getAllUsers(role);
  }

  @ApiOperation({ summary: 'Get all admin users' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('admin')
  getAdminUsers() {
    return this.userService.getAdminUsers();
  }

  // @ApiOperation({ summary: 'Get users by location ID' })
  // @Roles(...COMPANY_ROLES)
  // @Get('locationId/:location_id')
  // getUsersByLocation(@Param('location_id') location_id: string) {
  //   return this.userService.getUsersByLocation(location_id);
  // }

  @ApiOperation({ summary: 'Get users with pagination' })
  @Roles(...ADMIN_ROLES)
  @ApiQuery({ name: 'page', required: false })
  @Get('page')
  getPaginatedUsers(@Query('page') page: number) {
    return this.userService.getPaginatedUsers(page);
  }

  @ApiOperation({ summary: 'Get user by ID' })
  @Roles(...ALL_ROLES)
  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @ApiOperation({ summary: 'Update user by ID' })
  @Roles(...COMPANY_ROLES)
  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(id, dto);
  }

  @ApiOperation({ summary: 'Update user salary by ID' })
  @Roles(...ADMIN_ROLES)
  @Put('salary/:id')
  async updateUserSalary(
    @Param('id') id: string,
    @Body() dto: UpdateUserSalaryDto,
  ) {
    return this.userService.updateUserSalary(id, dto);
  }

  @ApiOperation({ summary: 'Foydalanuvchi login holatini yangilash' })
  @Roles(...ADMIN_ROLES)
  @Put('login/:id')
  async updateUserLogin(
    @Param('id') id: string,
    @Body() dto: UpdateUserLoginDto,
  ) {
    return this.userService.updateUserLogin(id, dto);
  }

  @ApiOperation({ summary: 'Change user password' })
  @Roles(...COMPANY_ROLES)
  @Post('change-password/:id')
  changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(id, dto);
  }

  @ApiOperation({ summary: 'Reset user password' })
  @Roles(...ADMIN_ROLES)
  @Post('reset-password/:id')
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.userService.resetUserPassword(id, dto);
  }

  @ApiOperation({ summary: "Foydalanuvchini o'chirish" })
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}
