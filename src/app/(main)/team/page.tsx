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
  abilityStars: number | null;
  abilityComment: string;
  valuesStars: number | null;
  valuesComment: string;
};

function computeWeightedScore(fd: FormData): number | null {
  if (fd.performanceStars == null || fd.abilityStars == null || fd.valuesStars == null) return null;
  return fd.performanceStars * 0.5 + fd.abilityStars * 0.3 + fd.valuesStars * 0.2;
}

function TeamContent() {
  const { preview, previewRole, getData } = usePreview();
  const [evals, setEvals] = useState<TeamEval[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, FormData>>({});

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
          abilityStars: e.evaluation?.abilityStars || null,
          abilityComment: e.evaluation?.abilityComment || "",
          valuesStars: e.evaluation?.valuesStars || null,
          valuesComment: e.evaluation?.valuesComment || "",
        };
      }
      setFormData(initial);
      return;
    }

    fetch("/api/supervisor-eval").then((r) => r.json()).then((data) => {
      setEvals(data);
      const initial: Record<string, FormData> = {};
      for (const e of data) {
        initial[e.employee.id] = {
          performanceStars: e.evaluation?.performanceStars || null,
          performanceComment: e.evaluation?.performanceComment || "",
          abilityStars: e.evaluation?.abilityStars || null,
          abilityComment: e.evaluation?.abilityComment || "",
          valuesStars: e.evaluation?.valuesStars || null,
          valuesComment: e.evaluation?.valuesComment || "",
        };
      }
      setFormData(initial);
    });
  }, [preview, previewRole, getData]);

  const saveEval = async (employeeId: string, action: "save" | "submit") => {
    if (preview) return;
    const fd = formData[employeeId];
    if (action === "submit" && (!fd.performanceStars || !fd.abilityStars || !fd.valuesStars)) {
      toast.error("请完成所有维度的星级评分");
      return;
    }
    if (action === "submit" && !confirm("确认提交？提交后无法修改。")) return;

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
    }
  };

  const selectedEval = evals.find((e) => e.employee.id === selected);
  const isSubmitted = selectedEval?.evaluation?.status === "SUBMITTED";
  const currentForm = selected ? formData[selected] : null;
  const liveWeightedScore = currentForm ? computeWeightedScore(currentForm) : null;

  const updateField = (field: keyof FormData, value: FormData[keyof FormData]) => {
    if (!selected || preview) return;
    setFormData((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], [field]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="团队评估" description={`你有 ${evals.filter(e => e.evaluation?.status !== "SUBMITTED").length} 位下级待初评`} />

      <div className="space-y-6">
          {/* Employee selector - horizontal */}
          <div className="flex flex-wrap gap-2">
            {evals.map((e) => (
              <button
                key={e.employee.id}
                onClick={() => setSelected(e.employee.id)}
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
                        <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm">
                          {selectedEval.selfEval.importedContent || "未填写"}
                        </p>
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

                  {/* 考核原则、导向、等级、初评指引 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">初评说明</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground space-y-3">
                          <div>
                            <p className="font-semibold text-foreground/80">考核原则</p>
                            <p>深度赋智绩效考核采用&ldquo;OKR目标牵引 + 360度综合价值评估 + 全层级绩效校准&rdquo;三位一体体系，明确OKR为目标管理与协同工具，不直接与绩效考核结果挂钩，避免员工博弈目标、不敢挑战；绩效考核聚焦周期内员工的实际价值贡献、协作价值、战略适配度，实现&ldquo;目标有牵引、评价有依据、激励有区分、发展有方向&rdquo;。</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground/80">管理者导向</p>
                            <p>各级管理者是团队绩效管理第一责任人；负责下属的目标对齐、双月过程辅导、绩效初评、一对一反馈沟通；组织团队内绩效复盘；举证员工绩效贡献，参与校准会；制定下属绩效改进计划，落地人才发展动作。</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground/80">五星等级定义</p>
                            <div className="overflow-x-auto rounded-md border mt-1">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    <th className="px-3 py-2 text-left font-medium">等级</th>
                                    <th className="px-3 py-2 text-left font-medium">定义</th>
                                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">分布参考</th>
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
                                      <td className="px-3 py-2 whitespace-nowrap font-medium">{row.label}</td>
                                      <td className="px-3 py-2">{row.def}</td>
                                      <td className="px-3 py-2 text-right"><Badge variant="secondary">{row.dist}</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground/80">初评指引</p>
                            <ul className="mt-1 space-y-1">
                              <li>• 直属上级结合员工工作总结、360度评估反馈、周期内实际产出、团队内相对贡献度、组织转型战略适配度，为员工给出初步绩效等级与详细评价意见，撰写绩效评语</li>
                              <li>• 初评需严格遵循公司统一的绩效等级定义与分布指导规则，不得突破比例限制</li>
                              <li>• 对高绩效、低绩效评级必须提供完整的贡献举证与事实依据</li>
                              <li>• 初评结果仅为待校准状态，不得提前向员工透露</li>
                            </ul>
                          </div>
                      </div>
                    </CardContent>
                  </Card>

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
                          disabled={!!isSubmitted || preview}
                        />
                        <Textarea
                          value={formData[selected!]?.performanceComment || ""}
                          onChange={(e) => updateField("performanceComment", e.target.value)}
                          placeholder="请结合员工工作总结自评 + 周期内实际产出结果 + OKR完成度 + 团队内贡献度综合评定，需提供数据/案例作证和描述"
                          rows={3}
                          disabled={isSubmitted || preview}
                        />
                      </div>

                      {/* Ability */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">个人能力</h3>
                          <span className="text-xs text-muted-foreground">权重30%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          请结合员工综合能力 + 学习能力 + 适应能力，综合评定，需提供数据/案例作证和描述
                        </p>
                        <div className="text-xs text-muted-foreground mt-2 space-y-3 pl-2">
                            <div>
                              <p className="font-medium">综合能力：</p>
                              <p className="text-xs text-muted-foreground/80 mb-1">综合能力是人才价值交付的基本盘，是绩效持续达标的底层支撑，与岗位职级强绑定，不同职级对应明确的能力标尺，也是组织能力建设的最小单元。</p>
                              <ul className="list-disc space-y-0.5 pl-4">
                                <li>复杂问题解决与业务闭环：穿透表象抓住业务本质，以最小成本解决核心矛盾，实现从目标到结果的全链路闭环</li>
                                <li>专业纵深与角色履职：匹配岗位职级的专业硬实力，全面、稳定履行岗位职责，在专业领域形成不可替代的价值</li>
                                <li>跨边界协同与组织价值创造：在跨团队、跨职能、跨区域协作中创造增量价值，而非单纯的配合执行</li>
                                <li>团队赋能与价值带动：基于自身能力为团队/组织赋能，带动周边同事共同成长，能做到利他</li>
                                <li>vibe coding（必含，对所有岗位生效）：能通过AI-first工作方式落地，提高交付效能</li>
                                <li>领导力-基础管理执行（限Leader）：遵循[T] RFC-368-研发团队基础管理办法</li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium">学习能力：</p>
                              <p className="text-xs text-muted-foreground/80 mb-1">学习能力是员工在快速变化的业务环境中，快速获取、消化、转化新知识新方法，持续刷新认知、迭代能力，实现从「知道」到「做到」闭环的核心能力，是公司保持创新活力的核心人才特质，也是高潜人才识别、成长的关键项。</p>
                              <ul className="list-disc space-y-0.5 pl-4">
                                <li>问题分析与判断力：能抓主要矛盾，识别问题本质，在信息不完整时做出相对正确的判断，而不是停留在表面现象</li>
                                <li>推动执行力：能把目标拆解成路径、节奏、责任人和关键节点，持续推进，不拖不等不绕</li>
                                <li>主动性与批判性思考：能否基于业务实际，提出自己的独立判断与优化建议，不盲目跟风，始终基于本质思考做决策</li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium">适应能力：</p>
                              <p className="text-xs text-muted-foreground/80 mb-1">面对业务复杂性、场景变化、节奏加速、组织调整或目标切换时，能够快速调整认知、情绪、方法和资源配置，持续保持有效产出的能力。</p>
                              <ul className="list-disc space-y-0.5 pl-4">
                                <li>AI-first工作方式落地与AI-native交付这一组织转型战略的适配度</li>
                                <li>可参考主动性、自我成长、心理韧性、潜力项展开综述</li>
                              </ul>
                            </div>
                        </div>
                        <StarRating
                          value={formData[selected!]?.abilityStars}
                          onChange={(v) => updateField("abilityStars", v)}
                          disabled={!!isSubmitted || preview}
                        />
                        <Textarea
                          value={formData[selected!]?.abilityComment || ""}
                          onChange={(e) => updateField("abilityComment", e.target.value)}
                          placeholder="请结合员工综合能力 + 学习能力 + 适应能力，综合评定，需提供数据/案例作证和描述"
                          rows={3}
                          disabled={isSubmitted || preview}
                        />
                      </div>

                      {/* Values */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold">价值观</h3>
                          <span className="text-xs text-muted-foreground">权重20%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ROOT = Ownership、独立思考与快速学习、结果导向、Always Day 1
                        </p>
                        <StarRating
                          value={formData[selected!]?.valuesStars}
                          onChange={(v) => updateField("valuesStars", v)}
                          disabled={!!isSubmitted || preview}
                        />
                        <Textarea
                          value={formData[selected!]?.valuesComment || ""}
                          onChange={(e) => updateField("valuesComment", e.target.value)}
                          placeholder='请针对价值观更新：从「始终创业」到「ROOT」的组织导向升级4条进行评估，需提供数据/案例作证和描述'
                          rows={3}
                          disabled={isSubmitted || preview}
                        />
                      </div>

                      {/* Actions */}
                      {!isSubmitted && (
                        <div className="flex justify-end gap-2 border-t pt-4">
                          <Button variant="outline" onClick={() => saveEval(selected!, "save")} disabled={preview}>保存</Button>
                          <Button onClick={() => saveEval(selected!, "submit")} disabled={preview}>提交评估</Button>
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
