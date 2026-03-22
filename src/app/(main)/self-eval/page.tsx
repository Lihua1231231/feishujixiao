"use client";

import { useEffect, useState, Suspense } from "react";
import { FormPageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { usePreview } from "@/hooks/use-preview";

type SelfEvalData = {
  importedContent: string;
  importedAt: string | null;
  sourceUrl: string | null;
  status: string;
};

type CycleInfo = {
  id: string;
  selfEvalStart: string | null;
  selfEvalEnd: string | null;
  status: string;
};

function SelfEvalContent() {
  const { preview, previewRole, getData } = usePreview();
  const [data, setData] = useState<SelfEvalData | null>(null);
  const [selfEvalStart, setSelfEvalStart] = useState<string | null>(null);
  const [selfEvalEnd, setSelfEvalEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("self-eval") as Record<string, unknown>;

      if (previewRole === "EMPLOYEE") {
        setData(previewData as unknown as SelfEvalData);
      } else {
        // 主管/管理员视角：显示提示信息
        setData(null);
      }
      setLoading(false);
      return;
    }

    // 获取活跃周期的截止日期
    fetch("/api/admin/cycle")
      .then((r) => r.json())
      .then((cycles: CycleInfo[]) => {
        if (Array.isArray(cycles)) {
          const activeCycle = cycles.find((c) => c.status !== "ARCHIVED");
          if (activeCycle?.selfEvalStart) {
            setSelfEvalStart(activeCycle.selfEvalStart);
          }
          if (activeCycle?.selfEvalEnd) {
            setSelfEvalEnd(activeCycle.selfEvalEnd);
          }
        }
      })
      .catch(() => {
        // 获取失败则不显示截止日期
      });

    fetch("/api/self-eval")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.importedContent) {
          setData(d);
        }
      })
      .finally(() => setLoading(false));
  }, [preview, previewRole, getData]);

  if (loading) {
    return <FormPageSkeleton />;
  }

  // 预览模式下非员工角色的视图
  if (preview && previewRole && previewRole !== "EMPLOYEE") {
    const previewData = getData("self-eval") as { viewType: string; message: string };
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="个人自评"
          description={previewRole === "SUPERVISOR" ? "主管视角" : "管理员视角"}
        />
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {previewData.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isImported = data && data.importedContent;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="个人自评"
        description={isImported ? "自评内容已导入" : "通过飞书多维表格提交周期工作总结"}
        actions={
          <Badge variant={isImported ? "default" : "secondary"}>
            {isImported
              ? data.status === "SUBMITTED"
                ? "已确认"
                : "已导入"
              : "未导入"}
          </Badge>
        }
      />

      {isImported ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>自评内容</CardTitle>
              <CardDescription>
                导入时间：{data.importedAt ? new Date(data.importedAt).toLocaleString("zh-CN") : "-"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-xl bg-muted/50 p-5 text-sm leading-relaxed text-foreground/80">
                {data.importedContent}
              </div>
            </CardContent>
          </Card>

          {data.sourceUrl && (
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <span className="text-sm text-gray-500">原始文档：</span>
                <a
                  href={preview ? undefined : data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline hover:text-blue-800"
                  onClick={preview ? (e) => e.preventDefault() : undefined}
                >
                  {data.sourceUrl}
                </a>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>提交周期工作总结</CardTitle>
              <CardDescription>
                使用述职工作总结模板，通过飞书多维表格提交，提交后由HR统一批量导入系统
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-info/20 bg-info/[0.04] p-4">
                <p className="text-sm text-info/90">
                  请点击下方按钮前往飞书表单填写并提交你的周期工作总结。支持使用述职工作总结模板或自定义模板。提交后，HR会统一将内容批量导入绩效系统。
                </p>
              </div>

              <a
                href="https://deepwisdom.feishu.cn/share/base/form/shrcnCS3SrdluG2wmoTlDeWBAhh"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full" disabled={preview}>
                  前往提交自评
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">员工个人职责</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  自主制定个人 OKR，完成与上级、协作方的目标对齐
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  按要求提交周期工作总结，完整举证工作产出与价值贡献
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  完成 360 度评估的邀请与互评工作
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  接收绩效反馈，制定并执行个人绩效改进与发展计划
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  对绩效结果有异议时，按规则提交申诉
                </li>
              </ul>
            </CardContent>
          </Card>

          {(selfEvalStart || selfEvalEnd) && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>自评时间：<strong>{selfEvalStart ? selfEvalStart.slice(0, 10) : ""} 至 {selfEvalEnd ? selfEvalEnd.slice(0, 10) : ""}</strong>（一周含周日）</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function SelfEvalPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <SelfEvalContent />
    </Suspense>
  );
}
