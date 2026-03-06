import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  Landmark,
  Unlink,
  Lock,
  ChevronRight,
  Upload,
  Camera,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CATEGORY_META from "@/lib/categories";
import { format } from "date-fns";
import { toast } from "sonner";
import UpgradeModal from "@/components/UpgradeModal";

interface Props {
  bankConnected: boolean;
  bankName: string | null;
  lastImported: string | null;
  onStatusChange: () => void;
}

type ParsedCsvTransaction = {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
};

type ScreenshotTransaction = {
  description: string;
  merchant: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category: string;
};

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

const ConnectedAccountsSection = ({
  bankConnected,
  bankName,
  lastImported,
  onStatusChange,
}: Props) => {
  const { isPro } = useSubscription();
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"choice" | "csv" | "screenshot">("choice");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvTransactions, setCsvTransactions] = useState<ParsedCsvTransaction[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotImagePreview, setScreenshotImagePreview] = useState<string | null>(null);
  const [screenshotImageBase64, setScreenshotImageBase64] = useState<string | null>(null);
  const [screenshotTransactions, setScreenshotTransactions] = useState<ScreenshotTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleConnect = async () => {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    setConnectLoading(true);
    setMode("choice");
    setCsvTransactions([]);
    setCsvFileName(null);
    setScreenshotTransactions([]);
    setScreenshotImagePreview(null);
    setScreenshotImageBase64(null);
    setModalOpen(true);
    setConnectLoading(false);
  };

  const handleDisconnect = async () => {
    setDisconnectLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({
        bank_connected: false,
        bank_name: null,
        basiq_user_id: null,
      } as any).eq("user_id", user.id);
    }
    setDisconnectLoading(false);
    toast.success("Bank disconnected");
    onStatusChange();
  };

  // Parse a CSV line respecting quoted fields (handles commas inside quotes)
  const parseCsvLine = (line: string): string[] => {
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  const parseCsv = (text: string): ParsedCsvTransaction[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const header = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const findIndex = (keys: string[]) =>
      header.findIndex((h) => keys.some((k) => h.includes(k)));

    const dateIdx = findIndex(["date"]);
    const descIdx = findIndex(["description", "narration", "details"]);
    const debitIdx = findIndex(["debit", "withdrawal", "spent"]);
    const creditIdx = findIndex(["credit", "deposit", "received"]);
    const amountIdx = findIndex(["amount", "value"]);

    const parsed: ParsedCsvTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const cols = parseCsvLine(raw);

      const date = dateIdx >= 0 ? cols[dateIdx] : "";
      const description = descIdx >= 0 ? cols[descIdx] : "";

      let amount = 0;
      let type: "income" | "expense" = "expense";

      const parseNum = (v: string | undefined) =>
        v ? Number(v.replace(/[$,]/g, "")) || 0 : 0;

      if (debitIdx >= 0 || creditIdx >= 0) {
        const debit = parseNum(cols[debitIdx]);
        const credit = parseNum(cols[creditIdx]);
        if (debit !== 0) {
          amount = Math.abs(debit);
          type = "expense";
        } else if (credit !== 0) {
          amount = Math.abs(credit);
          type = "income";
        } else {
          continue;
        }
      } else if (amountIdx >= 0) {
        const val = parseNum(cols[amountIdx]);
        if (val === 0) continue;
        amount = Math.abs(val);
        type = val > 0 ? "income" : "expense";
      } else {
        continue;
      }

      if (!date || !description || amount <= 0) continue;

      parsed.push({
        date: date.substring(0, 10),
        description,
        amount,
        type,
      });
    }

    return parsed;
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error("Could not detect any transactions in this CSV");
      } else {
        setCsvTransactions(parsed);
        setCsvFileName(file.name);
      }
    } catch {
      toast.error("Failed to read CSV file");
    }
    setCsvLoading(false);
  };

  const handleImportCsv = async () => {
    if (!csvTransactions.length) return;
    setCsvLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("transactions")
        .select("date, amount, merchant")
        .eq("user_id", user.id)
        .eq("source", "bank");

      const existingSet = new Set(
        (existing || []).map(
          (e) => `${e.date}|${e.amount}|${(e.merchant || "").toLowerCase()}`,
        ),
      );

      const toInsert = [];
      for (const tx of csvTransactions) {
        const key = `${tx.date}|${tx.amount}|${tx.description.toLowerCase()}`;
        if (existingSet.has(key)) continue;
        toInsert.push({
          user_id: user.id,
          date: tx.date,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
          merchant: tx.description,
          source: "bank",
          category: null,
          is_subscription: false,
        });
        existingSet.add(key);
      }

      if (!toInsert.length) {
        toast.info("No new transactions to import");
        setCsvLoading(false);
        return;
      }

      const { error } = await supabase.from("transactions").insert(toInsert);
      if (error) throw error;

      toast.success(`Imported ${toInsert.length} transactions`);
      setModalOpen(false);
      onStatusChange();
    } catch (e: any) {
      toast.error(e.message || "Failed to import transactions");
    }
    setCsvLoading(false);
  };

  const handleScreenshotFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setScreenshotImagePreview(dataUrl);
      setScreenshotImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleScreenshotInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleScreenshotFileSelect(file);
  };

  const handleScanScreenshot = async () => {
    if (!screenshotImageBase64) return;
    setScreenshotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-bank-screenshot", {
        body: { image_base64: screenshotImageBase64 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setScreenshotTransactions(data.transactions || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to read bank screenshot");
    }
    setScreenshotLoading(false);
  };

  const handleImportScreenshot = async () => {
    if (!screenshotTransactions.length) return;
    setScreenshotLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for duplicates before importing
      const { data: existing } = await supabase
        .from("transactions")
        .select("date, amount, merchant")
        .eq("user_id", user.id)
        .eq("source", "bank");

      const existingSet = new Set(
        (existing || []).map(
          (e) => `${e.date}|${e.amount}|${(e.merchant || "").toLowerCase()}`,
        ),
      );

      const toInsert = [];
      for (const t of screenshotTransactions) {
        const key = `${t.date}|${t.amount}|${(t.merchant || "").toLowerCase()}`;
        if (existingSet.has(key)) continue;
        toInsert.push({
          user_id: user.id,
          date: t.date,
          amount: t.amount,
          type: t.type,
          description: t.description,
          merchant: t.merchant,
          category: t.category,
          source: "bank",
        });
        existingSet.add(key);
      }

      if (!toInsert.length) {
        toast.info("No new transactions to import");
        setScreenshotLoading(false);
        return;
      }

      const { error } = await supabase.from("transactions").insert(toInsert);
      if (error) throw error;

      toast.success(`Imported ${toInsert.length} transactions`);
      setModalOpen(false);
      onStatusChange();
    } catch (e: any) {
      toast.error(e.message || "Failed to import transactions");
    }
    setScreenshotLoading(false);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">
        Connected Accounts
      </p>
      <div className="rounded-2xl bg-card overflow-hidden">
        {bankConnected ? (
          <>
            {/* Connected state */}
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Landmark size={20} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-foreground">{bankName || "Bank imports"}</p>
                {lastImported && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Last imported: {format(new Date(lastImported), "dd MMM yyyy")}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40"
            >
              <Upload size={18} className="text-muted-foreground" />
              <span className="flex-1 text-[15px] text-foreground text-left">
                Import More
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnectLoading}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40"
            >
              <Unlink size={18} className="text-muted-foreground" />
              <span className="flex-1 text-[15px] text-foreground text-left">
                {disconnectLoading ? "Disconnecting..." : "Disconnect"}
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </>
        ) : (
          /* Not connected */
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <Landmark size={20} className="text-muted-foreground" />
            <span className="flex-1 text-[15px] text-foreground text-left">
              {connectLoading ? "Connecting..." : "Connect Bank Account"}
            </span>
            {!isPro && (
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Lock size={10} /> Pro
              </span>
            )}
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="bank linking" />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import bank transactions</DialogTitle>
            <DialogDescription>
              Choose how you'd like to bring in your bank activity.
            </DialogDescription>
          </DialogHeader>

          {mode === "choice" && (
            <div className="space-y-3">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors"
                onClick={() => setMode("csv")}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <FileText size={20} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-semibold text-foreground">Upload Bank Statement CSV</p>
                  <p className="text-[12px] text-muted-foreground">
                    Import a CSV exported from your bank.
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>

              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors"
                onClick={() => setMode("screenshot")}
              >
                <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
                  <Camera size={20} className="text-success" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-semibold text-foreground">Scan Bank Screenshot</p>
                  <p className="text-[12px] text-muted-foreground">
                    Take a photo of your banking app screen.
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>
          )}

          {mode === "csv" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[14px] text-foreground font-medium">Upload Bank Statement CSV</p>
                <p className="text-[12px] text-muted-foreground">
                  Most Australian banks export CSVs with columns like Date, Description, Debit, Credit, Balance.
                  We'll auto-detect the format.
                </p>
              </div>
              <div className="space-y-3">
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  disabled={csvLoading}
                  className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary"
                />
                {csvFileName && (
                  <p className="text-[12px] text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{csvFileName}</span>
                  </p>
                )}
              </div>

              {csvTransactions.length > 0 && (
                <div className="rounded-2xl bg-muted p-3 max-h-60 overflow-y-auto space-y-2">
                  {csvTransactions.map((tx, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[12px]">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-muted-foreground">{tx.date}</p>
                      </div>
                      <p
                        className={`ml-3 font-semibold ${
                          tx.type === "income" ? "text-emerald-500" : "text-destructive"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}${tx.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMode("choice")}
                  className="h-9 rounded-lg text-[13px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={csvLoading || csvTransactions.length === 0}
                  className="h-9 rounded-lg text-[13px]"
                >
                  {csvLoading ? "Importing..." : `Import ${csvTransactions.length} transactions`}
                </Button>
              </div>
            </div>
          )}

          {mode === "screenshot" && (
            <div className="space-y-4">
              {!screenshotImagePreview ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[14px] text-foreground font-medium">Scan a bank screenshot</p>
                    <p className="text-[12px] text-muted-foreground">
                      Take a clear screenshot or photo of your recent transactions screen.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                        <Upload size={22} className="text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-[14px] font-medium text-foreground">Upload Screenshot</p>
                        <p className="text-[12px] text-muted-foreground">JPG, PNG or HEIC</p>
                      </div>
                    </button>
                    <Button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full h-10 rounded-xl text-[14px] font-semibold gap-2"
                    >
                      <Camera size={16} /> Take Photo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl overflow-hidden bg-muted">
                    <img
                      src={screenshotImagePreview}
                      alt="Bank screenshot"
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                  {screenshotLoading ? (
                    <p className="text-[13px] text-muted-foreground text-center">Reading transactions...</p>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-9 rounded-lg text-[13px]"
                        onClick={() => {
                          setScreenshotImagePreview(null);
                          setScreenshotImageBase64(null);
                          setScreenshotTransactions([]);
                        }}
                      >
                        Retake
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 h-9 rounded-lg text-[13px]"
                        onClick={handleScanScreenshot}
                      >
                        Scan Transactions
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {screenshotTransactions.length > 0 && (
                <div className="rounded-2xl bg-muted p-3 max-h-60 overflow-y-auto space-y-3 mt-2">
                  {screenshotTransactions.map((tx, idx) => (
                    <div key={idx} className="space-y-2 rounded-xl bg-background p-2">
                      <Input
                        value={tx.description}
                        onChange={(e) =>
                          setScreenshotTransactions((prev) =>
                            prev.map((t, i) =>
                              i === idx ? { ...t, description: e.target.value } : t,
                            ),
                          )
                        }
                        className="h-8 rounded-lg bg-muted border-0 text-[13px]"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={tx.merchant}
                          onChange={(e) =>
                            setScreenshotTransactions((prev) =>
                              prev.map((t, i) =>
                                i === idx ? { ...t, merchant: e.target.value } : t,
                              ),
                            )
                          }
                          placeholder="Merchant"
                          className="h-8 rounded-lg bg-muted border-0 text-[13px]"
                        />
                        <Input
                          type="date"
                          value={tx.date}
                          onChange={(e) =>
                            setScreenshotTransactions((prev) =>
                              prev.map((t, i) =>
                                i === idx ? { ...t, date: e.target.value } : t,
                              ),
                            )
                          }
                          className="h-8 rounded-lg bg-muted border-0 text-[13px]"
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          value={tx.amount}
                          onChange={(e) =>
                            setScreenshotTransactions((prev) =>
                              prev.map((t, i) =>
                                i === idx
                                  ? { ...t, amount: Number(e.target.value) || 0 }
                                  : t,
                              ),
                            )
                          }
                          className="h-8 rounded-lg bg-muted border-0 text-[13px] w-28"
                        />
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant={tx.type === "expense" ? "default" : "outline"}
                            size="sm"
                            className="h-8 rounded-full text-[11px] px-3"
                            onClick={() =>
                              setScreenshotTransactions((prev) =>
                                prev.map((t, i) =>
                                  i === idx ? { ...t, type: "expense" } : t,
                                ),
                              )
                            }
                          >
                            Expense
                          </Button>
                          <Button
                            type="button"
                            variant={tx.type === "income" ? "default" : "outline"}
                            size="sm"
                            className="h-8 rounded-full text-[11px] px-3"
                            onClick={() =>
                              setScreenshotTransactions((prev) =>
                                prev.map((t, i) =>
                                  i === idx ? { ...t, type: "income" } : t,
                                ),
                              )
                            }
                          >
                            Income
                          </Button>
                        </div>
                      </div>
                      <Select
                        value={tx.category}
                        onValueChange={(val) =>
                          setScreenshotTransactions((prev) =>
                            prev.map((t, i) =>
                              i === idx ? { ...t, category: val } : t,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 rounded-lg bg-muted border-0 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {categories.map(([key, meta]) => (
                            <SelectItem key={key} value={key} className="text-[13px]">
                              <span className="flex items-center gap-2">
                                <span>{meta.emoji}</span>
                                <span>{meta.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMode("choice")}
                  className="h-9 rounded-lg text-[13px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleImportScreenshot}
                  disabled={screenshotLoading || screenshotTransactions.length === 0}
                  className="h-9 rounded-lg text-[13px]"
                >
                  {screenshotLoading
                    ? "Importing..."
                    : `Import ${screenshotTransactions.length} transactions`}
                </Button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleScreenshotInputChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleScreenshotInputChange}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectedAccountsSection;
