import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLocalCategoryDto {
  @ApiProperty({ example: 'uuid', description: 'Joylashuv ID' })
  @IsString()
  @IsNotEmpty()
  location_id: string;

  @ApiProperty({ example: 'Iphone', description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
