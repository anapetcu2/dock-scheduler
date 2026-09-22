import createClient from "openapi-fetch";

import type { paths } from "./schema";

export const api = createClient<paths>({ baseUrl: "/", credentials: "include" });

/** The shape the backend returns on booking 422/409: a ValidationResult, not
 * FastAPI's default error envelope. See SPEC.md section 8. */
export interface ValidationIssue {
  code: string;
  message: string;
  field?: string | null;
  related_booking_id?: number | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed with status ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

interface RawApiResponse<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Throws ApiError when a request errors, otherwise returns `data`. Every
 * query/mutation hook funnels through this so callers get a plain value or
 * a typed error, never openapi-fetch's `{data, error}` tuple. */
export function unwrap<T>(result: RawApiResponse<T>): T {
  if (result.error !== undefined) {
    throw new ApiError(result.response.status, result.error);
  }
  return result.data as T;
}

export function isValidationResult(detail: unknown): detail is ValidationResult {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "ok" in detail &&
    "errors" in detail &&
    Array.isArray((detail as ValidationResult).errors)
  );
}
