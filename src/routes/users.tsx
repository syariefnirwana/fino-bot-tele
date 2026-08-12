import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "Telegram users — FINO BOT" },
      {
        name: "description",
        content:
          "Browse everyone who uses FINO BOT, assign platform roles and ban abusive Telegram accounts.",
      },
      { property: "og:title", content: "Telegram users — FINO BOT" },
      { property: "og:description", content: "User registry and role management for FINO BOT." },
    ],
  }),
  component: UsersPage,
});

const ROLES = ["user", "developer", "moderator", "admin", "owner"] as const;

function UsersPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["telegram_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_users")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      String(u.telegram_id).includes(q) ||
      (u.username ?? "").toLowerCase().includes(q) ||
      (u.first_name ?? "").toLowerCase().includes(q)
    );
  });

  async function update(id: string, patch: Record<string, unknown>, label: string) {
    const { error } = await supabase.from("telegram_users").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(label);
    qc.invalidateQueries({ queryKey: ["telegram_users"] });
  }

  return (
    <AppShell
      title="Telegram users"
      description="Registered automatically the first time someone messages the bot."
      actions={
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id or username"
          className="w-56"
        />
      }
    >
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Telegram ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.username ? `@${u.username}` : "no username"}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{u.telegram_id}</TableCell>
                <TableCell>
                  {isStaff ? (
                    <Select
                      value={u.role}
                      onValueChange={(v) => update(u.id, { role: v }, `Role set to ${v}`)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{u.role}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{u.message_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(u.last_seen_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {isStaff ? (
                    <Button
                      size="sm"
                      variant={u.banned ? "destructive" : "outline"}
                      onClick={() =>
                        update(u.id, { banned: !u.banned }, u.banned ? "User unbanned" : "User banned")
                      }
                    >
                      {u.banned ? "Banned" : "Ban"}
                    </Button>
                  ) : (
                    <Badge variant={u.banned ? "destructive" : "outline"}>
                      {u.banned ? "banned" : "active"}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No Telegram users yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
