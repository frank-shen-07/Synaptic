"use client";

import { X } from "lucide-react";

type DismissibleNoticeProps = {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  closeClassName?: string;
};

export function DismissibleNotice({
  children,
  onClose,
  className = "",
  closeClassName = "",
}: DismissibleNoticeProps) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-[1rem] ${className}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onClose}
        className={`button-feel shrink-0 rounded-full p-1 transition ${closeClassName}`}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
