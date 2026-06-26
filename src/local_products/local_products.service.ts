import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions, Order, literal, Includeable } from 'sequelize';
import { LocalProduct } from './models/local_product.model';
import { LocalCategory } from '../local_categories/models/local_category.model';
import { CreateLocalProductDto } from './dto/create-local_product.dto';
import { UpdateLocalProductDto } from './dto/update-local_product.dto';
import { FilesService } from '../common/files/files.service';
import { GeocodeService } from '../common/geocode/service';
import { Location } from '../locations/models/location.model';

export interface SearchLocalProductsResult {
  data: LocalProduct[];
  locations?: { id: string; name: string; address: string; count: number }[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

@Injectable()
export class LocalProductsService {
  private readonly logger = new Logger(LocalProductsService.name);

  constructor(
    @InjectModel(LocalProduct) private readonly repo: typeof LocalProduct,
    @InjectModel(Location) private readonly repoLocation: typeof Location,
    @InjectModel(LocalCategory)
    private readonly repoCategory: typeof LocalCategory,
    private readonly fileService: FilesService,
    private readonly geocodeService: GeocodeService,
  ) {}

  async create(dto: CreateLocalProductDto) {
    try {
      dto.name = this.normalizeName(dto.name);

      const existing = await this.repo.findOne({
        where: { name: dto.name, location_id: dto.location_id },
      });
      if (existing) {
        throw new BadRequestException('Bu mahsulot oldin qoshilgan');
      }

      if (dto.category_id) {
        const category = await this.repoCategory.findByPk(dto.category_id);
        if (!category) {
          throw new BadRequestException('Kategoriya topilmadi');
        }
      }

      const product = await this.repo.create(dto);

      return { message: 'Mahsulot muvaffaqiyatli yaratildi', product };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Mahsulot yaratishda xatolik: ' +
          (error instanceof Error ? error.message : 'nomalum xatolik'),
      );
    }
  }

  async findAll(location_id: string) {
    return this.repo.findAll({ where: { location_id } });
  }

  async findProduct(location_id: string, category_id: string) {
    return this.repo.findAll({ where: { location_id, category_id } });
  }

  async paginate(
    location_id: string,
    category_id: string,
    name: string,
    page: number,
  ) {
    const limit = 15;
    const offset = (Number(page) - 1) * limit;
    const where: WhereOptions = { location_id, category_id };
    if (name && name !== 'all') where.name = { [Op.iLike]: `%${name}%` };

    const [records, total_count] = await Promise.all([
      this.repo.findAll({
        where,
        include: [{ model: LocalCategory }],
        offset,
        limit,
      }),
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

  async paginateProduct(location_id: string, name: string, page: number) {
    const limit = 15;
    const offset = (Number(page) - 1) * limit;
    const where: WhereOptions = { location_id };
    if (name && name !== 'all') where.name = { [Op.iLike]: `%${name}%` };

    const [records, total_count] = await Promise.all([
      this.repo.findAll({
        where,
        include: [{ model: LocalCategory }],
        offset,
        limit,
      }),
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
    const product = await this.repo.findByPk(id, {
      include: [{ model: LocalCategory }],
    });
    if (!product)
      throw new BadRequestException(`ID ${id} bo'yicha mahsulot topilmadi`);
    return product;
  }

  async update(id: string, dto: UpdateLocalProductDto) {
    const { name, unit, prices } = dto;
    const product = await this.repo.findByPk(id);
    if (!product)
      throw new BadRequestException(`ID ${id} bo'yicha mahsulot topilmadi`);
    try {
      dto.name = name ? this.normalizeName(name) : product.name;
      dto.unit = unit ? unit : product.unit;
      dto.prices = prices ? prices : product.prices;

      await product.update(dto);
      return { message: 'Mahsulot muvaffaqiyatli yangilandi', product };
    } catch (error: unknown) {
      throw new BadRequestException(
        'Mahsulotni yangilashda xatolik: ' +
          (error instanceof Error ? error.message : 'nomalum xatolik'),
      );
    }
  }

  async delete(id: string) {
    const product = await this.repo.findByPk(id);
    if (!product)
      throw new BadRequestException(`ID ${id} bo'yicha mahsulot topilmadi`);

    await this.repo.destroy({ where: { id } });
    return { message: "Mahsulot muvaffaqiyatli o'chirildi" };
  }

  async findName(name: string) {
    return this.repo.findAll({
      where: { name: { [Op.iLike]: `%${name}%` } },
      attributes: ['id', 'name', 'unit', 'prices'],
    });
  }

  async searchLocalProducts(params: {
    name?: string;
    address?: string;
    location_id?: string;
    page?: number;
  }): Promise<SearchLocalProductsResult> {
    const { name, address, location_id, page = 1 } = params;
    const { limit, offset } = this.buildSearchPagination(page);

    let distanceLiteral: ReturnType<typeof literal> | null = null;

    if (address) {
      try {
        const { lat, lng } = await this.geocodeService.geocodeAddress(address);
        distanceLiteral = literal(`
        6371 * acos(
          cos(radians(${lat})) * cos(radians("location"."lat"))
          * cos(radians("location"."lng") - radians(${lng}))
          + sin(radians(${lat})) * sin(radians("location"."lat"))
        )
      `);
      } catch {
        // geocode xatosi
      }
    }

    const rawTerm = name?.trim() ?? '';
    const searchTerm = rawTerm ? this.normalizeName(rawTerm) : '';
    const productWhere = this.buildLocalProductWhere(searchTerm);

    const locationWhere: WhereOptions = location_id ? { id: location_id } : {};

    const [allProducts, totalCount, allLocations] = await Promise.all([
      this.repo.findAll({
        attributes: {
          include: distanceLiteral ? [[distanceLiteral, 'distance']] : [],
        },
        include: this.buildLocalProductIncludes(locationWhere),
        where: productWhere,
        order: this.buildLocalProductOrder(distanceLiteral, searchTerm),
        limit,
        offset,
        subQuery: false,
      }),

      this.repo.count({
        where: productWhere,
        include: [
          {
            model: Location,
            where: locationWhere,
            required: !!location_id,
          },
        ],
        distinct: true,
      }),

      this.repo.findAll({
        attributes: ['id'],
        where: productWhere,
        include: [
          {
            model: Location,
            as: 'location',
            attributes: ['id', 'name', 'address'],
            where: locationWhere,
            required: Object.keys(locationWhere).length > 0,
          },
        ],
        subQuery: false,
      }),
    ]);

    const locationsMap = new Map<
      string,
      { id: string; name: string; address: string; count: number }
    >();

    allLocations.forEach((product) => {
      const loc = product.location;
      if (loc?.id) {
        if (locationsMap.has(loc.id)) {
          locationsMap.get(loc.id)!.count += 1;
        } else {
          locationsMap.set(loc.id, {
            id: loc.id,
            name: loc.name,
            address: loc.address ?? 'Berilmagan',
            count: 1,
          });
        }
      }
    });

    return {
      data: allProducts,
      locations: locationsMap.size
        ? Array.from(locationsMap.values())
        : undefined,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
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

  private buildSearchPagination(page: number) {
    const limit = 30;
    const offset = (Number(page) - 1) * limit;
    return { limit, offset };
  }

  private buildLocalProductWhere(searchTerm?: string): WhereOptions {
    const where: Record<string | symbol, any> = {};

    if (searchTerm && searchTerm !== 'all') {
      const variants = this.getLocalSearchVariants(searchTerm);

      where[Op.or] = variants.map((v) => ({
        name: { [Op.iLike]: `%${v}%` },
      }));
    }

    return where;
  }

  private buildLocalProductIncludes(
    locationWhere: WhereOptions,
  ): Includeable[] {
    return [
      {
        model: Location,
        as: 'location',
        attributes: ['id', 'name', 'address', 'lat', 'lng'],
        where: locationWhere,
        required: Object.keys(locationWhere).length > 0,
      },
      {
        model: LocalCategory,
        attributes: ['id', 'name'],
        required: false,
      },
    ];
  }

  private buildLocalProductOrder(
    distanceLiteral: ReturnType<typeof literal> | null,
    searchTerm: string,
  ): Order {
    if (distanceLiteral) {
      return [[literal('distance'), 'ASC']];
    }

    if (!searchTerm || searchTerm === 'ALL') {
      return [[literal('"LocalProduct"."createdAt"'), 'DESC']];
    }

    const variants = this.getLocalSearchVariants(searchTerm);

    const nameCaseParts = variants
      .map(
        (v) => `
      WHEN "LocalProduct"."name" = '${v}' THEN 0
      WHEN "LocalProduct"."name" LIKE '${v}%' THEN 1
      WHEN "LocalProduct"."name" LIKE '%${v}%' THEN 2
    `,
      )
      .join('');

    const groupCase = `
    CASE
      ${nameCaseParts}
      ELSE 3
    END
  `;

    return [
      [literal(groupCase), 'ASC'],
      [literal('"LocalProduct"."price"'), 'ASC'],
    ];
  }

  private getLocalSearchVariants(searchTerm: string): string[] {
    const lower = searchTerm.toLowerCase();

    const raw = [
      lower,
      this.cyrillicToLatin(lower),
      this.latinToCyrillic(lower),
    ];

    return [...new Set(raw.map((v) => this.normalizeName(v)))];
  }

  private cyrillicToLatin(text: string): string {
    const map: Record<string, string> = {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'yo',
      ж: 'j',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'x',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'sh',
      ъ: '',
      ы: 'i',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
      ғ: 'g',
      қ: 'q',
      ҳ: 'h',
      ӯ: 'o',
      ў: 'o',
    };
    return text
      .split('')
      .map((c) => map[c] ?? c)
      .join('');
  }

  private latinToCyrillic(text: string): string {
    const map: Record<string, string> = {
      yo: 'ё',
      yu: 'ю',
      ya: 'я',
      ts: 'ц',
      ch: 'ч',
      sh: 'ш',
      a: 'а',
      b: 'б',
      v: 'в',
      g: 'г',
      d: 'д',
      e: 'е',
      j: 'ж',
      z: 'з',
      i: 'и',
      y: 'й',
      k: 'к',
      l: 'л',
      m: 'м',
      n: 'н',
      o: 'о',
      p: 'п',
      r: 'р',
      s: 'с',
      t: 'т',
      u: 'у',
      f: 'ф',
      x: 'х',
      q: 'қ',
      h: 'ҳ',
    };
    let result = text;
    for (const m of ['yo', 'yu', 'ya', 'ts', 'ch', 'sh']) {
      result = result.split(m).join(map[m]);
    }
    return result
      .split('')
      .map((c) => map[c] ?? c)
      .join('');
  }
}
