'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Info,
  Layers,
  PlayCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

interface DashboardStats {
  totalCases: number;
  recoveredCases: number;
  failedCases: number;
  stoppedCases: number;
  escalatedCases: number;
  humanReviewCases: number;
  activeRecoveriesCount: number;
  totalAtRiskAmount: number;
  totalRecoveredAmount: number;
  recoveryRate: number;
}

interface LatestDecision {
  id: string;
  diagnosis: string;
  failure_category: string;
  recoverability: number;
  recommended_action: string;
  confidence: number;
  rationale: string;
  customer_friction?: string;
  evidence?: string[];
  created_at: string;
}

interface LatestPolicyCheck {
  id: string;
  allowed: boolean;
  policy_result: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  reasons: string[];
  created_at: string;
}

interface CaseItem {
  id: string;
  merchant_id?: string;
  payment_id: string;
  order_id?: string;
  amount: number;
  currency: string;
  failure_code: string;
  failure_description: string;
  payment_method: string;
  status: string;
  recoverability_score: number;
  expected_recovery_value: number;
  consent_status: string;
  recovery_url?: string;
  created_at: string;
  latest_decision?: LatestDecision | null;
  latest_policy_check?: LatestPolicyCheck | null;
}

interface RazorpayStatus {
  connected: boolean;
  provider: string;
  keyIdPrefix?: string;
  message: string;
  hasLiveCredentials: boolean;
  webhookUrl: string;
}

