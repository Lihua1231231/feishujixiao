import type { EmployeeRow, LeaderRow } from "./types";

export type ScoreBandBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
  names: string[];
};

export type EmployeePriorityCard = {
  key: "pending" | "disagreement" | "anomaly" | "highBandPending" | "lowBandAnomaly";
  title: string;
  summary: string;
  description: string;
  count: number;
  rows: EmployeeRow[];
  accent: "slate" | "amber" | "rose" | "blue" | "violet";
};

export type LeaderPriorityCard = {
  key: "pending" | "awaitingDualSubmission" | "ready";
  title: string;
  summary: string;
  description: string;
  count: number;
  rows: LeaderRow[];
  accent: "slate" | "amber" | "emerald";
};

export type LeaderSubmissionSummary = {
  id: string;
  name: string;
  bothSubmitted: boolean;
  submittedCount: number;
  pendingReviewerCount: number;
  officialStars: number | null;
};

export function buildScoreBandBuckets(rows: EmployeeRow[]): ScoreBandBucket[] {
  const bands = [
    { label: "1.0-1.9", min: 1, max: 1.99 },
    { label: "2.0-2.9", min: 2, max: 2.99 },
    { label: "3.0-3.4", min: 3, max: 3.49 },
    { label: "3.5-3.9", min: 3.5, max: 3.99 },
    { label: "4.0-4.4", min: 4, max: 4.49 },
    { label: "4.5-5.0", min: 4.5, max: 5 },
  ];

  return bands.map((band) => {
    const matched = rows.filter((row) => row.weightedScore != null && row.weightedScore >= band.min && row.weightedScore <= band.max);
    return {
      ...band,
      count: matched.length,
      names: matched.map((row) => row.name),
    };
  });
}

export function buildEmployeePriorityGroups(rows: EmployeeRow[]) {
  return {
    pending: rows.filter((row) => row.officialStars == null),
    disagreement: rows.filter((row) => row.summaryStats.overrideCount > 0),
    anomaly: rows.filter((row) => row.anomalyTags.length > 0),
    highBandPending: rows.filter((row) => (row.weightedScore ?? 0) >= 4 && row.officialStars == null),
    lowBandAnomaly: rows.filter((row) => (row.weightedScore ?? 99) < 3 && row.anomalyTags.length > 0),
  };
}

export function buildEmployeeQueueGroups(rows: EmployeeRow[]) {
  const groups = buildEmployeePriorityGroups(rows);

  return {
    pending: groups.pending,
    disagreement: groups.disagreement,
    all: rows,
  };
}

function summarizeRows(rows: EmployeeRow[], emptySummary: string) {
  if (!rows.length) return emptySummary;
  const names = rows.slice(0, 3).map((row) => row.name).join("、");
  return rows.length > 3 ? `${names} 等 ${rows.length} 人` : names;
}

function summarizeLeaders(rows: LeaderRow[], emptySummary: string) {
  if (!rows.length) return emptySummary;
  const names = rows.slice(0, 3).map((row) => row.name).join("、");
  return rows.length > 3 ? `${names} 等 ${rows.length} 人` : names;
}

