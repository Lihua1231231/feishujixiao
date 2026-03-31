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
import type { ScoreNormalizationRaterBiasRow } from "./types";

type RaterBiasTableProps = {
  raterBiasRows: ScoreNormalizationRaterBiasRow[];
};

function formatSignedNumber(value: number | null) {
  if (value == null) return "—";
  const amount = Math.abs(value).toFixed(1);
  if (value > 0) return `+${amount}`;
  if (value < 0) return `-${amount}`;
  return "0.0";
}

export function RaterBiasTable({ raterBiasRows }: RaterBiasTableProps) {
  const visibleRows = raterBiasRows.slice(0, 12);
  const extraCount = Math.max(0, raterBiasRows.length - visibleRows.length);

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              const tone = row.tendency === "偏高" ? "warning" : row.tendency === "偏低" ? "info" : "secondary";
              return (
                <TableRow key={row.raterId}>
                  <TableCell className="font-medium text-foreground">{row.raterName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.raterDepartment || "—"}</TableCell>
                  <TableCell>{row.sampleCount}</TableCell>
                  <TableCell>{row.averageScore == null ? "—" : row.averageScore.toFixed(1)}</TableCell>
                  <TableCell>{formatSignedNumber(row.offset)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tone}>{row.tendency}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {extraCount > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">还有 {extraCount} 位评分人未展开。</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
