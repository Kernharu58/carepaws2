import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Send, User } from "lucide-react";
import { api } from "../services/api";
import { tokenStore } from "../services/api";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { LoadingState, EmptyState } from "../components/ui/StateDisplays";
import { Input } from "../components/ui/FormUI";

interface Message {
  _id: string;
  userId: string;
  sender: "user" | "admin" | "shelter";
  text?: string;
  image?: string;
  createdAt: string;
}

interface ChatSession {
  user: { _id: string; displayName: string; email: string } | null;
  lastMessage: Message;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect once, join admin_room explicitly (§4 — staff must emit
  // joinAdmin; it isn't automatic on connect, unlike a regular user's
  // own room).
  useEffect(() => {
    const token = tokenStore.getAccessToken();
    if (!token) return;

    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinAdmin");
    });

    socket.on("receiveMessage", (message: Message) => {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.user?._id === message.userId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage: message };
        return updated.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
      });

      setMessages((prev) => (message.userId === activeUserIdRef.current ? [...prev, message] : prev));
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref in sync so the socket handler (registered once) can read
  // the latest activeUserId without re-subscribing on every change.
  const activeUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeUserIdRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    setSessionsLoading(true);
    api
      .get("/api/chat-sessions")
      .then((res) => setSessions(res.data.data))
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    if (!activeUserId) return;
    setMessagesLoading(true);
    api
      .get(`/api/messages/${activeUserId}`)
      .then((res) => setMessages(res.data.data))
      .finally(() => setMessagesLoading(false));
  }, [activeUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!draft.trim() || !activeUserId || !socketRef.current) return;
    socketRef.current.emit("sendMessage", { userId: activeUserId, text: draft.trim() });
    setDraft("");
  }

  return (
    <div>
      <PageHeader title="Chat" description="Real-time conversations with adopters and volunteers." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]" style={{ height: "calc(100vh - 220px)" }}>
        <Card className="flex flex-col p-0">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <LoadingState />
            ) : sessions.length === 0 ? (
              <EmptyState title="No conversations yet" />
            ) : (
              sessions.map((s) => (
                <button
                  key={s.user?._id ?? s.lastMessage._id}
                  type="button"
                  onClick={() => s.user && setActiveUserId(s.user._id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${
                    activeUserId === s.user?._id ? "bg-emerald-50" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{s.user?.displayName ?? "Unknown user"}</p>
                    <p className="truncate text-xs text-gray-500">{s.lastMessage.text}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col p-0">
          {!activeUserId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Select a conversation to view messages.</div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messagesLoading ? (
                  <LoadingState />
                ) : (
                  messages.map((m) => (
                    <div key={m._id} className={`flex ${m.sender === "user" ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                          m.sender === "user" ? "bg-gray-100 text-gray-800" : "bg-primary text-white"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex items-center gap-2 border-t border-gray-100 p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message…"
                  aria-label="Message"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  className="rounded-lg bg-primary p-2.5 text-white hover:bg-primary/90"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
