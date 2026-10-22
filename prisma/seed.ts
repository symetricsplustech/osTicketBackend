import {
  PrismaClient,
  type Prisma,
  CertificateStatus,
  DomainStatus,
  DomainType,
  ProvisioningStatus,
  SupportTicketPriority,
  SupportTicketStatus,
  TenantStatus,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_TEMPLATES,
  ALL_PERMISSION_CODES,
} from "../src/shared/permissions/catalog";
import {
  syncTenantPermissions,
  ensureTenantSystemRoles,
} from "../src/shared/permissions/tenant-sync";
import {
  ITSM_MODULE_KEYS,
  NOTIFICATION_EVENT_KEYS,
  SETTING_KEYS,
} from "../src/shared/constants";
import { encryptSecret } from "../src/shared/encryption";
import {
  generateApiKey,
  randomToken,
  sha256,
} from "../src/shared/utils/crypto";

const prisma = new PrismaClient();

const MODULE_NAMES: Record<string, string> = {
  incident: "Incident Management",
  problem: "Problem Management",
  change: "Change Management",
  request: "Request Management",
  "service-catalog": "Service Catalog",
  knowledge: "Knowledge Management",
  sla: "Service Level Management",
  asset: "Asset Management",
  cmdb: "Configuration Management Database",
  release: "Release Management",
  task: "Task Management",
  approval: "Approvals",
  workflow: "Workflow Automation",
  notification: "Notifications",
  report: "Reporting",
  "on-call": "On-Call Scheduling",
  team: "Team Management",
  vendor: "Vendor Management",
  "employee-center": "Employee Center",
  discovery: "Discovery",
};

const DEFAULT_MODULE_SETTINGS: Record<string, Record<string, unknown>> = {
  incident: { autoCloseResolvedAfterDays: 7, enableMajorIncidentProcess: true },
  problem: { requireRootCause: true, linkIncidents: true },
  change: { requireCABApproval: true, defaultRiskLevel: "MEDIUM" },
  request: { requireApprovalByDefault: false, allowRequesterCancel: true },
  "service-catalog": { showPrices: false, allowRatings: true },
  knowledge: { requireReview: true, reviewIntervalDays: 180 },
  sla: { businessHoursOnly: true, pauseOnPending: true },
  asset: { requireAssetTag: true, depreciationMethod: "STRAIGHT_LINE" },
  cmdb: { enforceRelationshipRules: true, discoveryEnabled: false },
  release: { requireApproval: true },
  task: { allowSubTasks: true },
  approval: { minApprovals: 1, allowSelfApproval: false },
  workflow: { maxConcurrentRunsPerRecord: 1 },
  notification: { digestFrequency: "INSTANT" },
  report: { defaultFormat: "CSV", maxExportRows: 50000 },
  "on-call": { escalationTimeoutMinutes: 15 },
  team: { allowCrossTeamAssignment: false },
  vendor: { requireContractExpiryAlerts: true },
  "employee-center": { showAnnouncements: true },
  discovery: { schedule: "DAILY", mode: "AGENTLESS" },
};

const PRIORITIES = [
  {
    key: "critical",
    name: "Critical",
    rank: 1,
    color: "#dc2626",
    isDefault: false,
  },
  { key: "high", name: "High", rank: 2, color: "#ea580c", isDefault: false },
  { key: "medium", name: "Medium", rank: 3, color: "#ca8a04", isDefault: true },
  { key: "low", name: "Low", rank: 4, color: "#16a34a", isDefault: false },
  {
    key: "planning",
    name: "Planning",
    rank: 5,
    color: "#64748b",
    isDefault: false,
  },
];

const STATUS_SETS: {
  moduleKey: string;
  statuses: {
    key: string;
    name: string;
    category: string;
    color: string;
    isDefault?: boolean;
  }[];
}[] = [
  {
    moduleKey: "global",
    statuses: [
      {
        key: "open",
        name: "Open",
        category: "OPEN",
        color: "#2563eb",
        isDefault: true,
      },
      {
        key: "in-progress",
        name: "In Progress",
        category: "OPEN",
        color: "#7c3aed",
      },
      {
        key: "pending",
        name: "Pending",
        category: "PENDING",
        color: "#d97706",
      },
      {
        key: "resolved",
        name: "Resolved",
        category: "RESOLVED",
        color: "#16a34a",
      },
      { key: "closed", name: "Closed", category: "CLOSED", color: "#475569" },
    ],
  },
  {
    moduleKey: "change",
    statuses: [
      {
        key: "draft",
        name: "Draft",
        category: "OPEN",
        color: "#64748b",
        isDefault: true,
      },
      {
        key: "assessment",
        name: "Assessment",
        category: "OPEN",
        color: "#2563eb",
      },
      {
        key: "approval",
        name: "Awaiting Approval",
        category: "PENDING",
        color: "#d97706",
      },
      {
        key: "scheduled",
        name: "Scheduled",
        category: "OPEN",
        color: "#7c3aed",
      },
      {
        key: "implementing",
        name: "Implementing",
        category: "OPEN",
        color: "#0891b2",
      },
      {
        key: "review",
        name: "Post-Implementation Review",
        category: "PENDING",
        color: "#db2777",
      },
      { key: "closed", name: "Closed", category: "CLOSED", color: "#475569" },
    ],
  },
];

const NUMBERING_RULES = [
  { moduleKey: "incident", prefix: "INC", padding: 6 },
  { moduleKey: "problem", prefix: "PRB", padding: 6 },
  { moduleKey: "change", prefix: "CHG", padding: 6 },
  { moduleKey: "request", prefix: "REQ", padding: 6 },
  { moduleKey: "task", prefix: "TSK", padding: 6 },
  { moduleKey: "release", prefix: "REL", padding: 5 },
  { moduleKey: "asset", prefix: "AST", padding: 7 },
  { moduleKey: "knowledge", prefix: "KB", padding: 5 },
];

const SERVICE_CATEGORIES = [
  {
    key: "it-support",
    name: "IT Support",
    description: "General IT support and service desk offerings.",
  },
  {
    key: "infrastructure",
    name: "Infrastructure",
    description: "Compute, network and platform services.",
  },
  {
    key: "applications",
    name: "Applications",
    description: "Business application services.",
  },
];

const SERVICE_DEFINITIONS = [
  {
    key: "incident-management",
    name: "Incident Management",
    categoryKey: "it-support",
    description: "Report and resolve service disruptions.",
  },
  {
    key: "request-fulfillment",
    name: "Request Fulfillment",
    categoryKey: "it-support",
    description: "Standard service requests and approvals.",
  },
  {
    key: "change-management",
    name: "Change Management",
    categoryKey: "infrastructure",
    description: "Controlled change with risk and CAB review.",
  },
  {
    key: "problem-management",
    name: "Problem Management",
    categoryKey: "infrastructure",
    description: "Root cause analysis and known errors.",
  },
  {
    key: "knowledge-management",
    name: "Knowledge Management",
    categoryKey: "applications",
    description: "Articles, reviews and knowledge governance.",
  },
  {
    key: "asset-management",
    name: "Asset Management",
    categoryKey: "applications",
    description: "Asset lifecycle, inventory and cost tracking.",
  },
];

