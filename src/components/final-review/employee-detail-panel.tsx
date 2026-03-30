"use client";

import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function renderStars(value: number | null, fallback: string) {
  if (value == null) return fallback;
  return `${value} 星`;
}

function renderPeerDimension(label: string, score: number | null, comment: string) {
  if (score == null && !comment) return null;
  return (
    <div className="rounded-2xl border px-3 py-2">
      <p className="text-xs text-[var(--cockpit-muted-foreground)]">
        {label}
        {score != null ? ` · ${score.toFixed(1)}分` : ""}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--cockpit-foreground)]">
        {comment || "当前没有展开的匿名评语，仅保留评分。"}
      </p>
    </div>
  );
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

function DimensionDetailCard({
  label,
  stars,
  comment,
  helper,
}: {
  label: string;
  stars: number | null;
  comment: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--cockpit-foreground)]">{label}</p>
          <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
            星级：{renderStars(stars, "—")}
          </p>
        </div>
      </div>
      {helper ? (
        <p className="mt-2 text-xs leading-5 text-[var(--cockpit-muted-foreground)]">{helper}</p>
      ) : null}
      <p className="mt-3 text-sm leading-6 text-[var(--cockpit-foreground)]">{comment || "当前没有填写对应评语。"}</p>
    </div>
  );
}

function renderDecisionYesNo(opinion: EmployeeOpinion | null) {
  if (!opinion || opinion.decision === "PENDING") return "尚未提交";
  return opinion.decision === "AGREE" ? "是" : "否";
}

function renderDecisionStars(opinion: EmployeeOpinion | null, referenceStars: number | null) {
  if (!opinion || opinion.decision === "PENDING") return "—";
  return renderStars(opinion.decision === "AGREE" ? referenceStars : opinion.suggestedStars, "—");
}

function buildAbilityHelper(detail: EmployeeRow["initialReviewDetails"][number]) {
  const items = detail.abilityBreakdown
    .filter((item) => item.stars != null)
    .map((item) => `${item.label} ${item.stars}星`);
  return items.join(" · ");
}

function buildValuesHelper(detail: EmployeeRow["initialReviewDetails"][number]) {
  const items = detail.valuesBreakdown
    .filter((item) => item.stars != null)
    .map((item) => `${item.label} ${item.stars}星`);
  return items.join(" · ");
}

