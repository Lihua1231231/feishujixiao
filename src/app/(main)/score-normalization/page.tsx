"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ScoreNormalizationSource,
  type ScoreNormalizationWorkspaceResponse,
  resolveScoreNormalizationSource,
  SCORE_NORMALIZATION_SOURCE_OPTIONS,
} from "@/components/score-normalization/types";
import { NormalizationShell } from "@/components/score-normalization/normalization-shell";

function SourceWorkspacePanel({
  source,
  active,
}: {
  source: ScoreNormalizationSource;
  active: boolean;
}) {
  const [workspace, setWorkspace] = useState<ScoreNormalizationWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(false);
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
      const response = await fetch(`/api/score-normalization/workspace?source=${source}`);
      const data = (await response.json()) as ScoreNormalizationWorkspaceResponse & { error?: string };
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
  }, [source]);

  const runAction = useCallback(
    async (endpoint: "apply" | "revert") => {
      const setter = endpoint === "apply" ? setApplying : setReverting;
      setter(true);
      setError("");

      try {
        const response = await fetch(`/api/score-normalization/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, confirmed: true }),
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
    [loadWorkspace, source],
  );

  useEffect(() => {
    if (!active) return;
    if (workspace) return;
    void loadWorkspace();
  }, [active, loadWorkspace, workspace]);

  if (!active && !workspace) {
    return (
      <Card className="rounded-[28px] border-border/60 shadow-none">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          切换到该页签后会加载对应的分析结果。
        </CardContent>
      </Card>
    );
  }

  if (loading && !workspace) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <Card className="rounded-[28px] border-border/60 shadow-none">
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            className="text-sm font-medium text-primary hover:underline"
          >
            重新加载
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!workspace) return null;

  return (
    <NormalizationShell
      source={workspace.source}
      cycleName={workspace.cycle.name}
      summary={workspace.summary}
      rawDistribution={workspace.rawDistribution}
      simulatedDistribution={workspace.simulatedDistribution}
      raterBiasRows={workspace.raterBiasRows}
      movementRows={workspace.movementRows}
      applicationState={workspace.applicationState}
      onApply={() => runAction("apply")}
      onRevert={() => runAction("revert")}
      applying={applying}
      reverting={reverting}
    />
  );
}

export default function ScoreNormalizationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeSource, setActiveSource] = useState<ScoreNormalizationSource>(() =>
    resolveScoreNormalizationSource(searchParams.get("source")),
  );

  const updateSource = useCallback(
    (nextSource: ScoreNormalizationSource) => {
      setActiveSource(nextSource);
      const params = new URLSearchParams(searchParams.toString());
      params.set("source", nextSource);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="分布校准分析"
        description="先对照原始分布、模拟标准化结果和偏差人群，再决定是否启用标准化口径或回退。"
      />

      <Tabs value={activeSource} onValueChange={(value) => updateSource(resolveScoreNormalizationSource(value))}>
        <TabsList variant="line" className="mb-4 gap-2 rounded-none bg-transparent p-0">
          <TabsTrigger value="PEER_REVIEW">{SCORE_NORMALIZATION_SOURCE_OPTIONS[0].label}</TabsTrigger>
          <TabsTrigger value="SUPERVISOR_EVAL">{SCORE_NORMALIZATION_SOURCE_OPTIONS[1].label}</TabsTrigger>
        </TabsList>

        <TabsContent value="PEER_REVIEW" className="outline-none">
          <SourceWorkspacePanel source="PEER_REVIEW" active={activeSource === "PEER_REVIEW"} />
        </TabsContent>
        <TabsContent value="SUPERVISOR_EVAL" className="outline-none">
          <SourceWorkspacePanel source="SUPERVISOR_EVAL" active={activeSource === "SUPERVISOR_EVAL"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
