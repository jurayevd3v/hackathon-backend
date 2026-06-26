import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { Location } from './models/location.model';
import { User } from '../user/models/user.model';

@Module({
  imports: [SequelizeModule.forFeature([Location, User])],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
