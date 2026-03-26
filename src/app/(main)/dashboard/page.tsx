"use client";

import { useEffect, useState, Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ClipboardList, Users, UserCheck, BarChart3, MessageSquare, MessageSquareWarning, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePreview } from "@/hooks/use-preview";

const statusLabels: Record<string, string> = {
  DRAFT: "未开始",
  SELF_EVAL: "个人自评中",
  PEER_REVIEW: "360环评中",
  SUPERVISOR_EVAL: "上级评估中",
  CALIBRATION: "绩效校准中",
  MEETING: "面谈中",
  APPEAL: "申诉中",
  ARCHIVED: "已归档",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-50 text-gray-600",
  SELF_EVAL: "bg-blue-50 text-blue-700",
  PEER_REVIEW: "bg-violet-50 text-violet-700",
  SUPERVISOR_EVAL: "bg-orange-50 text-orange-700",
  CALIBRATION: "bg-amber-50 text-amber-700",
  MEETING: "bg-emerald-50 text-emerald-700",
  APPEAL: "bg-rose-50 text-rose-700",
  ARCHIVED: "bg-gray-50 text-gray-500",
};

type CardItem = {
  href: string;
  icon: typeof ClipboardList;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  accent: string;
};

type DashboardData = {
  user: { name: string; role: string };
  cycle: { name: string; status: string } | null;
  selfEvalStatus: string | null;
  pendingPeerReviews: number;
  pendingTeamEvals: number;
  hasAppeal: boolean;
};

function DashboardContent() {
  const { preview, previewRole, getData } = usePreview();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("dashboard") as DashboardData;
      setData(previewData);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadData() {
      try {
        const [selfEvalRes, userRes] = await Promise.all([
          fetch("/api/self-eval", { signal: controller.signal }),
          fetch("/api/users?me=true", { signal: controller.signal }),
        ]);
        const [selfEval, userData] = await Promise.all([
          selfEvalRes.json(),
          userRes.json(),
        ]);

        if (controller.signal.aborted) return;
        setData({
          user: { name: userData.name || "用户", role: userData.role || "EMPLOYEE" },
          cycle: userData.cycle || null,
          selfEvalStatus: selfEval?.status || null,
          pendingPeerReviews: userData.pendingPeerReviews || 0,
          pendingTeamEvals: userData.pendingTeamEvals || 0,
          hasAppeal: userData.hasAppeal || false,
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadData();
    return () => controller.abort();
  }, [preview, previewRole, getData]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          无法加载数据
        </CardContent>
      </Card>
    );
  }

  const isSupervisor = ["SUPERVISOR", "HRBP", "ADMIN"].includes(data.user.role);
  const isAdmin = ["HRBP", "ADMIN"].includes(data.user.role);

  // 预览模式的链接带 preview 参数
  function buildHref(href: string): string {
    if (!preview) return href;
    return `${href}?preview=${previewRole}`;
  }

  const cards: CardItem[] = [
    {
      href: buildHref("/self-eval"),
      icon: ClipboardList,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      title: "个人自评",
      description: "已提交",
      accent: "group-hover:border-blue-200",
    },
    {
      href: buildHref("/peer-review"),
      icon: Users,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      title: "360环评",
      description: data.pendingPeerReviews > 0 ? `${data.pendingPeerReviews} 条待完成` : "暂无待办",
      accent: "group-hover:border-violet-200",
    },
    ...(isSupervisor
      ? [
          {
            href: buildHref("/team"),
            icon: UserCheck,
            iconColor: "text-orange-600",
            iconBg: "bg-orange-50",
            title: "绩效初评",
            description: data.pendingTeamEvals > 0 ? `${data.pendingTeamEvals} 条待完成` : "暂无待办",
            accent: "group-hover:border-orange-200",
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: buildHref("/calibration"),
            icon: BarChart3,
            iconColor: "text-amber-600",
            iconBg: "bg-amber-50",
            title: "绩效校准",
            description: "查看与调整绩效等级",
            accent: "group-hover:border-amber-200",
          },
        ]
      : []),
    ...(isSupervisor
      ? [
          {
            href: buildHref("/meetings"),
            icon: MessageSquare,
            iconColor: "text-emerald-600",
            iconBg: "bg-emerald-50",
            title: "面谈记录",
            description: "记录绩效面谈",
            accent: "group-hover:border-emerald-200",
          },
        ]
      : []),
    ...(data.hasAppeal
      ? [
          {
            href: buildHref("/appeal"),
            icon: MessageSquareWarning,
            iconColor: "text-rose-600",
            iconBg: "bg-rose-50",
            title: "绩效申诉",
            description: isAdmin ? "查看与处理申诉" : "对绩效结果提出申诉",
            accent: "group-hover:border-rose-200",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent px-8 py-7">
        <div className="relative z-10">
          <h1 className="text-2xl font-semibold tracking-tight">你好，{data.user.name}</h1>
          {data.cycle && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">当前周期：{data.cycle.name}</span>
              <Badge className={statusColors[data.cycle.status] || statusColors.DRAFT}>
                {statusLabels[data.cycle.status] || data.cycle.status}
              </Badge>
            </div>
          )}
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/[0.04]" />
        <div className="absolute -bottom-6 right-20 h-24 w-24 rounded-full bg-primary/[0.03]" />
      </div>

      {!data.cycle && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">暂无进行中的考核周期</p>
            {data.user.role === "ADMIN" && (
              <p className="mt-3">
                <Link href={buildHref("/admin")} className="text-sm font-medium text-primary hover:underline">
                  前往创建考核周期
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {data.cycle && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const inner = (
              <Card className={`group cursor-pointer transition-all duration-[var(--transition-base)] hover:-translate-y-0.5 hover:shadow-md ${card.accent}`}>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-all duration-[var(--transition-base)] group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </CardContent>
              </Card>
            );
            return preview ? (
              <a key={card.href} href={card.href}>{inner}</a>
            ) : (
              <Link key={card.href} href={card.href}>{inner}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
