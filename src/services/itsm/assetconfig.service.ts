import { prisma } from "../../config/database";
import { encryptSecret } from "../../shared/encryption";
import { createItsmCrudService, assertUnique } from "./crud";

export const assetModelService = createItsmCrudService({
  resourceType: "asset_model",
  label: "Asset model",
  model: prisma.tenantAssetModel,
  statusField: null,
  searchFields: ["name", "manufacturer", "category"],
  allowedSortFields: ["name", "manufacturer", "createdAt", "updatedAt"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantAssetModel,
        tenantId,
        "name",
        input.name,
        "asset model",
        existing?.id,
      );
    }
  },
});

function maskLicense<T extends { licenseKeyEnc: string | null }>(record: T) {
  const { licenseKeyEnc, ...rest } = record;
  return { ...rest, hasLicenseKey: Boolean(licenseKeyEnc) };
}

const assetLicenseBase = createItsmCrudService({
  resourceType: "asset_license",
  label: "Asset license",
  model: prisma.tenantAssetLicense,
  searchFields: ["name", "vendor"],
  allowedSortFields: [
    "name",
    "vendor",
    "seats",
    "expiresAt",
    "status",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status"],
  mapInput: (input) => {
    const data: Record<string, unknown> = { ...input };
    if (typeof input.licenseKey === "string" && input.licenseKey.length > 0) {
      data.licenseKeyEnc = encryptSecret(input.licenseKey);
    }
    delete data.licenseKey;
    return data;
  },
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantAssetLicense,
        tenantId,
        "name",
        input.name,
        "asset license",
        existing?.id,
      );
    }
  },
});

export const assetLicenseService = {
  ...assetLicenseBase,
  async list(
    tenantId: string,
    req: Parameters<typeof assetLicenseBase.list>[1],
  ) {
    const { rows, meta } = await assetLicenseBase.list(tenantId, req);
    return { rows: rows.map(maskLicense), meta };
  },
  async get(tenantId: string, id: string) {
    return maskLicense(await assetLicenseBase.get(tenantId, id));
  },
  async create(
    tenantId: string,
    input: Record<string, unknown>,
    actor: Parameters<typeof assetLicenseBase.create>[2],
  ) {
    return maskLicense(await assetLicenseBase.create(tenantId, input, actor));
  },
  async update(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
    actor: Parameters<typeof assetLicenseBase.update>[3],
  ) {
    return maskLicense(
      await assetLicenseBase.update(tenantId, id, input, actor),
    );
  },
};
