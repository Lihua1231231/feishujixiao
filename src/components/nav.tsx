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
  Eye,
  EyeOff,
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
import { usePreview } from "@/hooks/use-preview";
import type { PreviewRole } from "@/lib/preview";

type NavProps = {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
  };
};

const navItems = [
  { href: "/guide", label: "使用指南", icon: BookOpen, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/dashboard", label: "首页", icon: Home, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/self-eval", label: "个人自评", icon: ClipboardList, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/peer-review", label: "360环评", icon: Users, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/team", label: "绩效初评", icon: UserCheck, roles: ["SUPERVISOR", "HRBP", "ADMIN"] },
  { href: "/calibration", label: "绩效校准", icon: BarChart3, roles: ["HRBP", "ADMIN"] },
  { href: "/meetings", label: "面谈记录", icon: MessageSquare, roles: ["SUPERVISOR", "HRBP", "ADMIN"], availableFrom: "2026-03-30T00:00:00" },
  { href: "/appeal", label: "绩效申诉", icon: MessageSquareWarning, roles: ["EMPLOYEE", "SUPERVISOR", "HRBP", "ADMIN"], availableFrom: "2026-03-30T00:00:00" },
  { href: "/admin", label: "系统管理", icon: Settings, roles: ["ADMIN"] },
];

const previewRoles: { role: PreviewRole; label: string }[] = [
  { role: "EMPLOYEE", label: "员工视角" },
  { role: "SUPERVISOR", label: "主管视角" },
  { role: "ADMIN", label: "管理员视角" },
];

export function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const { preview, previewRole, enterPreview, exitPreview } = usePreview();

  // 预览模式下用预览角色过滤菜单，否则用真实角色
  const activeRole = previewRole ?? user.role;
  const now = new Date();
  const visibleItems = navItems
    .filter((item) => item.roles.includes(activeRole))
    .map((item) => {
      const locked = !!(item.availableFrom && activeRole !== "ADMIN" && now < new Date(item.availableFrom));
      return { ...item, locked };
    });

  // 构造带preview参数的链接
  function buildHref(href: string): string {
    if (!preview) return href;
    return `${href}?preview=${previewRole}`;
  }

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
                  title="未到开放时间"
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
            return preview ? (
              <a key={item.href} href={buildHref(item.href)} className={classes}>
                {indicator}
                <Icon className={cn("h-[18px] w-[18px] transition-colors duration-[var(--transition-base)]", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={classes}>
                {indicator}
                <Icon className={cn("h-[18px] w-[18px] transition-colors duration-[var(--transition-base)]", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 角色预览区域 - 仅管理员可见 */}
      {user.role === "ADMIN" && (
        <div className="mx-3 border-t border-border/60 px-1 py-3">
          <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {preview ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            <span>角色预览</span>
          </div>
          <div className="space-y-0.5">
            {previewRoles.map(({ role, label }) => (
              <button
                key={role}
                onClick={() => enterPreview(role)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all duration-[var(--transition-base)]",
                  previewRole === role
                    ? "bg-warning/10 text-warning font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    previewRole === role
                      ? "bg-warning"
                      : "bg-muted-foreground/30"
                  )}
                />
                {label}
              </button>
            ))}
          </div>
          {preview && (
            <button
              onClick={exitPreview}
              className="mt-2 w-full rounded-md bg-warning/10 px-2 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/15"
            >
              退出预览
            </button>
          )}
        </div>
      )}

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
              <a href="/api/auth/signout" className="flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
