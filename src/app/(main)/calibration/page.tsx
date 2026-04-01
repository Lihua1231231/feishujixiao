"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  buildLeaderSubmissionSummary,
} from "@/components/final-review/workspace-view";
import { ArchiveTables } from "@/components/final-review/archive-tables";
import { CompanyDistributionOverviewCard } from "@/components/final-review/company-distribution-overview-card";
import { EmployeeCockpit } from "@/components/final-review/employee-cockpit";
import { EmployeeDetailPanel } from "@/components/final-review/employee-detail-panel";
import { LeaderCockpit } from "@/components/final-review/leader-cockpit";
import { LeaderDetailPanel } from "@/components/final-review/leader-detail-panel";
import type {
  EmployeeRow,
  LeaderEvaluation,
  LeaderForm,
  LeaderRow,
  WorkspacePayload,
} from "@/components/final-review/types";
import { NormalizationShell } from "@/components/manager-review-normalization/normalization-shell";
import type { ManagerReviewNormalizationWorkspaceResponse } from "@/components/manager-review-normalization/types";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";

type EmployeeOpinionForm = {
  decision: "PENDING" | "AGREE" | "OVERRIDE";
  suggestedStars: number | null;
  reason: string;
};

function buildDefaultEmployeeOpinionForm(employee: EmployeeRow): EmployeeOpinionForm {
  const myOpinion = employee.opinions.find((item) => item.isMine);

  if (myOpinion?.hasSavedOpinion) {
    return {
      decision: myOpinion.decision as EmployeeOpinionForm["decision"],
      suggestedStars: myOpinion.suggestedStars ?? employee.referenceStars,
      reason: myOpinion.reason || "",
    };
  }

  if (myOpinion?.prefillDecision) {
    return {
      decision: myOpinion.prefillDecision,
      suggestedStars: myOpinion.prefillSuggestedStars ?? employee.referenceStars,
      reason: myOpinion.prefillReason,
    };
  }

  return {
    decision: "PENDING",
    suggestedStars: employee.referenceStars,
    reason: "",
  };
}

const NORMALIZATION_ACTION_ENDPOINTS = {
  SUPERVISOR_EVAL: {
    apply: "/api/manager-review-normalization/apply",
    revert: "/api/manager-review-normalization/revert",
  },
  PEER_REVIEW: {
    apply: "/api/score-normalization/apply",
    revert: "/api/score-normalization/revert",
  },
} as const;

type NormalizationActionSource = keyof typeof NORMALIZATION_ACTION_ENDPOINTS;
type NormalizationActionType = "apply" | "revert";

function NormalizationTabContent() {
  const [workspace, setWorkspace] = useState<ManagerReviewNormalizationWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<`${NormalizationActionSource}:${NormalizationActionType}` | null>(null);
  const requestIdRef = useRef(0);

  const loadWorkspace = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/manager-review-normalization/workspace");
      const data = (await response.json()) as ManagerReviewNormalizationWorkspaceResponse & { error?: string };
      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        throw new Error(data.error || "加载失败");
      }
      setWorkspace(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const runAction = useCallback(
    async (source: NormalizationActionSource, action: NormalizationActionType) => {
      const actionKey = `${source}:${action}` as const;
      setPendingAction(actionKey);
      setError("");

      try {
        const response = await fetch(NORMALIZATION_ACTION_ENDPOINTS[source][action], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmed: true,
            ...(source === "PEER_REVIEW" ? { source: "PEER_REVIEW" } : {}),
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "操作失败");
        }
        await loadWorkspace();
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作失败");
      } finally {
        setPendingAction(null);
      }
    },
    [loadWorkspace],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  if (loading && !workspace) {
    return <PageSkeleton />;
  }

  if (error && !workspace) {
    return (
      <Card className="rounded-[28px] border-border/60 shadow-none">
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={() => void loadWorkspace()}>
            重新加载
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!workspace) return null;

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="rounded-[20px] border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="py-3 text-sm text-amber-900">{error}</CardContent>
        </Card>
      ) : null}

      <NormalizationShell
        cycleName={workspace.cycle.name}
        rosterSummary={workspace.rosterSummary}
        applications={workspace.applications}
        rows={workspace.rows}
        onApplyManagerReview={() => runAction("SUPERVISOR_EVAL", "apply")}
        onRevertManagerReview={() => runAction("SUPERVISOR_EVAL", "revert")}
        onApplyPeerReview={() => runAction("PEER_REVIEW", "apply")}
        onRevertPeerReview={() => runAction("PEER_REVIEW", "revert")}
        applyingManagerReview={pendingAction === "SUPERVISOR_EVAL:apply"}
        revertingManagerReview={pendingAction === "SUPERVISOR_EVAL:revert"}
        applyingPeerReview={pendingAction === "PEER_REVIEW:apply"}
        revertingPeerReview={pendingAction === "PEER_REVIEW:revert"}
      />
    </div>
  );
}

function areLeaderFormsEqual(left: LeaderForm, right: LeaderForm) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildDefaultLeaderForm(evaluation: LeaderEvaluation): LeaderForm {
  if (evaluation.prefillForm) return evaluation.prefillForm;
  return evaluation.form;
}

function buildLeaderFormSnapshot(leaders: LeaderRow[]): Record<string, LeaderForm> {
  const snapshot: Record<string, LeaderForm> = {};

  leaders.forEach((leader) => {
    leader.evaluations.forEach((evaluation) => {
      snapshot[`${leader.id}:${evaluation.evaluatorId}`] = buildDefaultLeaderForm(evaluation);
    });
  });

  return snapshot;
}

