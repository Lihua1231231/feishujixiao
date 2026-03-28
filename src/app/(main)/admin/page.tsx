"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { MemberRosterCard } from "@/components/final-review/member-roster-card";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";

type ImportItem = {
  name: string;
  content: string;
  sourceUrl?: string;
};

type ImportResult = {
  total: number;
  successCount: number;
  failureCount: number;
  successes: string[];
  failures: { name: string; reason: string }[];
};

type Cycle = {
  id: string;
  name: string;
  status: string;
  selfEvalStart: string;
  selfEvalEnd: string;
  peerReviewStart: string;
  peerReviewEnd: string;
  supervisorStart: string;
  supervisorEnd: string;
  calibrationStart: string;
  calibrationEnd: string;
  meetingStart: string;
  meetingEnd: string;
  appealStart: string | null;
  appealEnd: string | null;
};

type UserItem = {
  id: string;
  name: string;
  email: string | null;
  department: string;
  jobTitle: string | null;
  role: string;
  supervisor: { id: string; name: string } | null;
};

type VerifyRow = {
  name: string;
  inSystem: boolean;
  isGroupB: boolean;
  department: string | null;
  role?: string;
  supervisor: string | null;
  selfEval: { status: string; hasUrl: boolean; hasContent: boolean; sourceUrl: string | null } | null;
  nominations: { total: number; approved: number; pending: number; rejected: number } | null;
  peerNominationCount: number;
  peerNominationComplete: boolean;
  peerReviewReceivedSubmitted: number;
  peerReviewReceivedTotal: number;
  peerReviewReceivedComplete: boolean;
  peerReviewReceivedPendingReviewerNames: string[];
  peerReviewAssignedSubmitted: number;
  peerReviewAssignedTotal: number;
  peerReviewAssignedComplete: boolean;
  peerReviewAssignedPendingRevieweeNames: string[];
  supEval: { evaluator: string; status: string }[];
  supervisorExpectedEvaluatorNames: string[];
  supervisorSubmittedEvaluatorNames: string[];
  supervisorPendingEvaluatorNames: string[];
  legacyEvaluators: string[];
  supervisorComplete: boolean;
  followUpFlags: string[];
  followUpSummary: string;
};

type VerifyData = {
  cycleName: string;
  cycleStatus: string;
  summary: {
    total: number; inSystem: number; missing: number;
    groupA: number; groupB: number;
    selfEvalDone: number; selfEvalMissing: number;
    peerNominationIncomplete: number;
    peerReviewReceivedIncomplete: number;
    peerReviewAssignedIncomplete: number;
    supervisorIncomplete: number;
  };
  roster: VerifyRow[];
  followUpSheetRows: Array<{
    name: string;
    department: string | null;
    pendingPeerReviewCount: number;
    pendingPeerReviewRevieweeNames: string[];
    pendingSupervisorEvalCount: number;
    pendingSupervisorEvalEmployeeNames: string[];
  }>;
};

type ReferenceStarRange = {
  stars: number;
  min: number;
  max: number;
};

type FinalReviewConfigForm = {
  cycleId: string;
  accessUserIds: string[];
  finalizerUserIds: string[];
  leaderEvaluatorUserIds: string[];
  leaderSubjectUserIds: string[];
  employeeSubjectUserIds: string[];
  referenceStarRanges: ReferenceStarRange[];
};

const defaultReferenceStarRanges: ReferenceStarRange[] = [
  { stars: 1, min: 0, max: 1.49 },
  { stars: 2, min: 1.5, max: 2.49 },
  { stars: 3, min: 2.5, max: 3.49 },
  { stars: 4, min: 3.5, max: 4.49 },
  { stars: 5, min: 4.5, max: 5 },
];

