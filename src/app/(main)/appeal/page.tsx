"use client";

import { useEffect, useState, Suspense } from "react";
import { FormPageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Star, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";

type Appeal = {
  id: string;
  cycleId: string;
  userId: string;
  reason: string;
  status: string;
  resolution: string;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
  // HR view fields
  user?: { id: string; name: string; department: string };
  finalStars?: number | null;
};

type Cycle = {
  id: string;
  name: string;
  status: string;
  appealStart: string | null;
  appealEnd: string | null;
};

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "destructive"; icon: typeof Clock }> = {
  PENDING: { label: "待处理", variant: "warning", icon: Clock },
  APPROVED: { label: "已接受", variant: "success", icon: CheckCircle2 },
  REJECTED: { label: "已驳回", variant: "destructive", icon: XCircle },
};

function StarDisplay({ count }: { count: number | null }) {
  if (count == null) return <span className="text-muted-foreground">暂无</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= count ? "fill-amber-400 text-amber-400" : "fill-transparent text-border"}`}
        />
      ))}
    </span>
  );
}

function AppealContent() {
  const { preview, previewRole, getData } = usePreview();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [finalStars, setFinalStars] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // HR handling state
  const [handlingId, setHandlingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const isHR = role && ["HRBP", "ADMIN"].includes(role);

  async function fetchData(signal?: AbortSignal) {
    try {
      const res = await fetch("/api/appeal", { signal });
      const data = await res.json();

      if (signal?.aborted) return;
      setAppeals(data.appeals || []);
      setCycle(data.cycle || null);
      setFinalStars(data.finalStars ?? null);
      setRole(data.role || null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      toast.error("加载数据失败");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("appeal") as {
        appeals: Appeal[];
        cycle: Cycle;
        finalStars: number | null;
        role: string;
      };
      setAppeals(previewData.appeals || []);
      setCycle(previewData.cycle || null);
      setFinalStars(previewData.finalStars ?? null);
      setRole(previewData.role || null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [preview, previewRole, getData]);

  const isInAppealWindow = (() => {
    if (!cycle?.appealStart || !cycle?.appealEnd) return false;
    const now = new Date();
    return now >= new Date(cycle.appealStart) && now <= new Date(cycle.appealEnd);
  })();

  const hasSubmitted = appeals.length > 0 && !isHR;

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("请填写申诉理由");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "提交失败");
        return;
      }
      toast.success("申诉已提交");
      setReason("");
      fetchData();
    } catch {
      toast.error("提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAppeal(appealId: string, status: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch("/api/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "handle", appealId, status, resolution }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "处理失败");
        return;
      }
      toast.success(status === "APPROVED" ? "已接受申诉" : "已驳回申诉");
      setHandlingId(null);
      setResolution("");
      fetchData();
    } catch {
      toast.error("处理失败");
    }
  }

  if (loading) {
    return <FormPageSkeleton />;
  }

  if (!cycle) {
    return (
      <div className="space-y-6">
        <PageHeader title="绩效申诉" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无进行中的考核周期
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ HRBP/ADMIN 视角 ============
  if (isHR) {
    const pendingAppeals = appeals.filter((a) => a.status === "PENDING");
    const handledAppeals = appeals.filter((a) => a.status !== "PENDING");

    return (
      <div className="space-y-6">
        <PageHeader title="绩效申诉管理" description={`当前周期：${cycle.name}`} />

        {/* 待处理申诉 */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            待处理申诉
            {pendingAppeals.length > 0 && (
              <Badge variant="warning" className="ml-2">
                {pendingAppeals.length}
              </Badge>
            )}
          </h2>
          {pendingAppeals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暂无待处理的申诉
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingAppeals.map((appeal) => (
                <Card key={appeal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {appeal.user?.name || "未知"}
                        </CardTitle>
                        <CardDescription>
                          {appeal.user?.department || "未知部门"} · 当前星级：
                          <StarDisplay count={appeal.finalStars ?? null} />
                        </CardDescription>
                      </div>
                      <Badge variant={statusConfig.PENDING.variant}>
                        {statusConfig.PENDING.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-muted-foreground">申诉理由</Label>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{appeal.reason}</p>
                    </div>

                    {handlingId === appeal.id ? (
                      <div className="space-y-3 rounded-md border p-3">
                        <div>
                          <Label>处理意见</Label>
                          <Textarea
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            placeholder="请输入处理意见..."
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAppeal(appeal.id, "APPROVED")}
                          >
                            接受
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAppeal(appeal.id, "REJECTED")}
                          >
                            驳回
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setHandlingId(null);
                              setResolution("");
                            }}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setHandlingId(appeal.id)}
                      >
                        处理
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 已处理申诉 */}
        {handledAppeals.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">已处理</h2>
            <div className="space-y-3">
              {handledAppeals.map((appeal) => {
                const config = statusConfig[appeal.status] || statusConfig.PENDING;
                return (
                  <Card key={appeal.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {appeal.user?.name || "未知"}
                          </CardTitle>
                          <CardDescription>
                            {appeal.user?.department || "未知部门"} · 当前星级：
                            <StarDisplay count={appeal.finalStars ?? null} />
                          </CardDescription>
                        </div>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <Label className="text-muted-foreground">申诉理由</Label>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{appeal.reason}</p>
                      </div>
                      {appeal.resolution && (
                        <div>
                          <Label className="text-muted-foreground">处理意见</Label>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{appeal.resolution}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ 员工视角 ============
  return (
    <div className="space-y-6">
      <PageHeader title="绩效申诉" description={`当前周期：${cycle.name}`} />

      {/* 绩效结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的绩效结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">最终星级：</span>
            <StarDisplay count={finalStars} />
          </div>
        </CardContent>
      </Card>

      {/* 提交申诉表单 */}
      {!hasSubmitted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">提交申诉</CardTitle>
            <CardDescription>
              {isInAppealWindow
                ? "对结果有异议，请在绩效申诉窗口期内提交，需提交书面申诉至HRBP禹聪琪，逾期默认绩效结果确认并归档。"
                : "当前不在申诉窗口期内，逾期默认绩效结果确认并归档。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reason">
                申诉理由 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请详细说明您的申诉理由..."
                disabled={!isInAppealWindow}
                className="mt-1"
                rows={5}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={preview || !isInAppealWindow || submitting || !reason.trim()}
            >
              {submitting ? "提交中..." : "提交申诉"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 已提交的申诉 */}
      {hasSubmitted && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">我的申诉</CardTitle>
              {(() => {
                const appeal = appeals[0];
                const config = statusConfig[appeal.status] || statusConfig.PENDING;
                const Icon = config.icon;
                return (
                  <Badge variant={config.variant}>
                    <Icon className="mr-1 h-3 w-3" />
                    {config.label}
                  </Badge>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground">申诉理由</Label>
              <p className="mt-1 whitespace-pre-wrap text-sm">{appeals[0].reason}</p>
            </div>
            {appeals[0].resolution && (
              <div>
                <Label className="text-muted-foreground">处理结果</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm">{appeals[0].resolution}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              提交时间：{new Date(appeals[0].createdAt).toLocaleString("zh-CN")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 申诉窗口期提示 */}
      {!isInAppealWindow && !hasSubmitted && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {cycle.appealStart && cycle.appealEnd
            ? `申诉窗口期：${new Date(cycle.appealStart).toLocaleDateString("zh-CN")} - ${new Date(cycle.appealEnd).toLocaleDateString("zh-CN")}`
            : "该考核周期暂未设置申诉窗口期"}
        </div>
      )}
    </div>
  );
}

export default function AppealPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <AppealContent />
    </Suspense>
  );
}
