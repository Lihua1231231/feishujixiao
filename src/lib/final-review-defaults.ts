export const DEFAULT_EMPLOYEE_FINAL_REVIEW_NAMES = [
  "李晓霞",
  "鲍建伟",
  "郑文文",
  "赵奇卓",
  "宓鸿宇",
  "曹越",
  "曹铭哲",
  "欧阳伊希",
  "窦雪茹",
  "陈毅强",
  "薛琳蕊",
  "陈佳杰",
  "刘一",
  "张福强",
  "杨倩仪",
  "王煦晖",
  "莫颖儿",
  "吕鸿",
  "冉晨宇",
  "张志权",
  "赖永涛",
  "江培章",
  "陈家兴",
  "严骏",
  "洪炯腾",
  "沈楚城",
  "张建生",
  "符永涛",
  "戴智斌",
  "马莘权",
  "徐宗泽",
  "龙辰",
  "胡毅薇",
  "许斯荣",
  "余一铭",
  "曹文跃",
  "李泽龙",
  "禹聪琪",
  "陈琼",
  "李娟娟",
  "刘瑞峰",
  "李斌琦",
  "林义章",
  "唐昊鸣",
  "王金淋",
  "洪思睿",
  "叶荣金",
  "郭雨明",
  "邹玙璠",
  "杨偲妤",
  "李红军",
  "刘源源",
  "顾元舜",
  "郝锦",
] as const;

export const DEFAULT_COMPANY_FINAL_REVIEWER_NAMES = [
  "吴承霖",
  "邱翔",
] as const;

export function resolveDefaultEmployeeSubjectIds(users: Array<{ id: string; name: string }>) {
  const wanted = new Set<string>(DEFAULT_EMPLOYEE_FINAL_REVIEW_NAMES);
  return users.filter((user) => wanted.has(user.name)).map((user) => user.id);
}

export function resolveDefaultCompanyFinalReviewerIds(users: Array<{ id: string; name: string }>) {
  const wanted = new Set<string>(DEFAULT_COMPANY_FINAL_REVIEWER_NAMES);
  return users.filter((user) => wanted.has(user.name)).map((user) => user.id);
}
