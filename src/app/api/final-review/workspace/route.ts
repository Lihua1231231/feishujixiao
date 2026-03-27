import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { buildFinalReviewWorkspacePayload } from "@/lib/final-review";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await buildFinalReviewWorkspacePayload(user);
    if (!payload.canAccess) {
      return NextResponse.json({ error: "Forbidden", ...payload }, { status: 403 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