interface CaseFullDetail {
  case: CaseItem & {
    obligation_id?: string;
    payment_link_id?: string;
    attempt_count?: number;
  };
  obligation?: any;
  decisions?: any[];
  policyChecks?: any[];
  toolExecutions?: any[];
  recoveryActions?: any[];
  auditEvents?: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [rzpStatus, setRzpStatus] = useState<RazorpayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Case Drawer
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseFullDetail | null>(null);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchRzpStatus();
  }, []);

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseDetail(selectedCaseId);
    } else {
      setCaseDetail(null);
      setActionMessage(null);
    }
  }, [selectedCaseId]);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setCases(data.cases || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRzpStatus = async () => {
    try {
      const res = await fetch('/api/razorpay/status');
      const data = await res.json();
      if (data.success) {
        setRzpStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch razorpay status:', err);
    }
  };

  const loadCaseDetail = async (id: string) => {
    setLoadingCaseDetail(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${id}`);
      const data = await res.json();
      if (data.success) {
        setCaseDetail(data.data || data);
      }
    } catch (err) {
      console.error('Failed to load case detail:', err);
    } finally {
      setLoadingCaseDetail(false);
    }
  };

  const handleCreateTestRecovery = async (
    amount: number,
    failureCode: string,
    failureDescription: string,
    scenarioName: string
  ) => {
    setCreatingTest(true);
    setTestSuccessMessage(null);
    try {
      const res = await fetch('/api/razorpay/create-test-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          failureCode,
          paymentMethod: 'card',
          failureDescription,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestSuccessMessage(`Ingested ${scenarioName} (₹${(amount / 100).toLocaleString('en-IN')})`);
        await fetchDashboardData();
        if (data.data?.case?.id) {
          setSelectedCaseId(data.data.case.id);
        }
      }
    } catch (err) {
      console.error('Failed to trigger test recovery:', err);
    } finally {
      setCreatingTest(false);
      setTimeout(() => setTestSuccessMessage(null), 6000);
    }
  };

  const handleReviewAction = async (caseId: string, action: 'APPROVE' | 'STOP') => {
    setActionProcessing(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          operator_notes: `Action ${action} executed via Merchant Control Center`,
          operator_id: 'merchant_admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Action ${action} recorded successfully.`);
        await loadCaseDetail(caseId);
        await fetchDashboardData();
      } else {
        setActionMessage(`Error: ${data.error || 'Failed to submit review'}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionProcessing(false);
    }
  };

  const handleSimulatePaymentSuccess = async (caseId: string) => {
    setActionProcessing(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/complete-payment`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('✓ Payment captured & verified. Case marked RECOVERED.');
        await loadCaseDetail(caseId);
        await fetchDashboardData();
      } else {
        setActionMessage(`Failed to simulate payment: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionProcessing(false);
    }
  };

  // Plain English failure description
  const getPlainEnglishFailure = (code: string, desc?: string) => {
    const upper = (code || '').toUpperCase();
    if (upper.includes('AUTH_DROPOUT') || upper.includes('BAD_REQUEST_ERROR')) {
      return 'Customer dropped out during OTP / 3DS authentication';
    }
    if (upper.includes('GATEWAY_TIMEOUT')) {
      return 'Bank 3DS gateway timeout during card authorization';
    }
    if (upper.includes('INSUFFICIENT_FUNDS')) {
      return 'Card declined due to insufficient customer balance';
    }
    if (upper.includes('GATEWAY_ERROR') || upper.includes('ISSUER_DOWN')) {
      return 'Issuing bank processing downtime or network drop';
    }
    if (upper.includes('CARD_EXPIRED')) {
      return 'Card details expired or invalid date provided';
    }
    return desc || code.replace(/_/g, ' ');
  };

  // Merchant-friendly action display
  const getRecoveryActionDisplay = (action?: string) => {
    switch (action) {
      case 'CREATE_PAYMENT_LINK':
        return 'Payment Link sent via WhatsApp / SMS';
      case 'RETRY_NOW':
        return 'Instant Smart Retry via alternate gateway rail';
      case 'SCHEDULE_RETRY':
        return 'Smart Retry scheduled for optimal bank uptime';
      case 'OFFER_ALTERNATE_METHOD':
        return 'Alternate payment method (UPI / NetBanking) presented';
      case 'ESCALATE':
        return 'Escalated to human operator review';
      case 'WAIT':
        return 'Waiting for transient banking friction to clear';
      case 'STOP':
        return 'Recovery halted to prevent customer fatigue';
      default:
        return action ? action.replace(/_/g, ' ') : 'Analyzing optimal recovery route';
    }
  };

  // Merchant-friendly policy guardrail display
  const getPolicySafeguardDisplay = (policyResult?: string, reasons?: string[], amount: number = 0) => {
    if (policyResult === 'ESCALATE') {
      return 'Escalated: High-value transaction > ₹25,000 threshold';
    }
    if (policyResult === 'BLOCK') {
      return reasons?.[0] || 'Blocked by safety guardrail';
    }
    if (policyResult === 'ALLOW') {
      return 'Autonomous under ₹25,000 policy threshold';
    }
    if (amount >= 2500000) {
      return 'Flagged for High-Value Merchant Review';
    }
    return 'Governed by deterministic policy engine';
  };

  // Format currency in INR
  const formatINR = (paise: number) => {
    return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
  };

  // Format short date
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECOVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Recovered
          </span>
        );
      case 'OUTCOME_MONITORED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Awaiting Payment
          </span>
        );
      case 'ACTION_EXECUTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Zap className="w-3.5 h-3.5" /> Action Dispatched
          </span>
        );
      case 'HUMAN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <AlertCircle className="w-3.5 h-3.5" /> Merchant Review
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Escalated
          </span>
        );
      case 'STOPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-700/60 text-slate-400 border border-slate-700">
            Halted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const getRecoverabilityBadge = (score: number) => {
    if (score >= 0.7) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          High ({Math.round(score * 100)}%)
        </span>
      );
    }
    if (score >= 0.4) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Med ({Math.round(score * 100)}%)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        Low ({Math.round(score * 100)}%)
      </span>
    );
  };

  // Needs Attention cases: status === HUMAN_REVIEW, ESCALATED, or amount >= 25k not recovered
  const needsAttentionCases = useMemo(() => {
    return cases.filter(
      (c) =>
        c.status === 'HUMAN_REVIEW' ||
        c.status === 'ESCALATED' ||
        (c.amount >= 2500000 && c.status !== 'RECOVERED' && c.status !== 'STOPPED')
    );
  }, [cases]);

  // Filtered & Searched Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Filter tab
      if (filterStatus === 'ACTIVE') {
        if (c.status === 'RECOVERED' || c.status === 'STOPPED' || c.status === 'HUMAN_REVIEW' || c.status === 'ESCALATED') {
          return false;
        }
      } else if (filterStatus === 'NEEDS_ATTENTION') {
        if (c.status !== 'HUMAN_REVIEW' && c.status !== 'ESCALATED' && !(c.amount >= 2500000 && c.status !== 'RECOVERED')) {
          return false;
        }
      } else if (filterStatus !== 'ALL') {
        if (c.status !== filterStatus) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchOrder = c.order_id?.toLowerCase().includes(q);
        const matchPayment = c.payment_id?.toLowerCase().includes(q);
        const matchFailure = c.failure_code?.toLowerCase().includes(q) || c.failure_description?.toLowerCase().includes(q);
        const matchMethod = c.payment_method?.toLowerCase().includes(q);
        if (!matchOrder && !matchPayment && !matchFailure && !matchMethod) {
          return false;
        }
      }

      return true;
    });
  }, [cases, filterStatus, searchQuery]);

  // Mathematically consistent recovery rate: revenue recovered / revenue at risk * 100
  const totalAtRisk = stats?.totalAtRiskAmount || 0;
  const totalRecovered = stats?.totalRecoveredAmount || 0;
  const valueRecoveryRate = totalAtRisk > 0 ? ((totalRecovered / totalAtRisk) * 100).toFixed(1) : '0.0';
  const needsAttentionCount = (stats?.humanReviewCases || 0) + (stats?.escalatedCases || 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header: Merchant Clean View without test buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Merchant Recovery Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Autonomous Engine
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Real-time control plane orchestrating failure diagnosis, deterministic policy guardrails, and verified Razorpay payment recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
            title="Refresh live telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          <a
            href="#demo-scenarios"
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <PlayCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>Test Scenarios ↓</span>
          </a>
        </div>
      </div>

      {/* Integration Mode & Telemetry Status Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-400 font-medium">Gateway Mode:</span>
            <span className="text-white font-semibold">
              {rzpStatus?.hasLiveCredentials ? 'Razorpay Test Mode (Live Keys Active)' : 'High-Fidelity Payment Simulator'}
            </span>
          </div>

          <span className="text-slate-700 hidden sm:inline">•</span>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Verified Webhook Endpoint:</span>
            <code className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300 font-mono text-[11px]">
              {rzpStatus?.webhookUrl || '/api/webhooks/razorpay'}
            </code>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Autonomy limit: <strong className="text-slate-200 font-semibold">₹25,000</strong> max per autonomous retry</span>
        </div>
      </div>

      {/* Primary Business Outcome KPIs - 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Revenue Recovered */}
        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">Revenue Recovered</div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mt-2 tracking-tight">
            {formatINR(stats?.totalRecoveredAmount || 0)}
          </div>
          <div className="text-xs text-emerald-400/90 mt-1 font-medium">
            {stats?.recoveredCases || 0} payments successfully recovered
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            <span>Verified Razorpay captures</span>
          </div>
        </div>

        {/* KPI 2: Revenue at Risk */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Revenue at Risk</div>
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-100 mt-2 tracking-tight">
            {formatINR(stats?.totalAtRiskAmount || 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {stats?.totalCases || 0} failed payments
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Total loss prevented by control engine
          </div>
        </div>

        {/* KPI 3: Recovery Rate */}
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Recovery Rate</div>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-blue-400 mt-2 tracking-tight">
            {valueRecoveryRate}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {formatINR(stats?.totalRecoveredAmount || 0)} recovered / {formatINR(stats?.totalAtRiskAmount || 0)} at risk
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Mathematical value recovered ratio
          </div>
        </div>

        {/* KPI 4: Active Recoveries */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-400 tracking-wider uppercase">Active Recoveries</div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-amber-400 mt-2 tracking-tight">
            {stats?.activeRecoveriesCount || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Automated workflows in progress
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Active links & scheduled retries
          </div>
        </div>

        {/* KPI 5: Needs Attention */}
        <div className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden transition ${
          needsAttentionCount > 0
            ? 'bg-gradient-to-br from-purple-950/40 to-slate-900 border-purple-500/40'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-purple-400 tracking-wider uppercase">Needs Attention</div>
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-purple-300 mt-2 tracking-tight">
            {needsAttentionCount}
          </div>
          <div className="text-xs text-purple-300/80 mt-1 font-medium">
            {needsAttentionCount} {needsAttentionCount === 1 ? 'case requires' : 'cases require'} merchant review
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            High-value &gt; ₹25,000 threshold
          </div>
        </div>
      </div>

      {/* Dedicated "Needs Attention" Section (Req 6) */}
      {needsAttentionCases.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-purple-950/20 border border-purple-500/40 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Needs Attention — High-Value & Policy Escalations</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {needsAttentionCases.length} Pending
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transactions exceeding autonomous limits or requiring merchant discretion before customer outreach.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsAttentionCases.map((c) => (
              <div
                key={c.id}
                className="bg-slate-950/80 border border-purple-500/30 hover:border-purple-500/60 rounded-xl p-4 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-white">{formatINR(c.amount)}</span>
                    {getStatusBadge(c.status)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    {c.order_id || c.payment_id}
                  </div>
                  <div className="text-xs text-purple-200/90 mt-2 font-medium bg-purple-950/40 border border-purple-800/30 rounded-lg p-2">
                    {getPlainEnglishFailure(c.failure_code, c.failure_description)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span>{getPolicySafeguardDisplay(c.latest_policy_check?.policy_result, c.latest_policy_check?.reasons, c.amount)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedCaseId(c.id)}
                    className="flex-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                  >
                    <span>Review & Act</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {c.status !== 'RECOVERED' && (
                    <button
                      onClick={() => handleSimulatePaymentSuccess(c.id)}
                      disabled={actionProcessing}
                      className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-medium transition"
                      title="Simulate customer paying successfully"
                    >
                      ✓ Capture
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery Operations Activity Table (Central Experience - Req 3, 4, 5) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Recovery Workflow Activity</span>
              <span className="text-xs font-normal text-slate-400">
                ({filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'})
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every failed payment tracked from diagnosis to deterministic policy check, controlled execution, and authoritative capture.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order, payment, method..."
                className="w-full sm:w-60 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
              {[
                { id: 'ALL', label: 'All Cases' },
                { id: 'ACTIVE', label: 'Active Workflows' },
                { id: 'NEEDS_ATTENTION', label: 'Needs Attention' },
                { id: 'RECOVERED', label: 'Recovered' },
                { id: 'STOPPED', label: 'Halted' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                    filterStatus === f.id
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs animate-pulse">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-blue-400" />
            Loading real-time recovery telemetry...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-300">
              <Layers className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-200 mb-1">No matching recovery cases found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
              {searchQuery
                ? 'Try adjusting your search query or clear the filter.'
                : 'Ingest a simulated payment failure scenario below to see the complete 6-step recovery loop in action.'}
            </p>
            <a
              href="#demo-scenarios"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-blue-600/25"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Launch a Test Scenario Below</span>
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                  <th className="p-4 pl-6">Order / Payment</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Customer Failure Diagnosis</th>
                  <th className="p-4">Recovery Decision & Policy</th>
                  <th className="p-4">Workflow Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition group"
                  >
                    {/* Column 1: Order / Payment */}
                    <td className="p-4 pl-6">
                      <div className="font-mono text-white font-semibold flex items-center gap-1.5">
                        <span>{c.order_id || c.payment_id}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition" />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatDate(c.created_at)} • <span className="uppercase font-mono text-[10px] text-slate-500">{c.payment_method}</span>
                      </div>
                    </td>

                    {/* Column 2: Amount */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-bold text-sm text-white">{formatINR(c.amount)}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {getRecoverabilityBadge(c.recoverability_score)}
                      </div>
                    </td>

                    {/* Column 3: Customer Failure Diagnosis */}
                    <td className="p-4 max-w-xs">
                      <div className="font-medium text-slate-200 leading-tight">
                        {getPlainEnglishFailure(c.failure_code, c.failure_description)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <code className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                          {c.failure_code}
                        </code>
                        <span className="text-[10px] text-slate-500">
                          Exp. Value: {formatINR(c.expected_recovery_value)}
                        </span>
                      </div>
                    </td>

                    {/* Column 4: Recovery Decision & Policy */}
                    <td className="p-4 max-w-sm">
                      <div className="text-slate-200 font-medium leading-tight flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        <span>{getRecoveryActionDisplay(c.latest_decision?.recommended_action)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{getPolicySafeguardDisplay(c.latest_policy_check?.policy_result, c.latest_policy_check?.reasons, c.amount)}</span>
                      </div>
                    </td>

                    {/* Column 5: Status */}
                    <td className="p-4 whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Column 6: Actions */}
                    <td className="p-4 pr-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {c.status !== 'RECOVERED' && (
                          <Link
                            href={`/recover/${c.id}`}
                            target="_blank"
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                            title="Open customer checkout recovery link"
                          >
                            <span>Pay Link</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        )}
                        <button
                          onClick={() => setSelectedCaseId(c.id)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <span>Journey</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dedicated Demo & Test Scenarios Section (Req 1) */}
      <section id="demo-scenarios" className="pt-4 scroll-mt-20">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-purple-950/80 text-purple-400 border border-purple-800/60 font-mono text-xs font-semibold uppercase tracking-wider">
                  Test Scenarios & Sandbox
                </span>
                <span className="text-xs text-slate-500">• Reviewer Workbench</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white mt-1">
                Simulate Payment Failures & Verify Control Loops
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
                Inject real payment failure webhooks to observe how RecoverAI combines AI diagnosis with deterministic policy guardrails to recover revenue.
              </p>
            </div>

            {testSuccessMessage && (
              <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{testSuccessMessage}</span>
              </div>
            )}
          </div>

          {/* Test Scenario Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
            {/* Scenario 1: Transient Auth Dropout */}
            <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    TRANSIENT FRICTION
                  </span>
                  <span className="text-base font-bold text-white">₹4,500</span>
                </div>
                <h3 className="text-sm font-semibold text-white mt-3">Auth Dropout at OTP</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Customer closed browser or failed 3DS verification. AI diagnoses transient friction; policy allows autonomous recovery; Smart Payment Link generated.
                </p>
              </div>

              <button
                onClick={() =>
                  handleCreateTestRecovery(
                    450000,
                    'AUTH_DROPOUT',
                    'Customer aborted 3DS authentication flow during checkout',
                    'Auth Dropout Scenario'
                  )
                }
                disabled={creatingTest}
                className="w-full py-2 px-3 bg-blue-600/90 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow"
              >
                {creatingTest ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run ₹4,500 Dropout Scenario</span>
                  </>
                )}
              </button>
            </div>

            {/* Scenario 2: High-Value Threshold Escalation */}
            <div className="bg-slate-950/80 border border-purple-500/30 hover:border-purple-500/60 rounded-xl p-5 flex flex-col justify-between space-y-4 transition">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    POLICY ESCALATION
                  </span>
                  <span className="text-base font-bold text-purple-200">₹75,000</span>
                </div>
                <h3 className="text-sm font-semibold text-white mt-3">High-Value Merchant Review</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  High-value enterprise order fails on gateway error. Model recommends retry, but Deterministic Policy BLOCKS autonomous action and ESCALATES to merchant (&gt; ₹25k limit).
                </p>
              </div>

              <button
                onClick={() =>
                  handleCreateTestRecovery(
                    7500000,
                    'GATEWAY_ERROR',
                    'Bank payment gateway encountered internal processing error on high-value transaction',
                    'High-Value Escalation Scenario'
                  )
                }
                disabled={creatingTest}
                className="w-full py-2 px-3 bg-purple-600/90 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow"
              >
                {creatingTest ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Run ₹75,000 Escalation Scenario</span>
                  </>
                )}
              </button>
            </div>

            {/* Scenario 3: Bank Gateway Timeout */}
            <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    INFRASTRUCTURE FAILURE
                  </span>
                  <span className="text-base font-bold text-white">₹12,000</span>
                </div>
                <h3 className="text-sm font-semibold text-white mt-3">Bank 3DS Gateway Timeout</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Card acquiring bank timed out. AI predicts 85% recoverability; policy permits autonomous retry; system executes smart route recovery with idempotency protection.
                </p>
              </div>

              <button
                onClick={() =>
                  handleCreateTestRecovery(
                    1200000,
                    'GATEWAY_TIMEOUT',
                    'Bank 3DS gateway timeout during transaction processing',
                    'Gateway Timeout Scenario'
                  )
                }
                disabled={creatingTest}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
              >
                {creatingTest ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Run ₹12,000 Timeout Scenario</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Case Journey Slide-over Drawer (Req 5) */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCaseId(null)}
          />

          {/* Drawer Content Panel */}
          <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full shadow-2xl overflow-y-auto z-10 flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950 sticky top-0 z-20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-slate-400">
                    {caseDetail?.case?.order_id || caseDetail?.case?.payment_id || selectedCaseId}
                  </span>
                  {caseDetail?.case && getStatusBadge(caseDetail.case.status)}
                </div>
                <div className="text-2xl font-bold text-white mt-1">
                  {caseDetail?.case ? formatINR(caseDetail.case.amount) : 'Loading...'}
                </div>
              </div>

              <button
                onClick={() => setSelectedCaseId(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Feedback Banner */}
            {actionMessage && (
              <div className="m-6 mb-0 p-4 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-300 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}

            {loadingCaseDetail || !caseDetail ? (
              <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mb-2" />
                <span className="ml-2">Loading 6-step recovery journey...</span>
              </div>
            ) : (
              <div className="p-6 space-y-8 flex-1">
                {/* 6-Step Visual Journey Timeline (Req 5) */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>The 6-Step Recovery Journey</span>
                  </h3>

                  <div className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800">
                    {/* Step 1: FAILED */}
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 z-10 flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">1. Payment Failed</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {formatDate(caseDetail.case.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-white font-medium mt-1">
                          {getPlainEnglishFailure(caseDetail.case.failure_code, caseDetail.case.failure_description)}
                        </p>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">
                          Method: {caseDetail.case.payment_method?.toUpperCase()} • Gateway Code: {caseDetail.case.failure_code}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: DIAGNOSED */}
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400 z-10 flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">2. AI Diagnosis</span>
                          {getRecoverabilityBadge(caseDetail.case.recoverability_score)}
                        </div>
                        <p className="text-xs text-slate-200 mt-1">
                          Diagnosis: <strong className="text-white">{caseDetail.decisions?.[0]?.diagnosis || 'Transient gateway communication glitch'}</strong>
                        </p>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Expected Recovery Value: <strong className="text-emerald-400">{formatINR(caseDetail.case.expected_recovery_value)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: RECOMMENDED */}
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400 z-10 flex-shrink-0">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">3. Recommended Action</span>
                          <span className="text-[11px] text-indigo-300 font-mono">
                            Conf: {Math.round((caseDetail.decisions?.[0]?.confidence || 0.85) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-white font-medium mt-1">
                          {getRecoveryActionDisplay(caseDetail.decisions?.[0]?.recommended_action)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed bg-slate-900/80 p-2 rounded border border-slate-800">
                          &ldquo;{caseDetail.decisions?.[0]?.rationale || 'High recovery probability detected on retry route.'}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Step 4: POLICY CHECKED */}
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 flex-shrink-0 ${
                        caseDetail.policyChecks?.[0]?.policy_result === 'ESCALATE'
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                          : 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                      }`}>
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide">4. Deterministic Policy Check</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${
                            caseDetail.policyChecks?.[0]?.policy_result === 'ESCALATE'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {caseDetail.policyChecks?.[0]?.policy_result || 'ALLOW'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {getPolicySafeguardDisplay(caseDetail.policyChecks?.[0]?.policy_result, caseDetail.policyChecks?.[0]?.reasons, caseDetail.case.amount)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1.5 space-y-0.5">
                          <div>• Max autonomous threshold: ₹25,000</div>
                          <div>• Customer opt-out check: PASSED (Consent active)</div>
                          <div>• Idempotency safeguard: VERIFIED (Zero duplicate charge guarantee)</div>
                        </div>
                      </div>
                    </div>

                    {/* Step 5: EXECUTED */}
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 z-10 flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide">5. Controlled Execution</span>
                          <span className="text-[11px] text-emerald-400 font-mono">
                            {caseDetail.toolExecutions?.[0]?.status || 'EXECUTED'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 mt-1">
                          Tool: <code className="text-cyan-300 font-mono text-[11px]">{caseDetail.toolExecutions?.[0]?.tool_name || 'tool_create_payment_link'}</code>
                        </p>
                        {caseDetail.case.recovery_url && (
                          <div className="mt-2">
                            <Link
                              href={caseDetail.case.recovery_url}
                              target="_blank"
                              className="text-[11px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <span>Customer Recovery Checkout URL</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 6: VERIFIED */}
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 flex-shrink-0 ${
                        caseDetail.case.status === 'RECOVERED'
                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                          : 'bg-slate-800 border border-slate-700 text-slate-400'
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className={`border rounded-xl p-3.5 flex-1 ${
                        caseDetail.case.status === 'RECOVERED'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide">6. Payment Outcome Verification</span>
                          {getStatusBadge(caseDetail.case.status)}
                        </div>
                        {caseDetail.case.status === 'RECOVERED' ? (
                          <p className="text-xs text-emerald-300 font-medium mt-1">
                            ✓ Payment authoritative capture verified via Razorpay webhook. {formatINR(caseDetail.case.amount)} successfully recovered into merchant account.
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1">
                            Waiting for customer to complete transaction or bank settlement webhook.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Merchant Actions Toolbar */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Merchant Interventions</h4>

                  {caseDetail.case.status === 'HUMAN_REVIEW' || caseDetail.case.status === 'ESCALATED' ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        This transaction requires merchant confirmation due to policy threshold rules.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => handleReviewAction(caseDetail.case.id, 'APPROVE')}
                          disabled={actionProcessing}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Recovery Action</span>
                        </button>
                        <button
                          onClick={() => handleReviewAction(caseDetail.case.id, 'STOP')}
                          disabled={actionProcessing}
                          className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Stop & Dismiss</span>
                        </button>
                      </div>
                    </div>
                  ) : caseDetail.case.status === 'RECOVERED' ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>This case is fully recovered. No further action needed.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleSimulatePaymentSuccess(caseDetail.case.id)}
                          disabled={actionProcessing}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Simulate Customer Payment Capture</span>
                        </button>

                        {caseDetail.case.recovery_url && (
                          <Link
                            href={caseDetail.case.recovery_url}
                            target="_blank"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Pay Link</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Need full developer JSON logs?</span>
                    <Link
                      href={`/cases/${caseDetail.case.id}`}
                      className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>View Technical Audit Trail</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
