import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    example: 'uuid',
    description: 'Foydalanuvchi ID',
  })
  @IsString({ message: 'ID matn ko‘rinishida bo‘lishi kerak!' })
  @IsNotEmpty({ message: 'ID bo‘sh bo‘lmasligi kerak!' })
  userId: string;

  @ApiProperty({
    example: 'token',
    description: 'Foydalanuvchi refresh tokeni',
  })
  @IsString({ message: 'Token matn ko‘rinishida bo‘lishi kerak!' })
  @IsNotEmpty({ message: 'Token bo‘sh bo‘lmasligi kerak!' })
  refreshToken: string;
}
