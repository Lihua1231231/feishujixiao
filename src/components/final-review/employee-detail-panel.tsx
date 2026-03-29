"use client";

import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EmployeeOpinion, EmployeeRow } from "./types";

type EmployeeOpinionFormValue = {
  decision: "PENDING" | "AGREE" | "OVERRIDE";
  suggestedStars: number | null;
  reason: string;
};

export type EmployeeDetailPanelProps = {
  title: string;
  employee: EmployeeRow | null;
  opinionForm: EmployeeOpinionFormValue | null;
  savingOpinion: boolean;
  onOpinionChange: (patch: Partial<EmployeeOpinionFormValue>) => void;
  onSaveOpinion: () => void;
};

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function getDecisionTone(decision: string) {
  if (decision === "AGREE") return "default";
  if (decision === "OVERRIDE") return "destructive";
  return "outline";
}

function renderStars(value: number | null, fallback: string) {
  if (value == null) return fallback;
  return `${value} 星`;
}

function findOpinionByReviewerName(opinions: EmployeeOpinion[], keyword: string) {
  return opinions.find((opinion) => opinion.reviewerName.includes(keyword)) || null;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3">
      <p className="text-xs text-[var(--cockpit-muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{value}</p>
    </div>
  );
}

function OpinionCard({ opinion }: { opinion: EmployeeOpinion }) {
  return (
    <div className="rounded-2xl border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--cockpit-foreground)]">{opinion.reviewerName}</p>
          <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
            建议星级：{renderStars(opinion.suggestedStars, "—")}
          </p>
        </div>
        <Badge variant={getDecisionTone(opinion.decision) as "default" | "destructive" | "outline"}>
          {opinion.decisionLabel}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--cockpit-foreground)]">{opinion.reason || "当前还没有填写补充说明。"}</p>
    </div>
  );
}

