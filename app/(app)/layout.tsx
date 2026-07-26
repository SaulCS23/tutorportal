import AppNav from "@/components/nav/AppNav";
import BottomNav from "@/components/nav/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex gap-10">
        <AppNav />
        <main className="flex-1 min-w-0 pb-24 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
