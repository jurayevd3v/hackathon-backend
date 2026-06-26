import {
  HttpException,
  HttpStatus,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { resolve, extname, join } from 'path';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import * as XLSX from 'xlsx';

@Injectable()
export class FilesService {
  async createFile(file: Express.Multer.File): Promise<string> {
    try {
      const ext = extname(file.originalname);
      const fileName = uuidv4() + ext;
      const uploadPath = resolve(__dirname, '..', '..', '..', 'uploads');

      try {
        await access(uploadPath);
      } catch {
        await mkdir(uploadPath, { recursive: true });
      }

      await writeFile(join(uploadPath, fileName), file.buffer);
      return fileName;
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Rasmni saqlashda xatolik!',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const filePath = resolve(
        __dirname,
        '..',
        '..',
        '..',
        'uploads',
        fileName,
      );
      await unlink(filePath);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        "Rasmni o'chirishda xatolik!",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  productExcel(file: Express.Multer.File): Promise<Record<string, any>[]> {
    if (!file?.buffer) {
      throw new BadRequestException('Excel fayl kiritilmadi!');
    }

    try {
      const xlsxLib = XLSX as unknown as {
        read: typeof XLSX.read;
        utils: typeof XLSX.utils;
      };

      const workbook = xlsxLib.read(file.buffer, { type: 'buffer' });

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new BadRequestException('Excel varagi topilmadi!');

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new BadRequestException('Excel varagi topilmadi!');

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: null,
        raw: false,
      });

      return Promise.resolve(rows);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Excel faylini o‘qishda xatolik!',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
