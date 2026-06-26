import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import { User } from '../../user/models/user.model';
import { LocationType } from '../../common/enums/location-type.enum';
import { LocalCategory } from '../../local_categories/models/local_category.model';
import { LocalProduct } from '../../local_products/models/local_product.model';
import { Offer } from '../../offers/models/offer.model';
import { OfferItem } from '../../offer_items/models/offer_item.model';

interface LocationAttr {
  type: LocationType;
  name: string;
  address?: string;
  phone: string;
  lat?: number | null;
  lng?: number | null;
  director_name?: string | null;
  inn?: string | null;
  is_active?: boolean;
}

@Table({ tableName: 'locations' })
export class Location extends Model<Location, LocationAttr> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.ENUM(...Object.values(LocationType)),
    allowNull: false,
  })
  declare type: LocationType;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare address?: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare phone: string;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare director_name?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare is_active: boolean;

  @Column({ type: DataType.STRING(12), allowNull: true })
  declare inn?: string;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare lat: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare lng: number;

  @HasMany(() => User, {
    foreignKey: 'location_id',
    as: 'users',
  })
  declare users?: User[];

  @HasMany(() => LocalCategory, {
    foreignKey: 'location_id',
    as: 'local_category',
  })
  declare local_category?: LocalCategory[];

  @HasMany(() => LocalProduct, {
    foreignKey: 'location_id',
    as: 'local_product',
  })
  declare local_product?: LocalProduct[];

  @HasMany(() => Offer, {
    foreignKey: 'location_id',
    as: 'offers',
  })
  declare offers?: Offer[];

  @HasMany(() => OfferItem, {
    foreignKey: 'location_id',
    as: 'offer_items',
  })
  declare offer_items?: OfferItem[];
}
