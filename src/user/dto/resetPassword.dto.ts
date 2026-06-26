import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'New password',
    description: 'Xodimning yangi paroli',
  })
  @IsString({ message: 'new_password matn (string) bo‘lishi kerak' })
  @IsNotEmpty({ message: 'new_password kiritilishi shart' })
  @MinLength(6, {
    message: 'new_password kamida 6 ta belgidan iborat bo‘lishi kerak',
  })
  new_password: string;
}
