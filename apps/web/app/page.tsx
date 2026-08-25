import { createLocalWorkbenchContext, LOCAL_ROLE_OPTIONS } from "../lib/local-session.ts";
import { Workbench } from "./workbench.tsx";

export const dynamic = "force-dynamic";

export default function WorkbenchPage() {
  const context = createLocalWorkbenchContext();

  return (
    <Workbench
      session={{
        displayName: "周贺龙",
        tenantLabel: "易行物流（本地）",
        tenantId: context.tenantScope.tenantId,
        selectedRoleId: context.selectedRoleId,
        roleOptions: LOCAL_ROLE_OPTIONS,
        requestId: context.requestId,
        traceId: context.traceId,
      }}
    />
  );
}
