import { PropsWithChildren, ReactElement, useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';

const stripePublicKey = process.env.REACT_APP_STRIPE_PUBLIC_KEY;

export const StripeProvider = ({ children }: PropsWithChildren): ReactElement => {
  const stripePromise = useMemo(() => {
    if (!stripePublicKey) {
      if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn('Stripe public key is not configured.');
      }

      return null;
    }

    return loadStripe(stripePublicKey) as Promise<Stripe | null>;
  }, []);

  if (!stripePromise) {
    return <>{children}</>;
  }

  return <Elements stripe={stripePromise}>{children}</Elements>;
};
