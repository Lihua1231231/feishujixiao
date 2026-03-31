"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NormalizationShell } from "@/components/manager-review-normalization/normalization-shell";
import type { ManagerReviewNormalizationWorkspaceResponse } from "@/components/manager-review-normalization/types";

export default function ManagerReviewNormalizationPage() {
  const [workspace, setWorkspace] = useState<ManagerReviewNormalizationWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [reverting, setReverting] = useState(false);
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
    async (endpoint: "apply" | "revert") => {
      const setter = endpoint === "apply" ? setApplying : setReverting;
      setter(true);
      setError("");

      try {
        const response = await fetch(`/api/manager-review-normalization/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "操作失败");
        }
        await loadWorkspace();
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作失败");
      } finally {
        setter(false);
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
      <div className="space-y-6">
        <PageHeader
          title="绩效初评分布校准"
          description="先看评分人尺度，再看部门内强制分布模拟和变化预览。"
        />
        <Card className="rounded-[28px] border-border/60 shadow-none">
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" onClick={() => void loadWorkspace()}>
              重新加载
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="绩效初评分布校准"
        description="先校正评分人尺度，再按部门模拟强制分布。原始初评记录保持不变。"
      />

      {error ? (
        <Card className="rounded-[20px] border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="py-3 text-sm text-amber-900">{error}</CardContent>
        </Card>
      ) : null}

      <NormalizationShell
        cycleName={workspace.cycle.name}
        summary={workspace.summary}
        rawDistribution={workspace.rawDistribution}
        reviewerNormalizedDistribution={workspace.reviewerNormalizedDistribution}
        departmentNormalizedDistribution={workspace.departmentNormalizedDistribution}
        raterBiasRows={workspace.raterBiasRows}
        movementRows={workspace.movementRows}
        applicationState={workspace.applicationState}
        onApply={() => runAction("apply")}
        onRevert={() => runAction("revert")}
        applying={applying}
        reverting={reverting}
      />
    </div>
  );
}
