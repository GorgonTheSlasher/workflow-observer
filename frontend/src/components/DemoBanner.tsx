import { getGithubInstallUrl } from "../api";

export default function DemoBanner({ isDemoAccount }: { isDemoAccount: boolean }) {
  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner__tag">Demo</span>
      <span className="demo-banner__text">
        {isDemoAccount
          ? "You're viewing sample data. Sign in with GitHub and install the app to see your own repositories."
          : "You're viewing sample data because no repositories are connected yet. Install the GitHub App to see your own."}
      </span>
      {!isDemoAccount && (
        <button
          className="demo-banner__action"
          onClick={() => { window.location.href = getGithubInstallUrl(); }}
        >
          Install GitHub App
        </button>
      )}
    </div>
  );
}
