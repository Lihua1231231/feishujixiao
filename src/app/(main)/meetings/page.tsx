"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { ListPageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Eye } from "lucide-react";
import { toast } from "sonner";

// ========== Types ==========

type PeerReviewDetail = {
  reviewerName: string;
  performanceStars: number | null;
  performanceComment: string;
  abilityAverage: number | null;
  comprehensiveStars: number | null;
  comprehensiveComment: string;
  learningStars: number | null;
  learningComment: string;
  adaptabilityStars: number | null;
  adaptabilityComment: string;
  valuesAverage: number | null;
  candidStars: number | null;
  candidComment: string;
  progressStars: number | null;
  progressComment: string;
  altruismStars: number | null;
  altruismComment: string;
  rootStars: number | null;
  rootComment: string;
  innovationScore: number | null;
  innovationComment: string;
};

type CalibrationOpinion = {
  reviewerId: string;
  reviewerName: string;
  decision: string;
  suggestedStars: number | null;
  reason: string;
};

type InterviewItem = {
  employee: { id: string; name: string; department: string; jobTitle: string | null };
  peerReviewSummary: {
    performance: number | null;
    ability: number | null;
    values: number | null;
    overall: number | null;
    count: number;
    reviews: PeerReviewDetail[];
  };
  supervisorEval: {
    evaluatorName: string;
    status: string;
    weightedScore: number | null;
    performanceStars: number | null;
    performanceComment: string;
    abilityStars: number | null;
    abilityComment: string;
    comprehensiveStars: number | null;
    learningStars: number | null;
    adaptabilityStars: number | null;
    valuesStars: number | null;
    valuesComment: string;
    candidStars: number | null;
    candidComment: string;
    progressStars: number | null;
    progressComment: string;
    altruismStars: number | null;
    altruismComment: string;
    rootStars: number | null;
    rootComment: string;
  } | null;
  calibration: {
    displayWeightedScore: number | null;
    displayReferenceStars: number | null;
    officialStars: number | null;
    calibrated: boolean;
    opinions: CalibrationOpinion[];
  };
  meeting: {
    id: string;
    summary: string;
    notes: string;
    supervisorCompleted: boolean;
    employeeAck: boolean;
    meetingDate: string | null;
  } | null;
};

type SupervisorData = {
  role: "SUPERVISOR";
  userRole: string;
  cycleStatus: string;
  cycleName: string;
  items: InterviewItem[];
};

type EmployeeData = {
  role: "EMPLOYEE";
  cycleStatus: string | null;
  cycleName: string;
  officialStars: number | null;
  summary: string;
  employeeAck: boolean;
  supervisorCompleted: boolean;
  meetingId: string | null;
};

type MeetingResponse = SupervisorData | EmployeeData;

// ========== Helper Components ==========

