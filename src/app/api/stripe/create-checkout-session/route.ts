
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const { priceId, userId, email } = await request.json();

    if (!priceId || !userId || !email) {
      return NextResponse.json({ error: 'Missing required parameters: priceId, userId, or email' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:9002';
    
    let stripeSessionOptions: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
            {
            price: priceId,
            quantity: 1,
            },
        ],
        mode: 'subscription',
        customer_email: email,
        client_reference_id: userId,
        success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/stripe/cancel`,
    };

    const session = await stripe.checkout.sessions.create(stripeSessionOptions);

    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Error creating Stripe checkout session:', err);
    return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 });
  }
}
