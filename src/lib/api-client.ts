/**
 * Shared API response handling.
 *
 * One place decides what an HTTP status means for the UI, so screens stop
 * re-implementing (or skipping) error handling. Every helper takes the raw
 * `Response` plus an optional `ApiErrorHandlers` set and:
 *
 *  - returns the parsed `data` on success,
 *  - calls the matching handler (401/403/404/429/5xx/network) instead of
 *    throwing, when one is provided,
 *  - throws a typed `ApiClientError` otherwise.
 *
 * The intended call shape:
 *
 * ```ts
 * const data = await handleApiError(await fetch(url), {
 *   onUnauthorized: () => router.push("/login"),
 *   onNetworkError: () => setOffline(true),
 * });
 * ```
 */

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export type ApiErrorHandlers = {
  /** 401 — session invalid/expired. Default: throw. */
  onUnauthorized?: () => void;
  /** 403 — signed in but not allowed. Default: throw. */
  onForbidden?: (message: string) => void;
  /** 404 — resource does not exist. Default: throw. */
  onNotFound?: (message: string) => void;
  /** 429 — rate limited. Default: throw. */
  onRateLimited?: (message: string) => void;
  /** 5xx — service problem. Default: throw. */
  onServerError?: (message: string) => void;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string } | null;
};

/** Human-readable copy per failure class — never raw status text. */
function friendlyMessage(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "That request wasn't valid. Please check and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have access to this.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 409:
      return "This already exists.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      if (status >= 500) return "FoodGuard is having trouble right now. Please try again shortly.";
      return "Something went wrong. Please try again.";
  }
}

export async function handleApiError<T>(
  response: Response,
  handlers?: ApiErrorHandlers,
): Promise<T> {
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON body (proxy error page, empty 502, …) — fall through.
  }

  const serverMessage = payload?.error?.message ?? "";
  const code = payload?.error?.code ?? null;

  if (response.ok && payload?.success && payload.data !== undefined) {
    return payload.data;
  }

  const status = response.status;
  const message = serverMessage || friendlyMessage(status);

  if (status === 401) {
    if (handlers?.onUnauthorized) {
      handlers.onUnauthorized();
      // Harmless placeholder; the caller redirects away.
      return undefined as T;
    }
    throw new ApiClientError(status, message, code);
  }
  if (status === 403) {
    if (handlers?.onForbidden) {
      handlers.onForbidden(message);
      return undefined as T;
    }
    throw new ApiClientError(status, message, code);
  }
  if (status === 404) {
    if (handlers?.onNotFound) {
      handlers.onNotFound(message);
      return undefined as T;
    }
    throw new ApiClientError(status, message, code);
  }
  if (status === 429) {
    if (handlers?.onRateLimited) {
      handlers.onRateLimited(message);
      return undefined as T;
    }
    throw new ApiClientError(status, message, code);
  }
  if (status >= 500) {
    if (handlers?.onServerError) {
      handlers.onServerError(message);
      return undefined as T;
    }
    throw new ApiClientError(status, message, code);
  }

  throw new ApiClientError(status || 0, message, code);
}

/**
 * Wrap a fetch promise so network failures become typed errors instead of
 * raw TypeErrors leaking into components.
 */
export async function withNetworkError<T>(
  request: Promise<Response>,
  onError: (message: string) => T,
): Promise<T | undefined> {
  try {
    return await request.then(() => undefined as unknown as T);
  } catch {
    return onError("You appear to be offline. Check your connection and try again.");
  }
}

/** True when a thrown error came from the network layer (fetch itself). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}
