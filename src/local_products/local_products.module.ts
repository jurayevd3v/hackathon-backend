import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { LocalProductsController } from './local_products.controller';
import { LocalProductsService } from './local_products.service';
import { LocalProduct } from './models/local_product.model';
import { LocalCategory } from '../local_categories/models/local_category.model';
import { FilesModule } from '../common/files/files.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GeocodeService } from '../common/geocode/service';
import { Location } from '../locations/models/location.model';

@Module({
  imports: [
    SequelizeModule.forFeature([LocalProduct, LocalCategory, Location]),
    JwtModule,
    FilesModule,
  ],
  controllers: [LocalProductsController],
  providers: [LocalProductsService, JwtAuthGuard, GeocodeService],
  exports: [LocalProductsService],
})
export class LocalProductsModule {}
