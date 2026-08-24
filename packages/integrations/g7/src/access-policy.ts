import { AppError } from "../../../contracts/src/index.ts";

export type G7Operation = "OFFLINE_CONTRACT" | "LIVE_READ" | "LIVE_WRITE";
export type G7Target = "SANDBOX" | "PROD";

export interface G7CredentialDecision {
  readonly developmentMode: "CREDENTIALLESS_OFFLINE_CONTRACTS_ONLY";
  readonly oldCredentialsUsedByOtherSystems: boolean;
  readonly rotateNow: boolean;
  readonly credentialUseAllowedForThisProject: boolean;
}

export interface G7OperationRequest {
  readonly operation: G7Operation;
  readonly target: G7Target;
  readonly decision: G7CredentialDecision;
}

export function assertG7OperationAllowed(request: G7OperationRequest): void {
  if (request.target === "PROD") {
    throw new AppError({
      code: "G7_PROD_USE_BLOCKED",
      category: "SECURITY",
      message: "G7 production operations require Acceptance Gate and explicit production approval",
      retryable: false,
    });
  }

  if (request.operation === "OFFLINE_CONTRACT") {
    if (
      request.decision.developmentMode === "CREDENTIALLESS_OFFLINE_CONTRACTS_ONLY" &&
      request.decision.credentialUseAllowedForThisProject === false
    ) {
      return;
    }
  }

  throw new AppError({
    code: "G7_LIVE_USE_BLOCKED",
    category: "SECURITY",
    message:
      "Live G7 use is blocked until coordinated credential rotation and Harness Secret binding",
    retryable: false,
  });
}
