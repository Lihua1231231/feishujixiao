"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScoreNormalizationMovementRow } from "./types";

type ChangePreviewTableProps = {
  movementRows: ScoreNormalizationMovementRow[];
};

function formatSignedNumber(value: number | null) {
  if (value == null) return "—";
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export function ChangePreviewTable({ movementRows }: ChangePreviewTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (rowId: string) => {
    setExpandedRows((current) => ({
      ...current,
      [rowId]: !current[rowId],
    }));
  };

  return (
    <Card className="rounded-[28px] border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-foreground">变化明细预览</CardTitle>
        <CardDescription className="text-muted-foreground">
          这里列出标准化后会升档、降档或保持不变的人员，先确认变化人数和变化方向。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>原始分</TableHead>
              <TableHead>原始分桶</TableHead>
              <TableHead>标准化分桶</TableHead>
              <TableHead>排名变化</TableHead>
              <TableHead className="text-right">变化方向</TableHead>
              <TableHead className="text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movementRows.map((row) => {
              const tone = row.movementLabel === "上调" ? "success" : row.movementLabel === "下调" ? "warning" : "secondary";
              const expanded = expandedRows[row.sourceRecordId] ?? false;
              const detailSummary =
                row.movementLabel === "上调"
                  ? "标准化结果高于原始分桶，后续模拟排名会上升。"
                  : row.movementLabel === "下调"
                    ? "标准化结果低于原始分桶，后续模拟排名会下降。"
                    : row.movementLabel === "不变"
                      ? "标准化结果与原始分桶一致，排名口径没有变化。"
                      : "当前样本不足或结果待定，暂时无法给出稳定的分桶变化。";
              return (
                <Fragment key={row.sourceRecordId}>
                  <TableRow>
                    <TableCell className="font-medium text-foreground">{row.subjectName || row.subjectId}</TableCell>
                    <TableCell className="text-muted-foreground">{row.subjectDepartment || "—"}</TableCell>
                    <TableCell>{row.rawScore == null ? "—" : row.rawScore.toFixed(1)}</TableCell>
                    <TableCell>{row.rawBucket == null ? "—" : `${row.rawBucket} 星`}</TableCell>
                    <TableCell>{row.normalizedBucket == null ? "—" : `${row.normalizedBucket} 星`}</TableCell>
                    <TableCell>{formatSignedNumber(row.rankDelta)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={tone}>{row.movementLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.sourceRecordId)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {expanded ? "收起详情" : "展开详情"}
                      </button>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={8} className="space-y-3 py-4">
                        <p className="text-sm text-foreground">{detailSummary}</p>
                        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                          <div>
                            <p className="font-medium text-foreground">原始排名</p>
                            <p>{row.rankIndex == null ? "—" : `第 ${row.rankIndex + 1} 位`}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">标准化分桶</p>
                            <p>{row.normalizedBucket == null ? "—" : `${row.normalizedBucket} 星`}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">排名变化</p>
                            <p>{formatSignedNumber(row.rankDelta)}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