function CalibratorCard({
  label,
  opinion,
  referenceStars,
  editable,
  form,
  saving,
  onChange,
  onSave,
}: {
  label: string;
  opinion: EmployeeOpinion | null;
  referenceStars: number | null;
  editable: boolean;
  form: EmployeeOpinionFormValue | null;
  saving: boolean;
  onChange: (patch: Partial<EmployeeOpinionFormValue>) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border px-4 py-4">
      <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{label}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <SummaryCard label="是否同意绩效初评" value={renderDecisionYesNo(opinion)} />
        <SummaryCard label="校准等级" value={renderDecisionStars(opinion, referenceStars)} />
      </div>

      {editable && form ? (
        <div className="mt-4 space-y-3">
          {opinion?.prefillDecision && !opinion?.hasSavedOpinion ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
              已根据你之前的{opinion.prefillSourceLabel}预填草稿，确认保存后才会成为终评意见。
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={form.decision === "AGREE" ? "default" : "outline"}
              onClick={() => onChange({ decision: "AGREE", suggestedStars: referenceStars })}
            >
              同意绩效初评
            </Button>
            <Button
              type="button"
              variant={form.decision === "OVERRIDE" ? "default" : "outline"}
              onClick={() => onChange({ decision: "OVERRIDE" })}
            >
              改为其他星级
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((stars) => (
              <Button
                key={stars}
                type="button"
                variant={form.suggestedStars === stars ? "default" : "outline"}
                disabled={form.decision !== "OVERRIDE"}
                onClick={() => onChange({ suggestedStars: stars })}
              >
                {stars}星
              </Button>
            ))}
          </div>

          <Textarea
            value={form.reason}
            onChange={(event) => onChange({ reason: event.target.value })}
            placeholder={form.decision === "OVERRIDE" ? "如果不同意初评，请填写校准理由" : "如有补充说明，可在此填写"}
          />

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange({ decision: "PENDING", suggestedStars: referenceStars, reason: "" })}
            >
              重置为待处理
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "保存中..." : "保存校准"}
            </Button>
          </div>
        </div>
      ) : opinion?.reason ? (
        <p className="mt-3 text-sm leading-6 text-[var(--cockpit-foreground)]">{opinion.reason}</p>
      ) : null}
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
  const [expandedPeerReviewEmployeeId, setExpandedPeerReviewEmployeeId] = useState<string | null>(null);
  const panelStyle: CSSProperties = {
    background: "var(--cockpit-surface)",
    borderColor: "var(--cockpit-border)",
    boxShadow: "var(--shadow-xs)",
  };

  if (!employee) {
    return (
      <aside className="sticky top-6">
        <section className="rounded-[28px] border border-dashed p-8 text-sm leading-7 text-[var(--cockpit-muted-foreground)]" style={panelStyle}>
          从左侧重点名单或搜索结果里选中一位员工，右侧会直接展开公司级校准和直属上级初评明细。
        </section>
      </aside>
    );
  }

  const expandedPeerReview = expandedPeerReviewEmployeeId === employee.id;
  const hasPeerReviewSummary = Boolean(employee.peerReviewSummary && employee.peerReviewSummary.count > 0);
  const chenglinOpinion = findOpinionByReviewerName(employee.opinions, "承霖");
  const qiuxiangOpinion = findOpinionByReviewerName(employee.opinions, "邱翔");
  const agreementSummary =
    employee.agreementState === "AGREED"
      ? `已一致 · ${renderStars(employee.officialStars, "—")}`
      : employee.agreementState === "DISAGREED"
        ? "两人不一致"
        : "待两位完成";
  const calibratorSummaryText =
    employee.anomalyTags.length > 0 ? `当前风险信号：${employee.anomalyTags.join("、")}` : "当前没有额外风险信号。";

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

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border px-4 py-4">
            <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">当前结论</p>
            <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{agreementSummary}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{calibratorSummaryText}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SummaryCard label="参考星级" value={renderStars(employee.referenceStars, "—")} />
              <SummaryCard label="当前官方星级" value={renderStars(employee.officialStars, "待确认")} />
              <SummaryCard
                label="处理进度"
                value={`已处理 ${employee.summaryStats.handledCount}/${employee.summaryStats.totalReviewerCount}`}
              />
              <SummaryCard
                label="校准状态"
                value={employee.agreementState === "AGREED" ? "已一致" : employee.agreementState === "DISAGREED" ? "两人不一致" : "待两位完成"}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CalibratorCard
              label="承霖校准"
              opinion={chenglinOpinion}
              referenceStars={employee.referenceStars}
              editable={Boolean(employee.canSubmitOpinion && chenglinOpinion?.isMine)}
              form={employee.canSubmitOpinion && chenglinOpinion?.isMine ? opinionForm : null}
              saving={Boolean(employee.canSubmitOpinion && chenglinOpinion?.isMine && savingOpinion)}
              onChange={onOpinionChange}
              onSave={onSaveOpinion}
            />
            <CalibratorCard
              label="邱翔校准"
              opinion={qiuxiangOpinion}
              referenceStars={employee.referenceStars}
              editable={Boolean(employee.canSubmitOpinion && qiuxiangOpinion?.isMine)}
              form={employee.canSubmitOpinion && qiuxiangOpinion?.isMine ? opinionForm : null}
              saving={Boolean(employee.canSubmitOpinion && qiuxiangOpinion?.isMine && savingOpinion)}
              onChange={onOpinionChange}
              onSave={onSaveOpinion}
            />
          </div>
        </div>

        {employee.officialStars != null ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
            已确认，可切换下一位。
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border p-5" style={panelStyle}>
        <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">直属上级绩效初评明细</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryCard label="初评加权分" value={employee.weightedScore?.toFixed(1) ?? "—"} />
          {hasPeerReviewSummary ? (
            <button
              type="button"
              onClick={() =>
                setExpandedPeerReviewEmployeeId((current) => (current === employee.id ? null : employee.id))
              }
              className="rounded-2xl border px-4 py-3 text-left transition-colors hover:border-[var(--cockpit-accent-strong)] hover:bg-[var(--cockpit-accent-subtle)]/30"
            >
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">360 均分</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">
                {employee.peerAverage?.toFixed(1) ?? "—"}
              </p>
              <p className="mt-2 text-xs text-[var(--cockpit-accent-strong)]">
                {expandedPeerReview ? "收起360详情" : "点击查看360详情"}
              </p>
            </button>
          ) : (
            <SummaryCard label="360 均分" value={employee.peerAverage?.toFixed(1) ?? "—"} />
          )}
          {employee.selfEvalSourceUrl && employee.selfEvalStatus && employee.selfEvalStatus !== "未导入" ? (
            <a
              href={employee.selfEvalSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border px-4 py-3 transition-colors hover:border-[var(--cockpit-accent-strong)] hover:bg-[var(--cockpit-accent-subtle)]/40"
            >
              <p className="text-xs text-[var(--cockpit-muted-foreground)]">自评状态</p>
              <p className="mt-2 text-sm font-medium text-[var(--cockpit-foreground)]">{employee.selfEvalStatus}</p>
              <p className="mt-2 text-xs text-[var(--cockpit-accent-strong)]">查看自评</p>
            </a>
          ) : (
            <SummaryCard label="自评状态" value={employee.selfEvalStatus || "未导入"} />
          )}
          <SummaryCard label="初评人" value={employee.currentEvaluatorNames.join("、") || "未配置"} />
        </div>
        {expandedPeerReview && employee.peerReviewSummary ? (
          <div className="mt-4 rounded-2xl border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">360反馈详情</p>
                <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
                  已收到 {employee.peerReviewSummary.count} 份 360 反馈。
                  {employee.canViewNamedPeerReviewers
                    ? " 当前视图按实名展示反馈人与对应评语。"
                    : " 当前视图仅展示匿名反馈内容，不显示反馈人姓名。"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-0 text-sm text-[var(--cockpit-accent-strong)] hover:bg-transparent"
                onClick={() => setExpandedPeerReviewEmployeeId(null)}
              >
                收起360详情
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="业绩产出"
                value={employee.peerReviewSummary.performance?.toFixed(1) ?? "—"}
              />
              <SummaryCard
                label="个人能力"
                value={employee.peerReviewSummary.ability?.toFixed(1) ?? "—"}
              />
              <SummaryCard
                label="价值观"
                value={employee.peerReviewSummary.values?.toFixed(1) ?? "—"}
              />
            </div>

            <div className="mt-4 space-y-3">
              {employee.peerReviewSummary.reviews.map((review, index) => {
                const dimensions = [
                  renderPeerDimension("业绩产出", review.performanceStars, review.performanceComment),
                  renderPeerDimension("综合能力", review.comprehensiveStars, review.comprehensiveComment),
                  renderPeerDimension("学习能力", review.learningStars, review.learningComment),
                  renderPeerDimension("适应能力", review.adaptabilityStars, review.adaptabilityComment),
                  renderPeerDimension("坦诚真实", review.candidStars, review.candidComment),
                  renderPeerDimension("极致进取", review.progressStars, review.progressComment),
                  renderPeerDimension("成就利他", review.altruismStars, review.altruismComment),
                  renderPeerDimension("ROOT", review.rootStars, review.rootComment),
                  renderPeerDimension("其他补充", review.innovationScore, review.innovationComment),
                ].filter(Boolean);

                return (
                  <div key={`${employee.id}:peer:${index}`} className="rounded-2xl border px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cockpit-muted-foreground)]">
                      {employee.canViewNamedPeerReviewers ? review.reviewerName : `匿名反馈 ${index + 1}`}
                    </p>
                    {dimensions.length > 0 ? (
                      <div className="mt-3 space-y-2">{dimensions}</div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
                        当前这份 360 反馈没有展开的评语内容，只保留了评分。
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border px-4 py-3">
          <p className="text-xs text-[var(--cockpit-muted-foreground)]">初评加权方式</p>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-foreground)]">{employee.referenceSourceLabel}</p>
        </div>
        <div className="mt-4 space-y-3">
          {employee.initialReviewDetails.length > 0 ? (
            employee.initialReviewDetails.map((detail) => (
              <div key={detail.evaluatorId} className="rounded-2xl border px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--cockpit-foreground)]">{detail.evaluatorName}</p>
                    <p className="mt-1 text-xs text-[var(--cockpit-muted-foreground)]">
                      {detail.status} · 加权分 {detail.weightedScore?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <DimensionDetailCard
                    label="业绩产出"
                    stars={detail.performanceStars}
                    comment={detail.performanceComment}
                  />
                  <DimensionDetailCard
                    label="综合能力"
                    stars={detail.abilityStars}
                    helper={buildAbilityHelper(detail)}
                    comment={detail.abilityComment}
                  />
                  <DimensionDetailCard
                    label="价值观"
                    stars={detail.valuesStars}
                    helper={buildValuesHelper(detail)}
                    comment={detail.valuesComment}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-4 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">
              当前还没有可供查看的直属上级绩效初评明细。
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
