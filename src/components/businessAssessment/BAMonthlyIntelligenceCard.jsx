export default function BAMonthlyIntelligenceCard({
  checkoutState = { loading: '', error: '' },
  onStartCheckout,
}) {
  const isLoading = checkoutState.loading === 'more_monthly_intelligence';
  const customerError =
    typeof checkoutState.error === 'string' && checkoutState.error.trim()
      ? checkoutState.error.trim()
      : '';

  const handleClick = () => {
    if (isLoading) return;
    if (typeof onStartCheckout === 'function') {
      onStartCheckout();
    }
  };

  return (
    <section className="rounded-[2rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-400/[0.1] via-white/[0.035] to-purple-500/[0.09] p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Monthly Intelligence</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        You have your map.
        <span className="block text-cyan-100">Now keep it alive.</span>
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
        Your assessment created your current map. Monthly Intelligence helps you keep moving through a
        self-improving monthly loop.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          'Track your One Move',
          'Record what happened',
          'See what changed',
          'Avoid overclaiming progress',
          'Generate an updated strategy draft',
          'Choose the next best move',
        ].map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/76">
            {item}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={isLoading}
        onClick={handleClick}
        className="mt-7 rounded-xl bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-55"
      >
        {isLoading
          ? 'Opening Checkout...'
          : 'Start MORE Monthly Intelligence — $23.95/month'}
      </button>
      {customerError ? (
        <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-100">
          {customerError}
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-white/46">
        Checkout starts access verification. Durable paid access requires payment processing confirmation.
      </p>
    </section>
  );
}