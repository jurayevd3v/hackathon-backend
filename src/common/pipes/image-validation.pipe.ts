import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';

interface MulterFile {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class ImageValidationPipe implements PipeTransform<MulterFile> {
  transform(value: MulterFile) {
    if (!value || !value.originalname) {
      throw new BadRequestException('Fayl topilmadi!');
    }

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = extname(value.originalname).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException('Rasm formati noto‘g‘ri!');
    }

    return value;
  }
}
