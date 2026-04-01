/**
 * Meeting interviewer assignments.
 * Maps each employee to their designated interviewer(s) for the performance meeting.
 * Default: interviewer = direct supervisor. Overrides below for special cases.
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

export function getMeetingInterviewerNames(
  employeeName: string,
  supervisorName: string | null,
): string[] {
  const override = INTERVIEWER_OVERRIDES[employeeName];
  if (override) return override;
  return supervisorName ? [supervisorName] : [];
}

type MeetingUser = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisor: { id: string; name: string } | null;
};

/**
 * Returns Map<employeeId, interviewerIds[]>
 */
export function buildMeetingInterviewerMap(
  users: MeetingUser[],
): Map<string, string[]> {
  const byName = new Map(users.map((u) => [u.name, u]));
  const result = new Map<string, string[]>();

  for (const user of users) {
    const names = getMeetingInterviewerNames(user.name, user.supervisor?.name ?? null);
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
