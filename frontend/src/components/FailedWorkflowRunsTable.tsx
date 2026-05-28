import { useEffect, useState } from "react";
import { getFailedWorkflowRuns } from "../api";
import type { GitHubEvent } from "../types";

export default function FailedWorkflowsTable() {
  const [workflows, setWorkflows] = useState<GitHubEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFailedWorkflowRuns()
      .then(setWorkflows)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <section>
      <h2>Failed Workflows</h2>

      {workflows.length === 0 ? (
        <p>No failed workflows found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Repo</th>
              <th>Actor</th>
              <th>Branch</th>
              <th>Commit</th>
              <th>Link</th>
            </tr>
          </thead>

          <tbody>
            {workflows.map((workflow) => (
              <tr key={workflow.id}>
                <td>{workflow.repo_name}</td>
                <td>{workflow.actor ?? "-"}</td>
                <td>{workflow.branch ?? "-"}</td>
                <td>{workflow.commit_sha?.slice(0, 7) ?? "-"}</td>
                <td>
                  {workflow.html_url ? (
                    <a
                      href={workflow.html_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}