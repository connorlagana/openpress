export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "SUSPENDED"
  | "CONFIRMATION_REQUIRED"
  | "UPSTREAM";

/** Expected, user-facing failure. Message is safe to show to users and agents. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You do not have permission to do that") => new AppError("FORBIDDEN", msg);
