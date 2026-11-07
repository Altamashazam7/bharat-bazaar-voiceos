import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  runDemo,
  runEvaluation,
  transcribeOrder,
  type EvaluationReport,
  type OrderResult,
  type VoiceProcessingStep,
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
  SettingsPage,
} from "./components/RetailPages";
import { StoreRegistrationPage } from "./components/StoreRegistrationPage";
import { BusinessLoginPage } from "./components/BusinessLoginPage";
import { PilotAdminPage } from "./components/PilotAdminPage";
import type { Business } from "./types/business";
import { createOrder } from "./services/orderService";
import { getProducts } from "./services/productService";

type Operation = "upload" | "demo" | "evaluation" | "save";
type SaveState = "idle" | "saving" | "saved" | "failed";

const PROCESSING_STEP_INDEX: Record<VoiceProcessingStep, number> = {
  transcribing: 1,
  parsing: 2,
  invoice_generation: 3,
  audio_generation: 4,
};

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [activeBusinessName, setActiveBusinessName] = useState<string | null>(null);
  const [orderBusinessName, setOrderBusinessName] = useState<string | null>(null);
  const [businessesLoaded, setBusinessesLoaded] = useState(false);
  const [businessListVersion, setBusinessListVersion] = useState(0);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [processingFailed, setProcessingFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    order: OrderResult;
    businessId: string | null;
  } | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const navigateToPilotAdmin = useCallback(() => setPage("pilot-admin"), []);
  const updateProcessingStep = useCallback((step: VoiceProcessingStep) => {
    const stepIndex = PROCESSING_STEP_INDEX[step];
    setCurrentStep(stepIndex);
    setProgress(stepIndex * 20);
  }, []);
  const updateUploadProgress = useCallback((uploadProgress: number) => {
    setCurrentStep(0);
    setProgress(Math.round(uploadProgress / 5));
  }, []);
  const handleBusinessChange = useCallback((
    businessId: string | null,
    businessName: string | null,
  ) => {
    setActiveBusinessId(businessId);
    setActiveBusinessName(businessName);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleUpload(file: File) {
    const businessId = activeBusinessId;
    const businessName = activeBusinessName;
    setOrderBusinessName(businessName);
    setRetryFile(file);
    setPage("overview");
    setOperation("upload");
    setResult(null);
    setError(null);
    setSaveError(null);
    setPendingSave(null);
    setSaveState("idle");
    setCurrentStep(0);
    setProgress(0);
    setProcessingFailed(false);
    setNotice(null);

    try {
      if (!businessId) throw new Error("Select a store before processing a voice order.");
      const products = await getProducts(businessId);
      const order = await transcribeOrder(
        file,
        products,
        updateProcessingStep,
        updateUploadProgress,
      );
      setProgress(100);
      setResult(order);
      setCurrentStep(null);
      const saved = await saveProcessedOrder(order, businessId);
      if (saved) {
        setRetryFile(null);
        setNotice(`Order processed and saved to ${activeBusinessName ?? "your store"}`);
      }
    } catch (requestError) {
      setProcessingFailed(true);
      setError(errorMessage(requestError, "We could not process and save that audio order."));
    } finally {
      setOperation(null);
    }
  }

  async function handleDemo() {
    setOrderBusinessName(activeBusinessName);
    setOperation("demo");
    setResult(null);
    setError(null);
    setSaveError(null);
    setPendingSave(null);
    setSaveState("idle");
    setCurrentStep(1);
    setProgress(20);
    setProcessingFailed(false);
    setNotice(null);

    try {
      const order = await runDemo(updateProcessingStep);
      setProgress(100);
      setResult(order);
      setCurrentStep(null);
      const saved = await saveProcessedOrder(order, activeBusinessId);
      if (saved) setNotice(`Demo order saved to ${activeBusinessName ?? "your store"}`);
    } catch (requestError) {
      setProcessingFailed(true);
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
        onBusinessChange={handleBusinessChange}
        onBusinessLoadComplete={setBusinessesLoaded}
        onBusinessLogin={() => setPage("business-login")}
        onPilotAdmin={navigateToPilotAdmin}
        onNotice={setNotice}
        businessListVersion={businessListVersion}
      />
      <main className="main-content">
        {error && (
          <ErrorBanner
            message={error}
            onDismiss={() => setError(null)}
            onRetry={retryFile ? () => { void handleUpload(retryFile); } : undefined}
          />
        )}
        {saveError && (
          <ErrorBanner
            message={saveError}
            onDismiss={() => setSaveError(null)}
            onRetry={() => { void retryOrderSave(); }}
            retryLabel="Retry save"
          />
        )}

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
                active={operation === "upload" || operation === "demo"}
                businessName={orderBusinessName}
                complete={result !== null}
                currentStep={currentStep}
                progress={progress}
                failed={processingFailed}
                saveState={saveState}
              />
            </div>
            {result ? (
              <OrderSections businessName={orderBusinessName} result={result} />
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

        {page === "settings" && (
          <BusinessGate businessId={activeBusinessId} loaded={businessesLoaded}>
            <SettingsPage
              key={activeBusinessId ?? "no-business"}
              onSaved={(business) => {
                setActiveBusinessName(business.name);
                setBusinessListVersion((version) => version + 1);
                setNotice("Store profile updated");
              }}
            />
          </BusinessGate>
        )}

        {page === "demo" && (
          <DemoPage
            busy={operation === "demo"}
            disabled={operation !== null}
            onRun={handleDemo}
            result={result}
            businessName={orderBusinessName}
            currentStep={currentStep}
            progress={progress}
            failed={processingFailed}
            saveState={saveState}
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
    setActiveBusinessName(business.name);
    setBusinessListVersion((version) => version + 1);
    setPage("overview");
    setNotice(`${business.name} is ready`);
  }

  function handleBusinessLogin(business: Business) {
    setActiveBusinessId(business.id);
    setActiveBusinessName(business.name);
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

  async function saveProcessedOrder(
    order: OrderResult,
    businessId: string | null,
  ): Promise<boolean> {
    setSaveState("saving");
    setSaveError(null);
    setPendingSave({ order, businessId });
    try {
      await persistProcessedOrder(order, businessId);
      setSaveState("saved");
      setPendingSave(null);
      return true;
    } catch (saveRequestError: unknown) {
      setSaveState("failed");
      setSaveError(errorMessage(saveRequestError, "The processed order could not be saved."));
      return false;
    }
  }

  async function retryOrderSave() {
    if (!pendingSave || operation) return;
    setOperation("save");
    try {
      const saved = await saveProcessedOrder(pendingSave.order, pendingSave.businessId);
      if (saved) {
        setSaveError(null);
        setNotice(`Order saved to ${orderBusinessName ?? "your store"}`);
      }
    } finally {
      setOperation(null);
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
