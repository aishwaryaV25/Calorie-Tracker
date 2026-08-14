'use client';

import { EmptyState } from '@/components/ui';

export default function ChatPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
      <EmptyState
        title="Not built yet"
        description="A conversational assistant for logging meals and asking about your intake is coming in a later step."
      />
    </div>
  );
}
