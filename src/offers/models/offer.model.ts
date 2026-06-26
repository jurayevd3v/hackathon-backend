import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { Location } from '../../locations/models/location.model';
import { OfferItem } from '../../offer_items/models/offer_item.model';
import { User } from '../../user/models/user.model';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';

interface OfferAttr {
  offer_number: string;
  location_id: string;
  created_by: string;
  construction_site_name?: string;
  note?: string;
  date?: Date;
  address?: string;
  total_sum?: number;
  paid_sum?: number;
  total_delivery_sum?: number;
  payment_status?: PaymentStatus;
}

@Table({ tableName: 'offers' })
export class Offer extends Model<Offer, OfferAttr> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false,
  })
  declare offer_number: string;

  @ForeignKey(() => Location)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare location_id: string;

  @BelongsTo(() => Location, { hooks: true })
  declare location: Location;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare created_by: string;

  @BelongsTo(() => User, {
    foreignKey: 'created_by',
    onDelete: 'SET NULL',
  })
  declare created: User;

  @Column({
    type: DataType.ENUM(...Object.values(OfferStatus)),
    allowNull: false,
    defaultValue: OfferStatus.NEW,
  })
  declare status: OfferStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare construction_site_name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare contract_number: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare note?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: DataType.NOW,
  })
  declare date?: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare address?: string;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    defaultValue: 0,
  })
  declare total_sum: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare paid_sum: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.UNPAID,
  })
  declare payment_status: PaymentStatus;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  })
  declare total_delivery_sum: number;

  @HasMany(() => OfferItem, { hooks: true })
  declare offer_items?: OfferItem[];
}
