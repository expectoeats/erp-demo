"use client";

import * as React from "react";
import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          fontSize: "13px",
          borderRadius: "6px",
        },
        duration: 3500,
      }}
    />
  );
}

export { toast } from "sonner";
