import { useEffect, useState, type FormEvent } from "react";

import {
  createProduct,
  deleteProduct,
  getAnalytics,
  getInventory,
  getOrder,
  getOrders,
  invoicePdfUrl,
  updateProduct,
  type AnalyticsReport,
  type EvaluationReport,
  type InventoryReport,
  type OrderRecord,
  type Product,
} from "../api";
import { ErrorBanner, Notification, PageTitle, Panel } from "./VoiceDashboard";

export function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const report = await getInventory();
    setInventory(report);
  }

  useEffect(() => {
    void getInventory()
      .then(setInventory)
      .catch((loadError: unknown) => setError(messageOf(loadError)));
  }, []);

  async function save(form: ProductFormValue) {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateProduct({ ...form, id: editing.id });
        setNotice("Product updated");
      } else {
        await createProduct(form);
        setNotice("Product added to inventory");
      }
      setEditing(null);
      setAdding(false);
      await refresh();
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remove ${product.name} from inventory?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProduct(product.id);
      setNotice(`${product.name} removed`);
      await refresh();
    } catch (deleteError) {
      setError(messageOf(deleteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="inventory" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && <Notification onDismiss={() => setNotice(null)}>{notice}</Notification>}
      <div className="retail-stat-grid">
        <MetricCard label="Total products" value={inventory?.total_products ?? "—"} tone="green" />
        <MetricCard label="Low stock" value={inventory?.low_stock_items ?? "—"} tone="amber" />
        <MetricCard label="Out of stock" value={inventory?.out_of_stock_items ?? "—"} tone="red" />
      </div>
      <Panel
        eyebrow="PRODUCT CATALOG"
        title="Inventory"
        action={<button className="button button-primary" onClick={() => setAdding(true)} type="button">＋ Add product</button>}
      >
        {inventory?.products.length ? (
          <div className="table-wrap">
            <table className="data-table retail-table">
              <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Unit</th><th className="align-right">Price</th><th className="align-right">Actions</th></tr></thead>
              <tbody>{inventory.products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong><small className="product-aliases">{product.aliases.slice(0, 3).join(" · ")}</small></td>
                  <td>{product.category}</td>
                  <td><StockBadge stock={product.stock} threshold={inventory.low_stock_threshold} /></td>
                  <td>{product.unit}</td>
                  <td className="align-right">{formatMoney(product.price_paise)}</td>
                  <td className="align-right"><span className="row-actions">
                    <button className="small-action" onClick={() => setEditing(product)} type="button">Edit</button>
                    <button className="small-action danger-action" disabled={busy} onClick={() => void remove(product)} type="button">Delete</button>
                  </span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyRetail title="Inventory is loading" detail="Your catalog and stock levels will appear here." />}
      </Panel>
      {(adding || editing) && (
        <ProductDialog
          busy={busy}
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={save}
        />
      )}
    </>
  );
}

interface ProductFormValue {
  name: string;
  category: string;
  aliases: string[];
  unit: string;
  price_paise: number;
  stock: number;
}

function ProductDialog({
  initial,
  busy,
  onClose,
  onSave,
}: {
  initial: Product | null;
  busy: boolean;
  onClose: () => void;
  onSave: (value: ProductFormValue) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [aliases, setAliases] = useState(initial?.aliases.join(", ") ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "packet");
  const [price, setPrice] = useState(initial ? (initial.price_paise / 100).toFixed(2) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock) : "0");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({
      name: name.trim(),
      category: category.trim(),
      aliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
      unit: unit.trim(),
      price_paise: Math.round(Number(price) * 100),
      stock: Math.max(0, Math.floor(Number(stock))),
    });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="product-dialog-title" aria-modal="true" className="product-dialog" role="dialog">
        <div className="panel-heading"><div><span className="panel-eyebrow">INVENTORY</span><h2 id="product-dialog-title">{initial ? "Edit product" : "Add a product"}</h2></div><button aria-label="Close dialog" className="dialog-close" onClick={onClose} type="button">×</button></div>
        <form className="product-form" onSubmit={submit}>
          <label>Product name<input autoFocus maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <div className="form-two-col">
            <label>Category<input maxLength={80} onChange={(event) => setCategory(event.target.value)} required value={category} /></label>
            <label>Unit<input maxLength={30} onChange={(event) => setUnit(event.target.value)} required value={unit} /></label>
          </div>
          <label>Voice aliases <small>Separate alternate pronunciations with commas.</small><input onChange={(event) => setAliases(event.target.value)} value={aliases} /></label>
          <div className="form-two-col">
            <label>Price (₹)<input min="0" onChange={(event) => setPrice(event.target.value)} required step="0.01" type="number" value={price} /></label>
            <label>Stock<input min="0" onChange={(event) => setStock(event.target.value)} required step="1" type="number" value={stock} /></label>
          </div>
          <div className="dialog-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save product"}</button></div>
        </form>
      </section>
    </div>
  );
}

