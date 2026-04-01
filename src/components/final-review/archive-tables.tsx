"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeRow, LeaderForm, LeaderRow } from "./types";
import {
  computeAbilityAverage,
  computeValuesAverage,
  computeWeightedScoreFromDimensions,
} from "@/lib/weighted-score";

const ROOT_NAMES = new Set(["曹铭哲", "曹越", "宓鸿宇"]);

function stars(value: number | null) {
  return value != null ? `${value}星` : "—";
}

function findOpinionByName(opinions: EmployeeRow["opinions"], keyword: string) {
  return opinions.find((o) => o.reviewerName.includes(keyword)) || null;
}

function formatOpinionCell(opinion: ReturnType<typeof findOpinionByName>, referenceStars: number | null) {
  if (!opinion || opinion.decision === "PENDING") return "—";
  const s = opinion.decision === "AGREE"
    ? stars(opinion.suggestedStars ?? referenceStars)
    : stars(opinion.suggestedStars);
  const reason = opinion.reason ? `\n${opinion.reason}` : "";
  return `${s}${reason}`;
}

function resolveEmployeeFinalStars(emp: EmployeeRow): number | null {
  const chenglin = findOpinionByName(emp.opinions, "承霖");
  if (chenglin && chenglin.decision !== "PENDING") {
    if (chenglin.decision === "AGREE") {
      return chenglin.suggestedStars ?? emp.referenceStars;
    }
    return chenglin.suggestedStars;
  }
  return emp.officialStars ?? emp.referenceStars;
}

function formatEmployeeFinalCell(emp: EmployeeRow): string {
  const finalStars = resolveEmployeeFinalStars(emp);
  const label = stars(finalStars);
  const calibrated = emp.agreementState === "DISAGREED";
  return calibrated ? `${label}（发生校准）` : label;
}

function getChenglinWeightedScore(form: LeaderForm | undefined | null): number | null {
  if (!form) return null;
  return computeWeightedScoreFromDimensions({
    performanceStars: form.performanceStars,
    comprehensiveStars: form.comprehensiveStars,
    learningStars: form.learningStars,
    adaptabilityStars: form.adaptabilityStars,
    candidStars: form.candidStars,
    progressStars: form.progressStars,
    altruismStars: form.altruismStars,
    rootStars: form.rootStars,
  });
}

function formatLeaderEvalGrade(form: LeaderForm) {
  const weighted = getChenglinWeightedScore(form);
  const ability = computeAbilityAverage(form.comprehensiveStars, form.learningStars, form.adaptabilityStars);
  const values = computeValuesAverage(form.candidStars, form.progressStars, form.altruismStars, form.rootStars);
  const lines = [
    `加权总分: ${weighted?.toFixed(1) ?? "—"}`,
    `业绩产出: ${form.performanceStars ?? "—"}`,
    `个人能力: ${ability?.toFixed(1) ?? "—"} (综合${form.comprehensiveStars ?? "—"}/学习${form.learningStars ?? "—"}/适应${form.adaptabilityStars ?? "—"})`,
    `价值观: ${values?.toFixed(1) ?? "—"} (坦诚${form.candidStars ?? "—"}/进取${form.progressStars ?? "—"}/利他${form.altruismStars ?? "—"}/ROOT${form.rootStars ?? "—"})`,
  ];
  return lines.join("\n");
}

function formatLeaderEvalComment(form: LeaderForm) {
  const parts = [
    form.performanceComment ? `业绩产出: ${form.performanceComment}` : null,
    form.abilityComment ? `个人能力: ${form.abilityComment}` : null,
    form.valuesComment ? `价值观: ${form.valuesComment}` : null,
    form.candidComment ? `坦诚真实: ${form.candidComment}` : null,
    form.progressComment ? `极致进取: ${form.progressComment}` : null,
    form.altruismComment ? `成就利他: ${form.altruismComment}` : null,
    form.rootComment ? `ROOT: ${form.rootComment}` : null,
  ].filter(Boolean);
  return parts.join("\n") || "—";
}