export function buildEmployeePriorityCards(rows: EmployeeRow[]): EmployeePriorityCard[] {
  const groups = buildEmployeePriorityGroups(rows);

  return [
    {
      key: "pending",
      title: "待拍板",
      summary: groups.pending.length ? `${groups.pending.length} 人还没有最终确认` : "当前没有待拍板员工",
      description: groups.pending.length
        ? `优先处理 ${summarizeRows(groups.pending, "")}，先完成最终确认再看其余队列。`
        : "当前每位普通员工都已经有官方结果。",
      count: groups.pending.length,
      rows: groups.pending,
      accent: "slate",
    },
    {
      key: "disagreement",
      title: "意见分歧大",
      summary: groups.disagreement.length ? `${groups.disagreement.length} 人出现改星意见` : "当前没有明显分歧",
      description: groups.disagreement.length
        ? `重点核对 ${summarizeRows(groups.disagreement, "")} 的理由，避免遗漏需要解释的改星意见。`
        : "具名拍板人的意见暂时没有出现明显冲突。",
      count: groups.disagreement.length,
      rows: groups.disagreement,
      accent: "amber",
    },
    {
      key: "anomaly",
      title: "超线敏感区",
      summary: groups.anomaly.length ? `${groups.anomaly.length} 人带有风险信号` : "当前没有风险信号",
      description: groups.anomaly.length
        ? `这些员工出现了改星意见、初评分差或已拍板改星，建议先确认 ${summarizeRows(groups.anomaly, "")} 的证据。`
        : "当前没有员工落在需要优先解释的风险区。",
      count: groups.anomaly.length,
      rows: groups.anomaly,
      accent: "rose",
    },
    {
      key: "highBandPending",
      title: "高分带未定",
      summary: groups.highBandPending.length ? `${groups.highBandPending.length} 位高分员工未拍板` : "高分带都已完成确认",
      description: groups.highBandPending.length
        ? `高分带里的 ${summarizeRows(groups.highBandPending, "")} 仍在等待最终拍板。`
        : "当前高分带员工都已经确认完毕。",
      count: groups.highBandPending.length,
      rows: groups.highBandPending,
      accent: "blue",
    },
    {
      key: "lowBandAnomaly",
      title: "低分带异常",
      summary: groups.lowBandAnomaly.length ? `${groups.lowBandAnomaly.length} 位低分异常待解释` : "低分带暂无异常组合",
      description: groups.lowBandAnomaly.length
        ? `低分带里的 ${summarizeRows(groups.lowBandAnomaly, "")} 同时伴随真实风险信号，需要补足理由。`
        : "当前低分带没有同时伴随风险信号的员工。",
      count: groups.lowBandAnomaly.length,
      rows: groups.lowBandAnomaly,
      accent: "violet",
    },
  ];
}

export function buildLeaderSubmissionSummary(rows: LeaderRow[]) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    bothSubmitted: row.bothSubmitted,
    submittedCount: row.submissionSummary.submittedCount,
    pendingReviewerCount: row.submissionSummary.pendingCount,
    officialStars: row.officialStars,
  }));
}

export function buildLeaderPriorityCards(rows: LeaderRow[]): LeaderPriorityCard[] {
  const pending = rows.filter((row) => row.officialStars == null);
  const awaitingDualSubmission = rows.filter((row) => !row.bothSubmitted);
  const ready = rows.filter((row) => row.bothSubmitted && row.officialStars == null);

  return [
    {
      key: "pending",
      title: "待拍板",
      summary: pending.length ? `${pending.length} 位主管还没有官方结果` : "当前没有待拍板主管",
      description: pending.length
        ? `优先关注 ${summarizeLeaders(pending, "")}，先补齐最终决策再回看其他主管。`
        : "当前所有主管都已经有正式拍板结果。",
      count: pending.length,
      rows: pending,
      accent: "slate",
    },
    {
      key: "awaitingDualSubmission",
      title: "待双人齐备",
      summary: awaitingDualSubmission.length ? `${awaitingDualSubmission.length} 位主管还在等双人提交` : "双人问卷都已齐备",
      description: awaitingDualSubmission.length
        ? `先提醒 ${summarizeLeaders(awaitingDualSubmission, "")} 的填写人完成提交，避免最终确认卡住。`
        : "当前每位主管的两份终评问卷都已经提交。",
      count: awaitingDualSubmission.length,
      rows: awaitingDualSubmission,
      accent: "amber",
    },
    {
      key: "ready",
      title: "可拍板",
      summary: ready.length ? `${ready.length} 位主管已经双人齐备` : "暂时还没有可直接拍板的主管",
      description: ready.length
        ? `双人意见已经齐备的 ${summarizeLeaders(ready, "")} 可以直接进入最终决策。`
        : "等两位填写人都提交后，这里会自动出现可拍板主管。",
      count: ready.length,
      rows: ready,
      accent: "emerald",
    },
  ];
}

export function buildLeaderQueueGroups(rows: LeaderRow[]) {
  const pending = rows.filter((row) => row.officialStars == null);
  const awaitingDual = rows.filter((row) => !row.bothSubmitted);

  return {
    pending,
    awaitingDual,
    all: rows,
  };
}
