"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import type { LeaderEvaluation, LeaderForm, LeaderRow } from "./types";

type LeaderConfirmFormValue = {
  officialStars: number | null;
  reason: string;
};

export type LeaderDetailPanelProps = {
  title: string;
  comparisonTitle: string;
  questionnaireTitle: string;
  auditTrailTitle: string;
  leader: LeaderRow | null;
  leaderForms: Record<string, LeaderForm>;
  confirmForm: LeaderConfirmFormValue | null;
  savingConfirmation: boolean;
  savingEvaluationKey: string;
  onConfirmChange: (patch: Partial<LeaderConfirmFormValue>) => void;
  onEvaluationChange: (
    leaderId: string,
    evaluation: LeaderEvaluation,
    field: keyof LeaderForm,
    value: number | string | null,
  ) => void;
  onSaveEvaluation: (leader: LeaderRow, evaluation: LeaderEvaluation, action: "save" | "submit") => void;
  onConfirm: () => void;
};

function computeAbilityStars(form: LeaderForm): number | null {
  if (form.comprehensiveStars == null || form.learningStars == null || form.adaptabilityStars == null) return null;
  return Math.round((form.comprehensiveStars + form.learningStars + form.adaptabilityStars) / 3);
}

function computeValuesStars(form: LeaderForm): number | null {
  if (form.candidStars == null || form.progressStars == null || form.altruismStars == null || form.rootStars == null) return null;
  return Math.round((form.candidStars + form.progressStars + form.altruismStars + form.rootStars) / 4);
}

