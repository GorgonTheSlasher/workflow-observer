import DoraView from "../components/DoraView";
import ErrorMessage from "../components/ErrorMessage";
import { useDora } from "../hooks/useDora";
import type { DashboardScope } from "./filters";

export default function DoraPage({ scope }: { scope: DashboardScope }) {
  const { dora, isLoading, error } = useDora(scope.repoName, scope.startDate, scope.endDate);

  return (
    <>
      <ErrorMessage error={error} />
      <DoraView data={dora} isLoading={isLoading} />
    </>
  );
}
