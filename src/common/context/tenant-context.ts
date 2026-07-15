// common/context/tenant-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export const tenantContext = new AsyncLocalStorage<string>();

export function getCurrentTenantId(): string {
  const id = tenantContext.getStore();
  if (!id)
    throw new Error('Tenant context not set — is TenantMiddleware applied?');
  return id;
}
