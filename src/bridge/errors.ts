import type { AppError } from "./types";

export const errorMessage = (error: unknown, fallback: string): string =>
  (typeof error === "string" ? error : (error as AppError)?.message) || fallback;