const NOTIFICATION_TEMPLATES = [
  {
    key: "staff-invitation",
    name: "Staff Invitation",
    description: "Invitation email sent to new platform staff.",
    subject: "You have been invited to {{platformName}}",
    body: '<p>Hello {{firstName}},</p><p>{{invitedBy}} invited you to join the platform. Accept your invitation here:</p><p><a href="{{acceptUrl}}">Accept invitation</a></p>',
  },
  {
    key: "password-reset",
    name: "Password Reset",
    description: "Password reset email for platform staff.",
    subject: "Reset your {{platformName}} password",
    body: '<p>Hello {{firstName}},</p><p>Reset your password using the link below. It expires in {{expiresMinutes}} minutes.</p><p><a href="{{resetUrl}}">Reset password</a></p>',
  },
  {
    key: "tenant-provisioning-failed",
    name: "Tenant Provisioning Failed",
    description:
      "Alert sent to platform operators when tenant provisioning fails.",
    subject: "Provisioning failed for {{tenantName}}",
    body: "<p>Provisioning for <strong>{{tenantName}}</strong> failed.</p><p>Error: {{error}}</p><p>Review and retry from the tenant provisioning screen.</p>",
  },
  {
    key: "support-ticket-created",
    name: "Support Ticket Created",
    description:
      "Acknowledgement sent when a platform support ticket is created.",
    subject: "Support ticket {{ticketNumber}} received",
    body: "<p>Hello {{requesterName}},</p><p>Your support ticket <strong>{{ticketNumber}}</strong> has been received: {{subject}}</p>",
  },
];

const FEATURE_FLAGS = [
  {
    key: "tenant-self-service-provisioning",
    name: "Tenant Self-Service Provisioning",
    description: "Allow tenants to trigger their own provisioning retries.",
    isEnabled: false,
    rolloutPercentage: 0,
  },
  {
    key: "advanced-workflow-engine",
    name: "Advanced Workflow Engine",
    description: "Enable the extended workflow node types.",
    isEnabled: true,
    rolloutPercentage: 100,
  },
  {
    key: "audit-streaming",
    name: "Audit Streaming",
    description: "Stream audit events to subscribed webhooks in real time.",
    isEnabled: true,
    rolloutPercentage: 100,
  },
  {
    key: "discovery-agent",
    name: "Discovery Agent",
    description: "Enable agent-based discovery profiles.",
    isEnabled: false,
    rolloutPercentage: 25,
  },
];

interface DemoContactSeed {
  firstName: string;
  lastName: string;
  email: string;
  role: "PRIMARY" | "TECHNICAL" | "BILLING" | "AUTHORIZED";
  jobTitle?: string;
  isPrimary?: boolean;
  portalStatus: "NONE" | "INVITED" | "ACTIVE" | "REVOKED";
}

interface DemoSiteSeed {
  name: string;
  code: string;
  siteType: "SITE" | "DATA_CENTER" | "OFFICE";
  isDataCenter?: boolean;
  city?: string;
  country?: string;
}

interface DemoCustomerSeed {
  code: string;
  name: string;
  industry: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  description: string;
  isDataCenter: boolean;
  contacts: DemoContactSeed[];
  sites: DemoSiteSeed[];
}

/** Demo customer directory for the seeded organization (idempotent by code). */
const DEMO_CUSTOMERS: DemoCustomerSeed[] = [
  {
    code: "NDC-001",
    name: "Northwind Data Centers",
    industry: "Data Center & Hosting",
    city: "Ashburn",
    country: "United States",
    email: "noc@northwind-dc.example",
    phone: "+1 703 555 0121",
    description:
      "Colocation and managed hosting provider operating two data centers in Ashburn.",
    isDataCenter: true,
    contacts: [
      {
        firstName: "Ravi",
        lastName: "Sharma",
        email: "ravi.sharma@northwind-dc.example",
        role: "PRIMARY",
        jobTitle: "Infrastructure Manager",
        isPrimary: true,
        portalStatus: "ACTIVE",
      },
      {
        firstName: "Elena",
        lastName: "Petrova",
        email: "elena.petrova@northwind-dc.example",
        role: "TECHNICAL",
        jobTitle: "Network Lead",
        portalStatus: "INVITED",
      },
    ],
    sites: [
      {
        name: "Ashburn DC1",
        code: "NDC-IAD1",
        siteType: "DATA_CENTER",
        isDataCenter: true,
        city: "Ashburn",
        country: "United States",
      },
      {
        name: "Ashburn DC2",
        code: "NDC-IAD2",
        siteType: "DATA_CENTER",
        isDataCenter: true,
        city: "Ashburn",
        country: "United States",
      },
    ],
  },
  {
    code: "CCS-002",
    name: "Contoso Cloud Services",
    industry: "Cloud & SaaS",
    city: "Dublin",
    country: "Ireland",
    email: "support@contoso-cloud.example",
    phone: "+353 1 555 0144",
    description:
      "European SaaS provider hosting customer workloads in a Dublin data center campus.",
    isDataCenter: true,
    contacts: [
      {
        firstName: "Aoife",
        lastName: "Byrne",
        email: "aoife.byrne@contoso-cloud.example",
        role: "PRIMARY",
        jobTitle: "Head of Platform",
        isPrimary: true,
        portalStatus: "ACTIVE",
      },
      {
        firstName: "Liam",
        lastName: "Nolan",
        email: "liam.nolan@contoso-cloud.example",
        role: "BILLING",
        jobTitle: "Finance Manager",
        portalStatus: "NONE",
      },
    ],
    sites: [
      {
        name: "Dublin Campus A",
        code: "CCS-DUB1",
        siteType: "DATA_CENTER",
        isDataCenter: true,
        city: "Dublin",
        country: "Ireland",
      },
    ],
  },
  {
    code: "FFS-003",
    name: "Fabrikam Financial",
    industry: "Financial Services",
    city: "Singapore",
    country: "Singapore",
    email: "it.ops@fabrikam-fin.example",
    phone: "+65 6555 0177",
    description:
      "Regional financial services firm with strict data residency and audit requirements.",
    isDataCenter: false,
    contacts: [
      {
        firstName: "Wei",
        lastName: "Tan",
        email: "wei.tan@fabrikam-fin.example",
        role: "PRIMARY",
        jobTitle: "IT Operations Lead",
        isPrimary: true,
        portalStatus: "INVITED",
      },
    ],
    sites: [
      {
        name: "Singapore HQ",
        code: "FFS-SG1",
        siteType: "OFFICE",
        city: "Singapore",
        country: "Singapore",
      },
      {
        name: "Singapore DR Suite",
        code: "FFS-SG2",
        siteType: "DATA_CENTER",
        isDataCenter: true,
        city: "Singapore",
        country: "Singapore",
      },
    ],
  },
];

interface DemoIncidentSeed {
  number: string;
  customerCode: string;
  title: string;
  description: string;
  statusKey: string;
  priorityKey: string;
  impact: string;
  urgency: string;
}

/** Demo incidents linking customers to the ticket workflow (idempotent by number). */
const DEMO_INCIDENTS: DemoIncidentSeed[] = [
  {
    number: "INC-000001",
    customerCode: "NDC-001",
    title: "Cooling unit alert in Ashburn DC1",
    description:
      "CRAC unit B in row 4 reported elevated intake temperature. Remote diagnostics started; field verification may be required.",
    statusKey: "in-progress",
    priorityKey: "critical",
    impact: "HIGH",
    urgency: "HIGH",
  },
  {
    number: "INC-000002",
    customerCode: "CCS-002",
    title: "Remote access latency for platform team",
    description:
      "Platform engineers report intermittent latency above 200ms when accessing the Dublin campus over VPN.",
    statusKey: "open",
    priorityKey: "medium",
    impact: "MEDIUM",
    urgency: "MEDIUM",
  },
  {
    number: "INC-000003",
    customerCode: "FFS-003",
    title: "DR suite network verification follow-up",
    description:
      "Post-change verification for the Singapore DR suite core switch configuration. Awaiting customer maintenance window.",
    statusKey: "pending",
    priorityKey: "high",
    impact: "MEDIUM",
    urgency: "HIGH",
  },
];

