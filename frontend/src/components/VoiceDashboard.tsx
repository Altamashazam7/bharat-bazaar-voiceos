import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { audioUrl, type EvaluationReport, type OrderResult } from "../api";
import { AudioRecorder } from "./AudioRecorder";
import { BusinessSelector } from "./BusinessSelector";

export type Page = "overview" | "inventory" | "customers" | "orders" | "analytics" | "admin" | "pilot-admin" | "evaluation" | "demo" | "store-registration" | "business-login";

interface HeaderProps {
  page: Page;
  onNavigate: (page: Page) => void;
  onBusinessChange: (businessId: string | null) => void;
  onBusinessLoadComplete: (loaded: boolean) => void;
  onBusinessLogin: () => void;
  onPilotAdmin: () => void;
  businessListVersion: number;
}

export function Header({ page, onNavigate, onBusinessChange, onBusinessLoadComplete, onBusinessLogin, onPilotAdmin, businessListVersion }: HeaderProps) {
  const createStore = useCallback(() => onNavigate("store-registration"), [onNavigate]);
  const authSuccess = useCallback(() => onNavigate("overview"), [onNavigate]);

  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNavigate("overview")} type="button">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span className="brand-copy">
          <strong>Bharat Bazaar</strong>
          <span>VoiceOS · Retail, reimagined</span>
        </span>
      </button>
      <nav className="main-nav" aria-label="Main navigation">
        {([
          ["overview", "Overview"],
          ["inventory", "Inventory"],
          ["customers", "Customers"],
          ["orders", "Orders"],
          ["analytics", "Analytics"],
          ["admin", "Admin"],
          ["pilot-admin", "Pilot Admin"],
          ["evaluation", "Evaluation"],
          ["demo", "Demo mode"],
        ] as const).map(([id, label]) => (
          <button
            className={`nav-link${page === id ? " is-active" : ""}`}
            key={id}
            onClick={() => onNavigate(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      <BusinessSelector
        businessListVersion={businessListVersion}
        onAuthSuccess={authSuccess}
        onBusinessChange={onBusinessChange}
        onBusinessLogin={onBusinessLogin}
        onPilotAdmin={onPilotAdmin}
        onCreateStore={createStore}
        onLoadComplete={onBusinessLoadComplete}
      />
      <span className="topbar-tag"><span className="status-dot" /> Live demo</span>
    </header>
  );
}

interface KpiSectionProps {
  result: OrderResult | null;
  accuracy: number | null;
  accuracyDetail: string;
}

export function KpiSection({ result, accuracy, accuracyDetail }: KpiSectionProps) {
  const totalItems = result
    ? Object.values(result.cart).reduce((total, quantity) => total + quantity, 0)
    : null;
  const metrics = [
    { label: "Products", value: result ? Object.keys(result.cart).length : "—", hint: "Unique in this order", icon: "P", tone: "mint" },
    { label: "Commands", value: result ? result.commands.length : "—", hint: "Extracted from speech", icon: "C", tone: "blue" },
    { label: "Total items", value: totalItems ?? "—", hint: "Across all products", icon: "Σ", tone: "amber" },
    { label: "Accuracy", value: accuracy === null ? "—" : `${accuracy}%`, hint: accuracyDetail, icon: "%", tone: "purple" },
  ];

  return (
    <section className="kpi-grid" aria-label="Order metrics">
      {metrics.map((metric) => (
        <article className="kpi-card" key={metric.label}>
          <div className={`kpi-icon ${metric.tone}`} aria-hidden="true">{metric.icon}</div>
          <div className="kpi-copy">
            <span className="kpi-label">{metric.label}</span>
            <strong className="kpi-value">{metric.value}</strong>
            <span className="kpi-hint">{metric.hint}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

interface PanelProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ eyebrow, title, action, children, className = "" }: PanelProps) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {eyebrow && <span className="panel-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface UploadCardProps {
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
  onRecordingError: (message: string) => void;
}

export function UploadCard({ busy, disabled, onFile, onRecordingError }: UploadCardProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  }

  return (
    <Panel eyebrow="START AN ORDER" title="Turn a voice note into a ready cart" className="upload-panel">
      <label className={`upload-drop${busy ? " is-busy" : ""}`}>
        <input
          accept=".wav,.mp3,.m4a,.webm,audio/wav,audio/mpeg,audio/mp4,audio/webm"
          disabled={disabled}
          onChange={handleChange}
          type="file"
        />
        <span className="upload-icon" aria-hidden="true">
          {busy ? <span className="spinner" /> : <UploadIcon />}
        </span>
        <span className="upload-title">{busy ? "Processing your order…" : "Drop an audio file here"}</span>
        <span className="upload-hint">or browse your device · WAV, MP3, M4A or WEBM</span>
        <span className="upload-actions">
          <span className="button button-primary">{busy ? "Please wait" : "Choose audio"}</span>
          <span className="upload-or">or</span>
          <AudioRecorder disabled={disabled} onCapture={onFile} onError={onRecordingError} />
        </span>
      </label>
      <div className="privacy-note"><LockIcon /> Audio is processed securely for this order.</div>
    </Panel>
  );
}

interface ProgressProps {
  complete: boolean;
  active: boolean;
}

export function ProcessingSteps({ complete, active }: ProgressProps) {
  const steps = [
    "Audio uploaded",
    "Speech recognized",
    "Commands extracted",
    "Cart generated",
    "Invoice generated",
    "Voice confirmation ready",
  ];

  return (
    <Panel eyebrow="ORDER PIPELINE" title="Processing status" className="progress-panel">
      <ol className="progress-list">
        {steps.map((step, index) => (
          <li className={`${complete ? "is-complete" : ""}${active && !complete && index === 0 ? " is-active" : ""}`} key={step}>
            <span className="progress-marker">
              {complete ? <CheckIcon /> : active && index === 0 ? <span className="spinner spinner-step" /> : index + 1}
            </span>
            <span>{step}</span>
            <span className="progress-state">{complete ? "Done" : active && index === 0 ? "In progress" : "Waiting"}</span>
          </li>
        ))}
      </ol>
      {!complete && <p className="muted-caption">Your order summary will appear here after audio processing.</p>}
    </Panel>
  );
}

interface OrderSectionsProps {
  result: OrderResult;
  autoPlayAudio?: boolean;
}

export function OrderSections({ result, autoPlayAudio = false }: OrderSectionsProps) {
  const products = Object.entries(result.cart);

  return (
    <div className="result-grid">
      <Panel eyebrow="SPEECH RECOGNITION" title="Transcript" className="transcript-panel">
        <div className="transcript-quote"><span aria-hidden="true">“</span>{result.transcript}</div>
      </Panel>

      <Panel
        eyebrow="VOICE TO COMMANDS"
        title="Order timeline"
        action={<span className="count-pill">{result.commands.length} commands</span>}
        className="commands-panel"
      >
        {result.commands.length ? (
          <ol className="command-list">
            {result.commands.map((command, index) => (
              <li key={`${command}-${index}`}>
                <span className="command-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="command-line" />
                <span className="command-text">{command}</span>
                <CheckIcon />
              </li>
            ))}
          </ol>
        ) : <EmptyState title="No commands found" detail="Try an audio clip with a product and quantity." />}
      </Panel>

      <Panel
        eyebrow="READY TO FULFIL"
        title="Your cart"
        action={<span className="count-pill">{products.length} products</span>}
        className="cart-panel"
      >
        {products.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th className="align-right">Quantity</th></tr></thead>
              <tbody>
                {products.map(([product, quantity], index) => (
                  <tr key={product}>
                    <td><span className="product-index">{String(index + 1).padStart(2, "0")}</span><strong>{product}</strong></td>
                    <td className="align-right"><span className="quantity-badge">{quantity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-total"><span>Total items</span><strong>{result.invoice.total_items}</strong></div>
          </div>
        ) : <EmptyState title="Your cart is empty" detail="Recognized products will appear here." />}
      </Panel>

      <Panel eyebrow="ORDER SUMMARY" title="Invoice" className="invoice-panel">
        <div className="invoice-paper">
          <div className="invoice-brand"><span className="invoice-brand-mark">B</span><div><strong>Bharat Bazaar</strong><span>VOICE ORDER RECEIPT</span></div></div>
          <div className="invoice-rule" />
          {products.map(([product, quantity]) => (
            <div className="invoice-row" key={product}><span>{product}</span><strong>{quantity}</strong></div>
          ))}
          <div className="invoice-rule" />
          <div className="invoice-row invoice-total"><span>Total items</span><strong>{result.invoice.total_items}</strong></div>
        </div>
      </Panel>

      <Panel eyebrow="VOICE ASSISTANT" title="Confirmation" className="confirmation-panel">
        <div className="confirmation-message"><span className="sound-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span><p>{result.confirmation_text || "Your order confirmation will appear here."}</p></div>
      </Panel>

      <AudioPlayerCard
        audioPath={result.confirmation_audio}
        autoPlay={autoPlayAudio}
      />
    </div>
  );
}

interface AudioPlayerProps {
  audioPath: string | null;
  autoPlay?: boolean;
}

export function AudioPlayerCard({ audioPath, autoPlay = false }: AudioPlayerProps) {
  const source = audioUrl(audioPath);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackMessage, setPlaybackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!autoPlay || !source || !audioRef.current) return;
    void audioRef.current.play().then(
      () => setPlaybackMessage(null),
      () => setPlaybackMessage("Autoplay was blocked by the browser. Use the player to listen."),
    );
  }, [autoPlay, source]);

  return (
    <Panel eyebrow="GENERATED AUDIO" title="Listen to confirmation" className="audio-panel">
      {source ? (
        <>
          <audio
            ref={audioRef}
            controls
            preload="none"
            src={source}
            onPlay={() => setPlaybackMessage(null)}
          >
            Your browser does not support audio playback.
          </audio>
          {playbackMessage && <p className="muted-caption">{playbackMessage}</p>}
        </>
      ) : (
        <EmptyState title="Audio is not available" detail="Run an order to generate a spoken confirmation." />
      )}
    </Panel>
  );
}

interface EvaluationPageProps {
  report: EvaluationReport | null;
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
}

export function EvaluationPage({ report, busy, disabled, onRun }: EvaluationPageProps) {
  return (
    <>
      <section className="page-intro">
        <div><span className="section-kicker">QUALITY ASSURANCE</span><h1>Evaluation dashboard</h1><p>Measure cart accuracy across the bundled voice-order benchmark.</p></div>
        <button className="button button-primary run-button" disabled={disabled} onClick={onRun} type="button">
          {busy ? <><span className="spinner spinner-small" /> Running benchmark</> : <><PlayIcon /> Run benchmark</>}
        </button>
      </section>
      {report ? (
        <>
          <section className="evaluation-stats">
            <EvaluationStat label="Total samples" value={report.total_samples} detail="In this benchmark" />
            <EvaluationStat label="Passed" value={report.passed} detail="Exact cart match" tone="success" />
            <EvaluationStat label="Failed" value={report.failed} detail="Needs attention" tone={report.failed ? "danger" : "neutral"} />
            <EvaluationStat label="Accuracy" value={`${report.accuracy}%`} detail="Cart-level accuracy" tone="success" />
          </section>
          <Panel eyebrow="BENCHMARK RESULTS" title="Sample-by-sample comparison" action={<span className="count-pill">{report.total_samples} samples</span>}>
            {report.results.length ? (
              <div className="table-wrap">
                <table className="data-table evaluation-table">
                  <thead><tr><th>Audio file</th><th>Status</th><th>Expected cart</th><th>Actual cart</th></tr></thead>
                  <tbody>{report.results.map((row) => (
                    <tr key={row.file}>
                      <td><span className="file-name"><AudioIcon />{row.file}</span></td>
                      <td><StatusBadge status={row.status} /></td>
                      <td><CartSummary cart={row.expected} /></td>
                      <td><CartSummary cart={row.actual} /><span className="row-error">{row.error}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <EmptyState title="No benchmark samples" detail="Add audio samples and expected carts to the evaluation dataset." />}
          </Panel>
        </>
      ) : (
        <div className="evaluation-empty">
          <span className="empty-illustration"><ChartIcon /></span>
          <h2>Ready when you are</h2>
          <p>Run the benchmark to compare every sample against its expected cart and calculate current accuracy.</p>
        </div>
      )}
    </>
  );
}

interface DemoPageProps {
  busy: boolean;
  disabled: boolean;
  result: OrderResult | null;
  onRun: () => void;
}

export function DemoPage({ busy, disabled, result, onRun }: DemoPageProps) {
  return (
    <>
      <section className="demo-banner">
        <div className="demo-orbit orbit-one" /><div className="demo-orbit orbit-two" />
        <div className="demo-copy"><span className="section-kicker">A LIVE VOICE ORDER</span><h1>From spoken words<br />to a shop-ready cart.</h1><p>See speech recognition, product matching, invoicing and voice confirmation work together — in one click.</p>
          <button className="button button-light" disabled={disabled} onClick={onRun} type="button">
            {busy ? <><span className="spinner spinner-small" /> Preparing demo</> : <><PlayIcon /> Run the demo</>}
          </button>
        </div>
        <div className="demo-visual" aria-hidden="true"><span className="demo-mic"><MicIcon /></span><span className="demo-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="demo-visual-label">VOICE ORDER · INDIA</span></div>
      </section>
      {result ? <OrderSections autoPlayAudio result={result} /> : (
        <div className="demo-note"><span className="status-check"><CheckIcon /></span><span><strong>Demo audio is ready</strong><small>Click “Run the demo” to process the bundled sample order.</small></span></div>
      )}
    </>
  );
}

interface EvaluationStatProps {
  label: string;
  value: string | number;
  detail: string;
  tone?: "success" | "danger" | "neutral";
}

function EvaluationStat({ label, value, detail, tone = "neutral" }: EvaluationStatProps) {
  return <article className="evaluation-stat"><span>{label}</span><strong className={`stat-${tone}`}>{value}</strong><small>{detail}</small></article>;
}

function StatusBadge({ status }: { status: EvaluationReport["results"][number]["status"] }) {
  const label = status === "passed" ? "Passed" : status === "failed" ? "Failed" : "Error";
  return <span className={`status-badge status-${status}`}><span />{label}</span>;
}

function CartSummary({ cart }: { cart: Record<string, number> }) {
  const entries = Object.entries(cart);
  return entries.length ? (
    <ul className="cart-summary">{entries.map(([product, quantity]) => <li key={product}><span>{product}</span><strong>{quantity}</strong></li>)}</ul>
  ) : <span className="muted-caption">No products</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-dot" /><strong>{title}</strong><span>{detail}</span></div>;
}

export function Notification({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return <div className="toast" role="status"><span className="toast-check"><CheckIcon /></span><span>{children}</span><button aria-label="Dismiss notification" onClick={onDismiss} type="button">×</button></div>;
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="error-banner" role="alert"><span className="error-symbol">!</span><span><strong>Something went wrong</strong><small>{message}</small></span><button aria-label="Dismiss error" onClick={onDismiss} type="button">×</button></div>;
}

export function PageTitle({ page }: { page: Page }) {
  const headings: Record<Page, { eyebrow: string; title: string; detail: string }> = {
    overview: { eyebrow: "YOUR VOICE COMMERCE WORKSPACE", title: "Good morning, retailer.", detail: "A simpler way to take every order, accurately." },
    inventory: { eyebrow: "STOCK & CATALOG", title: "Inventory management", detail: "Keep products, prices, and stock ready for every order." },
    customers: { eyebrow: "CUSTOMER DIRECTORY", title: "Customer management", detail: "Keep customer contact details organized for your store." },
    orders: { eyebrow: "CUSTOMER ACTIVITY", title: "Order history", detail: "Search and review every saved voice order." },
    analytics: { eyebrow: "RETAIL PERFORMANCE", title: "Business analytics", detail: "See order activity and what your customers buy most." },
    admin: { eyebrow: "STORE OPERATIONS", title: "Retail admin", detail: "Manage inventory, review orders, and monitor store performance." },
    "pilot-admin": { eyebrow: "PILOT OPERATIONS", title: "Pilot Admin", detail: "Repair verified business ownership and prepare demo stores." },
    evaluation: { eyebrow: "QUALITY ASSURANCE", title: "Evaluation dashboard", detail: "Measure cart accuracy across the bundled voice-order benchmark." },
    demo: { eyebrow: "PRODUCT WALKTHROUGH", title: "See VoiceOS in action", detail: "One sample order. The complete voice-commerce journey." },
    "store-registration": { eyebrow: "BUSINESS SETUP", title: "Create a new store", detail: "Register your store to manage its inventory, orders, and performance." },
    "business-login": { eyebrow: "BUSINESS ACCOUNT", title: "Business login", detail: "Phone OTP is optional; use it only when configured for this project." },
  };
  const heading = headings[page];
  return <div className="page-title"><span className="section-kicker">{heading.eyebrow}</span><h1>{heading.title}</h1><p>{heading.detail}</p></div>;
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 7V4.8a2.5 2.5 0 1 1 5 0V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.3 8.2 3.1 3.1 6.4-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5.2 3.5v9l7-4.5-7-4.5Z" fill="currentColor" /></svg>;
}

function AudioIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 6v4m3-6v8m3-6v4m3-7v10m3-7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function ChartIcon() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25V7m0 18h22M10 20l5-6 4 3 7-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="20" r="1.5" fill="currentColor" /><circle cx="15" cy="14" r="1.5" fill="currentColor" /><circle cx="19" cy="17" r="1.5" fill="currentColor" /><circle cx="26" cy="8" r="1.5" fill="currentColor" /></svg>;
}

function MicIcon() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="17" y="5" width="14" height="25" rx="7" stroke="currentColor" strokeWidth="2" /><path d="M11 23a13 13 0 0 0 26 0M24 36v7m-8 0h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
