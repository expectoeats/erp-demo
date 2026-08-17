import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProviderWrapper } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "PropertyERP — Property Management System",
  description: "Property, Unit & Billing Management ERP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          {children}
          <ToastProvider />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
