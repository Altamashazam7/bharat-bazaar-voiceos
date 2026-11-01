import { useEffect, useState } from "react";

import {
  runDemo,
  runEvaluation,
  transcribeOrder,
  type EvaluationReport,
  type OrderResult,
} from "./api";
import {
  DemoPage,
  ErrorBanner,
  EvaluationPage,
  Header,
  KpiSection,
  Notification,
  OrderSections,
  PageTitle,
  ProcessingSteps,
  UploadCard,
  type Page,
} from "./components/VoiceDashboard";

type Operation = "upload" | "demo" | "evaluation";

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleUpload(file: File) {
    setPage("overview");
    setOperation("upload");
    setResult(null);
    setError(null);
    setNotice(null);

    try {
      const order = await transcribeOrder(file);
      setResult(order);
      setNotice(`Order processed from ${file.name}`);
    } catch (requestError) {
      setError(errorMessage(requestError, "We could not process that audio file."));
    } finally {
      setOperation(null);
    }
  }

  async function handleDemo() {
    setOperation("demo");
    setResult(null);
    setError(null);
    setNotice(null);

    try {
      const order = await runDemo();
      setResult(order);
      setNotice("Demo order processed successfully");
    } catch (requestError) {
      setError(errorMessage(requestError, "The demo order could not be processed."));
    } finally {
      setOperation(null);
    }
  }

  async function handleEvaluation() {
    setOperation("evaluation");
    setError(null);
    setNotice(null);

    try {
      const report = await runEvaluation();
      setEvaluation(report);
      setNotice(`Benchmark complete · ${report.accuracy}% cart accuracy`);
    } catch (requestError) {
      setError(errorMessage(requestError, "The benchmark could not be completed."));
    } finally {
      setOperation(null);
    }
  }

  const accuracy = evaluation?.accuracy ?? 100;
  const accuracyDetail = evaluation ? "Latest benchmark run" : "9 / 9 reported baseline";

  return (
    <div className="app-shell">
      <Header page={page} onNavigate={setPage} />
      <main className="main-content">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {page === "overview" && (
          <>
            <PageTitle page="overview" />
            <KpiSection
              accuracy={accuracy}
              accuracyDetail={accuracyDetail}
              result={result}
            />
            <div className="workspace-grid">
              <UploadCard
                busy={operation === "upload"}
                disabled={operation !== null}
                onFile={handleUpload}
              />
              <ProcessingSteps
                active={operation === "upload"}
                complete={result !== null}
              />
            </div>
            {result ? (
              <OrderSections result={result} />
            ) : (
              <div className="welcome-strip">
                <span className="welcome-mark">✦</span>
                <span><strong>Your next order starts with a voice note.</strong><small>Upload a recording or explore the one-click demo to see the full workflow.</small></span>
                <button className="text-button" onClick={() => setPage("demo")} type="button">Explore demo <span aria-hidden="true">→</span></button>
              </div>
            )}
          </>
        )}

        {page === "evaluation" && (
          <EvaluationPage
            busy={operation === "evaluation"}
            disabled={operation !== null}
            onRun={handleEvaluation}
            report={evaluation}
          />
        )}

        {page === "demo" && (
          <DemoPage
            busy={operation === "demo"}
            disabled={operation !== null}
            onRun={handleDemo}
            result={result}
          />
        )}
      </main>
      <footer className="app-footer">
        <span><span className="footer-mark">B</span> Bharat Bazaar VoiceOS</span>
        <span>Built for every neighbourhood store <span aria-hidden="true">♥</span></span>
      </footer>
      {notice && <Notification onDismiss={() => setNotice(null)}>{notice}</Notification>}
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default App;
