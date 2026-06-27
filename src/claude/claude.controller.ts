import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
import { ClaudeService } from './claude.service';
import { ChatDto, ChatFileDto, ChatHistoryItemDto } from './dto/chat.dto';
import {
  ChatResponse,
  ApiDocsRefreshResult,
  ApiDocsInfo,
} from './types/claude.types';

@ApiTags('Claude AI')
@ApiBearerAuth()
@Controller('api/claude')
export class ClaudeController {
  constructor(private readonly claudeService: ClaudeService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Oddiy chat' })
  chat(
    @Body() body: ChatDto,
    @Headers('authorization') auth: string,
  ): Promise<ChatResponse> {
    const token = this.extractToken(auth);
    return this.claudeService.chat(body.message, token, body.history ?? []);
  }

  @Post('chat/file')
  @ApiOperation({ summary: 'Fayl bilan chat (rasm yoki Excel)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ChatFileDto })
  @UseInterceptors(FileInterceptor('file'))
  chatWithFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ChatFileDto,
    @Headers('authorization') auth: string,
  ): Promise<ChatResponse> {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');

    const token = this.extractToken(auth);
    const history = this.parseHistory(body.history);
    return this.claudeService.chatWithFile(body.message, file, token, history);
  }

  @Post('docs/refresh')
  @ApiOperation({ summary: "Swagger docs ni qo'lda yangilash" })
  refreshDocs(): Promise<ApiDocsRefreshResult> {
    return this.claudeService.refreshApiDocs();
  }

  @Get('docs/info')
  @ApiOperation({ summary: "Yuklangan docs holatini ko'rish" })
  docsInfo(): ApiDocsInfo {
    return this.claudeService.getApiDocsInfo();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  private extractToken(auth: string | undefined): string {
    if (!auth) return '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  }

  private parseHistory(raw?: string): ChatHistoryItemDto[] {
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException("history maydoni noto'g'ri JSON formatda");
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is ChatHistoryItemDto =>
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        'content' in item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string',
    );
  }
}
