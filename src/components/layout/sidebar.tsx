"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Shield,
  LogOut,
  FlaskConical,
} from "lucide-react";
import { FeedbackDialog } from "@/components/layout/feedback-dialog";
import { DqsInfoDialog } from "@/components/scoring/dqs-info-dialog";

interface SidebarProps {
  isAdmin?: boolean;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "Ingestion Queue", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_ITEMS = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
];

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;

  return (
    <aside className="w-64 border-r border-sidebar-border/30 bg-card h-screen sticky top-0 flex flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-xl font-bold">Q5</h1>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border/30 space-y-1">
        <DqsInfoDialog
          trigger={
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
            >
              <FlaskConical className="h-4 w-4 mr-3" />
              DQS Methodology
            </Button>
          }
        />
        <FeedbackDialog />
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
