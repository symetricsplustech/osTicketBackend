import { AppError } from '../errors';
import { passwordPolicy } from '../../config/security';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

export function validatePasswordStrength(password: string): void {
  const issues: string[] = [];
  if (password.length < passwordPolicy.minLength) {
    issues.push(`Password must be at least ${passwordPolicy.minLength} characters long.`);
  }
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter.');
  }
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter.');
  }
  if (passwordPolicy.requireNumber && !/\d/.test(password)) {
    issues.push('Password must contain at least one number.');
  }
  if (passwordPolicy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    issues.push('Password must contain at least one symbol.');
  }
  if (issues.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Password does not meet the security policy.', {
      details: issues.map((message) => ({ field: 'password', message })),
    });
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}
