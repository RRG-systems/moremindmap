import { Link, useSearchParams } from 'react-router-dom';

function displayProduct(value) {
  const product = String(value || '').replace(/_/g, ' ').trim();
  return product || 'checkout';
}

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams();
  const product = displayProduct(searchParams.get('product'));

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center">
        <section className="w-full rounded-[2rem] border border-white/12 bg-white/[0.045] p-8 shadow-[0_0_70px_rgba(0,0,0,0.3)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            Checkout Status
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Checkout was cancelled.</h1>
          <p className="mt-5 text-lg leading-8 text-white/72">
            No payment access was changed for {product}.
          </p>
          <p className="mt-4 text-sm leading-6 text-white/54">
            You can return to the product page and start Stripe-hosted Checkout again when ready.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/profile"
              className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white/85"
            >
              Return To Profile
            </Link>
            <Link
              to="/business-assessment"
              className="rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-white/80 transition hover:border-white/35 hover:bg-white/5"
            >
              Business Assessment
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