function renderStars(value: number | null, fallback = "—") {
  if (value == null) return fallback;
  return `${value} 星`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function renderPeerDimension(label: string, score: number | null, comment: string) {
  if (score == null && !comment) return null;
  return (
    <div className="rounded-xl border px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {label}
        {score != null ? ` · ${score.toFixed(1)}分` : ""}
      </p>
      {comment && (
        <p className="mt-1 text-sm leading-6">{comment}</p>
      )}
    </div>
  );
}

// ========== Calibration Display (Read-only) ==========

function CalibrationCard({ opinion }: { opinion: CalibrationOpinion }) {
  const decisionLabel =
    opinion.decision === "AGREE" ? "同意绩效初评"
    : opinion.decision === "OVERRIDE" ? "不同意绩效初评"
    : "待处理";
  const decisionColor =
    opinion.decision === "AGREE" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : opinion.decision === "OVERRIDE" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-gray-50 text-gray-500 border-gray-200";

  return (
    <div className="rounded-xl border px-4 py-3 space-y-2">
      <p className="text-sm font-semibold">{opinion.reviewerName}校准</p>
      <Badge className={decisionColor}>{decisionLabel}</Badge>
      {opinion.suggestedStars != null && (
        <p className="text-sm">校准等级：{opinion.suggestedStars} 星</p>
      )}
      {opinion.reason && (
        <p className="text-sm text-muted-foreground leading-6">{opinion.reason}</p>
      )}
    </div>
  );
}

// ========== 360 Peer Review Section ==========

function PeerReviewSection({ summary }: { summary: InterviewItem["peerReviewSummary"] }) {
  const [expanded, setExpanded] = useState(false);

  if (summary.count === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">暂无 360 环评数据</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            360 环评
            <span className="ml-2 text-sm font-normal text-muted-foreground">({summary.count} 份)</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">{expanded ? "收起" : "展开详情"}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{summary.performance?.toFixed(1) ?? "—"}</p>
            <p className="text-xs text-muted-foreground">业绩产出</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{summary.ability?.toFixed(1) ?? "—"}</p>
            <p className="text-xs text-muted-foreground">个人能力</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{summary.values?.toFixed(1) ?? "—"}</p>
            <p className="text-xs text-muted-foreground">价值观</p>
          </div>
        </div>

        {expanded && summary.reviews.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">匿名评语详情</p>
            {summary.reviews.map((review, index) => {
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
                <div key={index} className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{review.reviewerName}</p>
                  {dimensions.length > 0 ? (
                    <div className="space-y-2">{dimensions}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">仅保留评分，无展开评语。</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== Supervisor Eval + Calibration Section ==========

function EvalCalibrationSection({ item }: { item: InterviewItem }) {
  const { supervisorEval, calibration } = item;
  const [showOpinions, setShowOpinions] = useState(false);
  const allCalibrated = calibration.opinions.length > 0
    && calibration.opinions.every((o) => o.decision !== "PENDING");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">直属上级初评 + 终评校准</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview scores */}
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="初评加权分" value={calibration.displayWeightedScore?.toFixed(1) ?? "—"} />
          <SummaryCard label="参考星级" value={renderStars(calibration.displayReferenceStars)} />
          <SummaryCard
            label="终评校准等级"
            value={calibration.officialStars != null
              ? `${calibration.officialStars} 星${calibration.calibrated ? " (发生校准)" : ""}`
              : "待校准"
            }
          />
        </div>

        {/* Calibration status + expandable opinions */}
        {calibration.opinions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {allCalibrated && (
                <span className="inline-flex items-center rounded-md bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                  已完成公司级绩效终评校准
                </span>
              )}
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setShowOpinions(!showOpinions)}
              >
                {showOpinions ? "收起校准详情" : "查看校准详情"}
              </button>
            </div>
            {showOpinions && (
              <div className="grid gap-3 sm:grid-cols-2">
                {calibration.opinions.map((opinion) => (
                  <CalibrationCard key={opinion.reviewerId} opinion={opinion} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Supervisor eval details */}
        {supervisorEval ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">初评详情 ({supervisorEval.evaluatorName})</p>
            <div className="space-y-3">
              <div className="rounded-xl border px-4 py-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">业绩产出</p>
                  <span className="text-xs text-muted-foreground">{renderStars(supervisorEval.performanceStars)}</span>
                </div>
                {supervisorEval.performanceComment && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{supervisorEval.performanceComment}</p>
                )}
              </div>
              <div className="rounded-xl border px-4 py-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">个人能力</p>
                  <span className="text-xs text-muted-foreground">{renderStars(supervisorEval.abilityStars)}</span>
                </div>
                {supervisorEval.comprehensiveStars != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    综合能力 {supervisorEval.comprehensiveStars}星 · 学习能力 {supervisorEval.learningStars ?? "—"}星 · 适应能力 {supervisorEval.adaptabilityStars ?? "—"}星
                  </p>
                )}
                {supervisorEval.abilityComment && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{supervisorEval.abilityComment}</p>
                )}
              </div>
              <div className="rounded-xl border px-4 py-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">价值观</p>
                  <span className="text-xs text-muted-foreground">{renderStars(supervisorEval.valuesStars)}</span>
                </div>
                {(supervisorEval.candidStars != null || supervisorEval.progressStars != null) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    坦诚真实 {supervisorEval.candidStars ?? "—"}星 · 极致进取 {supervisorEval.progressStars ?? "—"}星 · 成就利他 {supervisorEval.altruismStars ?? "—"}星 · ROOT {supervisorEval.rootStars ?? "—"}星
                  </p>
                )}
                {(supervisorEval.valuesComment || supervisorEval.candidComment) && (
                  <div className="mt-2 text-sm leading-6 text-muted-foreground space-y-1">
                    {supervisorEval.valuesComment && <p>{supervisorEval.valuesComment}</p>}
                    {supervisorEval.candidComment && <p>坦诚真实：{supervisorEval.candidComment}</p>}
                    {supervisorEval.progressComment && <p>极致进取：{supervisorEval.progressComment}</p>}
                    {supervisorEval.altruismComment && <p>成就利他：{supervisorEval.altruismComment}</p>}
                    {supervisorEval.rootComment && <p>ROOT：{supervisorEval.rootComment}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t pt-4 text-sm text-muted-foreground">暂无初评数据</div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== Employee Card (Supervisor View) ==========

function EmployeeInterviewCard({
  item,
  isSelected,
  onSelect,
  onSaveSummary,
  onComplete,
}: {
  item: InterviewItem;
  isSelected: boolean;
  onSelect: () => void;
  onSaveSummary: (employeeId: string, summary: string) => Promise<void>;
  onComplete: (employeeId: string, summary: string) => Promise<void>;
}) {
  const [summary, setSummary] = useState(item.meeting?.summary || "");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Sync when meeting data changes
  useEffect(() => {
    setSummary(item.meeting?.summary || "");
  }, [item.meeting?.summary]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveSummary(item.employee.id, summary);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!summary.trim()) {
      toast.error("请先填写绩效面谈综述");
      return;
    }
    if (!confirm("确认已和该员工完成绩效面谈？确认后该综述将体现在员工确认界面。")) return;
    setCompleting(true);
    try {
      await onComplete(item.employee.id, summary);
    } finally {
      setCompleting(false);
    }
  };

  const completed = item.meeting?.supervisorCompleted || false;
  const acked = item.meeting?.employeeAck || false;

  return (
    <div>
      {/* Header button */}
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
          isSelected
            ? "border-primary bg-primary/[0.06] shadow-sm"
            : "border-border/50 hover:border-border hover:bg-muted/40"
        }`}
      >
        <span className="text-sm font-medium">{item.employee.name}</span>
        <span className="text-xs text-muted-foreground">{item.employee.department}</span>
        {item.calibration.officialStars != null && (
          <Badge variant="outline" className="text-xs">{item.calibration.officialStars}星</Badge>
        )}
        <div className="ml-auto flex gap-1.5">
          {completed && <Badge variant="success">已完成面谈</Badge>}
          {acked && <Badge variant="success">员工已确认</Badge>}
          {!completed && <Badge variant="secondary">待面谈</Badge>}
        </div>
      </button>

      {/* Expanded content */}
      {isSelected && (
        <div className="mt-4 space-y-4 pl-0">
          <PeerReviewSection summary={item.peerReviewSummary} />
          <EvalCalibrationSection item={item} />

          {/* Interview summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">绩效面谈综述</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                请你针对员工上周期绩效表现进行简评，并在绩效面谈时传达。注意：该简评将会体现在员工绩效面谈确认界面。
              </p>
              <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">综述模板参考：</p>
                <p>本次绩效判断主要基于以下方面：</p>
                <p className="pl-3">1）关键业绩结果与价值贡献；</p>
                <p className="pl-3">2）综合能力表现，包括问题解决、学习适应、AI-first 工作方式落地情况；</p>
                <p className="pl-3">3）价值观与协作表现。</p>
                <p className="mt-1">已向员工说明其本周期主要亮点/主要不足，并明确下周期重点要求为：A. ______ B. ______ C. ______</p>
              </div>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="请输入绩效面谈综述..."
                rows={4}
                disabled={completed}
              />
              {!completed && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存综述"}
                  </Button>
                  <Button onClick={handleComplete} disabled={completing}>
                    {completing ? "处理中..." : "已完成面谈"}
                  </Button>
                </div>
              )}
              {completed && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                  已标记完成面谈{acked ? "，员工已确认" : "，等待员工确认"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ========== Interview Guide ==========

function InterviewGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">绩效面谈指引</CardTitle>
          <span className="text-xs text-muted-foreground">{expanded ? "收起" : "展开查看"}</span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6 text-sm leading-7">
          {/* 准备工作 */}
          <div className="space-y-3">
            <p className="font-semibold text-base">一、准备工作</p>
            <div className="space-y-2 text-muted-foreground">
              <p><span className="font-medium text-foreground">第一，一句话结论。</span>格式："这次你的绩效分数加权是 xx 分，绩效等级是 X 星。"（注意：如在绩效终评校准环节发生了校准，以校准后的绩效加权分数和绩效等级作为最终信息）</p>
              <p><span className="font-medium text-foreground">第二，浏览。</span>点击 360 环评 - 展开详情，梳理环评人的公允反馈。</p>
              <p><span className="font-medium text-foreground">第三，梳理。</span>业绩产出维度的有效产出及综评、待改进建议；学习能力维度、价值观维度同理。以及，下一周期的成长目标引导。</p>
            </div>
          </div>

          {/* 绩效面谈 */}
          <div className="space-y-3">
            <p className="font-semibold text-base">二、绩效面谈（建议 10-20 分钟，有需要可邀请 HRBP 禹聪琪共同参与）</p>
            <div className="space-y-2 text-muted-foreground">
              <p>提前做完准备工作后，针对员工上周期绩效表现进行简评，并录入绩效面谈对话框，在绩效面谈时合理传达。</p>
              <p className="text-amber-700 font-medium">注意：该简评将会体现在员工绩效面谈确认界面。</p>
            </div>
          </div>

          {/* 话术参考 */}
          <div className="space-y-3">
            <p className="font-semibold text-base">三、参考话术（核心是坦诚清晰、简洁直接、基于事实）</p>
            <div className="rounded-xl border bg-muted/30 px-5 py-4 space-y-3 text-muted-foreground">
              <p>"同学，你好，今天绩效面谈，我们沟通三件事：</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>第一，回顾你这个绩效周期的整体表现和结果，你先用 3-5 分钟讲一下，你觉得这周期最值得肯定的 2 件事，和最需要改进的 1-2 件事</li>
                <li>第二，同步本次绩效周期你的绩效分数和绩效等级，讲清楚公司为什么做这个判断</li>
                <li>第三，确认你下个周期最重要的提升点，和我会给你的支持。下个周期，我希望你重点抓 3 件事：1）保持什么；2）改掉什么；3）建立什么新能力。我也会给你对应支持：资源、节奏、反馈节点、协作人。"</li>
              </ul>
              <p>最后，面谈结束必须有 next step。我们把有共识和没共识的地方都记下来，后面按节奏继续跟。</p>
            </div>
          </div>

          {/* 重要提醒 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 space-y-2">
            <p className="font-semibold text-amber-800">重要提醒</p>
            <p className="text-sm text-amber-700">各级管理者是团队绩效管理第一责任人：设清晰目标、及时反馈、促进成长、有效管理。请各位主管在绩效面谈中遵循：及时反馈、有效管理、促进员工成长三原则。</p>
            <p className="text-sm text-amber-700">除此之外，在未来也需持续关注下属的目标对齐、双月 OKR 过程辅导、日常一对一反馈沟通。并在绩效周期后，视需制定下属绩效改进计划，落地人才发展动作。</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ========== Supervisor View ==========

function SupervisorView({ data }: { data: SupervisorData }) {
  const [items, setItems] = useState(data.items);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pendingCount = items.filter((item) => !item.meeting?.supervisorCompleted).length;

  const refreshData = async () => {
    try {
      const res = await fetch("/api/meeting");
      const newData = await res.json();
      if (newData.items) setItems(newData.items);
    } catch { /* ignore */ }
  };

  const handleSaveSummary = async (employeeId: string, summary: string) => {
    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, summary }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }
      toast.success("综述已保存");
      await refreshData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const handleComplete = async (employeeId: string, summary: string) => {
    try {
      const res = await fetch("/api/meeting/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, summary }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "操作失败");
      }
      toast.success("已标记完成面谈");
      await refreshData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="绩效确定"
        description={`${data.cycleName} · 绩效面谈阶段`}
      />

      {/* Interview guide */}
      <InterviewGuide />

      {/* Pending count */}
      <div className="text-lg font-semibold">
        你有待完成的绩效面谈 <span className="text-primary">{pendingCount}</span> 人
      </div>

      {/* Employee list */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无需要面谈的员工
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <EmployeeInterviewCard
              key={item.employee.id}
              item={item}
              isSelected={selectedId === item.employee.id}
              onSelect={() => setSelectedId(selectedId === item.employee.id ? null : item.employee.id)}
              onSaveSummary={handleSaveSummary}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Employee View ==========

function EmployeeView({ data }: { data: EmployeeData & { adminPreview?: boolean; employeeName?: string } }) {
  const [acked, setAcked] = useState(data.employeeAck);
  const [confirming, setConfirming] = useState(false);
  const isAdminPreview = Boolean(data.adminPreview);

  const handleConfirm = async () => {
    if (!confirm("确认面谈结果？确认后无法撤销。")) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/meeting/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: data.meetingId }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "操作失败");
      }
      setAcked(true);
      toast.success("已确认");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setConfirming(false);
    }
  };

  if (!isAdminPreview && data.cycleStatus !== "MEETING") {
    return (
      <div className="space-y-6">
        <PageHeader title="绩效确定" description={data.cycleName || ""} />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            当前不在面谈阶段
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.officialStars == null) {
    return (
      <div className="space-y-6">
        <PageHeader title="绩效确定" description={data.cycleName || ""} />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            你的绩效结果尚在处理中，请稍后再来查看。
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="绩效确定" description={data.cycleName || ""} />

      <Card>
        <CardContent className="py-8 space-y-6">
          <div className="text-center space-y-4">
            <p className="text-lg">
              同学你好，感谢你在 2025 下半年绩效考核周期内的付出！
            </p>

            <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.04] to-transparent px-8 py-6 space-y-2">
              <p className="text-sm text-muted-foreground">你的绩效等级是</p>
              <p className="text-4xl font-bold text-primary">{data.officialStars} 星</p>
            </div>

            {data.summary && (
              <div className="rounded-2xl border px-6 py-5 text-left space-y-2">
                <p className="text-sm font-medium">你的绩效评语是：</p>
                <p className="text-sm leading-7 whitespace-pre-wrap">{data.summary}</p>
              </div>
            )}
          </div>

          {!acked ? (
            <div className="border-t pt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                如果你已完成绩效面谈且对于绩效结果没有异议，请点击确认。
              </p>
              <Button
                onClick={handleConfirm}
                disabled={confirming || !data.meetingId}
                size="lg"
              >
                {confirming ? "确认中..." : "确认"}
              </Button>
              {!data.meetingId && (
                <p className="text-xs text-muted-foreground">主管尚未创建面谈记录</p>
              )}
            </div>
          ) : (
            <div className="border-t pt-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-center text-sm text-emerald-800">
                你已确认绩效面谈结果
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== Admin Perspective Toggle ==========

function AdminPerspectiveToggle({
  items,
  onPreviewEmployee,
  onBackToSupervisor,
  previewingEmployee,
}: {
  items: InterviewItem[];
  onPreviewEmployee: (id: string) => void;
  onBackToSupervisor: () => void;
  previewingEmployee: string | null;
}) {
  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Eye className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">管理员透视</span>
          <span className="text-xs text-blue-600">切换查看员工视角</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button
              variant={previewingEmployee === null ? "default" : "outline"}
              size="sm"
              onClick={onBackToSupervisor}
            >
              主管视角
            </Button>
            {items.map((item) => (
              <Button
                key={item.employee.id}
                variant={previewingEmployee === item.employee.id ? "default" : "outline"}
                size="sm"
                onClick={() => onPreviewEmployee(item.employee.id)}
              >
                {item.employee.name}视角
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== Main Page ==========

function MeetingsContent() {
  const [data, setData] = useState<MeetingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewingEmployee, setPreviewingEmployee] = useState<string | null>(null);
  const [employeePreviewData, setEmployeePreviewData] = useState<(EmployeeData & { adminPreview?: boolean; employeeName?: string }) | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch("/api/meeting")
      .then((r) => r.json())
      .then((result) => {
        setData(result);
      })
      .catch(() => {
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePreviewEmployee = useCallback(async (employeeId: string) => {
    setPreviewingEmployee(employeeId);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/meeting?view=employee&employeeId=${employeeId}`);
      const result = await res.json();
      setEmployeePreviewData(result);
    } catch {
      toast.error("加载员工视角失败");
      setPreviewingEmployee(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  if (loading) return <ListPageSkeleton />;

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          无法加载数据
        </CardContent>
      </Card>
    );
  }

  if (data.role === "SUPERVISOR") {
    const supData = data as SupervisorData;
    const isAdmin = supData.userRole === "ADMIN";

    // Show employee preview if active
    if (previewingEmployee && employeePreviewData && !previewLoading) {
      return (
        <div className="space-y-4">
          <AdminPerspectiveToggle
            items={supData.items}
            onPreviewEmployee={handlePreviewEmployee}
            onBackToSupervisor={() => { setPreviewingEmployee(null); setEmployeePreviewData(null); }}
            previewingEmployee={previewingEmployee}
          />
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 px-4 py-2 text-sm text-blue-700">
            当前正在查看 <span className="font-semibold">{employeePreviewData.employeeName}</span> 的员工视角
          </div>
          <EmployeeView data={employeePreviewData} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {isAdmin && supData.items.length > 0 && (
          <AdminPerspectiveToggle
            items={supData.items}
            onPreviewEmployee={handlePreviewEmployee}
            onBackToSupervisor={() => { setPreviewingEmployee(null); setEmployeePreviewData(null); }}
            previewingEmployee={previewingEmployee}
          />
        )}
        {previewLoading ? <ListPageSkeleton /> : <SupervisorView data={supData} />}
      </div>
    );
  }

  return <EmployeeView data={data as EmployeeData} />;
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MeetingsContent />
    </Suspense>
  );
}
