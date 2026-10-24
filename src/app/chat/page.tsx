"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { useProfile } from "@/lib/profile";

const SUGGESTIONS = ["How is my schedule looking?", "What should I study this week?", "When should I leave for class?", "Can I take EC 413?", "How's my budget?"];

function Chat() {
  const { profile, update } = useProfile();
  const params = useSearchParams();
  return (
    <ChatPanel
      profile={profile}
      update={update}
      suggestions={SUGGESTIONS}
      initial={params.get("q")}
      intro={
        <div className="mb-3">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">A little clarity, on demand.</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Think through your courses, your schedule, and what comes next.</p>
        </div>
      }
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
