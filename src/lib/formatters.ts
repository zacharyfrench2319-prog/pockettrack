import { isToday, isYesterday, parseISO, format } from "date-fns";

export const formatAUD = (amount: number, decimals = 2): string => {
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatPercent = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatSmartDate = (dateStr: string): string => {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
};
