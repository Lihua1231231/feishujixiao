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
    weightedScore: number | null;
    status: string;
  } | null;
  selfEval: {
    status: string;
    importedContent: string;
  } | null;
  peerReviewSummary: {
    output: number;
    collaboration: number;
    values: number;
    count: number;
  } | null;
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
};

function computeAbilityStars(fd: FormData): number | null {
  if (fd.comprehensiveStars == null || fd.learningStars == null || fd.adaptabilityStars == null) return null;
  return Math.round((fd.comprehensiveStars + fd.learningStars + fd.adaptabilityStars) / 3);
}

function computeWeightedScore(fd: FormData): number | null {
  const abilityStars = computeAbilityStars(fd);
  if (fd.performanceStars == null || abilityStars == null || fd.valuesStars == null) return null;
  return fd.performanceStars * 0.5 + abilityStars * 0.3 + fd.valuesStars * 0.2;
}

function TeamContent() {
  const { preview, previewRole, getData } = usePreview();
  const [evals, setEvals] = useState<TeamEval[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, FormData>>({});
  const [saving, setSaving] = useState(false);
  const [expandedSelfEval, setExpandedSelfEval] = useState(false);

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("team") as Record<string, unknown>;
      const previewEvals = (previewData.evals as TeamEval[]) || [];
      setEvals(previewEvals);
      const initial: Record<string, FormData> = {};
      for (const e of previewEvals) {
        initial[e.employee.id] = {
          performanceStars: e.evaluation?.performanceStars || null,
          performanceComment: e.evaluation?.performanceComment || "",
          comprehensiveStars: e.evaluation?.comprehensiveStars || null,
          learningStars: e.evaluation?.learningStars || null,
          adaptabilityStars: e.evaluation?.adaptabilityStars || null,
          abilityComment: e.evaluation?.abilityComment || "",
          valuesStars: e.evaluation?.valuesStars || null,
          valuesComment: e.evaluation?.valuesComment || "",
        };
      }
      setFormData(initial);
      return;
    }

    const loadData = () => {
      fetch("/api/supervisor-eval").then((r) => r.json()).then((data) => {
        setEvals((prev) => {
          // First load: initialize form data
          if (prev.length === 0) {
            const initial: Record<string, FormData> = {};
            for (const e of data) {
              initial[e.employee.id] = {
                performanceStars: e.evaluation?.performanceStars || null,
                performanceComment: e.evaluation?.performanceComment || "",
                comprehensiveStars: e.evaluation?.comprehensiveStars || null,
                learningStars: e.evaluation?.learningStars || null,
                adaptabilityStars: e.evaluation?.adaptabilityStars || null,
                abilityComment: e.evaluation?.abilityComment || "",
                valuesStars: e.evaluation?.valuesStars || null,
                valuesComment: e.evaluation?.valuesComment || "",
              };
            }
            setFormData(initial);
          }
          return data;
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
    const fd = formData[employeeId];
    if (action === "submit" && (!fd.performanceStars || !fd.comprehensiveStars || !fd.learningStars || !fd.adaptabilityStars || !fd.valuesStars)) {
      toast.error("请完成所有维度的星级评分");
      return;
    }
    if (action === "submit" && !confirm("确认提交？提交后无法修改。")) return;

    setSaving(true);
    try {
      await fetch("/api/supervisor-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, ...fd, action }),
      });
      toast.success(action === "submit" ? "评估已提交" : "已保存");
      const data = await fetch("/api/supervisor-eval").then((r) => r.json());
      setEvals(data);
    } catch {
      toast.error("操作失败");
    } finally {
      setSaving(false);
    }
  };

  const selectedEval = evals.find((e) => e.employee.id === selected);
  const isSubmitted = selectedEval?.evaluation?.status === "SUBMITTED";
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
      <PageHeader title="团队评估" description={`你有 ${evals.filter(e => e.evaluation?.status !== "SUBMITTED").length} 位下级待初评`} />

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
                {e.evaluation?.status === "SUBMITTED" ? (
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
                  {/* Self evaluation */}
                  {selectedEval.selfEval && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">员工自评 - {selectedEval.employee.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className={`whitespace-pre-wrap text-sm ${!expandedSelfEval ? "max-h-20 overflow-hidden" : ""}`}>
                          {selectedEval.selfEval.importedContent || "未填写"}
                        </p>
                        {selectedEval.selfEval.importedContent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => setExpandedSelfEval(!expandedSelfEval)}
                          >
                            {expandedSelfEval ? "收起" : "展开全部"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Peer review summary */}
                  {selectedEval.peerReviewSummary && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">360环评汇总 ({selectedEval.peerReviewSummary.count}人)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold">{selectedEval.peerReviewSummary.output.toFixed(1)}</p>
                            <p className="text-xs text-gray-500">业绩产出</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{selectedEval.peerReviewSummary.collaboration.toFixed(1)}</p>
                            <p className="text-xs text-gray-500">协作配合</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{selectedEval.peerReviewSummary.values.toFixed(1)}</p>
                            <p className="text-xs text-gray-500">价值观</p>
                          </div>
                        </div>
                      </CardContent>
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
                        </div>
                        <StarRating
                          value={formData[selected!]?.performanceStars}
                          onChange={(v) => updateField("performanceStars", v)}
                          disabled={!!isSubmitted}
                        />
                        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">请结合员工工作总结自评 + 周期内实际产出结果 + OKR完成度 + 团队内贡献度综合评定，需提供数据/案例作证和描述</p>
                        <Textarea
                          value={formData[selected!]?.performanceComment || ""}
                          onChange={(e) => updateField("performanceComment", e.target.value)}
                          placeholder="请输入评语..."
                          rows={3}
                          disabled={!!isSubmitted}
                        />
                      </div>

                      {/* Ability - 3 sub-dimensions */}
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">个人能力</h3>
                          <span className="text-xs text-muted-foreground">权重30%（三项等权1:1:1）</span>
                          {(() => {
                            const ab = computeAbilityStars(formData[selected!] || {} as FormData);
                            return ab != null ? <span className="text-xs font-medium text-primary">{ab}星</span> : null;
                          })()}
                        </div>

                        <div className="space-y-3 rounded-lg border border-border/50 p-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium">综合能力 <span className="font-normal text-muted-foreground/60">— 人才价值交付的基本盘，与岗位职级强绑定</span></p>
                            <p className="text-[11px] text-muted-foreground/70">复杂问题解决 · 专业纵深 · 跨边界协同 · 团队赋能 · vibe coding（必含） · 领导力（限Leader）</p>
                            <StarRating
                              value={formData[selected!]?.comprehensiveStars}
                              onChange={(v) => updateField("comprehensiveStars", v)}
                              disabled={!!isSubmitted}
                              size="sm"
                            />
                          </div>

                          <div className="border-t pt-3 space-y-1">
                            <p className="text-xs font-medium">学习能力 <span className="font-normal text-muted-foreground/60">— 从「知道」到「做到」闭环</span></p>
                            <p className="text-[11px] text-muted-foreground/70">问题分析与判断力 · 推动执行力 · 主动性与批判性思考</p>
                            <StarRating
                              value={formData[selected!]?.learningStars}
                              onChange={(v) => updateField("learningStars", v)}
                              disabled={!!isSubmitted}
                              size="sm"
                            />
                          </div>

                          <div className="border-t pt-3 space-y-1">
                            <p className="text-xs font-medium">适应能力 <span className="font-normal text-muted-foreground/60">— 面对变化快速调整，持续有效产出</span></p>
                            <p className="text-[11px] text-muted-foreground/70">AI-first 适配度 · 主动性、自我成长、心理韧性、潜力项</p>
                            <StarRating
                              value={formData[selected!]?.adaptabilityStars}
                              onChange={(v) => updateField("adaptabilityStars", v)}
                              disabled={!!isSubmitted}
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
                          disabled={!!isSubmitted}
                        />
                      </div>

                      {/* Values */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">价值观</h3>
                          <span className="text-xs text-muted-foreground">权重20%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">请针对以下4条价值观进行评估，需提供数据/案例作证和描述</p>
                        <div className="rounded-lg border border-border/50 p-3 text-[11px] text-muted-foreground divide-y">
                          <div className="pb-2">
                            <p className="font-medium text-foreground/70">坦诚真实 <span className="font-normal text-muted-foreground/60">Be candid and honest — 行为基础</span></p>
                            <p className="mt-0.5">简单直接，对事不对人 · 敢于承认错误，不装不爱面子 · 暴露问题，不向上管理 · 不找借口，只找解法</p>
                          </div>
                          <div className="py-2">
                            <p className="font-medium text-foreground/70">极致进取 <span className="font-normal text-muted-foreground/60">Move fast, aim higher — 动机驱动</span></p>
                            <p className="mt-0.5">目标明确，积极主动 · 用 demo 代替文档，用行动代替沟通 · 敢于挑战更优解，用实验代替争论 · 深入体验，消灭锯齿</p>
                          </div>
                          <div className="py-2">
                            <p className="font-medium text-foreground/70">成就利他 <span className="font-normal text-muted-foreground/60">Build together, win together — 协作胸怀</span></p>
                            <p className="mt-0.5">用户第一，以用户成功为价值 · 内心阳光，信任伙伴，真诚合作 · 敏锐谦逊，ego 小，乐于贡献</p>
                          </div>
                          <div className="pt-2">
                            <p className="font-medium text-foreground/70">ROOT <span className="font-normal text-muted-foreground/60">组织导向</span></p>
                            <p className="mt-0.5">有 ownership，不踢皮球，不设边界 · 独立思考，快速学习，与 AI 共同进化 · 关注结果而非过程 · 始终像公司创业第一天那样思考</p>
                          </div>
                        </div>
                        <StarRating
                          value={formData[selected!]?.valuesStars}
                          onChange={(v) => updateField("valuesStars", v)}
                          disabled={!!isSubmitted}
                        />
                        <Textarea
                          value={formData[selected!]?.valuesComment || ""}
                          onChange={(e) => updateField("valuesComment", e.target.value)}
                          placeholder="请输入评语..."
                          rows={3}
                          disabled={!!isSubmitted}
                        />
                      </div>

                      {/* Actions */}
                      {!isSubmitted && (
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