export function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selected, setSelected] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void getOrders(search, status).then(({ orders: nextOrders }) => {
        setOrders(nextOrders);
        setError(null);
      }).catch((loadError: unknown) => setError(messageOf(loadError)));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, status]);

  async function viewOrder(orderId: string) {
    try {
      setSelected(await getOrder(orderId));
    } catch (loadError) {
      setError(messageOf(loadError));
    }
  }

  return (
    <>
      <PageTitle page="orders" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <Panel eyebrow="CUSTOMER ORDERS" title="Order history" action={<span className="count-pill">{orders.length} recent orders</span>}>
        <div className="order-filters">
          <label className="search-field"><SearchIcon /><input aria-label="Search order history" onChange={(event) => setSearch(event.target.value)} placeholder="Search order, transcript or product…" value={search} /></label>
          <label className="filter-select"><span>Status</span><select aria-label="Filter orders by status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All orders</option><option value="confirmed">Confirmed</option></select></label>
        </div>
        {orders.length ? (
          <div className="table-wrap">
            <table className="data-table retail-table">
              <thead><tr><th>Order</th><th>Date</th><th>Products</th><th>Total</th><th>Status</th><th /></tr></thead>
              <tbody>{orders.map((order) => (
                <tr key={order.order_id}>
                  <td><strong>{order.order_id}</strong><small className="product-aliases">{order.transcript}</small></td>
                  <td>{formatDate(order.timestamp)}</td>
                  <td>{Object.keys(order.cart).length} products</td>
                  <td>{formatMoney(order.invoice.grand_total_paise ?? 0)}</td>
                  <td><span className="status-badge status-passed"><span />Confirmed</span></td>
                  <td className="align-right"><button className="small-action" onClick={() => void viewOrder(order.order_id)} type="button">Details</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyRetail title="No orders found" detail={search ? "Try another search term." : "Completed voice orders are saved here."} />}
      </Panel>
      {selected && (
        <Panel eyebrow={`ORDER ${selected.order_id}`} title="Order details" className="order-detail-panel" action={<button className="button button-secondary" onClick={() => setSelected(null)} type="button">Close</button>}>
          <p className="detail-transcript">“{selected.transcript}”</p>
          <div className="table-wrap"><table className="data-table retail-table"><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th className="align-right">Line total</th></tr></thead>
            <tbody>{selected.invoice.items?.map((item) => <tr key={item.product}><td><strong>{item.product}</strong></td><td>{item.quantity} {item.unit}</td><td>{formatMoney(item.unit_price_paise)}</td><td className="align-right">{formatMoney(item.line_total_paise)}</td></tr>)}</tbody>
          </table></div>
          <div className="detail-totals"><span>Subtotal <strong>{formatMoney(selected.invoice.subtotal_paise ?? 0)}</strong></span><span>GST included <strong>{formatMoney(selected.invoice.tax_paise ?? 0)}</strong></span><span>Grand total <strong>{formatMoney(selected.invoice.grand_total_paise ?? 0)}</strong></span></div>
          <a className="button button-primary pdf-link" href={invoicePdfUrl(selected.order_id)} rel="noreferrer" target="_blank"><DownloadIcon /> Download invoice PDF</a>
        </Panel>
      )}
    </>
  );
}

export function AnalyticsPage() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAnalytics().then(setReport).catch((loadError: unknown) => setError(messageOf(loadError)));
  }, []);

  return (
    <>
      <PageTitle page="analytics" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="retail-stat-grid analytics-stat-grid">
        <MetricCard label="Orders today" value={report?.orders_today ?? "—"} tone="green" />
        <MetricCard label="Orders this week" value={report?.orders_this_week ?? "—"} tone="blue" />
        <MetricCard label="Products sold today" value={report?.products_sold ?? "—"} tone="amber" />
        <MetricCard label="Average order size" value={report?.average_order_size ?? "—"} tone="purple" />
        <MetricCard label="Revenue today" value={report?.revenue ?? "—"} tone="green" />
      </div>
      <div className="retail-two-col">
        <Panel eyebrow="BEST SELLERS" title="Top selling products">
          {report?.top_products.length ? <RankedBars entries={report.top_products.map((item) => ({ label: item.product, value: item.quantity }))} /> : <EmptyRetail title="No sales yet" detail="Product rankings appear as orders come in." />}
        </Panel>
        <Panel eyebrow="CUSTOMER PREFERENCES" title="Most ordered categories">
          {report?.top_categories.length ? <RankedBars entries={report.top_categories.map((item) => ({ label: item.category, value: item.quantity }))} /> : <EmptyRetail title="No category data yet" detail="Category insights appear as orders come in." />}
        </Panel>
      </div>
    </>
  );
}

