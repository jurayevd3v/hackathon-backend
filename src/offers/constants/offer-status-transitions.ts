import { OfferStatus } from '../../common/enums/offer-status.enum';

export const OFFER_STATUS_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  [OfferStatus.NEW]: [OfferStatus.IN_PROGRESS, OfferStatus.CANCELLED],
  [OfferStatus.IN_PROGRESS]: [
    OfferStatus.NEW,
    OfferStatus.PRICE_REVIEW,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.PRICE_REVIEW]: [
    OfferStatus.IN_PROGRESS,
    OfferStatus.PENDING_CONFIRMATION,
    OfferStatus.CONTRACT_READY,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.PENDING_CONFIRMATION]: [
    OfferStatus.PRICE_REVIEW,
    OfferStatus.CONTRACT_READY,
    OfferStatus.NEW,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.CONTRACT_READY]: [
    OfferStatus.PENDING_CONFIRMATION,
    OfferStatus.CONTRACT_SIGNED,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.CONTRACT_SIGNED]: [
    OfferStatus.CONTRACT_READY,
    OfferStatus.ITEMS_IN_PROGRESS,
    OfferStatus.PAYMENT_IN_PROGRESS,
    OfferStatus.CANCELLED,
    OfferStatus.COMPLETED,
  ],
  [OfferStatus.PAYMENT_IN_PROGRESS]: [
    OfferStatus.CONTRACT_SIGNED,
    OfferStatus.ITEMS_IN_PROGRESS,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.ITEMS_IN_PROGRESS]: [
    OfferStatus.PAYMENT_IN_PROGRESS,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.IN_DELIVERY]: [
    OfferStatus.ITEMS_IN_PROGRESS,
    OfferStatus.CANCELLED,
  ],
  [OfferStatus.DELIVERED]: [OfferStatus.COMPLETED, OfferStatus.CANCELLED],
  [OfferStatus.COMPLETED]: [],
  [OfferStatus.CANCELLED]: [],
};
