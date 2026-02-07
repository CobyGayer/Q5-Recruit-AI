"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Users, Mail, BarChart3 } from "lucide-react";
import type { Coach, CoachStatus } from "@/types/database";

interface AdminStats {
  total_coaches: number;
  pending_coaches: number;
  total_emails: number;
  processed_emails: number;
  failed_emails: number;
  needs_review_emails: number;
  avg_fields_extracted: number;
}

export default function AdminPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [coachRes, statsRes] = await Promise.all([
      fetch("/api/admin/coaches"),
      fetch("/api/admin/stats"),
    ]);

    if (coachRes.ok) {
      setCoaches(await coachRes.json());
    }
    if (statsRes.ok) {
      setStats(await statsRes.json());
    }
    setLoading(false);
  }

  async function handleApproval(coachId: string, action: "approved" | "rejected") {
    setActionLoading(coachId);
    await fetch(`/api/admin/coaches/${coachId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    await fetchData();
    setActionLoading(null);
  }

  const pendingCoaches = coaches.filter((c) => c.status === "pending");
  const allCoaches = coaches.filter((c) => c.status !== "pending");

  const statusColors: Record<CoachStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total_coaches}</p>
                <p className="text-xs text-muted-foreground">Total Coaches</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total_emails}</p>
                <p className="text-xs text-muted-foreground">Emails Ingested</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.total_emails > 0
                    ? Math.round(
                        (stats.processed_emails / stats.total_emails) * 100
                      )
                    : 0}
                  %
                </p>
                <p className="text-xs text-muted-foreground">
                  Extraction Success Rate
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.avg_fields_extracted.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg Fields Extracted
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Approval
            {pendingCoaches.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCoaches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Coaches</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingCoaches.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No pending coach approvals.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCoaches.map((coach) => (
                    <TableRow key={coach.id}>
                      <TableCell className="font-medium">
                        {coach.full_name}
                      </TableCell>
                      <TableCell>{coach.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(coach.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleApproval(coach.id, "approved")
                            }
                            disabled={actionLoading === coach.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleApproval(coach.id, "rejected")
                            }
                            disabled={actionLoading === coach.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Onboarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allCoaches.map((coach) => (
                  <TableRow key={coach.id}>
                    <TableCell className="font-medium">
                      {coach.full_name}
                    </TableCell>
                    <TableCell>{coach.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {coach.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColors[coach.status]}`}
                      >
                        {coach.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {coach.onboarding_completed ? "Yes" : "No"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
