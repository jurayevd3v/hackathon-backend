import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { LocalCategory } from './models/local_category.model';
import { CreateLocalCategoryDto } from './dto/create-local_category.dto';
import { UpdateLocalCategoryDto } from './dto/update-local_category.dto';

@Injectable()
export class LocalCategoriesService {
  constructor(
    @InjectModel(LocalCategory) private readonly repo: typeof LocalCategory,
  ) {}

  async create(dto: CreateLocalCategoryDto) {
    try {
      dto.name = this.normalizeName(dto.name);
      const category = await this.repo.create({ ...dto });

      return { message: 'Kategoriya muvaffaqiyatli saqlandi', category };
    } catch {
      throw new BadRequestException('Kategoriya saqlashda xatolik yuz berdi');
    }
  }

  async findAll(location_id: string) {
    return this.repo.findAll({ where: { location_id } });
  }

  async paginate(location_id: string, name: string, page: number) {
    const limit = 15;
    const offset = (Number(page) - 1) * limit;
    const where: WhereOptions = { location_id };
    if (name && name !== 'all') where.name = { [Op.iLike]: `%${name}%` };

    const [records, total_count] = await Promise.all([
      this.repo.findAll({ where, offset, limit }),
      this.repo.count({ where }),
    ]);

    return {
      status: 200,
      data: {
        records,
        pagination: {
          currentPage: page,
          total_pages: Math.ceil(total_count / limit),
          total_count,
        },
      },
    };
  }

  async findOne(id: string) {
    const category = await this.repo.findByPk(id);
    if (!category)
      throw new BadRequestException(`ID ${id} bo'yicha kategoriya topilmadi`);
    return category;
  }

  async update(id: string, dto: UpdateLocalCategoryDto) {
    const category = await this.repo.findByPk(id);
    if (!category)
      throw new BadRequestException(`ID ${id} bo'yicha kategoriya topilmadi`);
    dto.name = this.normalizeName(dto.name);

    return { message: 'Kategoriya muvaffaqiyatli yangilandi', category };
  }

  async delete(id: string) {
    const category = await this.repo.findByPk(id);
    if (!category)
      throw new BadRequestException(`ID ${id} bo'yicha kategoriya topilmadi`);

    await this.repo.destroy({ where: { id } });

    return { message: "Kategoriya muvaffaqiyatli o'chirildi" };
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
