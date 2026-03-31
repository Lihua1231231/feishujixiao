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
import type { ManagerReviewNormalizationRaterBiasRow } from "./types";

type RaterBiasTableProps = {
  raterBiasRows: ManagerReviewNormalizationRaterBiasRow[];
};

function formatSignedNumber(value: number | null) {
  if (value == null) return "—";
  const amount = Math.abs(value).toFixed(1);
  if (value > 0) return `+${amount}`;
  if (value < 0) return `-${amount}`;
  return "0.0";
}

export function RaterBiasTable({ raterBiasRows }: RaterBiasTableProps) {
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
        <CardTitle className="text-base text-foreground">评分倾向偏差</CardTitle>
        <CardDescription className="text-muted-foreground">
          这里看的是实际评分人，而不是星级桶。偏高和偏低都按人来标出来，方便直接定位异常评分人。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>评分人</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>样本数</TableHead>
              <TableHead>平均分</TableHead>
              <TableHead>偏移</TableHead>
              <TableHead className="text-right">倾向</TableHead>
              <TableHead className="text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {raterBiasRows.map((row) => {
              const tone = row.tendency === "偏高" ? "warning" : row.tendency === "偏低" ? "info" : "secondary";
              const expanded = expandedRows[row.raterId] ?? false;
              const detailSummary =
                row.tendency === "偏高"
                  ? "这位评分人的平均分明显高于整体口径，后续应用校准后会被压回目标分布。"
                  : row.tendency === "偏低"
                    ? "这位评分人的平均分明显低于整体口径，后续应用校准后会被抬回目标分布。"
                    : "这位评分人的平均分和整体口径接近，校准前后不会有明显偏移。";
              return (
                <Fragment key={row.raterId}>
                  <TableRow>
                    <TableCell className="font-medium text-foreground">{row.raterName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.raterDepartment || "—"}</TableCell>
                    <TableCell>{row.sampleCount}</TableCell>
                    <TableCell>{row.averageScore == null ? "—" : row.averageScore.toFixed(1)}</TableCell>
                    <TableCell>{formatSignedNumber(row.offset)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={tone}>{row.tendency}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.raterId)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {expanded ? "收起详情" : "展开详情"}
                      </button>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={7} className="space-y-3 py-4">
                        <p className="text-sm text-foreground">{detailSummary}</p>
                        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                          <div>
                            <p className="font-medium text-foreground">样本量</p>
                            <p>{row.sampleCount} 条</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">平均分偏移</p>
                            <p>{formatSignedNumber(row.offset)}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">当前判断</p>
                            <p>{row.isAbnormal ? `异常：${row.tendency}` : "处于正常范围"}</p>
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

