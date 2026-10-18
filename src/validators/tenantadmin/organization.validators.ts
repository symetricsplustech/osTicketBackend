import { z } from 'zod';

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2, 'Organization name must be at least 2 characters.').max(120).optional(),
    primaryContactName: z.string().trim().max(120).nullable().optional(),
    primaryContactEmail: z.string().trim().email('A valid contact email is required.').nullable().optional(),
    timezone: z.string().trim().max(60).optional(),
    locale: z.string().trim().max(20).optional(),
    industry: z.string().trim().max(120).nullable().optional(),
    website: z.string().trim().url('Website must be a valid URL.').nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const updateOrganizationBrandingSchema = z
  .object({
    logoUrl: z.string().trim().url('Logo URL must be a valid URL.').nullable().optional(),
    faviconUrl: z.string().trim().url('Favicon URL must be a valid URL.').nullable().optional(),
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Primary color must be a hex colour such as #1D4ED8.')
      .optional(),
    secondaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Secondary color must be a hex colour such as #1D4ED8.')
      .optional(),
    accentColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a hex colour such as #1D4ED8.')
      .optional(),
    emailHeaderHtml: z.string().max(20000).nullable().optional(),
    emailFooterHtml: z.string().max(20000).nullable().optional(),
    supportUrl: z.string().trim().url('Support URL must be a valid URL.').nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export const updateOrganizationLocalizationSchema = z
  .object({
    defaultLocale: z.string().trim().max(20).optional(),
    supportedLocales: z.array(z.string().trim().min(2).max(20)).max(50).optional(),
    defaultTimezone: z.string().trim().max(60).optional(),
    dateFormat: z.string().trim().max(40).optional(),
    timeFormat: z.string().trim().max(40).optional(),
    firstDayOfWeek: z.number().int().min(0).max(6).optional(),
    currency: z.string().trim().length(3).optional(),
    numberFormat: z.string().trim().max(40).optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

const businessHoursDaySchema = z.object({
  enabled: z.boolean(),
  start: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be in HH:MM 24-hour format.')
    .optional(),
  end: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be in HH:MM 24-hour format.')
    .optional(),
});

export const updateOrganizationBusinessHoursSchema = z
  .object({
    timezone: z.string().trim().max(60).optional(),
    schedule: z
      .object({
        monday: businessHoursDaySchema,
        tuesday: businessHoursDaySchema,
        wednesday: businessHoursDaySchema,
        thursday: businessHoursDaySchema,
        friday: businessHoursDaySchema,
        saturday: businessHoursDaySchema,
        sunday: businessHoursDaySchema,
      })
      .partial()
      .optional(),
    holidays: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(160),
          date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Holiday date must be YYYY-MM-DD.'),
        }),
      )
      .max(200)
      .optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export type UpdateOrganizationBrandingInput = z.infer<typeof updateOrganizationBrandingSchema>;
export type UpdateOrganizationLocalizationInput = z.infer<typeof updateOrganizationLocalizationSchema>;
export type UpdateOrganizationBusinessHoursInput = z.infer<typeof updateOrganizationBusinessHoursSchema>;
