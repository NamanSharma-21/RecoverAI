'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface CaseDetail {
  id: string;
  amount: number;
  currency: string;
  status: string;
  failure_code: string;
  payment_method: string;
  order_id?: string;
  recovery_url?: string;
  customer_context: {
    name?: string;
    email?: string;
  };
}

export default function ConsumerRecoveryPage({ params }: { params: { id: string } }) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('upi');

  useEffect(() => {
    fetchCase();
  }, [params.id]);

  const fetchCase = async () => {
    try {
      const res = await fetch(`/api/cases/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setCaseData(data.data.case);
        if (data.data.case.status === 'RECOVERED') {
          setPaidSuccess(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayment = async () => {
    setPaying(true);
    try {
      // If external short_url exists and is a real Razorpay link (starts with https://rzp.io), redirect to it
      if (caseData?.recovery_url && caseData.recovery_url.startsWith('https://rzp.io')) {
        window.location.href = caseData.recovery_url;
        return;
      }

      // Otherwise simulate/execute test mode payment completion
      const res = await fetch(`/api/cases/${params.id}/complete-payment`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setPaidSuccess(true);
        fetchCase();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-slate-400 animate-pulse text-sm">Loading secure checkout...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-slate-200 mb-2">Payment Session Not Found</h2>
          <p className="text-sm text-slate-400 mb-6">This recovery link may have expired or is invalid.</p>
          <Link href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
            Return to Store
          </Link>
        </div>
      </div>
    );
  }

  const formattedAmount = `₹${(caseData.amount / 100).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans antialiased">
      {/* Brand Header */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-black text-xs tracking-tighter text-white">
            R
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-300">Secure Payment Checkout</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>256-bit Encrypted</span>
        </div>
      </div>

      {/* Main Payment Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        {paidSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Payment Successful!</h2>
            <p className="text-sm text-slate-400 mb-6">
              Your payment of <span className="text-white font-semibold">{formattedAmount}</span> has been processed successfully.
            </p>
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 text-left mb-6 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Transaction Status</span>
                <span className="text-emerald-400 font-semibold">Captured & Confirmed</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Order Reference</span>
                <span className="text-slate-200 font-mono">{caseData.order_id || caseData.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payment Method</span>
                <span className="text-slate-200 uppercase">{selectedMethod}</span>
              </div>
            </div>
            <Link
              href="/"
              className="inline-block w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm transition"
            >
              Back to Merchant Dashboard
            </Link>
          </div>
        ) : (
          <div>
            {/* Header notification */}
            <div className="mb-6">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-full font-medium mb-3">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                <span>Payment not completed</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Complete your payment</h1>
              <p className="text-sm text-slate-400 mt-1">
                Your previous payment of <span className="text-slate-200 font-semibold">{formattedAmount}</span> was not charged. Complete it below with zero hassle.
              </p>
            </div>

            {/* Order Summary Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Amount Due</span>
                <span className="text-xl font-bold text-white">{formattedAmount}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex justify-between text-xs text-slate-400">
                <span>Order ID</span>
                <span className="font-mono text-slate-300">{caseData.order_id || caseData.id}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 mb-6">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Choose payment option</label>
              
              {/* UPI Option */}
              <label
                onClick={() => setSelectedMethod('upi')}
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedMethod === 'upi'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                    UPI
                  </div>
                  <div>
                    <div className="text-sm font-medium">UPI / Instant QR</div>
                    <div className="text-xs text-slate-400">Google Pay, PhonePe, Paytm, BHIM</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment_method"
                  checked={selectedMethod === 'upi'}
                  onChange={() => setSelectedMethod('upi')}
                  className="accent-blue-500"
                />
              </label>

              {/* Cards Option */}
              <label
                onClick={() => setSelectedMethod('card')}
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedMethod === 'card'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
                    CARD
                  </div>
                  <div>
                    <div className="text-sm font-medium">Credit / Debit Card</div>
                    <div className="text-xs text-slate-400">Visa, Mastercard, RuPay, Amex</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment_method"
                  checked={selectedMethod === 'card'}
                  onChange={() => setSelectedMethod('card')}
                  className="accent-blue-500"
                />
              </label>

              {/* Netbanking Option */}
              <label
                onClick={() => setSelectedMethod('netbanking')}
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedMethod === 'netbanking'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
                    NET
                  </div>
                  <div>
                    <div className="text-sm font-medium">Netbanking</div>
                    <div className="text-xs text-slate-400">All Indian Banks Supported</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment_method"
                  checked={selectedMethod === 'netbanking'}
                  onChange={() => setSelectedMethod('netbanking')}
                  className="accent-blue-500"
                />
              </label>
            </div>

            {/* Action CTA */}
            <button
              onClick={handleCompletePayment}
              disabled={paying}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2"
            >
              {paying ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Verifying payment...</span>
                </>
              ) : (
                <>
                  <span>Pay {formattedAmount} Now</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>

            <div className="mt-4 text-center">
              <p className="text-[11px] text-slate-400">
                Powered by Razorpay Payments Infrastructure. 100% Secure & PCI-DSS Compliant.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-400 transition underline underline-offset-4">
          Merchant Operator Portal
        </Link>
      </div>
    </div>
  );
}
