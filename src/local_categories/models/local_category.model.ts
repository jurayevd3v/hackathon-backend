import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Location } from '../../locations/models/location.model';

interface LocalCategoryAttr {
  location_id: string;
  name: string;
}

@Table({ tableName: 'local_categories' })
export class LocalCategory extends Model<LocalCategory, LocalCategoryAttr> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Location)
  @Column({ type: DataType.UUID, onDelete: 'CASCADE', allowNull: true })
  declare location_id: string;

  @BelongsTo(() => Location, { onDelete: 'CASCADE', hooks: true })
  declare location: Location;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;
}
