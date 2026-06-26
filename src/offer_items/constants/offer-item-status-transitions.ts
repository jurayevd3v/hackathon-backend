import { OfferItemStatus } from '../../common/enums/offer-item-status.enum';

export const OFFER_ITEM_STATUS_TRANSITIONS: Record<
  OfferItemStatus,
  OfferItemStatus[]
> = {
  [OfferItemStatus.PENDING]: [
    OfferItemStatus.IN_PROGRESS,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.IN_PROGRESS]: [
    OfferItemStatus.VARIANT_COMPLETED,
    OfferItemStatus.PENDING,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.VARIANT_COMPLETED]: [
    OfferItemStatus.CONTRACT_READY,
    OfferItemStatus.IN_PROGRESS,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.CONTRACT_READY]: [
    OfferItemStatus.CONTRACT_SIGNED,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.CONTRACT_SIGNED]: [OfferItemStatus.REJECTED],
  [OfferItemStatus.PAYMENT_IN_PROGRESS]: [
    OfferItemStatus.ON_THE_WAY,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.ON_THE_WAY]: [
    OfferItemStatus.DELIVERED,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.DELIVERED]: [
    OfferItemStatus.COMPLETED,
    OfferItemStatus.REJECTED,
  ],
  [OfferItemStatus.COMPLETED]: [],
  [OfferItemStatus.REJECTED]: [],
};
