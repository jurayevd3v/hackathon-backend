import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Foydalanuvchi to‘liq ismi',
  })
  @IsOptional()
  @IsString({ message: 'full_name matn (string) bo‘lishi kerak' })
  @IsNotEmpty({ message: 'full_name bo‘sh bo‘lishi mumkin emas' })
  full_name?: string;

  @ApiProperty({
    example: 'john',
    description: 'Foydalanuvchi username manzili',
  })
  @IsOptional()
  @IsNotEmpty({ message: 'username kiritilishi shart' })
  username?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Foydalanuvchining email manzili',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email noto‘g‘ri formatda kiritildi' })
  email?: string;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'Telegram chat ID (optional)',
  })
  @IsOptional()
  @IsString({ message: 'tg_chat_id matn (string) bo‘lishi kerak' })
  tg_chat_id?: string;
}