const statusFlow = ["DRAFT", "SELF_EVAL", "PEER_REVIEW", "SUPERVISOR_EVAL", "CALIBRATION", "MEETING", "APPEAL", "ARCHIVED"];
const statusLabels: Record<string, string> = {
  DRAFT: "未开始",
  SELF_EVAL: "个人自评",
  PEER_REVIEW: "360环评",
  SUPERVISOR_EVAL: "上级评估",
  CALIBRATION: "绩效校准",
  MEETING: "面谈",
  APPEAL: "申诉",
  ARCHIVED: "已归档",
};

type FinalReviewRosterField = keyof Omit<FinalReviewConfigForm, "cycleId" | "referenceStarRanges">;

type FinalReviewRosterGroup = {
  field: FinalReviewRosterField;
  label: string;
  ids: string[];
};

function getOverlapLabelsByUserId(groups: FinalReviewRosterGroup[], currentField: FinalReviewRosterField) {
  const labelsByUserId = new Map<string, string[]>();

  groups.forEach(({ label, ids }) => {
    ids.forEach((id) => {
      const existing = labelsByUserId.get(id) || [];
      if (!existing.includes(label)) {
        labelsByUserId.set(id, [...existing, label]);
      }
    });
  });

  const currentGroup = groups.find((group) => group.field === currentField);
  const overlapLabelsByUserId: Record<string, string[]> = {};

  if (!currentGroup) {
    return overlapLabelsByUserId;
  }

  currentGroup.ids.forEach((id) => {
    const overlapLabels = (labelsByUserId.get(id) || []).filter((label) => label !== currentGroup.label);
    if (overlapLabels.length > 0) {
      overlapLabelsByUserId[id] = overlapLabels;
    }
  });

  return overlapLabelsByUserId;
}

