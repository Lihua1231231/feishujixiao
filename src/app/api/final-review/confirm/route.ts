import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "普通员工官方结果已改为自动生成，请让承霖、邱翔完成双人校准。" },
    { status: 410 },
  );
}
