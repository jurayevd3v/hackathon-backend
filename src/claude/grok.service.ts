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

export interface ExcelResult {
  excel_base64: string;
  filename: string;
  rows_count: number;
}

export interface ChatResponse {
  message: string;
  excel: ExcelResult | null;
}

const DB_SCHEMA_HINT = [
  'PostgreSQL DB — faqat SELECT (read-only).',
  'Jadvallar:',
  '- locations (id, name, type, address, phone, is_active, is_contacted, parent_id, created_at)',
  '- users (id, full_name, username, role, location_id, created_at, is_login)',
  '- offers (id, location_id, status, total_sum, paid_sum, created_at, construction_site_name, note, address, is_logist, date)',
  '- offer_items (id, offer_id, product_name, quantity, unit, customer_price, cost_price, status)',
  'Har doim LIMIT qoy. Hech qachon DROP/DELETE/UPDATE/INSERT yozma.',
].join('\n');

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class GrokService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrokService.name);

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
  private readonly MODEL =
    process.env.GROK_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    await this.refreshApiDocs();
    this.refreshTimer = setInterval(() => {
      void this.refreshApiDocs().catch((e: unknown) =>
        this.logger.error('Swagger refresh xatosi: ' + errMsg(e)),
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
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const swagger = (await res.json()) as SwaggerDoc;
      this.apiDocs = this.swaggerToText(swagger);
      this.apiDocsLoadedAt = Date.now();
      const endpoints = Object.keys(swagger.paths ?? {}).length;
      this.logger.log(
        'Swagger yuklandi: ' +
          endpoints +
          ' path, ' +
          this.apiDocs.length +
          ' belgi',
      );
      return { ok: true, endpoints, chars: this.apiDocs.length };
    } catch (err: unknown) {
      this.logger.error('Swagger yuklab bolmadi: ' + errMsg(err));
      if (!this.apiDocs) {
        this.apiDocs =
          'API dokumentatsiyani yuklab bolmadi. Faqat db_query ishlatilsin.';
      }
      return { ok: false, endpoints: 0, chars: this.apiDocs.length };
    }
  }

  private swaggerToText(swagger: SwaggerDoc): string {
    const baseUrl = swagger.servers?.[0]?.url ?? this.API_BASE;
    const lines: string[] = ['BASE URL: ' + baseUrl, ''];
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
          ? ' ' + this.formatSchema(bodySchema, swagger)
          : '';
        const queries = (op.parameters ?? [])
          .filter((p) => p.in === 'query')
          .map((p) => (p.required ? p.name : p.name + '?'));
        const queryStr = queries.length ? '?' + queries.join('&') : '';
        const line =
          method.toUpperCase().padEnd(6) +
          ' ' +
          path +
          queryStr +
          ' - ' +
          summary +
          bodyStr;
        (byTag[tag] ||= []).push(line);
      }
    }

    for (const tag of Object.keys(byTag)) {
      lines.push('=== ' + tag.toUpperCase() + ' ===');
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
      return this.formatSchema(schema.items, swagger, depth + 1) + '[]';
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
          return k + opt + ':' + type;
        });
      return '{' + fields.join(', ') + '}';
    }
    return schema.type ?? 'any';
  }

  private getTools(): OpenAI.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'db_query',
          description:
            'PostgreSQL dan malumot oqish. Faqat SELECT. Location, user, offer qidirish uchun ishlat. Hech qachon INSERT/UPDATE/DELETE/DROP yozma.',
          parameters: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SELECT sorovi. Har doim LIMIT qoy (max 500)',
              },
              params: {
                type: 'array',
                items: { type: 'string' },
                description: 'Parametrlar [$1, $2 uchun]',
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
          description:
            'API ga sorov yuborish. Yaratish, ozgartirish, ochirish uchun ishlat. body va params faqat kerak bolsa qosh, aks holda umuman qoshma.',
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              },
              path: {
                type: 'string',
                description: 'Endpoint path, masalan: /api/offers',
              },
              body: {
                type: 'object',
                additionalProperties: true,
                description: 'Request body. Object bolishi shart.',
              },
              params: {
                type: 'object',
                additionalProperties: true,
                description: 'Query parametrlar. Object formatida.',
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
          description:
            'Malumotlarni Excel (.xlsx) ga aylantirish. Foydalanuvchi excel yoki yuklab ber deganda ishlat.',
          parameters: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { type: 'object' },
                description: 'Excel ga yoziladigan malumotlar',
              },
              sheet_name: { type: 'string' },
              columns: {
                type: 'array',
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
        return { error: "Noma'lum tool: " + name };
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
    const firstWord = upperSql.replace(/\s+/g, ' ').split(' ')[0];
    if (forbidden.includes(firstWord))
      return { error: 'Faqat SELECT sorovlarga ruxsat bor' };
    if (forbidden.slice(1).some((kw) => upperSql.includes(kw + ' ')))
      return { error: 'SQL da yozuvchi operatsiyalar taqiqlangan' };
    try {
      const result = await this.pool.query(input.sql, input.params ?? []);
      return { rows: result.rows, count: result.rowCount };
    } catch (err: unknown) {
      return { error: 'DB xatosi: ' + errMsg(err) };
    }
  }

  private async runApiCall(
    input: ApiCallInput,
    token: string,
  ): Promise<Record<string, unknown>> {
    try {
      let url = this.API_BASE + input.path;
      if (input.params && input.params !== null) {
        const entries = Object.entries(input.params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)] as [string, string]);
        const q = new URLSearchParams(entries).toString();
        if (q) url += '?' + q;
      }

      let bodyData: unknown = input.body;
      if (bodyData === null) bodyData = undefined;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {
          bodyData = undefined;
        }
      }

      const res = await fetch(url, {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body:
          bodyData && input.method !== 'GET'
            ? JSON.stringify(bodyData)
            : undefined,
      });

      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok)
        return { error: 'API ' + res.status + ': ' + JSON.stringify(data) };
      return (data as Record<string, unknown>) ?? {};
    } catch (err: unknown) {
      return { error: 'Tarmoq xatosi: ' + errMsg(err) };
    }
  }

  private runExportExcel(input: ExportExcelInput): Record<string, unknown> {
    try {
      if (!input.data?.length) return { error: 'Malumot bosh' };
      const sheetName = (input.sheet_name ?? 'Malumotlar').slice(0, 31);
      const columns: ExcelColumn[] =
        input.columns ??
        Object.keys(input.data[0]).map((k) => ({
          key: k,
          header: k,
          width: 22,
        }));
      const headers = columns.map((c) => c.header ?? c.key);
      const aoa: unknown[][] = [headers];
      for (const row of input.data)
        aoa.push(columns.map((c) => row[c.key] ?? ''));
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
        filename:
          (input.sheet_name ?? 'malumotlar').replace(/\s/g, '_') +
          '_' +
          Date.now() +
          '.xlsx',
        rows_count: input.data.length,
      };
      return result as unknown as Record<string, unknown>;
    } catch (err: unknown) {
      return { error: 'Excel xatosi: ' + errMsg(err) };
    }
  }

  private buildSystemPrompt(): string {
    const lines = [
      "Sen USD ERP tizimining AI yordamchisan. Faqat O'ZBEK TILIDA javob ber.",
      '',
      '## QOIDALAR',
      '- Foydalanuvchi amal sorasa DARHOL tool chaqir, ortiqcha savol berma',
      "- 'Rostdan ham bajarsinmi?' FAQAT ochirish va status ozgartirish oldidan",
      "- Hech qachon 'menda funksiya yoq' yoki 'curl bilan qiling' dema",
      '- db_query → malumot oqish; api_call → yaratish/ozgartirish/ochirish; export_excel → excel',
      '',
      '## OFFER YARATISH — QATIY ALGORITM',
      '',
      '### QADAM 1: Location topish (DOIM db_query bilan)',
      'Foydalanuvchi location nomi aytsa — DARHOL qidir:',
      "  SELECT id, name FROM locations WHERE name ILIKE '%[nom]%' LIMIT 10",
      'Topilmasa — nomni boshqacha yoz:',
      "  SELECT id, name FROM locations WHERE name ILIKE '%[birinchi soz]%' LIMIT 10",
      'Hali topilmasa — royxat korsatib tanlat:',
      '  SELECT id, name FROM locations ORDER BY name LIMIT 30',
      "HECH QACHON foydalanuvchidan location ID sorama — o'zing topib ol!",
      '',
      '### QADAM 2: Mahsulot malumotlari',
      'Kerak: product_name, quantity, unit, customer_price, cost_price',
      'Faqat YOQ narsani sor. Bor bolsa SORMA.',
      '',
      '### QADAM 3: Offer yaratish',
      'location_id va items tayyor bolsa — DARHOL POST /api/offers:',
      '{"location_id":"uuid","items":[{"product_name":"...","quantity":1,"unit":"dona","customer_price":0,"cost_price":0}]}',
      '',
      '## LOCATION YARATISH',
      'POST /api/location',
      '{"name":"...","type":"...","address":"...","phone":"..."}',
      '',
      '## API_CALL QOIDASI',
      'params va body kerak bolmasa — bu maydonlarni UMUMAN QOSHMA (null yuborme)',
      '',
      '=== API ENDPOINTLAR ===',
      this.apiDocs,
      '',
      DB_SCHEMA_HINT,
    ];
    return lines.join('\n');
  }

  private async runAgentLoop(
    messages: OpenAI.ChatCompletionMessageParam[],
    token: string,
  ): Promise<ChatResponse> {
    let excelResult: ExcelResult | null = null;

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

    while (response.choices[0]?.finish_reason === 'tool_calls') {
      const assistantMsg = response.choices[0].message;
      currentMessages.push(assistantMsg);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCalls: any[] = assistantMsg.tool_calls ?? [];

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
              tool_call_id: tc.id as string,
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
      userContent = [
        {
          type: 'image_url',
          image_url: {
            url:
              'data:' +
              file.mimetype +
              ';base64,' +
              file.buffer.toString('base64'),
            detail: 'high',
          },
        },
        {
          type: 'text',
          text:
            userMessage ||
            [
              'Bu rasmdan mahsulotlar royxatini ajrat.',
              'Har bir mahsulot uchun: product_name, quantity, unit, customer_price, cost_price',
              'Agar biror maydon rasmda korsatilmagan yoki oqib bolmasa — taxmin qilma, sorа.',
              'Aniq oqilgan malumotlarni royxat korinishida korsat,',
              'keyin noaniq/yoq maydonlarni alohida sor.',
            ].join('\n'),
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
        excelText += '\n=== ' + sheetName + ' ===\n';
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          blankrows: false,
        });
        rows.forEach((row, i) => {
          excelText += i + 1 + ': ' + row.map(cellToString).join(' | ') + '\n';
        });
      }
      userContent = userMessage + '\n\nExcel fayl mazmuni:\n' + excelText;
    } else {
      userContent =
        userMessage +
        '\n\nFayl: ' +
        file.originalname +
        '\nMazmun:\n' +
        file.buffer.toString('utf-8');
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
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
