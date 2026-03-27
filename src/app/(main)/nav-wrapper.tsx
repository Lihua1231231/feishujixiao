"use client";

import { Suspense } from "react";
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

export function NavWrapper({ user }: Props) {
  return (
    <Suspense>
      <Nav user={user} />
    </Suspense>
  );
}
