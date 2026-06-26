import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { LocalCategory } from '../../local_categories/models/local_category.model';
import { Location } from '../../locations/models/location.model';

interface ProductPrice {
  quantity?: number;
  price: number;
}

interface LocalProductAttr {
  name: string;
  unit: string;
  location_id: string;
  category_id: string;
  prices: {
    alone?: ProductPrice;
    average?: ProductPrice;
    wholesale?: ProductPrice;
  };
}

@Table({ tableName: 'local_products' })
export class LocalProduct extends Model<LocalProduct, LocalProductAttr> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare unit: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  declare prices: {
    alone?: ProductPrice;
    average?: ProductPrice;
    wholesale?: ProductPrice;
  };

  @ForeignKey(() => Location)
  @Column({ type: DataType.UUID, onDelete: 'CASCADE', allowNull: true })
  declare location_id: string;

  @BelongsTo(() => Location, { onDelete: 'CASCADE', hooks: true })
  declare location: Location;

  @ForeignKey(() => LocalCategory)
  @Column({ type: DataType.UUID, onDelete: 'CASCADE', allowNull: true })
  declare category_id: string;

  @BelongsTo(() => LocalCategory, { onDelete: 'CASCADE', hooks: true })
  declare category: LocalCategory;
}