function resolveLeaderForms(leader: LeaderRow, leaderForms: Record<string, LeaderForm>) {
  const qiuxiangEval = leader.evaluations.find((e) => e.evaluatorName.includes("邱翔"));
  const chenglinEval = leader.evaluations.find((e) => e.evaluatorName.includes("承霖"));
  const qiuxiangKey = qiuxiangEval ? `${leader.id}:${qiuxiangEval.evaluatorId}` : null;
  const chenglinKey = chenglinEval ? `${leader.id}:${chenglinEval.evaluatorId}` : null;
  return {
    qiuxiangForm: (qiuxiangKey ? leaderForms[qiuxiangKey] : null) ?? qiuxiangEval?.form,
    chenglinForm: (chenglinKey ? leaderForms[chenglinKey] : null) ?? chenglinEval?.form,
  };
}

type ArchiveTablesProps = {
  employees: EmployeeRow[];
  leaders: LeaderRow[];
  leaderForms: Record<string, LeaderForm>;
};

export function ArchiveTables({ employees, leaders, leaderForms }: ArchiveTablesProps) {
  const [search, setSearch] = useState("");
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  const keyword = search.trim().toLowerCase();
  const matchesKeyword = (name: string, department: string) =>
    !keyword || name.toLowerCase().includes(keyword) || department.toLowerCase().includes(keyword);

  const nonRootEmployees = useMemo(() => employees.filter((e) => !ROOT_NAMES.has(e.name)), [employees]);
  const nonRootLeaders = useMemo(() => leaders.filter((l) => !ROOT_NAMES.has(l.name)), [leaders]);
  const rootEmployees = useMemo(() => employees.filter((e) => ROOT_NAMES.has(e.name)), [employees]);
  const rootLeaders = useMemo(() => leaders.filter((l) => ROOT_NAMES.has(l.name)), [leaders]);

  const filteredEmployees = useMemo(() => nonRootEmployees.filter((e) => matchesKeyword(e.name, e.department)), [nonRootEmployees, keyword]);
  const filteredLeaders = useMemo(() => nonRootLeaders.filter((l) => matchesKeyword(l.name, l.department)), [nonRootLeaders, keyword]);
  const filteredRootEmployees = useMemo(() => rootEmployees.filter((e) => matchesKeyword(e.name, e.department)), [rootEmployees, keyword]);
  const filteredRootLeaders = useMemo(() => rootLeaders.filter((l) => matchesKeyword(l.name, l.department)), [rootLeaders, keyword]);

  return (
    <div className="space-y-6">
      <Input
        placeholder="搜索姓名或团队"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* 员工层 */}
      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">员工层绩效终评校准留档</h2>
        <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">共 {nonRootEmployees.length} 人{keyword ? `，当前筛选 ${filteredEmployees.length} 人` : ""}</p>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>团队</TableHead>
                <TableHead>360环评填写数</TableHead>
                <TableHead>360环评均分</TableHead>
                <TableHead>校准前等级（直属上级绩效初评）</TableHead>
                <TableHead>邱翔终评等级和说明</TableHead>
                <TableHead>承霖终评等级和说明</TableHead>
                <TableHead>公司级绩效校准（终评）等级</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const qiuxiang = findOpinionByName(emp.opinions, "邱翔");
                const chenglin = findOpinionByName(emp.opinions, "承霖");
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.peerReviewSummary?.count ?? 0}</TableCell>
                    <TableCell>{emp.peerAverage?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{stars(emp.referenceStars)}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{formatOpinionCell(qiuxiang, emp.referenceStars)}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{formatOpinionCell(chenglin, emp.referenceStars)}</TableCell>
                    <TableCell className="font-medium">{formatEmployeeFinalCell(emp)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 主管层 */}
      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">主管层绩效终评校准留档</h2>
        <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">共 {nonRootLeaders.length} 人{keyword ? `，当前筛选 ${filteredLeaders.length} 人` : ""}</p>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>团队</TableHead>
                <TableHead>直属上级初评（等级）-邱翔</TableHead>
                <TableHead>直属上级初评（评语）-邱翔</TableHead>
                <TableHead>直属上级初评（等级）-承霖</TableHead>
                <TableHead>直属上级初评（评语）-承霖</TableHead>
                <TableHead>最终绩效分数</TableHead>
                <TableHead>绩效终评等级（按承霖+邱翔 1:1）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaders.map((leader) => {
                const { qiuxiangForm, chenglinForm } = resolveLeaderForms(leader, leaderForms);
                const chenglinScore = getChenglinWeightedScore(chenglinForm);
                return (
                  <TableRow key={leader.id}>
                    <TableCell className="font-medium">{leader.name}</TableCell>
                    <TableCell>{leader.department}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{qiuxiangForm ? formatLeaderEvalGrade(qiuxiangForm) : "—"}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{qiuxiangForm ? formatLeaderEvalComment(qiuxiangForm) : "—"}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{chenglinForm ? formatLeaderEvalGrade(chenglinForm) : "—"}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{chenglinForm ? formatLeaderEvalComment(chenglinForm) : "—"}</TableCell>
                    <TableCell className="font-medium">{chenglinScore?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell className="font-medium">{stars(leader.officialStars)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ROOT 独立评估 */}
      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">ROOT 独立评估留档</h2>
        <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">曹铭哲、曹越、宓鸿宇</p>

        {filteredRootEmployees.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-[var(--cockpit-foreground)]">员工层维度</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>团队</TableHead>
                  <TableHead>360环评填写数</TableHead>
                  <TableHead>360环评均分</TableHead>
                  <TableHead>校准前等级（直属上级绩效初评）</TableHead>
                  <TableHead>邱翔终评等级和说明</TableHead>
                  <TableHead>承霖终评等级和说明</TableHead>
                  <TableHead>公司级绩效校准（终评）等级</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRootEmployees.map((emp) => {
                  const qiuxiang = findOpinionByName(emp.opinions, "邱翔");
                  const chenglin = findOpinionByName(emp.opinions, "承霖");
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.peerReviewSummary?.count ?? 0}</TableCell>
                      <TableCell>{emp.peerAverage?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell>{stars(emp.referenceStars)}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{formatOpinionCell(qiuxiang, emp.referenceStars)}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{formatOpinionCell(chenglin, emp.referenceStars)}</TableCell>
                      <TableCell className="font-medium">{formatEmployeeFinalCell(emp)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {filteredRootLeaders.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-[var(--cockpit-foreground)]">主管层维度</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>团队</TableHead>
                  <TableHead>直属上级初评（等级）-邱翔</TableHead>
                  <TableHead>直属上级初评（评语）-邱翔</TableHead>
                  <TableHead>直属上级初评（等级）-承霖</TableHead>
                  <TableHead>直属上级初评（评语）-承霖</TableHead>
                  <TableHead>最终绩效分数</TableHead>
                  <TableHead>绩效终评等级（按承霖+邱翔 1:1）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRootLeaders.map((leader) => {
                  const { qiuxiangForm, chenglinForm } = resolveLeaderForms(leader, leaderForms);
                  const chenglinScore = getChenglinWeightedScore(chenglinForm);
                  return (
                    <TableRow key={leader.id}>
                      <TableCell className="font-medium">{leader.name}</TableCell>
                      <TableCell>{leader.department}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs">{qiuxiangForm ? formatLeaderEvalGrade(qiuxiangForm) : "—"}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs">{qiuxiangForm ? formatLeaderEvalComment(qiuxiangForm) : "—"}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs">{chenglinForm ? formatLeaderEvalGrade(chenglinForm) : "—"}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-xs">{chenglinForm ? formatLeaderEvalComment(chenglinForm) : "—"}</TableCell>
                      <TableCell className="font-medium">{chenglinScore?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell className="font-medium">{stars(leader.officialStars)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
