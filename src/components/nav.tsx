"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Users,
  UserCheck,
  BarChart3,
  MessageSquare,
  MessageSquareWarning,
  Settings,
  LogOut,
  Home,
  BookOpen,
  Lock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavProps = {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
    canAccessFinalReview?: boolean;
  };
};

const navItems = [
  { href: "/guide", label: "使用指南", icon: BookOpen, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/dashboard", label: "首页", icon: Home, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/self-eval", label: "个人自评", icon: ClipboardList, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"], availableUntil: "2026-03-24T23:59:59" },
  { href: "/peer-review", label: "360环评", icon: Users, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/team", label: "绩效初评", icon: UserCheck, roles: ["SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/calibration", label: "绩效校准", icon: BarChart3, roles: ["HRBP", "ADMIN"] },
  { href: "/meetings", label: "面谈记录", icon: MessageSquare, roles: ["SUPERVISOR", "HRBP", "ADMIN"], availableFrom: "2026-03-30T00:00:00" },
  { href: "/appeal", label: "绩效申诉", icon: MessageSquareWarning, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"], availableFrom: "2026-03-30T00:00:00" },
  { href: "/admin", label: "系统管理", icon: Settings, roles: ["ADMIN"] },
];

export function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const activeRole = user.role;
  const now = new Date();
  const visibleItems = navItems
    .filter((item) => {
      if (item.href === "/calibration") {
        return item.roles.includes(activeRole) || Boolean(user.canAccessFinalReview);
      }
      return item.roles.includes(activeRole);
    })
    .map((item) => {
      const av = item as typeof item & { availableUntil?: string };
      const lockedBefore = !!(item.availableFrom && activeRole !== "ADMIN" && now < new Date(item.availableFrom));
      const lockedAfter = !!(av.availableUntil && activeRole !== "ADMIN" && now > new Date(av.availableUntil));
      const locked = lockedBefore || lockedAfter;
      return { ...item, locked };
    });

  return (
    <nav className="flex h-screen w-60 flex-col bg-card shadow-[1px_0_0_0_var(--border),4px_0_16px_rgba(0,0,0,0.03)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
          <BarChart3 className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight tracking-tight">深度赋智</span>
          <span className="text-[11px] font-medium leading-tight text-muted-foreground">2025下半年绩效考评</span>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = !item.locked && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));

            if (item.locked) {
              return (
                <span
                  key={item.href}
                  className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground/40 cursor-not-allowed"
                  title="已结束"
                >
                  <Icon className="h-[18px] w-[18px] text-muted-foreground/30" />
                  {item.label}
                  <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground/30" />
                </span>
              );
            }

            const classes = cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-[var(--transition-base)]",
              isActive
                ? "bg-primary/[0.08] text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            );
            const indicator = isActive ? (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
            ) : null;
            return (
              <Link key={item.href} href={item.href} className={classes}>
                {indicator}
                <Icon className={cn("h-[18px] w-[18px] transition-colors duration-[var(--transition-base)]", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User info */}
      <div className="mx-3 border-t border-border/60 p-2 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 transition-colors duration-[var(--transition-base)] hover:bg-muted">
            <Avatar className="h-8 w-8 ring-2 ring-border/50">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{user.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-medium leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {{ ADMIN: "管理员", HRBP: "HRBP", SUPERVISOR: "主管", EMPLOYEE: "员工" }[user.role]}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <Link href="/api/auth/signout" className="flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
