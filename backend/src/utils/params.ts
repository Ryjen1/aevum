/**
 * Type-safe helpers for Express 5 req.params / req.query.
 * Express 5 types these loosely via qs; our route patterns always produce
 * a single string. We accept the wider Express 5 type and coerce here.
 */

type AnyParams = Record<string, string | string[] | undefined>;
type AnyQuery = Record<string, unknown>;

export function param(req: { params: AnyParams }, name: string): string {
  const v = req.params[name];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function queryString(req: { query: AnyQuery }, name: string): string | undefined {
  const v = req.query[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}
