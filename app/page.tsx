import Link from "next/link";
import { BookOpen, CalendarDays, LayoutDashboard, ArrowRight, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page-bg font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-card-bg/90 backdrop-blur-sm border-b border-soft-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            className="flex items-center justify-between h-16"
            aria-label="Site navigation"
          >
            <span className="text-xl font-bold text-primary tracking-tight">
              TutorPortal
            </span>

            <ul className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-text" role="list">
              <li><a href="#features" className="hover:text-dark-text transition-colors">Features</a></li>
              <li><a href="#courses" className="hover:text-dark-text transition-colors">Courses</a></li>
              <li>
                <Link href="/login" className="hover:text-dark-text transition-colors">
                  Log In
                </Link>
              </li>
            </ul>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-dark transition-colors"
            >
              Open Dashboard
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center"
          aria-labelledby="hero-heading"
        >
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
            SAT &amp; AP Prep — Private Tutoring
          </div>

          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-dark-text tracking-tight leading-tight mb-6"
          >
            Learn Smarter.
            <br />
            <span className="text-primary">Score Higher.</span>
          </h1>

          <p className="text-lg text-muted-text max-w-xl mx-auto mb-10 leading-relaxed">
            Your homework, lessons, resources, and tutoring sessions — all in
            one simple place.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-dark transition-colors text-sm"
            >
              Open Dashboard
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center gap-2 bg-card-bg border border-soft-border text-dark-text font-semibold px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm"
            >
              View Schedule
            </Link>
          </div>

          {/* Dashboard preview */}
          <div className="relative max-w-3xl mx-auto">
            <div
              className="bg-card-bg border border-soft-border rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)] overflow-hidden"
              aria-label="Dashboard preview"
              role="img"
            >
              {/* Mock top bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-soft-border bg-page-bg">
                <span className="text-xs font-semibold text-dark-text">Dashboard</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">DC</div>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* Next lesson card */}
                <div className="col-span-2 sm:col-span-1 bg-primary rounded-xl p-4 text-white">
                  <p className="text-[10px] font-medium text-blue-100 mb-2">NEXT LESSON</p>
                  <p className="text-sm font-bold">SAT Math</p>
                  <p className="text-[11px] text-blue-100 mb-3">Advanced Algebra</p>
                  <p className="text-[11px]">Tue, Sep 8 · 5:00 PM</p>
                </div>
                {/* Homework card */}
                <div className="col-span-2 sm:col-span-2 bg-page-bg border border-soft-border rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-muted-text mb-2">HOMEWORK DUE</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { title: "SAT Math Practice Set 4", due: "Sep 7" },
                      { title: "SAT Grammar Review", due: "Sep 9" },
                    ].map((item) => (
                      <div key={item.title} className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-dark-text truncate mr-2">{item.title}</span>
                        <span className="text-[10px] text-muted-text whitespace-nowrap">Due {item.due}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative blur */}
            <div className="absolute -bottom-6 inset-x-10 h-10 bg-primary/10 rounded-full blur-2xl" aria-hidden="true" />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            className="text-2xl sm:text-3xl font-bold text-dark-text text-center mb-12"
          >
            Everything you need, nothing you don&apos;t
          </h2>

          <ul className="grid gap-6 sm:grid-cols-3" role="list">
            {[
              {
                icon: BookOpen,
                title: "Stay on top of homework",
                description:
                  "See all your assignments, due dates, and statuses in one clean view. Never miss a deadline.",
                color: "bg-blue-50 text-primary",
              },
              {
                icon: CalendarDays,
                title: "View upcoming lessons",
                description:
                  "Know exactly when your next tutoring session is and what topic you will be covering.",
                color: "bg-green-50 text-success",
              },
              {
                icon: LayoutDashboard,
                title: "Review previous sessions",
                description:
                  "Look back at past lessons to reinforce your understanding and track your progress over time.",
                color: "bg-amber-50 text-warning",
              },
            ].map(({ icon: Icon, title, description, color }) => (
              <li
                key={title}
                className="bg-card-bg border border-soft-border rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-dark-text mb-2">{title}</h3>
                <p className="text-sm text-muted-text leading-relaxed">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Courses */}
        <section
          id="courses"
          className="bg-card-bg border-y border-soft-border py-20"
          aria-labelledby="courses-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2
              id="courses-heading"
              className="text-2xl sm:text-3xl font-bold text-dark-text text-center mb-12"
            >
              Courses offered
            </h2>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {[
                { name: "SAT Math", detail: "Algebra, Data Analysis, Advanced Math" },
                { name: "SAT Reading & Writing", detail: "Comprehension, Grammar, Evidence" },
                { name: "AP Calculus BC", detail: "Limits, Derivatives, Integrals, Series" },
                { name: "AP English Language", detail: "Argumentation, Rhetoric, Synthesis" },
                { name: "AP Statistics", detail: "Data, Probability, Inference" },
                { name: "ACT Prep", detail: "English, Math, Reading, Science" },
              ].map(({ name, detail }) => (
                <li
                  key={name}
                  className="flex items-start gap-3 p-4 bg-page-bg border border-soft-border rounded-xl"
                >
                  <CheckCircle
                    size={18}
                    className="text-success mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-dark-text">{name}</p>
                    <p className="text-xs text-muted-text mt-0.5">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-dark-text mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-text text-sm mb-8 max-w-md mx-auto">
            Log in to access your personalized student dashboard and stay on top
            of your SAT and AP preparation.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-dark transition-colors text-sm"
          >
            Open Dashboard
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-soft-border bg-card-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-text">
          <span className="font-bold text-sm text-primary">TutorPortal</span>
          <p>SAT &amp; AP Private Tutoring — Personalized sessions to help you reach your target score.</p>
          <p>© {new Date().getFullYear()} TutorPortal</p>
        </div>
      </footer>
    </div>
  );
}