export function EmployeeDetailPanel({
  title,
  employee,
  opinionForm,
  savingOpinion,
  onOpinionChange,
  onSaveOpinion,
}: EmployeeDetailPanelProps) {
  const [expandedSupervisorCommentEmployeeId, setExpandedSupervisorCommentEmployeeId] = useState<string | null>(null);
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  if (!employee) {
    return (
      <aside className="sticky top-6">
        <section className="rounded-[28px] border border-dashed p-8 text-sm leading-7 text-[var(--cockpit-muted-foreground)]" style={panelStyle}>
          从左侧重点名单或搜索员工名册里选中一位员工，右侧会先给你看决策摘要，再视权限展开过程信息。
        </section>
      </aside>
    );
  }

  const myOpinion = employee.opinions.find((item) => item.isMine);
  const expandedSupervisorComment = expandedSupervisorCommentEmployeeId === employee.id;
  const canExpandSupervisorComment = (employee.supervisorCommentSummary?.length || 0) > 120;
  const opinionSummaryText =
    employee.opinionSummary.map((item) => `${item.label} ${item.count} 人`).join(" · ") || "当前还没有形成意见分布。";
  const opinionDecisionOptions: Array<{ value: EmployeeOpinionFormValue["decision"]; label: string }> = [
    { value: "PENDING", label: "待处理" },
    { value: "AGREE", label: "同意参考星级" },
    { value: "OVERRIDE", label: "改为其他星级" },
  ];
  const chenglinOpinion = findOpinionByReviewerName(employee.opinions, "承霖");
  const qiuxiangOpinion = findOpinionByReviewerName(employee.opinions, "邱翔");
  const agreementSummary =
    employee.agreementState === "AGREED"
      ? `两位校准人已经一致，同意形成 ${renderStars(employee.officialStars, "—")} 的官方结果。`
      : employee.agreementState === "DISAGREED"
        ? "两位校准人都已经处理，但当前结论不一致，暂时不会形成官方结果。"
        : "承霖、邱翔尚未都完成当前员工的校准动作，系统暂时只保留参考星级。";

  return (
    <aside className="sticky top-6 space-y-4">
      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cockpit-muted-foreground)]">{title}</p>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-[var(--cockpit-foreground)]">{employee.name}</h3>
            <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">
              {employee.department}
              {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
            </p>
          </div>
          <Badge variant={employee.officialStars == null ? "outline" : "default"}>
            {employee.officialStars == null ? "待双人校准" : "已形成结果，可切换下一位"}
          </Badge>
        </div>

        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">当前结论</p>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
            参考星级来自初评加权分换算。普通员工终评只看承霖、邱翔两位校准人的结论；两人一致时，系统会自动形成官方结果。
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryCard label="参考星级" value={renderStars(employee.referenceStars, "—")} />
          <SummaryCard label="当前官方星级" value={renderStars(employee.officialStars, "待确认")} />
          <SummaryCard
            label="处理进度"
            value={`已处理 ${employee.summaryStats.handledCount}/${employee.summaryStats.totalReviewerCount}`}
          />
          <SummaryCard label="校准状态" value={employee.agreementState === "AGREED" ? "已一致" : employee.agreementState === "DISAGREED" ? "有分歧" : "待两位完成"} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">承霖校准</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">
              {chenglinOpinion ? `${chenglinOpinion.decisionLabel} · ${renderStars(chenglinOpinion.suggestedStars, "—")}` : "待处理"}
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">邱翔校准</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">
              {qiuxiangOpinion ? `${qiuxiangOpinion.decisionLabel} · ${renderStars(qiuxiangOpinion.suggestedStars, "—")}` : "待处理"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-xs text-[var(--cockpit-muted-foreground)]">校准结论</p>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]">
            {agreementSummary}
            {employee.anomalyTags.length > 0 ? ` 当前风险信号：${employee.anomalyTags.join("、")}。` : " 当前没有额外风险信号。"}
          </p>
        </div>

        {employee.officialStars != null ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
            已确认，可切换下一位。
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">证据摘要</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryCard label="初评加权分" value={employee.weightedScore?.toFixed(1) ?? "—"} />
          <SummaryCard label="360 均分" value={employee.peerAverage?.toFixed(1) ?? "—"} />
          <SummaryCard label="自评状态" value={employee.selfEvalStatus || "未导入"} />
          <SummaryCard label="初评人" value={employee.currentEvaluatorNames.join("、") || "未配置"} />
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-xs text-[var(--cockpit-muted-foreground)]">参考说明</p>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]">{employee.referenceSourceLabel}</p>
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-xs text-[var(--cockpit-muted-foreground)]">初评评语摘要</p>
          <p
            className={cn(
              "mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]",
              !expandedSupervisorComment && "line-clamp-4",
            )}
          >
            {employee.supervisorCommentSummary || "当前还没有可供参考的初评评语摘要。"}
          </p>
          {canExpandSupervisorComment ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-auto px-0 text-sm text-[var(--cockpit-accent-strong)] hover:bg-transparent"
              onClick={() =>
                setExpandedSupervisorCommentEmployeeId((current) => (current === employee.id ? null : employee.id))
              }
            >
              {expandedSupervisorComment ? "收起全文" : "展开全文"}
            </Button>
          ) : null}
        </div>
        <div className="mt-4 space-y-2">
          {employee.currentEvaluatorStatuses.map((status) => (
            <div key={status.evaluatorId} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
              <span className="text-[var(--cockpit-foreground)]">{status.evaluatorName}</span>
              <span className="text-[var(--cockpit-muted-foreground)]">
                {status.status} · 加权分 {status.weightedScore?.toFixed(1) ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">双人校准状态</p>
            <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{opinionSummaryText}</p>
          </div>
          {employee.anomalyTags.length > 0 ? <Badge variant="destructive">{employee.anomalyTags.join(" / ")}</Badge> : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="已处理" value={`${employee.summaryStats.handledCount} 人`} />
          <SummaryCard label="待处理" value={`${employee.summaryStats.pendingCount} 人`} />
          <SummaryCard label="主张改星" value={`${employee.summaryStats.overrideCount} 人`} />
        </div>

        <div className="mt-4 rounded-2xl border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">两位校准人</p>
            <Badge variant={employee.canViewOpinionDetails ? "secondary" : "outline"}>
              {employee.canViewOpinionDetails ? "已开放" : "已隐藏"}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
            {employee.canViewOpinionDetails
              ? "这里直接看承霖、邱翔各自的校准结论；只有具备权限的人才展开改星理由。"
              : "当前视图只保留汇总口径，不展开承霖、邱翔的补充理由原文。"}
          </p>
        </div>

        {employee.canViewOpinionDetails ? (
          <div className="mt-4 space-y-3">
            {employee.opinions.map((opinion) => (
              <OpinionCard key={opinion.reviewerId} opinion={opinion} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed px-4 py-4 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
            已处理 {employee.summaryStats.handledCount}/{employee.summaryStats.totalReviewerCount}，其中改星 {employee.summaryStats.overrideCount} 人。
          </div>
        )}

        {employee.canSubmitOpinion && myOpinion ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">我的校准动作</p>
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">承霖、邱翔分别独立校准；两位星级一致时，系统会自动形成官方结果。</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {opinionDecisionOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={opinionForm?.decision === option.value ? "default" : "outline"}
                  onClick={() => onOpinionChange({ decision: option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((stars) => (
                <Button
                  key={stars}
                  type="button"
                  variant={opinionForm?.suggestedStars === stars ? "default" : "outline"}
                  disabled={opinionForm?.decision === "PENDING"}
                  onClick={() => onOpinionChange({ suggestedStars: stars })}
                >
                  {stars}星
                </Button>
              ))}
            </div>

            <Textarea
              value={opinionForm?.reason || ""}
              onChange={(event) => onOpinionChange({ reason: event.target.value })}
              placeholder={opinionForm?.decision === "OVERRIDE" ? "更改为其他星级时请填写理由" : "如有补充说明，可在此填写"}
            />
            <Button onClick={onSaveOpinion} disabled={savingOpinion}>
              {savingOpinion ? "保存中..." : "保存我的终评意见"}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">过程留痕</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">系统生成说明</p>
            <p className="mt-2 leading-6 text-[var(--cockpit-foreground)]">{employee.officialReason || "当前还没有形成自动结果说明。"}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">最后自动生成时间</p>
            <p className="mt-2 text-[var(--cockpit-foreground)]">{formatTime(employee.officialConfirmedAt)}</p>
          </div>
          {employee.canViewOpinionDetails ? (
            <div className="space-y-2">
              {employee.opinions.map((opinion) => (
                <div key={`${opinion.reviewerId}:audit`} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                  <span className="text-[var(--cockpit-foreground)]">{opinion.reviewerName}</span>
                  <span className="text-[var(--cockpit-muted-foreground)]">{formatTime(opinion.updatedAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-4 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
              当前视图只显示处理汇总，不逐人展开每位校准人的留痕。
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
