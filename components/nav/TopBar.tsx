import { Bell } from "lucide-react";

interface TopBarProps {
  title: string;
  initials?: string;
}

export default function TopBar({ title, initials = "?" }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-0 border-b border-soft-border md:border-none bg-card-bg md:bg-transparent mb-6">
      <h1 className="text-base font-semibold text-dark-text md:text-xl md:font-bold">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="p-2 rounded-xl text-muted-text hover:bg-slate-100 hover:text-dark-text transition-colors"
        >
          <Bell size={18} aria-hidden="true" />
        </button>
        <div
          role="img"
          aria-label="User avatar"
          className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center select-none"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
