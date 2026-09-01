'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface PolicySettings {
  autonomous_limit_inr: number;
  bounded_limit_inr: number;
  human_approval_above_inr: number;
  max_interventions_per_case: number;
  recovery_cooldown_minutes: number;
  max_contact_frequency_hours: number;
  min_confidence_for_autonomous_action: number;
  policy_version: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PolicySettings>({
    autonomous_limit_inr: 500000,
    bounded_limit_inr: 2500000,
    human_approval_above_inr: 2500000,
    max_interventions_per_case: 2,
    recovery_cooldown_minutes: 15,
    max_contact_frequency_hours: 12,
    min_confidence_for_autonomous_action: 0.65,
    policy_version: '2.1.0',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <Link href="/" className="text-slate-400 hover:text-white text-xs">
              ← Back to Recovery Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-slate-200">Merchant Recovery Policy Settings</span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Policy Version: <span className="text-blue-400">{settings.policy_version}</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Merchant Policy & Guardrails Configuration</h1>
          <p className="text-xs text-slate-400 mt-1">
            These rules dynamically control the deterministic policy engine. The AI cannot bypass these boundaries.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
            <span>✓</span>
            <span>Policy configuration saved to SQLite database. Real-time control loop updated.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          
          {/* Section 1: Financial Limits */}
          <div>
            <h3 className="text-sm font-bold text-white mb-1">1. Tiered Financial Limits & Thresholds</h3>
            <p className="text-xs text-slate-400 mb-4">
              Determines when RecoverAI acts autonomously vs requiring operator review.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Autonomous Recovery Limit (₹)
                </label>
                <div className="text-[11px] text-slate-400 mb-2">
                  Transactions under this amount are automatically recovered.
                </div>
                <input
                  type="number"
                  value={settings.autonomous_limit_inr / 100}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autonomous_limit_inr: Number(e.target.value) * 100,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mandatory Human Review Threshold (₹)
                </label>
                <div className="text-[11px] text-slate-400 mb-2">
                  Orders exceeding this value strictly escalate to operator review.
                </div>
                <input
                  type="number"
                  value={settings.human_approval_above_inr / 100}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      human_approval_above_inr: Number(e.target.value) * 100,
                      bounded_limit_inr: Number(e.target.value) * 100,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Intervention Limits & Cooldowns */}
          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-sm font-bold text-white mb-1">2. Recovery Frequency & Intervention Budget</h3>
            <p className="text-xs text-slate-400 mb-4">
              Guards against excessive customer contact and gateway spam.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Max Interventions Per Case
                </label>
                <div className="text-[11px] text-slate-400 mb-2">
                  Capped number of retry/link actions.
                </div>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={settings.max_interventions_per_case}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_interventions_per_case: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Recovery Cooldown (Minutes)
                </label>
                <div className="text-[11px] text-slate-400 mb-2">
                  Delay before next scheduled retry.
                </div>
                <input
                  type="number"
                  min={1}
                  value={settings.recovery_cooldown_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      recovery_cooldown_minutes: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Min AI Confidence Required
                </label>
                <div className="text-[11px] text-slate-400 mb-2">
                  Low-confidence cases escalate.
                </div>
                <input
                  type="number"
                  step="0.05"
                  min={0.1}
                  max={0.99}
                  value={settings.min_confidence_for_autonomous_action}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      min_confidence_for_autonomous_action: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="border-t border-slate-800 pt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition shadow-lg shadow-blue-600/25"
            >
              {saving ? 'Saving Policy...' : 'Save Policy Changes'}
            </button>
          </div>

        </form>
    </div>
  );
}
