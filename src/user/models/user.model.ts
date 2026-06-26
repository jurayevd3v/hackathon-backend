import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { UserRole } from '../../common/enums/user-role.enum';

interface UserAttr {
  full_name: string;
  username: string;
  email?: string;
  tg_chat_id?: string | null;
  hashed_password: string;
  hashed_refresh_token?: string | null;
  refresh_token_jti?: string | null;
  role: UserRole;
  is_login: boolean;
  salary?: number | null;
}

@Table({ tableName: 'users' })
export class User extends Model<User, UserAttr> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare full_name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare username: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare email?: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare hashed_password: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare tg_chat_id?: string | null;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
  })
  declare salary?: number | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare hashed_refresh_token?: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare refresh_token_jti?: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(UserRole)),
    allowNull: false,
  })
  declare role: UserRole;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  })
  declare is_login: boolean;
}
