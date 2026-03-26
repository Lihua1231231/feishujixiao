export const EVAL_LIST_NAMES = [
  "曹越","曹铭哲","欧阳伊希","窦雪茹","陈毅强","薛琳蕊","陈佳杰","刘一","张福强",
  "杨倩仪","莫颖儿","吕鸿","冉晨宇","张志权","赖永涛","江培章","陈家兴",
  "严骏","洪炯腾","沈楚城","张建生","戴智斌","马莘权","徐宗泽","龙辰",
  "胡毅薇","许斯荣","余一铭","曹文跃","李泽龙","禹聪琪","陈琼","李娟娟","刘瑞峰",
  "李斌琦","林义章","唐昊鸣","王金淋","洪思睿","叶荣金","郭雨明","邹玙璠","杨偲妤",
  "李红军","刘源源","顾元舜",
  "李晓霞","鲍建伟","郑文文","赵奇卓","宓鸿宇",
] as const;

export const GROUP_B_NAMES = ["李晓霞","鲍建伟","郑文文","赵奇卓","宓鸿宇"] as const;

const EVAL_LIST_SET = new Set<string>(EVAL_LIST_NAMES);
const GROUP_B_SET = new Set<string>(GROUP_B_NAMES);

const EXTRA_EVAL_MAP: Record<string, string[]> = {
  "吴承霖": ["曹铭哲", "邱翔", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
  "邱翔": ["曹铭哲", "张东杰", "冉晨宇", "张志权", "徐宗泽", "李泽龙", "禹聪琪", "李斌琦", "王金淋", "赵奇卓"],
  "张东杰": ["余一铭", "曹文跃", "胡毅薇", "许斯荣"],
  "张志权": ["刘瑞峰"],
  "沈楚城": ["赖永涛", "江培章", "陈家兴", "严骏", "洪炯腾", "张建生"],
  "冉晨宇": ["邹玙璠"],
  "李娟娟": ["郭雨明"],
};

const EMPLOYEE_EVALUATOR_OVERRIDES: Record<string, { add?: string[]; remove?: string[] }> = {
  "曹铭哲": { remove: ["邱翔"] },
  "李泽龙": { remove: ["吴承霖", "邱翔"] },
  "李斌琦": { remove: ["吴承霖", "邱翔"] },
  "叶荣金": { add: ["赵奇卓"] },
};

export type AssignmentUser = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisor: { id: string; name: string } | null;
};

export type ExistingSupervisorEval = {
  employeeId: string;
  evaluatorId: string;
  evaluatorName: string;
};

export type SupervisorAssignment = {
  employeeId: string;
  employeeName: string;
  currentEvaluatorIds: string[];
  currentEvaluatorNames: string[];
  legacyEvaluatorIds: string[];
  legacyEvaluatorNames: string[];
};

function uniqueNames(names: string[]) {
  return [...new Set(names.filter(Boolean))];
}

export function getCurrentEvaluatorNames(employeeName: string, supervisorName: string | null) {
  const names: string[] = [];
  if (supervisorName) {
    names.push(supervisorName);
  }
  for (const [evaluatorName, targets] of Object.entries(EXTRA_EVAL_MAP)) {
    if (targets.includes(employeeName) && evaluatorName !== supervisorName) {
      names.push(evaluatorName);
    }
  }

  const override = EMPLOYEE_EVALUATOR_OVERRIDES[employeeName];
  let result = uniqueNames(names);
  if (override?.remove?.length) {
    const removeSet = new Set(override.remove);
    result = result.filter((name) => !removeSet.has(name));
  }
  if (override?.add?.length) {
    result = uniqueNames([...result, ...override.add]);
  }
  return result;
}

export function buildSupervisorAssignmentMap(
  users: AssignmentUser[],
  existingEvals: ExistingSupervisorEval[] = []
) {
  const userByName = new Map(users.map((user) => [user.name, user]));
  const existingByEmployeeId = new Map<string, ExistingSupervisorEval[]>();

  for (const existing of existingEvals) {
    const list = existingByEmployeeId.get(existing.employeeId) || [];
    list.push(existing);
    existingByEmployeeId.set(existing.employeeId, list);
  }

  const assignments = new Map<string, SupervisorAssignment>();
  for (const user of users) {
    if (!EVAL_LIST_SET.has(user.name)) {
      continue;
    }

    const currentEvaluatorNames = getCurrentEvaluatorNames(user.name, user.supervisor?.name || null)
      .filter((name) => userByName.has(name));
    const currentEvaluatorIds = currentEvaluatorNames
      .map((name) => userByName.get(name)?.id)
      .filter((id): id is string => Boolean(id));

    const existing = existingByEmployeeId.get(user.id) || [];
    const currentSet = new Set(currentEvaluatorIds);
    const legacyEvaluatorIds = uniqueNames(
      existing
        .map((item) => (!currentSet.has(item.evaluatorId) ? item.evaluatorId : ""))
        .filter(Boolean)
    );
    const legacyEvaluatorNames = uniqueNames(
      existing
        .map((item) => (!currentSet.has(item.evaluatorId) ? item.evaluatorName : ""))
        .filter(Boolean)
    );

    assignments.set(user.id, {
      employeeId: user.id,
      employeeName: user.name,
      currentEvaluatorIds,
      currentEvaluatorNames,
      legacyEvaluatorIds,
      legacyEvaluatorNames,
    });
  }

  return assignments;
}

export function isEvalListUser(name: string) {
  return EVAL_LIST_SET.has(name);
}

export function isGroupBUser(name: string) {
  return GROUP_B_SET.has(name);
}
