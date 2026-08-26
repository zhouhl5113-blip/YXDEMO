export const G7_SECRET_REFERENCES = Object.freeze({
  tenantCode: "G7_TENANT_CODE",
  sandboxAccessKey: "G7_SANDBOX_ACCESS_KEY",
  sandboxSecretKey: "G7_SANDBOX_SECRET_KEY",
  prodAccessKey: "G7_PROD_ACCESS_KEY",
  prodSecretKey: "G7_PROD_SECRET_KEY",
});

export const G7_REQUIRED_HEADERS = Object.freeze([
  "g7e6-tenant-code",
  "g7e6-user-code",
  "g7e6-dp-access-key",
  "g7e6-dp-timestamp",
  "g7e6-dp-signature",
] as const);

export const G7_DOCUMENTED_PAGINATION = Object.freeze({ minimum: 1, maximum: 512 });

export function normalizeG7PageLimit(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < G7_DOCUMENTED_PAGINATION.minimum ||
    value > G7_DOCUMENTED_PAGINATION.maximum
  ) {
    throw new RangeError(
      `G7 page limit must be between ${G7_DOCUMENTED_PAGINATION.minimum} and ${G7_DOCUMENTED_PAGINATION.maximum}`,
    );
  }
  return value;
}
