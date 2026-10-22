import { z } from "zod";

export const enrollMfaSchema = z.object({
  label: z.string().trim().max(60).optional(),
});

export const verifyEnrollmentSchema = z.object({
  code: z.string().trim().min(6, "Verification code is required.").max(12),
});

export const verifyChallengeSchema = z.object({
  mfaToken: z.string().min(20, "MFA challenge token is required."),
  code: z.string().trim().min(6, "Verification code is required.").max(12),
});

export const disableMfaSchema = z.object({
  password: z.string().min(1, "Password is required.").max(256),
  code: z.string().trim().min(6, "Verification code is required.").max(12),
});

export const regenerateRecoveryCodesSchema = z.object({
  password: z.string().min(1, "Password is required.").max(256),
});

export type EnrollMfaInput = z.infer<typeof enrollMfaSchema>;
export type VerifyEnrollmentInput = z.infer<typeof verifyEnrollmentSchema>;
export type VerifyChallengeInput = z.infer<typeof verifyChallengeSchema>;
export type DisableMfaInput = z.infer<typeof disableMfaSchema>;
