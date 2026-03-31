import type { SessionUser } from "@/lib/session";

const NORMALIZATION_VIEWER_IDS = new Set([
  "cmmvntppj0000js04j8xm0ycx",
  "cmmvntq6g0001js04mgtny8xn",
  "cmmvnu0140018js04wh2o3pas",
]);

const NORMALIZATION_VIEWER_NAMES = new Set(["吴承霖", "邱翔", "禹聪琪"]);

function hasNormalizationAccess(user: Pick<SessionUser, "id" | "role" | "name">) {
  if (user.role === "ADMIN") return true;
  if (NORMALIZATION_VIEWER_IDS.has(user.id)) return true;
  return NORMALIZATION_VIEWER_NAMES.has(user.name);
}

export function canAccessScoreNormalization(user: Pick<SessionUser, "id" | "role" | "name">) {
  return hasNormalizationAccess(user);
}

export function canApplyScoreNormalization(user: Pick<SessionUser, "id" | "role" | "name">) {
  return hasNormalizationAccess(user);
}
