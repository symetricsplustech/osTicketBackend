import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { buildPaginationMeta, parseListQuery } from '../../src/shared/pagination';

function requestWithQuery(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe('list query parsing', () => {
  it('applies defaults', () => {
    const query = parseListQuery(requestWithQuery({}));
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
    expect(query.sortOrder).toBe('desc');
    expect(query.search).toBeUndefined();
  });

  it('parses and clamps values', () => {
    const query = parseListQuery(requestWithQuery({ page: '3', limit: '500', sortOrder: 'asc', search: '  acme  ' }));
    expect(query.page).toBe(3);
    expect(query.limit).toBe(200);
    expect(query.sortOrder).toBe('asc');
    expect(query.search).toBe('acme');
  });

  it('respects a custom max limit', () => {
    const query = parseListQuery(requestWithQuery({ limit: '999' }), { maxLimit: 50 });
    expect(query.limit).toBe(50);
  });

  it('ignores invalid pagination values gracefully', () => {
    const query = parseListQuery(requestWithQuery({ page: 'abc', limit: '-5' }));
    expect(query.page).toBe(1);
    expect(query.limit).toBe(1);
  });

  it('builds accurate pagination meta', () => {
    const meta = buildPaginationMeta(2, 20, 45);
    expect(meta).toMatchObject({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(buildPaginationMeta(1, 20, 0).hasPreviousPage).toBe(false);
    expect(buildPaginationMeta(3, 20, 45).hasNextPage).toBe(false);
  });
});
