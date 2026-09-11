"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { splitFullName } from "@/lib/utils";

type Step = "name" | "flowA" | "flowB" | "confirmed";

type MatchStatus = "unclaimed_match" | "ambiguous" | "already_claimed" | "no_match";

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

export default function SignUpPage() {
  const [step, setStep] = useState<Step>("name");

  const [fullName, setFullName] = useState("");
  const [preapprovedId, setPreapprovedId] = useState<string | null>(null);
  const [officialName, setOfficialName] = useState("");
  const [possibleExistingAccount, setPossibleExistingAccount] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("check_preapproved_student", {
      p_full_name: fullName,
    });
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const result = (data as { match_status: MatchStatus; preapproved_id: string | null; official_name: string | null }[])?.[0];
    const status = result?.match_status ?? "no_match";

    if (status === "unclaimed_match" && result?.preapproved_id) {
      setPreapprovedId(result.preapproved_id);
      setOfficialName(result.official_name ?? fullName.trim());
      setPossibleExistingAccount(false);
      setStep("flowA");
      return;
    }

    setPreapprovedId(null);
    setPossibleExistingAccount(status === "already_claimed");
    setStep("flowB");
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const nameForAccount = step === "flowA" ? officialName : fullName.trim();
    const { firstName, lastName } = splitFullName(nameForAccount);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: nameForAccount,
          // Read only by claim_preapproved_student_from_own_metadata() after
          // email verification succeeds — matching this name never grants
          // access by itself.
          preapproved_student_id: preapprovedId,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setStep("confirmed");
  }

  if (step === "confirmed") {
    return (
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-dark-text mb-2">Check your email</h1>
        <p className="text-sm text-muted-text leading-relaxed">
          We sent a confirmation link to{" "}
          <span className="font-medium text-dark-text">{email}</span>. Open it to
          activate your account, then sign in.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-dark-text">Create your account</h1>
          <p className="mt-1 text-sm text-muted-text">
            Join your SAT &amp; AP tutoring portal.
          </p>
        </div>

        <form onSubmit={handleNameSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className="text-sm font-medium text-dark-text">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className={inputCls}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-text">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // step === "flowA" | "flowB"
  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-dark-text">
          {step === "flowA" ? `Welcome back, ${officialName.split(" ")[0]}` : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-text">
          {step === "flowA"
            ? "We found your existing TutorPortal student record. Add an email and password to activate it."
            : "Add an email and password to finish creating your account."}
        </p>
      </div>

      {possibleExistingAccount && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          An account under this name may already exist. If that&apos;s you, try{" "}
          <Link href="/login" className="font-medium underline">
            signing in
          </Link>{" "}
          instead — otherwise, continue below to create a new account.
        </p>
      )}

      <form onSubmit={handleAccountSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-dark-text">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-dark-text">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-dark-text">
            Confirm Password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className={inputCls}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={() => {
              setStep("name");
              setError("");
            }}
            className="text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-text">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
