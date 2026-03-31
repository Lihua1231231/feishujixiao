"use client";

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
  const visibleRows = movementRows.slice(0, 12);
  const extraCount = Math.max(0, movementRows.length - visibleRows.length);

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
              <TableHead>normalizedBucket</TableHead>
              <TableHead>rankDelta</TableHead>
              <TableHead className="text-right">变化方向</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              const tone = row.movementLabel === "上调" ? "success" : row.movementLabel === "下调" ? "warning" : "secondary";
              return (
                <TableRow key={row.sourceRecordId}>
                  <TableCell className="font-medium text-foreground">{row.subjectName || row.subjectId}</TableCell>
                  <TableCell className="text-muted-foreground">{row.subjectDepartment || "—"}</TableCell>
                  <TableCell>{row.rawScore == null ? "—" : row.rawScore.toFixed(1)}</TableCell>
                  <TableCell>{row.rawBucket == null ? "—" : `${row.rawBucket} 星`}</TableCell>
                  <TableCell>{row.normalizedBucket == null ? "—" : `${row.normalizedBucket} 星`}</TableCell>
                  <TableCell>{formatSignedNumber(row.rankDelta)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tone}>{row.movementLabel}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {extraCount > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">还有 {extraCount} 条变化明细未展开。</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
