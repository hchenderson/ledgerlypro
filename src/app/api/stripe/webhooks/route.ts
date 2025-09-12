
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { db } from '@/lib/firebase'; // Using client-side db, but for server-side functions consider firebase-admin
import { doc, setDoc } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Error message: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.client_reference_id;
      
      if (!userId) {
        console.error('❌ Missing userId in Stripe checkout session');
        return new NextResponse('Webhook Error: Missing client_reference_id', { status: 400 });
      }

      try {
        // Update the user's plan in Firestore
        const userSettingsRef = doc(db, 'users', userId, 'settings', 'main');
        await setDoc(userSettingsRef, { plan: 'pro' }, { merge: true });
        console.log(`✅ User ${userId} successfully upgraded to Pro plan.`);
      } catch (error) {
        console.error(`❌ Firestore update failed for user ${userId}:`, error);
        return new NextResponse('Webhook Error: Firestore update failed.', { status: 500 });
      }
      
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return new NextResponse(null, { status: 200 });
}
