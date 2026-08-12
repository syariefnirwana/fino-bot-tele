import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "Groups — FINO BOT" },
      {
        name: "description",
        content:
          "Every Telegram group and channel FINO BOT serves, with per-chat enable switches and traffic counts.",
      },
      { property: "og:title", content: "Groups — FINO BOT" },
      { property: "og:description", content: "Group registry for the FINO BOT platform." },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();

  const { data } = useQuery({
    queryKey: ["telegram_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_groups")
        .select("*")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function toggle(id: string, enabled: boolean) {
    const { error } = await supabase.from("telegram_groups").update({ enabled }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(enabled ? "Bot enabled in group" : "Bot muted in group");
    qc.invalidateQueries({ queryKey: ["telegram_groups"] });
  }

  return (
    <AppShell
      title="Groups"
      description="Chats register themselves the first time the bot sees a message."
    >
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Chat ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.title ?? "Untitled chat"}</TableCell>
                <TableCell className="font-mono text-xs">{g.chat_id}</TableCell>
                <TableCell className="text-xs uppercase text-muted-foreground">
                  {g.chat_type}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{g.message_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(g.last_seen_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={g.enabled}
                    disabled={!isStaff}
                    onCheckedChange={(v) => toggle(g.id, v)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  The bot has not been added to any group yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
