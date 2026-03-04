import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META, { getCategoryMeta } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Upload, Loader2, Check, X, Receipt, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ScanItem = { name: string; price: number };
type ScanResult = {
  store_name: string;
  date: string;
  items: ScanItem[];
  total: number;
  category: string;
};

type ScanMode = null | "receipt" | "should_i_buy";

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

const Scan = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScanMode>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editStoreName, setEditStoreName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editCategory, setEditCategory] = useState("other");
  const [editItems, setEditItems] = useState<ScanItem[]>([]);

  const handleFileSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // Extract base64 without data URL prefix
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleScan = async () => {
    if (!imageBase64) return;
    setScanning(true);

    try {
      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { image_base64: imageBase64 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
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

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    let receiptUrl: string | null = null;

    // Upload image to storage
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, imageFile, { contentType: imageFile.type });

      if (uploadError) {
        console.error("Upload error:", uploadError);
      } else {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }
    }

    // Save transaction
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: parseFloat(editTotal),
      type: "expense",
      category: editCategory,
      description: editItems.map((i) => i.name).join(", "),
      merchant: editStoreName,
      date: editDate,
      source: "scan",
      receipt_url: receiptUrl,
    });

    if (txError) {
      toast.error("Failed to save transaction");
      setSaving(false);
      return;
    }

    // Save scan record
    await supabase.from("scans").insert({
      user_id: user.id,
      scan_type: "receipt",
      image_url: receiptUrl,
      extracted_data: result as any,
    });

    toast.success("Receipt saved!");
    navigate("/home");
    setSaving(false);
  };

  const updateItem = (index: number, field: "name" | "price", value: string) => {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === "price" ? parseFloat(value) || 0 : value }
          : item
      )
    );
  };

  const removeItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setMode(null);
    setImagePreview(null);
    setImageBase64(null);
    setImageFile(null);
    setScanning(false);
    setResult(null);
  };

  // Mode selection screen
  if (!mode) {
    return (
      <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-8">
          <ArrowLeft size={20} />
          <span className="text-[15px]">Back</span>
        </button>

        <div className="space-y-2 mb-8">
          <h1 className="text-[28px] font-bold text-foreground">Scan</h1>
          <p className="text-[15px] text-muted-foreground">What would you like to do?</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setMode("receipt")}
            className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            style={{ boxShadow: "var(--card-shadow)" }}
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
            onClick={() => setMode("should_i_buy")}
            className="w-full rounded-2xl bg-card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            style={{ boxShadow: "var(--card-shadow)" }}
          >
            <div className="w-14 h-14 rounded-2xl bg-success/15 flex items-center justify-center shrink-0">
              <ShoppingBag size={28} className="text-success" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-foreground">Should I Buy This?</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Get AI advice on a purchase</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // "Should I Buy This?" placeholder
  if (mode === "should_i_buy") {
    return (
      <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-8">
          <ArrowLeft size={20} />
          <span className="text-[15px]">Back</span>
        </button>
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center">
            <ShoppingBag size={32} className="text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Coming Soon</h2>
          <p className="text-sm text-muted-foreground text-center max-w-[260px]">
            AI purchase advisor will help you decide if a purchase is worth it based on your spending habits.
          </p>
        </div>
      </div>
    );
  }

  // Receipt scan — show results
  if (result) {
    return (
      <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
        <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span className="text-[15px]">Scan Again</span>
        </button>

        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Check size={20} className="text-success" />
            <h2 className="text-lg font-bold text-foreground">Receipt Scanned</h2>
          </div>

          {/* Store & Date */}
          <div className="rounded-2xl bg-card p-4 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
            <Input
              value={editStoreName}
              onChange={(e) => setEditStoreName(e.target.value)}
              placeholder="Store name"
              className="h-11 rounded-xl bg-muted border-0 text-[15px] font-semibold"
            />
            <Input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="h-11 rounded-xl bg-muted border-0 text-[15px]"
            />
          </div>

          {/* Items */}
          <div className="rounded-2xl bg-card p-4 space-y-2" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Items</p>
            {editItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(i, "name", e.target.value)}
                  className="flex-1 h-9 rounded-lg bg-muted border-0 text-[13px]"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateItem(i, "price", e.target.value)}
                    className="w-20 h-9 rounded-lg bg-muted border-0 text-[13px] text-right"
                  />
                </div>
                <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Total & Category */}
          <div className="rounded-2xl bg-card p-4 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-foreground">Total</p>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-foreground">$</span>
                <input
                  type="number"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="text-2xl font-bold text-foreground bg-transparent border-0 outline-none text-right w-28"
                />
              </div>
            </div>

            <Select value={editCategory} onValueChange={setEditCategory}>
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
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl text-[15px] font-semibold mt-4"
        >
          {saving ? "Saving..." : "Save to Expenses"}
        </Button>
      </div>
    );
  }

  // Receipt scan — upload/capture
  return (
    <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
      <button onClick={reset} className="flex items-center gap-2 text-muted-foreground mb-8">
        <ArrowLeft size={20} />
        <span className="text-[15px]">Back</span>
      </button>

      <div className="space-y-2 mb-8">
        <h1 className="text-[28px] font-bold text-foreground">Scan Receipt</h1>
        <p className="text-[15px] text-muted-foreground">Take a photo or upload a receipt image</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {imagePreview ? (
          <div className="w-full space-y-4">
            <div className="rounded-2xl overflow-hidden bg-card" style={{ boxShadow: "var(--card-shadow)" }}>
              <img src={imagePreview} alt="Receipt" className="w-full max-h-80 object-contain" />
            </div>

            {scanning ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Scanning receipt...</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(null);
                    setImageFile(null);
                  }}
                  className="flex-1 h-12 rounded-xl text-[14px]"
                >
                  Retake
                </Button>
                <Button
                  onClick={handleScan}
                  className="flex-1 h-12 rounded-xl text-[15px] font-semibold"
                >
                  Scan Now
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full space-y-4">
            {/* Upload Area */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-52 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Upload size={28} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-foreground">Upload Receipt</p>
                <p className="text-[12px] text-muted-foreground">JPG, PNG or HEIC</p>
              </div>
            </button>

            {/* Camera Button */}
            <Button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full h-12 rounded-xl text-[15px] font-semibold gap-2"
            >
              <Camera size={18} />
              Take Photo
            </Button>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
};

export default Scan;
