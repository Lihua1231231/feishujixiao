"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type DistributionDrawerProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function DistributionDrawer({
  title,
  description,
  children,
}: DistributionDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[28px] border p-5 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--cockpit-foreground)]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cockpit-muted-foreground)]">{description}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>
          {open ? "收起整体分布" : "查看整体分布"}
        </Button>
      </div>

      {open ? <div className="mt-5 grid gap-4 2xl:grid-cols-2">{children}</div> : null}
    </section>
  );
}
