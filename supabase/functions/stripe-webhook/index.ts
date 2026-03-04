import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_details?.email;
        if (customerEmail) {
          const { data: users } = await supabaseClient.auth.admin.listUsers();
          const user = users?.users?.find((u) => u.email === customerEmail);
          if (user) {
            await supabaseClient.from("profiles")
              .update({ subscription_status: "pro" })
              .eq("user_id", user.id);
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;
        if (email) {
          const { data: users } = await supabaseClient.auth.admin.listUsers();
          const user = users?.users?.find((u) => u.email === email);
          if (user) {
            const isActive = ["active", "trialing"].includes(subscription.status);
            await supabaseClient.from("profiles")
              .update({ subscription_status: isActive ? "pro" : "free" })
              .eq("user_id", user.id);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;
        if (email) {
          const { data: users } = await supabaseClient.auth.admin.listUsers();
          const user = users?.users?.find((u) => u.email === email);
          if (user) {
            await supabaseClient.from("profiles")
              .update({ subscription_status: "free" })
              .eq("user_id", user.id);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("Webhook processing error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
