import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/client";
import { Icon } from "../../components/icons";
import { buttonClass, Card, EmptyState, LoadingBlock, PageHeader, Pagination } from "../../components/ui";
import { usePageParam, usePageSize } from "../../lib/usePaging";
import QueryError from "../../components/QueryError";
import { formatAgo } from "../../lib/time";

const PageSchema = z.object({
  unread: z.number(),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  items: z.array(
    z.object({
      id: z.number(),
      kind: z.string(),
      message: z.string(),
      link: z.string().nullable(),
      created_at: z.string().nullable(),
      read: z.boolean(),
    }),
  ),
});

export default function NotificationsPage() {
  const [page, setPage] = usePageParam();
  const [pageSize, setPageSize] = usePageSize("notifications");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications-page", page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      PageSchema.parse(await api<unknown>(`/api/notifications?limit=${pageSize}&offset=${page * pageSize}`)),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-page"] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => api(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: refresh,
  });

  const markAll = useMutation({
    mutationFn: () => api(`/api/notifications/read-all`, { method: "POST" }),
    onSuccess: refresh,
  });


  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        actions={
          list.data && list.data.unread > 0 ? (
            <button type="button" onClick={() => markAll.mutate()} className={buttonClass("secondary")}>
              <Icon name="check" size={16} />
              Mark all read
            </button>
          ) : undefined
        }
      />

      {list.isError && <QueryError error={list.error} onRetry={() => void list.refetch()} />}

      {list.isLoading && <Card><LoadingBlock label="Loading notifications…" rows={5} /></Card>}
      {list.data && (
        <Card flush>
          {list.data.items.length === 0 ? (
            <EmptyState text="No notifications yet. They appear when an incident opens." />
          ) : (
            <ul className="divide-y divide-line">
              {list.data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      if (n.link) navigate(n.link);
                    }}
                    className={`flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-page/60 ${n.read ? "text-ink-600" : "text-ink-900"}`}
                  >
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-warn-500"}`} />
                    <span className="flex-1">
                      <span className={`block text-sm ${n.read ? "" : "font-semibold"}`}>{n.message}</span>
                      {n.created_at && (
                        <span className="mt-1 block text-xs text-ink-400">{formatAgo(n.created_at)}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={list.data.total}
            noun="notifications"
            onPage={setPage}
            onPageSize={(size) => { setPageSize(size); setPage(0); }}
          />
        </Card>
      )}
    </div>
  );
}
