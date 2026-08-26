# Local Web Workbench

This Next.js application shell is authorized only for local development and testing. It uses
synthetic transport data and a server-owned synthetic identity. It does not read G7 or Amap
credentials, execute G7 writes, persist business data, call an Agent/model, or deploy anywhere.

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-Workspace.ps1 -Task dev:web
```

Open `http://127.0.0.1:3000/`.

The role-change request goes through `/api/session/context`. The route ignores browser-provided
tenant values and accepts only roles assigned by the server-owned local session. This is not the
approved production authentication runtime; Keycloak, PostgreSQL RLS and persistent audit storage
remain blocked pending their gates.