function CalibrationContent() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeForms, setEmployeeForms] = useState<Record<string, EmployeeOpinionForm>>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [leaderForms, setLeaderForms] = useState<Record<string, LeaderForm>>({});
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
      const leaderEvaluationsByKey = new Map<string, LeaderEvaluation>();
      (data.leaderReview?.leaders || []).forEach((leader: LeaderRow) => {
        leader.evaluations.forEach((evaluation) => {
          leaderEvaluationsByKey.set(`${leader.id}:${evaluation.evaluatorId}`, evaluation);
        });
      });
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

      setLeaderForms((prev) => {
        const next = { ...serverLeaderForms };

        Object.entries(serverLeaderForms).forEach(([key, serverForm]) => {
          const localForm = prev[key];
          const previousServerForm = previousLeaderServerForms[key] ?? serverForm;

          if (localForm && !areLeaderFormsEqual(localForm, previousServerForm)) {
            next[key] = localForm;
          } else if (!localForm) {
            const evaluation = leaderEvaluationsByKey.get(key);
            if (evaluation) {
              next[key] = buildDefaultLeaderForm(evaluation);
            }
          }
        });

        return next;
      });
      leaderServerFormsRef.current = serverLeaderForms;

      setSelectedEmployeeId((current) => {
        const employees = data.employeeReview?.employees || [];
        if (current && employees.some((employee: EmployeeRow) => employee.id === current)) return current;
        return employees.find((employee: EmployeeRow) => employee.officialStars == null)?.id || employees[0]?.id || null;
      });
      setSelectedLeaderId((current) => {
        const leaders = data.leaderReview?.leaders || [];
        if (current && leaders.some((leader: LeaderRow) => leader.id === current)) return current;
        return leaders.find((leader: LeaderRow) => leader.officialStars == null)?.id || leaders[0]?.id || null;
      });
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
  const leaderSubmissionSummary = buildLeaderSubmissionSummary(workspace.leaderReview.leaders);
  const selectedEmployee =
    workspace.employeeReview.employees.find((employee) => employee.id === selectedEmployeeId) ||
    workspace.employeeReview.employees[0] ||
    null;
  const selectedEmployeeOpinionForm = selectedEmployee
    ? employeeForms[selectedEmployee.id] || buildDefaultEmployeeOpinionForm(selectedEmployee)
    : null;
  const pendingPriorityCount = workspace.employeeReview.overview.pendingOfficialCount;

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

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">员工层绩效校准</TabsTrigger>
          <TabsTrigger value="leaders">主管层绩效终评校准</TabsTrigger>
          <TabsTrigger value="normalization">绩效打分分布校准</TabsTrigger>
          <TabsTrigger value="archive">公司绩效终评校准留档</TabsTrigger>
          <TabsTrigger value="distribution">公司整体绩效分布图</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4" data-priority-pending-count={pendingPriorityCount}>
          <EmployeeCockpit
            departmentDistributions={workspace.employeeReview.departmentDistributions}
            allEmployees={workspace.employeeReview.employees}
            selectedEmployeeId={selectedEmployee?.id ?? null}
            onSelectEmployee={setSelectedEmployeeId}
            detailPanel={(
              <EmployeeDetailPanel
                title="公司级绩效终评校准"
                employee={selectedEmployee}
                opinionForm={selectedEmployeeOpinionForm}
                savingOpinion={selectedEmployee ? savingKey === `opinion:${selectedEmployee.id}` : false}
                onOpinionChange={updateSelectedEmployeeOpinion}
                onSaveOpinion={() => {
                  if (selectedEmployee) {
                    void saveOpinion(selectedEmployee);
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
            progressTitle="双人提交进度"
            progressDescription="按后台配置读取当前待双人提交名单。"
            leaderCount={workspace.leaderReview.overview.leaderCount}
            confirmedCount={workspace.leaderReview.overview.confirmedCount}
            leaderDistribution={workspace.leaderReview.leaderDistribution}
            companyDistributionOverviews={workspace.leaderReview.companyDistributionOverviews}
            distributionChecks={workspace.overview.distributionComplianceChecks}
            evaluatorProgress={workspace.leaderReview.overview.evaluatorProgress}
            allLeaders={workspace.leaderReview.leaders}
            selectedLeaderId={selectedLeader?.id ?? null}
            onSelectLeader={setSelectedLeaderId}
            detailPanel={(
              <LeaderDetailPanel
                title="最终决策"
                comparisonTitle="双人结果对照"
                questionnaireTitle="详细双人问卷"
                leader={selectedLeader}
                leaderForms={leaderForms}
                savingEvaluationKey={savingKey}
                onEvaluationChange={updateLeaderEvaluationForm}
                onSaveEvaluation={saveLeaderEvaluation}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="normalization" className="space-y-4">
          <NormalizationTabContent />
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <ArchiveTables
            employees={workspace.employeeReview.employees}
            leaders={workspace.leaderReview.leaders}
            leaderForms={leaderForms}
          />
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <CompanyDistributionOverviewCard
            title="公司整体绩效分布（不含ROOT及已离职人员）"
            description="用于留档的公司最终绩效分布，剔除 ROOT 独立评估对象和已离职人员后的整体结果。"
            overview={workspace.leaderReview.companyDistributionOverviews.withoutRoot}
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
