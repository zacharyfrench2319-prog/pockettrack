const CATEGORY_META: Record<string, { emoji: string; color: string; label: string }> = {
  groceries:      { emoji: "🛒", color: "hsl(142, 71%, 50%)",  label: "Groceries" },
  eating_out:     { emoji: "🍽️", color: "hsl(25, 95%, 60%)",   label: "Eating Out" },
  transport:      { emoji: "⛽", color: "hsl(210, 80%, 55%)",  label: "Transport" },
  entertainment:  { emoji: "🎬", color: "hsl(263, 86%, 76%)",  label: "Entertainment" },
  shopping:       { emoji: "🛍️", color: "hsl(340, 80%, 60%)",  label: "Shopping" },
  bills:          { emoji: "💡", color: "hsl(48, 95%, 55%)",   label: "Bills" },
  health:         { emoji: "💊", color: "hsl(160, 60%, 50%)",  label: "Health" },
  subscriptions:  { emoji: "🔄", color: "hsl(280, 70%, 60%)",  label: "Subscriptions" },
  other:          { emoji: "📦", color: "hsl(0, 0%, 60%)",     label: "Other" },
  income:         { emoji: "💰", color: "hsl(142, 71%, 50%)",  label: "Income" },
};

export const getCategoryMeta = (category: string | null, type?: string) => {
  if (type === "income") return CATEGORY_META.income;
  return CATEGORY_META[category || "other"] || CATEGORY_META.other;
};

export default CATEGORY_META;
