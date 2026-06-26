import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface Region {
  id: number;
  name_uz: string;
  name_oz: string;
  name_ru: string;
}
interface District {
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
interface NominatimItem {
  lat: string;
  lon: string;
}

const DISTRICTS_PATH = path.join(__dirname, 'data/districts.json');
const REGIONS_PATH = path.join(__dirname, 'data/regions.json');
const OUTPUT_PATH = path.join(__dirname, 'data/geo-coords.json');

const readJson = (p: string): string =>
  fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '');

const districts = JSON.parse(readJson(DISTRICTS_PATH)) as District[];
const regions = JSON.parse(readJson(REGIONS_PATH)) as Region[];
const regionMap = Object.fromEntries(regions.map((r) => [r.id, r])) as Record<
  number,
  Region
>;

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

async function fetchCoords(query: string): Promise<Coords | null> {
  try {
    const response = await axios.get<NominatimItem[]>(NOMINATIM_URL, {
      params: { q: query, format: 'json', limit: 1, countrycodes: 'uz' },
      headers: { 'User-Agent': 'GeocodeSeeder/1.0' },
      timeout: 10000,
    });
    if (!response.data.length) return null;
    return {
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon),
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const result: {
    regions: Record<number, Coords>;
    districts: Record<number, Coords>;
  } = { regions: {}, districts: {} };

  for (const r of regions) {
    const coords = await fetchCoords(`${r.name_uz}, Uzbekistan`);
    if (coords) {
      result.regions[r.id] = coords;
      console.log(`✓ region ${r.id} ${r.name_uz}:`, coords);
    } else {
      console.warn(`✗ region ${r.id} ${r.name_uz}: topilmadi`);
    }
    await sleep(1100);
  }

  for (const d of districts) {
    const region = regionMap[d.region_id];
    const query = region
      ? `${d.name_uz}, ${region.name_uz}, Uzbekistan`
      : `${d.name_uz}, Uzbekistan`;

    let coords = await fetchCoords(query);
    await sleep(1100);

    if (!coords) {
      coords = await fetchCoords(`${d.name_uz}, Uzbekistan`);
      await sleep(1100);
    }

    if (!coords) {
      const regionCoords = result.regions[d.region_id];
      if (regionCoords) {
        coords = regionCoords;
        console.warn(
          `! district ${d.id} ${d.name_uz}: viloyat markazi ishlatildi`,
        );
      }
    }

    if (coords) {
      result.districts[d.id] = coords;
      console.log(`✓ district ${d.id} ${d.name_uz}:`, coords);
    } else {
      console.error(`✗ district ${d.id} ${d.name_uz}: topilmadi`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nSaqlandi: ${OUTPUT_PATH}`);
  console.log(
    `Viloyatlar: ${Object.keys(result.regions).length}/${regions.length}`,
  );
  console.log(
    `Tumanlar:   ${Object.keys(result.districts).length}/${districts.length}`,
  );
}

main().catch(console.error);
