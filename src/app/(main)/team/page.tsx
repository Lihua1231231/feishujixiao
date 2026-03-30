"use client";

import { useEffect, useState, Suspense } from "react";
import { ListPageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { PageHeader } from "@/components/page-header";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";
import {
  computeAbilityAverage,
  computeValuesAverage,
  computeWeightedScoreFromDimensions,
} from "@/lib/weighted-score";

type TeamEval = {
  employee: { id: string; name: string; department: string; jobTitle: string | null };
  evaluation: {
    id: string;
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
    weightedScore: number | null;
    status: string;
  } | null;
  selfEval: {
    status: string;
    importedContent: string;
    sourceUrl?: string;
  } | null;
  peerReviewSummary: {
    performance: number;
    ability: number;
    values: number;
    overall: number;
    count: number;
    expectedCount: number;
    reviews: Array<{
      performanceStars: number | null; performanceComment: string;
      abilityAverage: number | null;
      comprehensiveStars: number | null; comprehensiveComment: string;
      learningStars: number | null; learningComment: string;
      adaptabilityStars: number | null; adaptabilityComment: string;
      legacyCollaborationScore: number | null; legacyCollaborationComment: string;
      valuesAverage: number | null;
      candidStars: number | null; candidComment: string;
      progressStars: number | null; progressComment: string;
      altruismStars: number | null; altruismComment: string;
      rootStars: number | null; rootComment: string;
      legacyValuesScore: number | null; legacyValuesComment: string;
      innovationScore: number | null; innovationComment: string;
    }>;
  } | null;
  isLegacyRecord?: boolean;
  expectedEvaluatorNames?: string[];
  currentEvaluatorNames?: string[];
  legacyOwnerNames?: string[];
  allSupervisorEvals?: Array<{
    evaluatorId: string;
    evaluatorName: string;
    status: string;
    weightedScore: number | null;
    isCurrentAssignment: boolean;
  }>;
};

type FormData = {
  performanceStars: number | null;
  performanceComment: string;
  comprehensiveStars: number | null;
  learningStars: number | null;
  adaptabilityStars: number | null;
  abilityComment: string;
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
};

type TeamMeta = {
  cycleStatus: string | null;
  canEdit: boolean;
  lockedReason: string | null;
};

type TeamResponse = {
  cycleStatus: string | null;
  canEdit: boolean;
  lockedReason: string | null;
  items: TeamEval[];
};

function computeWeightedScore(fd: FormData): number | null {
  return computeWeightedScoreFromDimensions({
    performanceStars: fd.performanceStars,
    comprehensiveStars: fd.comprehensiveStars,
    learningStars: fd.learningStars,
    adaptabilityStars: fd.adaptabilityStars,
    candidStars: fd.candidStars,
    progressStars: fd.progressStars,
    altruismStars: fd.altruismStars,
    rootStars: fd.rootStars,
  });
}

function normalizeTeamResponse(data: unknown): TeamResponse {
  if (Array.isArray(data)) {
    return {
      cycleStatus: null,
      canEdit: true,
      lockedReason: null,
      items: data as TeamEval[],
    };
  }

  if (data && typeof data === "object") {
    const payload = data as Partial<TeamResponse>;
    return {
      cycleStatus: payload.cycleStatus ?? null,
      canEdit: payload.canEdit ?? true,
      lockedReason: payload.lockedReason ?? null,
      items: Array.isArray(payload.items) ? payload.items : [],
    };
  }

  return {
    cycleStatus: null,
    canEdit: true,
    lockedReason: null,
    items: [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initFormData(ev: any): FormData {
  return {
    performanceStars: ev?.performanceStars || null,
    performanceComment: ev?.performanceComment || "",
    comprehensiveStars: ev?.comprehensiveStars || null,
    learningStars: ev?.learningStars || null,
    adaptabilityStars: ev?.adaptabilityStars || null,
    abilityComment: ev?.abilityComment || "",
    valuesStars: ev?.valuesStars || null,
    valuesComment: ev?.valuesComment || "",
    candidStars: ev?.candidStars || null,
    candidComment: ev?.candidComment || "",
    progressStars: ev?.progressStars || null,
    progressComment: ev?.progressComment || "",
    altruismStars: ev?.altruismStars || null,
    altruismComment: ev?.altruismComment || "",
    rootStars: ev?.rootStars || null,
    rootComment: ev?.rootComment || "",
  };
}

function renderPeerDimension(label: string, score: number | null, comment: string) {
  if (score == null || !comment) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label} ({score}分)：</span>
      <span>{comment}</span>
    </div>
  );
}

function TeamContent() {
  const { preview, previewRole, getData } = usePreview();
  const [evals, setEvals] = useState<TeamEval[]>([]);
  const [teamMeta, setTeamMeta] = useState<TeamMeta>({ cycleStatus: null, canEdit: true, lockedReason: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, FormData>>({});
  const [saving, setSaving] = useState(false);
  const [expandedSelfEval, setExpandedSelfEval] = useState(false);
  const [expandedPeerReview, setExpandedPeerReview] = useState(false);

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("team") as Record<string, unknown>;
      const previewEvals = (previewData.evals as TeamEval[]) || [];
      setEvals(previewEvals);
      setTeamMeta({ cycleStatus: null, canEdit: true, lockedReason: null });
      const initial: Record<string, FormData> = {};
      for (const e of previewEvals) {
        initial[e.employee.id] = initFormData(e.evaluation);
      }
      setFormData(initial);
      return;
    }

    const loadData = () => {
      fetch("/api/supervisor-eval").then((r) => r.json()).then((raw) => {
        const data = normalizeTeamResponse(raw);
        setTeamMeta({
          cycleStatus: data.cycleStatus,
          canEdit: data.canEdit,
          lockedReason: data.lockedReason,
        });
        setEvals((prev) => {
          // First load: initialize form data
          if (prev.length === 0) {
            const initial: Record<string, FormData> = {};
            for (const e of data.items) {
              initial[e.employee.id] = initFormData(e.evaluation);
            }
            setFormData(initial);
          }
          return data.items;
        });
      });
    };

    loadData();

    // Auto-refresh every 30s to get latest 360 peer review data
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [preview, previewRole, getData]);

  const saveEval = async (employeeId: string, action: "save" | "submit") => {
    if (preview) return;
    if (!teamMeta.canEdit) {
      toast.error(teamMeta.lockedReason || "当前不是上级初评阶段，无法保存或提交");
      return;
    }
    const fd = formData[employeeId];
    if (action === "submit" && (!fd.performanceStars || !fd.comprehensiveStars || !fd.learningStars || !fd.adaptabilityStars || !fd.candidStars || !fd.progressStars || !fd.altruismStars || !fd.rootStars)) {
      toast.error("请完成所有维度的星级评分");
      return;
    }
    if (action === "submit" && (!fd.performanceComment?.trim() || !fd.abilityComment?.trim() || !fd.candidComment?.trim() || !fd.progressComment?.trim() || !fd.altruismComment?.trim() || !fd.rootComment?.trim())) {
      toast.error("请填写所有维度的文字评语");
      return;
    }
    if (action === "submit" && !confirm("确认提交？提交后无法修改。")) return;

    setSaving(true);
    try {
      const res = await fetch("/api/supervisor-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, ...fd, action }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "操作失败");
      toast.success(action === "submit" ? "评估已提交" : "已保存");
      const refreshed = await fetch("/api/supervisor-eval").then((r) => r.json());
      const data = normalizeTeamResponse(refreshed);
      setTeamMeta({
        cycleStatus: data.cycleStatus,
        canEdit: data.canEdit,
        lockedReason: data.lockedReason,
      });
      setEvals(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const selectedEval = evals.find((e) => e.employee.id === selected);
  const isSubmitted = selectedEval?.evaluation?.status === "SUBMITTED";
  const isReadOnly = !!isSubmitted || (!teamMeta.canEdit && !preview);
  const currentForm = selected ? formData[selected] : null;
  const liveWeightedScore = currentForm ? computeWeightedScore(currentForm) : null;

  const updateField = (field: keyof FormData, value: FormData[keyof FormData]) => {
    if (!selected) return;
    setFormData((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], [field]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="绩效初评" description={`你有 ${evals.filter(e => !e.isLegacyRecord && e.evaluation?.status !== "SUBMITTED").length} 条初评任务待完成`} />

      {/* 初评说明 - 页面顶部只显示一次 */}
      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground divide-y">
          <div className="pb-3">
            <p className="text-sm font-semibold text-foreground mb-1">考核原则</p>
            <p className="leading-relaxed">深度赋智绩效考核采用&ldquo;OKR目标牵引 + 360度综合价值评估 + 全层级绩效校准&rdquo;三位一体体系，明确OKR为目标管理与协同工具，不直接与绩效考核结果挂钩，避免员工博弈目标、不敢挑战；绩效考核聚焦周期内员工的实际价值贡献、协作价值、战略适配度，实现&ldquo;目标有牵引、评价有依据、激励有区分、发展有方向&rdquo;。</p>
          </div>
          <div className="py-3">
            <p className="text-sm font-semibold text-foreground mb-1">管理者导向</p>
            <p className="leading-relaxed">各级管理者是团队绩效管理第一责任人；负责下属的目标对齐、双月过程辅导、绩效初评、一对一反馈沟通；组织团队内绩效复盘；举证员工绩效贡献，参与校准会；制定下属绩效改进计划，落地人才发展动作。</p>
          </div>
          <div className="py-3">
            <p className="text-sm font-semibold text-foreground mb-2">五星等级定义</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2.5 py-1.5 text-left font-medium">等级</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">定义</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">分布</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "五星", def: "取得杰出的成果，所做的工作在世界范围拥有领先性，拥有极强的推动力，拥有显著的影响力", dist: "≤10%" },
                    { label: "四星", def: "超出期望的成果，所做的工作在行业内具有竞争力，拥有很强的推动力，拥有一定的影响力", dist: "≤20%" },
                    { label: "三星", def: "符合预期的成果，始终如一地完成工作职责，可以较好的完成工作落地、闭环，具有较好的学习能力，具有不错的推动力", dist: "50%+" },
                    { label: "二星", def: "成果不达预期，需要提高。基本满足考核要求，但与他人相比不能充分执行所有的工作职责，或虽执行了职责但平均水平较低或成果较差", dist: "≤15%" },
                    { label: "一星", def: "成果远低于预期，未达合格标准。不能证明其具备所需的知识和技能或不能利用所需的知识和技能；不能执行其工作职责", dist: "≤5%" },
                  ].map((row) => (
                    <tr key={row.label} className="border-b last:border-b-0">
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-medium">{row.label}</td>
                      <td className="px-2.5 py-1.5">{row.def}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{row.dist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-3">
            <p className="text-sm font-semibold text-foreground mb-1">初评指引</p>
            <ul className="space-y-0.5 leading-relaxed">
              <li>• 直属上级结合员工工作总结、360度评估反馈、周期内实际产出、团队内相对贡献度、组织转型战略适配度，给出初步绩效等级与详细评价意见</li>
              <li>• 初评需严格遵循绩效等级定义与分布指导规则，不得突破比例限制</li>
              <li>• 对高绩效、低绩效评级必须提供完整的贡献举证与事实依据</li>
              <li>• 初评结果仅为待校准状态，不得提前向员工透露</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
          {/* Employee selector - horizontal */}
          <div className="flex flex-wrap gap-2">
            {evals.map((e) => (
              <button
                key={e.employee.id}
                onClick={() => { setSelected(e.employee.id); setExpandedSelfEval(false); }}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-left transition-all duration-[var(--transition-base)] ${
                  selected === e.employee.id
                    ? "border-primary bg-primary/[0.06] shadow-sm"
                    : "border-border/50 hover:border-border hover:bg-muted/40"
                }`}
              >
                <span className="text-sm font-medium">{e.employee.name}</span>
                {e.evaluation?.weightedScore != null && (
                  <Badge variant="outline" className="text-xs">{e.evaluation.weightedScore.toFixed(1)}分</Badge>
                )}
                {e.isLegacyRecord ? (
                  <Badge variant="outline">历史保留</Badge>
                ) : e.evaluation?.status === "SUBMITTED" ? (
                  <Badge variant="success">已评估</Badge>
                ) : (
                  <Badge variant="secondary">待评估</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Evaluation detail - full width below */}
          <div>
            {selectedEval ? (
              <div className="space-y-4">
                  <Card>
                    <CardContent className="flex flex-wrap items-center gap-2 py-4 text-sm">
                      {selectedEval.isLegacyRecord ? (
                        <Badge variant="outline">历史保留，不计入当前待办</Badge>
                      ) : (
                        <Badge variant="secondary">当前初评任务</Badge>
                      )}
                      {selectedEval.currentEvaluatorNames && selectedEval.currentEvaluatorNames.length > 0 && (
                        <span className="text-muted-foreground">当前初评人：{selectedEval.currentEvaluatorNames.join("、")}</span>
                      )}
                      {selectedEval.legacyOwnerNames && selectedEval.legacyOwnerNames.length > 0 && (
                        <span className="text-muted-foreground">历史保留：{selectedEval.legacyOwnerNames.join("、")}</span>
                      )}
                    </CardContent>
                  </Card>

                  {!preview && teamMeta.lockedReason ? (
                    <Card className="border-amber-200 bg-amber-50/70">
                      <CardContent className="py-4 text-sm text-amber-900">
                        {teamMeta.lockedReason}
                        {teamMeta.cycleStatus ? `（当前周期阶段：${teamMeta.cycleStatus}）` : ""}
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* Self evaluation */}
                  {selectedEval.selfEval && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">员工自评 - {selectedEval.employee.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedEval.selfEval.importedContent ? (
                          <>
                            <p className={`whitespace-pre-wrap text-sm ${!expandedSelfEval ? "max-h-20 overflow-hidden" : ""}`}>
                              {selectedEval.selfEval.importedContent}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs"
                              onClick={() => setExpandedSelfEval(!expandedSelfEval)}
                            >
                              {expandedSelfEval ? "收起" : "展开全部"}
                            </Button>
                          </>
                        ) : selectedEval.selfEval.sourceUrl ? (
                          <a
                            href={selectedEval.selfEval.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            查看飞书自评文档 →
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground">未填写</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Peer review summary */}
                  {selectedEval.peerReviewSummary && (
                    <Card>
                      <CardHeader className="cursor-pointer" onClick={() => setExpandedPeerReview(!expandedPeerReview)}>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            360环评汇总
                            {selectedEval.peerReviewSummary.expectedCount === 0 ? (
                              <span className="ml-2 text-sm font-normal text-muted-foreground">尚未提名评估人</span>
                            ) : (
                              <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({selectedEval.peerReviewSummary.count}/{selectedEval.peerReviewSummary.expectedCount} 已完成)
                              </span>
                            )}
                          </CardTitle>
                          <span className="text-xs text-muted-foreground">{expandedPeerReview ? "收起" : "展开详情"}</span>
                        </div>
                        {selectedEval.peerReviewSummary.expectedCount > 0 && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all ${selectedEval.peerReviewSummary.count >= selectedEval.peerReviewSummary.expectedCount ? "bg-green-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(100, (selectedEval.peerReviewSummary.count / selectedEval.peerReviewSummary.expectedCount) * 100)}%` }}
                            />
                          </div>
                        )}
                      </CardHeader>
                      {selectedEval.peerReviewSummary.count > 0 && (
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-2xl font-bold">{selectedEval.peerReviewSummary.performance.toFixed(1)}</p>
                              <p className="text-xs text-gray-500">业绩产出</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{selectedEval.peerReviewSummary.ability.toFixed(1)}</p>
                              <p className="text-xs text-gray-500">个人能力</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{selectedEval.peerReviewSummary.values.toFixed(1)}</p>
                              <p className="text-xs text-gray-500">价值观</p>
                            </div>
                          </div>

                          {expandedPeerReview && selectedEval.peerReviewSummary.reviews.length > 0 && (
                            <div className="space-y-3 border-t pt-4">
                              <p className="text-xs font-medium text-muted-foreground">匿名评语详情</p>
                              {selectedEval.peerReviewSummary.reviews.map((r, i) => (
                                <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2 text-sm">
                                  <p className="text-xs font-semibold text-muted-foreground">评估人 {i + 1}</p>
                                  {renderPeerDimension("业绩产出", r.performanceStars, r.performanceComment)}
                                  {renderPeerDimension("综合能力", r.comprehensiveStars, r.comprehensiveComment)}
                                  {renderPeerDimension("学习能力", r.learningStars, r.learningComment)}
                                  {renderPeerDimension("适应能力", r.adaptabilityStars, r.adaptabilityComment)}
                                  {!r.comprehensiveComment && !r.learningComment && !r.adaptabilityComment
                                    ? renderPeerDimension("个人能力", r.abilityAverage, r.legacyCollaborationComment)
                                    : null}
                                  {renderPeerDimension("坦诚真实", r.candidStars, r.candidComment)}
                                  {renderPeerDimension("极致进取", r.progressStars, r.progressComment)}
                                  {renderPeerDimension("成就利他", r.altruismStars, r.altruismComment)}
                                  {renderPeerDimension("ROOT", r.rootStars, r.rootComment)}
                                  {!r.candidComment && !r.progressComment && !r.altruismComment && !r.rootComment
                                    ? renderPeerDimension("价值观", r.valuesAverage, r.legacyValuesComment)
                                    : null}
                                  {r.innovationComment && (
                                    <div>
                                      <span className="text-xs text-muted-foreground">其他 ({r.innovationScore}分)：</span>
                                      <span>{r.innovationComment}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Weighted score display */}
                  {liveWeightedScore != null && (
                    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.04] px-5 py-3.5">
                      <span className="text-sm font-medium">加权总分</span>
                      <span className="text-xl font-bold tracking-tight text-primary">{liveWeightedScore.toFixed(1)} <span className="text-sm font-medium">分</span></span>
                    </div>
                  )}

                  {/* Three-dimension evaluation form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">上级评估 - 三维度星级评分</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Performance */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">业绩产出</h3>
                          <span className="text-xs text-muted-foreground">权重50%</span>
                          <a href="https://deepwisdom.feishu.cn/wiki/FPUDw7LHmi0OYbkLZAKcjMgBnmU" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">考核方案</a>
                        </div>
                        <StarRating
                          value={formData[selected!]?.performanceStars}
                          onChange={(v) => updateField("performanceStars", v)}
                          disabled={isReadOnly}
                        />
                        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">请结合员工工作总结自评 + 周期内实际产出结果 + OKR完成度 + 团队内贡献度综合评定，需提供数据/案例作证和描述</p>
                        <Textarea
                          value={formData[selected!]?.performanceComment || ""}
                          onChange={(e) => updateField("performanceComment", e.target.value)}
                          placeholder="请输入评语..."
                          rows={3}
                          disabled={isReadOnly}
                        />
                      </div>

                      {/* Ability - 3 sub-dimensions */}
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">个人能力</h3>
                          <span className="text-xs text-muted-foreground">权重30%（三项等权1:1:1）</span>
                          <a href="https://deepwisdom.feishu.cn/wiki/FPUDw7LHmi0OYbkLZAKcjMgBnmU" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">考核方案</a>
                          {(() => {
                            const average = computeAbilityAverage(
                              formData[selected!]?.comprehensiveStars ?? null,
                              formData[selected!]?.learningStars ?? null,
                              formData[selected!]?.adaptabilityStars ?? null,
                            );
                            return average != null ? <span className="text-xs font-medium text-primary">均分 {average.toFixed(1)}</span> : null;
                          })()}
                        </div>

                        <div className="space-y-3 rounded-lg border border-border/50 p-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium">综合能力 <span className="font-normal text-muted-foreground/60">— vibe coding能力（必含，对所有岗位生效）、复杂问题解决与业务闭环、专业纵深与角色履职、跨边界协同与组织价值创造、团队赋能与价值带动、领导力-基础管理执行（限leader）</span></p>
                            <StarRating
                              value={formData[selected!]?.comprehensiveStars}
                              onChange={(v) => updateField("comprehensiveStars", v)}
                              disabled={isReadOnly}
                              size="sm"
                            />
                          </div>

                          <div className="border-t pt-3 space-y-1">
                            <p className="text-xs font-medium">学习能力 <span className="font-normal text-muted-foreground/60">— 问题分析与判断力、推动执行力、主动性与批判性思考。</span></p>
                            <StarRating
                              value={formData[selected!]?.learningStars}
                              onChange={(v) => updateField("learningStars", v)}
                              disabled={isReadOnly}
                              size="sm"
                            />
                          </div>

                          <div className="border-t pt-3 space-y-1">
                            <p className="text-xs font-medium">适应能力 <span className="font-normal text-muted-foreground/60">— 指的是，面对业务复杂性、场景变化、节奏加速、组织调整或目标切换时，能够快速调整认知、情绪、方法和资源配置，持续保持有效产出的能力。</span></p>
                            <StarRating
                              value={formData[selected!]?.adaptabilityStars}
                              onChange={(v) => updateField("adaptabilityStars", v)}
                              disabled={isReadOnly}
                              size="sm"
                            />
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground/70">请结合以上三项综合评定，需提供数据/案例作证和描述</p>
                        <Textarea
                          value={formData[selected!]?.abilityComment || ""}
                          onChange={(e) => updateField("abilityComment", e.target.value)}
                          placeholder="请输入评语..."
                          rows={3}
                          disabled={isReadOnly}
                        />
                      </div>

                      {/* Values */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">价值观</h3>
                          <span className="text-xs text-muted-foreground">权重20%（4项等权平均）</span>
                          <a href="https://deepwisdom.feishu.cn/wiki/FPUDw7LHmi0OYbkLZAKcjMgBnmU" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">考核方案</a>
                          {computeValuesAverage(
                            formData[selected!]?.candidStars ?? null,
                            formData[selected!]?.progressStars ?? null,
                            formData[selected!]?.altruismStars ?? null,
                            formData[selected!]?.rootStars ?? null,
                          ) != null && (
                            <Badge variant="outline" className="text-xs">
                              均分 {computeValuesAverage(
                                formData[selected!]?.candidStars ?? null,
                                formData[selected!]?.progressStars ?? null,
                                formData[selected!]?.altruismStars ?? null,
                                formData[selected!]?.rootStars ?? null,
                              )?.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">请针对以下4条价值观分别评分和评语，需提供数据/案例作证和描述</p>

                        <div className="space-y-4 rounded-lg border border-border/50 p-4">
                          <div className="space-y-1.5">
                            <p className="text-sm font-medium">坦诚真实 <span className="text-xs font-normal text-muted-foreground">Be candid and honest — 行为基础</span></p>
                            <p className="text-[11px] text-muted-foreground">简单直接，对事不对人 · 敢于承认错误，不装不爱面子 · 暴露问题，不向上管理 · 不找借口，只找解法</p>
                            <StarRating value={formData[selected!]?.candidStars} onChange={(v) => updateField("candidStars", v)} disabled={isReadOnly} />
                            <Textarea value={formData[selected!]?.candidComment || ""} onChange={(e) => updateField("candidComment", e.target.value)} placeholder="请输入评语..." rows={2} disabled={isReadOnly} />
                          </div>

                          <div className="space-y-1.5 border-t pt-4">
                            <p className="text-sm font-medium">极致进取 <span className="text-xs font-normal text-muted-foreground">Move fast, aim higher — 动机驱动</span></p>
                            <p className="text-[11px] text-muted-foreground">目标明确，积极主动 · 用 demo 代替文档，用行动代替沟通 · 敢于挑战更优解，用实验代替争论 · 深入体验，消灭锯齿</p>
                            <StarRating value={formData[selected!]?.progressStars} onChange={(v) => updateField("progressStars", v)} disabled={isReadOnly} />
                            <Textarea value={formData[selected!]?.progressComment || ""} onChange={(e) => updateField("progressComment", e.target.value)} placeholder="请输入评语..." rows={2} disabled={isReadOnly} />
                          </div>

                          <div className="space-y-1.5 border-t pt-4">
                            <p className="text-sm font-medium">成就利他 <span className="text-xs font-normal text-muted-foreground">Build together, win together — 协作胸怀</span></p>
                            <p className="text-[11px] text-muted-foreground">用户第一，以用户成功为价值 · 内心阳光，信任伙伴，真诚合作 · 敏锐谦逊，ego 小，乐于贡献</p>
                            <StarRating value={formData[selected!]?.altruismStars} onChange={(v) => updateField("altruismStars", v)} disabled={isReadOnly} />
                            <Textarea value={formData[selected!]?.altruismComment || ""} onChange={(e) => updateField("altruismComment", e.target.value)} placeholder="请输入评语..." rows={2} disabled={isReadOnly} />
                          </div>

                          <div className="space-y-1.5 border-t pt-4">
                            <p className="text-sm font-medium">ROOT <span className="text-xs font-normal text-muted-foreground">组织导向</span></p>
                            <p className="text-[11px] text-muted-foreground">有 ownership，不踢皮球，不设边界 · 独立思考，快速学习，与 AI 共同进化 · 关注结果而非过程 · 始终像公司创业第一天那样思考</p>
                            <StarRating value={formData[selected!]?.rootStars} onChange={(v) => updateField("rootStars", v)} disabled={isReadOnly} />
                            <Textarea value={formData[selected!]?.rootComment || ""} onChange={(e) => updateField("rootComment", e.target.value)} placeholder="请输入评语..." rows={2} disabled={isReadOnly} />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isReadOnly && (
                        <div className="flex justify-end gap-2 border-t pt-4">
                          <Button variant="outline" onClick={() => saveEval(selected!, "save")} disabled={preview || saving}>{saving ? "保存中..." : "保存"}</Button>
                          <Button onClick={() => saveEval(selected!, "submit")} disabled={preview || saving}>提交评估</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <UserCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">选择上方的员工开始评估</p>
                  </CardContent>
                </Card>
              )}
          </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <TeamContent />
    </Suspense>
  );
}
