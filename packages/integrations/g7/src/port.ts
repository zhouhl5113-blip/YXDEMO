import type { TenantScope } from "../../../contracts/src/index.ts";

export interface G7RequestContext {
  readonly tenantScope: TenantScope;
  readonly requestId: string;
  readonly traceId: string;
}

export interface G7PageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface G7Page<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor?: string;
}

export interface G7ReadPort {
  searchVehicles(
    context: G7RequestContext,
    page: G7PageRequest,
  ): Promise<G7Page<Record<string, unknown>>>;
}
