export default function Success() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-16 md:py-20">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
            Payment Confirmed
          </div>

          <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight">
            You are in.
          </h1>

          <p className="mt-6 text-lg text-white/72 leading-relaxed">
            Your payment was successful. Your full personality profile will be generated and delivered to the email you provided.
          </p>

          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">What happens next</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p>Your answers are being processed into a personalized profile.</p>
              <p>You will receive your report via email.</p>
              <p>If you purchased coaching, you will be contacted to schedule your first session.</p>
            </div>
          </div>

          <a
            href="/"
            className="mt-8 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
