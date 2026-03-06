import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Send, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface AiCoachSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Message = { role: "user" | "assistant"; text: string };

function formatMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

const SUGGESTIONS = [
  "Can I afford to eat out this weekend?",
  "Where can I cut spending this month?",
  "Am I on track with my savings goals?",
  "How much should I budget for groceries?",
  "What's my biggest spending problem?",
  "How can I save more money?",
];

const AiCoachSheet = ({ open, onOpenChange }: AiCoachSheetProps) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const askQuestion = async (q: string) => {
    if (!q.trim()) return;
    setInput("");

    const userMsg: Message = { role: "user", text: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setLoading(false); return; }

    // Send last 3 exchanges (6 messages) for context, to keep API costs low
    const historyForApi = updatedMessages.slice(-6).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      text: m.text,
    }));

    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: { question: q, history: historyForApi },
      });

      if (error) {
        if (error.message?.includes("Failed to send") || error.message?.includes("non-2xx")) {
          setMessages((prev) => [...prev, { role: "assistant", text: "The AI Coach edge function hasn't been deployed yet. Please deploy the 'ai-coach' edge function in your Supabase project first." }]);
        } else {
          throw error;
        }
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        const answer = data.answer || "Sorry, I couldn't generate a response.";
        setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI response");
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(input);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const hasMessages = messages.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90dvh] flex flex-col px-6 sm:px-8 pb-5">
        <SheetHeader className="pt-2 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-primary" />
              AI Financial Coach
            </SheetTitle>
            {hasMessages && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw size={14} />
                New Chat
              </button>
            )}
          </div>
          <SheetDescription className="sr-only">Ask your AI financial coach a question</SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {/* Suggestions (shown when no messages) */}
          {!hasMessages && !loading && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ask me anything about your finances:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => askQuestion(s)}
                    className="px-3 py-2 rounded-xl bg-muted text-[13px] text-foreground hover:bg-muted/80 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation */}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user"
              ? "rounded-2xl bg-primary/10 px-4 py-3"
              : "rounded-2xl bg-muted px-4 py-3"
            }>
              {msg.role === "user" ? (
                <p className="text-[14px] text-foreground font-medium">{msg.text}</p>
              ) : (
                <div className="text-[14px] text-foreground whitespace-pre-wrap leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }}
                />
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={20} className="text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing your finances...</p>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="shrink-0 flex gap-2 pt-3 border-t border-border/40">
          <input
            type="text"
            placeholder="Ask about your finances..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-11 rounded-xl bg-muted px-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none border-0"
          />
          <Button type="submit" disabled={loading || !input.trim()} className="h-11 w-11 rounded-xl p-0 shrink-0">
            <Send size={18} />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AiCoachSheet;
