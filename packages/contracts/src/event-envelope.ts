import { AppError } from "./error-contract.ts";

export interface EventEnvelopeInput<TPayload extends Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly tenantId: string;
  readonly source: string;
  readonly happenedAt: string;
  readonly receivedAt: string;
  readonly traceId: string;
  readonly payload: TPayload;
}

export interface EventEnvelope<TPayload extends Record<string, unknown>>
  extends EventEnvelopeInput<Readonly<TPayload>> {
  readonly schemaVersion: 1;
}

function parsedTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError({
      code: "INVALID_EVENT_ENVELOPE",
      category: "VALIDATION",
      message: `${field} must be an RFC3339 timestamp`,
      retryable: false,
    });
  }
  return parsed;
}

export function createEventEnvelope<TPayload extends Record<string, unknown>>(
  input: EventEnvelopeInput<TPayload>,
): EventEnvelope<TPayload> {
  const happenedAt = parsedTimestamp(input.happenedAt, "happenedAt");
  const receivedAt = parsedTimestamp(input.receivedAt, "receivedAt");
  if (receivedAt < happenedAt) {
    throw new AppError({
      code: "INVALID_EVENT_ENVELOPE",
      category: "VALIDATION",
      message: "receivedAt cannot be earlier than happenedAt",
      retryable: false,
    });
  }

  const payload = Object.freeze({ ...input.payload });
  return Object.freeze({
    schemaVersion: 1,
    eventId: input.eventId,
    eventType: input.eventType,
    tenantId: input.tenantId,
    source: input.source,
    happenedAt: input.happenedAt,
    receivedAt: input.receivedAt,
    traceId: input.traceId,
    payload,
  });
}
