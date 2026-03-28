import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "主管层官方结果已改为自动生成，请让承霖、邱翔完成双人问卷提交。" },
    { status: 410 },
  );
}
