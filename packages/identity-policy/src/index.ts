export {
  assertPermissionAllowed,
  assertResourceTenant,
  assertRiskTierAvailable,
  assertRoleSwitchDoesNotExpand,
  intersectDataScopes,
  isScopeIdAllowed,
  type DataScopeLayer,
  type EffectiveDataScope,
  type EffectiveScopeDimension,
  type PermissionDecisionInput,
  type RiskTier,
  type ScopeConstraint,
} from "./policy.ts";
