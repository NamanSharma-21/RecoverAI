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
  const [obligationData, setObligationData] = useState<any | null>(null);
  const [latestDecision, setLatestDecision] = useState<any | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<any[]>([]);
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
        const c = data?.data?.case || data?.case;
        const obl = data?.data?.obligation || data?.obligation;
        const decs = data?.data?.decisions || data?.decisions || [];
        const actions = data?.data?.recoveryActions || data?.recoveryActions || [];

        setCaseData(c);
        setObligationData(obl);
        if (decs && decs.length > 0) {
          setLatestDecision(decs[decs.length - 1]);
        }
        setRecoveryActions(actions || []);

        if (c?.status === 'RECOVERED' || obl?.status === 'SATISFIED') {
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
      <div className="min-h-screen bg-[#fdfcfc] text-[#000000] flex items-center justify-center p-4">
        <div className="text-[#777169] font-mono text-xs animate-pulse">Loading secure checkout...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#fdfcfc] text-[#000000] flex items-center justify-center p-4">
        <div className="bg-[#f5f3f1] border border-[#ebe8e4] rounded-[20px] p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-normal text-[#000000] mb-2">Payment Session Not Found</h2>
          <p className="text-xs text-[#777169] mb-6">This recovery link may have expired or is invalid.</p>
          <Link href="/" className="px-5 py-2 bg-[#000000] hover:bg-[#44403b] text-[#fdfcfc] rounded-full text-xs font-medium transition-all inline-block">
            Return to Store
          </Link>
        </div>
      </div>
    );
  }

  const formattedAmount = `₹${(caseData.amount / 100).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-[#fdfcfc] text-[#000000] flex flex-col justify-center items-center p-4 font-sans antialiased">
      {/* Brand Header */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-[#000000] rounded-full flex items-center justify-center font-medium text-[11px] text-[#fdfcfc]">
            R
          </div>
          <span className="font-normal text-xs tracking-tight text-[#000000]">Secure Recovery Checkout</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-[#777169]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]" />
          <span>256-bit Encrypted</span>
        </div>
      </div>

      {/* Main Payment Card */}
      <div className="w-full max-w-md bg-[#f5f3f1] border border-[#ebe8e4] rounded-[20px] p-6 relative">
        {paidSuccess ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-[#fdfcfc] border border-[#ebe8e4] text-[#000000] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-light text-[#000000] mb-1">Payment Successful</h2>
            <p className="text-xs text-[#777169] mb-6">
              Your payment of <span className="text-[#000000] font-medium">{formattedAmount}</span> has been processed successfully.
            </p>
            <div className="bg-[#fdfcfc] rounded-xl p-4 border border-[#ebe8e4] text-left mb-6 space-y-2 text-xs">
              <div className="flex justify-between text-[#777169]">
                <span>Transaction Status</span>
                <span className="text-[#000000] font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]" />
                  <span>Captured & Confirmed</span>
                </span>
              </div>
              <div className="flex justify-between text-[#777169]">
                <span>Order Reference</span>
                <span className="text-[#44403b] font-mono">{caseData.order_id || caseData.id}</span>
              </div>
              <div className="flex justify-between text-[#777169]">
                <span>Payment Method</span>
                <span className="text-[#44403b] uppercase font-mono">{selectedMethod}</span>
              </div>
            </div>
            <Link
              href="/"
              className="inline-block w-full py-2.5 bg-[#000000] hover:bg-[#44403b] text-[#fdfcfc] rounded-full font-medium text-xs transition-all text-center"
            >
              Back to Merchant Dashboard
            </Link>
          </div>
        ) : (
          <div>
            {/* Header notification */}
            <div className="mb-6">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#fdfcfc] border border-[#ebe8e4] text-[#ff4704] text-xs rounded-full font-medium mb-3">
                <span className="w-1.5 h-1.5 bg-[#ff4704] rounded-full" />
                <span>Payment Outstanding</span>
              </div>
              <h1 className="text-2xl font-light text-[#000000] tracking-tight">Complete your payment</h1>
              <p className="text-xs text-[#777169] mt-1">
                Your previous payment attempt of <span className="text-[#000000] font-medium">{formattedAmount}</span> was not completed. Retry below securely.
              </p>
            </div>

            {/* Order Summary Box */}
            <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#777169]">Amount Due</span>
                <span className="text-lg font-light text-[#000000]">{formattedAmount}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-[#ebe8e4] flex justify-between text-xs text-[#777169]">
                <span>Order ID</span>
                <span className="font-mono text-[#44403b]">{caseData.order_id || caseData.id}</span>
              </div>
              {obligationData && (
                <div className="mt-1 flex justify-between text-xs text-[#777169]">
                  <span>Obligation Status</span>
                  <span className="font-mono text-[#000000]">{obligationData.status}</span>
                </div>
              )}
            </div>

            {/* AI Recovery Action Info */}
            {latestDecision && (
              <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 mb-5 text-xs">
                <div className="flex items-center space-x-1.5 text-[#000000] font-medium mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]" />
                  <span>RecoverAI Smart Session Active</span>
                </div>
                <p className="text-[#777169] text-[11px]">
                  {latestDecision.diagnosis}
                </p>
                {latestDecision.recommended_action && (
                  <div className="mt-2 text-[11px] text-[#44403b]">
                    <span className="text-[#777169]">Recovery Path: </span>
                    <span className="font-mono text-[#000000] font-medium">
                      {latestDecision.recommended_action.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-medium text-[#777169] uppercase tracking-wider block">Choose payment option</label>
              
              {/* UPI Option */}
              <label
                onClick={() => setSelectedMethod('upi')}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedMethod === 'upi'
                    ? 'bg-[#fdfcfc] border-[#000000]'
                    : 'bg-[#fdfcfc] border-[#ebe8e4] hover:border-[#a59f97]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-full bg-[#ebe8e4] text-[#000000] flex items-center justify-center font-medium text-[10px]">
                    UPI
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#000000]">UPI / Instant QR</div>
                    <div className="text-[11px] text-[#777169]">Google Pay, PhonePe, Paytm, BHIM</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment_method"
                  checked={selectedMethod === 'upi'}
                  onChange={() => setSelectedMethod('upi')}
                  className="accent-[#000000]"
                />
              </label>

              {/* Cards Option */}
              <label
                onClick={() => setSelectedMethod('card')}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedMethod === 'card'
                    ? 'bg-[#fdfcfc] border-[#000000]'
                    : 'bg-[#fdfcfc] border-[#ebe8e4] hover:border-[#a59f97]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-full bg-[#ebe8e4] text-[#000000] flex items-center justify-center font-medium text-[10px]">
                    CARD
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#000000]">Credit / Debit Card</div>
                    <div className="text-[11px] text-[#777169]">Visa, Mastercard, RuPay</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment_method"
                  checked={selectedMethod === 'card'}
                  onChange={() => setSelectedMethod('card')}
                  className="accent-[#000000]"
                />
              </label>

              {/* Netbanking Option */}
              <label
                onClick={() => setSelectedMethod('netbanking')}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedMethod === 'netbanking'
                    ? 'bg-[#fdfcfc] border-[#000000]'
                    : 'bg-[#fdfcfc] border-[#ebe8e4] hover:border-[#a59f97]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-full bg-[#ebe8e4] text-[#000000] flex items-center justify-center font-medium text-[10px]">
                    NET
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#000000]">Netbanking</div>
                    <div className="text-[11px] text-[#777169]">All major Indian banks</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment_method"
                  checked={selectedMethod === 'netbanking'}
                  onChange={() => setSelectedMethod('netbanking')}
                  className="accent-[#000000]"
                />
              </label>
            </div>

            {/* Action CTA */}
            <button
              onClick={handleCompletePayment}
              disabled={paying}
              className="w-full py-3 bg-[#000000] hover:bg-[#44403b] disabled:opacity-50 text-[#fdfcfc] font-medium rounded-full text-xs transition-all flex items-center justify-center space-x-2"
            >
              {paying ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Verifying payment...</span>
                </>
              ) : (
                <>
                  <span>Pay {formattedAmount} Now</span>
                  <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>

            <div className="mt-4 text-center">
              <p className="text-[10px] text-[#777169]">
                Powered by Razorpay Payments Infrastructure. 100% Secure & PCI-DSS Compliant.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-[#777169]">
        <Link href="/" className="hover:text-[#000000] transition-colors">
          Merchant Operator Portal
        </Link>
      </div>
    </div>
  );
}
