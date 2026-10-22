import type { Request, Response } from "express";
import { ok, created, noContent, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  activateDomain,
  addDomain,
  disableDomain,
  getDomain,
  getVerificationStatus,
  listAllDomains,
  listDomains,
  removeDomain,
  verifyDomain,
} from "../../services/saasadmin/tenant-domains.service";
import type { AddDomainInput } from "../../validators/saasadmin/tenant-domains.validators";

const tenantIdOf = (req: Request): string => req.params.tenantId!;
const domainIdOf = (req: Request): string => req.params.domainId!;
const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listDomainsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listDomains(tenantIdOf(req), req);
    return paginated(res, rows, meta);
  },
);

export const listAllDomainsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listAllDomains(req);
    return paginated(res, rows, meta);
  },
);

export const addDomainHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const domain = await addDomain(
      tenantIdOf(req),
      req.body as AddDomainInput,
      actorOf(req),
    );
    return created(res, domain, {
      message:
        "Domain added. Create the DNS TXT record shown in the verification instructions, then verify.",
    });
  },
);

export const getDomainHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const domain = await getDomain(tenantIdOf(req), domainIdOf(req));
    return ok(res, domain);
  },
);

export const verifyDomainHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const domain = await verifyDomain(
      tenantIdOf(req),
      domainIdOf(req),
      actorOf(req),
    );
    return ok(res, domain, {
      message:
        domain.status === "VERIFIED"
          ? "Domain ownership verified."
          : "Verification did not succeed. Confirm the DNS TXT record and try again.",
    });
  },
);

export const activateDomainHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const domain = await activateDomain(
      tenantIdOf(req),
      domainIdOf(req),
      actorOf(req),
    );
    return ok(res, domain, {
      message:
        domain.certificateStatus === "ISSUED"
          ? "Domain activated."
          : "Domain activated. Certificate issuance is in progress for custom domains.",
    });
  },
);

export const disableDomainHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const domain = await disableDomain(
      tenantIdOf(req),
      domainIdOf(req),
      actorOf(req),
    );
    return ok(res, domain);
  },
);

export const removeDomainHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await removeDomain(tenantIdOf(req), domainIdOf(req), actorOf(req));
    return noContent(res);
  },
);

export const verificationStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const status = await getVerificationStatus(
      tenantIdOf(req),
      domainIdOf(req),
    );
    return ok(res, status);
  },
);
