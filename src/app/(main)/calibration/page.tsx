"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  buildEmployeePriorityCards,
  buildLeaderPriorityCards,
  buildLeaderSubmissionSummary,
  buildScoreBandBuckets,
} from "@/components/final-review/workspace-view";
import { EmployeeCockpit } from "@/components/final-review/employee-cockpit";
import { EmployeeDetailPanel } from "@/components/final-review/employee-detail-panel";
import { LeaderCockpit } from "@/components/final-review/leader-cockpit";
import { LeaderDetailPanel } from "@/components/final-review/leader-detail-panel";
import { PrinciplesTab } from "@/components/final-review/principles-tab";
import type {
  EmployeeRow,
  LeaderEvaluation,
  LeaderForm,
  LeaderRow,
  WorkspacePayload,
} from "@/components/final-review/types";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
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

function areLeaderFormsEqual(left: LeaderForm, right: LeaderForm) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildLeaderFormSnapshot(leaders: LeaderRow[]): Record<string, LeaderForm> {
  const snapshot: Record<string, LeaderForm> = {};

  leaders.forEach((leader) => {
    leader.evaluations.forEach((evaluation) => {
      snapshot[`${leader.id}:${evaluation.evaluatorId}`] = evaluation.form;
    });
  });

  return snapshot;
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
  const latestWorkspaceRequestIdRef = useRef(0);
  const leaderServerFormsRef = useRef<Record<string, LeaderForm>>({});

  const loadWorkspace = useCallback(async () => {
    const requestId = latestWorkspaceRequestIdRef.current + 1;
    latestWorkspaceRequestIdRef.current = requestId;

    try {
      const res = await fetch("/api/final-review/workspace");
      const data = await res.json();
      if (requestId !== latestWorkspaceRequestIdRef.current) {
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "加载失败");
      }

      const serverLeaderForms = buildLeaderFormSnapshot(data.leaderReview?.leaders || []);
      const previousLeaderServerForms = leaderServerFormsRef.current;
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
        const next = { ...serverLeaderForms };

        Object.entries(serverLeaderForms).forEach(([key, serverForm]) => {
          const localForm = prev[key];
          const previousServerForm = previousLeaderServerForms[key] ?? serverForm;

          if (localForm && !areLeaderFormsEqual(localForm, previousServerForm)) {
            next[key] = localForm;
          }
        });

        return next;
      });
      leaderServerFormsRef.current = serverLeaderForms;

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
        return employees.find((employee: EmployeeRow) => employee.officialStars == null)?.id || employees[0]?.id || null;
      });
      setSelectedLeaderId((current) => current || data.leaderReview?.leaders?.[0]?.id || null);
    } catch (e) {
      if (requestId !== latestWorkspaceRequestIdRef.current) {
        return;
      }
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (requestId === latestWorkspaceRequestIdRef.current) {
        setLoading(false);
      }
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
  const leaderPriorityCards = buildLeaderPriorityCards(workspace.leaderReview.leaders);
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
  const selectedLeaderConfirmForm = selectedLeader
    ? leaderConfirmForms[selectedLeader.id] || { officialStars: selectedLeader.officialStars, reason: selectedLeader.officialReason || "" }
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

  const updateSelectedLeaderConfirm = (patch: Partial<EmployeeConfirmForm>) => {
    if (!selectedLeader) return;

    setLeaderConfirmForms((prev) => ({
      ...prev,
      [selectedLeader.id]: {
        ...(prev[selectedLeader.id] || { officialStars: selectedLeader.officialStars, reason: selectedLeader.officialReason || "" }),
        ...patch,
      },
    }));
  };

  const updateLeaderEvaluationForm = (
    leaderId: string,
    evaluation: LeaderEvaluation,
    field: keyof LeaderForm,
    value: number | string | null,
  ) => {
    const key = `${leaderId}:${evaluation.evaluatorId}`;

    setLeaderForms((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || evaluation.form),
        [field]: value,
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
            guideDescription="这一页处理普通员工终评：先看分布，再逐个员工留下意见，最后由最终确认人拍板。参考星级由初评加权分换算。可以结合重点名单和搜索员工名册来回切换。"
            priorityBoardTitle="重点名单"
            priorityBoardDescription="重点名单会优先摆出待拍板、意见分歧大，以及其他需要先看证据再拍板的员工。"
            companyCount={workspace.employeeReview.overview.companyCount}
            initialEvalSubmissionRate={workspace.employeeReview.overview.initialEvalSubmissionRate}
            officialCompletionRate={workspace.employeeReview.overview.officialCompletionRate}
            pendingOfficialCount={workspace.employeeReview.overview.pendingOfficialCount}
            employeeDistribution={workspace.employeeReview.employeeDistribution}
            scoreBandBuckets={scoreBandBuckets}
            priorityCards={employeePriorityCards}
            allEmployees={workspace.employeeReview.employees}
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
          <LeaderCockpit
            guideDescription="这一页只处理主管层终评：先由两位填写人分别打分，再由最终确认人统一拍板。可以结合优先队列和搜索主管名册快速定位对象。"
            progressTitle="双人提交进度"
            progressDescription="先看两位填写人的整体提交进度，再决定哪些主管已经可以进入最终决策。"
            rosterTitle="主管名单"
            rosterDescription="左侧会优先摆出待拍板、待双人齐备和已可拍板的主管，右侧搜索名册可以随时跳回任意一位主管。"
            leaderCount={workspace.leaderReview.overview.leaderCount}
            confirmedCount={workspace.leaderReview.overview.confirmedCount}
            leaderDistribution={workspace.leaderReview.leaderDistribution}
            companyDistribution={activeCompanyDistribution}
            activeCompanyScope={activeCompanyScope}
            onCompanyScopeChange={setActiveCompanyScope}
            evaluatorProgress={workspace.leaderReview.overview.evaluatorProgress}
            priorityCards={leaderPriorityCards}
            submissionSummary={leaderSubmissionSummary}
            allLeaders={workspace.leaderReview.leaders}
            selectedLeaderId={selectedLeader?.id ?? null}
            onSelectLeader={setSelectedLeaderId}
            detailPanel={(
              <LeaderDetailPanel
                title="最终决策"
                comparisonTitle="双人意见对照"
                questionnaireTitle="详细双人问卷"
                auditTrailTitle="过程留痕"
                leader={selectedLeader}
                leaderForms={leaderForms}
                confirmForm={selectedLeaderConfirmForm}
                savingConfirmation={selectedLeader ? savingKey === `leader-confirm:${selectedLeader.id}` : false}
                savingEvaluationKey={savingKey}
                onConfirmChange={updateSelectedLeaderConfirm}
                onEvaluationChange={updateLeaderEvaluationForm}
                onSaveEvaluation={saveLeaderEvaluation}
                onConfirm={() => {
                  if (selectedLeader) {
                    void confirmLeader(selectedLeader);
                  }
                }}
              />
            )}
          />
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
