import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import CATEGORY_META from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Upload, Loader2, Check, X, Receipt, ShoppingBag, Lightbulb, ThumbsUp, ThumbsDown, CreditCard } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import UpgradeModal from "@/components/UpgradeModal";

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

type TransactionResult = {
  description: string;
  merchant: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category: string;
};

type ScanMode = null | "receipt" | "should_i_buy" | "transaction";

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  go_for_it:   { bg: "bg-[#34C759]", text: "text-[#fff]", label: "Go for it! ✅" },
  think_twice: { bg: "bg-[#FF9500]", text: "text-[#fff]", label: "Think twice 🤔" },
  skip_it:     { bg: "bg-[#FF3B30]", text: "text-[#fff]", label: "Skip it ❌" },
};

// ── Component ──────────────────────────────────────────────
const Scan = () => {
  const navigate = useNavigate();
  const { isPro } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScanMode>(null);
  const [inputMode, setInputMode] = useState<"upload" | "type">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  // Receipt state
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editCategory, setEditCategory] = useState("other");
  const [editItems, setEditItems] = useState<ScanItem[]>([]);

  // Manual receipt (typed) state
  const [manualStoreName, setManualStoreName] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [manualCategory, setManualCategory] = useState("other");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [manualItemsText, setManualItemsText] = useState("");

  // Product state
  const [productResult, setProductResult] = useState<ProductResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Product text-input state
  const [textProductName, setTextProductName] = useState("");
  const [textProductPrice, setTextProductPrice] = useState("");
  const [textProductReason, setTextProductReason] = useState("");

  // Transaction state
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null);
  const [editTxDescription, setEditTxDescription] = useState("");
  const [editTxMerchant, setEditTxMerchant] = useState("");
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxType, setEditTxType] = useState<"income" | "expense">("expense");
  const [editTxDate, setEditTxDate] = useState("");
  const [editTxCategory, setEditTxCategory] = useState("other");

  // Reasoning step state
  const [showReasoningStep, setShowReasoningStep] = useState(false);
  const [identifiedProduct, setIdentifiedProduct] = useState<{ name: string; price: number } | null>(null);
  const [userReasoning, setUserReasoning] = useState("");

  // Check scan count for free users
  useEffect(() => {
    const checkScanCount = async () => {
      if (isPro) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const { count } = await supabase
        .from("scans")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart);
      setScanCount(count || 0);
    };
    checkScanCount();
  }, [isPro]);

  const canScan = isPro || scanCount < 5;

  const handleModeSelect = (m: ScanMode) => {
    if (!canScan) {
      setUpgradeOpen(true);
      return;
    }
    setInputMode("upload");
    setMode(m);
  };

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

  const takeNativePhoto = useCallback(async (source: CameraSource) => {
    try {
      const photo = await CapCamera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source,
        allowEditing: false,
      });
      if (photo.base64String) {
        const mimeType = photo.format === "png" ? "image/png" : "image/jpeg";
        setImagePreview(`data:${mimeType};base64,${photo.base64String}`);
        setImageBase64(photo.base64String);
      }
    } catch {
      // User cancelled
    }
  }, []);

  const reset = () => {
    setMode(null);
    setInputMode("upload");
    setImagePreview(null);
    setImageBase64(null);
    setImageFile(null);
    setScanning(false);
    setReceiptResult(null);
    setProductResult(null);
    setTransactionResult(null);
    setDismissed(false);
    setShowReasoningStep(false);
    setIdentifiedProduct(null);
    setUserReasoning("");

    setTextProductName("");
    setTextProductPrice("");
    setTextProductReason("");

    setManualStoreName("");
    setManualTotal("");
    setManualCategory("other");
    setManualDate(format(new Date(), "yyyy-MM-dd"));
    setManualItemsText("");
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

  // ── Transaction scan ───────────────────────────────────
  const handleTransactionScan = async () => {
    if (!imageBase64) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-transaction", {
        body: { image_base64: imageBase64 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTransactionResult(data);
      setEditTxDescription(data.description || "");
      setEditTxMerchant(data.merchant || "");
      setEditTxAmount(String(data.amount ?? 0));
      setEditTxType(data.type === "income" ? "income" : "expense");
      setEditTxDate(data.date || format(new Date(), "yyyy-MM-dd"));
      setEditTxCategory(data.category || "other");
    } catch (e: any) {
      toast.error(e.message || "Failed to read transaction");
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

  // ── Product scan — Step 1: Identify product ──────────
  const handleProductIdentify = async () => {
    if (!imageBase64) return;
    setScanning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Quick identification call
      const { data, error } = await supabase.functions.invoke("scan-product", {
        body: { image_base64: imageBase64, user_id: user.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Show reasoning step with identified product
      setIdentifiedProduct({ name: data.product_name, price: data.estimated_price });
      setProductResult(data);
      setShowReasoningStep(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to identify product");
    }
    setScanning(false);
  };

  // ── Product scan — Step 2: Get advice with reasoning ──
  const handleGetAdvice = async () => {
    if (!imageBase64 || !identifiedProduct) return;
    setScanning(true);
    setShowReasoningStep(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("scan-product", {
        body: {
          image_base64: imageBase64,
          user_id: user.id,
          user_reasoning: userReasoning.trim() || undefined,
        },
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

  const handleTextAdvice = async () => {
    if (!textProductName.trim() || !textProductPrice.trim()) {
      toast.error("Please enter what you want to buy and the price");
      return;
    }

    const price = parseFloat(textProductPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setScanning(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("scan-product", {
        body: {
          user_id: user.id,
          product_name: textProductName.trim(),
          price,
          user_reasoning: textProductReason.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setProductResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to analyse product");
    }
    setScanning(false);
  };

  const handleTransactionSave = async () => {
    if (!transactionResult) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, imageFile, { contentType: imageFile.type });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: parseFloat(editTxAmount),
      type: editTxType,
      category: editTxCategory,
      description: editTxDescription,
      merchant: editTxMerchant,
      date: editTxDate,
      source: "scan",
      receipt_url: imageUrl,
    });
    if (txError) {
      toast.error("Failed to save transaction");
      setSaving(false);
      return;
    }

    await supabase.from("scans").insert({
      user_id: user.id,
      scan_type: "transaction",
      image_url: imageUrl,
      extracted_data: transactionResult as any,
    });

    toast.success("Transaction saved!");
    navigate("/home");
    setSaving(false);
  };

  const handleManualReceiptSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const amount = parseFloat(manualTotal);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid total amount");
      setSaving(false);
      return;
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount,
      type: "expense",
      category: manualCategory,
      description: manualItemsText || manualStoreName || "Manual receipt entry",
      merchant: manualStoreName || null,
      date: manualDate,
      source: "scan",
      receipt_url: null,
    });
    if (txError) {
      toast.error("Failed to save transaction");
      setSaving(false);
      return;
    }

    await supabase.from("scans").insert({
      user_id: user.id,
      scan_type: "receipt",
      image_url: null,
      extracted_data: {
        store_name: manualStoreName,
        total: amount,
        category: manualCategory,
        items_text: manualItemsText,
      } as any,
    });

    toast.success("Receipt saved!");
    navigate("/home");
    setSaving(false);
  };

  const handleManualTransactionSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const amount = parseFloat(editTxAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      setSaving(false);
      return;
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount,
      type: editTxType,
      category: editTxCategory,
      description: editTxDescription || "Manual transaction",
      merchant: editTxMerchant || null,
      date: editTxDate || format(new Date(), "yyyy-MM-dd"),
      source: "scan",
      receipt_url: null,
    });
    if (txError) {
      toast.error("Failed to save transaction");
      setSaving(false);
      return;
    }

    await supabase.from("scans").insert({
      user_id: user.id,
      scan_type: "transaction",
      image_url: null,
      extracted_data: {
        description: editTxDescription,
        merchant: editTxMerchant,
        amount,
        type: editTxType,
        date: editTxDate,
        category: editTxCategory,
      } as any,
    });

    toast.success("Transaction saved!");
    navigate("/home");
    setSaving(false);
  };

  // ── RENDER: Mode Selection ─────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-screen flex flex-col px-6 sm:px-8 pt-safe-top pb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-8">
          <ArrowLeft size={20} /><span className="text-[15px]">Back</span>
        </button>
        <div className="space-y-2 mb-8">
          <h1 className="text-[28px] font-bold text-foreground">Scan</h1>
          <p className="text-[15px] text-muted-foreground">What would you like to do?</p>
        </div>
        <div className="space-y-4">
          <button
            onClick={() => handleModeSelect("should_i_buy")}
            className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
           
          >
            <div className="w-14 h-14 rounded-2xl bg-success/15 flex items-center justify-center shrink-0">
              <ShoppingBag size={28} className="text-success" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-foreground">Should I Buy This?</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Get AI advice on a purchase</p>
            </div>
          </button>

          <button
            onClick={() => handleModeSelect("receipt")}
            className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
           
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Receipt size={28} className="text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-foreground">Scan Receipt</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Log an expense from a receipt</p>
            </div>
          </button>

          <button
            onClick={() => handleModeSelect("transaction")}
            className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
           
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <CreditCard size={28} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-foreground">Log Transaction</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Upload a bank transfer or statement screenshot
              </p>
            </div>
          </button>
        </div>

        {!isPro && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            {scanCount}/5 free scans used this month
          </p>
        )}

        <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="AI scans" />
      </div>
    );
  }

  // ── RENDER: Reasoning Step ────────────────────────────
  if (mode === "should_i_buy" && showReasoningStep && identifiedProduct) {
    return (
      <div className="min-h-screen flex flex-col px-6 sm:px-8 pt-safe-top pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} /><span className="text-[15px]">Start Over</span>
        </button>

        <div className="space-y-4 flex-1">
          {/* Product identified */}
          <div className="rounded-2xl bg-card p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Product Detected</p>
            <h2 className="text-xl font-bold text-foreground">{identifiedProduct.name}</h2>
            <p className="text-2xl font-bold text-foreground">
              ${identifiedProduct.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* User reasoning input */}
          <div className="rounded-2xl bg-card p-5 space-y-3">
            <label className="text-[15px] font-semibold text-foreground">Any reason you need this?</label>
            <Textarea
              placeholder="e.g. My current phone is broken, I need a new one for work"
              value={userReasoning}
              onChange={(e) => setUserReasoning(e.target.value)}
              className="min-h-[100px] rounded-xl bg-muted border-0 text-[14px] placeholder:text-muted-foreground resize-none"
            />
            <p className="text-[11px] text-muted-foreground">Leave blank if no specific reason — the AI will just use your financial data.</p>
          </div>

          <Button onClick={handleGetAdvice} className="w-full h-12 rounded-xl text-[15px] font-semibold">
            Get Advice
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER: Scanning after reasoning ──────────────────
  if (mode === "should_i_buy" && scanning && !showReasoningStep && identifiedProduct) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 sm:px-8">
        <Loader2 size={28} className="text-primary animate-spin" />
        <p className="text-sm text-muted-foreground mt-3">Getting personalised advice...</p>
      </div>
    );
  }

  // ── RENDER: Product Verdict ────────────────────────────
  if (mode === "should_i_buy" && productResult && !showReasoningStep) {
    if (dismissed) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 sm:px-8">
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
      <div className="min-h-screen flex flex-col px-6 sm:px-8 pt-safe-top" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)" }}>
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} /><span className="text-[15px]">Scan Again</span>
        </button>

        <div className="space-y-4 flex-1">
          {/* Product & Price */}
          <div className="rounded-2xl bg-card p-5 text-center space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Product Detected</p>
            <h2 className="text-xl font-bold text-foreground">{productResult.product_name}</h2>
            <p className="text-2xl font-bold text-foreground">
              ${productResult.estimated_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Verdict Badge */}
          <div
            className={`rounded-xl ${verdict.bg} p-4 text-center animate-fade-in`}
            style={{ animationDelay: "200ms", animationFillMode: "both" }}
          >
            <p className={`text-lg font-bold ${verdict.text}`}>{verdict.label}</p>
          </div>

          {/* Reason */}
          <div className="rounded-2xl bg-card p-5 space-y-2">
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

        {/* Action Buttons — positioned above bottom nav */}
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
      <div className="min-h-screen flex flex-col px-6 sm:px-8 pt-safe-top pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} /><span className="text-[15px]">Scan Again</span>
        </button>
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Check size={20} className="text-success" />
            <h2 className="text-lg font-bold text-foreground">Receipt Scanned</h2>
          </div>

          <div className="rounded-2xl bg-card p-4 space-y-3">
            <Input value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)} placeholder="Store name" className="h-11 rounded-xl bg-muted border-0 text-[15px] font-semibold" />
            <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-11 rounded-xl bg-muted border-0 text-[15px]" />
          </div>

          <div className="rounded-2xl bg-card p-4 space-y-2">
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

          <div className="rounded-2xl bg-card p-4 space-y-3">
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

  // ── RENDER: Transaction Results ────────────────────────
  if (mode === "transaction" && transactionResult) {
    const isExpense = editTxType === "expense";
    const amountColor = isExpense ? "text-red-500" : "text-emerald-500";

    return (
      <div className="min-h-screen flex flex-col px-6 sm:px-8 pt-safe-top pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span className="text-[15px]">Scan Again</span>
        </button>

        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Check size={20} className="text-success" />
            <h2 className="text-lg font-bold text-foreground">Transaction Detected</h2>
          </div>

          <div
            className="rounded-2xl bg-card p-4 space-y-3"
           
          >
            <Input
              value={editTxDescription}
              onChange={(e) => setEditTxDescription(e.target.value)}
              placeholder="Description"
              className="h-11 rounded-xl bg-muted border-0 text-[15px] font-semibold"
            />
            <Input
              value={editTxMerchant}
              onChange={(e) => setEditTxMerchant(e.target.value)}
              placeholder="Merchant"
              className="h-11 rounded-xl bg-muted border-0 text-[15px]"
            />
            <Input
              type="date"
              value={editTxDate}
              onChange={(e) => setEditTxDate(e.target.value)}
              className="h-11 rounded-xl bg-muted border-0 text-[15px]"
            />
          </div>

          <div
            className="rounded-2xl bg-card p-4 space-y-3"
           
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-foreground">Amount</p>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-foreground">$</span>
                <input
                  type="number"
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  className={`text-2xl font-bold bg-transparent border-0 outline-none text-right w-32 ${amountColor}`}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={editTxType === "expense" ? "default" : "outline"}
                className="flex-1 h-10 rounded-xl text-[13px] font-medium"
                onClick={() => setEditTxType("expense")}
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={editTxType === "income" ? "default" : "outline"}
                className="flex-1 h-10 rounded-xl text-[13px] font-medium"
                onClick={() => setEditTxType("income")}
              >
                Income
              </Button>
            </div>

            <Select value={editTxCategory} onValueChange={setEditTxCategory}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 text-[14px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map(([key, meta]) => (
                  <SelectItem key={key} value={key} className="text-[14px]">
                    <span className="flex items-center gap-2">
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleTransactionSave}
          disabled={saving}
          className="w-full h-12 rounded-xl text-[15px] font-semibold mt-4"
        >
          {saving ? "Saving..." : "Save Transaction"}
        </Button>
      </div>
    );
  }

  // ── RENDER: Upload / Capture ───────────────────────────
  const isProduct = mode === "should_i_buy";
  const isTransaction = mode === "transaction";
  const title = isProduct ? "Should I Buy This?" : isTransaction ? "Log Transaction" : "Scan Receipt";
  const subtitle = isProduct
    ? "Take a photo of something you're thinking of buying"
    : isTransaction
      ? "Upload a bank transfer or statement screenshot"
      : "Take a photo or upload a receipt image";
  const loadingText = isProduct ? "Identifying product..." : isTransaction ? "Reading transaction..." : "Scanning receipt...";
  const scanHandler = isProduct ? handleProductIdentify : isTransaction ? handleTransactionScan : handleReceiptScan;

  return (
    <div className="min-h-screen flex flex-col px-6 sm:px-8 pt-safe-top pb-8">
      <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-8">
        <ArrowLeft size={20} /><span className="text-[15px]">Back</span>
      </button>

      <div className="space-y-2 mb-8">
        <h1 className="text-[28px] font-bold text-foreground">{title}</h1>
        <p className="text-[15px] text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mb-4 flex rounded-full bg-muted p-1">
        <button
          className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-colors ${
            inputMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setInputMode("upload")}
        >
          Upload
        </button>
        <button
          className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-colors ${
            inputMode === "type" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setInputMode("type")}
        >
          Type
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {inputMode === "upload" ? (
          <>
            {imagePreview ? (
              <div className="w-full space-y-4">
                <div className="rounded-2xl overflow-hidden bg-card">
                  <img src={imagePreview} alt="Captured" className="w-full max-h-80 object-contain" />
                </div>
                {scanning ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Loader2 size={28} className="text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">{loadingText}</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={clearImage} className="flex-1 h-12 rounded-xl text-[14px]">
                      Retake
                    </Button>
                    <Button onClick={scanHandler} className="flex-1 h-12 rounded-xl text-[15px] font-semibold">
                      {isProduct ? "Identify Product" : "Scan Now"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-4">
                <button
                  onClick={() => Capacitor.isNativePlatform() ? takeNativePhoto(CameraSource.Photos) : fileInputRef.current?.click()}
                  className="w-full h-52 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Upload size={28} className="text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-medium text-foreground">
                      {isProduct ? "Upload Photo" : isTransaction ? "Upload Screenshot" : "Upload Receipt"}
                    </p>
                    <p className="text-[12px] text-muted-foreground">JPG, PNG or HEIC</p>
                  </div>
                </button>
                <Button
                  onClick={() => Capacitor.isNativePlatform() ? takeNativePhoto(CameraSource.Camera) : cameraInputRef.current?.click()}
                  className="w-full h-12 rounded-xl text-[15px] font-semibold gap-2"
                >
                  <Camera size={18} /> Take Photo
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full space-y-4">
            {isProduct && (
              <div
                className="rounded-2xl bg-card p-4 space-y-3"
               
              >
                <Input
                  placeholder="What do you want to buy? (e.g. Nike Air Force 1s)"
                  value={textProductName}
                  onChange={(e) => setTextProductName(e.target.value)}
                  className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                />
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">How much is it?</label>
                  <Input
                    type="number"
                    placeholder="e.g. 180"
                    value={textProductPrice}
                    onChange={(e) => setTextProductPrice(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] text-muted-foreground">Any reason you need this? (optional)</label>
                  <Textarea
                    placeholder="e.g. My current shoes are falling apart"
                    value={textProductReason}
                    onChange={(e) => setTextProductReason(e.target.value)}
                    className="min-h-[80px] rounded-xl bg-muted border-0 text-[14px] placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <Button
                  onClick={handleTextAdvice}
                  disabled={scanning}
                  className="w-full h-12 rounded-xl text-[15px] font-semibold mt-2"
                >
                  {scanning ? "Getting advice..." : "Get Advice"}
                </Button>
              </div>
            )}

            {!isProduct && !isTransaction && (
              <div
                className="rounded-2xl bg-card p-4 space-y-3"
               
              >
                <Input
                  placeholder="Store name (e.g. Coles)"
                  value={manualStoreName}
                  onChange={(e) => setManualStoreName(e.target.value)}
                  className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                />
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">Total amount</label>
                  <Input
                    type="number"
                    placeholder="e.g. 85.50"
                    value={manualTotal}
                    onChange={(e) => setManualTotal(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">Category</label>
                  <Select value={manualCategory} onValueChange={setManualCategory}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted border-0 text-[14px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {categories.map(([key, meta]) => (
                        <SelectItem key={key} value={key} className="text-[14px]">
                          <span className="flex items-center gap-2">
                            <span>{meta.emoji}</span>
                            <span>{meta.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] text-muted-foreground">
                    Items (optional — e.g. "Milk $4.50, Bread $3.80")
                  </label>
                  <Textarea
                    placeholder='Milk $4.50, Bread $3.80, Chicken $12'
                    value={manualItemsText}
                    onChange={(e) => setManualItemsText(e.target.value)}
                    className="min-h-[80px] rounded-xl bg-muted border-0 text-[14px] placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <Button
                  onClick={handleManualReceiptSave}
                  disabled={saving}
                  className="w-full h-12 rounded-xl text-[15px] font-semibold mt-2"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}

            {isTransaction && (
              <div
                className="rounded-2xl bg-card p-4 space-y-4"
               
              >
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editTxType === "expense" ? "default" : "outline"}
                    className="flex-1 h-9 rounded-full text-[13px] font-medium"
                    onClick={() => setEditTxType("expense")}
                  >
                    Expense
                  </Button>
                  <Button
                    type="button"
                    variant={editTxType === "income" ? "default" : "outline"}
                    className="flex-1 h-9 rounded-full text-[13px] font-medium"
                    onClick={() => setEditTxType("income")}
                  >
                    Income
                  </Button>
                </div>
                <Input
                  placeholder="Description (e.g. New phone)"
                  value={editTxDescription}
                  onChange={(e) => setEditTxDescription(e.target.value)}
                  className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                />
                <Input
                  placeholder="Merchant (e.g. Apple Store)"
                  value={editTxMerchant}
                  onChange={(e) => setEditTxMerchant(e.target.value)}
                  className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                />
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">Amount</label>
                  <Input
                    type="number"
                    placeholder="e.g. 500"
                    value={editTxAmount}
                    onChange={(e) => setEditTxAmount(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">Category</label>
                  <Select value={editTxCategory} onValueChange={setEditTxCategory}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted border-0 text-[14px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {categories.map(([key, meta]) => (
                        <SelectItem key={key} value={key} className="text-[14px]">
                          <span className="flex items-center gap-2">
                            <span>{meta.emoji}</span>
                            <span>{meta.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[13px] text-muted-foreground mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={editTxDate || format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setEditTxDate(e.target.value)}
                    className="h-11 rounded-xl bg-muted border-0 text-[15px]"
                  />
                </div>
                <Button
                  onClick={handleManualTransactionSave}
                  disabled={saving}
                  className="w-full h-12 rounded-xl text-[15px] font-semibold mt-2"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
    </div>
  );
};

export default Scan;
