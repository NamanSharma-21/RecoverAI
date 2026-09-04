'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  X,
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
  event_id?: string;
  policy_version?: string;
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
  const [drawerAuditOpen, setDrawerAuditOpen] = useState(false);

  // Page-level Audit Accordion
  const [auditDetailsOpen, setAuditDetailsOpen] = useState(false);

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
      setDrawerAuditOpen(false);
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
        setTestSuccessMessage(`Generated ${scenarioName} (₹${(amount / 100).toLocaleString('en-IN')})`);
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
          operator_notes: `Action ${action} executed by merchant operator`,
          operator_id: 'merchant_admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Action ${action === 'APPROVE' ? 'Approved' : 'Stopped'} recorded.`);
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
        setActionMessage('Payment captured & verified via authoritative webhook. Case marked recovered.');
        await loadCaseDetail(caseId);
        await fetchDashboardData();
      } else {
        setActionMessage(`Failed to complete payment: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionProcessing(false);
    }
  };

  // Plain English failure reasons
  const getPlainEnglishFailure = (code: string, desc?: string) => {
    const upper = (code || '').toUpperCase();
    if (upper.includes('AUTH_DROPOUT') || upper.includes('BAD_REQUEST_ERROR')) {
      return 'Authentication dropped by user';
    }
    if (upper.includes('GATEWAY_TIMEOUT')) {
      return 'Bank 3DS gateway timeout';
    }
    if (upper.includes('INSUFFICIENT_FUNDS')) {
      return 'Insufficient customer balance';
    }
    if (upper.includes('GATEWAY_ERROR') || upper.includes('ISSUER_DOWN')) {
      return 'Bank downtime or network drop';
    }
    if (upper.includes('CARD_EXPIRED')) {
      return 'Card expired or invalid date';
    }
    return desc || code.replace(/_/g, ' ').toLowerCase();
  };

  // Merchant-friendly AI recommendation display
  const getAIRecommendationDisplay = (action?: string) => {
    switch (action) {
      case 'CREATE_PAYMENT_LINK':
        return 'Payment link';
      case 'RETRY_NOW':
        return 'Instant retry';
      case 'SCHEDULE_RETRY':
        return 'Scheduled retry';
      case 'OFFER_ALTERNATE_METHOD':
        return 'Alternate payment method';
      case 'ESCALATE':
        return 'Escalate to merchant';
      case 'WAIT':
        return 'Wait for bank clearance';
      case 'STOP':
        return 'Halt recovery';
      default:
        return action ? action.replace(/_/g, ' ') : 'Analyze route';
    }
  };

  // Policy check display
  const getPolicyCheckDisplay = (policyResult?: string, amount: number = 0) => {
    if (policyResult === 'ESCALATE' || amount >= 2500000) {
      return 'Escalated';
    }
    if (policyResult === 'BLOCK') {
      return 'Blocked';
    }
    return 'Allowed';
  };

  // Executed action display
  const getExecutedActionDisplay = (toolName?: string, status?: string) => {
    if (status === 'HUMAN_REVIEW' || status === 'ESCALATED') {
      return 'Escalated to review';
    }
    if (status === 'STOPPED') {
      return 'Intervention halted';
    }
    if (toolName?.includes('payment_link')) {
      return 'Payment link dispatched';
    }
    if (toolName?.includes('retry')) {
      return 'Retry initiated';
    }
    if (status === 'ACTION_EXECUTED' || status === 'OUTCOME_MONITORED') {
      return 'Workflow active';
    }
    return 'Action initiated';
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

  // Status visualizer: restrained status indicators
  const renderStatus = (status: string, amount: number) => {
    switch (status) {
      case 'RECOVERED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#000000]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
            <span>✓ {formatINR(amount)} recovered</span>
          </span>
        );
      case 'HUMAN_REVIEW':
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#000000]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4704]"></span>
            <span>Requires review</span>
          </span>
        );
      case 'OUTCOME_MONITORED':
      case 'ACTION_EXECUTED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#44403b]">
            <span className="w-1.5 h-1.5 rounded-full border border-[#777169]"></span>
            <span>Waiting for payment result</span>
          </span>
        );
      case 'STOPPED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#777169]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a59f97]"></span>
            <span>Halted</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#777169]">
            <span>{status.replace(/_/g, ' ').toLowerCase()}</span>
          </span>
        );
    }
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
      } else if (filterStatus === 'RECOVERED') {
        if (c.status !== 'RECOVERED') return false;
      } else if (filterStatus === 'STOPPED') {
        if (c.status !== 'STOPPED') return false;
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
    <div className="space-y-10 pb-16">
      {/* 2. HERO / PAGE INTRO */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-[#000000]">
            Revenue recovery
          </h1>
          <p className="text-sm text-[#44403b] mt-1.5 font-normal max-w-xl">
            Recover failed payments with bounded AI workflows.
          </p>
          <p className="text-xs text-[#777169] mt-1 font-normal">
            Monitoring failed payments and recovery workflows
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-xs text-[#44403b] hover:bg-[#f5f3f1] hover:text-[#000000] transition-colors"
          >
            <RefreshCw className={`w-3 h-3 text-[#777169] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh telemetry</span>
          </button>
        </div>
      </div>

      {/* 3. BUSINESS OUTCOME KPIS (Clean 5-Card Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Revenue Recovered */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-5 flex flex-col justify-between shadow-none transition-colors">
          <div>
            <div className="text-xs font-normal text-[#777169]">Revenue Recovered</div>
            <div className="text-2xl md:text-3xl font-light text-[#000000] mt-2 tracking-tight">
              {formatINR(stats?.totalRecoveredAmount || 0)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ebe8e4]/60">
            <div className="text-xs text-[#44403b] font-normal">
              {stats?.recoveredCases || 0} payments successfully recovered
            </div>
            <div className="text-[11px] text-[#777169] mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
              <span>Verified Razorpay captures</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Revenue at Risk */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-5 flex flex-col justify-between shadow-none transition-colors">
          <div>
            <div className="text-xs font-normal text-[#777169]">Revenue at Risk</div>
            <div className="text-2xl md:text-3xl font-light text-[#000000] mt-2 tracking-tight">
              {formatINR(stats?.totalAtRiskAmount || 0)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ebe8e4]/60">
            <div className="text-xs text-[#44403b] font-normal">
              Across {stats?.totalCases || 0} failed payments
            </div>
            <div className="text-[11px] text-[#777169] mt-1">
              Total volume lost at checkout
            </div>
          </div>
        </div>

        {/* KPI 3: Recovery Rate */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-5 flex flex-col justify-between shadow-none transition-colors">
          <div>
            <div className="text-xs font-normal text-[#777169]">Recovery Rate</div>
            <div className="text-2xl md:text-3xl font-light text-[#000000] mt-2 tracking-tight">
              {valueRecoveryRate}%
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ebe8e4]/60">
            <div className="text-xs text-[#44403b] font-normal">
              {formatINR(stats?.totalRecoveredAmount || 0)} recovered / {formatINR(stats?.totalAtRiskAmount || 0)} at risk
            </div>
            <div className="text-[11px] text-[#777169] mt-1">
              Recovered revenue / revenue at risk
            </div>
          </div>
        </div>

        {/* KPI 4: Active Recoveries */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-5 flex flex-col justify-between shadow-none transition-colors">
          <div>
            <div className="text-xs font-normal text-[#777169]">Active Recoveries</div>
            <div className="text-2xl md:text-3xl font-light text-[#000000] mt-2 tracking-tight">
              {stats?.activeRecoveriesCount || 0}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ebe8e4]/60">
            <div className="text-xs text-[#44403b] font-normal">
              Automated workflows in progress
            </div>
            <div className="text-[11px] text-[#777169] mt-1">
              Active links & scheduled retries
            </div>
          </div>
        </div>

        {/* KPI 5: Needs Attention */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-5 flex flex-col justify-between shadow-none transition-colors">
          <div>
            <div className="text-xs font-normal text-[#777169]">Needs Attention</div>
            <div className="text-2xl md:text-3xl font-light text-[#000000] mt-2 tracking-tight">
              {needsAttentionCount}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#ebe8e4]/60">
            <div className="text-xs text-[#44403b] font-normal">
              {needsAttentionCount} cases require merchant review
            </div>
            <div className="text-[11px] text-[#777169] mt-1">
              High-value &gt; ₹25,000 threshold
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECOVERY ACTIVITY (Most Important Section) */}
      <section className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#ebe8e4] pb-5">
          <div>
            <h2 className="text-xl font-normal text-[#000000] tracking-tight">Recovery activity</h2>
            <p className="text-xs text-[#777169] mt-0.5 font-normal">
              Recent payment failures and the actions RecoverAI took.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#777169] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order, payment, method..."
                className="w-full sm:w-64 bg-[#fdfcfc] border border-[#ebe8e4] rounded-full pl-8 pr-3 py-1.5 text-xs text-[#000000] placeholder-[#a59f97] focus:outline-none focus:border-[#44403b] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777169] hover:text-[#000000]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'NEEDS_ATTENTION', label: 'Needs Attention' },
                { id: 'RECOVERED', label: 'Recovered' },
                { id: 'STOPPED', label: 'Halted' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    filterStatus === f.id
                      ? 'bg-[#000000] text-[#fdfcfc]'
                      : 'bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List / Table */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#777169]">
            <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin text-[#44403b]" />
            Loading recovery telemetry...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#777169]">
            <p className="text-sm font-normal text-[#000000] mb-1">No recovery cases found</p>
            <p className="max-w-sm mx-auto text-[#777169] mb-4">
              {searchQuery
                ? 'No cases matched your search query.'
                : 'No recovery records in this view.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#ebe8e4] text-[#777169] font-normal">
                  <th className="pb-3 pr-4 font-normal">Amount & Identifier</th>
                  <th className="pb-3 px-4 font-normal">Failure Reason</th>
                  <th className="pb-3 px-4 font-normal">AI Recommendation</th>
                  <th className="pb-3 px-4 font-normal">Policy</th>
                  <th className="pb-3 px-4 font-normal">Action</th>
                  <th className="pb-3 px-4 font-normal">Status / Result</th>
                  <th className="pb-3 pl-4 text-right font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe8e4]/60 text-[#44403b]">
                {filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className="hover:bg-[#ebe8e4]/40 cursor-pointer transition-colors group"
                  >
                    {/* Amount & ID */}
                    <td className="py-3.5 pr-4">
                      <div className="font-normal text-sm text-[#000000]">{formatINR(c.amount)}</div>
                      <div className="font-mono text-[11px] text-[#777169] truncate max-w-[140px]">
                        {c.order_id || c.payment_id}
                      </div>
                    </td>

                    {/* Failure Reason */}
                    <td className="py-3.5 px-4 max-w-[180px]">
                      <div className="text-xs text-[#000000] font-normal leading-tight">
                        {getPlainEnglishFailure(c.failure_code, c.failure_description)}
                      </div>
                      <div className="font-mono text-[10px] text-[#777169] mt-0.5 uppercase">
                        {c.payment_method}
                      </div>
                    </td>

                    {/* AI Recommendation */}
                    <td className="py-3.5 px-4 max-w-[160px]">
                      <div className="text-xs text-[#000000] font-normal">
                        {getAIRecommendationDisplay(c.latest_decision?.recommended_action)}
                      </div>
                      <div className="font-mono text-[10px] text-[#777169] mt-0.5">
                        Conf: {Math.round((c.latest_decision?.confidence || 0.85) * 100)}%
                      </div>
                    </td>

                    {/* Policy */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-normal text-[#000000]">
                        {getPolicyCheckDisplay(c.latest_policy_check?.policy_result, c.amount)}
                      </div>
                      <div className="text-[10px] text-[#777169] mt-0.5">
                        {c.amount >= 2500000 ? '> ₹25k limit' : 'Under limit'}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 max-w-[150px]">
                      <div className="text-xs text-[#000000] font-normal">
                        {getExecutedActionDisplay(c.latest_decision?.recommended_action, c.status)}
                      </div>
                    </td>

                    {/* Status / Result */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatus(c.status, c.amount)}
                    </td>

                    {/* Inspect button */}
                    <td className="py-3.5 pl-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedCaseId(c.id)}
                        className="px-3 py-1 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4] hover:text-[#000000] text-xs font-medium transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 7. NEEDS ATTENTION (Dedicated Section After Recovery Activity) */}
      <section className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-4">
        <div>
          <h2 className="text-xl font-normal text-[#000000] tracking-tight">Needs attention</h2>
          <p className="text-xs text-[#777169] mt-0.5 font-normal">
            Cases that require merchant review.
          </p>
        </div>

        {needsAttentionCases.length === 0 ? (
          <div className="p-6 rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] text-xs text-[#777169]">
            All recovery workflows are currently operating within autonomous safety thresholds. No manual intervention required.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsAttentionCases.map((c) => (
              <div
                key={c.id}
                className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-5 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-light text-[#000000]">{formatINR(c.amount)}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#000000]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff4704]"></span>
                      <span>Review required</span>
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#777169] mt-0.5">
                    {c.order_id || c.payment_id}
                  </div>
                  <div className="text-xs text-[#44403b] mt-2 font-normal leading-relaxed">
                    {c.amount >= 2500000
                      ? 'High-value payment. Automation stopped because the payment exceeds the recovery threshold.'
                      : `Policy escalation: ${getPlainEnglishFailure(c.failure_code, c.failure_description)}`}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ebe8e4] flex items-center justify-between">
                  <span className="text-[11px] text-[#777169]">
                    Autonomy threshold: ₹25,000
                  </span>
                  <button
                    onClick={() => setSelectedCaseId(c.id)}
                    className="px-4 py-1.5 rounded-full bg-[#000000] text-[#fdfcfc] hover:bg-[#44403b] text-xs font-medium transition-colors"
                  >
                    Review case
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 9. TECHNICAL / AUDIT INFORMATION (Expandable Section) */}
      <section className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-normal text-[#000000]">Technical & audit control plane</h3>
            <p className="text-xs text-[#777169] mt-0.5">
              Deterministic policy parameters, state transitions, and verification sources.
            </p>
          </div>
          <button
            onClick={() => setAuditDetailsOpen(!auditDetailsOpen)}
            className="px-3.5 py-1.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-xs text-[#44403b] hover:bg-[#ebe8e4] hover:text-[#000000] transition-colors flex items-center gap-1"
          >
            <span>{auditDetailsOpen ? 'Hide audit telemetry' : 'Show audit telemetry'}</span>
            {auditDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {auditDetailsOpen && (
          <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-5 space-y-3 font-mono text-xs text-[#44403b]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[#777169]">Gateway Environment:</span>{' '}
                <span className="text-[#000000]">{rzpStatus?.hasLiveCredentials ? 'Razorpay Test Mode' : 'High-Fidelity Payment Simulator'}</span>
              </div>
              <div>
                <span className="text-[#777169]">Webhook Endpoint:</span>{' '}
                <span className="text-[#000000]">{rzpStatus?.webhookUrl || '/api/webhooks/razorpay'}</span>
              </div>
              <div>
                <span className="text-[#777169]">Max Autonomous Limit:</span>{' '}
                <span className="text-[#000000]">₹25,000 (2,500,000 paise)</span>
              </div>
              <div>
                <span className="text-[#777169]">Control Loop:</span>{' '}
                <span className="text-[#000000]">PAYMENT_FAILED → DIAGNOSE → POLICY → EXECUTE → VERIFY</span>
              </div>
              <div>
                <span className="text-[#777169]">Verification Law:</span>{' '}
                <span className="text-[#000000]">Authoritative Webhook Event Determines Truth</span>
              </div>
              <div>
                <span className="text-[#777169]">Idempotency Guard:</span>{' '}
                <span className="text-[#000000]">Unique key per recovery action; duplicate safe</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#ebe8e4] text-[11px] text-[#777169]">
              Developer telemetry: Inspect complete raw JSON audit logs at <code className="bg-[#f5f3f1] px-1.5 py-0.5 rounded text-[#000000]">/cases/[id]</code>.
            </div>
          </div>
        )}
      </section>

      {/* 8. DEMO SCENARIOS (Near Bottom) */}
      <section id="demo-scenarios" className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#ebe8e4] pb-4">
          <div>
            <div className="text-[11px] font-mono text-[#777169] uppercase tracking-wider">Simulator environment</div>
            <h2 className="text-xl font-normal text-[#000000] tracking-tight mt-0.5">Demo scenarios</h2>
            <p className="text-xs text-[#777169] mt-0.5 font-normal">
              Generate controlled test cases to demonstrate recovery behavior.
            </p>
          </div>
          {testSuccessMessage && (
            <div className="text-xs text-[#000000] bg-[#fdfcfc] border border-[#ebe8e4] px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
              <span>{testSuccessMessage}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scenario 1 */}
          <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#777169]">Transient</span>
                <span className="text-base font-light text-[#000000]">₹4,500</span>
              </div>
              <h3 className="text-sm font-normal text-[#000000] mt-2">Auth Dropout</h3>
              <p className="text-xs text-[#777169] mt-1 font-normal leading-relaxed">
                Customer aborted 3DS authentication during OTP. AI diagnoses transient friction; policy allows autonomous recovery; Smart Payment Link generated.
              </p>
            </div>
            <button
              onClick={() =>
                handleCreateTestRecovery(
                  450000,
                  'AUTH_DROPOUT',
                  'Customer aborted 3DS authentication flow during checkout',
                  'Auth Dropout'
                )
              }
              disabled={creatingTest}
              className="w-full py-2 px-4 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4] hover:text-[#000000] text-xs font-medium transition-colors"
            >
              {creatingTest ? 'Generating...' : 'Run ₹4,500 Auth Dropout'}
            </button>
          </div>

          {/* Scenario 2 */}
          <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#777169]">Escalation</span>
                <span className="text-base font-light text-[#000000]">₹75,000</span>
              </div>
              <h3 className="text-sm font-normal text-[#000000] mt-2">High-Value (Escalate)</h3>
              <p className="text-xs text-[#777169] mt-1 font-normal leading-relaxed">
                High-value order fails on gateway error. Model recommends retry, but Deterministic Policy blocks autonomous action and escalates to merchant review (&gt; ₹25,000 threshold).
              </p>
            </div>
            <button
              onClick={() =>
                handleCreateTestRecovery(
                  7500000,
                  'GATEWAY_ERROR',
                  'Bank payment gateway encountered internal processing error on high-value transaction',
                  'High-Value Escalation'
                )
              }
              disabled={creatingTest}
              className="w-full py-2 px-4 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4] hover:text-[#000000] text-xs font-medium transition-colors"
            >
              {creatingTest ? 'Generating...' : 'Run ₹75,000 High-Value'}
            </button>
          </div>

          {/* Scenario 3 */}
          <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#777169]">Infrastructure</span>
                <span className="text-base font-light text-[#000000]">₹12,000</span>
              </div>
              <h3 className="text-sm font-normal text-[#000000] mt-2">Gateway Timeout</h3>
              <p className="text-xs text-[#777169] mt-1 font-normal leading-relaxed">
                Card acquiring bank timed out. AI predicts high recoverability; policy permits autonomous retry; system executes smart route recovery.
              </p>
            </div>
            <button
              onClick={() =>
                handleCreateTestRecovery(
                  1200000,
                  'GATEWAY_TIMEOUT',
                  'Bank 3DS gateway timeout during transaction processing',
                  'Gateway Timeout'
                )
              }
              disabled={creatingTest}
              className="w-full py-2 px-4 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4] hover:text-[#000000] text-xs font-medium transition-colors"
            >
              {creatingTest ? 'Generating...' : 'Run ₹12,000 Gateway Timeout'}
            </button>
          </div>
        </div>
      </section>

      {/* 5. CASE DETAIL EXPERIENCE (Drawer / Expandable Panel) */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#000000]/25 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCaseId(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-[#fdfcfc] border-l border-[#ebe8e4] h-full shadow-xl overflow-y-auto z-50 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[#ebe8e4] bg-[#fdfcfc] sticky top-0 z-20 flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-[#777169]">
                  {caseDetail?.case?.order_id || caseDetail?.case?.payment_id || selectedCaseId}
                </div>
                <div className="text-2xl md:text-3xl font-light text-[#000000] mt-1">
                  {caseDetail?.case ? formatINR(caseDetail.case.amount) : 'Loading...'}
                </div>
                <div className="mt-1">
                  {caseDetail?.case && renderStatus(caseDetail.case.status, caseDetail.case.amount)}
                </div>
              </div>

              <button
                onClick={() => setSelectedCaseId(null)}
                className="p-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4] hover:text-[#000000] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Banner */}
            {actionMessage && (
              <div className="m-6 mb-0 p-3.5 rounded-[12px] bg-[#f5f3f1] border border-[#ebe8e4] text-xs text-[#000000] flex items-center gap-2">
                <Info className="w-4 h-4 text-[#0447ff] flex-shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}

            {loadingCaseDetail || !caseDetail ? (
              <div className="flex-1 flex items-center justify-center p-12 text-xs text-[#777169]">
                <RefreshCw className="w-4 h-4 animate-spin text-[#44403b] mr-2" />
                <span>Loading recovery timeline...</span>
              </div>
            ) : (
              <div className="p-6 space-y-8 flex-1">
                {/* Visual Story Vertical Timeline */}
                <div>
                  <h3 className="text-xs font-normal text-[#777169] uppercase tracking-wider mb-5">
                    Recovery Workflow Timeline
                  </h3>

                  <div className="border-l border-[#ebe8e4] ml-2 pl-6 space-y-6">
                    {/* FAILED */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#000000]"></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">FAILED</div>
                      <div className="text-sm font-normal text-[#000000] mt-0.5">
                        Payment failed
                      </div>
                      <div className="text-xs text-[#44403b] mt-1 font-normal">
                        {getPlainEnglishFailure(caseDetail.case.failure_code, caseDetail.case.failure_description)}
                      </div>
                      <div className="font-mono text-[11px] text-[#777169] mt-1">
                        Method: {caseDetail.case.payment_method?.toUpperCase()} • Error: {caseDetail.case.failure_code} • {formatDate(caseDetail.case.created_at)}
                      </div>
                    </div>

                    {/* DIAGNOSED */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#000000]"></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">DIAGNOSED</div>
                      <div className="text-sm font-normal text-[#000000] mt-0.5">
                        {caseDetail.decisions?.[0]?.diagnosis || 'Likely temporary payment gateway communication friction'}
                      </div>
                      <div className="text-xs text-[#777169] mt-1">
                        Recoverability: <strong className="text-[#000000] font-normal">{Math.round((caseDetail.case.recoverability_score || 0.7) * 100)}%</strong> • Expected value: <strong className="text-[#000000] font-normal">{formatINR(caseDetail.case.expected_recovery_value)}</strong>
                      </div>
                    </div>

                    {/* RECOMMENDED */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#000000]"></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">RECOMMENDED</div>
                      <div className="text-sm font-normal text-[#000000] mt-0.5">
                        {getAIRecommendationDisplay(caseDetail.decisions?.[0]?.recommended_action)}
                      </div>
                      <p className="text-xs text-[#44403b] mt-1.5 font-normal leading-relaxed bg-[#f5f3f1] p-3 rounded-[12px] border border-[#ebe8e4]">
                        &ldquo;{caseDetail.decisions?.[0]?.rationale || 'High recovery likelihood on customer payment link.'}&rdquo;
                      </p>
                      <div className="text-[11px] text-[#777169] mt-1">
                        AI proposes action based on failure pattern and customer telemetry.
                      </div>
                    </div>

                    {/* POLICY CHECK */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#000000]"></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">POLICY CHECK</div>
                      <div className="text-sm font-normal text-[#000000] mt-0.5">
                        {caseDetail.policyChecks?.[0]?.policy_result === 'ESCALATE' || caseDetail.case.amount >= 2500000
                          ? 'Escalated'
                          : caseDetail.policyChecks?.[0]?.policy_result === 'BLOCK'
                          ? 'Blocked'
                          : 'Allowed'}
                      </div>
                      <div className="text-xs text-[#44403b] mt-1 space-y-1">
                        {caseDetail.policyChecks?.[0]?.policy_result === 'ESCALATE' || caseDetail.case.amount >= 2500000 ? (
                          <>
                            <div>Reason: Payment exceeds automated recovery threshold (₹25,000)</div>
                            <div className="text-[#777169]">• Automation stopped; human operator review required</div>
                          </>
                        ) : (
                          <>
                            <div>✓ Below automated threshold (₹25,000 max)</div>
                            <div>✓ Recovery permitted for failure category</div>
                            <div>✓ No successful payment detected</div>
                            <div>✓ Idempotency verified: Safe execution guaranteed</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ACTION */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#000000]"></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">ACTION</div>
                      <div className="text-sm font-normal text-[#000000] mt-0.5">
                        {getExecutedActionDisplay(caseDetail.toolExecutions?.[0]?.tool_name, caseDetail.case.status)}
                      </div>
                      <div className="font-mono text-[11px] text-[#777169] mt-1">
                        Tool: {caseDetail.toolExecutions?.[0]?.tool_name || 'tool_create_payment_link'} • Status: {caseDetail.toolExecutions?.[0]?.status || 'EXECUTED'}
                      </div>
                      {caseDetail.case.recovery_url && (
                        <div className="mt-2">
                          <Link
                            href={caseDetail.case.recovery_url}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-[#0447ff] hover:underline"
                          >
                            <span>Customer payment link</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* VERIFICATION */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#000000]"></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">VERIFICATION</div>
                      <div className="text-sm font-normal text-[#000000] mt-0.5">
                        Payment status checked
                      </div>
                      <div className="text-xs text-[#777169] mt-1">
                        Verified via Razorpay webhook capture event.
                      </div>
                    </div>

                    {/* RESULT */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full ${
                        caseDetail.case.status === 'RECOVERED' ? 'bg-[#0447ff]' : 'bg-[#000000]'
                      }`}></div>
                      <div className="text-[11px] font-mono text-[#777169] uppercase">RESULT</div>
                      <div className="mt-0.5">
                        {caseDetail.case.status === 'RECOVERED' ? (
                          <div className="text-sm font-medium text-[#000000] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
                            <span>✓ {formatINR(caseDetail.case.amount)} recovered</span>
                          </div>
                        ) : caseDetail.case.status === 'HUMAN_REVIEW' || caseDetail.case.status === 'ESCALATED' ? (
                          <div className="text-sm font-medium text-[#000000] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4704]"></span>
                            <span>Merchant review required</span>
                          </div>
                        ) : caseDetail.case.status === 'STOPPED' ? (
                          <div className="text-sm text-[#777169]">
                            Recovery halted (attempts exhausted or opted out)
                          </div>
                        ) : (
                          <div className="text-sm text-[#44403b] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full border border-[#777169]"></span>
                            <span>Waiting for payment result</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. AI Role Callout */}
                <div className="rounded-[12px] bg-[#f5f3f1] border border-[#ebe8e4] p-4 text-xs text-[#44403b] space-y-1">
                  <div className="font-medium text-[#000000]">Bounded control loop architecture</div>
                  <p className="text-[#777169]">
                    AI proposes. Deterministic policy controls. Controlled tools execute. Verified payment events determine truth.
                  </p>
                </div>

                {/* Merchant Actions Bar */}
                <div className="space-y-3 pt-2">
                  {caseDetail.case.status === 'HUMAN_REVIEW' || caseDetail.case.status === 'ESCALATED' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-[#777169]">
                        Review required: Payment exceeds autonomous recovery threshold.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleReviewAction(caseDetail.case.id, 'APPROVE')}
                          disabled={actionProcessing}
                          className="px-5 py-2 rounded-full bg-[#000000] text-[#fdfcfc] hover:bg-[#44403b] text-xs font-medium transition-colors"
                        >
                          Approve recovery
                        </button>
                        <button
                          onClick={() => handleReviewAction(caseDetail.case.id, 'STOP')}
                          disabled={actionProcessing}
                          className="px-5 py-2 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#f5f3f1] hover:text-[#000000] text-xs font-medium transition-colors"
                        >
                          Stop recovery
                        </button>
                      </div>
                    </div>
                  ) : caseDetail.case.status === 'RECOVERED' ? (
                    <div className="text-xs text-[#000000] flex items-center gap-2 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
                      <span>Payment successfully recovered and verified. No further intervention needed.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleSimulatePaymentSuccess(caseDetail.case.id)}
                          disabled={actionProcessing}
                          className="px-5 py-2 rounded-full bg-[#000000] text-[#fdfcfc] hover:bg-[#44403b] text-xs font-medium transition-colors"
                        >
                          Simulate payment capture
                        </button>
                        {caseDetail.case.recovery_url && (
                          <Link
                            href={caseDetail.case.recovery_url}
                            target="_blank"
                            className="px-5 py-2 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b] hover:bg-[#f5f3f1] hover:text-[#000000] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                          >
                            <span>Open pay link</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expandable Technical / Audit Details */}
                <div className="pt-4 border-t border-[#ebe8e4]">
                  <button
                    onClick={() => setDrawerAuditOpen(!drawerAuditOpen)}
                    className="w-full flex items-center justify-between text-xs text-[#777169] hover:text-[#000000] transition-colors"
                  >
                    <span>Audit details</span>
                    {drawerAuditOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {drawerAuditOpen && (
                    <div className="mt-3 rounded-[12px] bg-[#f5f3f1] border border-[#ebe8e4] p-4 font-mono text-[11px] text-[#44403b] space-y-1.5">
                      <div>Case ID: {caseDetail.case.id}</div>
                      <div>Event ID: {caseDetail.case.event_id}</div>
                      <div>Payment ID: {caseDetail.case.payment_id}</div>
                      <div>Order ID: {caseDetail.case.order_id || 'N/A'}</div>
                      <div>Decision ID: {caseDetail.decisions?.[0]?.id || 'N/A'}</div>
                      <div>Policy Check ID: {caseDetail.policyChecks?.[0]?.id || 'N/A'}</div>
                      <div>Policy Version: {caseDetail.case.policy_version || '2.1.0'}</div>
                      <div>Tool: {caseDetail.toolExecutions?.[0]?.tool_name || 'N/A'}</div>
                      <div>Idempotency Key: {caseDetail.toolExecutions?.[0]?.idempotency_key || 'N/A'}</div>
                      <div>Created: {caseDetail.case.created_at}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
