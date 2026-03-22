"use client";

import { useEffect, useState, Suspense } from "react";
import { ListPageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { usePreview } from "@/hooks/use-preview";

type MeetingData = {
  id: string;
  employee: { id: string; name: string; department: string };
  supervisor?: { id: string; name: string };
  meetingDate: string | null;
  notes: string;
  employeeAck: boolean;
};

function MeetingsContent() {
  const { preview, previewRole, getData } = usePreview();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editDates, setEditDates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (preview && previewRole) {
      const previewData = getData("meetings") as { meetings: MeetingData[] };
      setMeetings(previewData.meetings || []);
      return;
    }

    fetch("/api/meeting").then((r) => r.json()).then((data) => {
      setMeetings(Array.isArray(data) ? data : []);
    });
  }, [preview, previewRole, getData]);

  const toggleExpand = (id: string, meeting: MeetingData) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setEditNotes((prev) => ({ ...prev, [id]: meeting.notes || "" }));
      setEditDates((prev) => ({ ...prev, [id]: meeting.meetingDate?.slice(0, 10) || "" }));
    }
  };

  const saveMeeting = async (employeeId: string, meetingId: string) => {
    if (preview) return;
    try {
      await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          notes: editNotes[meetingId] || "",
          meetingDate: editDates[meetingId] || null,
        }),
      });
      toast.success("面谈记录已保存");
      const data = await fetch("/api/meeting").then((r) => r.json());
      setMeetings(Array.isArray(data) ? data : []);
    } catch {
      toast.error("保存失败");
    }
  };

  const ackMeeting = async (meetingId: string) => {
    if (preview) return;
    try {
      await fetch("/api/meeting/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      toast.success("已确认");
      const data = await fetch("/api/meeting").then((r) => r.json());
      setMeetings(Array.isArray(data) ? data : []);
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="面谈记录" description="记录与管理绩效面谈" />

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            暂无面谈记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => {
            const isExpanded = expandedId === m.id;
            return (
              <Card key={m.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleExpand(m.id, m)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{m.employee.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.employee.department}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.meetingDate && (
                        <span className="text-xs text-muted-foreground">{m.meetingDate.slice(0, 10)}</span>
                      )}
                      <Badge variant={m.employeeAck ? "success" : m.notes ? "default" : "secondary"}>
                        {m.employeeAck ? "已确认" : m.notes ? "已记录" : "待面谈"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4 border-t pt-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">面谈日期</label>
                      <input
                        type="date"
                        value={editDates[m.id] || ""}
                        onChange={(e) => setEditDates((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className="h-9 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm shadow-xs transition-all duration-[var(--transition-base)] hover:border-border focus:border-ring focus:shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">面谈纪要</label>
                      <Textarea
                        value={editNotes[m.id] || ""}
                        onChange={(e) => setEditNotes((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="记录面谈要点、员工反馈、改进计划等..."
                        rows={6}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => saveMeeting(m.employee.id, m.id)}
                        disabled={preview}
                      >
                        保存记录
                      </Button>
                    </div>

                    {m.supervisor && !m.employeeAck && (
                      <div className="border-t pt-4">
                        <Button variant="outline" onClick={() => ackMeeting(m.id)} disabled={preview}>
                          确认面谈结果
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MeetingsContent />
    </Suspense>
  );
}
