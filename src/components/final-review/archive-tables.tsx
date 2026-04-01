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
    return chenglin.suggestedStars ?? emp.referenceStars;
  }
  return emp.officialStars;
}

function formatLeaderEvalGrade(form: LeaderForm) {
  const weighted = computeWeightedScoreFromDimensions({
    performanceStars: form.performanceStars,
    comprehensiveStars: form.comprehensiveStars,
    learningStars: form.learningStars,
    adaptabilityStars: form.adaptabilityStars,
    candidStars: form.candidStars,
    progressStars: form.progressStars,
    altruismStars: form.altruismStars,
    rootStars: form.rootStars,
  });
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
  const filteredEmployees = useMemo(
    () => keyword ? employees.filter((e) => e.name.toLowerCase().includes(keyword) || e.department.toLowerCase().includes(keyword)) : employees,
    [employees, keyword],
  );
  const filteredLeaders = useMemo(
    () => keyword ? leaders.filter((l) => l.name.toLowerCase().includes(keyword) || l.department.toLowerCase().includes(keyword)) : leaders,
    [leaders, keyword],
  );

  return (
    <div className="space-y-6">
      <Input
        placeholder="搜索姓名或团队"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">员工层绩效终评校准留档</h2>
        <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">共 {employees.length} 人{keyword ? `，当前筛选 ${filteredEmployees.length} 人` : ""}</p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[80px]">姓名</TableHead>
                <TableHead className="min-w-[100px]">团队</TableHead>
                <TableHead className="min-w-[100px]">360环评填写数</TableHead>
                <TableHead className="min-w-[100px]">360环评均分</TableHead>
                <TableHead className="min-w-[180px]">校准前等级（直属上级绩效初评）</TableHead>
                <TableHead className="min-w-[100px]">是否发生校准</TableHead>
                <TableHead className="min-w-[200px]">邱翔终评等级和说明</TableHead>
                <TableHead className="min-w-[200px]">承霖终评等级和说明</TableHead>
                <TableHead className="min-w-[180px]">公司级绩效校准（终评）等级</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const qiuxiang = findOpinionByName(emp.opinions, "邱翔");
                const chenglin = findOpinionByName(emp.opinions, "承霖");
                const calibrated = emp.agreementState === "DISAGREED";
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.peerReviewSummary?.count ?? 0}</TableCell>
                    <TableCell>{emp.peerAverage?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{stars(emp.referenceStars)}</TableCell>
                    <TableCell>{calibrated ? "是" : "否"}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{formatOpinionCell(qiuxiang, emp.referenceStars)}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{formatOpinionCell(chenglin, emp.referenceStars)}</TableCell>
                    <TableCell className="font-medium">{stars(resolveEmployeeFinalStars(emp))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-[28px] border p-5 md:p-6" style={panelStyle}>
        <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">主管层绩效终评校准留档</h2>
        <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">共 {leaders.length} 人{keyword ? `，当前筛选 ${filteredLeaders.length} 人` : ""}</p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[80px]">姓名</TableHead>
                <TableHead className="min-w-[100px]">团队</TableHead>
                <TableHead className="min-w-[220px]">直属上级初评（等级）-邱翔</TableHead>
                <TableHead className="min-w-[220px]">直属上级初评（评语）-邱翔</TableHead>
                <TableHead className="min-w-[220px]">直属上级初评（等级）-承霖</TableHead>
                <TableHead className="min-w-[220px]">直属上级初评（评语）-承霖</TableHead>
                <TableHead className="min-w-[180px]">绩效终评等级（按承霖+邱翔 1:1）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaders.map((leader) => {
                const qiuxiangEval = leader.evaluations.find((e) => e.evaluatorName.includes("邱翔"));
                const chenglinEval = leader.evaluations.find((e) => e.evaluatorName.includes("承霖"));
                const qiuxiangKey = qiuxiangEval ? `${leader.id}:${qiuxiangEval.evaluatorId}` : null;
                const chenglinKey = chenglinEval ? `${leader.id}:${chenglinEval.evaluatorId}` : null;
                const qiuxiangForm = (qiuxiangKey ? leaderForms[qiuxiangKey] : null) ?? qiuxiangEval?.form;
                const chenglinForm = (chenglinKey ? leaderForms[chenglinKey] : null) ?? chenglinEval?.form;

                return (
                  <TableRow key={leader.id}>
                    <TableCell className="font-medium">{leader.name}</TableCell>
                    <TableCell>{leader.department}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{qiuxiangForm ? formatLeaderEvalGrade(qiuxiangForm) : "—"}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{qiuxiangForm ? formatLeaderEvalComment(qiuxiangForm) : "—"}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{chenglinForm ? formatLeaderEvalGrade(chenglinForm) : "—"}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-xs">{chenglinForm ? formatLeaderEvalComment(chenglinForm) : "—"}</TableCell>
                    <TableCell className="font-medium">{stars(leader.officialStars)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
