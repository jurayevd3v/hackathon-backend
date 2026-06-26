import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @ApiPropertyOptional({
    example: 'id',
    description: 'Joylashuv ID (optional)',
  })
  @IsOptional()
  @IsString({ message: 'location_id matn (string) bo‘lishi kerak' })
  location_id?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Foydalanuvchi to‘liq ismi',
  })
  @IsString({ message: 'full_name matn (string) bo‘lishi kerak' })
  @IsNotEmpty({ message: 'full_name bo‘sh bo‘lishi mumkin emas' })
  full_name: string;

  @ApiProperty({
    example: 'john',
    description: 'Foydalanuvchi username manzili',
  })
  @IsNotEmpty({ message: 'username kiritilishi shart' })
  username: string;

  @ApiProperty({
    example: 'password123',
    description: 'Foydalanuvchi paroli (kamida 6 ta belgi)',
  })
  @IsString({ message: 'password matn (string) bo‘lishi kerak' })
  @IsNotEmpty({ message: 'password kiritilishi shart' })
  @MinLength(6, {
    message: 'password kamida 6 ta belgidan iborat bo‘lishi kerak',
  })
  password: string;

  @ApiProperty({
    example: '123456789',
    description: 'Telegram chat ID (optional)',
  })
  @IsOptional()
  @IsString({ message: 'tg_chat_id matn (string) bo‘lishi kerak' })
  tg_chat_id?: string;

  @ApiPropertyOptional({ example: 1000000 })
  @IsNumber({}, { message: "Salary son bo'lishi kerak" })
  @Min(0, { message: "Salary 0 dan katta bo'lishi kerak" })
  @IsOptional()
  salary?: number;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.ADMIN,
    description: 'Foydalanuvchi roli',
  })
  @IsEnum(UserRole, {
    message: 'Role noto‘g‘ri kiritilgan',
  })
  role: UserRole;
}
