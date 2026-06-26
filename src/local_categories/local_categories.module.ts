import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { LocalCategoriesService } from './local_categories.service';
import { LocalCategoriesController } from './local_categories.controller';
import { LocalCategory } from './models/local_category.model';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [SequelizeModule.forFeature([LocalCategory]), JwtModule],
  controllers: [LocalCategoriesController],
  providers: [LocalCategoriesService, JwtAuthGuard],
  exports: [LocalCategoriesService],
})
export class LocalCategoriesModule {}
