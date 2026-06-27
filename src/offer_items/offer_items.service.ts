import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpdateOfferItemDto } from './dto/update-offer_item.dto';
import { UpdateOfferItemActiveDto } from './dto/update-offer_item-active.dto';
import { CreateOfferItemDto } from './dto/create-offer_item.dto';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { OfferItem } from './models/offer_item.model';
import { UpdateOfferItemStatusDto } from './dto/update-offer_item-status.dto';
import { Op, Sequelize, Transaction } from 'sequelize';
import { OfferItemStatus } from '../common/enums/offer-item-status.enum';
import { Offer } from '../offers/models/offer.model';
import { OfferStatus } from '../common/enums/offer-status.enum';
import { UpdateOfferItemDeliveredQuantityDto } from './dto/update-offer_item-delivered-quantity.dto';
import { UpdateOfferItemFactoryPaymentDto } from './dto/update-offer_item-factory-payment.dto';
import { UpdateOfferItemDeliveryDto } from './dto/update-offer_item-delivery.dto';
import { DeliveryType } from '../common/enums/delivery-type.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { OFFER_ITEM_STATUS_TRANSITIONS } from './constants/offer-item-status-transitions';
// import { v4 as uuidv4 } from 'uuid';
import { UpdateOfferItemVariantsDto } from './dto/update-offer_item-variant.dto';

@Injectable()
export class OfferItemsService {
  private readonly logger = new Logger(OfferItemsService.name);

