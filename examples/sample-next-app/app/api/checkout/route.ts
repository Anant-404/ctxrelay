import Stripe from "stripe";
import { db } from "../../../lib/db.js";

const stripe = new Stripe(process.env.STRIPE_KEY ?? "");

export async function POST(req: Request) {
  const body = await req.json();
  const session = await stripe.checkout.sessions.create(body);
  return Response.json({ id: session.id });
}

export async function GET() {
  return Response.json({ ok: true, count: db.length });
}
