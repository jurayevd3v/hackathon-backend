import {
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Offer } from '../../offers/models/offer.model';
import { DeliveryType } from '../../common/enums/delivery-type.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { OfferItemStatus } from '../../common/enums/offer-item-status.enum';
import { Location } from '../../locations/models/location.model';

interface OfferItemCreationAttr {
  offer_id: string;
  location_id?: string;
  product_name: string;
  customer_price: number;
  cost_price: number;
  sale_price?: number;
  unit: string;
  quantity: number;
  delivery_type?: DeliveryType;
  delivery_sum?: number;
  paid_sum?: number;
  payment_status?: PaymentStatus;
  variants?: OfferItemVariant[];
  selected_variant_id?: string;
  selected_product_name?: string;
}

export interface OfferItemVariant {
  id: string;
  factory_id: string;
  factory_name: string;
  address: string;
  product_name: string;
  cost_price: number;
  sale_price: number;
  is_delivery: boolean;
}

@Table({ tableName: 'offer_items' })
export class OfferItem extends Model<OfferItem, OfferItemCreationAttr> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Offer)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare offer_id: string;

  @BelongsTo(() => Offer, { onDelete: 'CASCADE', hooks: true })
  declare offer: Offer;

  @ForeignKey(() => Location)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare location_id: string;

  @BelongsTo(() => Location, {
    onDelete: 'CASCADE',
  })
  declare location: Location;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  product_name: string;

  @Column({ type: DataType.DECIMAL(15, 2), allowNull: false })
  declare customer_price: number;

  @Column({ type: DataType.DECIMAL(15, 2), allowNull: false })
  declare cost_price: number;

  @Column({ type: DataType.DECIMAL(15, 2), allowNull: false })
  declare sale_price: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare unit: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare quantity: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare delivered_quantity: number;

  @Column({
    type: DataType.ENUM(...Object.values(OfferItemStatus)),
    allowNull: false,
    defaultValue: OfferItemStatus.PENDING,
  })
  declare status: OfferItemStatus;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare is_active: boolean;

  @Column({ type: DataType.STRING, allowNull: true })
  declare contract_number: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare is_delivery: boolean;

  @Column({
    type: DataType.ENUM(...Object.values(DeliveryType)),
    allowNull: false,
    defaultValue: DeliveryType.NONE,
  })
  declare delivery_type: DeliveryType;

  @Column({ type: DataType.DECIMAL(15, 2), allowNull: false, defaultValue: 0 })
  declare delivery_sum: number;

  @Column({ type: DataType.DECIMAL(15, 2), allowNull: false, defaultValue: 0 })
  declare paid_sum: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.UNPAID,
  })
  declare payment_status: PaymentStatus;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare variants: OfferItemVariant[];

  @Column({ type: DataType.UUID, allowNull: true })
  declare selected_variant_id: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare selected_product_name: string;
}
