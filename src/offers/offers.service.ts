import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Offer } from './models/offer.model';
import {
  OfferItem,
  OfferItemVariant,
} from '../offer_items/models/offer_item.model';
import { Sequelize } from 'sequelize-typescript';
import { Location } from '../locations/models/location.model';
import { UpdateOfferPaidSumDto } from './dto/update-offer-paid-sum.dto';
import { Includeable, literal, Op, WhereOptions } from 'sequelize';
import { OFFER_STATUS_TRANSITIONS } from './constants/offer-status-transitions';
import { JwtPayload } from '../common/guards/jwt-auth.guard';
import { User } from '../user/models/user.model';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { OfferItemStatus } from '../common/enums/offer-item-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { LocalProduct } from '../local_products/models/local_product.model';
import { GeocodeService } from '../common/geocode/service';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 100;

const OFFER_LIST_INCLUDE = [
  { model: Location },
  {
    model: OfferItem,
    where: { is_active: true },
    required: false,
    include: [
      {
        model: Location,
        required: false,
      },
    ],
  },
  { model: User, attributes: ['full_name'], required: false },
];

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectModel(Offer) private readonly offerRepo: typeof Offer,
    @InjectModel(OfferItem) private readonly offerItemRepo: typeof OfferItem,
    @InjectModel(LocalProduct)
    private readonly localProductRepo: typeof LocalProduct,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly geocodeService: GeocodeService,
  ) {}

  async createOffer(dto: CreateOfferDto, user_id: string) {
    const transaction = await this.sequelize.transaction();

    try {
      const { items, ...offerData } = dto;

      if (offerData.construction_site_name) {
        offerData.construction_site_name = this.normalizeName(
          offerData.construction_site_name,
        );
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      const lastOffer = await this.offerRepo.findOne({
        order: [['createdAt', 'DESC']],
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      const lastNumber = lastOffer
        ? parseInt(lastOffer.offer_number.split('-').pop() || '0', 10)
        : 0;

      const offer_number = `OFF-${year}${month}-${String(lastNumber + 1).padStart(4, '0')}`;

      const total_sum = items.reduce(
        (sum, item) => sum + item.cost_price * item.quantity,
        0,
      );

      const offer = await this.offerRepo.create(
        {
          ...offerData,
          created_by: user_id,
          offer_number,
          total_sum,
          date: offerData.date ? new Date(offerData.date) : undefined,
        },
        { transaction },
      );

      const variantsByIndex = await Promise.all(
        items.map((item) =>
          this.findVariantsForItem(
            item.product_name,
            item.quantity,
            offerData.address ?? '',
          ).catch(() => [] as OfferItemVariant[]),
        ),
      );

      await this.offerItemRepo.bulkCreate(
        items.map((item, i) => ({
          ...item,
          offer_id: offer.id,
          sale_price: item.cost_price,
          variants: variantsByIndex[i].length ? variantsByIndex[i] : undefined,
        })),
        { transaction },
      );

      await transaction.commit();

      return {
        message: 'Offer muvaffaqiyatli yaratildi',
        offer_id: offer.id,
        offer_number,
      };
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Offer yaratishda xatolik', error);
      throw new InternalServerErrorException(
        'Offer yaratishda xatolik yuz berdi',
      );
    }
  }

  private selectPrice(
    prices: LocalProduct['prices'],
    quantity: number,
  ): number {
    const { alone, average, wholesale } = prices ?? {};

    const tiers: { maxQty: number; price: number }[] = [];

    if (alone?.price != null && alone?.quantity != null) {
      tiers.push({ maxQty: alone.quantity, price: alone.price });
    }
    if (average?.price != null && average?.quantity != null) {
      tiers.push({ maxQty: average.quantity, price: average.price });
    }
    if (wholesale?.price != null) {
      tiers.push({ maxQty: Infinity, price: wholesale.price });
    }

    for (const tier of tiers) {
      if (quantity <= tier.maxQty) {
        return tier.price;
      }
    }

    return average?.price ?? alone?.price ?? wholesale?.price ?? 0;
  }

  private async findVariantsForItem(
    productName: string,
    quantity: number,
    offerAddress: string,
  ): Promise<OfferItemVariant[]> {
    let offerLat: number | null = null;
    let offerLng: number | null = null;

    if (offerAddress?.trim()) {
      try {
        const coords = await this.geocodeService.geocodeAddress(offerAddress);
        offerLat = coords.lat;
        offerLng = coords.lng;
      } catch {
        // geocode ishlamasa faqat narx bo'yicha sort
      }
    }

    const searchTerm = this.normalizeName(productName.trim());
    const nameVariants = this.getLocalSearchVariants(searchTerm);

    const distanceLiteral =
      offerLat !== null && offerLng !== null
        ? literal(`
            6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(${offerLat})) * cos(radians("location"."lat"))
                * cos(radians("location"."lng") - radians(${offerLng}))
                + sin(radians(${offerLat})) * sin(radians("location"."lat"))
              ))
            )
          `)
        : null;

    const products = await this.localProductRepo.findAll({
      attributes: {
        include: distanceLiteral ? [[distanceLiteral, 'distance']] : [],
      },
      where: {
        [Op.or]: nameVariants.map((v) => ({
          name: { [Op.iLike]: `%${v}%` },
        })),
      },
      include: [
        {
          model: Location,
          as: 'location',
          attributes: ['id', 'name', 'address', 'lat', 'lng'],
          required: true,
        },
      ] as Includeable[],
      order: distanceLiteral
        ? [[literal('distance'), 'ASC']]
        : [['createdAt', 'DESC']],
      limit: 30,
      subQuery: false,
    });

    if (!products.length) return [];

    const scored = products.map((p) => {
      const price = this.selectPrice(p.prices, quantity);
      const distance =
        offerLat !== null ? ((p.get('distance') as number) ?? 9999) : 9999;

      return { product: p, price, distance };
    });

    scored.sort((a, b) => {
      const distDiff = a.distance - b.distance;
      if (Math.abs(distDiff) > 5) return distDiff;
      return a.price - b.price;
    });

    return scored.slice(0, 5).map(({ product, price }) => ({
      id: uuidv4(),
      factory_id: product.location.id,
      factory_name: product.location.name,
      address: product.location.address ?? '',
      product_name: product.name,
      cost_price: price,
      sale_price: price,
      is_delivery: false,
    }));
  }

  async getOfferById(id: string, user: JwtPayload) {
    const offer = await this.offerRepo.findByPk(id, {
      include: OFFER_LIST_INCLUDE,
    });
    if (!offer)
      throw new NotFoundException(`ID ${id} bo'yicha offer topilmadi`);

    if (user.role === 'broker' && offer.status === OfferStatus.NEW) {
      await offer.update({ status: OfferStatus.IN_PROGRESS });
    }
    return offer;
  }

  async getPaginatedOffers(status: string, page = 1, limit?: number) {
    const { safeLimit, safePage, offset } = this.buildPagination(page, limit);

    const { rows, count: total_count } = await this.offerRepo.findAndCountAll({
      where: { status },
      include: OFFER_LIST_INCLUDE,
      offset,
      limit: safeLimit,
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return this.buildPageResponse(rows, total_count, safePage, safeLimit);
  }

  async getPaginatedOffersAll(page = 1, limit?: number) {
    const { safeLimit, safePage, offset } = this.buildPagination(page, limit);
    const statuses = Object.values(OfferStatus);

    const groupedResults = await Promise.all(
      statuses.map(async (status) => {
        const { rows, count } = await this.offerRepo.findAndCountAll({
          where: { status },
          include: OFFER_LIST_INCLUDE,
          offset,
          limit: safeLimit,
          order: [['createdAt', 'DESC']],
          distinct: true,
        });
        return { status, rows, count };
      }),
    );

    const grouped = {} as Record<string, Offer[]>;
    const countByStatus = {} as Record<string, number>;

    for (const { status, rows, count } of groupedResults) {
      grouped[status] = rows;
      countByStatus[status] = count;
    }

    const total_count = Object.values(countByStatus).reduce((a, b) => a + b, 0);

    return {
      data: grouped,
      total_count,
      counts: countByStatus,
      page: safePage,
      limit: safeLimit,
      total_pages: Math.ceil(
        Math.max(...Object.values(countByStatus)) / safeLimit,
      ),
    };
  }

  async getPaginatedOffersByLocation(
    location_id: string,
    page = 1,
    limit?: number,
  ) {
    const { safeLimit, safePage, offset } = this.buildPagination(page, limit);

    const { rows, count: total_count } = await this.offerRepo.findAndCountAll({
      where: { location_id },
      include: [
        { model: OfferItem, where: { is_active: true }, required: false },
      ],
      offset,
      limit: safeLimit,
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return this.buildPageResponse(rows, total_count, safePage, safeLimit);
  }

  async findAllOffersWithFilter(
    address?: string,
    created_by?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const { offset, currentPage } = this.pagination(page, limit);

      const offerWhere: WhereOptions = {};
      const locationWhere: WhereOptions = {};

      const normalizedAddress = address
        ? this.normalizeName(address.trim())
        : null;
      if (normalizedAddress) {
        locationWhere['address'] = { [Op.iLike]: `%${normalizedAddress}%` };
      }

      if (created_by && created_by.length > 0) {
        offerWhere['created_by'] = created_by;
      }

      const hasAddressFilter = !!normalizedAddress;

      const { rows: offers, count } = await this.offerRepo.findAndCountAll({
        where: offerWhere,
        include: [
          {
            model: Location,
            as: 'location',
            attributes: ['id', 'name', 'address', 'type', 'phone'],
            where: hasAddressFilter ? locationWhere : undefined,
            required: hasAddressFilter,
          },
        ],
        offset,
        limit,
        order: [['createdAt', 'DESC']],
        distinct: true,
        col: 'id',
      });

      return this.pageResponse(offers, count, currentPage, limit);
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Takliflarni filterlashda xatolik yuz berdi',
      );
    }
  }

  async findAllOffersBySearchTerm(
    searchTerm?: string,
    page: number = 1,
    limit?: number,
  ) {
    const { safeLimit, safePage, offset } = this.buildPagination(page, limit);
    const statuses = Object.values(OfferStatus);

    const offerWhere: any = {};

    const search =
      searchTerm && searchTerm !== 'all'
        ? this.normalizeName(searchTerm.trim())
        : null;

    if (search) {
      Object.assign(offerWhere, {
        [Op.or]: [
          { offer_number: { [Op.iLike]: `%${search}%` } },
          Sequelize.literal(`EXISTS (
            SELECT 1 FROM "locations" AS "loc"
            WHERE "loc"."id" = "Offer"."location_id"
            AND (
              "loc"."name" ILIKE '%${search}%'
              OR "loc"."phone" ILIKE '%${search}%'
              OR "loc"."director_name" ILIKE '%${search}%'
            )
          )`),
        ],
      });
    }

    const groupedResults = await Promise.all(
      statuses.map(async (status) => {
        const { rows, count } = await this.offerRepo.findAndCountAll({
          where: { ...offerWhere, status },
          include: OFFER_LIST_INCLUDE,
          offset,
          limit: safeLimit,
          order: [['createdAt', 'DESC']],
          distinct: true,
        });
        return { status, rows, count };
      }),
    );

    const grouped = {} as Record<string, Offer[]>;
    const countByStatus = {} as Record<string, number>;

    for (const { status, rows, count } of groupedResults) {
      grouped[status] = rows;
      countByStatus[status] = count;
    }

    const total_count = Object.values(countByStatus).reduce((a, b) => a + b, 0);

    return {
      data: grouped,
      total_count,
      counts: countByStatus,
      page: safePage,
      limit: safeLimit,
      total_pages: Math.ceil(
        Math.max(...Object.values(countByStatus)) / safeLimit,
      ),
    };
  }

  async updateOffer(id: string, dto: UpdateOfferDto) {
    const [updated] = await this.offerRepo.update(
      {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
      { where: { id }, returning: true },
    );

    if (!updated)
      throw new NotFoundException(`ID ${id} bo'yicha offer topilmadi`);

    return { message: 'Offer muvaffaqiyatli yangilandi' };
  }

  async updateOfferStatus(id: string, dto: UpdateOfferStatusDto) {
    const transaction = await this.sequelize.transaction();

    try {
      const offer = await this.offerRepo.findByPk(id, { transaction });
      if (!offer)
        throw new NotFoundException(`ID ${id} bo'yicha offer topilmadi`);

      const allowedTransitions = OFFER_STATUS_TRANSITIONS[offer.status];

      if (!allowedTransitions?.includes(dto.status)) {
        throw new BadRequestException(
          `${offer.status} statusidan ${dto.status} ga o'tkazib bo'lmaydi. ` +
            `Ruxsat etilgan: ${allowedTransitions?.join(', ') || "yo'q"}`,
        );
      }

      if (dto.status === OfferStatus.CONTRACT_SIGNED && !dto.contract_number) {
        throw new BadRequestException(
          'CONTRACT_SIGNED statusida contract_number majburiy',
        );
      }

      let updatedItemsCount = 0;
      let skippedItemsCount = 0;

      if (dto.status === OfferStatus.NEW) {
        const passivItemsCount = await this.offerItemRepo.count({
          where: {
            offer_id: id,
            is_active: true,
            status: {
              [Op.in]: [
                OfferItemStatus.PENDING,
                OfferItemStatus.IN_PROGRESS,
                OfferItemStatus.VARIANT_COMPLETED,
              ],
            },
          },
        });

        if (passivItemsCount > 0) {
          const totalActiveItems = await this.offerItemRepo.count({
            where: { offer_id: id, is_active: true },
            transaction,
          });

          const itemsToUpdate = await this.offerItemRepo.findAll({
            where: {
              offer_id: id,
              is_active: true,
              status: OfferItemStatus.VARIANT_COMPLETED,
            },
            transaction,
          });

          for (const item of itemsToUpdate) {
            await item.update(
              { status: OfferItemStatus.IN_PROGRESS },
              { transaction },
            );
            updatedItemsCount++;
          }

          skippedItemsCount = totalActiveItems - updatedItemsCount;
        } else {
          throw new BadRequestException(
            "Barcha itemlar muxim bosqichlarga o'tib bo'lgan, offerni New holatiga o'tkazish imkonsiz",
          );
        }
      }

      await offer.update(
        {
          status: dto.status,
          ...(dto.contract_number && { contract_number: dto.contract_number }),
        },
        { transaction },
      );

      await transaction.commit();

      if (updatedItemsCount > 0 || skippedItemsCount > 0) {
        return {
          message: 'Offer statusi muvaffaqiyatli yangilandi',
          updatedItemsCount,
          skippedItemsCount,
        };
      }
      return { message: 'Offer statusi muvaffaqiyatli yangilandi' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateOfferPaidSum(id: string, dto: UpdateOfferPaidSumDto) {
    const transaction = await this.sequelize.transaction();

    try {
      const offer = await this.offerRepo.findByPk(id, { transaction });
      if (!offer)
        throw new NotFoundException(`ID ${id} bo'yicha offer topilmadi`);

      const totalSum = Number(offer.total_sum);

      if (dto.paid_sum > totalSum) {
        throw new BadRequestException(
          `paid_sum ${totalSum} dan oshmasligi kerak`,
        );
      }

      const payment_status = this.resolvePaymentStatus(dto.paid_sum, totalSum);

      await offer.update(
        {
          paid_sum: dto.paid_sum,
          payment_status,
          status: OfferStatus.PAYMENT_IN_PROGRESS,
        },
        { transaction },
      );

      if (dto.paid_sum > 0) {
        await this.offerItemRepo.update(
          { status: OfferItemStatus.CONTRACT_READY },
          { where: { offer_id: id, is_active: true }, transaction },
        );
      }

      await transaction.commit();

      return { message: "To'lov summasi muvaffaqiyatli yangilandi" };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteOffer(id: string) {
    const offer = await this.offerRepo.findByPk(id);
    if (!offer)
      throw new NotFoundException(`ID ${id} bo'yicha offer topilmadi`);

    await offer.destroy();

    return { message: "Offer muvaffaqiyatli o'chirildi" };
  }

  private resolvePaymentStatus(
    paidSum: number,
    totalSum: number,
  ): PaymentStatus {
    if (paidSum === 0) return PaymentStatus.UNPAID;
    if (paidSum < totalSum) return PaymentStatus.PARTIAL;
    return PaymentStatus.PAID;
  }

  private buildPagination(page: number, limit?: number) {
    const safeLimit = Math.min(
      Math.max(Number(limit) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    return { safeLimit, safePage, offset };
  }

  private buildPageResponse<T>(
    rows: T[],
    total_count: number,
    safePage: number,
    safeLimit: number,
  ) {
    const total_pages = Math.ceil(total_count / safeLimit);
    return {
      status: 200,
      data: {
        records: rows,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total_pages,
          total_count,
          hasNext: safePage < total_pages,
          hasPrev: safePage > 1,
        },
      },
    };
  }

  private pagination(page: number, limit: number) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const offset = (normalizedPage - 1) * limit;
    return { limit, offset, currentPage: normalizedPage };
  }

  private pageResponse(
    rows: any[],
    count: number,
    currentPage: number,
    limit: number,
  ) {
    const total_pages = Math.ceil(count / limit);
    return {
      status: 200,
      data: {
        records: rows,
        pagination: {
          currentPage,
          total_pages: total_pages === 0 ? 1 : total_pages,
          total_count: count,
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
    const digraphs: Record<string, string> = {
      yo: 'ё',
      yu: 'ю',
      ya: 'я',
      ts: 'ц',
      ch: 'ч',
      sh: 'ш',
    };
    const singles: Record<string, string> = {
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
    for (const d of Object.keys(digraphs)) {
      result = result.split(d).join(digraphs[d]);
    }
    return result
      .split('')
      .map((c) => singles[c] ?? c)
      .join('');
  }
}
