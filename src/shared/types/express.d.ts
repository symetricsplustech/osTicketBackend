import type { UserType } from '@prisma/client';

export interface AuthContext {
  userId: string;
  email: string;
  userType: UserType;
  sessionId: string | null;
  roles: string[];
  permissions: string[];
  mfaVerified: boolean;
  apiKeyId?: string;
  activeTenantId?: string | null;
  membershipId?: string | null;
  impersonation?: {
    impersonationSessionId: string;
    tenantId: string;
    requestedById: string;
  };
}

export interface TenantContextValue {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthContext;
      tenantContext?: TenantContextValue;
      startedAt: number;
    }
  }
}

export {};
