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
    <div className="space-y-8 pb-16">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between border-b border-[#ebe8e4] pb-4">
        <div className="flex items-center space-x-3 text-xs">
          <Link href="/" className="text-[#777169] hover:text-[#000000] transition-colors">
            ← Back to Dashboard
          </Link>
          <span className="text-[#ebe8e4]">/</span>
          <span className="text-[#000000] font-normal">Policy Guardrails Configuration</span>
        </div>

        <div className="text-xs font-mono text-[#777169]">
          Policy Version: <span className="text-[#000000] font-medium">{settings.policy_version}</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-light text-[#000000] tracking-tight">
          Merchant policy & guardrails configuration
        </h1>
        <p className="text-xs md:text-sm text-[#44403b] mt-1.5 max-w-3xl font-normal leading-relaxed">
          Deterministic boundaries enforced before any recovery action executes. The AI cannot bypass these limits.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-[#f5f3f1] border border-[#ebe8e4] rounded-[16px] text-[#000000] text-xs flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
          <span>Policy configuration saved to SQLite database. Real-time control loop updated.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-6">
        {/* Section 1: Financial Limits */}
        <div>
          <h3 className="text-sm font-normal text-[#000000] mb-1">1. Tiered financial limits & thresholds</h3>
          <p className="text-xs text-[#777169] mb-4">
            Determines when RecoverAI acts autonomously vs requiring operator review.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5">
              <label className="text-xs font-normal text-[#000000] block mb-1">
                Autonomous Recovery Limit (₹)
              </label>
              <div className="text-[11px] text-[#777169] mb-3">
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
                className="w-full bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-4 py-2 text-xs text-[#000000] font-mono focus:outline-none focus:border-[#44403b] transition-colors"
              />
            </div>

            <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5">
              <label className="text-xs font-normal text-[#000000] block mb-1">
                Mandatory Human Review Threshold (₹)
              </label>
              <div className="text-[11px] text-[#777169] mb-3">
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
                className="w-full bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-4 py-2 text-xs text-[#000000] font-mono focus:outline-none focus:border-[#44403b] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Intervention Limits & Cooldowns */}
        <div className="border-t border-[#ebe8e4] pt-6">
          <h3 className="text-sm font-normal text-[#000000] mb-1">2. Recovery frequency & intervention budget</h3>
          <p className="text-xs text-[#777169] mb-4">
            Guards against excessive customer contact and gateway spam.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5">
              <label className="text-xs font-normal text-[#000000] block mb-1">
                Max Interventions Per Case
              </label>
              <div className="text-[11px] text-[#777169] mb-3">
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
                className="w-full bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-4 py-2 text-xs text-[#000000] font-mono focus:outline-none focus:border-[#44403b] transition-colors"
              />
            </div>

            <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5">
              <label className="text-xs font-normal text-[#000000] block mb-1">
                Recovery Cooldown (Minutes)
              </label>
              <div className="text-[11px] text-[#777169] mb-3">
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
                className="w-full bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-4 py-2 text-xs text-[#000000] font-mono focus:outline-none focus:border-[#44403b] transition-colors"
              />
            </div>

            <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5">
              <label className="text-xs font-normal text-[#000000] block mb-1">
                Min AI Confidence Required
              </label>
              <div className="text-[11px] text-[#777169] mb-3">
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
                className="w-full bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-4 py-2 text-xs text-[#000000] font-mono focus:outline-none focus:border-[#44403b] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Submit CTA */}
        <div className="border-t border-[#ebe8e4] pt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#000000] hover:bg-[#44403b] text-[#fdfcfc] disabled:opacity-50 font-medium rounded-full text-xs transition-colors"
          >
            {saving ? 'Saving policy changes...' : 'Save policy changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
