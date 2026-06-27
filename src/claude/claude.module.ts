import { Module } from '@nestjs/common';
import { GrokService } from './grok.service';
import { ClaudeController } from './claude.controller';

@Module({
  controllers: [ClaudeController],
  providers: [GrokService],
  exports: [GrokService],
})
export class ClaudeModule {}