export function AdminPage({
  evaluation,
  onNavigate,
}: {
  evaluation: EvaluationReport | null;
  onNavigate: (page: "inventory" | "orders" | "analytics" | "evaluation") => void;
}) {
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getInventory(), getOrders(), getAnalytics()])
      .then(([inventoryReport, orderReport, analyticsReport]) => {
        setInventory(inventoryReport);
        setOrderCount(orderReport.total);
        setAnalytics(analyticsReport);
      })
      .catch((loadError: unknown) => setError(messageOf(loadError)));
  }, []);

  const sections = [
    { title: "Inventory", description: `${inventory?.total_products ?? "—"} products · ${inventory?.low_stock_items ?? "—"} low stock`, page: "inventory" as const, label: "Manage stock" },
    { title: "Orders", description: `${orderCount ?? "—"} saved customer orders`, page: "orders" as const, label: "View orders" },
    { title: "Analytics", description: `${analytics?.revenue ?? "—"} revenue today`, page: "analytics" as const, label: "Open analytics" },
    { title: "Benchmark", description: evaluation ? `${evaluation.passed}/${evaluation.total_samples} passed · ${evaluation.accuracy}%` : "Run the speech benchmark to review accuracy.", page: "evaluation" as const, label: evaluation ? "Review results" : "Run benchmark" },
  ];

  return (
    <>
      <PageTitle page="admin" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="retail-stat-grid">
        <MetricCard label="Catalog products" value={inventory?.total_products ?? "—"} tone="green" />
        <MetricCard label="Orders stored" value={orderCount ?? "—"} tone="blue" />
        <MetricCard label="Low stock alerts" value={inventory?.low_stock_items ?? "—"} tone="amber" />
        <MetricCard label="Revenue today" value={analytics?.revenue ?? "—"} tone="purple" />
      </div>
      <div className="admin-grid">{sections.map((section) => (
        <article className="admin-card" key={section.title}>
          <span className="admin-card-icon">{section.title.slice(0, 1)}</span>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
          <button className="text-button" onClick={() => onNavigate(section.page)} type="button">{section.label} <span aria-hidden="true">→</span></button>
        </article>
      ))}</div>
    </>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <article className="retail-metric"><span className={`retail-metric-icon ${tone}`}>{label.slice(0, 1)}</span><span className="retail-metric-label">{label}</span><strong>{value}</strong></article>;
}

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const status = stock === 0 ? "Out of stock" : stock <= threshold ? "Low stock" : "In stock";
  const className = stock === 0 ? "stock-out" : stock <= threshold ? "stock-low" : "stock-good";
  return <span className={`stock-badge ${className}`}><i />{stock} · {status}</span>;
}

function RankedBars({ entries }: { entries: { label: string; value: number }[] }) {
  const max = Math.max(...entries.map((entry) => entry.value), 1);
  return <div className="ranked-bars">{entries.map((entry, index) => (
    <div className="ranked-row" key={entry.label}>
      <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
      <div className="rank-content"><div className="rank-label"><span>{entry.label}</span><strong>{entry.value}</strong></div><div className="rank-track"><span style={{ width: `${Math.max(4, entry.value / max * 100)}%` }} /></div></div>
    </div>
  ))}</div>;
}

function EmptyRetail({ title, detail }: { title: string; detail: string }) {
  return <div className="retail-empty"><span className="empty-dot" /><strong>{title}</strong><small>{detail}</small></div>;
}

function formatMoney(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function SearchIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.7" cy="8.7" r="5.6" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 2.5v8m0 0 3-3m-3 3-3-3M3.5 12v3h11v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
