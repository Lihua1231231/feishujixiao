"use client";

import { Suspense, type ReactNode, useCallback, useEffect, useState } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { toast } from "sonner";

type DistributionEntry = {
  stars: number;
  count: number;
  pct: number;
  exceeded: boolean;
  delta: number;
  names: string[];
};

type EmployeeOpinion = {
  reviewerId: string;
  reviewerName: string;
  decision: string;
  decisionLabel: string;
  suggestedStars: number | null;
  reason: string;
  isMine: boolean;
  updatedAt: string | null;
};

type EmployeeRow = {
  id: string;
  name: string;
  department: string;
  jobTitle: string | null;
  weightedScore: number | null;
  referenceStars: number | null;
  referenceSourceLabel: string;
  officialStars: number | null;
  officialReason: string;
  officialConfirmedAt: string | null;
  officialConfirmerName: string | null;
  finalizable: boolean;
  currentEvaluatorNames: string[];
  currentEvaluatorStatuses: Array<{
    evaluatorId: string;
    evaluatorName: string;
    status: string;
    weightedScore: number | null;
  }>;
  selfEvalStatus: string | null;
  peerAverage: number | null;
  handledCount: number;
  totalReviewerCount: number;
  anomalyTags: string[];
  opinions: EmployeeOpinion[];
};

type LeaderForm = {
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
};

type LeaderEvaluation = {
  evaluatorId: string;
  evaluatorName: string;
  status: string;
  weightedScore: number | null;
  editable: boolean;
  submittedAt: string | null;
  form: LeaderForm;
};

type LeaderRow = {
  id: string;
  name: string;
  department: string;
  jobTitle: string | null;
  officialStars: number | null;
  officialReason: string;
  officialConfirmedAt: string | null;
  officialConfirmerName: string | null;
  finalizable: boolean;
  evaluations: LeaderEvaluation[];
  bothSubmitted: boolean;
};

type WorkspacePayload = {
  cycle: {
    id: string;
    name: string;
    status: string;
    calibrationStart: string;
    calibrationEnd: string;
  } | null;
  canAccess: boolean;
  config: {
    accessUsers: Array<{ id: string; name: string; department: string }>;
    finalizers: Array<{ id: string; name: string; department: string }>;
    leaderEvaluators: Array<{ id: string; name: string; department: string }>;
    leaderSubjects: Array<{ id: string; name: string; department: string }>;
  } | null;
  overview: {
    principles: string[];
    chainGuidance: string[];
    distributionHints: string[];
    riskSummary: string[];
    progress: {
      employeeOpinionDone: number;
      employeeOpinionTotal: number;
      employeeConfirmedCount: number;
      employeeTotalCount: number;
      leaderSubmittedCounts: Array<{
        evaluatorId: string;
        evaluatorName: string;
        submittedCount: number;
      }>;
      leaderConfirmedCount: number;
      leaderTotalCount: number;
    };
  } | null;
  employeeReview: {
    overview: {
      companyCount: number;
      initialEvalSubmissionRate: number;
      officialCompletionRate: number;
      pendingOfficialCount: number;
    };
    companyDistribution: DistributionEntry[];
    employeeDistribution: DistributionEntry[];
    departmentDistributions: Array<{
      department: string;
      total: number;
      distribution: DistributionEntry[];
    }>;
    employees: EmployeeRow[];
  } | null;
  leaderReview: {
    overview: {
      leaderCount: number;
      confirmedCount: number;
      evaluatorProgress: Array<{
        evaluatorId: string;
        evaluatorName: string;
        submittedCount: number;
      }>;
    };
    leaders: LeaderRow[];
    leaderDistribution: DistributionEntry[];
    companyDistributions: {
      all: DistributionEntry[];
      leaderOnly: DistributionEntry[];
      employeeOnly: DistributionEntry[];
    };
  } | null;
};

type EmployeeOpinionForm = {
  decision: "PENDING" | "AGREE" | "OVERRIDE";
  suggestedStars: number | null;
  reason: string;
};

