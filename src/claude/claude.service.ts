import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

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
  content?: {
    'application/json'?: { schema?: SchemaObject };
  };
}

interface SchemaObject {
  type?: string;
  $ref?: string;
  enum?: unknown[];
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
}

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

interface ExcelResult {
  excel_base64: string;
  filename: string;
  rows_count: number;
}

const DB_SCHEMA_HINT = `
PostgreSQL DB — faqat SELECT (read-only).
Asosiy jadvallar:
- locations (id, name, type, address, phone, is_active, is_contacted, parent_id, created_at)
- users (id, full_name, username, role, location_id, created_at, is_login)
- offers (id, location_id, status, total_sum, paid_sum, created_at)
- offer_items (id, offer_id, supplier_id, product_name, quantity, unit, status)
Har doim LIMIT qo'y. Hech qachon DROP, DELETE, UPDATE, INSERT yozma.
`;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class ClaudeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClaudeService.name);
  private client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  private pool!: Pool;

  private apiDocs = '';
  private apiDocsLoadedAt = 0;
  private refreshTimer?: NodeJS.Timeout;

  private readonly API_BASE =
    process.env.API_BASE_URL || 'https://dev.udsgroup.uz';
  private readonly SWAGGER_URL = `${this.API_BASE}/api/docs-json`;
  private readonly DOCS_TTL_MS = 30 * 60 * 1000;

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
        const operation = pathItem[method];
        if (!operation) continue;

        const tag = operation.tags?.[0] ?? 'Other';
        const summary = operation.summary ?? operation.operationId ?? '';

        // Body sxemasi
        const bodySchema =
          operation.requestBody?.content?.['application/json']?.schema;
        const bodyStr = bodySchema
          ? ` ${this.formatSchema(bodySchema, swagger)}`
          : '';

        // Query parametrlar
        const queries = (operation.parameters ?? [])
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
        } else {
          return 'object';
        }
      }
      return this.formatSchema(resolved as SchemaObject, swagger, depth + 1);
    }

    if (schema.enum) return schema.enum.map((v) => String(v)).join('|');

    if (schema.type === 'array') {
      return `${this.formatSchema(schema.items, swagger, depth + 1)}[]`;
    }

    if (schema.properties) {
      const required = new Set(schema.required ?? []);
      const entries = Object.entries(schema.properties).slice(0, 25);
      const fields = entries.map(([k, v]) => {
        const opt = required.has(k) ? '' : '?';
        let type: string;
        if (depth > 0) {
          type = v.enum
            ? v.enum.map(String).join('|')
            : v.type === 'array'
              ? 'array'
              : (v.type ?? (v.$ref ? 'object' : 'any'));
        } else {
          type = this.formatSchema(v, swagger, depth + 1);
        }
        return `${k}${opt}:${type}`;
      });
      return `{${fields.join(', ')}}`;
    }

    return schema.type ?? 'any';
  }

  private getTools(): Anthropic.Tool[] {
    return [
      {
        name: 'db_query',
        description: `PostgreSQL dan ma'lumot o'qish. Faqat SELECT. 
Murakkab JOIN, GROUP BY, tahlil, top N ro'yxatlar uchun ishlat.
API da yo'q so'rovlar uchun ham ishlat.
Hech qachon INSERT/UPDATE/DELETE/DROP yozma.`,
        input_schema: {
          type: 'object' as const,
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
      {
        name: 'api_call',
        description: `API ga istalgan so'rov yuborish. 
Yozish, o'zgartirish, o'chirish amallari uchun ishlat.
Mavjud barcha endpointlar system prompt da ko'rsatilgan (Swagger dan avtomatik yuklangan).`,
        input_schema: {
          type: 'object' as const,
          properties: {
            method: {
              type: 'string',
              description: 'GET | POST | PUT | DELETE',
            },
            path: {
              type: 'string',
              description: 'Endpoint path, masalan: /api/offer/',
            },
            body: { type: 'object', description: 'Request body' },
            params: { type: 'object', description: 'Query parametrlar' },
          },
          required: ['method', 'path'],
        },
      },
      {
        name: 'export_excel',
        description: `Ma'lumotlarni Excel (.xlsx) ga aylantirish.
Foydalanuvchi "excel qilib ber", "yuklab ber" deganda ishlat.
data — object array, har bir object bir qator bo'ladi.`,
        input_schema: {
          type: 'object' as const,
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
    ];
  }

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
    const sql = input.sql.trim().toUpperCase();
    const forbidden = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'TRUNCATE',
      'ALTER',
    ];
    if (forbidden.some((kw) => sql.startsWith(kw))) {
      return { error: "Faqat SELECT so'rovlarga ruxsat bor" };
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

      const res = await fetch(url, {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body:
          input.body && input.method !== 'GET'
            ? JSON.stringify(input.body)
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
      if (!input.data?.length) {
        return { error: "Ma'lumot bo'sh" };
      }

      const sheetName = (input.sheet_name ?? "Ma'lumotlar").slice(0, 31);
      const keys = Object.keys(input.data[0]);

      const columns: ExcelColumn[] =
        input.columns ?? keys.map((k) => ({ key: k, header: k, width: 22 }));

      const orderedKeys = columns.map((c) => c.key);
      const headers = columns.map((c) => c.header ?? c.key);

      const aoa: unknown[][] = [headers];
      for (const row of input.data) {
        aoa.push(orderedKeys.map((k) => row[k] ?? ''));
      }

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      worksheet['!cols'] = columns.map((c) => ({ wch: c.width ?? 22 }));

      worksheet['!rows'] = [{ hpt: 22 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const buffer = XLSX.write(workbook, {
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

  private buildSystemPrompt(token: string): string {
    return `Sen USD ERP tizimining AI yordamchisan.

QOIDALAR:
- Har doim O'ZBEK TILIDA javob ber
- Qisqa va aniq bo'l
- Noaniqlik bo'lsa — aniqlashtir
- Muhim o'zgartirish (o'chirish, status) oldidan tasdiqlat: "Rostdan ham bajarsinmi?"
- Xatolikda tushunarli tushuntir

QAYSI TOOL NI QACHON ISHLATISH:
1. db_query — o'qish, tahlil, top N, murakkab so'rovlar, API da yo'q so'rovlar
2. api_call — yozish, o'zgartirish, o'chirish, yaratish amallari
3. export_excel — "excel qilib ber", "yuklab ber", "fayl sifatida" so'rovlarda

STRATEGIYA:
- Avval db_query bilan ma'lumot ol → keyin tahlil qil yoki api_call bilan amal bajar
- Top N so'rovlarda db_query ishlat
- Excel kerak bo'lsa: avval db_query → natijani export_excel ga ber

FOYDALANUVCHI TOKENI: ${token}

=== MAVJUD API ENDPOINTLAR (Swagger dan avtomatik yuklangan) ===
${this.apiDocs}

${DB_SCHEMA_HINT}`;
  }

  private async runAgentLoop(
    messages: Anthropic.MessageParam[],
    token: string,
  ): Promise<{ message: string; excel: ExcelResult | null }> {
    let response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: this.buildSystemPrompt(token),
      tools: this.getTools(),
      messages,
    });

    let excelResult: ExcelResult | null = null;

    while (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        const result = await this.executeTool(
          toolUse.name,
          toolUse.input,
          token,
        );

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

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.buildSystemPrompt(token),
        tools: this.getTools(),
        messages,
      });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return { message: text, excel: excelResult };
  }

  async chat(
    userMessage: string,
    token: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<{ message: string; excel: ExcelResult | null }> {
    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: userMessage },
    ];
    return this.runAgentLoop(messages, token);
  }

  async chatWithFile(
    userMessage: string,
    file: Express.Multer.File,
    token: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<{ message: string; excel: ExcelResult | null }> {
    const isImage = file.mimetype.startsWith('image/');
    const isExcel =
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls');

    const cellToString = (c: unknown): string => {
      if (c === null || c === undefined) return '';
      if (typeof c === 'string') return c;
      if (typeof c === 'number' || typeof c === 'boolean') return String(c);
      if (c instanceof Date) return c.toISOString();
      return JSON.stringify(c);
    };

    let userContent: Anthropic.MessageParam['content'];

    if (isImage) {
      userContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mimetype as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp',
            data: file.buffer.toString('base64'),
          },
        },
        {
          type: 'text',
          text: userMessage || "Bu rasmdan kerakli ma'lumotlarni ajrat",
        },
      ];
    } else if (isExcel) {
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
          excelText += `${i + 1}: ${row.map(cellToString).join(' | ')}\n`;
        });
      }

      userContent = `${userMessage}\n\nExcel fayl mazmuni:\n${excelText}`;
    } else {
      userContent = `${userMessage}\n\nFayl: ${file.originalname}\nMazmun:\n${file.buffer.toString('utf-8')}`;
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ];

    return this.runAgentLoop(messages, token);
  }

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
