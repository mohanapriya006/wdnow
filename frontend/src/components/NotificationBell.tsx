import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/api/notifications";
import { formatDate } from "@/lib/utils";
import type { NotificationItem, NotificationCategory } from "@/api/types";

function getCategoryIcon(cat: NotificationCategory) {
  switch (cat) {
    case "ASSIGNMENT":
      return "🚀";
    case "TIMESHEET":
      return "⏱️";
    case "PAYROLL":
      return "💳";
    case "INVOICE":
      return "🧾";
    default:
      return "🔔";
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Poll for notifications every 20 seconds
  const { data } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: getMyNotifications,
    refetchInterval: 20_000,
  });

  const readOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = data?.unread_count || 0;
  const items = data?.items || [];

  function handleItemClick(item: NotificationItem) {
    if (item.is_read === 0) {
      readOneMutation.mutate(item.id);
    }
    setIsOpen(false);
    if (item.link_url) {
      navigate(item.link_url);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 focus:outline-none transition-colors shadow-xs"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-ink-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 bg-ink-50/70">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-ink-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs font-medium text-brand-700 hover:text-brand-800 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List items */}
          <div className="max-h-96 overflow-y-auto divide-y divide-ink-100">
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-400">
                <span className="text-2xl block mb-1">🎉</span>
                No notifications yet
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-start gap-3 p-3.5 text-xs transition-colors cursor-pointer ${
                    item.is_read === 0
                      ? "bg-brand-50/40 hover:bg-brand-50/70"
                      : "hover:bg-ink-50/60"
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {getCategoryIcon(item.category)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`font-semibold truncate ${item.is_read === 0 ? 'text-ink-900' : 'text-ink-700'}`}>
                        {item.title}
                      </p>
                      {item.is_read === 0 && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                      )}
                    </div>
                    <p className="mt-0.5 text-ink-500 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-400">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
