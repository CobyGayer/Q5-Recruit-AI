"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hourglass } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function PendingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleCheckStatus() {
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo variant="full" width={160} />
          </div>
          <div className="flex justify-center">
            <Hourglass className="h-10 w-10 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              Account Pending Approval
            </CardTitle>
            <CardDescription>
              Your account is awaiting admin verification. You&apos;ll be able to
              access the platform once an administrator approves your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleCheckStatus} className="w-full" variant="outline">
            Check Status
          </Button>
          <Button onClick={handleSignOut} variant="ghost" className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
