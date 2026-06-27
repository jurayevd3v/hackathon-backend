// src/claude/claude.module.ts
import { Module } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { ClaudeController } from './claude.controller';

@Module({
  controllers: [ClaudeController],
  providers: [ClaudeService],
  exports: [ClaudeService],
})
export class ClaudeModule {}
