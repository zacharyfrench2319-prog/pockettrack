import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Upload, Loader2, Check, X, Receipt, ShoppingBag, Lightbulb, ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
type ScanItem = { name: string; price: number };
type ReceiptResult = {
  store_name: string;
  date: string;
  items: ScanItem[];
  total: number;
  category: string;
};

type ProductResult = {
  product_name: string;
  estimated_price: number;
  verdict: "go_for_it" | "think_twice" | "skip_it";
  reason: string;
  category: string;
  cheaper_alternative: string | null;
  context: {
    weekly_spend: number;
    balance: number;
    saving_for: string;
    goals_summary: string;
  };
};

type ScanMode = null | "receipt" | "should_i_buy";

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  go_for_it:   { bg: "bg-[#34C759]", text: "text-[#fff]", label: "Go for it! ✅" },
  think_twice: { bg: "bg-[#FF9500]", text: "text-[#fff]", label: "Think twice 🤔" },
  skip_it:     { bg: "bg-[#FF3B30]", text: "text-[#fff]", label: "Skip it ❌" },
};

// ── Component ──────────────────────────────────────────────
const Scan = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScanMode>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Receipt state
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editCategory, setEditCategory] = useState("other");
  const [editItems, setEditItems] = useState<ScanItem[]>([]);

  // Product state
  const [productResult, setProductResult] = useState<ProductResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ── Shared helpers ─────────────────────────────────────
  const handleFileSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const reset = () => {
    setMode(null);
    setImagePreview(null);
    setImageBase64(null);
    setImageFile(null);
    setScanning(false);
    setReceiptResult(null);
    setProductResult(null);
    setDismissed(false);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setImageFile(null);
  };

  // ── Receipt scan ───────────────────────────────────────
  const handleReceiptScan = async () => {
    if (!imageBase64) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { image_base64: imageBase64 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setReceiptResult(data);
      setEditStoreName(data.store_name || "");
      setEditDate(data.date || format(new Date(), "yyyy-MM-dd"));
      setEditTotal(String(data.total || 0));
      setEditCategory(data.category || "other");
      setEditItems(data.items || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to scan receipt");
    }
    setScanning(false);
  };

  const handleReceiptSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }

    let receiptUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, imageFile, { contentType: imageFile.type });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id, amount: parseFloat(editTotal), type: "expense",
      category: editCategory, description: editItems.map((i) => i.name).join(", "),
      merchant: editStoreName, date: editDate, source: "scan", receipt_url: receiptUrl,
    });
    if (txError) { toast.error("Failed to save transaction"); setSaving(false); return; }

    await supabase.from("scans").insert({
      user_id: user.id, scan_type: "receipt", image_url: receiptUrl, extracted_data: receiptResult as any,
    });

    toast.success("Receipt saved!");
    navigate("/home");
    setSaving(false);
  };

  const updateItem = (index: number, field: "name" | "price", value: string) => {
    setEditItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: field === "price" ? parseFloat(value) || 0 : value } : item));
  };

  const removeItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Product scan ───────────────────────────────────────
  const handleProductScan = async () => {
    if (!imageBase64) return;
    setScanning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("scan-product", {
        body: { image_base64: imageBase64, user_id: user.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setProductResult(data);

      // Save scan record
      await supabase.from("scans").insert({
        user_id: user.id, scan_type: "product", image_url: null,
        extracted_data: data as any, verdict: data.verdict, verdict_reason: data.reason,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to analyse product");
    }
    setScanning(false);
  };

  const handleBoughtIt = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !productResult) { setSaving(false); return; }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id, amount: productResult.estimated_price, type: "expense",
      category: productResult.category, description: productResult.product_name,
      merchant: null, date: format(new Date(), "yyyy-MM-dd"), source: "scan",
    });
    if (error) toast.error("Failed to save");
    else {
      toast.success("Expense logged!");
      navigate("/home");
    }
    setSaving(false);
  };

  const handleSkipped = () => {
    setDismissed(true);
    setTimeout(() => navigate("/home"), 1800);
  };

  // ── RENDER: Mode Selection ─────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-8">
          <ArrowLeft size={20} /><span className="text-[15px]">Back</span>
        </button>
        <div className="space-y-2 mb-8">
          <h1 className="text-[28px] font-bold text-foreground">Scan</h1>
          <p className="text-[15px] text-muted-foreground">What would you like to do?</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => setMode("receipt")} className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0"><Receipt size={28} className="text-primary" /></div>
            <div><p className="text-[16px] font-semibold text-foreground">Scan Receipt</p><p className="text-[13px] text-muted-foreground mt-0.5">Log an expense from a receipt</p></div>
          </button>
          <button onClick={() => setMode("should_i_buy")} className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="w-14 h-14 rounded-2xl bg-success/15 flex items-center justify-center shrink-0"><ShoppingBag size={28} className="text-success" /></div>
            <div><p className="text-[16px] font-semibold text-foreground">Should I Buy This?</p><p className="text-[13px] text-muted-foreground mt-0.5">Get AI advice on a purchase</p></div>
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Product Verdict ────────────────────────────
  if (mode === "should_i_buy" && productResult) {
    if (dismissed) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-5">
          <div className="text-center space-y-3">
            <div className="text-5xl">💪</div>
            <h2 className="text-2xl font-bold text-foreground">Smart move!</h2>
            <p className="text-sm text-muted-foreground">Your future self will thank you.</p>
          </div>
        </div>
      );
    }

    const verdict = VERDICT_STYLES[productResult.verdict] || VERDICT_STYLES.think_twice;

    return (
      <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} /><span className="text-[15px]">Scan Again</span>
        </button>

        <div className="space-y-4 flex-1">
          {/* Product & Price */}
          <div className="rounded-2xl bg-card p-5 text-center space-y-2" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Product Detected</p>
            <h2 className="text-xl font-bold text-foreground">{productResult.product_name}</h2>
            <p className="text-2xl font-bold text-foreground">
              ${productResult.estimated_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Verdict Badge */}
          <div className={`rounded-xl ${verdict.bg} p-4 text-center`}>
            <p className={`text-lg font-bold ${verdict.text}`}>{verdict.label}</p>
          </div>

          {/* Reason */}
          <div className="rounded-2xl bg-card p-5 space-y-2" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-[15px] text-foreground leading-relaxed">{productResult.reason}</p>
          </div>

          {/* Cheaper Alternative */}
          {productResult.cheaper_alternative && (
            <div className="rounded-2xl bg-primary/10 p-4 flex items-start gap-3">
              <Lightbulb size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Try instead</p>
                <p className="text-sm text-foreground">{productResult.cheaper_alternative}</p>
              </div>
            </div>
          )}

          {/* Financial Context Bar */}
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Spent ${productResult.context.weekly_spend.toFixed(0)} this week
              {" · "}Balance: ${productResult.context.balance.toFixed(0)}
              {productResult.context.saving_for && productResult.context.saving_for !== "not specified" && (
                <>{" · "}Saving for: {productResult.context.saving_for}</>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            onClick={handleBoughtIt}
            disabled={saving}
            className="flex-1 h-12 rounded-xl text-[14px] font-medium gap-2"
          >
            <ThumbsDown size={16} /> {saving ? "Saving..." : "Bought it"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkipped}
            className="flex-1 h-12 rounded-xl text-[14px] font-medium text-success hover:text-success hover:bg-success/10 gap-2"
          >
            <ThumbsUp size={16} /> Skipped it
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER: Receipt Results ────────────────────────────
  if (mode === "receipt" && receiptResult) {
    return (
      <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} /><span className="text-[15px]">Scan Again</span>
        </button>
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Check size={20} className="text-success" />
            <h2 className="text-lg font-bold text-foreground">Receipt Scanned</h2>
          </div>

          <div className="rounded-2xl bg-card p-4 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
            <Input value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)} placeholder="Store name" className="h-11 rounded-xl bg-muted border-0 text-[15px] font-semibold" />
            <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-11 rounded-xl bg-muted border-0 text-[15px]" />
          </div>

          <div className="rounded-2xl bg-card p-4 space-y-2" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Items</p>
            {editItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} className="flex-1 h-9 rounded-lg bg-muted border-0 text-[13px]" />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input type="number" value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} className="w-20 h-9 rounded-lg bg-muted border-0 text-[13px] text-right" />
                </div>
                <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-card p-4 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-foreground">Total</p>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-foreground">$</span>
                <input type="number" value={editTotal} onChange={(e) => setEditTotal(e.target.value)} className="text-2xl font-bold text-foreground bg-transparent border-0 outline-none text-right w-28" />
              </div>
            </div>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 text-[14px]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map(([key, meta]) => (
                  <SelectItem key={key} value={key} className="text-[14px]">
                    <span className="flex items-center gap-2"><span>{meta.emoji}</span><span>{meta.label}</span></span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleReceiptSave} disabled={saving} className="w-full h-12 rounded-xl text-[15px] font-semibold mt-4">
          {saving ? "Saving..." : "Save to Expenses"}
        </Button>
      </div>
    );
  }

  // ── RENDER: Upload / Capture ───────────────────────────
  const isProduct = mode === "should_i_buy";
  const title = isProduct ? "Should I Buy This?" : "Scan Receipt";
  const subtitle = isProduct ? "Take a photo of something you're thinking of buying" : "Take a photo or upload a receipt image";
  const loadingText = isProduct ? "Analysing purchase..." : "Scanning receipt...";
  const scanHandler = isProduct ? handleProductScan : handleReceiptScan;

  return (
    <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
      <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-8">
        <ArrowLeft size={20} /><span className="text-[15px]">Back</span>
      </button>

      <div className="space-y-2 mb-8">
        <h1 className="text-[28px] font-bold text-foreground">{title}</h1>
        <p className="text-[15px] text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {imagePreview ? (
          <div className="w-full space-y-4">
            <div className="rounded-2xl overflow-hidden bg-card" style={{ boxShadow: "var(--card-shadow)" }}>
              <img src={imagePreview} alt="Captured" className="w-full max-h-80 object-contain" />
            </div>
            {scanning ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">{loadingText}</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" onClick={clearImage} className="flex-1 h-12 rounded-xl text-[14px]">Retake</Button>
                <Button onClick={scanHandler} className="flex-1 h-12 rounded-xl text-[15px] font-semibold">
                  {isProduct ? "Analyse" : "Scan Now"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full space-y-4">
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-52 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Upload size={28} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-foreground">{isProduct ? "Upload Photo" : "Upload Receipt"}</p>
                <p className="text-[12px] text-muted-foreground">JPG, PNG or HEIC</p>
              </div>
            </button>
            <Button onClick={() => cameraInputRef.current?.click()} className="w-full h-12 rounded-xl text-[15px] font-semibold gap-2">
              <Camera size={18} /> Take Photo
            </Button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
    </div>
  );
};

export default Scan;