function computeWeightedScore(form: LeaderForm): number | null {
  const abilityStars = computeAbilityStars(form);
  const valuesStars = computeValuesStars(form);
  if (form.performanceStars == null || abilityStars == null || valuesStars == null) return null;
  return Math.round((form.performanceStars * 0.5 + abilityStars * 0.3 + valuesStars * 0.2) * 10) / 10;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
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

function LeaderQuestionnaire({
  title,
  evaluation,
  form,
  editable,
  saving,
  onChange,
  onSave,
}: {
  title: string;
  evaluation: LeaderEvaluation;
  form: LeaderForm;
  editable: boolean;
  saving: boolean;
  onChange: (field: keyof LeaderForm, value: number | string | null) => void;
  onSave: (action: "save" | "submit") => void;
}) {
  const weightedScore = computeWeightedScore(form);

  return (
    <section className="rounded-[24px] border p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
            状态：{evaluation.status === "SUBMITTED" ? "已提交" : "草稿"} · 加权分 {weightedScore?.toFixed(1) ?? "—"}
          </p>
        </div>
        {!editable ? <Badge variant="outline">只读</Badge> : null}
      </div>

      <div className="mt-5 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--cockpit-foreground)]">业绩产出</p>
          <StarRating value={form.performanceStars} onChange={(value) => onChange("performanceStars", value)} disabled={!editable} />
          <Textarea
            value={form.performanceComment}
            onChange={(event) => onChange("performanceComment", event.target.value)}
            disabled={!editable}
            placeholder="请输入业绩产出评语"
          />
        </div>

        <div className="space-y-3 rounded-2xl border p-4">
          <div>
            <p className="text-sm font-medium text-[var(--cockpit-foreground)]">个人能力</p>
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">综合能力、学习能力、适应能力等权平均</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--cockpit-foreground)]">综合能力</p>
              <StarRating value={form.comprehensiveStars} onChange={(value) => onChange("comprehensiveStars", value)} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--cockpit-foreground)]">学习能力</p>
              <StarRating value={form.learningStars} onChange={(value) => onChange("learningStars", value)} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--cockpit-foreground)]">适应能力</p>
              <StarRating value={form.adaptabilityStars} onChange={(value) => onChange("adaptabilityStars", value)} disabled={!editable} />
            </div>
          </div>
          <Textarea
            value={form.abilityComment}
            onChange={(event) => onChange("abilityComment", event.target.value)}
            disabled={!editable}
            placeholder="请输入个人能力综合评语"
          />
        </div>

        <div className="space-y-3 rounded-2xl border p-4">
          <div>
            <p className="text-sm font-medium text-[var(--cockpit-foreground)]">价值观</p>
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">坦诚真实、极致进取、成就利他、ROOT 等权平均</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["candidStars", "candidComment", "坦诚真实"],
              ["progressStars", "progressComment", "极致进取"],
              ["altruismStars", "altruismComment", "成就利他"],
              ["rootStars", "rootComment", "ROOT"],
            ].map(([starsField, commentField, label]) => (
              <div key={starsField} className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-medium text-[var(--cockpit-foreground)]">{label}</p>
                <StarRating
                  value={form[starsField as keyof LeaderForm] as number | null}
                  onChange={(value) => onChange(starsField as keyof LeaderForm, value)}
                  disabled={!editable}
                />
                <Textarea
                  value={form[commentField as keyof LeaderForm] as string}
                  onChange={(event) => onChange(commentField as keyof LeaderForm, event.target.value)}
                  disabled={!editable}
                  placeholder={`请输入${label}评语`}
                />
              </div>
            ))}
          </div>
        </div>

        {editable ? (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onSave("save")} disabled={saving}>
              保存草稿
            </Button>
            <Button onClick={() => onSave("submit")} disabled={saving}>
              提交终评
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LeaderDetailPanel({
  title,
  comparisonTitle,
  questionnaireTitle,
  auditTrailTitle,
  leader,
  leaderForms,
  confirmForm,
  savingConfirmation,
  savingEvaluationKey,
  onConfirmChange,
  onEvaluationChange,
  onSaveEvaluation,
  onConfirm,
}: LeaderDetailPanelProps) {
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  if (!leader) {
    return (
      <aside className="sticky top-6">
        <section className="rounded-[28px] border border-dashed p-8 text-sm leading-7 text-[var(--cockpit-muted-foreground)]" style={panelStyle}>
          从左侧优先队列或搜索主管名册里选择一位主管，右侧会先显示决策摘要，再按权限展开详细双人问卷。
        </section>
      </aside>
    );
  }

  const pendingReviewCount = leader.evaluations.filter((evaluation) => evaluation.status !== "SUBMITTED").length;
  const statusLabel = leader.officialStars != null ? "已拍板" : leader.bothSubmitted ? "待拍板" : "待双人齐备";

  return (
    <aside className="sticky top-6 space-y-4">
      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cockpit-muted-foreground)]">{title}</p>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-[var(--cockpit-foreground)]">{leader.name}</h3>
            <p className="mt-1 text-sm text-[var(--cockpit-muted-foreground)]">
              {leader.department}
              {leader.jobTitle ? ` · ${leader.jobTitle}` : ""}
            </p>
          </div>
          <Badge variant={leader.officialStars == null ? "outline" : "default"}>{statusLabel}</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryCard
            label="当前官方星级"
            value={renderStars(leader.officialStars, leader.bothSubmitted ? "待最终确认" : "待双人齐备")}
          />
          <SummaryCard
            label="双人提交状态"
            value={pendingReviewCount > 0 ? `还有 ${pendingReviewCount} 份问卷待提交` : "两位填写人都已提交"}
          />
          <SummaryCard label="最后确认人" value={leader.officialConfirmerName || "—"} />
          <SummaryCard label="当前状态" value={statusLabel} />
        </div>

        {leader.finalizable ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-[color:var(--cockpit-border)] bg-white/70 p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">最终拍板</p>
              <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">双人意见齐备后，再选择主管层官方星级并填写确认理由。</p>
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
              placeholder="主管层最终确认理由始终必填"
            />
            <Button className="w-full" onClick={onConfirm} disabled={!leader.bothSubmitted || savingConfirmation}>
              {savingConfirmation ? "确认中..." : "确认主管层官方结果"}
            </Button>
            {!leader.bothSubmitted ? (
              <p className="text-xs text-red-600">两位主管层终评填写人都提交后，才能最终确认。</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed px-4 py-3 text-sm text-[var(--cockpit-muted-foreground)]">
            当前你不是最终确认人，这里会持续显示最新官方结果和确认理由。
          </div>
        )}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{comparisonTitle}</p>
            <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
              {leader.canViewLeaderEvaluationDetails
                ? pendingReviewCount > 0
                  ? `还有 ${pendingReviewCount} 份问卷待提交`
                  : "两位填写人的问卷都已经提交"
                : "当前视图只保留双人摘要，不展开每位填写人的姓名和分数。"}
            </p>
          </div>
          <Badge variant={leader.bothSubmitted ? "default" : "outline"}>
            {leader.bothSubmitted ? "双人已齐备" : "待双人齐备"}
          </Badge>
        </div>

        {leader.canViewLeaderEvaluationDetails ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {leader.evaluations.map((evaluation) => {
              const key = `${leader.id}:${evaluation.evaluatorId}`;
              const form = leaderForms[key] || evaluation.form;
              return (
                <div key={key} className="rounded-2xl border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--cockpit-foreground)]">{evaluation.evaluatorName}</p>
                      <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
                        加权分 {computeWeightedScore(form)?.toFixed(1) ?? evaluation.weightedScore?.toFixed(1) ?? "—"}
                      </p>
                    </div>
                    <Badge variant={evaluation.status === "SUBMITTED" ? "default" : "outline"}>
                      {evaluation.status === "SUBMITTED" ? "已提交" : "草稿"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--cockpit-muted-foreground)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>业绩产出</span>
                      <span>{renderStars(form.performanceStars, "—")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>个人能力均值</span>
                      <span>{renderStars(computeAbilityStars(form), "—")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>价值观均值</span>
                      <span>{renderStars(computeValuesStars(form), "—")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed px-4 py-4 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
            详细双人对照只对具备查看权限的终评角色开放，当前页面只保留双人提交状态和官方结论摘要。
          </div>
        )}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{questionnaireTitle}</p>
            <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
              {leader.canViewLeaderEvaluationDetails
                ? "只有对应的填写人可以编辑自己的问卷，其他人始终只读。"
                : "当前视图只展示双人摘要，不展开详细双人问卷。"}
            </p>
          </div>
          <Badge variant={leader.canViewLeaderEvaluationDetails ? "secondary" : "outline"}>
            {leader.canViewLeaderEvaluationDetails ? "已开放" : "已隐藏"}
          </Badge>
        </div>

        {leader.canViewLeaderEvaluationDetails ? (
          <div className="mt-4 space-y-4">
            {leader.evaluations.map((evaluation) => {
              const key = `${leader.id}:${evaluation.evaluatorId}`;
              return (
                <LeaderQuestionnaire
                  key={key}
                  title={`${evaluation.evaluatorName} 终评问卷`}
                  evaluation={evaluation}
                  form={leaderForms[key] || evaluation.form}
                  editable={evaluation.editable}
                  saving={savingEvaluationKey === `leader:${key}`}
                  onChange={(field, value) => onEvaluationChange(leader.id, evaluation, field, value)}
                  onSave={(action) => onSaveEvaluation(leader, evaluation, action)}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed px-4 py-4 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
            详细双人问卷只对具备查看权限的终评角色开放，当前页面继续保留双人意见对照和官方结论摘要。
          </div>
        )}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{auditTrailTitle}</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">官方确认理由</p>
            <p className="mt-2 leading-6 text-[var(--cockpit-foreground)]">{leader.officialReason || "当前还没有填写主管层官方确认理由。"}</p>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-[var(--cockpit-muted-foreground)]">最后确认时间</p>
            <p className="mt-2 text-[var(--cockpit-foreground)]">{formatTime(leader.officialConfirmedAt)}</p>
          </div>
          <div className="space-y-2">
            {leader.evaluations.map((evaluation) => (
              <div key={`${evaluation.evaluatorId}:audit`} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                <div>
                  <p className="text-[var(--cockpit-foreground)]">{evaluation.evaluatorName}</p>
                  <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">{evaluation.status === "SUBMITTED" ? "已提交终评问卷" : "仍是草稿"}</p>
                </div>
                <span className="text-[var(--cockpit-muted-foreground)]">{formatTime(evaluation.submittedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
