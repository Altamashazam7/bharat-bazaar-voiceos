import { useCallback, useEffect, useState, type ReactNode } from "react";

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
import {
  AdminPage,
  AnalyticsPage,
  CustomersPage,
  InventoryPage,
  OrdersPage,
} from "./components/RetailPages";
import { StoreRegistrationPage } from "./components/StoreRegistrationPage";
import { BusinessLoginPage } from "./components/BusinessLoginPage";
import { PilotAdminPage } from "./components/PilotAdminPage";
import type { Business } from "./types/business";
import { createOrder } from "./services/orderService";
import { getProducts } from "./services/productService";

type Operation = "upload" | "demo" | "evaluation";

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [businessesLoaded, setBusinessesLoaded] = useState(false);
  const [businessListVersion, setBusinessListVersion] = useState(0);
  const navigateToPilotAdmin = useCallback(() => setPage("pilot-admin"), []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleUpload(file: File) {
    const businessId = activeBusinessId;
    setPage("overview");
    setOperation("upload");
    setResult(null);
    setError(null);
    setNotice(null);

    try {
      if (!businessId) throw new Error("Select a store before processing a voice order.");
      const products = await getProducts(businessId);
      const order = await transcribeOrder(file, products);
      setResult(order);
      await persistProcessedOrder(order, businessId);
      setNotice(`Order processed from ${file.name}`);
    } catch (requestError) {
      setError(errorMessage(requestError, "We could not process and save that audio order."));
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
      await persistProcessedOrder(order, activeBusinessId);
      setNotice("Demo order processed successfully");
    } catch (requestError) {
      setError(errorMessage(requestError, "The demo order could not be processed and saved."));
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
      <Header
        page={page}
        onNavigate={setPage}
        onBusinessChange={setActiveBusinessId}
        onBusinessLoadComplete={setBusinessesLoaded}
        onBusinessLogin={() => setPage("business-login")}
        onPilotAdmin={navigateToPilotAdmin}
        businessListVersion={businessListVersion}
      />
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
                onRecordingError={setError}
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

        {page === "inventory" && (
          <BusinessGate businessId={activeBusinessId} loaded={businessesLoaded}>
            <InventoryPage key={activeBusinessId ?? "no-business"} />
          </BusinessGate>
        )}

        {page === "customers" && (
          <BusinessGate businessId={activeBusinessId} loaded={businessesLoaded}>
            <CustomersPage key={activeBusinessId ?? "no-business"} />
          </BusinessGate>
        )}

        {page === "orders" && (
          <BusinessGate businessId={activeBusinessId} loaded={businessesLoaded}>
            <OrdersPage key={activeBusinessId ?? "no-business"} />
          </BusinessGate>
        )}

        {page === "analytics" && (
          <BusinessGate businessId={activeBusinessId} loaded={businessesLoaded}>
            <AnalyticsPage key={activeBusinessId ?? "no-business"} />
          </BusinessGate>
        )}

        {page === "admin" && (
          <BusinessGate businessId={activeBusinessId} loaded={businessesLoaded}>
            <AdminPage key={activeBusinessId ?? "no-business"} evaluation={evaluation} onNavigate={setPage} />
          </BusinessGate>
        )}

        {page === "demo" && (
          <DemoPage
            busy={operation === "demo"}
            disabled={operation !== null}
            onRun={handleDemo}
            result={result}
          />
        )}

        {page === "store-registration" && (
          <StoreRegistrationPage onCreated={handleBusinessCreated} />
        )}

        {page === "business-login" && (
          <BusinessLoginPage
            onEmailLogin={() => setPage("overview")}
            onLoggedIn={handleBusinessLogin}
          />
        )}

        {page === "pilot-admin" && (
          <PilotAdminPage onAssigned={handleBusinessCreated} />
        )}
      </main>
      <footer className="app-footer">
        <span><span className="footer-mark">B</span> Bharat Bazaar VoiceOS</span>
        <span>Built for every neighbourhood store <span aria-hidden="true">♥</span></span>
      </footer>
      {notice && <Notification onDismiss={() => setNotice(null)}>{notice}</Notification>}
    </div>
  );

  function handleBusinessCreated(business: Business) {
    setActiveBusinessId(business.id);
    setBusinessListVersion((version) => version + 1);
    setPage("overview");
    setNotice(`${business.name} is ready`);
  }

  function handleBusinessLogin(business: Business) {
    setActiveBusinessId(business.id);
    setBusinessesLoaded(true);
    setBusinessListVersion((version) => version + 1);
    setPage("overview");
    setNotice(`Welcome back to ${business.name}`);
  }

  async function persistProcessedOrder(
    order: OrderResult,
    businessId: string | null,
  ): Promise<void> {
    try {
      await createOrder(
        {
          transcript: order.transcript,
          invoice: order.invoice,
          created_at: order.timestamp ?? new Date().toISOString(),
        },
        businessId ?? undefined,
      );
    } catch (saveError: unknown) {
      throw new Error(
        `Voice order was processed but could not be saved: ${errorMessage(saveError, "Select a store and try again.")}`,
      );
    }
  }
}

function BusinessGate({
  businessId,
  loaded,
  children,
}: {
  businessId: string | null;
  loaded: boolean;
  children: ReactNode;
}) {
  if (!loaded) return <div className="business-page-state">Loading stores…</div>;
  if (!businessId) return <div className="business-page-state">Create your first store.</div>;
  return children;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default App;
