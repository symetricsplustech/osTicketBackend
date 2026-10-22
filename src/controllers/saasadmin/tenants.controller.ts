import type { Request, Response } from "express";
import { ok, created, accepted, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createTenant,
  getProvisioningStatus,
  getTenantHealth,
  getTenantOverview,
  listTenantActivity,
  listTenantUsers,
  provisionTenant,
  requestArchive,
  requestImpersonation,
  requestSuspension,
  tenantCrud,
  performTenantActivation,
  performTenantReactivate,
  updateTenant,
} from "../../services/saasadmin/tenants.service";
import { createTenantOrgUser } from "../../services/saasadmin/tenant-users.service";
import type {
  CreateTenantInput,
  CreateTenantUserInput,
  ImpersonationInput,
  UpdateTenantInput,
} from "../../validators/saasadmin/tenants.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listTenants = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await tenantCrud.list(req);
  return paginated(res, rows, meta);
});

export const createTenantHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenant = await createTenant(
      req.body as CreateTenantInput,
      actorOf(req),
    );
    return created(res, tenant, {
      provisioningStatus: tenant.provisioning.status,
      message:
        tenant.provisioning.status === "COMPLETED"
          ? "Tenant created and provisioning completed."
          : "Tenant created but provisioning failed. Use the provision endpoint to retry.",
    });
  },
);

export const getTenant = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await tenantCrud.getById(req.params.tenantId!);
  return ok(res, tenant);
});

export const updateTenantHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenant = await updateTenant(
      req.params.tenantId!,
      req.body as UpdateTenantInput,
      actorOf(req),
    );
    return ok(res, tenant);
  },
);

export const activateTenant = asyncHandler(
  async (req: Request, res: Response) => {
    const tenant = await performTenantActivation(
      req.params.tenantId!,
      actorOf(req),
    );
    return ok(res, tenant);
  },
);

export const suspendTenant = asyncHandler(
  async (req: Request, res: Response) => {
    const tenant = await requestSuspension(
      req.params.tenantId!,
      req.body.reason,
      actorOf(req),
    );
    return ok(res, tenant);
  },
);

export const reactivateTenant = asyncHandler(
  async (req: Request, res: Response) => {
    const tenant = await performTenantReactivate(
      req.params.tenantId!,
      actorOf(req),
    );
    return ok(res, tenant);
  },
);

export const archiveTenant = asyncHandler(
  async (req: Request, res: Response) => {
    const tenant = await requestArchive(
      req.params.tenantId!,
      req.body.reason,
      actorOf(req),
    );
    return ok(res, tenant);
  },
);

export const tenantOverview = asyncHandler(
  async (req: Request, res: Response) => {
    const overview = await getTenantOverview(req.params.tenantId!);
    return ok(res, overview);
  },
);

export const tenantUsers = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listTenantUsers(req.params.tenantId!, req);
  return paginated(res, rows, meta);
});

export const createTenantOrgUserHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createTenantOrgUser(
      req.params.tenantId!,
      req.body as CreateTenantUserInput,
      {
        actorId: req.auth?.userId ?? null,
        actorEmail: req.auth?.email ?? null,
        req,
      },
    );
    const message =
      result.status !== "ACTIVE"
        ? "Invitation sent. The user must accept it before signing in."
        : "reusedExistingAccount" in result && result.reusedExistingAccount
          ? "Existing account linked to the organization. The user signs in with their current password; it was not changed."
          : "User created. They can sign in now with the single sign-in endpoint.";
    return created(res, result, { message });
  },
);

export const tenantActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listTenantActivity(req.params.tenantId!, req);
    return paginated(res, rows, meta);
  },
);

export const tenantHealth = asyncHandler(
  async (req: Request, res: Response) => {
    const health = await getTenantHealth(req.params.tenantId!);
    return ok(res, health);
  },
);

export const provisionTenantHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await provisionTenant(req.params.tenantId!, actorOf(req));
    return accepted(res, result, {
      message:
        result.status === "COMPLETED"
          ? "Provisioning completed."
          : "Provisioning failed. Review the step errors.",
    });
  },
);

export const provisioningStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const status = await getProvisioningStatus(req.params.tenantId!);
    return ok(res, status);
  },
);

export const createImpersonationSession = asyncHandler(
  async (req: Request, res: Response) => {
    const session = await requestImpersonation(
      req.params.tenantId!,
      req.body as ImpersonationInput,
      actorOf(req),
    );
    return created(res, session, {
      message:
        "Support access granted. All activity in this session is audited.",
    });
  },
);
