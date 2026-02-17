"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  ShieldCheck,
  LogOut,
  BookOpen,
} from "lucide-react";
import { FeedbackDialog } from "@/components/layout/feedback-dialog";
import { DqsInfoDialog } from "@/components/scoring/dqs-info-dialog";

interface SidebarProps {
  isAdmin?: boolean;
}

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "Ingestion Queue", icon: Inbox },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Admin Panel", icon: ShieldCheck },
];

const UTILITY_NAV = [
  { href: "/settings", label: "Settings", icon: Settings },
];

function navLinkClasses(isActive: boolean) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
    isActive
      ? "bg-secondary text-secondary-foreground font-medium"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  }`;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 border-r border-sidebar-border/30 bg-card h-screen sticky top-0 flex flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-xl font-bold">Q5</h1>
      </div>

      {/* Primary navigation — daily workflow */}
      <nav className="px-3 space-y-1">
        {PRIMARY_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClasses(isActive)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Admin navigation — conditional, visually separated */}
      {isAdmin && (
        <div className="px-3 mt-4">
          <Separator className="mb-3 opacity-50" />
          <div className="space-y-1">
            {ADMIN_NAV.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClasses(isActive)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1" />

      {/* Utility footer */}
      <div className="p-3 border-t border-sidebar-border/30 space-y-3">
        {/* Utility group — configure & reference */}
        <div className="space-y-1">
          {UTILITY_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClasses(isActive)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <DqsInfoDialog
            trigger={
              <button className={navLinkClasses(false)}>
                <BookOpen className="h-4 w-4" />
                DQS Methodology
              </button>
            }
          />
        </div>

        <Separator className="opacity-50" />

        {/* Meta group — app-level actions */}
        <div className="space-y-1">
          <FeedbackDialog />
          <button
            className={navLinkClasses(false)}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
