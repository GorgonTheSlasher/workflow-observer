import { useState, useEffect } from "react";
import { getMe, getRepositories, type UserProfile, type AlertRuleCreate } from "../api";
import { useAlertRules } from "../hooks/useAlertRules";

const RULE_TYPE_LABELS: Record<string, string> = {
  workflow_failure: "Workflow Failure",
  workflow_recovery: "Workflow Recovery",
  force_push: "Force Push",
  new_member: "New Member",
};

const RULE_TYPE_COLORS: Record<string, string> = {
  workflow_failure: "#e53935",
  workflow_recovery: "#00c851",
  force_push: "#FFB800",
  new_member: "#5b9bd5",
};

function AccountPanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const initial = (profile?.github_username?.[0] ?? profile?.email?.[0] ?? "?").toUpperCase();
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="settings-panel">
      <div className="settings-panel__header">
        <h2 className="settings-panel__title">Account</h2>
        <p className="settings-panel__subtitle">Your profile and authentication details.</p>
      </div>
      <div className="settings-panel__body">
        {loading ? (
          <p className="settings-placeholder">Loading…</p>
        ) : (
          <div className="account-profile">
            <div className="account-avatar">{initial}</div>
            <div className="account-info">
              {profile?.email && (
                <div className="account-row">
                  <span className="account-label">Email</span>
                  <span className="account-value">{profile.email}</span>
                </div>
              )}
              {profile?.github_username && (
                <div className="account-row">
                  <span className="account-label">GitHub</span>
                  <a
                    className="account-value account-value--link"
                    href={`https://github.com/${profile.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{profile.github_username}
                  </a>
                </div>
              )}
              <div className="account-row">
                <span className="account-label">Member since</span>
                <span className="account-value">{joinedDate}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRulesPanel() {
  const { rules, isLoading, error, addRule, toggleRule, removeRule } = useAlertRules();
  const [repos, setRepos] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formRuleType, setFormRuleType] = useState("workflow_failure");
  const [formRepoFilter, setFormRepoFilter] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getRepositories();
        if (!cancelled) setRepos(data);
      } catch {
        // non-fatal — form will still render, just without the dropdown populated
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function openForm() {
    setFormRuleType("workflow_failure");
    setFormRepoFilter("");
    setFormWebhookUrl("");
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRepoFilter) {
      setFormError("Please select a repository.");
      return;
    }
    if (!formWebhookUrl.trim()) {
      setFormError("Webhook URL is required.");
      return;
    }
    setFormBusy(true);
    setFormError(null);
    const data: AlertRuleCreate = {
      rule_type: formRuleType,
      repo_filter: formRepoFilter,
      webhook_url: formWebhookUrl.trim(),
    };
    try {
      await addRule(data);
      setShowForm(false);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await removeRule(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel__header">
        <div className="settings-panel__header-row">
          <div>
            <h2 className="settings-panel__title">Alert Rules</h2>
            <p className="settings-panel__subtitle">
              Configure which events trigger Slack notifications and where they're sent.
            </p>
          </div>
          {!showForm && (
            <button className="btn-add-rule" onClick={openForm}>
              + Add Rule
            </button>
          )}
        </div>
      </div>

      <div className="settings-panel__body">
        {showForm && (
          <form className="rule-form" onSubmit={handleSubmit}>
            <div className="rule-form__field">
              <label className="rule-form__label">Rule Type</label>
              <select
                className="rule-form__select"
                value={formRuleType}
                onChange={(e) => setFormRuleType(e.target.value)}
              >
                {Object.entries(RULE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rule-form__field">
              <label className="rule-form__label">Repository</label>
              <select
                className="rule-form__select"
                value={formRepoFilter}
                onChange={(e) => setFormRepoFilter(e.target.value)}
              >
                <option value="" disabled>Select a repository…</option>
                {repos.map((repo) => (
                  <option key={repo} value={repo}>{repo}</option>
                ))}
              </select>
            </div>
            <div className="rule-form__field">
              <label className="rule-form__label">Slack Webhook URL</label>
              <input
                className="rule-form__input"
                type="url"
                placeholder="https://hooks.slack.com/services/…"
                value={formWebhookUrl}
                onChange={(e) => setFormWebhookUrl(e.target.value)}
              />
            </div>
            {formError && <p className="rule-form__error">{formError}</p>}
            <div className="rule-form__actions">
              <button type="submit" className="rule-form__submit" disabled={formBusy}>
                {formBusy ? "Saving…" : "Save Rule"}
              </button>
              <button type="button" className="rule-form__cancel" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="settings-placeholder">Loading…</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : rules.length === 0 && !showForm ? (
          <div className="rules-empty">
            <p>No alert rules configured yet.</p>
            <p>
              Add a rule to start receiving Slack notifications for workflow failures, force
              pushes, and more. Each rule targets a specific repository and Slack channel.
            </p>
          </div>
        ) : (
          <ul className="rules-list">
            {rules.map((rule) => (
              <li key={rule.id} className={`rule-card${rule.enabled ? "" : " rule-card--disabled"}`}>
                <span
                  className="rule-card__badge"
                  style={{ background: RULE_TYPE_COLORS[rule.rule_type] ?? "#888" }}
                >
                  {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                </span>
                <span className="rule-card__scope">
                  {rule.repo_filter ?? "All repositories"}
                </span>
                {rule.webhook_url && (
                  <span className="rule-card__webhook" title={rule.webhook_url}>
                    custom channel
                  </span>
                )}
                <div className="rule-card__actions">
                  <label
                    className="toggle"
                    title={rule.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                    />
                    <span className="toggle__track" />
                  </label>
                  <button
                    className="rule-card__delete"
                    title="Delete rule"
                    disabled={deletingId === rule.id}
                    onClick={() => handleDelete(rule.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SettingsView() {
  return (
    <div className="settings-view">
      <AccountPanel />
      <AlertRulesPanel />
    </div>
  );
}
