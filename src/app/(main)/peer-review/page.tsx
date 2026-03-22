"use client";

import { useEffect, useState, Suspense } from "react";
import { FormPageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";

type PeerReview = {
  id: string;
  reviewee: { id: string; name: string; department: string };
  outputScore: number | null;
  outputComment: string;
  collaborationScore: number | null;
  collaborationComment: string;
  valuesScore: number | null;
  valuesComment: string;
  innovationScore: number | null;
  innovationComment: string;
  declinedAt: string | null;
  declineReason: string;
  status: string;
};

type Nomination = {
  id: string;
  nominee: { id: string; name: string; department: string };
  supervisorStatus: string;
  nomineeStatus: string;
};

type User = {
  id: string;
  name: string;
  department: string;
};

function ScoreSelector({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => !disabled && onChange(n)}
          disabled={disabled}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-[var(--transition-fast)] ${
            value === n
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
              : "border border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function NominationStatusBadges({ nomination }: { nomination: Nomination }) {
  const nomineeLabel = nomination.nomineeStatus === "ACCEPTED" ? "已接受" : nomination.nomineeStatus === "DECLINED" ? "已拒绝" : "待接受";
  const nomineeVariant = nomination.nomineeStatus === "ACCEPTED" ? "default" as const : nomination.nomineeStatus === "DECLINED" ? "destructive" as const : "secondary" as const;

  return (
    <Badge variant={nomineeVariant}>{nomineeLabel}</Badge>
  );
}

function PeerReviewContent() {
  const { preview, previewRole, getData } = usePreview();
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedDims, setCheckedDims] = useState<Record<string, Set<string>>>({});
  const [dimComments, setDimComments] = useState<Record<string, Record<string, string>>>({});
  const [declineDialog, setDeclineDialog] = useState<{ open: boolean; reviewId: string; revieweeName: string }>({ open: false, reviewId: "", revieweeName: "" });
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("peer-review") as Record<string, unknown>;
      setReviews((previewData.reviews as PeerReview[]) || []);
      setNominations((previewData.nominations as Nomination[]) || []);
      setSelectedUsers(
        ((previewData.nominations as Nomination[]) || []).map((n) => n.nominee.id)
      );
      return;
    }

    fetch("/api/peer-review").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setReviews(d); });
    fetch("/api/peer-review/nominate").then((r) => r.json()).then((noms) => {
      if (Array.isArray(noms)) {
        setNominations(noms);
        setSelectedUsers(noms.map((n: Nomination) => n.nominee.id));
      }
    });
    fetch("/api/users").then((r) => r.json()).then((users) => {
      if (Array.isArray(users)) setAllUsers(users);
    });
  }, [preview, previewRole, getData]);

  const saveNominations = async () => {
    if (preview) return;
    if (selectedUsers.length < 3) {
      toast.error("请至少选择3位评估人");
      return;
    }
    try {
      const res = await fetch("/api/peer-review/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomineeIds: selectedUsers }),
      });
      const result = await res.json();
      setNominations(result);
      toast.success("评估人提名已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const saveReview = async (review: PeerReview, action: "save" | "submit") => {
    if (preview) return;
    if (action === "submit") {
      if (!review.outputScore || !review.collaborationScore || !review.valuesScore) {
        toast.error("请完成所有必填评分（业绩产出、协作配合、价值观）");
        return;
      }
      if (!review.outputComment.trim() || !review.collaborationComment.trim() || !review.valuesComment.trim()) {
        toast.error("请填写所有必填维度的评语描述");
        return;
      }
      if (!confirm("提交后将无法修改，确认提交？")) return;
    }

    try {
      const res = await fetch("/api/peer-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...review, action }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "操作失败");
        return;
      }
      setReviews((prev) => prev.map((r) => (r.id === result.id ? { ...r, ...result } : r)));
      toast.success(action === "submit" ? "评估已提交" : "已保存");
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDecline = async () => {
    if (preview) return;
    if (!declineReason.trim()) {
      toast.error("请填写拒绝原因");
      return;
    }
    setDeclining(true);
    try {
      const res = await fetch("/api/peer-review/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: declineDialog.reviewId, reason: declineReason.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "操作失败");
        return;
      }
      setReviews((prev) => prev.map((r) => r.id === declineDialog.reviewId ? { ...r, status: "DECLINED", declineReason: declineReason.trim(), declinedAt: new Date().toISOString() } : r));
      setDeclineDialog({ open: false, reviewId: "", revieweeName: "" });
      setDeclineReason("");
      toast.success("已拒绝评估");
    } catch {
      toast.error("操作失败");
    } finally {
      setDeclining(false);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      (u.name.includes(searchQuery) || u.department.includes(searchQuery)) &&
      !selectedUsers.includes(u.id)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="360环评" description="邀请协作方参与互评，提交对同事的评估" />

      {/* 环评说明 */}
      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground divide-y">
          <div className="pb-3">
            <p className="text-sm font-semibold text-foreground mb-1">环评原则</p>
            <p className="leading-relaxed">员工自主邀请协作密切的相关方参与评估，需覆盖上级、平级、跨团队协作方。邀请人数不高于5人，重要/核心岗可邀请多于5人。评估人可拒绝但需说明原因。360环评采用匿名模式。</p>
          </div>
          <div className="py-3">
            <p className="text-sm font-semibold text-foreground mb-1">环评导向</p>
            <p className="leading-relaxed">360环评仅作为绩效考评参考依据，不直接换算为绩效，核心是为管理者提供多视角的员工画像，避免单一视角的评价偏差。</p>
          </div>
          <div className="pt-3">
            <p className="text-sm font-semibold text-foreground mb-1.5">评估维度</p>
            <div className="space-y-1 text-[11px]">
              <p><span className="font-medium text-foreground/70">业绩产出质量</span><span className="text-red-500 ml-1">必填</span> — 结合实际产出和对合作结果的贡献度综合评定</p>
              <p><span className="font-medium text-foreground/70">协作配合度</span><span className="text-red-500 ml-1">必填</span> — 结合周期内协作配合度综合评定</p>
              <p><span className="font-medium text-foreground/70">价值观践行</span><span className="text-red-500 ml-1">必填</span> — 选取ROOT 4条中的至少2条进行评估</p>
              <p><span className="font-medium text-foreground/70">创新能力、解决问题能力、组织贡献</span><span className="text-muted-foreground/60 ml-1">可选</span> — 围绕勾选的维度综合评定</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="nominate">
        <TabsList>
          <TabsTrigger value="nominate">提名评估人</TabsTrigger>
          <TabsTrigger value="review">我的环评任务 ({reviews.filter(r => r.status === "DRAFT").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="nominate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>选择360评估人</CardTitle>
              <CardDescription>
                邀请人数不少于3人、不高于5人，重要/核心岗可邀请多于5人。需覆盖上级、平级、跨团队协作方。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((uid) => {
                  const user = allUsers.find((u) => u.id === uid) || nominations.find((n) => n.nominee.id === uid)?.nominee;
                  if (!user) return null;
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1 py-1">
                      {user.name}
                      <button
                        onClick={() => setSelectedUsers((prev) => prev.filter((id) => id !== uid))}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                        disabled={preview}
                      >
                        x
                      </button>
                    </Badge>
                  );
                })}
              </div>

              <input
                  type="text"
                  placeholder="搜索同事姓名或部门..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm shadow-xs transition-all duration-[var(--transition-base)] hover:border-border focus:border-ring focus:shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/20"
                />

              {searchQuery && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 shadow-md">
                  {filteredUsers.slice(0, 10).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUsers((prev) => [...prev, u.id]);
                        setSearchQuery("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.department}</span>
                    </button>
                  ))}
                </div>
              )}

              <Button onClick={saveNominations} disabled={preview || selectedUsers.length < 3}>
                保存提名 ({selectedUsers.length}人)
              </Button>
            </CardContent>
          </Card>

          {nominations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>提名状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {nominations.map((n) => (
                    <div key={n.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{n.nominee.name} ({n.nominee.department})</span>
                      <NominationStatusBadges nomination={n} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                暂无待完成的环评任务
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => {
              const isDraft = review.status === "DRAFT";
              const isDeclined = review.status === "DECLINED";
              const isDisabled = !isDraft;

              return (
                <Card key={review.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        评估 {review.reviewee.name}
                        <span className="ml-2 text-sm font-normal text-gray-400">
                          {review.reviewee.department}
                        </span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isDraft && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={(e) => { e.stopPropagation(); setDeclineDialog({ open: true, reviewId: review.id, revieweeName: review.reviewee.name }); }}
                            disabled={preview}
                          >
                            拒绝评估
                          </Button>
                        )}
                        <Badge variant={review.status === "SUBMITTED" ? "default" : isDeclined ? "destructive" : "secondary"}>
                          {review.status === "SUBMITTED" ? "已提交" : isDeclined ? "已拒评" : "待完成"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isDeclined ? (
                      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                        拒绝原因：{review.declineReason}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          <div>
                            <label className="mb-1 block text-sm font-medium">业绩产出质量 <span className="text-red-500">*</span></label>
                            <p className="mb-2 text-xs text-gray-400">请结合员工周期内实际产出和对合作结果的贡献度综合评定，需提供数据/案例作证和描述</p>
                            <ScoreSelector
                              value={review.outputScore}
                              onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, outputScore: v } : r))}
                              disabled={isDisabled}
                            />
                            <Textarea
                              value={review.outputComment}
                              onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, outputComment: e.target.value } : r))}
                              placeholder="请提供数据或案例说明..."
                              rows={2}
                              className="mt-2"
                              disabled={isDisabled}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">协作配合度 <span className="text-red-500">*</span></label>
                            <p className="mb-2 text-xs text-gray-400">请结合员工周期内协作配合度综合评定，需提供数据/案例作证和描述</p>
                            <ScoreSelector
                              value={review.collaborationScore}
                              onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, collaborationScore: v } : r))}
                              disabled={isDisabled}
                            />
                            <Textarea
                              value={review.collaborationComment}
                              onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, collaborationComment: e.target.value } : r))}
                              placeholder="请提供数据或案例说明..."
                              rows={2}
                              className="mt-2"
                              disabled={isDisabled}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">价值观践行 <span className="text-red-500">*</span></label>
                            <p className="mb-1.5 text-xs text-gray-400">请选取以下4条中的至少2条进行评估，需提供数据/案例作证和描述</p>
                            <div className="mb-2 rounded-lg border border-border/50 p-2.5 text-[11px] text-muted-foreground divide-y">
                              <div className="pb-1.5">
                                <span className="font-medium text-foreground/70">坦诚真实</span> — 简单直接，对事不对人 · 敢于承认错误 · 暴露问题 · 不找借口，只找解法
                              </div>
                              <div className="py-1.5">
                                <span className="font-medium text-foreground/70">极致进取</span> — 目标明确，积极主动 · 用 demo 代替文档 · 敢于挑战更优解 · 深入体验，消灭锯齿
                              </div>
                              <div className="py-1.5">
                                <span className="font-medium text-foreground/70">成就利他</span> — 用户第一 · 信任伙伴，真诚合作 · 敏锐谦逊，ego 小，乐于贡献
                              </div>
                              <div className="pt-1.5">
                                <span className="font-medium text-foreground/70">ROOT</span> — 有 ownership，不踢皮球 · 独立思考，快速学习，与 AI 共同进化 · 关注结果而非过程 · Always Day 1
                              </div>
                            </div>
                            <ScoreSelector
                              value={review.valuesScore}
                              onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, valuesScore: v } : r))}
                              disabled={isDisabled}
                            />
                            <Textarea
                              value={review.valuesComment}
                              onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, valuesComment: e.target.value } : r))}
                              placeholder="请输入评语..."
                              rows={2}
                              className="mt-2"
                              disabled={isDisabled}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              创新能力、解决问题能力、组织贡献
                              <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500">可选</span>
                            </label>
                            <p className="mb-2 text-xs text-gray-400">勾选你要评估的维度，每个维度独立填写评语，需提供数据/案例作证和描述</p>
                            <div className="space-y-2">
                              {["创新能力", "解决问题能力", "组织贡献"].map((dim) => {
                                const checked = checkedDims[review.id]?.has(dim) ?? false;
                                return (
                                  <div key={dim}>
                                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-gray-300"
                                        checked={checked}
                                        disabled={isDisabled}
                                        onChange={() => {
                                          setCheckedDims((prev) => {
                                            const current = new Set(prev[review.id] || []);
                                            if (current.has(dim)) current.delete(dim); else current.add(dim);
                                            return { ...prev, [review.id]: current };
                                          });
                                        }}
                                      />
                                      <span className="font-medium">{dim}</span>
                                    </label>
                                    {checked && (
                                      <Textarea
                                        value={dimComments[review.id]?.[dim] || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setDimComments((prev) => ({
                                            ...prev,
                                            [review.id]: { ...prev[review.id], [dim]: val },
                                          }));
                                          // 同步拼接到 innovationComment
                                          const allComments = { ...dimComments[review.id], [dim]: val };
                                          const combined = Object.entries(allComments)
                                            .filter(([k]) => checkedDims[review.id]?.has(k))
                                            .map(([k, v]) => `【${k}】${v}`)
                                            .join("\n");
                                          setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, innovationComment: combined } : r));
                                        }}
                                        placeholder={`请针对「${dim}」提供数据或案例说明...`}
                                        rows={2}
                                        className="mt-1.5 ml-5"
                                        disabled={isDisabled}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {(checkedDims[review.id]?.size ?? 0) > 0 && (
                              <div className="mt-2">
                                <ScoreSelector
                                  value={review.innovationScore}
                                  onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, innovationScore: v } : r))}
                                  disabled={isDisabled}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {isDraft && (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => saveReview(review, "save")} disabled={preview}>
                              保存
                            </Button>
                            <Button size="sm" onClick={() => saveReview(review, "submit")} disabled={preview}>
                              提交
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* 拒绝评估对话框 */}
      <Dialog open={declineDialog.open} onOpenChange={(open) => { if (!open) { setDeclineDialog({ open: false, reviewId: "", revieweeName: "" }); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝评估 {declineDialog.revieweeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">拒绝后将无法恢复，请确认并填写拒绝原因。</p>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="请填写拒绝原因（必填）..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeclineDialog({ open: false, reviewId: "", revieweeName: "" }); setDeclineReason(""); }}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={declining || !declineReason.trim() || preview}>
              {declining ? "处理中..." : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PeerReviewPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <PeerReviewContent />
    </Suspense>
  );
}
