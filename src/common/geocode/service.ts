import axios from 'axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

interface RegionRecord {
  id: number;
  name_uz: string;
  name_oz: string;
  name_ru: string;
}

interface DistrictRecord {
  id: number;
  region_id: number;
  name_uz: string;
  name_oz: string;
  name_ru: string | null;
}

interface Coords {
  lat: number;
  lng: number;
}

interface GeoCoords {
  regions: Record<string, Coords>;
  districts: Record<string, Coords>;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; county?: string; state?: string };
}

const STOPWORDS =
  /\b(tumani|tuman|viloyati|viloyat|shahri|shahar|respublikasi|район|область|город)\b/gi;

@Injectable()
export class GeocodeService implements OnModuleInit {
  private readonly logger = new Logger(GeocodeService.name);
  private readonly NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

  private regions: RegionRecord[] = [];
  private districts: DistrictRecord[] = [];
  private coords: GeoCoords = { regions: {}, districts: {} };

  private districtIndex = new Map<string, number>();
  private regionIndex = new Map<string, number>();

  onModuleInit(): void {
    const base = path.join(__dirname, 'data');
    this.regions = this.loadJson<RegionRecord[]>(
      path.join(base, 'regions.json'),
      [],
    );
    this.districts = this.loadJson<DistrictRecord[]>(
      path.join(base, 'districts.json'),
      [],
    );
    this.coords = this.loadJson<GeoCoords>(path.join(base, 'geo-coords.json'), {
      regions: {},
      districts: {},
    });
    this.buildIndexes();
    this.logger.log(
      `GeocodeService ready: ${this.regions.length} regions, ${this.districts.length} districts`,
    );
  }

  async geocodeAddress(address: string): Promise<Coords> {
    this.logger.log(`Geocoding: "${address}"`);

    const local = this.findLocal(address);
    if (local) return local;

    try {
      return await this.nominatimSearch(address);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `Nominatim failed: ${(error as NodeJS.ErrnoException).code ?? String(error)}`,
      );
    }

    const lower = address.toLowerCase();
    if (lower.includes('toshkent') || lower.includes('ташкент')) {
      return { lat: 41.2995, lng: 69.2401 };
    }

    throw new BadRequestException(`Manzil topilmadi: "${address}"`);
  }

  private buildIndexes(): void {
    for (const d of this.districts) {
      for (const token of this.tokenize(d.name_uz, d.name_oz, d.name_ru)) {
        if (token.length > 2) this.districtIndex.set(token, d.id);
      }
    }
    for (const r of this.regions) {
      for (const token of this.tokenize(r.name_uz, r.name_oz, r.name_ru)) {
        if (token.length > 2) this.regionIndex.set(token, r.id);
      }
    }
  }

  private tokenize(...names: (string | null)[]): string[] {
    return names
      .filter((n): n is string => n !== null)
      .map((n) => n.toLowerCase().replace(STOPWORDS, '').trim())
      .filter((n) => n.length > 0);
  }

  private findLocal(address: string): Coords | null {
    const lower = address.toLowerCase().replace(STOPWORDS, ' ').trim();

    for (const [token, id] of this.districtIndex) {
      if (lower.includes(token)) {
        const coords = this.coords.districts[id];
        if (coords) return coords;

        const district = this.districts.find((d) => d.id === id);
        if (district) {
          const regionCoords = this.coords.regions[district.region_id];
          if (regionCoords) return regionCoords;
        }
      }
    }

    for (const [token, id] of this.regionIndex) {
      if (lower.includes(token)) {
        const coords = this.coords.regions[id];
        if (coords) return coords;
      }
    }

    return null;
  }

  private async nominatimSearch(address: string): Promise<Coords> {
    let q = address
      .toLowerCase()
      .replace(STOPWORDS, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parts = q
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    q = parts.join(', ');
    if (!q.includes('uzbekistan')) q += ', Uzbekistan';

    const response = await axios.get<NominatimResponse[]>(this.NOMINATIM_URL, {
      params: {
        q,
        format: 'json',
        limit: 5,
        addressdetails: 1,
        countrycodes: 'uz',
      },
      headers: { 'User-Agent': 'GeocodeApp/1.0' },
      timeout: 10_000,
    });

    if (!response.data.length)
      throw new BadRequestException(`Manzil topilmadi: "${q}"`);

    const lower = address.toLowerCase();
    let best = response.data[0];
    if (lower.includes('shahar') || lower.includes('город')) {
      best =
        response.data.find((r) => r.address?.city ?? r.address?.town) ??
        response.data[0];
    } else if (lower.includes('viloyat')) {
      best =
        response.data.find((r) => r.address?.state ?? r.address?.county) ??
        response.data[0];
    }

    const lat = Number(best.lat);
    const lng = Number(best.lon);
    if (isNaN(lat) || isNaN(lng))
      throw new BadRequestException("GPS koordinata noto'g'ri");

    return { lat, lng };
  }

  private loadJson<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) {
      if (filePath.includes('geo-coords')) {
        this.logger.error(
          'geo-coords.json topilmadi! npx ts-node seed-geocoords.ts ni ishga tushiring.',
        );
      }
      return fallback;
    }
    return JSON.parse(
      fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/u, ''),
    ) as T;
  }
}
