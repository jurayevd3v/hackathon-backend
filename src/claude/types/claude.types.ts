export interface ExcelResult {
  excel_base64: string;
  filename: string;
  rows_count: number;
}

export interface ChatResponse {
  message: string;
  excel: ExcelResult | null;
}

export interface ApiDocsRefreshResult {
  ok: boolean;
  endpoints: number;
  chars: number;
}

export interface ApiDocsInfo {
  loadedAt: string | null;
  chars: number;
  preview: string;
}
