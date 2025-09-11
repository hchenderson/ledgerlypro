
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your secret key.
// It's important to use an environment variable for the secret key
// and not to expose it publicly.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const { priceId, userId, email } = await request.json();

    // Validate the input
    if (!priceId || !userId || !email) {
      return NextResponse.json({ error: 'Missing required parameters: priceId, userId, or email' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:9002';

    // Create a checkout session in Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Use 'subscription' for recurring payments
      customer_email: email,
      client_reference_id: userId, // Associate the session with your internal user ID
      success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/stripe/cancel`,
    });

    // Return the session ID to the client
    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Error creating Stripe checkout session:', err);
    // Return a more generic error to the client for security
    return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 });
  }
}
