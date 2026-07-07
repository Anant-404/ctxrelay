import { CheckoutForm } from "../../src/components/CheckoutForm.js";

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <CheckoutForm cartId="demo" />
    </main>
  );
}
