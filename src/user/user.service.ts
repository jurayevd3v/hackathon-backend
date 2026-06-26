import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Op, WhereOptions } from 'sequelize';
import { User } from './models/user.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserLoginDto } from './dto/update-user-login.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateUserSalaryDto } from './dto/update-user-salary.dto';

const BCRYPT_ROUNDS = 10;
const PAGE_LIMIT = 15;

const AUTO_LOGIN_ROLES = [UserRole.ADMIN];

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User) private readonly userRepo: typeof User,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const exists = await this.userRepo.findOne({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (exists) return;

    const plainPassword = this.configService.get<string>(
      'SUPER_ADMIN_PASSWORD',
    );
    if (!plainPassword) {
      this.logger.error(
        "SUPER_ADMIN_PASSWORD env o'zgaruvchisi topilmadi! Super admin yaratilmadi.",
      );
      return;
    }

    try {
      const hashed_password = await this.hashPassword(plainPassword);
      await this.userRepo.create({
        full_name: 'Super Admin',
        username: this.configService.get<string>(
          'SUPER_ADMIN_USERNAME',
          'admin',
        ),
        is_login: true,
        hashed_password,
        role: UserRole.SUPER_ADMIN,
      });
      this.logger.log('Super Admin muvaffaqiyatli yaratildi');
    } catch (error) {
      this.logger.error('Super Admin yaratishda xatolik', error);
      throw new InternalServerErrorException(
        'Super Admin yaratishda xatolik yuz berdi',
      );
    }
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException(
        `"${dto.username}" username allaqachon mavjud`,
      );
    }

    const full_name = this.normalizeName(dto.full_name);
    const hashed_password = await this.hashPassword(dto.password);

    await this.userRepo.create({
      username: dto.username,
      full_name,
      hashed_password,
      role: dto.role,
      location_id: dto.location_id,
      is_login: AUTO_LOGIN_ROLES.includes(dto.role),
    });

    return { message: 'Foydalanuvchi muvaffaqiyatli yaratildi' };
  }

  async getAllUsers(role: string) {
    return this.userRepo.findAll({ where: { role } });
  }

  async getAdminUsers() {
    return this.userRepo.findAll({ where: { role: UserRole.ADMIN } });
  }

  async getUserById(id: string) {
    const user = await this.userRepo.findByPk(id, { include: { all: true } });
    if (!user)
      throw new NotFoundException(`ID ${id} bo'yicha foydalanuvchi topilmadi`);
    return user;
  }

  // async getUsersByLocation(location_id: string) {
  //   return this.userRepo.findAll({ where: { location_id } });
  // }

  async getPaginatedUsers(page: number) {
    const where = {
      role: {
        [Op.notIn]: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
      },
    };
    return this.paginateByRole(page, where);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    if (dto.username) {
      const duplicate = await this.userRepo.findOne({
        where: { username: dto.username, id: { [Op.ne]: id } },
      });
      if (duplicate) {
        throw new BadRequestException(
          `"${dto.username}" username allaqachon mavjud`,
        );
      }
    }

    const user = await this.getUserById(id);
    if (dto.full_name) {
      dto.full_name = this.normalizeName(dto.full_name);
    }
    await user.update(dto);

    return { message: 'Foydalanuvchi muvaffaqiyatli yangilandi' };
  }

  async updateUserLogin(id: string, dto: UpdateUserLoginDto) {
    const user = await this.getUserById(id);
    await user.update(dto);

    return { message: 'Foydalanuvchi login holati yangilandi' };
  }

  async updateUserSalary(id: string, dto: UpdateUserSalaryDto) {
    const user = await this.getUserById(id);
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    await user.update(dto);

    return { message: 'User salary yangilandi' };
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.getUserById(id);
    const isValid = await bcrypt.compare(
      dto.old_password,
      user.hashed_password,
    );
    if (!isValid) throw new BadRequestException("Joriy parol noto'g'ri");

    const hashed_password = await this.hashPassword(dto.new_password);
    await this.userRepo.update({ hashed_password }, { where: { id } });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  async resetUserPassword(id: string, dto: ResetPasswordDto) {
    const hashed_password = await this.hashPassword(dto.new_password);
    await this.userRepo.update({ hashed_password }, { where: { id } });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  async deleteUser(id: string) {
    const user = await this.getUserById(id);
    await user.destroy();

    return { message: "Foydalanuvchi muvaffaqiyatli o'chirildi" };
  }

  private async paginateByRole(page: number, where: WhereOptions) {
    const { limit, offset } = this.buildPagination(page);
    const [records, total_count] = await Promise.all([
      this.userRepo.findAll({ where, offset, limit }),
      this.userRepo.count({ where }),
    ]);
    return this.buildPageResponse(records, total_count, page);
  }

  private buildPagination(page: number) {
    const limit = PAGE_LIMIT;
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
    return { limit, offset };
  }

  private buildPageResponse<T>(
    records: T[],
    total_count: number,
    page: number,
  ) {
    return {
      status: 200,
      data: {
        records,
        pagination: {
          currentPage: Math.max(Number(page) || 1, 1),
          total_pages: Math.ceil(total_count / PAGE_LIMIT),
          total_count,
        },
      },
    };
  }

  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, BCRYPT_ROUNDS);
    } catch {
      throw new InternalServerErrorException(
        'Parolni xesh qilishda xatolik yuz berdi',
      );
    }
  }

  private normalizeName(name: string): string {
    if (!name) return name;

    return name
      .replace(/[‘’`´]/g, "'")
      .replace(/["«»„“”]/g, '')
      .trim()
      .toUpperCase();
  }
}
