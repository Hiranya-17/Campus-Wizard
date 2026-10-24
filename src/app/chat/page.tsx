"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { useProfile } from "@/lib/profile";

const SUGGESTIONS = ["When should I leave for class?", "Suggest my Fall schedule", "Plan my week", "How's my budget?", "Can I take EC 413?", "Cheapest pizza?"];

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
        <>
          <h1 className="text-2xl font-bold">Ask Rhett</h1>
          <p className="mt-1 text-sm text-zinc-500">Your BU assistant for registration, your week, getting to class and money.</p>
        </>
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
