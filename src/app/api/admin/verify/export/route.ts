import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { buildAdminVerifyData } from "@/lib/admin-verify";
import { getSessionUser } from "@/lib/session";

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
      "待完成360评价人",
      "360待评他人进度",
      "360待评他人是否完成",
      "待完成360评价对象",
      "360原始均分",
      "360标准化分",
      "当前初评人",
      "已提交初评人",
      "待提交初评人",
      "初评原始加权分",
      "初评标准化分",
      "初评原始等级",
      "初评标准化等级",
      "初评是否完成",
      "待跟进项",
    ];

    const rosterRows = data.roster.map((row) =>
      [
        row.name,
        row.department || "",
        row.supervisor || "",
        row.peerNominationCount,
        row.peerNominationComplete ? "达标" : "不足",
        `${row.peerReviewReceivedSubmitted}/${row.peerReviewReceivedTotal}`,
        row.peerReviewReceivedComplete ? "已完成" : "未完成",
        row.peerReviewReceivedPendingReviewerNames.join("、"),
        `${row.peerReviewAssignedSubmitted}/${row.peerReviewAssignedTotal}`,
        row.peerReviewAssignedComplete ? "已完成" : "未完成",
        row.peerReviewAssignedPendingRevieweeNames.join("、"),
        row.rawPeerReviewScore != null ? row.rawPeerReviewScore.toFixed(1) : "",
        row.normalizedPeerReviewScore != null ? row.normalizedPeerReviewScore.toFixed(1) : "",
        row.supervisorExpectedEvaluatorNames.join("、"),
        row.supervisorSubmittedEvaluatorNames.join("、"),
        row.supervisorPendingEvaluatorNames.join("、"),
        row.rawSupervisorScore != null ? row.rawSupervisorScore.toFixed(1) : "",
        row.normalizedSupervisorScore != null ? row.normalizedSupervisorScore.toFixed(1) : "",
        row.rawSupervisorStars != null ? `${row.rawSupervisorStars}星` : "",
        row.normalizedSupervisorStars != null ? `${row.normalizedSupervisorStars}星` : "",
        row.supervisorComplete ? "已完成" : "未完成",
        row.followUpSummary,
      ]
    );

    const followUpHeader = [
      "姓名",
      "部门",
      "还需360环评人数",
      "还需360环评对象",
      "还需初评人数",
      "还需初评对象",
    ];

    const followUpRows = data.followUpSheetRows.map((row) => [
      row.name,
      row.department || "",
      row.pendingPeerReviewCount,
      row.pendingPeerReviewRevieweeNames.join("、"),
      row.pendingSupervisorEvalCount,
      row.pendingSupervisorEvalEmployeeNames.join("、"),
    ]);

    const workbook = XLSX.utils.book_new();
    const rosterSheet = XLSX.utils.aoa_to_sheet([header, ...rosterRows]);
    const followUpSheet = XLSX.utils.aoa_to_sheet([followUpHeader, ...followUpRows]);
    XLSX.utils.book_append_sheet(workbook, rosterSheet, "Sheet1-数据核验表");
    XLSX.utils.book_append_sheet(workbook, followUpSheet, "Sheet2-HR催办表");

    const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const fileName = `${data.cycleName}-进度核验花名册.xlsx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
