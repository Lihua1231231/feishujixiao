import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { NavWrapper } from "./nav-wrapper";
import { PreviewBanner } from "./preview-banner";
import { Watermark } from "@/components/watermark";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getSessionUser();
  } catch (error) {
    console.error("MainLayout getSessionUser error:", error);
    redirect("/login");
  }
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen">
      <NavWrapper user={user} />
      <main className="flex-1 overflow-y-auto bg-background">
        <PreviewBanner />
        <div className="mx-auto max-w-[1200px] px-8 py-6">{children}</div>
      </main>
      <Watermark text={user.name} />
    </div>
  );
}
