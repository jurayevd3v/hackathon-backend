// src/claude/grok.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

// ─── Swagger tiplari ──────────────────────────────────────────────────────────

interface SwaggerDoc {
  openapi?: string;
  servers?: Array<{ url: string }>;
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject> };
}

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
type PathItem = Partial<Record<HttpMethod, Operation>>;

interface Operation {
  tags?: string[];
  summary?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
}

interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: SchemaObject;
}

interface RequestBody {
  content?: { 'application/json'?: { schema?: SchemaObject } };
}

interface SchemaObject {
  type?: string;
  $ref?: string;
  enum?: unknown[];
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
}

// ─── Tool input tiplari ───────────────────────────────────────────────────────

interface DbQueryInput {
  sql: string;
  params?: unknown[];
}

interface ApiCallInput {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

interface ExcelColumn {
  key: string;
  header?: string;
  width?: number;
}

interface ExportExcelInput {
  data: Record<string, unknown>[];
  sheet_name?: string;
  columns?: ExcelColumn[];
}

// ─── Natija tiplari ───────────────────────────────────────────────────────────

export interface ExcelResult {
  excel_base64: string;
  filename: string;
  rows_count: number;
}

export interface ChatResponse {
  message: string;
  excel: ExcelResult | null;
}

// ─── DB schema hint ───────────────────────────────────────────────────────────

const DB_SCHEMA_HINT = `
PostgreSQL DB — faqat SELECT (read-only).
Asosiy jadvallar:
- locations (id, name, type, address, phone, is_active, is_contacted, parent_id, created_at)
  * "type" ustuni: mijozlar, ta'minotchilar va boshqa turlarni ajratadi
  * Ta'minotchi qidirish: WHERE name ILIKE '%...%' yoki type = 'supplier' kabi
- users (id, full_name, username, role, location_id, created_at, is_login)
- offers (id, location_id, status, total_sum, paid_sum, created_at, construction_site_name, note, address, is_logist, date)
- offer_items (id, offer_id, product_name, quantity, unit, customer_price, cost_price, status)
Har doim LIMIT qo'y. Hech qachon DROP, DELETE, UPDATE, INSERT yozma.
`;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GrokService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrokService.name);

  // OpenAI SDK — Groq API base URL bilan
  private client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  private pool!: Pool;

  private apiDocs = '';
  private apiDocsLoadedAt = 0;
  private refreshTimer?: NodeJS.Timeout;

  private readonly API_BASE =
    process.env.API_BASE_URL || 'https://dev.udsgroup.uz';
  private readonly SWAGGER_URL = `${this.API_BASE}/api/docs-json`;
  private readonly DOCS_TTL_MS = 30 * 60 * 1000;

  // Model tanlash — arzon model agentic vazifalar uchun yetarli
  private readonly MODEL =
    process.env.GROK_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
    });

    await this.refreshApiDocs();

    this.refreshTimer = setInterval(() => {
      void this.refreshApiDocs().catch((e: unknown) =>
        this.logger.error(`Swagger refresh xatosi: ${errMsg(e)}`),
      );
    }, this.DOCS_TTL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    await this.pool?.end();
  }

  // ─── Swagger docs ────────────────────────────────────────────────────────────

  async refreshApiDocs(): Promise<{
    ok: boolean;
    endpoints: number;
    chars: number;
  }> {
    try {
      const res = await fetch(this.SWAGGER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const swagger = (await res.json()) as SwaggerDoc;
      this.apiDocs = this.swaggerToText(swagger);
      this.apiDocsLoadedAt = Date.now();

      const endpoints = Object.keys(swagger.paths ?? {}).length;
      this.logger.log(
        `Swagger yuklandi: ${endpoints} path, ${this.apiDocs.length} belgi`,
      );
      return { ok: true, endpoints, chars: this.apiDocs.length };
    } catch (err: unknown) {
      this.logger.error(`Swagger yuklab bolmadi: ${errMsg(err)}`);
      if (!this.apiDocs) {
        this.apiDocs = `API dokumentatsiyani yuklab bolmadi (${this.SWAGGER_URL}). Faqat db_query ishlatilsin.`;
      }
      return { ok: false, endpoints: 0, chars: this.apiDocs.length };
    }
  }

  private swaggerToText(swagger: SwaggerDoc): string {
    const baseUrl = swagger.servers?.[0]?.url ?? this.API_BASE;
    const lines: string[] = [`BASE URL: ${baseUrl}`, ''];
    const byTag: Record<string, string[]> = {};
    const paths = swagger.paths ?? {};
    const methods: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch'];

    for (const path of Object.keys(paths)) {
      const pathItem = paths[path];
      if (!pathItem) continue;
      for (const method of methods) {
        const op = pathItem[method];
        if (!op) continue;
        const tag = op.tags?.[0] ?? 'Other';
        const summary = op.summary ?? op.operationId ?? '';
        const bodySchema =
          op.requestBody?.content?.['application/json']?.schema;
        const bodyStr = bodySchema
          ? ` ${this.formatSchema(bodySchema, swagger)}`
          : '';
        const queries = (op.parameters ?? [])
          .filter((p) => p.in === 'query')
          .map((p) => (p.required ? p.name : `${p.name}?`));
        const queryStr = queries.length ? `?${queries.join('&')}` : '';
        const line = `${method.toUpperCase().padEnd(6)} ${path}${queryStr} - ${summary}${bodyStr}`;
        (byTag[tag] ||= []).push(line);
      }
    }

    for (const tag of Object.keys(byTag)) {
      lines.push(`=== ${tag.toUpperCase()} ===`);
      lines.push(...byTag[tag], '');
    }
    return lines.join('\n');
  }

  private formatSchema(
    schema: SchemaObject | undefined,
    swagger: SwaggerDoc,
    depth = 0,
  ): string {
    if (!schema || depth > 2) return 'any';
    if (schema.$ref) {
      const parts = schema.$ref.replace('#/', '').split('/');
      let resolved: unknown = swagger;
      for (const p of parts) {
        if (resolved && typeof resolved === 'object' && p in resolved) {
          resolved = (resolved as Record<string, unknown>)[p];
        } else return 'object';
      }
      return this.formatSchema(resolved as SchemaObject, swagger, depth + 1);
    }
    if (schema.enum) return schema.enum.map((v) => String(v)).join('|');
    if (schema.type === 'array')
      return `${this.formatSchema(schema.items, swagger, depth + 1)}[]`;
    if (schema.properties) {
      const required = new Set(schema.required ?? []);
      const fields = Object.entries(schema.properties)
        .slice(0, 25)
        .map(([k, v]) => {
          const opt = required.has(k) ? '' : '?';
          const type =
            depth > 0
              ? v.enum
                ? v.enum.map(String).join('|')
                : v.type === 'array'
                  ? 'array'
                  : (v.type ?? (v.$ref ? 'object' : 'any'))
              : this.formatSchema(v, swagger, depth + 1);
          return `${k}${opt}:${type}`;
        });
      return `{${fields.join(', ')}}`;
    }
    return schema.type ?? 'any';
  }

  // ─── Tools (OpenAI format) ───────────────────────────────────────────────────

  private getTools(): OpenAI.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'db_query',
          description: `PostgreSQL dan ma'lumot o'qish. Faqat SELECT.
Murakkab JOIN, GROUP BY, tahlil, top N ro'yxatlar uchun ishlat.
API da yo'q so'rovlar uchun ham ishlat.
Hech qachon INSERT/UPDATE/DELETE/DROP yozma.`,
          parameters: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: "SELECT so'rovi. Har doim LIMIT qo'y (max 500)",
              },
              params: {
                type: 'array',
                description: 'Parametrlar [$1, $2 uchun]',
                items: { type: 'string' },
              },
            },
            required: ['sql'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'api_call',
          description: `API ga istalgan so'rov yuborish.
Yozish, o'zgartirish, o'chirish, yaratish amallari uchun ishlat.
Mavjud barcha endpointlar system prompt da ko'rsatilgan (Swagger dan avtomatik yuklangan).`,
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                description: 'HTTP metod',
              },
              path: {
                type: 'string',
                description: 'Endpoint path, masalan: /api/offers',
              },
              body: {
                type: 'object',
                description:
                  'Request body (POST/PUT). MUHIM: bu maydon object bolishi SHART, JSON string emas! Masalan: {"key": "value"}',
                additionalProperties: true,
              },
              params: {
                type: 'object',
                description:
                  'Query parametrlar. Object formatida: {"page": "1"}',
                additionalProperties: true,
              },
            },
            required: ['method', 'path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'export_excel',
          description: `Ma'lumotlarni Excel (.xlsx) ga aylantirish.
Foydalanuvchi "excel qilib ber", "yuklab ber" deganda ishlat.
data — object array, har bir object bir qator bo'ladi.`,
          parameters: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                description: "Excel ga yoziladigan ma'lumotlar",
                items: { type: 'object' },
              },
              sheet_name: { type: 'string', description: 'Excel varaq nomi' },
              columns: {
                type: 'array',
                description: 'Ustun nomlari va kengligi (ixtiyoriy)',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    header: { type: 'string' },
                    width: { type: 'number' },
                  },
                },
              },
            },
            required: ['data'],
          },
        },
      },
    ];
  }

  // ─── Tool executor ───────────────────────────────────────────────────────────

  private async executeTool(
    name: string,
    input: unknown,
    token: string,
  ): Promise<Record<string, unknown>> {
    switch (name) {
      case 'db_query':
        return this.runDbQuery(input as DbQueryInput);
      case 'api_call':
        return this.runApiCall(input as ApiCallInput, token);
      case 'export_excel':
        return this.runExportExcel(input as ExportExcelInput);
      default:
        return { error: `Noma'lum tool: ${name}` };
    }
  }

  private async runDbQuery(
    input: DbQueryInput,
  ): Promise<Record<string, unknown>> {
    const upperSql = input.sql.trim().toUpperCase();
    const forbidden = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'TRUNCATE',
      'ALTER',
    ];
    // WITH ... SELECT ruxsat beriladi, lekin WITH ... DELETE emas
    const firstWord = upperSql.replace(/\s+/g, ' ').split(' ')[0];
    if (forbidden.includes(firstWord)) {
      return { error: "Faqat SELECT so'rovlarga ruxsat bor" };
    }
    // Ichiga yashirilgan yozuvchi operatsiyalar
    if (forbidden.slice(1).some((kw) => upperSql.includes(kw + ' '))) {
      return { error: 'SQL da yozuvchi operatsiyalar taqiqlangan' };
    }

    try {
      const result = await this.pool.query(input.sql, input.params ?? []);
      return { rows: result.rows, count: result.rowCount };
    } catch (err: unknown) {
      return { error: `DB xatosi: ${errMsg(err)}` };
    }
  }

  private async runApiCall(
    input: ApiCallInput,
    token: string,
  ): Promise<Record<string, unknown>> {
    try {
      let url = `${this.API_BASE}${input.path}`;
      if (input.params) {
        const entries = Object.entries(input.params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)] as [string, string]);
        const q = new URLSearchParams(entries).toString();
        if (q) url += `?${q}`;
      }

      // body string kelsa parse qilamiz (model xatosi uchun himoya)
      let bodyData = input.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData) as Record<string, unknown>;
        } catch {
          bodyData = {};
        }
      }

      const res = await fetch(url, {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body:
          bodyData && input.method !== 'GET'
            ? JSON.stringify(bodyData)
            : undefined,
      });

      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: `API ${res.status}: ${JSON.stringify(data)}` };
      }
      return (data as Record<string, unknown>) ?? {};
    } catch (err: unknown) {
      return { error: `Tarmoq xatosi: ${errMsg(err)}` };
    }
  }

  private runExportExcel(input: ExportExcelInput): Record<string, unknown> {
    try {
      if (!input.data?.length) return { error: "Ma'lumot bo'sh" };

      const sheetName = (input.sheet_name ?? "Ma'lumotlar").slice(0, 31);
      const columns: ExcelColumn[] =
        input.columns ??
        Object.keys(input.data[0]).map((k) => ({
          key: k,
          header: k,
          width: 22,
        }));

      const headers = columns.map((c) => c.header ?? c.key);
      const aoa: unknown[][] = [headers];
      for (const row of input.data) {
        aoa.push(columns.map((c) => row[c.key] ?? ''));
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 22 }));
      ws['!rows'] = [{ hpt: 22 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const buffer = XLSX.write(wb, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer;

      const result: ExcelResult = {
        excel_base64: buffer.toString('base64'),
        filename: `${(input.sheet_name ?? 'malumotlar').replace(/\s/g, '_')}_${Date.now()}.xlsx`,
        rows_count: input.data.length,
      };
      return result as unknown as Record<string, unknown>;
    } catch (err: unknown) {
      return { error: `Excel xatosi: ${errMsg(err)}` };
    }
  }

  // ─── System prompt ───────────────────────────────────────────────────────────

  private buildSystemPrompt(): string {
    return `Sen USD ERP tizimining AI yordamchisan.

QOIDALAR:
- Har doim O'ZBEK TILIDA javob ber
- Qisqa va aniq bo'l
- Noaniqlik bo'lsa — aniqlashtir, kerakli ma'lumotlarni so'ra
- Muhim o'zgartirish (o'chirish, status o'zgartirish) oldidan tasdiqlat: "Rostdan ham bajarsinmi?"
- Xatolikda tushunarli tushuntir

QAYSI TOOL NI QACHON ISHLATISH:
1. db_query  — o'qish, tahlil, top N, murakkab so'rovlar, API da yo'q so'rovlar
2. api_call  — yaratish, o'zgartirish, o'chirish amallari (POST/PUT/DELETE)
3. export_excel — "excel qilib ber", "yuklab ber", "fayl sifatida" so'rovlarda

STRATEGIYA:
- Avval db_query bilan ma'lumot ol → keyin tahlil qil yoki api_call bilan amal bajar
- Excel kerak bo'lsa: avval db_query → natijani export_excel ga ber

RASM ORQALI OFFER YARATISH — QADAMLAR:
1. Rasmdan mahsulotlar ro'yxatini ajrat
   - Aniq o'qilgan maydonlarni to'ldiradi
   - NOANIQ yoki KO'RINMAGAN maydonlar uchun — 0 yoki taxmin QO'YMA, foydalanuvchidan so'ra
   - Masalan: narx ko'rsatilmagan → "1-mahsulot (Sement) uchun mijoz narxi va tan narxini kiriting"
   - Miqdor o'qilmasa → so'ra
   - O'lchov birligi noaniq bo'lsa → so'ra
2. location_id aniqlash:
   - Foydalanuvchi location nomi aytgan bo'lsa → db_query: SELECT id, name FROM locations WHERE name ILIKE '%...%' LIMIT 10
   - Topilgan locationlardan to'g'risini tanlashni so'ra
   - Agar hech narsa aytmagan bo'lsa → ro'yxat ko'rsatib so'ra
3. Offer yaratish uchun qo'shimcha ma'lumot so'ra (ixtiyoriy):
   - construction_site_name (qurilish obyekti nomi)
   - note (izoh)
   - is_logist (logistika kerakmi, default: false)
4. FAQAT barcha majburiy maydonlar to'liq bo'lganda → api_call POST /api/offers
   Majburiy: location_id, har bir item uchun product_name, quantity, unit, customer_price, cost_price

MUHIM — OFFER ITEM DA supplier_id YO'Q:
- offer_items da supplier_id maydoni mavjud emas
- Foydalanuvchi ta'minotchi nomi aytsa — db_query bilan locations dan qidiring,
  lekin bu offer_item ga kirmaydi, faqat ma'lumot uchun
- offer_item faqat: product_name, quantity, unit, customer_price, cost_price

OFFER YARATISH BODY FORMATI (POST /api/offers):
{
  "location_id": "uuid",
  "construction_site_name": "ixtiyoriy",
  "note": "ixtiyoriy",
  "address": "ixtiyoriy",
  "is_logist": false,
  "date": "2026-01-01T00:00:00Z",
  "items": [
    {
      "product_name": "Mahsulot nomi",
      "quantity": 10,
      "unit": "dona",
      "customer_price": 100000,
      "cost_price": 80000
    }
  ]
}

OFFER ITEM QO'SHISH (POST /api/offer-items):
{
  "offer_id": "uuid",
  "location_id": "uuid",
  "items": [
    {
      "product_name": "Mahsulot nomi",
      "quantity": 10,
      "unit": "dona",
      "customer_price": 100000,
      "cost_price": 80000
    }
  ]
}

=== MAVJUD API ENDPOINTLAR (Swagger dan avtomatik yuklangan) ===
${this.apiDocs}

${DB_SCHEMA_HINT}`;
  }

  // ─── Agent loop (OpenAI format) ──────────────────────────────────────────────

  private async runAgentLoop(
    messages: OpenAI.ChatCompletionMessageParam[],
    token: string,
  ): Promise<ChatResponse> {
    let excelResult: ExcelResult | null = null;

    // System prompt ni messages boshiga qo'shamiz
    const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      ...messages,
    ];

    let response = await this.client.chat.completions.create({
      model: this.MODEL,
      max_tokens: 4096,
      tools: this.getTools(),
      tool_choice: 'auto',
      messages: fullMessages,
    });

    const currentMessages = [...fullMessages];

    // Tool use loop
    while (response.choices[0]?.finish_reason === 'tool_calls') {
      const assistantMsg = response.choices[0].message;
      currentMessages.push(assistantMsg);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCalls: any[] = assistantMsg.tool_calls ?? [];

      // Parallel tool execution
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] =
        await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toolCalls.map(async (tc: any) => {
            let input: unknown;
            try {
              input = JSON.parse(tc.function.arguments as string) as unknown;
            } catch {
              input = {};
            }

            const result = await this.executeTool(
              tc.function.name as string,
              input,
              token,
            );

            // Excel natijasini saqla
            if (typeof result.excel_base64 === 'string') {
              excelResult = {
                excel_base64: result.excel_base64,
                filename:
                  typeof result.filename === 'string'
                    ? result.filename
                    : 'export.xlsx',
                rows_count:
                  typeof result.rows_count === 'number' ? result.rows_count : 0,
              };
            }

            const toolMsg: OpenAI.ChatCompletionToolMessageParam = {
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            };
            return toolMsg;
          }),
        );

      currentMessages.push(...toolResults);

      response = await this.client.chat.completions.create({
        model: this.MODEL,
        max_tokens: 4096,
        tools: this.getTools(),
        tool_choice: 'auto',
        messages: currentMessages,
      });
    }

    const text = response.choices[0]?.message?.content ?? '';
    return { message: text, excel: excelResult };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async chat(
    userMessage: string,
    token: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<ChatResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage },
    ];
    return this.runAgentLoop(messages, token);
  }

  async chatWithFile(
    userMessage: string,
    file: Express.Multer.File,
    token: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<ChatResponse> {
    const isImage = file.mimetype.startsWith('image/');
    const isExcel =
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls');

    let userContent: OpenAI.ChatCompletionMessageParam['content'];

    if (isImage) {
      // Grok ham OpenAI kabi vision qo'llab-quvvatlaydi
      userContent = [
        {
          type: 'image_url',
          image_url: {
            url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text:
            userMessage ||
            `Bu rasmdan mahsulotlar ro'yxatini ajrat.
Har bir mahsulot uchun aniqlashga harakat qil:
- product_name (mahsulot nomi)
- quantity (miqdor, sonli qiymat)
- unit (o'lchov birligi: dona, kg, m², m, litr va h.k.)
- customer_price (mijoz narxi)
- cost_price (tan narx)

MUHIM: Agar biror maydon rasmda ko'rsatilmagan yoki o'qib bo'lmasa — 
o'zing taxmin qilma, foydalanuvchidan so'ra.
Aniq o'qilgan ma'lumotlarni ro'yxat ko'rinishida ko'rsat, 
keyin noaniq/yo'q maydonlarni alohida so'ra.`,
        },
      ];
    } else if (isExcel) {
      const cellToString = (c: unknown): string => {
        if (c === null || c === undefined) return '';
        if (typeof c === 'string') return c;
        if (typeof c === 'number' || typeof c === 'boolean') return String(c);
        if (c instanceof Date) return c.toISOString();
        return JSON.stringify(c);
      };

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      let excelText = '';
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        excelText += `\n=== ${sheetName} ===\n`;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          blankrows: false,
        });
        rows.forEach((row, i) => {
          excelText += `${i + 1}: ${(row as string[]).map(cellToString).join(' | ')}\n`;
        });
      }
      userContent = `${userMessage}\n\nExcel fayl mazmuni:\n${excelText}`;
    } else {
      userContent = `${userMessage}\n\nFayl: ${file.originalname}\nMazmun:\n${file.buffer.toString('utf-8')}`;
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ];

    return this.runAgentLoop(messages, token);
  }

  // ─── Util ────────────────────────────────────────────────────────────────────

  getApiDocsInfo(): {
    loadedAt: string | null;
    chars: number;
    preview: string;
  } {
    return {
      loadedAt: this.apiDocsLoadedAt
        ? new Date(this.apiDocsLoadedAt).toISOString()
        : null,
      chars: this.apiDocs.length,
      preview: this.apiDocs.slice(0, 500),
    };
  }
}
