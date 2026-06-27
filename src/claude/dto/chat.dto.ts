import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ChatHistoryItemDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Salom, qanday yordam kerak?' })
  @IsString()
  content!: string;
}

export class ChatDto {
  @ApiProperty({ example: "Top 10 mijozni ko'rsat" })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ type: [ChatHistoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}

export class ChatFileDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Rasm yoki Excel fayl',
  })
  file?: unknown;

  @ApiProperty({ example: "Bu fayldan ma'lumot olib ber" })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({
    description: 'JSON string: [{role, content}, ...]',
    example: '[]',
  })
  @IsOptional()
  @IsString()
  history?: string;
}
