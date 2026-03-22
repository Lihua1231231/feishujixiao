"use client";

import { useEffect, useState, Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";

const starLabels: Record<number, string> = {
  1: "1星",
  2: "2星",
  3: "3星",
  4: "4星",
  5: "5星",
};

const distributionLimits: Record<number, number> = {
  5: 10,
  4: 20,
  3: 50,
  2: 15,
  1: 5,
};

const distributionLabels: Record<number, string> = {
  5: "≤10%",
  4: "≤20%",
  3: "50%+",
  2: "≤15%",
  1: "≤5%",
};

type CalibrationItem = {
  user: { id: string; name: string; department: string; jobTitle: string | null };
  selfEvalStatus: "imported" | "not_imported";
  peerAvg: string | null;
  supervisorWeighted: number | null;
  proposedStars: number | null;
  finalStars: number | null;
};

function CalibrationContent() {
  const { preview, previewRole, getData } = usePreview();
  const [data, setData] = useState<CalibrationItem[]>([]);
  const [filter, setFilter] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editStars, setEditStars] = useState<number | null>(null);
  const [editReason, setEditReason] = useState("");

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("calibration") as Record<string, unknown>;
      const items = (previewData.data as CalibrationItem[]) || [];
      setData(items);
      return;
    }

    fetch("/api/calibration").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setData(d);
    });
  }, [preview, previewRole, getData]);

  const departments = [...new Set(data.map((d) => d.user.department).filter(Boolean))];

  const filtered = filter ? data.filter((d) => d.user.department === filter) : data;

  const total = filtered.length;
  const distribution = [1, 2, 3, 4, 5].map((s) => {
    const count = filtered.filter((d) => (d.finalStars ?? d.proposedStars ?? 0) === s).length;
    const pct = total > 0 ? (count / total) * 100 : 0;
    const limit = distributionLimits[s];
    const exceeded = s === 3 ? pct < limit : pct > limit;
    return { stars: s, count, pct, exceeded };
  });

  const saveCalibration = async (userId: string) => {
    if (preview) return;
    try {
      await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          finalStars: editStars,
          adjustReason: editReason,
        }),
      });
      toast.success("校准已保存");
      setEditingUser(null);
      const newData = await fetch("/api/calibration").then((r) => r.json());
      if (Array.isArray(newData)) setData(newData);
    } catch {
      toast.error("保存失败");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="绩效校准" description="查看与调整绩效等级分布" />

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">星级分布</CardTitle>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-sm shadow-xs transition-all hover:border-border focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/20"
            >
              <option value="">全公司</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-6 px-4" style={{ height: 320 }}>
            {distribution.map((d) => {
              const maxCount = Math.max(...distribution.map((x) => x.count), 1);
              const barHeight = Math.max(12, (d.count / maxCount) * 180);

              return (
                <div key={d.stars} className="flex flex-1 flex-col items-center gap-2" style={{ height: "100%" }}>
                  <div className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    {/* Reference label */}
                    <span className="text-[10px] text-muted-foreground/50">
                      {distributionLabels[d.stars]}
                    </span>
                    {/* Count */}
                    <span className={`text-sm font-semibold ${d.exceeded ? "text-red-500" : "text-foreground"}`}>
                      {d.count}
                    </span>
                    {/* Bar */}
                    <div
                      className={`w-10 rounded-t-lg transition-all ${
                        d.exceeded ? "bg-red-400" : "bg-primary/70"
                      }`}
                      style={{ height: `${barHeight}px` }}
                    />
                  </div>
                  {/* Label */}
                  <div className="text-center">
                    <span className="text-sm font-medium">{d.stars}星</span>
                    <p className={`text-[11px] ${d.exceeded ? "font-semibold text-red-500" : "text-muted-foreground"}`}>
                      {d.pct.toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>部门</TableHead>
                <TableHead className="text-center">自评状态</TableHead>
                <TableHead className="text-center">360均分</TableHead>
                <TableHead className="text-center">上级加权分</TableHead>
                <TableHead className="text-center">最终星级</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.user.id}>
                  <TableCell className="font-medium">{item.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.user.department}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.selfEvalStatus === "imported" ? "success" : "outline"}>
                      {item.selfEvalStatus === "imported" ? "已导入" : "未导入"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{item.peerAvg || "-"}</TableCell>
                  <TableCell className="text-center">
                    {item.supervisorWeighted != null ? (
                      <Badge variant="outline">{item.supervisorWeighted.toFixed(1)}</Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.finalStars != null ? (
                      <Badge>{starLabels[item.finalStars]}</Badge>
                    ) : item.proposedStars != null ? (
                      <Badge variant="outline">{starLabels[item.proposedStars]}</Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingUser(item.user.id);
                        setEditStars(item.finalStars ?? item.proposedStars ?? null);
                        setEditReason("");
                      }}
                    >
                      调整
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-[420px] shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">
                调整绩效星级 — {data.find((d) => d.user.id === editingUser)?.user.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="mb-2.5 block text-sm font-medium">最终星级</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditStars(s)}
                      className={`flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold transition-all duration-[var(--transition-fast)] ${
                        editStars === s
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "border border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      {s}星
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">调整原因</label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="请说明调整原因..."
                  rows={3}
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm shadow-xs transition-all duration-[var(--transition-base)] hover:border-border focus:border-ring focus:shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/20"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setEditingUser(null)}>取消</Button>
                <Button onClick={() => saveCalibration(editingUser)} disabled={!editStars}>
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
