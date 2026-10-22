import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  activateStaff,
  createStaff,
  deactivateStaff,
  getStaff,
  getStaffEffectivePermissions,
  getStaffRoles,
  listStaff,
  listStaffActivity,
  listStaffSessions,
  replaceStaffRoles,
  resendInvitation,
  resetStaffPassword,
  revokeStaffSession,
  revokeStaffSessions,
  suspendStaff,
  updateStaff,
} from "../../services/saasadmin/staff.service";
import type {
  CreateStaffInput,
  ReplaceStaffRolesInput,
  UpdateStaffInput,
} from "../../validators/saasadmin/staff.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listStaff(req);
    return paginated(res, rows, meta);
  },
);

export const createStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createStaff(
      req.body as CreateStaffInput,
      actorOf(req),
    );
    return created(res, result.staff, {
      invitationEmailStatus: result.invitationEmailStatus,
      message:
        result.invitationEmailStatus === "SENT"
          ? "Staff member invited. An invitation email has been sent."
          : "Staff member created, but the invitation email could not be delivered. Resend the invitation once email delivery is configured.",
    });
  },
);

export const getStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await getStaff(req.params.staffId!);
    return ok(res, staff);
  },
);

export const updateStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await updateStaff(
      req.params.staffId!,
      req.body as UpdateStaffInput,
      actorOf(req),
    );
    return ok(res, staff);
  },
);

export const resendStaffInvitation = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await resendInvitation(req.params.staffId!, actorOf(req));
    return ok(res, result, {
      message:
        result.invitationEmailStatus === "SENT"
          ? "Invitation email sent."
          : "Invitation regenerated, but the email could not be delivered.",
    });
  },
);

export const activateStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await activateStaff(req.params.staffId!, actorOf(req));
    return ok(res, staff);
  },
);

export const suspendStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await suspendStaff(req.params.staffId!, actorOf(req));
    return ok(res, staff, {
      message: "Staff member suspended and all active sessions were revoked.",
    });
  },
);

export const deactivateStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await deactivateStaff(req.params.staffId!, actorOf(req));
    return ok(res, staff, {
      message: "Staff member deactivated and all active sessions were revoked.",
    });
  },
);

export const resetStaffPasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await resetStaffPassword(req.params.staffId!, req);
    return ok(res, result, {
      message: "A password reset email has been sent to the staff member.",
    });
  },
);

export const revokeStaffSessionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await revokeStaffSessions(req.params.staffId!, actorOf(req));
    return ok(res, result, {
      message: `${result.revokedSessions} session(s) revoked.`,
    });
  },
);

export const staffSessions = asyncHandler(
  async (req: Request, res: Response) => {
    const sessions = await listStaffSessions(req.params.staffId!, req);
    return ok(res, sessions);
  },
);

export const revokeStaffSessionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await revokeStaffSession(
      req.params.staffId!,
      req.params.sessionId!,
      actorOf(req),
    );
    return ok(res, result, { message: "Session revoked." });
  },
);

export const staffEffectivePermissions = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getStaffEffectivePermissions(req.params.staffId!);
    return ok(res, result);
  },
);

export const replaceStaffRolesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await replaceStaffRoles(
      req.params.staffId!,
      req.body as ReplaceStaffRolesInput,
      actorOf(req),
    );
    return ok(res, staff);
  },
);

export const staffRoles = asyncHandler(async (req: Request, res: Response) => {
  const roles = await getStaffRoles(req.params.staffId!);
  return ok(res, roles);
});

export const staffActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listStaffActivity(req.params.staffId!, req);
    return paginated(res, rows, meta);
  },
);
