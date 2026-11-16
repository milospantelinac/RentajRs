import { FiscalizationError } from './fiscalization-provider.interface';

export interface FiscommClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

/** What Fiscomm sends back on every error (api.fiscomm.rs/docs). */
interface FiscommErrorBody {
  status?: number;
  code?: string;
  message?: string;
  userMessage?: string;
  correlationId?: string;
  details?: {
    validationErrors?: { field?: string; message?: string }[];
    pursRawResponse?: unknown;
  };
}

/**
 * A thin client for the few Fiscomm calls the platform needs. No SDK on
 * purpose: theirs is installed from GitHub without a version, and five calls
 * do not need it.
 *
 * Every failure becomes a FiscalizationError that says whether asking again
 * can help: a network error, a timeout, a 5xx, a 429 and a rejected key (401,
 * 403: someone fixes the key and the queue moves by itself) are worth another
 * try; a request Fiscomm or the Tax Administration refused on its merits is not.
 */
export class FiscommClient {
  constructor(
    private readonly options: FiscommClientOptions,
    // Injected so a test can answer without the network.
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let response: Response;
    let text: string;
    try {
      response = await this.fetchFn(`${this.options.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      text = await response.text();
    } catch (err) {
      throw new FiscalizationError(`Fiscomm did not answer: ${(err as Error).message}`, true);
    }

    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON, handled below */
    }

    if (response.ok) {
      if (json === null || typeof json !== 'object') {
        throw new FiscalizationError(`Fiscomm answered ${response.status} with something that is not JSON`, true);
      }
      return json as T;
    }

    const error = (json && typeof json === 'object' ? json : {}) as FiscommErrorBody;
    const retryable =
      response.status >= 500 || response.status === 429 || response.status === 408 || response.status === 401 || response.status === 403;
    throw new FiscalizationError(describe(response.status, error, text), retryable, error.code, error.correlationId);
  }
}

function describe(status: number, error: FiscommErrorBody, rawText: string): string {
  const parts = [`Fiscomm ${status}${error.code ? ` ${error.code}` : ''}`];
  const reason = error.userMessage || error.message;
  parts.push(reason ? `: ${reason}` : rawText ? `: ${rawText.slice(0, 200)}` : '');
  const problems = error.details?.validationErrors?.map((item) => `${item.field ?? '?'} ${item.message ?? ''}`.trim());
  if (problems?.length) parts.push(` (${problems.join('; ')})`);
  if (error.details?.pursRawResponse !== undefined) {
    const raw = typeof error.details.pursRawResponse === 'string' ? error.details.pursRawResponse : JSON.stringify(error.details.pursRawResponse);
    parts.push(` [Tax Administration: ${raw.slice(0, 300)}]`);
  }
  if (error.correlationId) parts.push(` (correlationId ${error.correlationId})`);
  return parts.join('');
}
