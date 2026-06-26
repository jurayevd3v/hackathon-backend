import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john',
    description: 'Foydalanuvchi username',
  })
  @IsNotEmpty({ message: 'Username bo‘sh bo‘lmasligi kerak!' })
  username: string;

  @ApiProperty({ example: 'qwerty123', description: 'Foydalanuvchi paroli' })
  @IsString({ message: 'Parol matn ko‘rinishida bo‘lishi kerak!' })
  @IsNotEmpty({ message: 'Parol bo‘sh bo‘lmasligi kerak!' })
  @MinLength(6, {
    message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak!',
  })
  password: string;

  @ApiProperty({ example: 'device123', description: 'Device ID' })
  @IsString({ message: 'Device ID matn ko‘rinishida bo‘lishi kerak!' })
  @IsOptional()
  device_id?: string;
}
