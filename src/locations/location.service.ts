import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Location } from './models/location.model';
import { User } from '../user/models/user.model';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateLocationActiveDto } from './dto/update-location-active.dto';
import { LocationType } from '../common/enums/location-type.enum';
import { GeocodeService } from '../common/geocode/service';

const PAGE_LIMIT = 20;

@Injectable()
export class LocationService {
  constructor(
    @InjectModel(Location) private readonly locationRepo: typeof Location,
    @InjectModel(User) private readonly userRepo: typeof User,
    private readonly geocodeService: GeocodeService,
  ) {}

  async createLocation(dto: CreateLocationDto) {
    if (dto.inn) {
      await this.ensureInnIsUnique(dto.inn);
    }
    const name = this.normalizeName(dto.name);

    let directorName: string | null = null;
    if (dto.director_name) {
      directorName = this.normalizeName(dto.director_name);
    }
    try {
      const location = await this.locationRepo.create({
        ...dto,
        name,
        director_name: directorName,
      });

      if (location.type === LocationType.FACTORY && location.address) {
        const coords = await this.geocodeService.geocodeAddress(
          location.address,
        );
        location.lat = coords.lat;
        location.lng = coords.lng;
        await location.save();
      }

      return {
        message: 'Joylashuv muvaffaqiyatli yaratildi',
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Joylashuv yaratishda xatolik: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        "Joylashuv yaratishda noma'lum xatolik yuz berdi",
      );
    }
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

    await location.update({ ...dto });

    return { message: 'Joylashuv muvaffaqiyatli yangilandi' };
  }

  async updateLocationActive(id: string, dto: UpdateLocationActiveDto) {
    const location = await this.findLocationOrFail(id);
    await location.update({ is_active: dto.is_active });

    return { message: 'Joylashuv faollik holati yangilandi' };
  }

  async deleteLocation(id: string) {
    const location = await this.findLocationOrFail(id);

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
  private normalizeName(name: string): string {
    if (!name) return name;
    return name
      .replace(/[''`´]/g, "'")
      .replace(/[«»„""]/g, '')
      .trim()
      .toUpperCase();
  }
}
