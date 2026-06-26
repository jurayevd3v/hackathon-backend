import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUserLoginDto {
  @ApiProperty({
    example: true,
    description: 'Foydalanuvchi login holati (true/false)',
  })
  @IsBoolean({ message: 'is_login boolean bo‘lishi kerak' })
  @IsNotEmpty({ message: 'is_login bo‘sh bo‘lishi mumkin emas' })
  is_login: boolean;
}
