import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function generateId(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .trim();
}

export function numberToWords(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertBelow100(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function convertBelow1000(n: number): string {
    if (n < 100) return convertBelow100(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convertBelow100(n % 100) : "");
  }

  if (amount === 0) return "Zero Rupees Only";

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = "";
  if (rupees >= 10000000) {
    result += convertBelow1000(Math.floor(rupees / 10000000)) + " Crore ";
  }
  if (rupees >= 100000) {
    result += convertBelow100(Math.floor((rupees % 10000000) / 100000)) + " Lakh ";
  }
  if (rupees >= 1000) {
    result += convertBelow1000(Math.floor((rupees % 100000) / 1000)) + " Thousand ";
  }
  result += convertBelow1000(rupees % 1000);

  let words = result.trim() + " Rupees";
  if (paise > 0) {
    words += " and " + convertBelow100(paise) + " Paise";
  }
  words += " Only";
  return words;
}
