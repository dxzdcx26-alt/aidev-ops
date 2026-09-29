/**
 * Permission System Tests — Phase 20
 *
 * Tests server-side permission enforcement:
 *   - Role-based access
 *   - Permission matrix modes (allowed/approval/human/denied)
 *   - AI forbidden actions
 */

import { describe, it, expect } from "bun:test";
import { checkPermission, checkAIPermission, DEFAULT_PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";
import type { Permission, Role } from "@/types";

describe("checkPermission", () => {
  it("allows VIEW for viewer role", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "VIEW", false, "viewer");
    expect(result.allowed).toBe(true);
  });

  it("denies DEPLOY for viewer role", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "DEPLOY", false, "viewer");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("viewer");
  });

  it("denies DEPLOY for operator without approval", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "DEPLOY", false, "operator");
    expect(result.allowed).toBe(false);
    expect(result.requiredMode).toBe("approval");
  });

  it("allows DEPLOY for operator with approval", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "DEPLOY", true, "operator");
    expect(result.allowed).toBe(true);
  });

  it("denies MERGE without human approval (HUMAN-ONLY)", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "MERGE", false, "admin");
    expect(result.allowed).toBe(false);
    expect(result.requiredMode).toBe("human");
  });

  it("allows MERGE for admin with human approval", () => {
    const result = checkPermission(DEFAULT_PERMISSIONS, "MERGE", true, "admin");
    expect(result.allowed).toBe(true);
  });

  it("denies APPROVE for non-admin roles", () => {
    expect(checkPermission(DEFAULT_PERMISSIONS, "APPROVE", true, "viewer").allowed).toBe(false);
    expect(checkPermission(DEFAULT_PERMISSIONS, "APPROVE", true, "analyst").allowed).toBe(false);
    expect(checkPermission(DEFAULT_PERMISSIONS, "APPROVE", true, "operator").allowed).toBe(false);
  });

  it("allows APPROVE only for admin with human approval", () => {
    expect(checkPermission(DEFAULT_PERMISSIONS, "APPROVE", false, "admin").allowed).toBe(false);
    expect(checkPermission(DEFAULT_PERMISSIONS, "APPROVE", true, "admin").allowed).toBe(true);
  });
});

describe("checkAIPermission", () => {
  const aiForbidden: Permission[] = ["APPROVE", "MERGE", "DEPLOY", "ROLLBACK", "ADMIN", "COMMIT"];

  it("forbids AI from all privileged actions", () => {
    for (const perm of aiForbidden) {
      const result = checkAIPermission(perm);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("AI is forbidden");
    }
  });

  it("allows AI to VIEW", () => {
    const result = checkAIPermission("VIEW");
    expect(result.allowed).toBe(true);
  });

  it("allows AI to ANALYZE", () => {
    const result = checkAIPermission("ANALYZE");
    expect(result.allowed).toBe(true);
  });

  it("allows AI to COMMENT", () => {
    const result = checkAIPermission("COMMENT");
    expect(result.allowed).toBe(true);
  });
});

describe("Role permissions", () => {
  it("viewer has minimal permissions", () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual(["VIEW", "ANALYZE", "COMMENT"]);
  });

  it("analyst has same as viewer", () => {
    expect(ROLE_PERMISSIONS.analyst).toEqual(["VIEW", "ANALYZE", "COMMENT"]);
  });

  it("operator can deploy and rollback (with approval)", () => {
    expect(ROLE_PERMISSIONS.operator).toContain("DEPLOY");
    expect(ROLE_PERMISSIONS.operator).toContain("ROLLBACK");
    expect(ROLE_PERMISSIONS.operator).not.toContain("APPROVE");
    expect(ROLE_PERMISSIONS.operator).not.toContain("MERGE");
  });

  it("admin has all permissions", () => {
    expect(ROLE_PERMISSIONS.admin.length).toBe(9);
    expect(ROLE_PERMISSIONS.admin).toContain("ADMIN");
    expect(ROLE_PERMISSIONS.admin).toContain("MERGE");
    expect(ROLE_PERMISSIONS.admin).toContain("APPROVE");
  });
});

describe("Default permission matrix", () => {
  it("VIEW is allowed by default", () => {
    expect(DEFAULT_PERMISSIONS.VIEW).toBe("allowed");
  });

  it("ANALYZE is allowed by default", () => {
    expect(DEFAULT_PERMISSIONS.ANALYZE).toBe("allowed");
  });

  it("DEPLOY requires approval by default", () => {
    expect(DEFAULT_PERMISSIONS.DEPLOY).toBe("approval");
  });

  it("MERGE is human-only by default", () => {
    expect(DEFAULT_PERMISSIONS.MERGE).toBe("human");
  });

  it("APPROVE is human-only by default", () => {
    expect(DEFAULT_PERMISSIONS.APPROVE).toBe("human");
  });

  it("ROLLBACK requires approval by default", () => {
    expect(DEFAULT_PERMISSIONS.ROLLBACK).toBe("approval");
  });
});
