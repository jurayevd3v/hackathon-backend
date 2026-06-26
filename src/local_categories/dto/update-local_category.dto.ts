import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLocalCategoryDto {
  @ApiProperty({ example: 'Iphone', description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
