"use client";

import { Suspense, type ReactNode, useCallback, useEffect, useState } from "react";
import {
  buildEmployeePriorityCards,
  buildLeaderSubmissionSummary,
  buildScoreBandBuckets,
} from "@/components/final-review/workspace-view";
import { EmployeeCockpit } from "@/components/final-review/employee-cockpit";
import { EmployeeDetailPanel } from "@/components/final-review/employee-detail-panel";
import { PrinciplesTab } from "@/components/final-review/principles-tab";
import type {
  DistributionEntry,
  EmployeeRow,
  LeaderEvaluation,
  LeaderForm,
  LeaderRow,
  WorkspacePayload,
} from "@/components/final-review/types";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { toast } from "sonner";

type EmployeeOpinionForm = {
  decision: "PENDING" | "AGREE" | "OVERRIDE";
  suggestedStars: number | null;
  reason: string;
};

type EmployeeConfirmForm = {
  officialStars: number | null;
  reason: string;
};

function buildDefaultEmployeeOpinionForm(employee: EmployeeRow): EmployeeOpinionForm {
  const myOpinion = employee.opinions.find((item) => item.isMine);

  return {
    decision: (myOpinion?.decision || "PENDING") as EmployeeOpinionForm["decision"],
    suggestedStars: myOpinion?.suggestedStars ?? employee.referenceStars,
    reason: myOpinion?.reason || "",
  };
}

function buildDefaultEmployeeConfirmForm(employee: EmployeeRow): EmployeeConfirmForm {
  return {
    officialStars: employee.officialStars ?? employee.referenceStars,
    reason: employee.officialReason || "",
  };
}

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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
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
            next[row.id] = buildDefaultEmployeeOpinionForm(row);
          }
        });
        return next;
      });

      setEmployeeConfirmForms((prev) => {
        const next = { ...prev };
        data.employeeReview?.employees.forEach((row: EmployeeRow) => {
          if (!next[row.id]) {
            next[row.id] = buildDefaultEmployeeConfirmForm(row);
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

      setSelectedEmployeeId((current) => {
        const employees = data.employeeReview?.employees || [];
        if (current && employees.some((employee: EmployeeRow) => employee.id === current)) return current;
        return employees.find((employee: EmployeeRow) => !employee.officialConfirmedAt)?.id || employees[0]?.id || null;
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
  const scoreBandBuckets = buildScoreBandBuckets(workspace.employeeReview.employees);
  const employeePriorityCards = buildEmployeePriorityCards(workspace.employeeReview.employees);
  const leaderSubmissionSummary = buildLeaderSubmissionSummary(workspace.leaderReview.leaders);
  const selectedEmployee =
    workspace.employeeReview.employees.find((employee) => employee.id === selectedEmployeeId) ||
    workspace.employeeReview.employees[0] ||
    null;
  const selectedEmployeeOpinionForm = selectedEmployee
    ? employeeForms[selectedEmployee.id] || buildDefaultEmployeeOpinionForm(selectedEmployee)
    : null;
  const selectedEmployeeConfirmForm = selectedEmployee
    ? employeeConfirmForms[selectedEmployee.id] || buildDefaultEmployeeConfirmForm(selectedEmployee)
    : null;
  const pendingPriorityCount = employeePriorityCards.find((card) => card.key === "pending")?.count ?? 0;

  const updateSelectedEmployeeOpinion = (patch: Partial<EmployeeOpinionForm>) => {
    if (!selectedEmployee) return;

    setEmployeeForms((prev) => ({
      ...prev,
      [selectedEmployee.id]: {
        ...(prev[selectedEmployee.id] || buildDefaultEmployeeOpinionForm(selectedEmployee)),
        ...patch,
      },
    }));
  };

  const updateSelectedEmployeeConfirm = (patch: Partial<EmployeeConfirmForm>) => {
    if (!selectedEmployee) return;

    setEmployeeConfirmForms((prev) => ({
      ...prev,
      [selectedEmployee.id]: {
        ...(prev[selectedEmployee.id] || buildDefaultEmployeeConfirmForm(selectedEmployee)),
        ...patch,
      },
    }));
  };

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

        <TabsContent value="battlefield" className="space-y-4" data-score-band-count={scoreBandBuckets.length}>
          <PrinciplesTab
            cycle={workspace.cycle}
            config={workspace.config}
            overview={workspace.overview}
            companyDistribution={workspace.leaderReview.companyDistributions.all}
            scoreBandBuckets={scoreBandBuckets}
          />
        </TabsContent>

        <TabsContent value="employees" className="space-y-4" data-priority-pending-count={pendingPriorityCount}>
          <EmployeeCockpit
            guideDescription="这一页处理普通员工终评：先看分布，再逐个员工留下意见，最后由最终确认人拍板。参考星级由初评加权分换算。"
            priorityBoardTitle="重点名单"
            priorityBoardDescription="重点名单会优先摆出待拍板、意见分歧大，以及其他需要先看证据再拍板的员工。"
            companyCount={workspace.employeeReview.overview.companyCount}
            initialEvalSubmissionRate={workspace.employeeReview.overview.initialEvalSubmissionRate}
            officialCompletionRate={workspace.employeeReview.overview.officialCompletionRate}
            pendingOfficialCount={workspace.employeeReview.overview.pendingOfficialCount}
            employeeDistribution={workspace.employeeReview.employeeDistribution}
            scoreBandBuckets={scoreBandBuckets}
            priorityCards={employeePriorityCards}
            selectedEmployeeId={selectedEmployee?.id ?? null}
            onSelectEmployee={setSelectedEmployeeId}
            detailPanel={(
              <EmployeeDetailPanel
                title="最终决策"
                employee={selectedEmployee}
                opinionForm={selectedEmployeeOpinionForm}
                confirmForm={selectedEmployeeConfirmForm}
                savingOpinion={selectedEmployee ? savingKey === `opinion:${selectedEmployee.id}` : false}
                savingConfirmation={selectedEmployee ? savingKey === `confirm:${selectedEmployee.id}` : false}
                onOpinionChange={updateSelectedEmployeeOpinion}
                onConfirmChange={updateSelectedEmployeeConfirm}
                onSaveOpinion={() => {
                  if (selectedEmployee) {
                    void saveOpinion(selectedEmployee);
                  }
                }}
                onConfirm={() => {
                  if (selectedEmployee) {
                    void confirmEmployee(selectedEmployee);
                  }
                }}
              />
            )}
          />
        </TabsContent>

        <TabsContent
          value="leaders"
          className="space-y-4"
          data-leader-submission-count={leaderSubmissionSummary.length}
          data-leader-submitted-total={leaderSubmissionSummary.reduce((total, item) => total + item.submittedCount, 0)}
        >
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
