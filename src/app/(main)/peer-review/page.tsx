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
import { StarRating } from "@/components/star-rating";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";

type PeerReview = {
  id: string;
  reviewee: { id: string; name: string; department: string };
  // 新维度（与绩效初评一致）
  performanceStars: number | null;
  performanceComment: string;
  comprehensiveStars: number | null;
  learningStars: number | null;
  adaptabilityStars: number | null;
  abilityComment: string;
  candidStars: number | null;
  candidComment: string;
  progressStars: number | null;
  progressComment: string;
  altruismStars: number | null;
  altruismComment: string;
  rootStars: number | null;
  rootComment: string;
  // 旧字段保留
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

function ScoreSelector({ value, onChange, disabled, onUnclear }: { value: number | null; onChange: (v: number) => void; disabled: boolean; onUnclear?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
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
      {onUnclear && (
        <button
          onClick={() => !disabled && onUnclear()}
          disabled={disabled}
          className={`ml-2 flex h-9 items-center justify-center rounded-full px-3 text-sm transition-all duration-[var(--transition-fast)] ${
            value === 0
              ? "bg-gray-500 text-white shadow-md scale-105"
              : "border border-border/60 bg-background text-muted-foreground hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95"}`}
        >
          不清楚
        </button>
      )}
    </div>
  );
}

function NominationStatusBadges({ nomination }: { nomination: Nomination }) {
  if (nomination.supervisorStatus === "PENDING") {
    return <Badge variant="secondary">待审批</Badge>;
  }
  if (nomination.supervisorStatus === "REJECTED") {
    return <Badge variant="destructive">已拒绝</Badge>;
  }
  const nomineeLabel = nomination.nomineeStatus === "ACCEPTED" ? "已接受" : nomination.nomineeStatus === "DECLINED" ? "已拒绝" : "待接受";
  const nomineeVariant = nomination.nomineeStatus === "ACCEPTED" ? "default" as const : nomination.nomineeStatus === "DECLINED" ? "destructive" as const : "secondary" as const;
  return <Badge variant={nomineeVariant}>{nomineeLabel}</Badge>;
}

type ApprovalItem = {
  id: string;
  nominator: { id: string; name: string; department: string };
  nominee: { id: string; name: string; department: string };
  supervisorStatus: string;
};

function PeerReviewContent() {
  const { preview, previewRole, getData } = usePreview();
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [declineDialog, setDeclineDialog] = useState<{ open: boolean; reviewId: string; revieweeName: string }>({ open: false, reviewId: "", revieweeName: "" });
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNoms, setSavingNoms] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isApprover, setIsApprover] = useState(false);

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("peer-review") as Record<string, unknown>;
      setReviews((previewData.reviews as PeerReview[]) || []);
      setNominations((previewData.nominations as Nomination[]) || []);
      setSelectedUsers(
        ((previewData.nominations as Nomination[]) || []).map((n) => n.nominee.id)
      );
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    Promise.all([
      fetch("/api/peer-review", { signal }).then((r) => r.json()),
      fetch("/api/peer-review/nominate", { signal }).then((r) => r.json()),
      fetch("/api/users", { signal }).then((r) => r.json()),
    ]).then(([d, noms, users]) => {
      if (signal.aborted) return;
      if (Array.isArray(d)) setReviews(d);
      if (Array.isArray(noms)) {
        setNominations(noms);
        setSelectedUsers(noms.map((n: Nomination) => n.nominee.id));
      }
      if (Array.isArray(users)) setAllUsers(users);
    }).catch((e) => {
      if ((e as Error).name !== "AbortError") console.error(e);
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    // Load approvals for approvers
    fetch("/api/peer-review/approve", { signal }).then(r => r.json()).then(data => {
      if (signal.aborted) return;
      if (Array.isArray(data)) { setApprovals(data); setIsApprover(true); }
    }).catch(() => {});
    return () => controller.abort();
  }, [preview, previewRole, getData]);

  const saveNominations = async () => {
    if (preview) return;
    if (selectedUsers.length < 3) {
      toast.error("请至少选择3位评估人");
      return;
    }
    setSavingNoms(true);
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
    } finally {
      setSavingNoms(false);
    }
  };

  const saveReview = async (review: PeerReview, action: "save" | "submit") => {
    if (preview) return;
    if (action === "submit") {
      if (!review.performanceStars || !review.comprehensiveStars || !review.learningStars || !review.adaptabilityStars || !review.candidStars || !review.progressStars || !review.altruismStars || !review.rootStars) {
        toast.error("请完成所有维度的星级评分");
        return;
      }
      if (!confirm("提交后将无法修改，确认提交？")) return;
    }

    setSaving(true);
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
    } finally {
      setSaving(false);
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

  if (loading) return <FormPageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="360环评" />

      {/* 环评说明 */}
      <Card>
        <CardContent className="py-5 text-sm text-foreground/80 space-y-4">
          <div>
            <p className="font-semibold text-foreground mb-1">360 环评是什么？</p>
            <p className="leading-relaxed">360°评估(360°Feedback)，是指由评估人邀请被评估人从全方位各个维度来对自身进行评估的方式。被评估者可通过多种维度的反馈，清楚地知道自己的不足、长处与发展需求。</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">为什么要做 360 评估？</p>
            <ul className="list-disc pl-5 space-y-1 leading-relaxed">
              <li>了解公司中每个人的品行和绩效水平并提供建设性的反馈，让员工清楚公司对他工作的评价，知道领导对他的期望和要求，知道公司倡导的价值观，以及优秀员工的标准和要求是什么；</li>
              <li>帮助管理者了解自身管理水平，促进上级和下属员工的有效持续的沟通，提高管理绩效；</li>
              <li>为公司的薪酬决策、员工晋升降职、岗位调动、奖金等提供确切有用的依据。</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-2">怎么做 360 环评？</p>
            <div className="space-y-3 pl-1">
              <div>
                <p className="font-medium text-foreground mb-0.5">环评原则</p>
                <ul className="list-disc pl-5 space-y-0.5 leading-relaxed">
                  <li><span className="font-medium">范围：</span>员工自主邀请协作密切的相关方参与评估，确保评估维度全面。</li>
                  <li><span className="font-medium">人数：</span>邀请人数不少于5人（上级≧1、平级≧2、跨团队协作方≧2），重要/核心岗可邀请多于5人，邀请如果存在不合理，办公室/HR组会再补充邀请。</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">环评导向</p>
                <p className="leading-relaxed">360 环评仅作为绩效考评参考依据，不直接换算为绩效，核心是了解公司中每个人的品行和绩效水平并提供建设性的反馈，维护绩效考核公平。</p>
                <p className="leading-relaxed mt-1">评估人可拒绝评估邀请，但说明拒绝原因。为确保评估的真实性与有效性，360 环评采用匿名模式。</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">环评维度</p>
                <p className="leading-relaxed">业绩产出质量、协作配合度、价值观践行、创新能力、解决问题能力、团队贡献，评估人需结合实际协作经历给出具体评价与打分，禁止无依据的主观评价。</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="nominate">
        <TabsList>
          <TabsTrigger value="nominate">提名评估人</TabsTrigger>
          <TabsTrigger value="review">我的环评任务 ({reviews.filter(r => r.status === "DRAFT").length})</TabsTrigger>
          {isApprover && <TabsTrigger value="approve">审批提名 ({approvals.filter(a => a.supervisorStatus === "PENDING").length})</TabsTrigger>}
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

              <Button onClick={saveNominations} disabled={preview || savingNoms || selectedUsers.length < 3}>
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
          {reviews.length > 0 && (() => {
            const done = reviews.filter(r => r.status === "SUBMITTED" || r.status === "DECLINED").length;
            const total = reviews.length;
            const pct = Math.round((done / total) * 100);
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">完成进度</span>
                  <span className="font-medium">{done}/{total} ({pct}%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
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
                        <div className="space-y-6">
                          {/* 业绩产出 */}
                          <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                              <h3 className="text-sm font-semibold">业绩产出</h3>
                              <span className="text-xs text-muted-foreground">权重50%</span>
                            </div>
                            <StarRating value={review.performanceStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, performanceStars: v } : r))} disabled={isDisabled} />
                            <Textarea value={review.performanceComment || ""} onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, performanceComment: e.target.value } : r))} placeholder="请输入评语..." rows={2} disabled={isDisabled} />
                          </div>

                          {/* 个人能力 */}
                          <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                              <h3 className="text-sm font-semibold">个人能力</h3>
                              <span className="text-xs text-muted-foreground">权重30%（3项等权平均）</span>
                            </div>

                            <div className="space-y-3 rounded-lg border border-border/50 p-4">
                              <div className="space-y-1.5">
                                <p className="text-sm font-medium">综合能力 <span className="text-xs font-normal text-muted-foreground">— 问题分析与判断力 · 推动执行力 · 主动性与批判性思考</span></p>
                                <StarRating value={review.comprehensiveStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, comprehensiveStars: v } : r))} disabled={isDisabled} />
                              </div>
                              <div className="space-y-1.5 border-t pt-3">
                                <p className="text-sm font-medium">学习能力 <span className="text-xs font-normal text-muted-foreground">— 快速掌握新技能 · 举一反三 · 知识迁移与应用</span></p>
                                <StarRating value={review.learningStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, learningStars: v } : r))} disabled={isDisabled} />
                              </div>
                              <div className="space-y-1.5 border-t pt-3">
                                <p className="text-sm font-medium">适应能力 <span className="text-xs font-normal text-muted-foreground">— 面对变化快速调整，持续有效产出</span></p>
                                <StarRating value={review.adaptabilityStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, adaptabilityStars: v } : r))} disabled={isDisabled} />
                              </div>
                            </div>
                            <Textarea value={review.abilityComment || ""} onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, abilityComment: e.target.value } : r))} placeholder="请结合以上三项综合评定..." rows={2} disabled={isDisabled} />
                          </div>

                          {/* 价值观 */}
                          <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                              <h3 className="text-sm font-semibold">价值观</h3>
                              <span className="text-xs text-muted-foreground">权重20%（4项等权平均）</span>
                            </div>

                            <div className="space-y-4 rounded-lg border border-border/50 p-4">
                              <div className="space-y-1.5">
                                <p className="text-sm font-medium">坦诚真实 <span className="text-xs font-normal text-muted-foreground">Be candid and honest — 行为基础</span></p>
                                <p className="text-[11px] text-muted-foreground">简单直接，对事不对人 · 敢于承认错误，不装不爱面子 · 暴露问题，不向上管理 · 不找借口，只找解法</p>
                                <StarRating value={review.candidStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, candidStars: v } : r))} disabled={isDisabled} />
                                <Textarea value={review.candidComment || ""} onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, candidComment: e.target.value } : r))} placeholder="请输入评语..." rows={2} disabled={isDisabled} />
                              </div>
                              <div className="space-y-1.5 border-t pt-4">
                                <p className="text-sm font-medium">极致进取 <span className="text-xs font-normal text-muted-foreground">Move fast, aim higher — 动机驱动</span></p>
                                <p className="text-[11px] text-muted-foreground">目标明确，积极主动 · 用 demo 代替文档，用行动代替沟通 · 敢于挑战更优解，用实验代替争论 · 深入体验，消灭锯齿</p>
                                <StarRating value={review.progressStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, progressStars: v } : r))} disabled={isDisabled} />
                                <Textarea value={review.progressComment || ""} onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, progressComment: e.target.value } : r))} placeholder="请输入评语..." rows={2} disabled={isDisabled} />
                              </div>
                              <div className="space-y-1.5 border-t pt-4">
                                <p className="text-sm font-medium">成就利他 <span className="text-xs font-normal text-muted-foreground">Build together, win together — 协作胸怀</span></p>
                                <p className="text-[11px] text-muted-foreground">用户第一，以用户成功为价值 · 内心阳光，信任伙伴，真诚合作 · 敏锐谦逊，ego 小，乐于贡献</p>
                                <StarRating value={review.altruismStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, altruismStars: v } : r))} disabled={isDisabled} />
                                <Textarea value={review.altruismComment || ""} onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, altruismComment: e.target.value } : r))} placeholder="请输入评语..." rows={2} disabled={isDisabled} />
                              </div>
                              <div className="space-y-1.5 border-t pt-4">
                                <p className="text-sm font-medium">ROOT <span className="text-xs font-normal text-muted-foreground">组织导向</span></p>
                                <p className="text-[11px] text-muted-foreground">有 ownership，不踢皮球，不设边界 · 独立思考，快速学习，与 AI 共同进化 · 关注结果而非过程 · 始终像公司创业第一天那样思考</p>
                                <StarRating value={review.rootStars} onChange={(v) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, rootStars: v } : r))} disabled={isDisabled} />
                                <Textarea value={review.rootComment || ""} onChange={(e) => setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, rootComment: e.target.value } : r))} placeholder="请输入评语..." rows={2} disabled={isDisabled} />
                              </div>
                            </div>
                          </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {isDraft && (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => saveReview(review, "save")} disabled={preview || saving}>
                              保存
                            </Button>
                            <Button size="sm" onClick={() => saveReview(review, "submit")} disabled={preview || saving}>
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

        {isApprover && (
          <TabsContent value="approve" className="space-y-4">
            {approvals.filter(a => a.supervisorStatus === "PENDING").length === 0 && approvals.length > 0 && (
              <Card><CardContent className="py-8 text-center text-gray-500">所有提名已审批完成</CardContent></Card>
            )}
            {approvals.length === 0 && (
              <Card><CardContent className="py-8 text-center text-gray-500">暂无提名需要审批</CardContent></Card>
            )}
            {(() => {
              // Group by nominator
              const byNominator: Record<string, typeof approvals> = {};
              approvals.forEach(a => {
                const key = a.nominator.name;
                if (!byNominator[key]) byNominator[key] = [];
                byNominator[key].push(a);
              });
              return Object.entries(byNominator).map(([name, items]) => {
                const pending = items.filter(i => i.supervisorStatus === "PENDING").length;
                return (
                  <Card key={name}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {name}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          ({items[0].nominator.department}) — 提名 {items.length} 人
                          {pending > 0 && <Badge variant="secondary" className="ml-2">{pending} 待审批</Badge>}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span>{item.nominee.name} ({item.nominee.department})</span>
                            <div className="flex items-center gap-2">
                              {item.supervisorStatus === "PENDING" ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-red-600 hover:bg-red-50"
                                    disabled={preview}
                                    onClick={async () => {
                                      await fetch("/api/peer-review/approve", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ nominationId: item.id, action: "reject" }),
                                      });
                                      setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, supervisorStatus: "REJECTED" } : a));
                                    }}
                                  >
                                    拒绝
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={preview}
                                    onClick={async () => {
                                      await fetch("/api/peer-review/approve", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ nominationId: item.id, action: "approve" }),
                                      });
                                      setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, supervisorStatus: "APPROVED" } : a));
                                    }}
                                  >
                                    批准
                                  </Button>
                                </>
                              ) : (
                                <Badge variant={item.supervisorStatus === "APPROVED" ? "default" : "destructive"}>
                                  {item.supervisorStatus === "APPROVED" ? "已批准" : "已拒绝"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </TabsContent>
        )}
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
