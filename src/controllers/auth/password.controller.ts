import type { Request, Response } from "express";
import { ok, noContent } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { UnauthorizedError } from "../../shared/errors";
import {
  changePassword,
  confirmEmailChange,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
} from "../../services/auth/password.service";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "../../validators/auth/password.validators";
import type {
  EmailChangeConfirmInput,
  EmailChangeRequestInput,
} from "../../validators/auth/password.validators";

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body as ForgotPasswordInput;
    await requestPasswordReset(email, req);
    return ok(res, {
      message:
        "If an account exists for that email address, a password reset link has been sent.",
    });
  },
);

export const resetPasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, password } = req.body as ResetPasswordInput;
    await resetPassword(token, password, req);
    return ok(res, {
      message:
        "Password has been reset. Please sign in with your new password.",
    });
  },
);

export const changePasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new UnauthorizedError();
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const { prisma } = await import("../../config/database");
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
    });
    if (!user) throw new UnauthorizedError("Account no longer exists.");
    await changePassword(user, currentPassword, newPassword);
    return noContent(res);
  },
);

export const requestEmailChangeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new UnauthorizedError();
    const { newEmail } = req.body as EmailChangeRequestInput;
    const { prisma } = await import("../../config/database");
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
    });
    if (!user) throw new UnauthorizedError("Account no longer exists.");
    await requestEmailChange(user, newEmail);
    return ok(res, {
      message: "A confirmation email has been sent to the new address.",
    });
  },
);

export const confirmEmailChangeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body as EmailChangeConfirmInput;
    const result = await confirmEmailChange(token);
    return ok(res, { email: result.email, message: "Email address updated." });
  },
);