  constructor(
    @InjectModel(OfferItem) private readonly offerItemRepo: typeof OfferItem,
    @InjectModel(Offer) private readonly offerRepo: typeof Offer,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  private async recalculateTotalSum(
    offer_id: string,
    transaction?: Transaction,
  ): Promise<void> {
    const items = await this.offerItemRepo.findAll({
      where: { offer_id, is_active: true },
      transaction,
    });

    const total_sum = items.reduce(
      (sum, item) => sum + Number(item.cost_price) * Number(item.quantity),
      0,
    );

    await this.offerRepo.update(
      { total_sum },
      { where: { id: offer_id }, transaction },
    );
  }

  private async recalculateTotalDeliverySum(
    offer_id: string,
    transaction?: Transaction,
  ): Promise<void> {
    const items = await this.offerItemRepo.findAll({
      where: { offer_id, is_active: true },
      transaction,
    });

    const total_delivery_sum = items.reduce(
      (sum, item) => sum + Number(item.delivery_sum),
      0,
    );

    await this.offerRepo.update(
      { total_delivery_sum },
      { where: { id: offer_id }, transaction },
    );
  }

  private resolvePaymentStatus(paidSum: number, maxSum: number): PaymentStatus {
    if (paidSum === 0) return PaymentStatus.UNPAID;
    if (paidSum < maxSum) return PaymentStatus.PARTIAL;
    return PaymentStatus.PAID;
  }

  private async withTransaction<T>(
    fn: (t: Transaction) => Promise<T>,
  ): Promise<T> {
    const transaction = await this.sequelize.transaction();
    try {
      const result = await fn(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async findItemOrFail(
    id: string,
    transaction?: Transaction,
  ): Promise<OfferItem> {
    const item = await this.offerItemRepo.findByPk(id, { transaction });
    if (!item)
      throw new NotFoundException(`ID ${id} bo'yicha offer item topilmadi`);
    return item;
  }

  async createOfferItem(dto: CreateOfferItemDto) {
    const offerItems = dto.items.map((item) => ({
      ...item,
      offer_id: dto.offer_id,
      sale_price: item.cost_price,
    }));

    const created = await this.offerItemRepo.bulkCreate(offerItems, {
      returning: true,
    });

    await this.recalculateTotalSum(dto.offer_id);

    return {
      message: `${created.length} ta offer item muvaffaqiyatli yaratildi`,
    };
  }

  async getPaginatedItemsBySupplier(
    location_id: string,
    status: string,
    page = 1,
    limit?: number,
  ) {
    const safeLimit = limit && limit > 0 ? limit : 20;
    const offset = (page - 1) * safeLimit;

    const { rows, count: total_count } =
      await this.offerItemRepo.findAndCountAll({
        where: { location_id, status, is_active: true },
        include: [{ model: Offer }],
        offset,
        limit: safeLimit,
        order: [['createdAt', 'DESC']],
        distinct: true,
      });

    return {
      data: rows,
      meta: {
        total_count,
        page,
        limit: safeLimit,
        total_pages: Math.ceil(total_count / safeLimit),
      },
    };
  }

  async getOfferItemById(id: string) {
    const offerItem = await this.offerItemRepo.findByPk(id, {
      include: [{ model: Offer }],
    });
    if (!offerItem)
      throw new NotFoundException(`ID ${id} bo'yicha offer item topilmadi`);

    return offerItem;
  }

  async updateOfferItem(id: string, dto: UpdateOfferItemDto) {
    const item = await this.findItemOrFail(id);
    await item.update(dto);

    await this.recalculateTotalSum(item.offer_id);
    return { message: 'Offer item muvaffaqiyatli yangilandi' };
  }

  async updateOfferItemActive(id: string, dto: UpdateOfferItemActiveDto) {
    const item = await this.findItemOrFail(id);
    await item.update({ is_active: dto.is_active });

    await this.recalculateTotalSum(item.offer_id);

    return { message: 'Offer item holati muvaffaqiyatli yangilandi' };
  }

  async updateOfferItemStatus(id: string, dto: UpdateOfferItemStatusDto) {
    return this.withTransaction(async (transaction) => {
      const item = await this.findItemOrFail(id, transaction);

      const allowedTransitions = OFFER_ITEM_STATUS_TRANSITIONS[item.status];
      if (!allowedTransitions?.includes(dto.status)) {
        throw new BadRequestException(
          `${item.status} statusidan ${dto.status} ga o'tkazib bo'lmaydi. ` +
            `Ruxsat etilgan: ${allowedTransitions?.join(', ') || "yo'q"}`,
        );
      }

      if (
        dto.status === OfferItemStatus.CONTRACT_SIGNED &&
        !dto.contract_number
      ) {
        throw new BadRequestException(
          'CONTRACT_SIGNED statusida contract_number majburiy',
        );
      }

      if (dto.status === OfferItemStatus.COMPLETED) {
        const notPaidCount = await this.offerItemRepo.count({
          where: {
            offer_id: item.offer_id,
            is_active: true,
            payment_status: { [Op.ne]: PaymentStatus.PAID },
          },
          transaction,
        });

        if (notPaidCount > 0) {
          throw new BadRequestException(
            "Barcha itemlarning zavod to'lovi PAID bo'lmagan, COMPLETED qilib bo'lmaydi",
          );
        }
      }

      await item.update(
        {
          status: dto.status,
          ...(dto.contract_number && { contract_number: dto.contract_number }),
        },
        { transaction },
      );

      await this.syncOfferStatus(item.offer_id, transaction);

      return { message: 'Offer item holati muvaffaqiyatli yangilandi' };
    });
  }

  async updateOfferItemDelivery(id: string, dto: UpdateOfferItemDeliveryDto) {
    return this.withTransaction(async (transaction) => {
      const item = await this.findItemOrFail(id, transaction);

      const updateData = dto.is_delivery
        ? {
            is_delivery: true,
            delivery_type: dto.delivery_type ?? item.delivery_type,
            delivery_sum: dto.delivery_sum ?? item.delivery_sum,
          }
        : {
            is_delivery: false,
            delivery_type: DeliveryType.NONE,
            delivery_sum: 0,
          };

      await item.update(updateData, { transaction });

      await this.recalculateTotalDeliverySum(item.offer_id, transaction);

      return { message: "Delivery ma'lumotlari muvaffaqiyatli yangilandi" };
    });
  }

  async updateOfferItemFactoryPayment(
    id: string,
    dto: UpdateOfferItemFactoryPaymentDto,
  ) {
    return this.withTransaction(async (transaction) => {
      const item = await this.findItemOrFail(id, transaction);

      const maxSum = Number(item.cost_price) * Number(item.quantity);

      if (dto.paid_sum > maxSum) {
        throw new BadRequestException(
          `paid_sum ${maxSum} dan oshmasligi kerak`,
        );
      }

      const payment_status = this.resolvePaymentStatus(dto.paid_sum, maxSum);

      await item.update(
        {
          paid_sum: dto.paid_sum,
          payment_status,
          status: OfferItemStatus.PAYMENT_IN_PROGRESS,
        },
        { transaction },
      );

      return { message: "Zavod to'lov ma'lumotlari muvaffaqiyatli yangilandi" };
    });
  }

  async updateOfferItemDeliveredQuantity(
    id: string,
    dto: UpdateOfferItemDeliveredQuantityDto,
  ) {
    const item = await this.findItemOrFail(id);

    if (dto.delivered_quantity > Number(item.quantity)) {
      throw new BadRequestException(
        `delivered_quantity ${item.quantity} dan oshmasligi kerak`,
      );
    }

    await item.update({ delivered_quantity: dto.delivered_quantity });

    return { message: 'Yetkazilgan miqdor muvaffaqiyatli yangilandi' };
  }

  async selectOfferItemVariant(id: string, variant_id: string) {
    const item = await this.findItemOrFail(id);

    const variant = item.variants?.find((v) => v.id === variant_id);
    if (!variant) throw new NotFoundException('Variant topilmadi');

    await item.update({
      selected_variant_id: variant_id,
      location_id: variant.factory_id,
      selected_product_name: variant.product_name,
      cost_price: variant.cost_price,
      sale_price: variant.sale_price,
    });

    await this.recalculateTotalSum(item.offer_id);

    return { message: 'Variant muvaffaqiyatli tanlandi' };
  }

  async updateOfferItemVariants(id: string, dto: UpdateOfferItemVariantsDto) {
    const item = await this.findItemOrFail(id);

    if (!item.variants?.length) {
      throw new NotFoundException('Bu offer itemda variantlar mavjud emas');
    }

    const updatedVariants = [...item.variants];

    for (const variantDto of dto.variants) {
      const index = updatedVariants.findIndex(
        (v) => v.id === variantDto.variant_id,
      );
      if (index === -1) {
        throw new NotFoundException(
          `Variant ID ${variantDto.variant_id} topilmadi`,
        );
      }

      updatedVariants[index] = {
        ...updatedVariants[index],
        ...(variantDto.sale_price !== undefined && {
          sale_price: variantDto.sale_price,
        }),
      };
    }

    await item.update({ variants: updatedVariants });

    return { message: 'Variantlar muvaffaqiyatli yangilandi' };
  }

  async deleteOfferItemVariant(id: string, variant_id: string) {
    const item = await this.findItemOrFail(id);

    const variant = item.variants?.find((v) => v.id === variant_id);
    if (!variant) {
      throw new NotFoundException(`Variant ID ${variant_id} topilmadi`);
    }

    const updatedVariants = (item.variants ?? []).filter(
      (v) => v.id !== variant_id,
    );

    const isSelectedVariant = item.selected_variant_id === variant_id;

    if (isSelectedVariant) {
      await item.update({
        variants: updatedVariants,
        selected_variant_id: undefined,
        selected_product_name: undefined,
        cost_price: Number(item.customer_price),
        sale_price: Number(item.customer_price),
      });
      await this.recalculateTotalSum(item.offer_id);
    } else {
      await item.update({ variants: updatedVariants });
    }

    return { message: "Variant muvaffaqiyatli o'chirildi" };
  }

  private async syncOfferStatus(
    offer_id: string,
    transaction: Transaction,
  ): Promise<void> {
    const items = await this.offerItemRepo.findAll({
      where: { offer_id, is_active: true },
      transaction,
    });

    if (!items.length) return;

    const offer = await this.offerRepo.findByPk(offer_id, { transaction });
    if (!offer) return;

    const statuses = items.map((item) => item.status);

    const allMatch = (s: OfferItemStatus) => statuses.every((st) => st === s);
    const anyMatch = (s: OfferItemStatus) => statuses.some((st) => st === s);

    let offerStatus: OfferStatus | null = null;

    if (allMatch(OfferItemStatus.COMPLETED)) {
      offerStatus = OfferStatus.COMPLETED;
    } else if (allMatch(OfferItemStatus.VARIANT_COMPLETED)) {
      offerStatus = OfferStatus.PRICE_REVIEW;
    } else if (
      statuses.every((s) =>
        [OfferItemStatus.DELIVERED, OfferItemStatus.COMPLETED].includes(s),
      )
    ) {
      offerStatus = OfferStatus.DELIVERED;
    } else if (
      anyMatch(OfferItemStatus.ON_THE_WAY) ||
      anyMatch(OfferItemStatus.DELIVERED)
    ) {
      offerStatus = OfferStatus.IN_DELIVERY;
    } else if (
      offer.status === OfferStatus.ITEMS_IN_PROGRESS &&
      statuses.every((s) =>
        [
          OfferItemStatus.PENDING,
          OfferItemStatus.CONTRACT_READY,
          OfferItemStatus.CONTRACT_SIGNED,
          OfferItemStatus.PAYMENT_IN_PROGRESS,
        ].includes(s),
      )
    ) {
      offerStatus = OfferStatus.ITEMS_IN_PROGRESS;
    }

    if (!offerStatus) {
      offerStatus = OfferStatus.IN_PROGRESS;
    }

    await this.offerRepo.update(
      { status: offerStatus },
      { where: { id: offer_id }, returning: true, transaction },
    );
  }
}
