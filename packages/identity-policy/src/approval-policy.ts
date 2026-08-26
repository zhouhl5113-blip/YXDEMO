import { AppError } from "../../contracts/src/index.ts";
import { assertRiskTierAvailable } from "./policy.ts";

export interface ApprovalSeparationInput {
  readonly riskTier: "R2" | "R3";
  readonly initiatorId: string;
  readonly approverIds: readonly string[];
}

function normalizedIds(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

export function assertApprovalSeparation(input: ApprovalSeparationInput): void {
  assertRiskTierAvailable(input.riskTier);

  const initiatorId = input.initiatorId.trim();
  const approverIds = normalizedIds(input.approverIds);
  if (initiatorId.length === 0 || approverIds.length === 0) {
    throw new AppError({
      code: "APPROVER_REQUIRED",
      category: "VALIDATION",
      message: "An initiator and at least one approver are required",
      retryable: false,
    });
  }

  if (approverIds.includes(initiatorId)) {
    throw new AppError({
      code: "APPROVAL_SELF_REVIEW_FORBIDDEN",
      category: "AUTHORIZATION",
      message: "The action initiator cannot approve the same action",
      retryable: false,
    });
  }
}
