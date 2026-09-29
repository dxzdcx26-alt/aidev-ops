/**
 * Permission System — Phase 7
 *
 * Server-side enforcement of all privileged actions.
 *
 * Permission model:
 *   VIEW      → read-only access to dashboards
 *   ANALYZE   → trigger AI analysis
 *   COMMENT   → post comments on PRs
 *   APPROVE   → human approval (HUMAN only — AI can NEVER approve)
 *   COMMIT    → commit changes (requires approval)
 *   MERGE     → merge PR (HUMAN only — requires all gates pass)
 *   DEPLOY    → trigger Vercel deploy (requires approval + gates)
 *   ROLLBACK  → rollback deployment (requires authorized operator)
 *   ADMIN     → configuration / permission changes
 *
 * Roles:
 *   viewer   → VIEW, ANALYZE, COMMENT
 *   analyst  → VIEW, ANALYZE, COMMENT
 *   operator → VIEW, ANALYZE, COMMENT, COMMIT (with approval), DEPLOY (with approval), ROLLBACK (with approval)
 *   admin    → all + ADMIN
 *
 * Per spec §7: "AI ไม่มี privileged authority"
 * Per spec §9: "Server-side permission check เท่านั้น"
 */

import type { Permission, PermissionMode, PermissionDecision, Role, PermissionMatrix } from "@/types";

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  VIEW: "allowed",
  ANALYZE: "allowed",
  COMMENT: "allowed",
  APPROVE: "human",     // human-only — AI can never approve
  COMMIT: "approval",   // requires approval
  MERGE: "human",       // human-only — AI can never merge
  DEPLOY: "approval",   // requires approval
  ROLLBACK: "approval", // requires approval
  ADMIN: "human",       // human-only
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ["VIEW", "ANALYZE", "COMMENT"],
  analyst: ["VIEW", "ANALYZE", "COMMENT"],
  operator: ["VIEW", "ANALYZE", "COMMENT", "COMMIT", "DEPLOY", "ROLLBACK"],
  admin: ["VIEW", "ANALYZE", "COMMENT", "APPROVE", "COMMIT", "MERGE", "DEPLOY", "ROLLBACK", "ADMIN"],
};

/**
 * Check whether a role has a given permission.
 * This is the SERVER-SIDE check. Client claims are never trusted.
 */
export function checkPermission(
  matrix: PermissionMatrix,
  permission: Permission,
  hasApproval: boolean,
  role: Role = "operator",
): PermissionDecision {
  // Step 1: Check role has this permission
  if (!ROLE_PERMISSIONS[role].includes(permission)) {
    return {
      allowed: false,
      reason: `Role "${role}" does not have permission "${permission}"`,
      requiredMode: "denied",
      hasApproval,
    };
  }

  // Step 2: Check permission matrix mode
  const mode = matrix[permission];
  switch (mode) {
    case "allowed":
      return { allowed: true, reason: "Allowed by default policy", requiredMode: mode, hasApproval };
    case "approval":
      if (hasApproval) {
        return { allowed: true, reason: "Approved by authorized human operator", requiredMode: mode, hasApproval };
      }
      return {
        allowed: false,
        reason: `${permission} requires explicit human approval before execution`,
        requiredMode: mode,
        hasApproval,
      };
    case "human":
      // Human-only actions can NEVER be satisfied by AI
      // The 'hasApproval' flag must be a real human approval record, not AI
      if (hasApproval) {
        return { allowed: true, reason: "Human-only action — confirmed by human operator", requiredMode: mode, hasApproval };
      }
      return {
        allowed: false,
        reason: `${permission} is HUMAN-ONLY — AI may never perform this action, even with approval`,
        requiredMode: mode,
        hasApproval,
      };
    case "denied":
      return { allowed: false, reason: `${permission} is denied by policy`, requiredMode: mode, hasApproval };
  }
}

export function describePermissionMode(mode: PermissionMode): string {
  switch (mode) {
    case "allowed": return "Allowed";
    case "approval": return "Requires approval";
    case "human": return "Human only";
    case "denied": return "Denied";
  }
}

/**
 * Special-case check: AI actions.
 * AI is NEVER allowed to: APPROVE, MERGE, DEPLOY, ROLLBACK, ADMIN.
 * AI is allowed to: VIEW, ANALYZE, COMMENT (read-only + analysis).
 */
export function checkAIPermission(permission: Permission): PermissionDecision {
  const aiForbidden: Permission[] = ["APPROVE", "MERGE", "DEPLOY", "ROLLBACK", "ADMIN", "COMMIT"];
  if (aiForbidden.includes(permission)) {
    return {
      allowed: false,
      reason: `AI is forbidden from ${permission} — this is a human-only action per spec §7-9`,
      requiredMode: "human",
      hasApproval: false,
    };
  }
  return {
    allowed: true,
    reason: `AI is allowed to ${permission} (analysis-only action)`,
    requiredMode: "allowed",
    hasApproval: false,
  };
}
