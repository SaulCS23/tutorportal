"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, CalendarDays, GraduationCap, User, Award } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  { href: "/homework", label: "Homework", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: Award },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/account", label: "Account", icon: User },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="hidden md:flex flex-col gap-1 w-56 shrink-0 sticky top-6 self-start min-h-[calc(100vh-3rem)]"
    >
      <div className="mb-6 px-3">
        <span className="text-xl font-bold text-primary tracking-tight">
          TutorPortal
        </span>
      </div>

      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-white shadow-sm"
                : "text-muted-text hover:bg-slate-100 hover:text-dark-text"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        );
      })}

      <div className="mt-auto pt-6 border-t border-soft-border">
        <SignOutButton />
      </div>
    </nav>
  );
}
