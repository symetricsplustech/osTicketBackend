import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

async function promptQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function validatePassword(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 12) issues.push('at least 12 characters');
  if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
  if (!/\d/.test(password)) issues.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('a symbol');
  return issues;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email ?? (await promptQuestion('Platform owner email: '))).trim().toLowerCase();
  const password = args.password ?? (await promptQuestion('Platform owner password: '));
  const firstName = args.first ?? (await promptQuestion('First name: ')) ?? 'Platform';
  const lastName = args.last ?? (await promptQuestion('Last name: ')) ?? 'Owner';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('A valid email address is required (use --email).');
  }
  const passwordIssues = validatePassword(password);
  if (passwordIssues.length > 0) {
    throw new Error(`Password must contain ${passwordIssues.join(', ')}.`);
  }

  const ownerRole = await prisma.platformRole.findUnique({ where: { key: 'platform-owner' } });
  if (!ownerRole) {
    throw new Error('System roles are not seeded. Run `pnpm run db:seed` first.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      firstName: firstName.trim() || 'Platform',
      lastName: lastName.trim() || 'Owner',
      userType: 'PLATFORM_STAFF',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
    },
    update: {
      passwordHash,
      userType: 'PLATFORM_STAFF',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.staffRoleAssignment.upsert({
    where: { userId_roleId: { userId: user.id, roleId: ownerRole.id } },
    create: { userId: user.id, roleId: ownerRole.id },
    update: {},
  });

  // eslint-disable-next-line no-console
  console.log(`Platform owner ready: ${user.email} (id: ${user.id}) with role "${ownerRole.name}".`);
  // eslint-disable-next-line no-console
  console.log('Sign in at the admin application and enable MFA immediately.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Bootstrap failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
