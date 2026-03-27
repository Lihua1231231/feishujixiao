"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Nav } from "@/components/nav";

type Props = {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
    canAccessFinalReview?: boolean;
  };
};

export function MobileNav({ user }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button onClick={() => setOpen(true)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">深度赋智</span>
      </div>

      {/* Drawer overlay */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-60 animate-in slide-in-from-left duration-200">
            <Nav user={user} />
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
