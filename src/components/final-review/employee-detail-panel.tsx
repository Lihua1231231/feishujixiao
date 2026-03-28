"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeOpinion, EmployeeRow } from "./types";

type EmployeeOpinionFormValue = {
  decision: "PENDING" | "AGREE" | "OVERRIDE";
  suggestedStars: number | null;
  reason: string;
};

type EmployeeConfirmFormValue = {
  officialStars: number | null;
  reason: string;
};

export type EmployeeDetailPanelProps = {
  title: string;
  employee: EmployeeRow | null;
  opinionForm: EmployeeOpinionFormValue | null;
  confirmForm: EmployeeConfirmFormValue | null;
  savingOpinion: boolean;
  savingConfirmation: boolean;
  onOpinionChange: (patch: Partial<EmployeeOpinionFormValue>) => void;
  onConfirmChange: (patch: Partial<EmployeeConfirmFormValue>) => void;
  onSaveOpinion: () => void;
  onConfirm: () => void;
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
  confirmForm,
  savingOpinion,
  savingConfirmation,
  onOpinionChange,
  onConfirmChange,
  onSaveOpinion,
  onConfirm,
}: EmployeeDetailPanelProps) {
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
  const opinionSummaryText =
    employee.opinionSummary.map((item) => `${item.label} ${item.count} 人`).join(" · ") || "当前还没有形成意见分布。";
  const opinionDecisionOptions: Array<{ value: EmployeeOpinionFormValue["decision"]; label: string }> = [
    { value: "PENDING", label: "待处理" },
    { value: "AGREE", label: "同意参考星级" },
    { value: "OVERRIDE", label: "改为其他星级" },
  ];

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
            {employee.officialStars == null ? "待拍板" : "已拍板"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryCard label="参考星级" value={renderStars(employee.referenceStars, "—")} />
          <SummaryCard label="当前官方星级" value={renderStars(employee.officialStars, "待确认")} />
          <SummaryCard
            label="处理进度"
            value={`已处理 ${employee.summaryStats.handledCount}/${employee.summaryStats.totalReviewerCount}`}
          />
          <SummaryCard label="改星意见" value={`${employee.summaryStats.overrideCount} 人`} />
        </div>

        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-xs text-[var(--cockpit-muted-foreground)]">当前判断</p>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]">
            {employee.summaryStats.pendingCount > 0
              ? `还有 ${employee.summaryStats.pendingCount} 位终评相关人待处理。`
              : "终评相关人都已经给出意见。"}
            {employee.anomalyTags.length > 0 ? ` 当前风险信号：${employee.anomalyTags.join("、")}。` : " 当前没有额外风险信号。"}
          </p>
        </div>

        {employee.finalizable ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-[color:var(--cockpit-border)] bg-white/70 p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">最终拍板</p>
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">先点选官方星级，再补充正式确认理由。</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((stars) => (
                <Button
                  key={stars}
                  type="button"
                  variant={confirmForm?.officialStars === stars ? "default" : "outline"}
                  onClick={() => onConfirmChange({ officialStars: stars })}
                >
                  {stars}星
                </Button>
              ))}
            </div>
            <Textarea
              value={confirmForm?.reason || ""}
              onChange={(event) => onConfirmChange({ reason: event.target.value })}
              placeholder="若官方星级不同于参考星级，必须填写理由"
            />
            <Button className="w-full" onClick={onConfirm} disabled={savingConfirmation}>
              {savingConfirmation ? "确认中..." : "最终确认"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed px-4 py-3 text-sm text-[var(--cockpit-muted-foreground)]">
            当前你不是最终确认人，这里只持续显示最新官方结果和确认理由。
          </div>
        )}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">意见汇总</p>
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
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">具名意见</p>
            <Badge variant={employee.canViewOpinionDetails ? "secondary" : "outline"}>
              {employee.canViewOpinionDetails ? "已开放" : "已隐藏"}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
            {employee.canViewOpinionDetails
              ? "你可以直接查看每位终评相关人的建议星级和补充说明。"
              : "当前视图只保留汇总口径，不展开每位终评相关人的姓名和原文。"}
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

        {myOpinion ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">我的处理动作</p>
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">先选处理结论，再决定是否调整建议星级。</p>
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
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]">
            {employee.supervisorCommentSummary || "当前还没有可供参考的初评评语摘要。"}
          </p>
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
        <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">过程留痕</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">官方确认理由</p>
            <p className="mt-2 leading-6 text-[var(--cockpit-foreground)]">{employee.officialReason || "当前还没有填写官方确认理由。"}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">最后确认时间</p>
            <p className="mt-2 text-[var(--cockpit-foreground)]">{formatTime(employee.officialConfirmedAt)}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">最后确认人</p>
            <p className="mt-2 text-[var(--cockpit-foreground)]">{employee.officialConfirmerName || "—"}</p>
          </div>
          <div className="space-y-2">
            {employee.opinions.map((opinion) => (
              <div key={`${opinion.reviewerId}:audit`} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                <span className="text-[var(--cockpit-foreground)]">{employee.canViewOpinionDetails ? opinion.reviewerName : opinion.decisionLabel}</span>
                <span className="text-[var(--cockpit-muted-foreground)]">{formatTime(opinion.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
