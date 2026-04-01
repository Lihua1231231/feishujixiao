/**
 * Meeting interviewer assignments.
 * Maps each employee to their designated interviewer(s) for the performance meeting.
 * Priority: DB overrides > hardcoded overrides > direct supervisor.
 */

// employeeName -> interviewerNames[]
// Only entries that differ from the default (supervisor) need to be listed.
const INTERVIEWER_OVERRIDES: Record<string, string[]> = {
  "刘瑞峰": ["张志权"],
  "赖永涛": ["张东杰", "沈楚城"],
  "江培章": ["张东杰", "沈楚城"],
  "陈家兴": ["张东杰", "沈楚城"],
  "严骏": ["张东杰", "沈楚城"],
  "洪炯腾": ["张东杰", "沈楚城"],
  "沈楚城": ["张东杰", "沈楚城"],
  "张建生": ["张东杰", "沈楚城"],
  "胡毅薇": ["张东杰", "李泽龙"],
  "许斯荣": ["张东杰", "李泽龙"],
  "余一铭": ["张东杰", "李泽龙"],
  "曹文跃": ["张东杰", "李泽龙"],
  "赵奇卓": ["邱翔"],
  "禹聪琪": ["邱翔", "吴承霖"],
  "郑文文": ["邱翔"],
};

export type MeetingUser = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisor: { id: string; name: string } | null;
};

/**
 * DB overrides format: { "employeeName": ["interviewerName1", ...] }
 */
export type DbInterviewerOverrides = Record<string, string[]>;

function resolveInterviewerNames(
  employeeName: string,
  supervisorName: string | null,
  dbOverrides?: DbInterviewerOverrides,
): string[] {
  // Priority 1: DB overrides
  if (dbOverrides && dbOverrides[employeeName]?.length) {
    return dbOverrides[employeeName];
  }
  // Priority 2: Hardcoded overrides
  const hardcoded = INTERVIEWER_OVERRIDES[employeeName];
  if (hardcoded) return hardcoded;
  // Priority 3: Direct supervisor
  return supervisorName ? [supervisorName] : [];
}

/**
 * Returns Map<employeeId, interviewerIds[]>
 */
export function buildMeetingInterviewerMap(
  users: MeetingUser[],
  dbOverrides?: DbInterviewerOverrides,
): Map<string, string[]> {
  const byName = new Map(users.map((u) => [u.name, u]));
  const result = new Map<string, string[]>();

  for (const user of users) {
    const names = resolveInterviewerNames(user.name, user.supervisor?.name ?? null, dbOverrides);
    const ids = names
      .map((n) => byName.get(n)?.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      result.set(user.id, ids);
    }
  }

  return result;
}

/**
 * Returns all employee IDs assigned to a given interviewer.
 */
export function getAssignedEmployeeIds(
  interviewerMap: Map<string, string[]>,
  interviewerId: string,
): string[] {
  const result: string[] = [];
  for (const [employeeId, interviewerIds] of interviewerMap) {
    if (interviewerIds.includes(interviewerId)) {
      result.push(employeeId);
    }
  }
  return result;
}

/**
 * Check if an employee has a DB override (vs hardcoded or default).
 */
export function isDbOverridden(employeeName: string, dbOverrides?: DbInterviewerOverrides): boolean {
  return Boolean(dbOverrides && dbOverrides[employeeName]?.length);
}
