"use client";
import { useState } from "react";

export function CheckoutForm({ cartId }: { cartId: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      disabled={loading}
      onClick={() => {
        setLoading(true);
        fetch("/api/checkout", { method: "POST", body: JSON.stringify({ cartId }) });
      }}
    >
      Checkout {cartId}
    </button>
  );
}
