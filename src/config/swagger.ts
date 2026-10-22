import type { Router } from "express";
import type { RouteMount, RouteMountChild } from "../routes";
import { API_MOUNTS } from "../routes";
import { env } from "./env";

/* eslint-disable @typescript-eslint/no-explicit-any */

const METHOD_SUMMARIES: Record<string, string> = {
  get: "Retrieve data",
  post: "Create or perform an action",
  put: "Replace a resource",
  patch: "Update selected fields",
  delete: "Remove or revoke a resource",
};

function pathParameters(path: string, existing: any[]): any[] {
  const names = Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g)).map(
    (match) => match[1]!,
  );
  const params = names.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
    description: `${name} path parameter`,
  }));
  const queryParams = [...(path.includes("?") ? [] : [])];
  return [...params, ...existing, ...queryParams];
}

function operationFor(
  method: string,
  path: string,
  tag: string,
  isPublic: boolean,
): any {
  return {
    tags: [tag],
    summary: `${METHOD_SUMMARIES[method] ?? method.toUpperCase()} — ${path}`,
    parameters: pathParameters(path, []),
    security: isPublic ? [] : [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    responses: {
      "200": { description: "Successful response" },
      "201": { description: "Resource created" },
      "202": { description: "Accepted for asynchronous processing" },
      "400": { description: "Invalid request" },
      "401": { description: "Authentication required" },
      "403": { description: "Permission denied" },
      "404": { description: "Resource not found" },
      "422": { description: "Validation failed" },
    },
  };
}

function collectFromRouter(
  router: Router,
  basePath: string,
  tag: string,
  isPublic: boolean,
  paths: Record<string, any>,
): void {
  const stack = (router as any).stack as any[];
  if (!Array.isArray(stack)) return;
  for (const layer of stack) {
    if (layer.route) {
      const routePath =
        layer.route.path === "/"
          ? basePath || "/"
          : `${basePath}${layer.route.path}`;
      const methods = Object.keys(layer.route.methods).filter(
        (method) => layer.route.methods[method],
      );
      for (const method of methods) {
        paths[routePath] = paths[routePath] ?? {};
        paths[routePath][method] = operationFor(
          method,
          routePath,
          tag,
          isPublic,
        );
      }
    }
  }
}

function collectChildren(
  children: RouteMountChild[] | undefined,
  basePath: string,
  tag: string,
  isPublic: boolean,
  paths: Record<string, any>,
): void {
  if (!children) return;
  for (const child of children) {
    const childPath = `${basePath}${child.path}`;
    collectFromRouter(child.router, childPath, tag, isPublic, paths);
    collectChildren(child.children, childPath, tag, isPublic, paths);
  }
}

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, any> = {};
  const tags: { name: string; description: string }[] = [];

  for (const mount of API_MOUNTS as RouteMount[]) {
    if (!tags.some((tag) => tag.name === mount.tag)) {
      tags.push({ name: mount.tag, description: mount.description });
    }
    collectFromRouter(
      mount.router,
      mount.basePath,
      mount.tag,
      Boolean(mount.public),
      paths,
    );
    collectChildren(
      mount.children,
      mount.basePath,
      mount.tag,
      Boolean(mount.public),
      paths,
    );
  }

  return {
    openapi: "3.0.3",
    info: {
      title: `${env.APP_NAME} — SaaS Admin API`,
      version: env.APP_VERSION,
      description:
        "Administrative API surface for the ITSM SaaS control plane: tenants, staff, access control, approvals, service/SLA/workflow configuration, integrations and platform operations.",
    },
    servers: [{ url: `${env.PUBLIC_API_URL}${env.API_PREFIX}` }],
    tags,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
      schemas: {
        SuccessEnvelope: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {},
            meta: { type: "object" },
          },
        },
        ErrorEnvelope: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
      },
    },
    paths,
  };
}
