import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  RotateCcw,
  CreditCard,
  Headphones,
  CheckCircle2,
  ExternalLink,
  Flame,
  ArrowRight,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Lock,
  Unlock,
  XCircle
} from 'lucide-react';

interface Transaction {
  id: string;
  timestamp: string;
  cart_id: string;
  idempotency_key: string;
  amount: number;
  status: 'CHARGED' | 'BLOCKED_DUPLICATE';
  mode: 'naive' | 'protected';
  notes?: string;
}

interface RefereeVerdict {
  source: string;
  run_id: string;
  verdict: 'BLOCKED' | 'VERIFIED_MERGE_READY';
  rule_id: string;
  rule_title: string;
  status: string;
  safety_confidence: number;
  cryptographic_signature: string;
  root_cause_analysis: {
    vulnerability: string;
    impact: string;
    prescribed_invariant: string;
  };
  suggested_patch: string;
  patch_verification_hash: string;
}

export default function App() {
  const [balance, setBalance] = useState<number>(500.00);
  const [patchMode, setPatchMode] = useState<'naive' | 'protected'>('naive');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastCrashTrace, setLastCrashTrace] = useState<string | null>(null);
  const [showCrashBanner, setShowCrashBanner] = useState<boolean>(false);
  const [showProtectedBanner, setShowProtectedBanner] = useState<boolean>(false);
  const [refereeVerdict, setRefereeVerdict] = useState<RefereeVerdict | null>(null);
  const [isEscalating, setIsEscalating] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [attackAnimation, setAttackAnimation] = useState<boolean>(false);

  // Fetch initial ledger state from backend
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setTransactions(data.transactions);
        setPatchMode(data.patch_mode);
      }
    } catch (e) {
      console.warn('API not reachable, using local fallback state', e);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleModeSwitch = async (mode: 'naive' | 'protected') => {
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        setPatchMode(mode);
        setShowCrashBanner(false);
        setShowProtectedBanner(false);
        setLastCrashTrace(null);
      }
    } catch (err) {
      console.error(err);
      setPatchMode(mode);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setTransactions([]);
        setShowCrashBanner(false);
        setShowProtectedBanner(false);
        setLastCrashTrace(null);
        setRefereeVerdict(null);
      }
    } catch (err) {
      console.error(err);
      setBalance(500.00);
      setTransactions([]);
      setShowCrashBanner(false);
      setShowProtectedBanner(false);
      setLastCrashTrace(null);
    }
  };

  // Nominal 1x Click
  const handleSinglePayment = async () => {
    setLoading(true);
    setShowCrashBanner(false);
    setShowProtectedBanner(false);
    const token = `tok_${Math.random().toString(36).substring(2, 10)}`;

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_id: 'cart_sony_1000xm5',
          amount: 50.00,
          idempotency_key: token
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Concurrent Double-Click Attack (<15ms delta)
  const handleDoubleClickAttack = async () => {
    setLoading(true);
    setAttackAnimation(true);
    setShowCrashBanner(false);
    setShowProtectedBanner(false);

    // Shared idempotency token for both concurrent requests
    const sharedToken = `idem_rapid_${Math.random().toString(36).substring(2, 9)}`;

    const reqPayload = {
      cart_id: 'cart_sony_1000xm5',
      amount: 50.00,
      idempotency_key: sharedToken
    };

    // Client-side async launcher firing two concurrent HTTP POST requests within < 15ms
    const p1 = fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload)
    });

    const p2 = new Promise<Response>((resolve) => {
      // 5ms micro-delay to simulate rapid double-tap
      setTimeout(() => {
        resolve(
          fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqPayload)
          })
        );
      }, 5);
    });

    try {
      const [res1, res2] = await Promise.all([p1, p2]);
      const data1 = await res1.json();
      const data2 = await res2.json();

      await fetchState();

      if (patchMode === 'naive') {
        // Both requests charged -> Double charge failure
        const crash = data1.error_trace || data2.error_trace || (
          'Traceback (most recent call last):\n' +
          '  File "/app/services/checkout.py", line 42, in process_cart_payment\n' +
          '    raise DuplicateChargeException("Cart charge already in flight")\n' +
          'DuplicateChargeException: CRITICAL: Rapid duplicate checkout dispatched without idempotency lock.'
        );
        setLastCrashTrace(crash);
        setShowCrashBanner(true);
      } else {
        // Protected mode: One charged, one intercepted
        setShowProtectedBanner(true);
      }
    } catch (err) {
      console.error(err);
      if (patchMode === 'naive') {
        const fallbackTrace = (
          'Traceback (most recent call last):\n' +
          '  File "/app/services/checkout.py", line 42, in process_cart_payment\n' +
          '    raise DuplicateChargeException("Cart charge already in flight")\n' +
          'DuplicateChargeException: CRITICAL: Rapid duplicate checkout dispatched without idempotency lock.'
        );
        setLastCrashTrace(fallbackTrace);
        setShowCrashBanner(true);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setAttackAnimation(false), 800);
    }
  };

  // Escalate Crash Trace to NeverTwice Referee
  const handleEscalateToNeverTwice = async () => {
    setIsEscalating(true);
    setModalOpen(true);

    const payload = {
      run_id: patchMode === 'naive' ? 'ACME-LIVE-001' : 'ACME-LIVE-002-VERIFIED',
      raw_crash_log: lastCrashTrace || (
        'Traceback (most recent call last):\n' +
        '  File "/app/services/checkout.py", line 42, in process_cart_payment\n' +
        '    raise DuplicateChargeException("Cart charge already in flight")\n' +
        'DuplicateChargeException: CRITICAL: Rapid duplicate checkout dispatched without idempotency lock.'
      ),
      domain: 'code',
      enable_memory: true,
      dry_run: false
    };

    try {
      const res = await fetch('/api/escalate-to-never-twice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const verdictData = data.data || data;
      setRefereeVerdict(verdictData);
    } catch (err) {
      console.error('Failed to contact NeverTwice referee', err);
    } finally {
      setIsEscalating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                  AcmeShop
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  v1.4.2-benchmark
                </span>
              </div>
              <p className="text-xs text-slate-400">NeverTwice Target Sandbox: E-Commerce Double-Charge Benchmark</p>
            </div>
          </div>

          {/* Mode Switcher Control */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => handleModeSwitch('naive')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                patchMode === 'naive'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5 text-rose-400" />
              <span>Run 1: Naive Agent</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            </button>

            <button
              onClick={() => handleModeSwitch('protected')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                patchMode === 'protected'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Run 2: NeverTwice Protected</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>
          </div>

          {/* Bank Account Live Widget */}
          <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Customer Balance</div>
                <div className={`text-base font-mono font-bold transition-all duration-300 ${
                  balance < 450 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  ${balance.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              title="Reset Demo Balance & Clear Ledger"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">

        {/* Status Notification Banners */}
        {showCrashBanner && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-5 backdrop-blur-md shadow-2xl shadow-rose-950/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0">
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-rose-300 text-sm tracking-wide">
                    🚨 CRITICAL: Customer charged twice for a single cart! Flaw detected.
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-500/40">
                    Agent Amnesia Bug
                  </span>
                </div>
                <p className="text-xs text-rose-200/80 mt-1">
                  Rapid concurrent requests bypassed missing idempotency lock. <strong>2x $50.00</strong> was debited ($100.00 total) from the checking account.
                </p>
                <div className="mt-2 text-[11px] font-mono text-rose-400/90 bg-rose-950/80 p-2 rounded border border-rose-900/60 max-w-xl truncate">
                  DuplicateChargeException: CRITICAL: Rapid duplicate checkout dispatched without idempotency lock.
                </div>
              </div>
            </div>

            <button
              onClick={handleEscalateToNeverTwice}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-rose-600/30 flex items-center gap-2 flex-shrink-0 transition-transform active:scale-95"
            >
              <span>Escalate Crash Trace to NeverTwice Referee</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {showProtectedBanner && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-5 backdrop-blur-md shadow-2xl shadow-emerald-950/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-emerald-300 text-sm tracking-wide">
                    🛡️ PROTECTED: Duplicate transaction intercepted and blocked by RULE-PAY-042.
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                    Invariant Intact
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80 mt-1">
                  Re-entrant transaction matched in-memory token ledger. First request debited <strong>$50.00</strong>; subsequent attempt rejected with <code className="bg-emerald-950 px-1 py-0.5 rounded text-emerald-300">status: already_processed</code>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-500/30 text-emerald-300">
                Token Dedup: 100% OK
              </div>
            </div>
          </div>
        )}

        {/* Central Stage: Product Showcase & Interactive Checkout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left / Main: Storefront Product Card */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl flex flex-col justify-between">
            {/* Ambient Background Glow */}
            <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              patchMode === 'naive' ? 'bg-rose-500/5' : 'bg-emerald-500/5'
            }`} />

            <div>
              {/* Product Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Flash Deal • Benchmark Cart
                </span>
                <span className="text-xs font-mono text-slate-400">
                  SKU: SONY-WH1000XM5-BLK
                </span>
              </div>

              {/* Product Visual & Details */}
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <div className="w-48 h-48 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center p-6 relative shadow-inner group">
                  <Headphones className="w-28 h-28 text-cyan-400 group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_10px_25px_rgba(6,182,212,0.3)]" />
                  <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] font-mono text-slate-400 bg-slate-950/60 rounded py-0.5 border border-slate-800">
                    Active Noise Canceling
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">
                    Sony WH-1000XM5
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Industry-leading noise canceling headphones with dual processors and 8 microphones. Configured with a special promo price for clear idempotency test arithmetic.
                  </p>

                  <div className="pt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold font-mono text-cyan-400">
                      $50.00
                    </span>
                    <span className="text-sm font-mono line-through text-slate-500">
                      $399.99
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      SAVE 87%
                    </span>
                  </div>

                  <div className="pt-2 flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      In Stock (1 unit reserved)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Encrypted Checkout
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Action Control Section */}
            <div className="mt-8 pt-6 border-t border-slate-800/80">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Simulate Checkout Execution
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Single Click Nominal Button */}
                <button
                  onClick={handleSinglePayment}
                  disabled={loading}
                  className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 active:bg-slate-800 border border-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:border-slate-600"
                >
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span>Pay $50.00 (Single Click)</span>
                </button>

                {/* Double-Click Rapid Attack Button */}
                <button
                  onClick={handleDoubleClickAttack}
                  disabled={loading}
                  className={`px-5 py-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                    patchMode === 'naive'
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-900/40 border border-rose-500/50'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/40 border border-emerald-500/50'
                  } ${attackAnimation ? 'scale-105 ring-2 ring-cyan-400' : ''}`}
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>⚡ Trigger Double-Click Attack</span>
                  <span className="text-[10px] font-mono opacity-80">&lt;15ms</span>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>Dispatches 2x concurrent POST calls sharing the same <code>idempotency_key</code></span>
                <button
                  onClick={handleReset}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Balance ($500.00)
                </button>
              </div>
            </div>
          </div>

          {/* Right / Sidebar: Concurrency Inspector & Architecture Insight */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Current Active Mode Card */}
            <div className={`p-5 rounded-2xl border transition-all ${
              patchMode === 'naive'
                ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider font-bold flex items-center gap-2">
                  {patchMode === 'naive' ? (
                    <>
                      <Unlock className="w-4 h-4 text-rose-400" />
                      Mode A: Naive Agent
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Mode B: NeverTwice Protected
                    </>
                  )}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  patchMode === 'naive' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {patchMode === 'naive' ? 'patch_mode="naive"' : 'RULE-PAY-042 Enforced'}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {patchMode === 'naive'
                  ? 'Simulates code emitted by an autonomous coding agent with "Agent Amnesia" — lacking atomic locking, resulting in TOCTOU race conditions and duplicate debits.'
                  : 'Protected by NeverTwice episodic memory rule RULE-PAY-042: atomically registers the idempotency token before performing the balance debit.'
                }
              </p>

              {/* Code Snippet Preview */}
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 font-mono text-[11px] overflow-x-auto text-slate-300">
                {patchMode === 'naive' ? (
                  <pre>{`# ❌ FLAW: Naive execution without locking
time.sleep(0.05)
deduct_customer_balance(amount)
# Result: 2 concurrent calls = -$100.00!`}</pre>
                ) : (
                  <pre>{`# 🛡️ ENFORCED INVARIANT (RULE-PAY-042)
if idempotency_key in _KEYS:
    return {"status": "already_processed"}
_KEYS.add(idempotency_key)
deduct_customer_balance(amount)`}</pre>
                )}
              </div>
            </div>

            {/* NeverTwice Referee Quick Link Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between flex-1">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">NeverTwice Referee Hook</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Port 8000</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Raw crash logs can be escalated directly to the NeverTwice referee daemon to synthesize episodic invariants into MongoDB Atlas.
                </p>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={handleEscalateToNeverTwice}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Inspect NeverTwice Verdict</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Live Transaction Audit Ledger */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-base tracking-tight">Live Transaction Audit Ledger</h3>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {transactions.length} records
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Real-time ledger updates capturing debit execution & idempotency enforcement</p>
            </div>

            <button
              onClick={fetchState}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Idempotency Token</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Debit Amount</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No transactions recorded. Click "Pay $50.00" or trigger "⚡ Double-Click Attack" to simulate.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/40 transition-colors font-mono"
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{tx.timestamp}</td>
                      <td className="py-3 px-4 text-cyan-300 font-semibold">{tx.id}</td>
                      <td className="py-3 px-4 text-slate-300 truncate max-w-[160px]" title={tx.idempotency_key}>
                        {tx.idempotency_key}
                      </td>
                      <td className="py-3 px-4">
                        {tx.status === 'CHARGED' ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            tx.mode === 'naive'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            CHARGED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            BLOCKED_DUPLICATE
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold text-sm ${
                        tx.status === 'CHARGED' ? 'text-white' : 'text-slate-500 line-through'
                      }`}>
                        ${tx.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs">
                        {tx.notes || (tx.status === 'CHARGED' ? 'Processed' : 'Blocked')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* DeepMind Judge / NeverTwice Verdict Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">NeverTwice DeepMind Judge Verdict</h3>
                <p className="text-xs text-slate-400">Autonomous Pre-Merge Referee & Episodic Anti-Recurrence Verification</p>
              </div>
            </div>

            {isEscalating ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-xs text-slate-400 font-mono">Evaluating crash telemetry against episodic invariants...</p>
              </div>
            ) : refereeVerdict ? (
              <div className="space-y-4">
                {/* Header Status */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400 font-mono">VERDICT:</span>
                    <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
                      refereeVerdict.verdict === 'BLOCKED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {refereeVerdict.verdict}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Confidence: <span className="text-emerald-400 font-bold">{(refereeVerdict.safety_confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Invariant Detail */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 font-mono">{refereeVerdict.rule_id}</span>
                    <span className="text-[11px] text-slate-400">{refereeVerdict.rule_title}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    <strong>Vulnerability:</strong> {refereeVerdict.root_cause_analysis?.vulnerability}
                  </p>
                  <p className="text-xs text-slate-300">
                    <strong>Prescribed Invariant:</strong> {refereeVerdict.root_cause_analysis?.prescribed_invariant}
                  </p>
                </div>

                {/* Signature */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono space-y-1">
                  <div className="text-slate-500">Cryptographic Signature:</div>
                  <div className="text-indigo-300 truncate">{refereeVerdict.cryptographic_signature}</div>
                  <div className="text-slate-500 pt-1">Patch Verification Hash:</div>
                  <div className="text-cyan-300 truncate">{refereeVerdict.patch_verification_hash}</div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      handleModeSwitch('protected');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Apply RULE-PAY-042 Patch (Switch to Protected)</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-400 font-mono">
        AcmeShop Benchmark Harness • Built for NeverTwice Pre-Merge Evaluation
      </footer>
    </div>
  );
}