export async function seed(): Promise<void> {
  // Permissions
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description,
      },
      update: {
        name: permission.name,
        module: permission.module,
        description: permission.description,
      },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permissionIndex = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  // System roles
  for (const template of SYSTEM_ROLE_TEMPLATES) {
    const role = await prisma.platformRole.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        isSystem: true,
      },
      update: {
        name: template.name,
        description: template.description,
        isSystem: true,
      },
    });
    const codes =
      template.permissions === "*"
        ? ALL_PERMISSION_CODES
        : template.permissions;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes
        .filter((code) => permissionIndex.has(code))
        .map((code) => ({
          roleId: role.id,
          permissionId: permissionIndex.get(code)!,
        })),
      skipDuplicates: true,
    });
  }

  // Tenant (Organization Admin) permission catalog — dynamic, DB-authoritative.
  await syncTenantPermissions(prisma);

  // ITSM module configuration
  for (const moduleKey of ITSM_MODULE_KEYS) {
    await prisma.itsmModuleConfig.upsert({
      where: { moduleKey },
      create: {
        moduleKey,
        name: MODULE_NAMES[moduleKey] ?? moduleKey,
        description: `${MODULE_NAMES[moduleKey] ?? moduleKey} configuration defaults.`,
        defaultSettings: (DEFAULT_MODULE_SETTINGS[moduleKey] ??
          {}) as Prisma.InputJsonValue,
      },
      update: { name: MODULE_NAMES[moduleKey] ?? moduleKey },
    });
  }

  // Priorities
  for (const priority of PRIORITIES) {
    await prisma.priorityDefinition.upsert({
      where: { key: priority.key },
      create: priority,
      update: {
        name: priority.name,
        rank: priority.rank,
        color: priority.color,
        isDefault: priority.isDefault,
      },
    });
  }

  // Statuses
  for (const set of STATUS_SETS) {
    for (const [index, status] of set.statuses.entries()) {
      await prisma.statusDefinition.upsert({
        where: { moduleKey_key: { moduleKey: set.moduleKey, key: status.key } },
        create: {
          moduleKey: set.moduleKey,
          key: status.key,
          name: status.name,
          category: status.category,
          color: status.color,
          sortOrder: index,
          isDefault: status.isDefault ?? false,
        },
        update: {
          name: status.name,
          category: status.category,
          color: status.color,
          sortOrder: index,
          isDefault: status.isDefault ?? false,
        },
      });
    }
  }

  // Numbering rules
  for (const rule of NUMBERING_RULES) {
    await prisma.numberingRule.upsert({
      where: { moduleKey: rule.moduleKey },
      create: {
        moduleKey: rule.moduleKey,
        prefix: rule.prefix,
        padding: rule.padding,
        nextNumber: 1,
      },
      update: { prefix: rule.prefix, padding: rule.padding, isActive: true },
    });
  }

  // Default business calendar
  const existingCalendar = await prisma.businessCalendar.findFirst({
    where: { isDefault: true },
  });
  if (!existingCalendar) {
    await prisma.businessCalendar.create({
      data: {
        name: "Standard Business Hours",
        timezone: "UTC",
        isDefault: true,
        workingHours: {
          monday: [{ start: "09:00", end: "18:00" }],
          tuesday: [{ start: "09:00", end: "18:00" }],
          wednesday: [{ start: "09:00", end: "18:00" }],
          thursday: [{ start: "09:00", end: "18:00" }],
          friday: [{ start: "09:00", end: "18:00" }],
          saturday: [],
          sunday: [],
        },
        holidays: [],
      },
    });
  }

  // Knowledge policy default
  const knowledgePolicy = await prisma.knowledgePolicy.findFirst();
  if (!knowledgePolicy) {
    await prisma.knowledgePolicy.create({
      data: {
        name: "Default Knowledge Governance",
        description: "Baseline knowledge governance for all tenants.",
        settings: {
          requireApproval: true,
          reviewIntervalDays: 180,
          tenantAuthoring: true,
        },
      },
    });
  }

  // Support queue default
  const supportQueue = await prisma.supportQueue.findFirst({
    where: { isDefault: true },
  });
  if (!supportQueue) {
    await prisma.supportQueue.create({
      data: {
        name: "Platform Support",
        description: "General platform support queue.",
        isDefault: true,
      },
    });
  }

  // Notification templates
  for (const template of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        channel: "EMAIL",
        subject: template.subject,
        body: template.body,
        bodyFormat: "HTML",
        status: "ENABLED",
        variables: [],
      },
      update: {
        name: template.name,
        description: template.description,
        subject: template.subject,
        body: template.body,
      },
    });
  }

  // Feature flags
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { name: flag.name, description: flag.description },
    });
  }

  // Platform settings baseline
  const settings: {
    key: string;
    value: Prisma.InputJsonValue;
    group: string;
    description: string;
  }[] = [
    {
      key: SETTING_KEYS.PLATFORM_NAME,
      value: "ITSM SaaS Platform",
      group: "general",
      description: "Display name of the platform.",
    },
    {
      key: SETTING_KEYS.PLATFORM_SUPPORT_EMAIL,
      value: "support@example.com",
      group: "general",
      description: "Support contact email.",
    },
  ];
  for (const setting of settings) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }

  // Baseline service catalog
  const categoryIndex = new Map<string, string>();
  for (const category of SERVICE_CATEGORIES) {
    const record = await prisma.serviceCategory.findFirst({
      where: { name: category.name },
    });
    if (record) {
      categoryIndex.set(category.key, record.id);
    } else {
      const created = await prisma.serviceCategory.create({
        data: { name: category.name, description: category.description },
      });
      categoryIndex.set(category.key, created.id);
    }
  }
  for (const service of SERVICE_DEFINITIONS) {
    await prisma.serviceDefinition.upsert({
      where: { key: service.key },
      create: {
        key: service.key,
        name: service.name,
        description: service.description,
        categoryId: categoryIndex.get(service.categoryKey) ?? null,
        status: "ENABLED",
      },
      update: {
        name: service.name,
        description: service.description,
        status: "ENABLED",
      },
    });
  }

  // Notification rules baseline for key security events
  const rules = [
    {
      name: "Invitation delivery",
      eventKey: "auth.invitation",
      templateKey: "staff-invitation",
    },
    {
      name: "Password reset delivery",
      eventKey: "auth.password.reset",
      templateKey: "password-reset",
    },
    {
      name: "Provisioning failure alert",
      eventKey: "tenant.provisioning.failed",
      templateKey: "tenant-provisioning-failed",
    },
    {
      name: "Support ticket acknowledgement",
      eventKey: "support.ticket.created",
      templateKey: "support-ticket-created",
    },
  ];
  for (const rule of rules) {
    const existing = await prisma.notificationRule.findFirst({
      where: { name: rule.name },
    });
    if (!existing) {
      const template = await prisma.notificationTemplate.findUnique({
        where: { key: rule.templateKey },
      });
      await prisma.notificationRule.create({
        data: {
          name: rule.name,
          eventKey: rule.eventKey,
          channel: "EMAIL",
          templateId: template?.id ?? null,
          recipients: {},
          isEnabled: true,
        },
      });
    }
  }

  // Default platform-owner credential (idempotent; override via SEED_ADMIN_* env vars).
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? "platform.owner@example.com"
  )
    .trim()
    .toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Platform#2026Aa!";
  const ownerRole = await prisma.platformRole.findUnique({
    where: { key: "platform-owner" },
  });
  if (adminEmail && adminPassword && ownerRole) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        passwordHash,
        firstName: process.env.SEED_ADMIN_FIRST_NAME ?? "Platform",
        lastName: process.env.SEED_ADMIN_LAST_NAME ?? "Owner",
        userType: "PLATFORM_STAFF",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        mfaEnabled: false,
      },
      update: {
        passwordHash,
        userType: "PLATFORM_STAFF",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.staffRoleAssignment.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: ownerRole.id } },
      create: { userId: admin.id, roleId: ownerRole.id },
      update: {},
    });
    // eslint-disable-next-line no-console
    console.log(
      `Seeded platform-owner credential: ${admin.email} (role "${ownerRole.name}").`,
    );
  }

  // Default organization admin credential for the demo tenant (idempotent;
  // override via SEED_ORG_ADMIN_* env vars).
  const orgName = (process.env.SEED_ORG_NAME ?? "ACME Technologies").trim();
  const orgSlug = (process.env.SEED_ORG_SLUG ?? "acme-technologies")
    .trim()
    .toLowerCase();
  const orgAdminEmail = (
    process.env.SEED_ORG_ADMIN_EMAIL ?? "admin@acmetech.io"
  )
    .trim()
    .toLowerCase();
  const orgAdminPassword =
    process.env.SEED_ORG_ADMIN_PASSWORD ?? "OrgAdmin@123";
  if (orgName && orgSlug && orgAdminEmail && orgAdminPassword) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: orgSlug },
      create: {
        name: orgName,
        slug: orgSlug,
        status: "ACTIVE",
        provisioningStatus: "COMPLETED",
        provisionedAt: new Date(),
        activatedAt: new Date(),
        primaryContactName: process.env.SEED_ORG_CONTACT_NAME ?? "Ava Mehta",
        primaryContactEmail: orgAdminEmail,
        timezone: "UTC",
        locale: "en-US",
        industry: "Technology",
      },
      update: { name: orgName, status: "ACTIVE" },
    });

    await ensureTenantSystemRoles(prisma, tenant.id);

    const orgAdminPasswordHash = await bcrypt.hash(orgAdminPassword, 12);
    const orgAdmin = await prisma.user.upsert({
      where: { email: orgAdminEmail },
      create: {
        email: orgAdminEmail,
        passwordHash: orgAdminPasswordHash,
        firstName: process.env.SEED_ORG_ADMIN_FIRST_NAME ?? "Ava",
        lastName: process.env.SEED_ORG_ADMIN_LAST_NAME ?? "Mehta",
        displayName: "Ava Mehta",
        jobTitle: "Organization Administrator",
        userType: "TENANT_USER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        mfaEnabled: false,
      },
      update: {
        passwordHash: orgAdminPasswordHash,
        userType: "TENANT_USER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    const membership = await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: orgAdmin.id } },
      create: {
        tenantId: tenant.id,
        userId: orgAdmin.id,
        roleKey: "org-admin",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      update: { roleKey: "org-admin", status: "ACTIVE" },
    });

    const orgAdminRole = await prisma.tenantRole.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: "org-admin" } },
    });
    if (orgAdminRole) {
      await prisma.tenantUserRole.upsert({
        where: {
          membershipId_tenantRoleId: {
            membershipId: membership.id,
            tenantRoleId: orgAdminRole.id,
          },
        },
        create: {
          tenantId: tenant.id,
          membershipId: membership.id,
          tenantRoleId: orgAdminRole.id,
        },
        update: {},
      });
    }
    // eslint-disable-next-line no-console
    console.log(
      `Seeded organization-admin credential: ${orgAdmin.email} in "${tenant.name}" (role "${orgAdminRole?.name ?? "org-admin"}", tenant ${tenant.id}).`,
    );

    // --- Role-based tenant users for full lifecycle testing ----------------
    const roleUsers: {
      email: string;
      firstName: string;
      lastName: string;
      jobTitle: string;
      roleKey: string;
    }[] = [
      {
        email: "ops.employee@acmetech.io",
        firstName: "Operations",
        lastName: "Employee",
        jobTitle: "Service Desk Agent",
        roleKey: "itsm-agent",
      },
      {
        email: "team.lead@acmetech.io",
        firstName: "Team",
        lastName: "Lead",
        jobTitle: "Team Lead",
        roleKey: "itsm-manager",
      },
      {
        email: "ops.manager@acmetech.io",
        firstName: "Operations",
        lastName: "Manager",
        jobTitle: "Operations Manager",
        roleKey: "itsm-manager",
      },
      {
        email: "remote.engineer@acmetech.io",
        firstName: "Remote",
        lastName: "Engineer",
        jobTitle: "Remote Engineer",
        roleKey: "remote-engineer",
      },
      {
        email: "field.engineer@acmetech.io",
        firstName: "Field",
        lastName: "Engineer",
        jobTitle: "Field Engineer",
        roleKey: "field-engineer",
      },
    ];

    for (const ru of roleUsers) {
      const passwordHash = await bcrypt.hash(
        ru.email.split("@")[0] + "@123",
        12,
      );
      const user = await prisma.user.upsert({
        where: { email: ru.email },
        create: {
          email: ru.email,
          passwordHash,
          firstName: ru.firstName,
          lastName: ru.lastName,
          jobTitle: ru.jobTitle,
          userType: "TENANT_USER",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          mfaEnabled: false,
          createdById: orgAdmin.id,
        },
        update: {
          passwordHash,
          userType: "TENANT_USER",
          status: "ACTIVE",
        },
      });

      const membership = await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          roleKey: ru.roleKey,
          status: "ACTIVE",
          joinedAt: new Date(),
          invitedById: orgAdmin.id,
        },
        update: { roleKey: ru.roleKey, status: "ACTIVE" },
      });

      const tenantRole = await prisma.tenantRole.findUnique({
        where: { tenantId_key: { tenantId: tenant.id, key: ru.roleKey } },
      });
      if (tenantRole) {
        await prisma.tenantUserRole.upsert({
          where: {
            membershipId_tenantRoleId: {
              membershipId: membership.id,
              tenantRoleId: tenantRole.id,
            },
          },
          create: {
            tenantId: tenant.id,
            membershipId: membership.id,
            tenantRoleId: tenantRole.id,
          },
          update: {},
        });
      }
      // eslint-disable-next-line no-console
      console.log(
        `Seeded tenant user: ${ru.email} (role "${ru.roleKey}", tenant ${tenant.id}).`,
      );
    }

    // Demo customer directory: customers, contacts, sites and linked tickets.
    const customerIdByCode = new Map<string, string>();
    for (const demo of DEMO_CUSTOMERS) {
      let customer = await prisma.customer.findFirst({
        where: { tenantId: tenant.id, code: demo.code },
        select: { id: true },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            tenantId: tenant.id,
            name: demo.name,
            code: demo.code,
            status: "ACTIVE",
            type: "COMPANY",
            industry: demo.industry,
            email: demo.email,
            phone: demo.phone,
            description: demo.description,
            city: demo.city,
            country: demo.country,
            isDataCenter: demo.isDataCenter,
            createdById: orgAdmin.id,
          },
          select: { id: true },
        });
      }
      customerIdByCode.set(demo.code, customer.id);

      for (const contact of demo.contacts) {
        const existing = await prisma.customerContact.findFirst({
          where: { customerId: customer.id, email: contact.email },
          select: { id: true },
        });
        if (!existing) {
          await prisma.customerContact.create({
            data: {
              tenantId: tenant.id,
              customerId: customer.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email,
              role: contact.role,
              jobTitle: contact.jobTitle ?? null,
              isPrimary: contact.isPrimary ?? false,
              portalStatus: contact.portalStatus,
              invitedAt:
                contact.portalStatus === "INVITED" ||
                contact.portalStatus === "ACTIVE"
                  ? new Date()
                  : null,
              portalActivatedAt:
                contact.portalStatus === "ACTIVE" ? new Date() : null,
              createdById: orgAdmin.id,
            },
          });
        }
      }

      for (const site of demo.sites) {
        const existing = await prisma.customerSite.findFirst({
          where: { customerId: customer.id, code: site.code },
          select: { id: true },
        });
        if (!existing) {
          await prisma.customerSite.create({
            data: {
              tenantId: tenant.id,
              customerId: customer.id,
              name: site.name,
              code: site.code,
              siteType: site.siteType,
              isDataCenter: site.isDataCenter ?? false,
              city: site.city ?? null,
              country: site.country ?? null,
              createdById: orgAdmin.id,
            },
          });
        }
      }

      // Link customer portal contact to Northwind DC1
      const northwindCustomer = customerIdByCode.get("NDC-001");
      if (northwindCustomer) {
        const customerContactEmail = "ravi.sharma@northwind-dc.example";
        const customerContactPasswordHash = await bcrypt.hash(
          "Customer@123",
          12,
        );
        await prisma.user.upsert({
          where: { email: customerContactEmail },
          create: {
            email: customerContactEmail,
            passwordHash: customerContactPasswordHash,
            firstName: "Ravi",
            lastName: "Sharma",
            jobTitle: "Infrastructure Manager",
            userType: "TENANT_USER",
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
            mfaEnabled: false,
            createdById: orgAdmin.id,
          },
          update: {
            passwordHash: customerContactPasswordHash,
            userType: "TENANT_USER",
            status: "ACTIVE",
          },
        });

        await prisma.customerContact.upsert({
          where: { customerId_email: { customerId: northwindCustomer, email: "ravi.sharma@northwind-dc.example" } },
          create: {
            tenantId: tenant.id,
            customerId: northwindCustomer,
            firstName: "Ravi",
            lastName: "Sharma",
            email: "ravi.sharma@northwind-dc.example",
            role: "PRIMARY",
            jobTitle: "Infrastructure Manager",
            isPrimary: true,
            portalStatus: "ACTIVE",
            portalActivatedAt: new Date(),
            invitedAt: new Date(),
            createdById: orgAdmin.id,
          },
          update: { portalStatus: "ACTIVE", portalActivatedAt: new Date() },
        });
        // eslint-disable-next-line no-console
        console.log(
          `Seeded customer portal contact: ravi.sharma@northwind-dc.example (customer NDC-001, tenant ${tenant.id}).`,
        );
      }

      // Seed support teams for auto-assignment by category.
      const teamNames = ["Network Team", "Server Team", "Hardware Team", "Software Team"];
      for (const teamName of teamNames) {
        const code = teamName.replace(/\s+/g, "-").toUpperCase();
        const existing = await prisma.team.findFirst({
          where: { tenantId: tenant.id, code, deletedAt: null },
        });
        if (!existing) {
          await prisma.team.create({
            data: {
              tenantId: tenant.id,
              name: teamName,
              code,
              description: `Support team for ${teamName.toLowerCase()}.`,
              status: "ACTIVE",
              createdById: orgAdmin.id,
            },
          });
        }
      }

      const incidentCount = await prisma.incident.count({
      where: { tenantId: tenant.id },
    });
    if (incidentCount === 0) {
      for (const demo of DEMO_INCIDENTS) {
        const customerId = customerIdByCode.get(demo.customerCode);
        await prisma.incident.create({
          data: {
            tenantId: tenant.id,
            number: demo.number,
            title: demo.title,
            description: demo.description,
            statusKey: demo.statusKey,
            priorityKey: demo.priorityKey,
            impact: demo.impact,
            urgency: demo.urgency,
            source: "SERVICE_DESK",
            channel: "PHONE",
            callerId: orgAdmin.id,
            customerId: customerId ?? null,
            createdById: orgAdmin.id,
          },
        });
      }
      // eslint-disable-next-line no-console
      console.log(
        `Seeded ${DEMO_INCIDENTS.length} demo incidents for "${tenant.name}".`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `Seeded ${DEMO_CUSTOMERS.length} demo customers (contacts, sites) for "${tenant.name}".`,
    );
  }

  // Protected tenant system roles for every existing organization.
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  for (const tenant of tenants) {
    await ensureTenantSystemRoles(prisma, tenant.id);
  }

  if (process.env.SEED_DEMO_DATA === "false") {
    // eslint-disable-next-line no-console
    console.log("Demo data seeding skipped (SEED_DEMO_DATA=false).");
  } else {
    await seedDemoData();
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete: ${permissions.length} permissions, ${SYSTEM_ROLE_TEMPLATES.length} roles, ${ITSM_MODULE_KEYS.length} ITSM modules.`,
  );
}

}

async function seedDemoData(): Promise<void> {
  const demoTenants: {
    slug: string;
    name: string;
    status: TenantStatus;
    provisioningStatus: ProvisioningStatus;
    industry: string;
    primaryContactName: string;
    primaryContactEmail: string;
    suspendedReason?: string;
  }[] = [
    {
      slug: "demo-globex",
      name: "Globex Industries",
      status: TenantStatus.SUSPENDED,
      provisioningStatus: ProvisioningStatus.COMPLETED,
      industry: "Manufacturing",
      primaryContactName: "Hank Scorpio",
      primaryContactEmail: "hank@globex.example.com",
      suspendedReason: "Scheduled compliance review",
    },
    {
      slug: "demo-initech",
      name: "Initech Solutions",
      status: TenantStatus.PROVISIONING,
      provisioningStatus: ProvisioningStatus.IN_PROGRESS,
      industry: "Financial Services",
      primaryContactName: "Peter Gibbons",
      primaryContactEmail: "peter@initech.example.com",
    },
  ];

  for (const tenant of demoTenants) {
    await prisma.tenant.upsert({
      where: { slug: tenant.slug },
      create: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        provisioningStatus: tenant.provisioningStatus,
        industry: tenant.industry,
        primaryContactName: tenant.primaryContactName,
        primaryContactEmail: tenant.primaryContactEmail,
        timezone: "UTC",
        locale: "en-US",
        provisionedAt: new Date(),
        ...(tenant.status === TenantStatus.ACTIVE
          ? { activatedAt: new Date() }
          : {}),
        ...(tenant.suspendedReason
          ? { suspendedAt: new Date(), suspendedReason: tenant.suspendedReason }
          : {}),
      },
      update: {
        name: tenant.name,
        status: tenant.status,
        suspendedReason: tenant.suspendedReason ?? null,
      },
    });
  }

  const orgTenant = await prisma.tenant.findUnique({
    where: {
      slug: (process.env.SEED_ORG_SLUG ?? "acme-technologies")
        .trim()
        .toLowerCase(),
    },
  });
  const globex = await prisma.tenant.findUnique({
    where: { slug: "demo-globex" },
  });
  const initech = await prisma.tenant.findUnique({
    where: { slug: "demo-initech" },
  });
  if (!orgTenant) return;

  // --- Tenant settings, configuration overrides and service assignments ----
  const tenantSettings: { key: string; value: Prisma.InputJsonValue }[] = [
    { key: "general.timezone", value: orgTenant.timezone },
    { key: "general.locale", value: orgTenant.locale },
    { key: "notifications.enabled", value: true },
    { key: "portal.selfServiceEnabled", value: true },
  ];
  for (const setting of tenantSettings) {
    await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: orgTenant.id, key: setting.key } },
      create: {
        tenantId: orgTenant.id,
        key: setting.key,
        value: setting.value,
      },
      update: {},
    });
  }
  await prisma.tenantItsmConfiguration.upsert({
    where: {
      tenantId_moduleKey: { tenantId: orgTenant.id, moduleKey: "incident" },
    },
    create: {
      tenantId: orgTenant.id,
      moduleKey: "incident",
      overrides: { autoCloseResolvedAfterDays: 5 },
    },
    update: {},
  });
  const enabledServices = await prisma.serviceDefinition.findMany({
    where: { status: "ENABLED", deletedAt: null },
    select: { id: true },
  });
  for (const service of enabledServices) {
    await prisma.tenantServiceAssignment.upsert({
      where: {
        tenantId_serviceId: { tenantId: orgTenant.id, serviceId: service.id },
      },
      create: {
        tenantId: orgTenant.id,
        serviceId: service.id,
        isEnabled: true,
      },
      update: {},
    });
  }

  // --- Tenant domains ------------------------------------------------------
  const domains: {
    tenantId: string;
    domain: string;
    type: DomainType;
    status: DomainStatus;
    certificateStatus: CertificateStatus;
    verificationToken?: string;
  }[] = [
    {
      tenantId: orgTenant.id,
      domain: "portal.acme-technologies.example.com",
      type: DomainType.SUBDOMAIN,
      status: DomainStatus.ACTIVE,
      certificateStatus: CertificateStatus.ISSUED,
    },
    {
      tenantId: orgTenant.id,
      domain: "support.acme-technologies.example.com",
      type: DomainType.CUSTOM,
      status: DomainStatus.VERIFIED,
      certificateStatus: CertificateStatus.NONE,
    },
    ...(globex
      ? [
          {
            tenantId: globex.id,
            domain: "help.globex.example.com",
            type: DomainType.CUSTOM,
            status: DomainStatus.PENDING_VERIFICATION,
            certificateStatus: CertificateStatus.NONE,
            verificationToken: "demo-verification-globex",
          },
        ]
      : []),
  ];
  for (const domain of domains) {
    await prisma.tenantDomain.upsert({
      where: { domain: domain.domain },
      create: {
        tenantId: domain.tenantId,
        domain: domain.domain,
        type: domain.type,
        status: domain.status,
        certificateStatus: domain.certificateStatus,
        verificationToken: domain.verificationToken ?? randomToken(16),
        verifiedAt:
          domain.status === DomainStatus.ACTIVE ||
          domain.status === DomainStatus.VERIFIED
            ? new Date()
            : null,
        activatedAt: domain.status === DomainStatus.ACTIVE ? new Date() : null,
      },
      update: {
        status: domain.status,
        certificateStatus: domain.certificateStatus,
      },
    });
  }
  void initech;

  // --- Service templates ---------------------------------------------------
  const incidentTemplateDefinition = {
    intake: ["summary", "description", "priority", "category"],
    defaults: { priority: "medium", category: "Hardware" },
  };
  const incidentTemplate = await prisma.serviceTemplate.upsert({
    where: { key: "incident-intake" },
    create: {
      key: "incident-intake",
      name: "Incident Intake",
      description: "Standard incident intake form and defaults.",
      status: "PUBLISHED",
      currentVersion: 1,
      definition: incidentTemplateDefinition,
    },
    update: { status: "PUBLISHED", currentVersion: 1 },
  });
  await prisma.serviceTemplateVersion.upsert({
    where: {
      templateId_version: { templateId: incidentTemplate.id, version: 1 },
    },
    create: {
      templateId: incidentTemplate.id,
      version: 1,
      definition: incidentTemplateDefinition,
      publishedAt: new Date(),
      changelog: "Initial version",
    },
    update: {},
  });
  await prisma.serviceTemplate.upsert({
    where: { key: "standard-request" },
    create: {
      key: "standard-request",
      name: "Standard Service Request",
      description: "Draft template for standard service requests.",
      status: "DRAFT",
      currentVersion: 0,
      definition: { intake: ["summary", "justification"], defaults: {} },
    },
    update: { name: "Standard Service Request" },
  });

  // --- SLA policy, escalation and tenant assignment ------------------------
  const calendar = await prisma.businessCalendar.findFirst({
    where: { isDefault: true },
  });
  const slaPolicy = await prisma.slaPolicy.upsert({
    where: { key: "standard-sla" },
    create: {
      key: "standard-sla",
      name: "Standard Support SLA",
      description: "Baseline response and resolution targets by priority.",
      status: "ENABLED",
      serviceLevels: [
        { priority: "critical", responseMinutes: 30, resolutionMinutes: 240 },
        { priority: "high", responseMinutes: 60, resolutionMinutes: 480 },
        { priority: "medium", responseMinutes: 240, resolutionMinutes: 1440 },
        { priority: "low", responseMinutes: 480, resolutionMinutes: 2880 },
      ],
      settings: { calendarId: calendar?.id ?? null, businessHoursOnly: true },
    },
    update: { status: "ENABLED" },
  });
  const escalation = await prisma.escalationRule.findFirst({
    where: { name: "Critical response breach" },
  });
  if (!escalation) {
    await prisma.escalationRule.create({
      data: {
        name: "Critical response breach",
        slaPolicyId: slaPolicy.id,
        trigger: "RESPONSE",
        thresholdMinutes: 30,
        actions: {
          notifyRoles: ["platform-admin"],
          notifyEmail: "ops@example.com",
        },
        isEnabled: true,
        sortOrder: 1,
      },
    });
  }
  await prisma.tenantSlaAssignment.upsert({
    where: {
      tenantId_slaPolicyId: {
        tenantId: orgTenant.id,
        slaPolicyId: slaPolicy.id,
      },
    },
    create: {
      tenantId: orgTenant.id,
      slaPolicyId: slaPolicy.id,
      isActive: true,
    },
    update: { isActive: true },
  });

  // --- Workflow template, version and tenant assignment --------------------
  const workflowDefinition = {
    initialNodeId: "start",
    nodes: [
      {
        id: "start",
        type: "START",
        name: "Incident created",
        next: ["check-priority"],
      },
      {
        id: "check-priority",
        type: "CONDITION",
        name: "Priority is critical?",
        config: { expression: 'priority === "critical"' },
        next: ["assign-major", "assign-standard"],
      },
      {
        id: "assign-major",
        type: "ACTION",
        name: "Assign to major incident team",
        config: { action: "ASSIGN_TEAM", team: "Major Incident" },
        next: ["notify"],
      },
      {
        id: "assign-standard",
        type: "ACTION",
        name: "Route to service desk",
        config: { action: "ASSIGN_QUEUE", queue: "Service Desk" },
        next: ["notify"],
      },
      {
        id: "notify",
        type: "NOTIFICATION",
        name: "Notify assignee",
        config: { template: "support-ticket-created" },
        next: ["done"],
      },
      { id: "done", type: "END", name: "Complete" },
    ],
  };
  const workflowTemplate = await prisma.workflowTemplate.upsert({
    where: { key: "incident-triage" },
    create: {
      key: "incident-triage",
      name: "Incident Triage",
      description: "Routes incidents by priority and notifies the assignee.",
      status: "PUBLISHED",
      currentVersion: 1,
      definition: workflowDefinition,
    },
    update: { status: "PUBLISHED", currentVersion: 1 },
  });
  await prisma.workflowVersion.upsert({
    where: {
      templateId_version: { templateId: workflowTemplate.id, version: 1 },
    },
    create: {
      templateId: workflowTemplate.id,
      version: 1,
      definition: workflowDefinition,
      validation: { valid: true, errors: [], warnings: [] },
      publishedAt: new Date(),
      changelog: "Initial published version",
    },
    update: {},
  });
  await prisma.tenantWorkflowAssignment.upsert({
    where: {
      tenantId_templateId_moduleKey: {
        tenantId: orgTenant.id,
        templateId: workflowTemplate.id,
        moduleKey: "incident",
      },
    },
    create: {
      tenantId: orgTenant.id,
      templateId: workflowTemplate.id,
      moduleKey: "incident",
      isActive: true,
    },
    update: { isActive: true },
  });

  // --- Classification categories ------------------------------------------
  for (const [index, name] of ["Hardware", "Software", "Network"].entries()) {
    const existing = await prisma.classificationCategory.findFirst({
      where: { name, moduleKey: "incident" },
    });
    if (!existing) {
      await prisma.classificationCategory.create({
        data: { name, moduleKey: "incident", sortOrder: index },
      });
    }
  }

  // --- Knowledge management ------------------------------------------------
  const knowledgeCategories = ["Getting Started", "Troubleshooting"];
  const knowledgeCategoryIds: string[] = [];
  for (const [index, name] of knowledgeCategories.entries()) {
    const existing = await prisma.knowledgeCategory.findFirst({
      where: { name },
    });
    const record =
      existing ??
      (await prisma.knowledgeCategory.create({
        data: { name, sortOrder: index },
      }));
    knowledgeCategoryIds.push(record.id);
  }
  await prisma.knowledgeTemplate.upsert({
    where: { key: "how-to-article" },
    create: {
      key: "how-to-article",
      name: "How-To Article",
      description: "Standard structure for how-to knowledge articles.",
      categoryId: knowledgeCategoryIds[0] ?? null,
      body: "<h2>Overview</h2><p>Describe the goal.</p><h2>Steps</h2><ol><li>Step one</li></ol>",
      fields: [],
      status: "ENABLED",
    },
    update: { status: "ENABLED" },
  });
  const reviewRule = await prisma.knowledgeReviewRule.findFirst({
    where: { name: "Quarterly knowledge review" },
  });
  if (!reviewRule) {
    await prisma.knowledgeReviewRule.create({
      data: {
        name: "Quarterly knowledge review",
        intervalDays: 90,
        notifyBeforeDays: 7,
        action: "REVIEW",
        isEnabled: true,
      },
    });
  }
  await prisma.knowledgeTenantSetting.upsert({
    where: { tenantId: orgTenant.id },
    create: {
      tenantId: orgTenant.id,
      settings: { reviewsEnabled: true, tenantAuthoringEnabled: true },
    },
    update: {},
  });

  // --- CMDB and asset configuration ---------------------------------------
  await prisma.ciType.upsert({
    where: { key: "server" },
    create: {
      key: "server",
      name: "Server",
      description: "Physical or virtual server.",
      icon: "server",
      fields: [
        { key: "hostname", label: "Hostname", type: "string", required: true },
        {
          key: "environment",
          label: "Environment",
          type: "enum",
          options: ["production", "staging", "development"],
        },
        { key: "cpuCores", label: "CPU Cores", type: "number" },
      ],
    },
    update: { name: "Server" },
  });
  await prisma.ciType.upsert({
    where: { key: "business-application" },
    create: {
      key: "business-application",
      name: "Business Application",
      description: "Application service delivered to end users.",
      icon: "app-window",
      fields: [{ key: "owner", label: "Owner", type: "string" }],
    },
    update: { name: "Business Application" },
  });
  await prisma.ciRelationshipType.upsert({
    where: { key: "depends-on" },
    create: {
      key: "depends-on",
      name: "Depends On",
      description: "Source depends on target.",
      sourceTypeKey: "business-application",
      targetTypeKey: "server",
      isDirectional: true,
    },
    update: { name: "Depends On" },
  });
  await prisma.assetCategory.upsert({
    where: { key: "laptops" },
    create: {
      key: "laptops",
      name: "Laptops",
      description: "Employee laptops and notebooks.",
      depreciation: "STRAIGHT_LINE_3Y",
    },
    update: { name: "Laptops" },
  });
  await prisma.discoveryProfile.upsert({
    where: { key: "datacenter-network-scan" },
    create: {
      key: "datacenter-network-scan",
      name: "Datacenter Network Scan",
      description: "Agentless scan of the datacenter network ranges.",
      mode: "NETWORK_SCAN",
      schedule: "DAILY",
      settings: { ranges: ["10.0.0.0/24"] },
      isEnabled: true,
    },
    update: { isEnabled: true },
  });
  await prisma.tenantCmdbConfiguration.upsert({
    where: { tenantId: orgTenant.id },
    create: {
      tenantId: orgTenant.id,
      settings: { discoveryEnabled: true, assetLifecycleEnabled: true },
    },
    update: {},
  });

  // --- Sample platform staff ----------------------------------------------
  const sampleStaff: {
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    status: UserStatus;
    roleKey: string;
  }[] = [
    {
      email: "sam.support@example.com",
      firstName: "Sam",
      lastName: "Rivera",
      jobTitle: "Support Engineer",
      status: UserStatus.INVITED,
      roleKey: "support-manager",
    },
    {
      email: "alex.auditor@example.com",
      firstName: "Alex",
      lastName: "Kim",
      jobTitle: "Security Auditor",
      status: UserStatus.SUSPENDED,
      roleKey: "security-auditor",
    },
  ];
  let supportAuthorId: string | null = null;
  for (const staff of sampleStaff) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      create: {
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        jobTitle: staff.jobTitle,
        userType: "PLATFORM_STAFF",
        status: staff.status,
        invitationTokenHash:
          staff.status === UserStatus.INVITED ? sha256(randomToken(24)) : null,
        invitationExpiresAt:
          staff.status === UserStatus.INVITED
            ? new Date(Date.now() + 72 * 3600 * 1000)
            : null,
      },
      update: { status: staff.status, jobTitle: staff.jobTitle },
    });
    if (staff.roleKey === "support-manager") supportAuthorId = user.id;
    const role = await prisma.platformRole.findUnique({
      where: { key: staff.roleKey },
    });
    if (role) {
      await prisma.staffRoleAssignment.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
  }

  // --- Support tickets -----------------------------------------------------
  const queue = await prisma.supportQueue.findFirst({
    where: { isDefault: true },
  });
  const year = new Date().getFullYear();
  const tickets = [
    {
      number: `SUP-${year}-00001`,
      subject: "Cannot export tenant usage report",
      description: "CSV export stays queued and never completes.",
      status: SupportTicketStatus.RESOLVED,
      priority: SupportTicketPriority.HIGH,
      requesterName: "Ava Mehta",
      requesterEmail: "admin@acmetech.io",
    },
    {
      number: `SUP-${year}-00002`,
      subject: "Question about API key scopes",
      description: "Which scopes are required for the reporting endpoints?",
      status: SupportTicketStatus.OPEN,
      priority: SupportTicketPriority.NORMAL,
      requesterName: "Hank Scorpio",
      requesterEmail: "hank@globex.example.com",
    },
  ];
  for (const ticket of tickets) {
    const record = await prisma.supportTicket.upsert({
      where: { ticketNumber: ticket.number },
      create: {
        ticketNumber: ticket.number,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        queueId: queue?.id ?? null,
        tenantId: orgTenant.id,
        resolvedAt:
          ticket.status === SupportTicketStatus.RESOLVED ? new Date() : null,
      },
      update: { status: ticket.status },
    });
    if (supportAuthorId) {
      const replyCount = await prisma.supportReply.count({
        where: { ticketId: record.id },
      });
      if (replyCount === 0) {
        await prisma.supportReply.create({
          data: {
            ticketId: record.id,
            authorId: supportAuthorId,
            body: "Thanks for the report — we are investigating and will update you here.",
            isInternal: false,
          },
        });
      }
    }
  }

  // --- Email delivery logs -------------------------------------------------
  const deliveryLogCount = await prisma.deliveryLog.count();
  if (deliveryLogCount === 0) {
    await prisma.deliveryLog.createMany({
      data: [
        {
          channel: "EMAIL",
          recipient: "admin@acmetech.io",
          subject: "Welcome to the ITSM platform",
          status: "SENT",
          attempts: 1,
          sentAt: new Date(),
        },
        {
          channel: "EMAIL",
          recipient: "sam.support@example.com",
          subject: "You have been invited to the platform",
          status: "SUPPRESSED",
          attempts: 0,
          lastError: "No email provider is configured.",
        },
        {
          channel: "EMAIL",
          recipient: "ops@example.com",
          subject: "Provisioning failure alert",
          status: "FAILED",
          attempts: 3,
          lastError: "SMTP connection timed out.",
        },
      ],
    });
  }

  // --- Integrations --------------------------------------------------------
  const integration = await prisma.integration.upsert({
    where: { key: "slack" },
    create: {
      key: "slack",
      name: "Slack",
      provider: "slack",
      description: "Post platform notifications to Slack channels.",
      category: "COMMUNICATION",
      status: "UNCONFIGURED",
    },
    update: { name: "Slack" },
  });
  await prisma.integration.upsert({
    where: { key: "jira" },
    create: {
      key: "jira",
      name: "Jira Software",
      provider: "jira",
      description: "Sync incidents and changes with Jira projects.",
      category: "DEVELOPMENT",
      status: "DISABLED",
      isEnabled: false,
    },
    update: { name: "Jira Software" },
  });
  const integrationLogCount = await prisma.integrationLog.count({
    where: { integrationId: integration.id },
  });
  if (integrationLogCount === 0) {
    await prisma.integrationLog.createMany({
      data: [
        {
          integrationId: integration.id,
          level: "info",
          action: "created",
          message: "Integration configuration created.",
        },
        {
          integrationId: integration.id,
          level: "warning",
          action: "test",
          message: "Connectivity test skipped — no credentials configured.",
        },
      ],
    });
  }

  // --- Webhook (disabled sample) ------------------------------------------
  let webhook = await prisma.webhook.findFirst({
    where: { name: "Ops channel webhook" },
  });
  if (!webhook) {
    webhook = await prisma.webhook.create({
      data: {
        name: "Ops channel webhook",
        description:
          "Sample webhook that forwards platform events to an operations endpoint.",
        url: "https://example.com/webhooks/itsm-ops",
        eventKeys: [
          "tenant.created",
          "tenant.suspended",
          "support.ticket.created",
        ],
        secretEnc: encryptSecret(randomToken(32)),
        isEnabled: false,
      },
    });
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventKey: "support.ticket.created",
        payload: {
          ticketNumber: `SUP-${year}-00001`,
          subject: "Cannot export tenant usage report",
        },
        status: "SUCCESS",
        responseStatus: 200,
        attempts: 1,
        deliveredAt: new Date(),
      },
    });
  }

  // --- API key (sample; secret is not retrievable by design) --------------
  const existingKey = await prisma.apiKey.findFirst({
    where: { name: "Reporting reader (sample)" },
  });
  if (!existingKey) {
    const generated = generateApiKey();
    await prisma.apiKey.create({
      data: {
        name: "Reporting reader (sample)",
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
        scopes: ["admin.reports.read"],
        expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      },
    });
  }

  // --- Approval and access policies (disabled samples) ---------------------
  const approvalPolicy = await prisma.approvalPolicy.findFirst({
    where: { name: "Tenant suspension approval" },
  });
  if (!approvalPolicy) {
    const ownerRole = await prisma.platformRole.findUnique({
      where: { key: "platform-owner" },
    });
    await prisma.approvalPolicy.create({
      data: {
        name: "Tenant suspension approval",
        description:
          "Sample policy: require a platform owner to approve tenant suspensions.",
        actionScope: "tenant.suspend",
        conditions: { resourceTypes: ["tenant"] },
        approverRoleIds: ownerRole ? [ownerRole.id] : [],
        minApprovals: 1,
        isEnabled: false,
      },
    });
  }
  const accessPolicy = await prisma.accessPolicy.findFirst({
    where: { name: "Terminal session idle lock" },
  });
  if (!accessPolicy) {
    await prisma.accessPolicy.create({
      data: {
        name: "Terminal session idle lock",
        description:
          "Sample policy: lock inactive console sessions after 30 minutes.",
        policyType: "SESSION_POLICY",
        rules: { maxIdleMinutes: 30 },
        priority: 100,
        isEnabled: false,
      },
    });
  }

  // --- Report history ------------------------------------------------------
  const existingReport = await prisma.reportJob.findFirst({
    where: { reportKey: "tenant-usage", kind: "REPORT" },
  });
  if (!existingReport) {
    await prisma.reportJob.create({
      data: {
        kind: "REPORT",
        reportKey: "tenant-usage",
        format: "JSON",
        filters: {},
        status: "COMPLETED",
        rowCount: 3,
        startedAt: new Date(Date.now() - 3600 * 1000),
        completedAt: new Date(Date.now() - 3590 * 1000),
      },
    });
  }

  // --- Workflow run history ------------------------------------------------
  const existingRun = await prisma.workflowRun.findFirst({
    where: { templateKey: "incident-triage" },
  });
  if (!existingRun) {
    await prisma.workflowRun.create({
      data: {
        templateId: workflowTemplate.id,
        templateKey: "incident-triage",
        version: 1,
        tenantId: orgTenant.id,
        resourceType: "incident",
        resourceId: "demo-incident-0001",
        status: "COMPLETED",
        context: { priority: "high" },
        steps: [
          {
            nodeId: "start",
            status: "ok",
            at: new Date(Date.now() - 7200 * 1000).toISOString(),
          },
          {
            nodeId: "check-priority",
            status: "ok",
            at: new Date(Date.now() - 7195 * 1000).toISOString(),
          },
          {
            nodeId: "assign-standard",
            status: "ok",
            at: new Date(Date.now() - 7190 * 1000).toISOString(),
          },
          {
            nodeId: "notify",
            status: "ok",
            at: new Date(Date.now() - 7185 * 1000).toISOString(),
          },
          {
            nodeId: "done",
            status: "ok",
            at: new Date(Date.now() - 7180 * 1000).toISOString(),
          },
        ],
        startedAt: new Date(Date.now() - 7200 * 1000),
        completedAt: new Date(Date.now() - 7180 * 1000),
      },
    });
  }

  // --- Background job history ---------------------------------------------
  const existingJob = await prisma.backgroundJob.findFirst({
    where: { type: "TENANT_PROVISIONING" },
  });
  if (!existingJob) {
    await prisma.backgroundJob.create({
      data: {
        type: "TENANT_PROVISIONING",
        status: "COMPLETED",
        payload: { tenantId: orgTenant.id, attempt: 1 },
        result: { provisioningStatus: "COMPLETED" },
        attempts: 1,
        maxAttempts: 3,
        startedAt: new Date(Date.now() - 86400 * 1000),
        completedAt: new Date(Date.now() - 86395 * 1000),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    "Seeded demo data: tenants, domains, service/SLA/workflow templates, knowledge, CMDB, support, integrations, webhooks, policies and samples.",
  );
}

if (require.main === module) {
  seed()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Seed failed:", error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