function AdminContent() {
  const { preview, previewRole, getData } = usePreview();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [importText, setImportText] = useState("");
  const [importParsed, setImportParsed] = useState<ImportItem[]>([]);
  const [importParseError, setImportParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyExporting, setVerifyExporting] = useState(false);
  const [finalReviewCycleId, setFinalReviewCycleId] = useState("");
  const [finalReviewConfig, setFinalReviewConfig] = useState<FinalReviewConfigForm | null>(null);
  const [finalReviewLoading, setFinalReviewLoading] = useState(false);
  const [finalReviewSaving, setFinalReviewSaving] = useState(false);
  const [newCycle, setNewCycle] = useState({
    name: "2025年下半年绩效考核",
    selfEvalStart: "2026-03-17",
    selfEvalEnd: "2026-03-24",
    peerReviewStart: "2026-03-24",
    peerReviewEnd: "2026-03-27",
    supervisorStart: "2026-03-24",
    supervisorEnd: "2026-03-27",
    calibrationStart: "2026-03-27",
    calibrationEnd: "2026-03-30",
    meetingStart: "2026-03-30",
    meetingEnd: "2026-04-01",
    appealStart: "2026-04-01",
    appealEnd: "2026-04-04",
  });

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("admin") as Record<string, unknown>;
      setCycles((previewData.cycles as Cycle[]) || []);
      setUsers((previewData.users as UserItem[]) || []);
      return;
    }

    fetch("/api/admin/cycle").then((r) => r.json()).then((d) => Array.isArray(d) ? setCycles(d) : null);
    fetch("/api/admin/users").then((r) => r.json()).then((d) => Array.isArray(d) ? setUsers(d) : null);
  }, [preview, previewRole, getData]);

  useEffect(() => {
    if (preview) return;
    if (finalReviewCycleId || cycles.length === 0) return;
    const preferred = cycles.find((cycle) => cycle.status !== "ARCHIVED") || cycles[0];
    if (preferred) {
      setFinalReviewCycleId(preferred.id);
    }
  }, [cycles, finalReviewCycleId, preview]);

  const createCycle = async () => {
    if (preview) return;
    try {
      await fetch("/api/admin/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCycle),
      });
      toast.success("考核周期已创建");
      setShowCreate(false);
      const data = await fetch("/api/admin/cycle").then((r) => r.json());
      setCycles(data);
    } catch {
      toast.error("创建失败");
    }
  };

  const updateCycleStatus = async (cycleId: string, status: string) => {
    if (preview) return;
    if (!confirm(`确认将考核周期推进到「${statusLabels[status]}」阶段？`)) return;
    try {
      await fetch("/api/admin/cycle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycleId, status }),
      });
      toast.success("状态已更新");
      const data = await fetch("/api/admin/cycle").then((r) => r.json());
      setCycles(data);
    } catch {
      toast.error("更新失败");
    }
  };

  const syncOrg = async () => {
    if (preview) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-org", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`同步成功，共同步 ${data.syncCount} 名员工`);
      const usersData = await fetch("/api/admin/users").then((r) => r.json());
      setUsers(usersData);
    } catch (e) {
      toast.error("同步失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setSyncing(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    if (preview) return;
    try {
      await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role }),
      });
      toast.success("角色已更新");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch {
      toast.error("更新失败");
    }
  };

  const parseImportData = (text: string) => {
    setImportText(text);
    setImportParseError("");
    setImportParsed([]);
    setImportResult(null);

    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setImportParseError("数据必须是JSON数组格式");
        return;
      }
      const valid = parsed.every(
        (item: Record<string, unknown>) => typeof item.name === "string" && typeof item.content === "string"
      );
      if (!valid) {
        setImportParseError("每条记录必须包含 name 和 content 字段");
        return;
      }
      setImportParsed(parsed as ImportItem[]);
    } catch {
      // Try CSV parsing: name,content per line
      try {
        const lines = text.trim().split("\n").filter((l) => l.trim());
        if (lines.length === 0) return;

        const firstLine = lines[0].toLowerCase();
        const startIdx = firstLine.includes("姓名") || firstLine.includes("name") ? 1 : 0;

        const items: ImportItem[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const commaIdx = lines[i].indexOf(",");
          if (commaIdx === -1) {
            setImportParseError(`第 ${i + 1} 行格式错误，缺少逗号分隔符`);
            return;
          }
          const name = lines[i].slice(0, commaIdx).trim();
          const content = lines[i].slice(commaIdx + 1).trim();
          if (name && content) {
            items.push({ name, content });
          }
        }
        if (items.length === 0) {
          setImportParseError("未解析到有效数据");
          return;
        }
        setImportParsed(items);
      } catch {
        setImportParseError("无法解析数据，请使用JSON数组或CSV格式");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseImportData(text);
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (preview) return;
    if (importParsed.length === 0) return;
    if (!confirm(`确认导入 ${importParsed.length} 条自评记录？`)) return;

    setImporting(true);
    try {
      const res = await fetch("/api/admin/import-self-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importParsed),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setImportResult(result);
      toast.success(`导入完成：成功 ${result.successCount} 人，失败 ${result.failureCount} 人`);
    } catch (e) {
      toast.error("导入失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setImporting(false);
    }
  };

  const loadVerifyData = async () => {
    if (preview) return;
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/admin/verify");
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setVerifyData(data);
    } catch (e) {
      toast.error("加载核验数据失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setVerifyLoading(false);
    }
  };

  const downloadVerifyExport = async () => {
    if (preview) return;
    setVerifyExporting(true);
    try {
      const res = await fetch("/api/admin/verify/export");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "导出失败");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "进度核验花名册.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("花名册已开始下载");
    } catch (e) {
      toast.error("导出失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setVerifyExporting(false);
    }
  };

  const loadFinalReviewConfig = useCallback(async (cycleId = finalReviewCycleId) => {
    if (preview || !cycleId) return;
    setFinalReviewLoading(true);
    try {
      const res = await fetch(`/api/admin/final-review-config?cycleId=${cycleId}`);
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setFinalReviewConfig({
        cycleId: data.config.cycleId,
        accessUserIds: data.config.accessUserIds || [],
        finalizerUserIds: data.config.finalizerUserIds || [],
        leaderEvaluatorUserIds: data.config.leaderEvaluatorUserIds || [],
        leaderSubjectUserIds: data.config.leaderSubjectUserIds || [],
        employeeSubjectUserIds: data.config.employeeSubjectUserIds || [],
        referenceStarRanges: data.config.referenceStarRanges || defaultReferenceStarRanges,
      });
    } catch (e) {
      toast.error("加载终评配置失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setFinalReviewLoading(false);
    }
  }, [finalReviewCycleId, preview]);

  useEffect(() => {
    if (preview || !finalReviewCycleId || finalReviewConfig || finalReviewLoading) return;
    loadFinalReviewConfig(finalReviewCycleId);
  }, [finalReviewCycleId, finalReviewConfig, finalReviewLoading, preview, loadFinalReviewConfig]);

  const saveFinalReviewConfig = async () => {
    if (preview || !finalReviewConfig) return;
    setFinalReviewSaving(true);
    try {
      const res = await fetch("/api/admin/final-review-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalReviewConfig),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      toast.success("终评配置已保存");
      await loadFinalReviewConfig(finalReviewConfig.cycleId);
    } catch (e) {
      toast.error("保存终评配置失败: " + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setFinalReviewSaving(false);
    }
  };

  const updateFinalReviewIds = (
    field: keyof Omit<FinalReviewConfigForm, "cycleId" | "referenceStarRanges">,
    selected: string[],
  ) => {
    setFinalReviewConfig((prev) => prev ? { ...prev, [field]: selected } : prev);
  };

  const updateReferenceStarRange = (stars: number, key: "min" | "max", value: string) => {
    setFinalReviewConfig((prev) => prev ? {
      ...prev,
      referenceStarRanges: prev.referenceStarRanges.map((range) => (
        range.stars === stars ? { ...range, [key]: Number(value) } : range
      )),
    } : prev);
  };

  const finalReviewRosterGroups: FinalReviewRosterGroup[] = finalReviewConfig ? [
    { field: "accessUserIds", label: "终评工作台权限名单", ids: finalReviewConfig.accessUserIds },
    { field: "finalizerUserIds", label: "公司级绩效终评校准人", ids: finalReviewConfig.finalizerUserIds },
    { field: "leaderEvaluatorUserIds", label: "主管层双人终评填写人", ids: finalReviewConfig.leaderEvaluatorUserIds },
    { field: "leaderSubjectUserIds", label: "主管层终评名单", ids: finalReviewConfig.leaderSubjectUserIds },
    { field: "employeeSubjectUserIds", label: "普通员工终评名单", ids: finalReviewConfig.employeeSubjectUserIds },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="系统管理" description="考核周期、员工与数据管理" />

      <Tabs defaultValue="cycle">
        <TabsList>
          <TabsTrigger value="cycle">考核周期</TabsTrigger>
          <TabsTrigger value="users">员工管理 ({users.length})</TabsTrigger>
          <TabsTrigger value="sync">组织同步</TabsTrigger>
          <TabsTrigger value="import">自评导入</TabsTrigger>
          <TabsTrigger value="finalReview">终评配置</TabsTrigger>
          <TabsTrigger value="verify" onClick={() => {
            if (!verifyData && !verifyLoading) {
              loadVerifyData();
            }
          }}>数据核验</TabsTrigger>
        </TabsList>

        <TabsContent value="cycle" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreate(!showCreate)} disabled={preview}>
              {showCreate ? "取消" : "创建考核周期"}
            </Button>
          </div>

          {showCreate && !preview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">创建考核周期</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">周期名称</label>
                  <input
                    value={newCycle.name}
                    onChange={(e) => setNewCycle({ ...newCycle, name: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm shadow-xs transition-all duration-[var(--transition-base)] hover:border-border focus:border-ring focus:shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/20"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "自评开始", key: "selfEvalStart" },
                    { label: "自评截止", key: "selfEvalEnd" },
                    { label: "环评开始", key: "peerReviewStart" },
                    { label: "环评截止", key: "peerReviewEnd" },
                    { label: "上级评估开始", key: "supervisorStart" },
                    { label: "上级评估截止", key: "supervisorEnd" },
                    { label: "校准开始", key: "calibrationStart" },
                    { label: "校准截止", key: "calibrationEnd" },
                    { label: "面谈开始", key: "meetingStart" },
                    { label: "面谈截止", key: "meetingEnd" },
                    { label: "申诉开始", key: "appealStart" },
                    { label: "申诉截止", key: "appealEnd" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs text-gray-500">{label}</label>
                      <input
                        type="date"
                        value={newCycle[key as keyof typeof newCycle]}
                        onChange={(e) => setNewCycle({ ...newCycle, [key]: e.target.value })}
                        className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm shadow-xs transition-all duration-[var(--transition-base)] hover:border-border focus:border-ring focus:shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/20"
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={createCycle}>创建</Button>
              </CardContent>
            </Card>
          )}

          {cycles.map((cycle) => {
            const currentIdx = statusFlow.indexOf(cycle.status);
            const nextStatus = statusFlow[currentIdx + 1];

            return (
              <Card key={cycle.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{cycle.name}</CardTitle>
                      <CardDescription>
                        {new Date(cycle.selfEvalStart).toLocaleDateString()} - {new Date(cycle.meetingEnd).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge>{statusLabels[cycle.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {statusFlow.map((s, i) => (
                      <div key={s} className="flex items-center gap-1.5">
                        <div
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            i <= currentIdx
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground/60"
                          }`}
                        >
                          {statusLabels[s]}
                        </div>
                        {i < statusFlow.length - 1 && (
                          <span className={`text-xs ${i < currentIdx ? "text-primary/40" : "text-border"}`}>{"\u203A"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {nextStatus && (
                    <div className="mt-4">
                      <Button size="sm" onClick={() => updateCycleStatus(cycle.id, nextStatus)} disabled={preview}>
                        推进到「{statusLabels[nextStatus]}」
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardContent className="p-4 pb-0">
              <input
                type="text"
                placeholder="搜索姓名、部门、职位..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-9 w-full max-w-sm rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm shadow-xs transition-all hover:border-border focus:border-ring focus:shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/20"
              />
            </CardContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>职位</TableHead>
                    <TableHead>上级</TableHead>
                    <TableHead className="text-center">角色</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.filter((u) => {
                    if (!userSearch) return true;
                    const q = userSearch.toLowerCase();
                    return (u.name?.toLowerCase().includes(q)) || (u.department?.toLowerCase().includes(q)) || (u.jobTitle?.toLowerCase().includes(q)) || (u.supervisor?.name?.toLowerCase().includes(q));
                  }).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.department}</TableCell>
                      <TableCell className="text-muted-foreground">{u.jobTitle || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.supervisor?.name || "-"}</TableCell>
                      <TableCell className="text-center">
                        <select
                          value={u.role}
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                          className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs transition-colors focus:border-primary focus:outline-none"
                          disabled={preview}
                        >
                          <option value="EMPLOYEE">员工</option>
                          <option value="SUPERVISOR">主管</option>
                          <option value="HRBP">HRBP</option>
                          <option value="ADMIN">管理员</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">飞书组织架构同步</CardTitle>
              <CardDescription>
                从飞书同步部门和员工信息，自动设置上下级关系
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={syncOrg} disabled={syncing || preview}>
                {syncing ? "同步中..." : "立即同步"}
              </Button>
              <p className="mt-2 text-xs text-gray-400">
                需要在飞书开放平台配置应用权限：contact:contact:readonly_as_app
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">批量导入自评</CardTitle>
              <CardDescription>
                从飞书多维表格导出自评数据后，粘贴JSON或上传CSV文件导入系统
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  <strong>JSON格式：</strong>{" "}
                  {`[{ "name": "张三", "content": "自评内容..." }, ...]`}
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  <strong>CSV格式：</strong> 每行一条，格式为「姓名,自评内容」
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">上传文件</label>
                <input
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleFileUpload}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  disabled={preview}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">或粘贴数据</label>
                <Textarea
                  value={importText}
                  onChange={(e) => parseImportData(e.target.value)}
                  placeholder={'粘贴JSON数组或CSV内容...\n例如：[{"name":"张三","content":"本周期完成了..."}]'}
                  rows={8}
                  disabled={preview}
                />
              </div>

              {importParseError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {importParseError}
                </div>
              )}
            </CardContent>
          </Card>

          {importParsed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  数据预览（共 {importParsed.length} 条）
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>序号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>自评内容预览</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importParsed.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="max-w-md truncate text-muted-foreground">
                        {item.content.slice(0, 80)}
                        {item.content.length > 80 ? "..." : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </CardContent>
            </Card>
          )}

          {importParsed.length > 0 && !importResult && (
            <div className="flex justify-end">
              <Button onClick={executeImport} disabled={importing || preview}>
                {importing ? "导入中..." : `确认导入（${importParsed.length} 条）`}
              </Button>
            </div>
          )}

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">导入结果</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4">
                  <div className="rounded-lg bg-green-50 px-4 py-2">
                    <div className="text-2xl font-bold text-green-700">{importResult.successCount}</div>
                    <div className="text-xs text-green-600">成功</div>
                  </div>
                  <div className="rounded-lg bg-red-50 px-4 py-2">
                    <div className="text-2xl font-bold text-red-700">{importResult.failureCount}</div>
                    <div className="text-xs text-red-600">失败</div>
                  </div>
                </div>

                {importResult.failures.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-red-700">失败详情：</p>
                    <ul className="space-y-1">
                      {importResult.failures.map((f, idx) => (
                        <li key={idx} className="text-sm text-red-600">
                          {f.name} - {f.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="finalReview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">终评配置</CardTitle>
              <CardDescription>
                为指定考核周期配置终评工作台权限、主管层名单、普通员工终评名单，以及参考星级分数区间
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">考核周期</label>
                  <select
                    value={finalReviewCycleId}
                    onChange={(e) => {
                      setFinalReviewCycleId(e.target.value);
                      setFinalReviewConfig(null);
                    }}
                    className="h-9 min-w-[260px] rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm"
                    disabled={preview}
                  >
                    <option value="">请选择周期</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.name} · {statusLabels[cycle.status] || cycle.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => loadFinalReviewConfig()} disabled={finalReviewLoading || preview || !finalReviewCycleId}>
                    {finalReviewLoading ? "加载中..." : "加载配置"}
                  </Button>
                  <Button onClick={saveFinalReviewConfig} disabled={finalReviewSaving || preview || !finalReviewConfig}>
                    {finalReviewSaving ? "保存中..." : "保存终评配置"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {finalReviewConfig && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">终评工作台名单</CardTitle>
                  <CardDescription>
                    工作台访问名单、公司级绩效终评校准人、主管层双人终评填写人、主管层终评名单、普通员工终评名单都按周期配置
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                  {finalReviewRosterGroups.map((group) => (
                    <MemberRosterCard
                      key={group.field}
                      title={group.label}
                      description={
                        group.field === "finalizerUserIds" || group.field === "leaderEvaluatorUserIds"
                          ? "当前周期固定为吴承霖、邱翔，页面只展示这两位公司级校准人与主管层填写人。"
                          : "只能通过搜索添加成员，选中的成员会直接显示在卡片顶部。"
                      }
                      members={users}
                      selectedIds={group.ids}
                      onChange={(selectedIds) => updateFinalReviewIds(group.field, selectedIds)}
                      disabled={preview || group.field === "finalizerUserIds" || group.field === "leaderEvaluatorUserIds"}
                      overlapLabelsByUserId={getOverlapLabelsByUserId(finalReviewRosterGroups, group.field)}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">参考星级分数区间</CardTitle>
                  <CardDescription>
                    标签2会根据初评加权分，将普通员工自动换算成参考星级；第三页主管层不复用这套自动换星
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {finalReviewConfig.referenceStarRanges
                    .slice()
                    .sort((a, b) => a.stars - b.stars)
                    .map((range) => (
                      <div key={range.stars} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[100px_1fr_1fr]">
                        <div className="flex items-center text-sm font-semibold">{range.stars}星</div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">最小分数</label>
                          <input
                            type="number"
                            step="0.01"
                            value={range.min}
                            onChange={(e) => updateReferenceStarRange(range.stars, "min", e.target.value)}
                            className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm"
                            disabled={preview}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">最大分数</label>
                          <input
                            type="number"
                            step="0.01"
                            value={range.max}
                            onChange={(e) => updateReferenceStarRange(range.stars, "max", e.target.value)}
                            className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm"
                            disabled={preview}
                          />
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        <TabsContent value="verify" className="space-y-4">
          {verifyLoading && <Card><CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent></Card>}
          {verifyData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">核验总览</CardTitle>
                  <CardDescription>周期：{verifyData.cycleName} · 阶段：{statusLabels[verifyData.cycleStatus] || verifyData.cycleStatus}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-2xl font-bold">{verifyData.summary.inSystem}<span className="text-base font-normal text-muted-foreground">/{verifyData.summary.total}</span></div>
                      <div className="text-xs text-muted-foreground">系统匹配</div>
                      {verifyData.summary.missing > 0 && <Badge variant="destructive" className="mt-1">{verifyData.summary.missing} 缺失</Badge>}
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-2xl font-bold">{verifyData.summary.selfEvalDone}<span className="text-base font-normal text-muted-foreground">/{verifyData.summary.groupA}</span></div>
                      <div className="text-xs text-muted-foreground">自评链接已导入</div>
                      {verifyData.summary.selfEvalMissing > 0 && <Badge variant="destructive" className="mt-1">{verifyData.summary.selfEvalMissing} 缺失</Badge>}
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{verifyData.summary.peerNominationIncomplete}</div>
                      <div className="text-xs text-muted-foreground">360提名不足</div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{verifyData.summary.peerReviewReceivedIncomplete}</div>
                      <div className="text-xs text-muted-foreground">360被评未完成</div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{verifyData.summary.peerReviewAssignedIncomplete}</div>
                      <div className="text-xs text-muted-foreground">360待评他人未完成</div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{verifyData.summary.supervisorIncomplete}</div>
                      <div className="text-xs text-muted-foreground">初评未完成</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">花名册逐人核验</CardTitle>
                      <CardDescription>红色背景 = 有异常项，支持先查看再导出 Excel 跟进</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={loadVerifyData} disabled={verifyLoading || preview}>
                        {verifyLoading ? "刷新中..." : "刷新"}
                      </Button>
                      <Button size="sm" onClick={downloadVerifyExport} disabled={verifyExporting || preview}>
                        {verifyExporting ? "导出中..." : "导出Excel花名册"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">姓名</TableHead>
                        <TableHead className="w-20">部门</TableHead>
                        <TableHead className="w-16">系统</TableHead>
                        <TableHead className="w-20">直属上级</TableHead>
                        <TableHead className="w-20">自评链接</TableHead>
                        <TableHead className="w-24">360提名</TableHead>
                        <TableHead className="w-44">360被评</TableHead>
                        <TableHead className="w-44">360待评他人</TableHead>
                        <TableHead className="w-48">初评进度</TableHead>
                        <TableHead className="w-44">待跟进项</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifyData.roster.map((row) => (
                        <TableRow
                          key={row.name}
                          className={
                            !row.inSystem ||
                            (!row.isGroupB && !row.selfEval?.hasUrl && !row.selfEval?.hasContent) ||
                            row.followUpFlags.length > 0
                              ? "bg-red-50"
                              : ""
                          }
                        >
                          <TableCell className="font-medium">
                            {row.name}
                            {row.isGroupB && <span className="ml-1 text-[10px] text-muted-foreground">(B组)</span>}
                          </TableCell>
                          <TableCell className="text-xs">{row.department || "—"}</TableCell>
                          <TableCell>{row.inSystem ? <span className="text-green-600">✓</span> : <span className="text-red-600 font-bold">✗</span>}</TableCell>
                          <TableCell className="text-xs">{row.supervisor || "—"}</TableCell>
                          <TableCell>
                            {row.isGroupB ? (
                              <span className="text-xs text-muted-foreground">B组免自评</span>
                            ) : row.selfEval?.hasUrl ? (
                              <a href={row.selfEval.sourceUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">✓ 链接</a>
                            ) : row.selfEval?.hasContent ? (
                              <span className="text-green-600">✓ 内容</span>
                            ) : (
                              <span className="text-red-600 font-bold">✗ 缺失</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.nominations ? (
                              <span className={row.peerNominationComplete ? "" : "text-red-600 font-bold"}>
                                {row.peerNominationCount}人
                                {row.nominations.approved > 0 && <span className="text-green-600"> ({row.nominations.approved}批)</span>}
                                {row.nominations.pending > 0 && <span className="text-yellow-600"> ({row.nominations.pending}待)</span>}
                              </span>
                            ) : <span className="text-red-600 font-bold">未提名</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-1">
                              <span className={row.peerReviewReceivedComplete ? "text-green-600" : "text-red-600 font-bold"}>
                                {row.peerReviewReceivedSubmitted}/{row.peerReviewReceivedTotal}
                              </span>
                              {row.peerReviewReceivedPendingReviewerNames.length > 0 && (
                                <div className="text-[11px] text-red-600">
                                  待完成：{row.peerReviewReceivedPendingReviewerNames.join("、")}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-1">
                              <span className={row.peerReviewAssignedComplete ? "text-green-600" : "text-red-600 font-bold"}>
                                {row.peerReviewAssignedSubmitted}/{row.peerReviewAssignedTotal}
                              </span>
                              {row.peerReviewAssignedPendingRevieweeNames.length > 0 && (
                                <div className="text-[11px] text-red-600">
                                  待完成：{row.peerReviewAssignedPendingRevieweeNames.join("、")}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.supervisorExpectedEvaluatorNames.length > 0 ? (
                              <div className="space-y-1">
                                {row.supervisorExpectedEvaluatorNames.map((evaluator, i) => {
                                  const actual = row.supEval.find((item) => evaluator === item.evaluator);
                                  return (
                                    <div key={i} className="flex items-center gap-1">
                                      <span>{evaluator}</span>
                                      {actual ? (
                                        <Badge variant={actual.status === "SUBMITTED" ? "default" : "secondary"} className="text-[10px] py-0">{actual.status === "SUBMITTED" ? "已评" : "草稿"}</Badge>
                                      ) : (
                                        <span className="text-muted-foreground">待评</span>
                                      )}
                                    </div>
                                  );
                                })}
                                {row.legacyEvaluators.length > 0 && (
                                  <div className="pt-1 text-[10px] text-muted-foreground">
                                    历史保留：{row.legacyEvaluators.join("、")}
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.followUpFlags.length > 0 ? (
                              <div className="space-y-1">
                                {row.followUpFlags.map((flag) => (
                                  <Badge key={flag} variant="destructive" className="mr-1">
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-green-600">已完成</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}
