"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, CalendarDays, User } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/homework", label: "Homework", icon: BookOpen },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/account", label: "Account", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 bg-card-bg border-t border-soft-border z-50 bottom-safe"
    >
      <ul className="flex" role="list">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-text"
                }`}
              >
                <Icon
                  size={20}
                  aria-hidden="true"
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
