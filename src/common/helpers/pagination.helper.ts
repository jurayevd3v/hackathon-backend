export function buildPagination(page?: number, limit?: number) {
  const DEFAULT_LIMIT = 15;
  const MAX_LIMIT = 100;

  const safeLimit = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);

  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  return { limit: safeLimit, page: safePage, offset };
}