type EmployeeConfirmForm = {
  officialStars: number | null;
  reason: string;
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

function formatCountdown(end: string | null) {
  if (!end) return "暂无截止时间";
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return "已截止";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `距离截止时间还有 ${hours} 小时 ${minutes} 分钟`;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function getOpinionTone(decision: string) {
  if (decision === "AGREE") return "default";
  if (decision === "OVERRIDE") return "destructive";
  return "outline";
}

function DistributionBlock({
  title,
  description,
  distribution,
}: {
  title: string;
  description?: string;
  distribution: DistributionEntry[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-5">
          {distribution.map((item) => (
            <div key={item.stars} className={`rounded-xl border p-3 ${item.exceeded ? "border-red-200 bg-red-50" : "border-border/60"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{item.stars}星</span>
                <span className="text-xs text-muted-foreground">{item.pct.toFixed(0)}%</span>
              </div>
              <div className={`mt-2 text-2xl font-bold ${item.exceeded ? "text-red-600" : ""}`} title={item.names.join("、")}>
                {item.count}
              </div>
              {item.exceeded && item.delta > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  {item.stars === 3 ? `不足 ${item.delta} 人` : `超出 ${item.delta} 人`}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GuideCard({
  description,
}: {
  description: string;
}) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="py-4 text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}

function OverviewMetricCard({
  value,
  title,
  description,
}: {
  value: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-5 text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              状态：{evaluation.status === "SUBMITTED" ? "已提交" : "草稿"} · 加权分 {weightedScore?.toFixed(1) ?? "—"}
            </CardDescription>
          </div>
          {!editable && <Badge variant="outline">只读</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">业绩产出</p>
          <StarRating value={form.performanceStars} onChange={(value) => onChange("performanceStars", value)} disabled={!editable} />
          <Textarea value={form.performanceComment} onChange={(e) => onChange("performanceComment", e.target.value)} disabled={!editable} placeholder="请输入业绩产出评语" />
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">个人能力</p>
            <p className="text-xs text-muted-foreground">综合能力、学习能力、适应能力等权平均</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium">综合能力</p>
              <StarRating value={form.comprehensiveStars} onChange={(value) => onChange("comprehensiveStars", value)} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">学习能力</p>
              <StarRating value={form.learningStars} onChange={(value) => onChange("learningStars", value)} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">适应能力</p>
              <StarRating value={form.adaptabilityStars} onChange={(value) => onChange("adaptabilityStars", value)} disabled={!editable} />
            </div>
          </div>
          <Textarea value={form.abilityComment} onChange={(e) => onChange("abilityComment", e.target.value)} disabled={!editable} placeholder="请输入个人能力综合评语" />
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">价值观</p>
            <p className="text-xs text-muted-foreground">坦诚真实、极致进取、成就利他、ROOT 等权平均</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["candidStars", "candidComment", "坦诚真实"],
              ["progressStars", "progressComment", "极致进取"],
              ["altruismStars", "altruismComment", "成就利他"],
              ["rootStars", "rootComment", "ROOT"],
            ].map(([starsField, commentField, label]) => (
              <div key={starsField} className="space-y-2 rounded-lg border p-3">
                <p className="text-xs font-medium">{label}</p>
                <StarRating
                  value={form[starsField as keyof LeaderForm] as number | null}
                  onChange={(value) => onChange(starsField as keyof LeaderForm, value)}
                  disabled={!editable}
                />
                <Textarea
                  value={form[commentField as keyof LeaderForm] as string}
                  onChange={(e) => onChange(commentField as keyof LeaderForm, e.target.value)}
                  disabled={!editable}
                  placeholder={`请输入${label}评语`}
                />
              </div>
            ))}
          </div>
        </div>

        {editable && (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onSave("save")} disabled={saving}>
              保存草稿
            </Button>
            <Button onClick={() => onSave("submit")} disabled={saving}>
              提交终评
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CalibrationContent() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCompanyScope, setActiveCompanyScope] = useState<"all" | "leaderOnly" | "employeeOnly">("all");
  const [employeeForms, setEmployeeForms] = useState<Record<string, EmployeeOpinionForm>>({});
  const [employeeConfirmForms, setEmployeeConfirmForms] = useState<Record<string, EmployeeConfirmForm>>({});
  const [leaderForms, setLeaderForms] = useState<Record<string, LeaderForm>>({});
  const [leaderConfirmForms, setLeaderConfirmForms] = useState<Record<string, EmployeeConfirmForm>>({});
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState("");

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/final-review/workspace");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "加载失败");
      }
      setWorkspace(data);
      setError("");

      setEmployeeForms((prev) => {
        const next = { ...prev };
        data.employeeReview?.employees.forEach((row: EmployeeRow) => {
          if (!next[row.id]) {
            const myOpinion = row.opinions.find((item) => item.isMine);
            next[row.id] = {
              decision: (myOpinion?.decision || "PENDING") as "PENDING" | "AGREE" | "OVERRIDE",
              suggestedStars: myOpinion?.suggestedStars ?? row.referenceStars,
              reason: myOpinion?.reason || "",
            };
          }
        });
        return next;
      });

      setEmployeeConfirmForms((prev) => {
        const next = { ...prev };
        data.employeeReview?.employees.forEach((row: EmployeeRow) => {
          if (!next[row.id]) {
            next[row.id] = {
              officialStars: row.officialStars ?? row.referenceStars,
              reason: row.officialReason || "",
            };
          }
        });
        return next;
      });

      setLeaderForms((prev) => {
        const next = { ...prev };
        data.leaderReview?.leaders.forEach((leader: LeaderRow) => {
          leader.evaluations.forEach((evaluation) => {
            const key = `${leader.id}:${evaluation.evaluatorId}`;
            if (!next[key]) {
              next[key] = evaluation.form;
            }
          });
        });
        return next;
      });

      setLeaderConfirmForms((prev) => {
        const next = { ...prev };
        data.leaderReview?.leaders.forEach((leader: LeaderRow) => {
          if (!next[leader.id]) {
            next[leader.id] = {
              officialStars: leader.officialStars,
              reason: leader.officialReason || "",
            };
          }
        });
        return next;
      });

      setSelectedLeaderId((current) => current || data.leaderReview?.leaders?.[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
    const interval = setInterval(loadWorkspace, 30000);
    return () => clearInterval(interval);
  }, [loadWorkspace]);

  const saveOpinion = async (employee: EmployeeRow) => {
    const form = employeeForms[employee.id];
    if (!form) return;
    setSavingKey(`opinion:${employee.id}`);
    try {
      const res = await fetch("/api/final-review/opinion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          decision: form.decision,
          suggestedStars: form.suggestedStars,
          referenceStars: employee.referenceStars,
          reason: form.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      toast.success("终评意见已保存");
      await loadWorkspace();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingKey("");
    }
  };

  const confirmEmployee = async (employee: EmployeeRow) => {
    const form = employeeConfirmForms[employee.id];
    if (!form?.officialStars) {
      toast.error("请选择官方星级");
      return;
    }
    setSavingKey(`confirm:${employee.id}`);
    try {
      const res = await fetch("/api/final-review/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: employee.id,
          officialStars: form.officialStars,
          referenceStars: employee.referenceStars,
          reason: form.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "确认失败");
      toast.success("官方结果已确认");
      await loadWorkspace();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "确认失败");
    } finally {
      setSavingKey("");
    }
  };

  const saveLeaderEvaluation = async (leader: LeaderRow, evaluation: LeaderEvaluation, action: "save" | "submit") => {
    const key = `${leader.id}:${evaluation.evaluatorId}`;
    const form = leaderForms[key];
    if (!form) return;
    setSavingKey(`leader:${key}`);
    try {
      const res = await fetch("/api/final-review/leader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: leader.id,
          action,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      toast.success(action === "submit" ? "主管层终评已提交" : "主管层终评草稿已保存");
      await loadWorkspace();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingKey("");
    }
  };

  const confirmLeader = async (leader: LeaderRow) => {
    const form = leaderConfirmForms[leader.id];
    if (!form?.officialStars) {
      toast.error("请选择主管层官方星级");
      return;
    }
    setSavingKey(`leader-confirm:${leader.id}`);
    try {
      const res = await fetch("/api/final-review/leader/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: leader.id,
          officialStars: form.officialStars,
          reason: form.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "确认失败");
      toast.success("主管层官方结果已确认");
      await loadWorkspace();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "确认失败");
    } finally {
      setSavingKey("");
    }
  };

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  if (!workspace?.canAccess || !workspace.cycle || !workspace.config || !workspace.overview || !workspace.employeeReview || !workspace.leaderReview) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          当前无权访问终评工作台，或本周期尚未完成终评配置。
        </CardContent>
      </Card>
    );
  }

  const selectedLeader = workspace.leaderReview.leaders.find((leader) => leader.id === selectedLeaderId) || workspace.leaderReview.leaders[0] || null;
  const activeCompanyDistribution = workspace.leaderReview.companyDistributions[activeCompanyScope];

  return (
    <div className="space-y-6">
      <PageHeader
        title="绩效校准"
        description={`${workspace.cycle.name} · 校准时间 ${new Date(workspace.cycle.calibrationStart).toLocaleDateString()} - ${new Date(workspace.cycle.calibrationEnd).toLocaleDateString()}`}
      />

      <Tabs defaultValue="battlefield">
        <TabsList>
          <TabsTrigger value="battlefield">原则</TabsTrigger>
          <TabsTrigger value="employees">非主管员工终评</TabsTrigger>
          <TabsTrigger value="leaders">主管层双人终评</TabsTrigger>
        </TabsList>

        <TabsContent value="battlefield" className="space-y-4">
          <GuideCard description="这一页告诉你本轮终评按什么原则看人、谁参与拍板、现在卡在哪。" />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">原则与链路</CardTitle>
              <CardDescription>本轮终评的原则、链路与核心导向</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm font-semibold">核心原则</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workspace.overview.principles.map((item) => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-semibold">链路提醒</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {workspace.overview.chainGuidance.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-semibold">建议分布</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workspace.overview.distributionHints.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">本轮终评角色</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">终评工作台参与人</p>
                  <p className="text-muted-foreground">{workspace.config.accessUsers.map((user) => user.name).join("、") || "未配置"}</p>
                </div>
                <div>
                  <p className="font-medium">最终确认人</p>
                  <p className="text-muted-foreground">{workspace.config.finalizers.map((user) => user.name).join("、") || "未配置"}</p>
                </div>
                <div>
                  <p className="font-medium">主管层双人终评填写人</p>
                  <p className="text-muted-foreground">{workspace.config.leaderEvaluators.map((user) => user.name).join("、") || "未配置"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">倒计时与风险</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold">终评校准倒计时</p>
                  <p className="mt-2 text-lg font-bold">{formatCountdown(workspace.cycle.calibrationEnd)}</p>
                </div>
                <div className="space-y-2">
                  {workspace.overview.riskSummary.map((item) => (
                    <div key={item} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <OverviewMetricCard
              value={`${workspace.overview.progress.employeeOpinionDone}/${workspace.overview.progress.employeeOpinionTotal}`}
              title="普通员工意见收集进度"
              description="5位终评相关人已完成的意见数"
            />
            <OverviewMetricCard
              value={`${workspace.overview.progress.employeeConfirmedCount}/${workspace.overview.progress.employeeTotalCount}`}
              title="普通员工正式拍板进度"
              description="最终确认人已完成正式确认的人数"
            />
            <OverviewMetricCard
              value={`${workspace.overview.progress.leaderConfirmedCount}/${workspace.overview.progress.leaderTotalCount}`}
              title="主管层正式拍板进度"
              description="主管层已完成官方确认的人数"
            />
            <OverviewMetricCard
              value={workspace.overview.progress.leaderSubmittedCounts.map((item) => `${item.evaluatorName} ${item.submittedCount}`).join(" · ") || "未配置"}
              title="主管层问卷填写进度"
              description="吴承霖、邱翔分别已提交多少份主管层问卷"
            />
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <GuideCard description="这一页处理普通员工终评：先看分布，再逐个员工留下意见，最后由最终确认人拍板。" />

          <div className="grid gap-4 lg:grid-cols-4">
            <OverviewMetricCard value={workspace.employeeReview.overview.companyCount} title="公司当前人数" description="本轮参与绩效终评的员工总人数" />
            <OverviewMetricCard value={`${workspace.employeeReview.overview.initialEvalSubmissionRate}%`} title="绩效初评提交率" description="普通员工初评问卷当前已提交的比例" />
            <OverviewMetricCard value={`${workspace.employeeReview.overview.officialCompletionRate}%`} title="当前官方终评完成率" description="已经被最终确认人正式拍板的比例" />
            <OverviewMetricCard value={workspace.employeeReview.overview.pendingOfficialCount} title="待最终确认人数" description="还没有正式拍板的普通员工人数" />
          </div>

          <DistributionBlock title="公司当前绩效分布全览" description="普通员工未最终确认前按参考星级进入统计，已确认后按官方结果进入统计" distribution={workspace.employeeReview.companyDistribution} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">按团队的绩效分布</CardTitle>
              <CardDescription>当前按系统现有部门字段分组，悬停人数可看该星级下的员工名单</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspace.employeeReview.departmentDistributions.map((item) => (
                <div key={item.department} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-semibold">{item.department}</div>
                    <div className="text-xs text-muted-foreground">{item.total} 人</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-5">
                    {item.distribution.map((bucket) => (
                      <div key={bucket.stars} className={`rounded-lg border p-3 ${bucket.exceeded ? "border-red-200 bg-red-50" : ""}`}>
                        <div className="text-xs text-muted-foreground">{bucket.stars}星</div>
                        <div className="text-xl font-bold" title={bucket.names.join("、")}>{bucket.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">逐人终评台</CardTitle>
              <CardDescription>参考星级由初评加权分换算；终评相关人可同意参考星级或更改为其他星级</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspace.employeeReview.employees.map((employee) => {
                const myOpinion = employee.opinions.find((item) => item.isMine);
                const opinionForm = employeeForms[employee.id] || {
                  decision: (myOpinion?.decision || "PENDING") as "PENDING" | "AGREE" | "OVERRIDE",
                  suggestedStars: myOpinion?.suggestedStars ?? employee.referenceStars,
                  reason: myOpinion?.reason || "",
                };
                const confirmForm = employeeConfirmForms[employee.id] || {
                  officialStars: employee.officialStars ?? employee.referenceStars,
                  reason: employee.officialReason || "",
                };

                return (
                  <div key={employee.id} className="rounded-2xl border p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">{employee.name}</span>
                          <Badge variant="outline">{employee.department}</Badge>
                          {employee.anomalyTags.map((tag) => (
                            <Badge key={tag} variant="destructive">{tag}</Badge>
                          ))}
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                          <div>初评人：{employee.currentEvaluatorNames.join("、") || "未配置"}</div>
                          <div>自评状态：{employee.selfEvalStatus || "未导入"}</div>
                          <div>初评加权分：{employee.weightedScore?.toFixed(1) ?? "—"}</div>
                          <div>360均分：{employee.peerAverage?.toFixed(1) ?? "—"}</div>
                          <div>参考星级：{employee.referenceStars != null ? `${employee.referenceStars}星` : "—"}</div>
                          <div>官方结果：{employee.officialStars != null ? `${employee.officialStars}星` : "待确认"}</div>
                        </div>
                        <p className="text-xs text-muted-foreground">{employee.referenceSourceLabel}</p>
                      </div>
                      <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                        当前进度 {employee.handledCount}/{employee.totalReviewerCount}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">终评相关人意见</p>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {employee.opinions.map((opinion) => (
                            <div key={opinion.reviewerId} className="rounded-xl border p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{opinion.reviewerName}</span>
                                <Badge variant={getOpinionTone(opinion.decision) as "default" | "destructive" | "outline"}>
                                  {opinion.decisionLabel}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                建议星级：{opinion.suggestedStars != null ? `${opinion.suggestedStars}星` : "—"}
                              </div>
                              {opinion.reason && (
                                <p className="mt-2 text-sm">{opinion.reason}</p>
                              )}
                            </div>
                          ))}
                        </div>

                        {myOpinion && (
                          <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                            <p className="text-sm font-semibold">我的处理动作</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-[180px_140px_1fr]">
                              <select
                                value={opinionForm.decision}
                                onChange={(e) => setEmployeeForms((prev) => ({
                                  ...prev,
                                  [employee.id]: {
                                    ...opinionForm,
                                    decision: e.target.value as EmployeeOpinionForm["decision"],
                                  },
                                }))}
                                className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                              >
                                <option value="PENDING">待处理</option>
                                <option value="AGREE">同意参考星级</option>
                                <option value="OVERRIDE">更改为其他星级</option>
                              </select>
                              <select
                                value={opinionForm.suggestedStars ?? ""}
                                onChange={(e) => setEmployeeForms((prev) => ({
                                  ...prev,
                                  [employee.id]: {
                                    ...opinionForm,
                                    suggestedStars: e.target.value ? Number(e.target.value) : null,
                                  },
                                }))}
                                className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                                disabled={opinionForm.decision === "PENDING"}
                              >
                                <option value="">选择星级</option>
                                {[1, 2, 3, 4, 5].map((stars) => (
                                  <option key={stars} value={stars}>{stars}星</option>
                                ))}
                              </select>
                              <Textarea
                                value={opinionForm.reason}
                                onChange={(e) => setEmployeeForms((prev) => ({
                                  ...prev,
                                  [employee.id]: {
                                    ...opinionForm,
                                    reason: e.target.value,
                                  },
                                }))}
                                placeholder={opinionForm.decision === "OVERRIDE" ? "更改为其他星级时请填写理由" : "如有补充说明，可在此填写"}
                              />
                            </div>
                            <div className="mt-3 flex justify-end">
                              <Button onClick={() => saveOpinion(employee)} disabled={savingKey === `opinion:${employee.id}`}>
                                {savingKey === `opinion:${employee.id}` ? "保存中..." : "保存我的终评意见"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold">官方结果区</p>
                        <div className="rounded-xl border p-4">
                          <div className="grid gap-2 text-sm">
                            <div>当前参考星级：{employee.referenceStars != null ? `${employee.referenceStars}星` : "—"}</div>
                            <div>当前官方星级：{employee.officialStars != null ? `${employee.officialStars}星` : "待确认"}</div>
                            <div>最后确认人：{employee.officialConfirmerName || "—"}</div>
                            <div>最后确认时间：{formatTime(employee.officialConfirmedAt)}</div>
                          </div>
                          {employee.finalizable && (
                            <div className="mt-4 space-y-3 border-t pt-4">
                              <select
                                value={confirmForm.officialStars ?? ""}
                                onChange={(e) => setEmployeeConfirmForms((prev) => ({
                                  ...prev,
                                  [employee.id]: {
                                    ...confirmForm,
                                    officialStars: e.target.value ? Number(e.target.value) : null,
                                  },
                                }))}
                                className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                              >
                                <option value="">选择官方星级</option>
                                {[1, 2, 3, 4, 5].map((stars) => (
                                  <option key={stars} value={stars}>{stars}星</option>
                                ))}
                              </select>
                              <Textarea
                                value={confirmForm.reason}
                                onChange={(e) => setEmployeeConfirmForms((prev) => ({
                                  ...prev,
                                  [employee.id]: {
                                    ...confirmForm,
                                    reason: e.target.value,
                                  },
                                }))}
                                placeholder="若官方星级不同于参考星级，必须填写理由"
                              />
                              <Button className="w-full" onClick={() => confirmEmployee(employee)} disabled={savingKey === `confirm:${employee.id}`}>
                                {savingKey === `confirm:${employee.id}` ? "确认中..." : "最终确认"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaders" className="space-y-4">
          <GuideCard description="这一页只处理主管层终评：先由两位填写人分别打分，再由最终确认人统一拍板。" />

          <div className="grid gap-4 lg:grid-cols-4">
            <OverviewMetricCard value={workspace.leaderReview.overview.leaderCount} title="主管层总人数" description="当前纳入主管层终评的对象人数" />
            <OverviewMetricCard value={workspace.leaderReview.overview.confirmedCount} title="主管层已确认人数" description="已经被最终确认人正式拍板的主管人数" />
            {workspace.leaderReview.overview.evaluatorProgress.map((item) => (
              <OverviewMetricCard
                key={item.evaluatorId}
                value={item.submittedCount}
                title={`${item.evaluatorName} 已提交`}
                description={`${item.evaluatorName} 已提交的主管层问卷数量`}
              />
            ))}
          </div>

          <DistributionBlock title="主管层绩效等级全览" distribution={workspace.leaderReview.leaderDistribution} />

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">全公司绩效等级分布柱状图</CardTitle>
                  <CardDescription>支持切换全公司、仅主管层、仅非主管层</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant={activeCompanyScope === "all" ? "default" : "outline"} onClick={() => setActiveCompanyScope("all")}>全公司</Button>
                  <Button variant={activeCompanyScope === "leaderOnly" ? "default" : "outline"} onClick={() => setActiveCompanyScope("leaderOnly")}>仅主管层</Button>
                  <Button variant={activeCompanyScope === "employeeOnly" ? "default" : "outline"} onClick={() => setActiveCompanyScope("employeeOnly")}>仅非主管层</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-5">
                {activeCompanyDistribution.map((item) => (
                  <div key={item.stars} className={`rounded-xl border p-3 ${item.exceeded ? "border-red-200 bg-red-50" : ""}`}>
                    <div className="text-xs text-muted-foreground">{item.stars}星</div>
                    <div className="text-xl font-bold" title={item.names.join("、")}>{item.count}</div>
                    <div className="text-xs text-muted-foreground">{item.pct.toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">主管名单</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workspace.leaderReview.leaders.map((leader) => (
                  <button
                    key={leader.id}
                    type="button"
                    onClick={() => setSelectedLeaderId(leader.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${selectedLeader?.id === leader.id ? "border-primary bg-primary/[0.04]" : "border-border/60 hover:bg-muted/40"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{leader.name}</span>
                      <Badge variant={leader.officialStars != null ? "default" : "outline"}>
                        {leader.officialStars != null ? `${leader.officialStars}星` : "待确认"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{leader.department}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedLeader && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedLeader.name}</CardTitle>
                        <CardDescription>{selectedLeader.department} · {selectedLeader.jobTitle || "未填写职位"}</CardDescription>
                      </div>
                      <Badge variant={selectedLeader.officialStars != null ? "default" : "outline"}>
                        {selectedLeader.officialStars != null ? `官方结果 ${selectedLeader.officialStars}星` : "待主管层最终确认"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {selectedLeader.evaluations.map((evaluation) => {
                      const key = `${selectedLeader.id}:${evaluation.evaluatorId}`;
                      return (
                        <div key={key} className="rounded-xl border p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{evaluation.evaluatorName}</span>
                            <Badge variant={evaluation.status === "SUBMITTED" ? "default" : "outline"}>
                              {evaluation.status === "SUBMITTED" ? "已提交" : "草稿"}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            加权分：{evaluation.weightedScore?.toFixed(1) ?? "—"}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  {selectedLeader.evaluations.map((evaluation) => {
                    const key = `${selectedLeader.id}:${evaluation.evaluatorId}`;
                    return (
                      <LeaderQuestionnaire
                        key={key}
                        title={`${evaluation.evaluatorName} 终评问卷`}
                        evaluation={evaluation}
                        form={leaderForms[key] || evaluation.form}
                        editable={evaluation.editable}
                        saving={savingKey === `leader:${key}`}
                        onChange={(field, value) => setLeaderForms((prev) => ({
                          ...prev,
                          [key]: {
                            ...(prev[key] || evaluation.form),
                            [field]: value,
                          },
                        }))}
                        onSave={(action) => saveLeaderEvaluation(selectedLeader, evaluation, action)}
                      />
                    );
                  })}
                </div>

                {selectedLeader.finalizable && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">主管层最终确认</CardTitle>
                      <CardDescription>第三页不按区间自动换星，官方最终星级由最终确认人手选，且理由始终必填</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <select
                        value={leaderConfirmForms[selectedLeader.id]?.officialStars ?? ""}
                        onChange={(e) => setLeaderConfirmForms((prev) => ({
                          ...prev,
                          [selectedLeader.id]: {
                            ...(prev[selectedLeader.id] || { officialStars: null, reason: "" }),
                            officialStars: e.target.value ? Number(e.target.value) : null,
                          },
                        }))}
                        className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                      >
                        <option value="">选择主管层官方星级</option>
                        {[1, 2, 3, 4, 5].map((stars) => (
                          <option key={stars} value={stars}>{stars}星</option>
                        ))}
                      </select>
                      <Textarea
                        value={leaderConfirmForms[selectedLeader.id]?.reason || ""}
                        onChange={(e) => setLeaderConfirmForms((prev) => ({
                          ...prev,
                          [selectedLeader.id]: {
                            ...(prev[selectedLeader.id] || { officialStars: null, reason: "" }),
                            reason: e.target.value,
                          },
                        }))}
                        placeholder="主管层最终确认理由始终必填"
                      />
                      <Button onClick={() => confirmLeader(selectedLeader)} disabled={!selectedLeader.bothSubmitted || savingKey === `leader-confirm:${selectedLeader.id}`}>
                        {savingKey === `leader-confirm:${selectedLeader.id}` ? "确认中..." : "确认主管层官方结果"}
                      </Button>
                      {!selectedLeader.bothSubmitted && (
                        <p className="text-xs text-red-600">两位主管层终评填写人都提交后，才能最终确认。</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CalibrationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CalibrationContent />
    </Suspense>
  );
}
