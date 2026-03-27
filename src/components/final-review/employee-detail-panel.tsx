"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeRow } from "./types";

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
          从左侧重点名单中选择一位员工，右侧会依次显示最终决策、意见汇总、证据摘要和过程留痕。
        </section>
      </aside>
    );
  }

  const myOpinion = employee.opinions.find((item) => item.isMine);
  const pendingOpinions = employee.opinions.filter((item) => item.decision === "PENDING").length;
  const overrideOpinions = employee.opinions.filter((item) => item.decision === "OVERRIDE").length;

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
          <Badge variant={employee.officialConfirmedAt ? "default" : "outline"}>
            {employee.officialConfirmedAt ? "已拍板" : "待拍板"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">参考星级</p>
              <p className="mt-2 text-lg font-semibold text-[var(--cockpit-foreground)]">
                {renderStars(employee.referenceStars, "—")}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">当前官方星级</p>
              <p className="mt-2 text-lg font-semibold text-[var(--cockpit-foreground)]">
                {renderStars(employee.officialStars, "待确认")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">当前状态</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">
                已有 {employee.handledCount}/{employee.totalReviewerCount} 位终评相关人处理
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3">
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">最后确认人</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{employee.officialConfirmerName || "—"}</p>
            </div>
          </div>

          {employee.finalizable ? (
            <div className="space-y-3 rounded-2xl border border-[color:var(--cockpit-border)] bg-white/70 p-4">
              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <select
                  value={confirmForm?.officialStars ?? ""}
                  onChange={(e) => onConfirmChange({ officialStars: e.target.value ? Number(e.target.value) : null })}
                  className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                >
                  <option value="">选择官方星级</option>
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <option key={stars} value={stars}>
                      {stars}星
                    </option>
                  ))}
                </select>
                <Textarea
                  value={confirmForm?.reason || ""}
                  onChange={(e) => onConfirmChange({ reason: e.target.value })}
                  placeholder="若官方星级不同于参考星级，必须填写理由"
                />
              </div>
              <Button className="w-full" onClick={onConfirm} disabled={savingConfirmation}>
                {savingConfirmation ? "确认中..." : "最终确认"}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-[var(--cockpit-muted-foreground)]">
              当前你不是最终确认人，这里会持续显示最新官方结果和确认理由。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">意见汇总</p>
            <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
              {pendingOpinions > 0 ? `还有 ${pendingOpinions} 位待处理` : "所有终评相关人都已给出意见"}
              {overrideOpinions > 0 ? `，其中 ${overrideOpinions} 位主张改星` : ""}
            </p>
          </div>
          {employee.anomalyTags.length > 0 ? (
            <Badge variant="destructive">{employee.anomalyTags.join(" / ")}</Badge>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {employee.opinions.map((opinion) => (
            <div key={opinion.reviewerId} className="rounded-2xl border px-4 py-3">
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
          ))}
        </div>

        {myOpinion ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">我的处理动作</p>
            <div className="grid gap-3 md:grid-cols-[180px_140px_1fr]">
              <select
                value={opinionForm?.decision || "PENDING"}
                onChange={(e) => onOpinionChange({ decision: e.target.value as EmployeeOpinionFormValue["decision"] })}
                className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
              >
                <option value="PENDING">待处理</option>
                <option value="AGREE">同意参考星级</option>
                <option value="OVERRIDE">更改为其他星级</option>
              </select>
              <select
                value={opinionForm?.suggestedStars ?? ""}
                onChange={(e) => onOpinionChange({ suggestedStars: e.target.value ? Number(e.target.value) : null })}
                className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                disabled={opinionForm?.decision === "PENDING"}
              >
                <option value="">选择星级</option>
                {[1, 2, 3, 4, 5].map((stars) => (
                  <option key={stars} value={stars}>
                    {stars}星
                  </option>
                ))}
              </select>
              <Textarea
                value={opinionForm?.reason || ""}
                onChange={(e) => onOpinionChange({ reason: e.target.value })}
                placeholder={opinionForm?.decision === "OVERRIDE" ? "更改为其他星级时请填写理由" : "如有补充说明，可在此填写"}
              />
            </div>
            <Button onClick={onSaveOpinion} disabled={savingOpinion}>
              {savingOpinion ? "保存中..." : "保存我的终评意见"}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">证据摘要</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">初评加权分</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{employee.weightedScore?.toFixed(1) ?? "—"}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">360 均分</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{employee.peerAverage?.toFixed(1) ?? "—"}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">自评状态</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{employee.selfEvalStatus || "未导入"}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">初评人</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{employee.currentEvaluatorNames.join("、") || "未配置"}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-xs text-[var(--cockpit-muted-foreground)]">参考说明</p>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]">{employee.referenceSourceLabel}</p>
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
          <div className="space-y-2">
            {employee.opinions.map((opinion) => (
              <div key={`${opinion.reviewerId}:audit`} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                <span className="text-[var(--cockpit-foreground)]">{opinion.reviewerName}</span>
                <span className="text-[var(--cockpit-muted-foreground)]">{formatTime(opinion.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
