import { NextResponse } from "next/server";
import { buildAdminVerifyData } from "@/lib/admin-verify";
import { getSessionUser } from "@/lib/session";

function escapeCsv(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await buildAdminVerifyData();
    if (!data) {
      return NextResponse.json({ error: "No active cycle" }, { status: 400 });
    }

    const header = [
      "姓名",
      "部门",
      "直属上级",
      "360提名人数",
      "360提名是否达标",
      "360被评进度",
      "360被评是否完成",
      "360待评他人进度",
      "360待评他人是否完成",
      "当前初评人",
      "已提交初评人",
      "待提交初评人",
      "初评是否完成",
      "待跟进项",
    ];

    const lines = data.roster.map((row) =>
      [
        row.name,
        row.department || "",
        row.supervisor || "",
        row.peerNominationCount,
        row.peerNominationComplete ? "达标" : "不足",
        `${row.peerReviewReceivedSubmitted}/${row.peerReviewReceivedTotal}`,
        row.peerReviewReceivedComplete ? "已完成" : "未完成",
        `${row.peerReviewAssignedSubmitted}/${row.peerReviewAssignedTotal}`,
        row.peerReviewAssignedComplete ? "已完成" : "未完成",
        row.supervisorExpectedEvaluatorNames.join("、"),
        row.supervisorSubmittedEvaluatorNames.join("、"),
        row.supervisorPendingEvaluatorNames.join("、"),
        row.supervisorComplete ? "已完成" : "未完成",
        row.followUpSummary,
      ]
        .map((value) => escapeCsv(value))
        .join(",")
    );

    const csv = `\uFEFF${header.map((value) => escapeCsv(value)).join(",")}\n${lines.join("\n")}`;
    const fileName = `${data.cycleName}-进度核验花名册.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
