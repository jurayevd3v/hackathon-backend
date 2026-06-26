import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Location } from './models/location.model';
import { User } from '../user/models/user.model';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateLocationActiveDto } from './dto/update-location-active.dto';
import { UpdateLocationContactedDto } from './dto/update-location-contact.dto';

const PAGE_LIMIT = 20;

@Injectable()
export class LocationService {
  constructor(
    @InjectModel(Location) private readonly locationRepo: typeof Location,
    @InjectModel(User) private readonly userRepo: typeof User,
  ) {}

  async createLocation(dto: CreateLocationDto) {
    if (dto.inn) {
      await this.ensureInnIsUnique(dto.inn);
    }

    if (dto.assignee_id) {
      await this.ensureUserExists(dto.assignee_id);
    }

    if (dto.parent_id) {
      await this.ensureLocationExists(dto.parent_id, 'parent_id');
    }

    const location = await this.locationRepo.create({ ...dto });

    return {
      message: 'Joylashuv muvaffaqiyatli yaratildi',
      data: location,
    };
  }

  async getAllLocations(page: number) {
    const { limit, offset } = this.buildPagination(page);

    const [records, total_count] = await Promise.all([
      this.locationRepo.findAll({
        include: [
          {
            model: User,
            as: 'assignee',
            attributes: ['id', 'full_name', 'role'],
          },
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      }),
      this.locationRepo.count(),
    ]);

    return this.buildPageResponse(records, total_count, page);
  }

  async getLocationById(id: string) {
    return this.findLocationOrFail(id);
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const location = await this.findLocationOrFail(id);

    if (dto.inn && dto.inn !== location.inn) {
      await this.ensureInnIsUnique(dto.inn, id);
    }

    if (dto.assignee_id) {
      await this.ensureUserExists(dto.assignee_id);
    }

    if (dto.parent_id) {
      if (dto.parent_id === id) {
        throw new BadRequestException(
          "Joylashuv o'zining ota (parent) joylashuvi bo'la olmaydi",
        );
      }
      await this.ensureLocationExists(dto.parent_id, 'parent_id');
    }

    await location.update({ ...dto });

    return { message: 'Joylashuv muvaffaqiyatli yangilandi' };
  }

  async updateLocationActive(id: string, dto: UpdateLocationActiveDto) {
    const location = await this.findLocationOrFail(id);
    await location.update({ is_active: dto.is_active });

    return { message: 'Joylashuv faollik holati yangilandi' };
  }

  async updateLocationContacted(id: string, dto: UpdateLocationContactedDto) {
    const location = await this.findLocationOrFail(id);
    await location.update({ is_contacted: dto.is_contacted });

    return { message: 'Joylashuv aloqa holati yangilandi' };
  }

  async deleteLocation(id: string) {
    const location = await this.findLocationOrFail(id);

    const childCount = await this.locationRepo.count({
      where: { parent_id: id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        "Bu joylashuvga bog'liq bola (filial) joylashuvlar mavjud, avval ularni o'chiring yoki qayta tayinlang",
      );
    }

    await location.destroy();

    return { message: "Joylashuv muvaffaqiyatli o'chirildi" };
  }

  private async findLocationOrFail(id: string): Promise<Location> {
    const location = await this.locationRepo.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'full_name', 'role'],
        },
      ],
    });
    if (!location) {
      throw new NotFoundException(`ID ${id} bo'yicha joylashuv topilmadi`);
    }
    return location;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.userRepo.findByPk(userId);
    if (!user) {
      throw new NotFoundException(
        `ID ${userId} bo'yicha foydalanuvchi (assignee) topilmadi`,
      );
    }
  }

  private async ensureLocationExists(
    locationId: string,
    fieldName: string,
  ): Promise<void> {
    const parent = await this.locationRepo.findByPk(locationId);
    if (!parent) {
      throw new NotFoundException(
        `ID ${locationId} bo'yicha ${fieldName} uchun joylashuv topilmadi`,
      );
    }
  }

  private async ensureInnIsUnique(
    inn: string,
    excludeId?: string,
  ): Promise<void> {
    const where: Record<string | symbol, any> = { inn };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const existing = await this.locationRepo.findOne({ where });
    if (existing) {
      throw new BadRequestException(
        `"${inn}" INN raqami bilan joylashuv allaqachon mavjud`,
      );
    }
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
}
