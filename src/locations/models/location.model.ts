import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '../../user/models/user.model';
import { LocationType } from '../../common/enums/location-type.enum';

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

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  })
  declare is_contacted: boolean;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare lat: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  declare lng: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true })
  declare assignee_id: string;

  @BelongsTo(() => User, {
    foreignKey: 'assignee_id',
    onDelete: 'SET NULL',
  })
  declare assignee: User;

  @ForeignKey(() => Location)
  @Column({ type: DataType.UUID, allowNull: true })
  declare parent_id?: string;

  @BelongsTo(() => Location, { as: 'parent', foreignKey: 'parent_id' })
  declare parent?: Location;

  @HasMany(() => Location, {
    as: 'children',
    foreignKey: 'parent_id',
    onDelete: 'CASCADE',
    hooks: false,
  })
  declare children?: Location[];

  @HasMany(() => User, {
    foreignKey: 'location_id',
    as: 'users',
  })
  declare users?: User[];
}
