import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from "react";

import type { EvaluationReport } from "../api";
import { createProduct, createProducts, deleteProduct, getProducts, updateProduct } from "../services/productService";
import { exportInventoryCsv, parseInventoryCsv } from "../services/inventoryCsv";
import {
  filterAndSortProducts,
  paginateProducts,
  type InventorySortField,
  type InventoryStockFilter,
} from "../services/inventoryView";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../services/customerService";
import { createOrder, getBusinessAnalytics, getOrder, getOrders } from "../services/orderService";
import { getCurrentBusiness, updateBusiness } from "../services/businessService";
import type { Business, BusinessAnalytics, Customer, CustomerInput, Order, Product } from "../types/business";
import { buildWeeklyTrend } from "../services/executiveDashboard";
import { ErrorBanner, Notification, PageTitle, Panel } from "./VoiceDashboard";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<InventoryStockFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<InventorySortField>("name");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const pageSize = 10;

  const categories = useMemo(
    () => [...new Set((products ?? []).map((product) => product.category.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [products],
  );
  const filteredProducts = useMemo(() => filterAndSortProducts(products ?? [], {
    search,
    stock: stockFilter,
    category: categoryFilter,
    sortBy,
  }), [categoryFilter, products, search, sortBy, stockFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = paginateProducts(filteredProducts, currentPage, pageSize);

  async function refresh() {
    setProducts(await getProducts());
  }

  useEffect(() => {
    void getProducts()
      .then(setProducts)
      .catch((loadError: unknown) => setError(messageOf(loadError)));
  }, []);

  async function save(form: ProductFormValue) {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateProduct(editing.id, form);
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

  function exportCsv() {
    if (!products?.length) {
      setError("There are no products to export yet.");
      return;
    }
    exportInventoryCsv(products);
    setNotice("Inventory CSV exported");
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const importedProducts = parseInventoryCsv(await file.text());
      const created = await createProducts(importedProducts);
      await refresh();
      setNotice(`${created.length} product${created.length === 1 ? "" : "s"} imported`);
    } catch (importError: unknown) {
      setError(messageOf(importError));
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
        <MetricCard label="Total products" value={products?.length ?? "—"} tone="green" />
        <MetricCard label="Low stock" value={products?.filter((product) => product.stock > 0 && product.stock <= 5).length ?? "—"} tone="amber" />
        <MetricCard label="Out of stock" value={products?.filter((product) => product.stock === 0).length ?? "—"} tone="red" />
      </div>
      <Panel
        eyebrow="PRODUCT CATALOG"
        title="Inventory"
        action={(
          <div className="inventory-actions">
            <button className="button button-secondary" disabled={busy || !products?.length} onClick={exportCsv} type="button">
              Export CSV
            </button>
            <button className="button button-secondary" disabled={busy} onClick={() => importInput.current?.click()} type="button">
              Import CSV
            </button>
            <input
              accept=".csv,text/csv"
              aria-label="Import inventory CSV"
              className="visually-hidden"
              onChange={(event) => void importCsv(event)}
              ref={importInput}
              type="file"
            />
            <button className="button button-primary" disabled={busy} onClick={() => setAdding(true)} type="button">＋ Add product</button>
          </div>
        )}
      >
        <div className="inventory-toolbar">
          <label className="search-field">
            <SearchIcon />
            <input
              aria-label="Search inventory"
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search products, categories, or aliases…"
              value={search}
            />
          </label>
          <label className="inventory-select-label">
            Stock
            <select aria-label="Filter by stock" onChange={(event) => { setStockFilter(event.target.value as InventoryStockFilter); setPage(1); }} value={stockFilter}>
              <option value="all">All stock</option>
              <option value="in-stock">In stock</option>
              <option value="low-stock">Low stock</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </label>
          <label className="inventory-select-label">
            Category
            <select aria-label="Filter by category" onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} value={categoryFilter}>
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="inventory-select-label">
            Sort by
            <select aria-label="Sort inventory" onChange={(event) => { setSortBy(event.target.value as InventorySortField); setPage(1); }} value={sortBy}>
              <option value="name">Name</option>
              <option value="stock">Stock</option>
              <option value="price">Price</option>
              <option value="category">Category</option>
            </select>
          </label>
          <span className="count-pill">{filteredProducts.length} of {products?.length ?? 0} products</span>
        </div>
        <p className="inventory-csv-hint">
          CSV columns: name, category, unit, price_paise, stock, image_url, aliases. Separate aliases with |; imports add products to this store.
        </p>
        {products === null ? (
          <EmptyRetail title="Loading your inventory" detail="Products and stock levels will appear here shortly." />
        ) : products.length === 0 ? (
          <div className="inventory-empty">
            <span className="inventory-empty-icon">＋</span>
            <strong>Your inventory starts here</strong>
            <p>Add your first product or import a CSV catalog to get your store ready for voice orders.</p>
            <div className="inventory-empty-actions">
              <button className="button button-primary" onClick={() => setAdding(true)} type="button">Add your first product</button>
              <button className="button button-secondary" onClick={() => importInput.current?.click()} type="button">Import a CSV</button>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyRetail title="No products match these filters" detail="Try changing your search or clearing one of the filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table retail-table inventory-table">
                <thead><tr><th>Product</th><th>Category</th><th>Stock status</th><th>Unit</th><th className="align-right">Price</th><th className="align-right">Actions</th></tr></thead>
                <tbody>{pageProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="inventory-product">
                        <InventoryProductImage product={product} />
                        <div>
                          <strong>{product.name}</strong>
                          {product.aliases?.length ? <small className="product-aliases">{product.aliases.join(", ")}</small> : null}
                        </div>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td><StockBadge stock={product.stock} threshold={5} /></td>
                    <td>{product.unit}</td>
                    <td className="align-right">{formatMoney(product.price_paise)}</td>
                    <td className="align-right"><span className="row-actions">
                      <button className="small-action" disabled={busy} onClick={() => setEditing(product)} type="button">Edit</button>
                      <button className="small-action danger-action" disabled={busy} onClick={() => void remove(product)} type="button">Delete</button>
                    </span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div aria-label="Inventory pagination" className="inventory-pagination">
              <span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length}</span>
              <div>
                <button className="button button-secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} type="button">Previous</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button className="button button-secondary" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} type="button">Next</button>
              </div>
            </div>
          </>
        )}
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
  unit: string;
  price_paise: number;
  stock: number;
  image_url: string | null;
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
  const [unit, setUnit] = useState(initial?.unit ?? "packet");
  const [price, setPrice] = useState(initial ? (initial.price_paise / 100).toFixed(2) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock) : "0");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [imageError, setImageError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedImageUrl = imageUrl.trim();
    if (normalizedImageUrl) {
      try {
        const parsedUrl = new URL(normalizedImageUrl);
        if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
          throw new Error("Unsupported image URL protocol.");
        }
      } catch {
        setImageError("Enter a valid HTTP or HTTPS image URL.");
        return;
      }
    }
    setImageError(null);
    void onSave({
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim(),
      price_paise: Math.round(Number(price) * 100),
      stock: Math.max(0, Math.floor(Number(stock))),
      image_url: normalizedImageUrl || null,
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
          <div className="form-two-col">
            <label>Price (₹)<input min="0" onChange={(event) => setPrice(event.target.value)} required step="0.01" type="number" value={price} /></label>
            <label>Stock<input min="0" onChange={(event) => setStock(event.target.value)} required step="1" type="number" value={stock} /></label>
          </div>
          <label>Product image URL (optional)<input autoComplete="url" maxLength={2048} onChange={(event) => { setImageUrl(event.target.value); setImageError(null); }} placeholder="https://example.com/product.jpg" type="url" value={imageUrl} /></label>
          {imageError && <p className="inventory-form-error" role="alert">{imageError}</p>}
          {imageUrl.trim() && !imageError && (
            <img alt="Product preview" className="inventory-image-preview" onError={() => setImageError("This image could not be loaded. Check the URL and try again.")} src={imageUrl.trim()} />
          )}
          <div className="dialog-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save product"}</button></div>
        </form>
      </section>
    </div>
  );
}

function InventoryProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image_url || failed) {
    return (
      <span aria-hidden="true" className="inventory-product-placeholder">
        {product.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      alt=""
      className="inventory-product-image"
      loading="lazy"
      onError={() => setFailed(true)}
      src={product.image_url}
    />
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh(query = search) {
    setCustomers(await getCustomers(query));
  }

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void getCustomers(search)
        .then((nextCustomers) => {
          if (!active) return;
          setCustomers(nextCustomers);
          setError(null);
        })
        .catch((loadError: unknown) => {
          if (active) setError(messageOf(loadError));
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [search]);

  async function save(form: CustomerInput) {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateCustomer(editing.id, form);
        setNotice("Customer updated");
      } else {
        await createCustomer(form);
        setNotice("Customer added");
      }
      setEditing(null);
      setAdding(false);
      await refresh();
    } catch (saveError: unknown) {
      setError(messageOf(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(`Remove ${customer.name} from customers?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCustomer(customer.id);
      setNotice(`${customer.name} removed`);
      await refresh();
    } catch (deleteError: unknown) {
      setError(messageOf(deleteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="customers" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && <Notification onDismiss={() => setNotice(null)}>{notice}</Notification>}
      <Panel
        eyebrow="CUSTOMER DIRECTORY"
        title="Customers"
        action={<button className="button button-primary" onClick={() => setAdding(true)} type="button">＋ Add customer</button>}
      >
        <div className="order-filters">
          <label className="search-field">
            <SearchIcon />
            <input
              aria-label="Search customers"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or phone…"
              value={search}
            />
          </label>
          <span className="count-pill">{customers.length} customers</span>
        </div>
        {customers.length ? (
          <div className="table-wrap">
            <table className="data-table retail-table">
              <thead><tr><th>Customer</th><th>Phone number</th><th className="align-right">Actions</th></tr></thead>
              <tbody>{customers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone}</td>
                  <td className="align-right"><span className="row-actions">
                    <button className="small-action" onClick={() => setEditing(customer)} type="button">Edit</button>
                    <button className="small-action danger-action" disabled={busy} onClick={() => void remove(customer)} type="button">Delete</button>
                  </span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <EmptyRetail
            title={search ? "No customers found" : "No customers yet"}
            detail={search ? "Try another name or phone number." : "Add a customer to start your directory."}
          />
        )}
      </Panel>
      {(adding || editing) && (
        <CustomerDialog
          busy={busy}
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={save}
        />
      )}
    </>
  );
}

function CustomerDialog({
  initial,
  busy,
  onClose,
  onSave,
}: {
  initial: Customer | null;
  busy: boolean;
  onClose: () => void;
  onSave: (value: CustomerInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    if (normalizedName.length < 2) {
      setValidationError("Customer name must be at least 2 characters.");
      return;
    }
    if (!/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone)
      || phoneDigits.length < 7
      || phoneDigits.length > 15) {
      setValidationError("Enter a valid phone number with 7 to 15 digits.");
      return;
    }
    setValidationError(null);
    void onSave({ name: normalizedName, phone: normalizedPhone });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="customer-dialog-title" aria-modal="true" className="product-dialog" role="dialog">
        <div className="panel-heading">
          <div><span className="panel-eyebrow">CUSTOMER DIRECTORY</span><h2 id="customer-dialog-title">{initial ? "Edit customer" : "Add a customer"}</h2></div>
          <button aria-label="Close dialog" className="dialog-close" onClick={onClose} type="button">×</button>
        </div>
        {validationError && <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} />}
        <form className="product-form" onSubmit={submit}>
          <label>Customer name<input autoFocus maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <label>Phone number<input autoComplete="tel" inputMode="tel" maxLength={20} onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} /></label>
          <div className="dialog-actions">
            <button className="button button-secondary" onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save customer"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function OrdersPage() {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repeatBusy, setRepeatBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void getOrders(search).then(({ orders: nextOrders }) => {
        setOrders(nextOrders);
        setError(null);
      }).catch((loadError: unknown) => setError(messageOf(loadError)));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  async function viewOrder(orderId: string) {
    try {
      setSelected(await getOrder(orderId));
    } catch (loadError) {
      setError(messageOf(loadError));
    }
  }

  async function repeatOrder(order: Order) {
    setRepeatBusy(true);
    setError(null);
    setNotice(null);
    try {
      const repeated = await createOrder({
        transcript: order.transcript,
        invoice: order.invoice,
        created_at: new Date().toISOString(),
      });
      setSelected(repeated);
      setNotice("A new order was created from the saved order. Review inventory before fulfillment.");
      const refreshed = await getOrders(search);
      setOrders(refreshed.orders);
    } catch (repeatError: unknown) {
      setError(messageOf(repeatError));
    } finally {
      setRepeatBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="orders" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && <Notification onDismiss={() => setNotice(null)}>{notice}</Notification>}
      <Panel eyebrow="CUSTOMER ORDERS" title="Order history" action={<span className="count-pill">{orders.length} recent orders</span>}>
        <div className="order-filters">
          <label className="search-field"><SearchIcon /><input aria-label="Search order history" onChange={(event) => setSearch(event.target.value)} placeholder="Search order, transcript or product…" value={search} /></label>
        </div>
        {orders.length ? (
          <div className="table-wrap">
            <table className="data-table retail-table">
              <thead><tr><th>Order</th><th>Date</th><th>Products</th><th>Total</th><th /></tr></thead>
              <tbody>{orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.id}</strong><small className="product-aliases">{order.transcript}</small></td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>{order.invoice.items?.length ?? 0} products</td>
                  <td>{formatMoney(order.invoice.grand_total_paise ?? 0)}</td>
                  <td className="align-right"><button className="small-action" onClick={() => void viewOrder(order.id)} type="button">Details</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyRetail title="No orders found" detail={search ? "Try another search term." : "Completed voice orders are saved here."} />}
      </Panel>
      {selected && (
        <Panel
          eyebrow={`ORDER ${selected.id}`}
          title="Order details"
          className="order-detail-panel"
          action={(
            <div className="order-detail-actions">
              <button className="button button-secondary" disabled={repeatBusy} onClick={() => void repeatOrder(selected)} type="button">
                {repeatBusy ? "Repeating…" : "Repeat this order"}
              </button>
              <button className="button button-secondary" onClick={() => setSelected(null)} type="button">Close</button>
            </div>
          )}
        >
          <p className="repeat-order-note">Creates a new order in this store from the saved transcript and invoice. This does not decrement stock.</p>
          <p className="detail-transcript">“{selected.transcript}”</p>
          <div className="table-wrap"><table className="data-table retail-table"><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th className="align-right">Line total</th></tr></thead>
            <tbody>{selected.invoice.items?.map((item) => <tr key={item.product}><td><strong>{item.product}</strong></td><td>{item.quantity} {item.unit}</td><td>{formatMoney(item.unit_price_paise)}</td><td className="align-right">{formatMoney(item.line_total_paise)}</td></tr>)}</tbody>
          </table></div>
          <div className="detail-totals"><span>Subtotal <strong>{formatMoney(selected.invoice.subtotal_paise ?? 0)}</strong></span><span>GST included <strong>{formatMoney(selected.invoice.tax_paise ?? 0)}</strong></span><span>Grand total <strong>{formatMoney(selected.invoice.grand_total_paise ?? 0)}</strong></span></div>
        </Panel>
      )}
    </>
  );
}

export function SettingsPage({ onSaved }: { onSaved: (business: Business) => void }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCurrentBusiness()
      .then((current) => {
        if (!active) return;
        setBusiness(current);
        setName(current.name);
        setOwnerName(current.owner_name);
        setPhone(current.phone);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageOf(loadError));
      });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    const normalizedName = name.trim();
    const normalizedOwner = ownerName.trim();
    const normalizedPhone = phone.trim();
    const digits = normalizedPhone.replace(/\D/g, "");
    if (normalizedName.length < 2) {
      setError("Store name must be at least 2 characters.");
      return;
    }
    if (normalizedOwner.length < 2) {
      setError("Owner name must be at least 2 characters.");
      return;
    }
    if (!/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone) || digits.length < 7 || digits.length > 15) {
      setError("Enter a valid phone number with 7 to 15 digits.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateBusiness(business.id, {
        name: normalizedName,
        owner_name: normalizedOwner,
        phone: normalizedPhone,
      });
      setBusiness(updated);
      setName(updated.name);
      setOwnerName(updated.owner_name);
      setPhone(updated.phone);
      onSaved(updated);
      setNotice("Store profile saved");
    } catch (saveError: unknown) {
      setError(messageOf(saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="settings" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && <Notification onDismiss={() => setNotice(null)}>{notice}</Notification>}
      <Panel eyebrow="BUSINESS PROFILE" title={business?.name ?? "Store details"}>
        {business ? (
          <form className="settings-form" onSubmit={(event) => void saveProfile(event)}>
            <label>
              Store name
              <input autoComplete="organization" maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label>
              Owner name
              <input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => setOwnerName(event.target.value)} required value={ownerName} />
            </label>
            <label>
              Phone number
              <input autoComplete="tel" inputMode="tel" maxLength={20} onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} />
            </label>
            <label className="settings-unavailable">
              Address <span>Optional</span>
              <input disabled placeholder="Not stored by the current database schema" />
            </label>
            <label className="settings-unavailable">
              GST number <span>Optional</span>
              <input disabled placeholder="Not stored by the current database schema" />
            </label>
            <p className="settings-schema-note">Address and GST are unavailable until an additive database change is approved. No values are stored locally or submitted.</p>
            <button className="button button-primary settings-save" disabled={busy} type="submit">
              {busy ? "Saving profile…" : "Save profile"}
            </button>
          </form>
        ) : (
          <div className="executive-loading" role="status">Loading store profile…</div>
        )}
      </Panel>
    </>
  );
}

export function AnalyticsPage() {
  const [report, setReport] = useState<BusinessAnalytics | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getBusinessAnalytics(), getProducts(), getCustomers(), getOrders()])
      .then(([analytics, inventory, customerList, orderReport]) => {
        if (!active) return;
        setReport(analytics);
        setProducts(inventory);
        setCustomers(customerList);
        setOrders(orderReport.orders);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageOf(loadError));
      });
    return () => { active = false; };
  }, []);

  const weeklyTrend = useMemo(() => buildWeeklyTrend(orders ?? []), [orders]);
  const lowStockProducts = useMemo(
    () => (products ?? [])
      .filter((product) => product.stock > 0 && product.stock <= 5)
      .sort((left, right) => left.stock - right.stock || left.name.localeCompare(right.name)),
    [products],
  );
  const outOfStockCount = useMemo(
    () => products?.filter((product) => product.stock === 0).length ?? 0,
    [products],
  );
  const inventoryValue = useMemo(
    () => (products ?? []).reduce((value, product) => value + product.price_paise * product.stock, 0),
    [products],
  );
  const displayedOutOfStock = Math.min(outOfStockCount, 3);
  const displayedLowStock = Math.min(lowStockProducts.length, Math.max(0, 5 - displayedOutOfStock));
  const additionalStockAlerts = lowStockProducts.length + outOfStockCount
    - displayedOutOfStock - displayedLowStock;

  return (
    <>
      <PageTitle page="analytics" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="executive-stat-grid">
        <ExecutiveMetric icon="₹" label="Revenue today" value={report?.revenue ?? "—"} detail="Completed orders today" tone="green" />
        <ExecutiveMetric icon="↗" label="Orders today" value={report?.orders_today ?? "—"} detail={`${report?.orders_this_week ?? "—"} this week`} tone="blue" />
        <ExecutiveMetric icon="▦" label="Inventory value" value={products ? formatMoney(inventoryValue) : "—"} detail="Current stock at listed prices" tone="amber" />
        <ExecutiveMetric icon="◎" label="Customers on file" value={customers?.length ?? "—"} detail="Customer records in this store" tone="purple" />
      </div>
      <div className="executive-operations-strip">
        <MetricCard label="Orders this week" value={report?.orders_this_week ?? "—"} tone="blue" />
        <MetricCard label="Products sold today" value={report?.products_sold ?? "—"} tone="amber" />
        <MetricCard label="Average order size" value={report?.average_order_size ?? "—"} tone="purple" />
      </div>

      <div className="executive-dashboard-grid">
        <Panel eyebrow="SALES PERFORMANCE" title="Weekly trends" className="executive-trends-panel">
          <WeeklyTrends points={weeklyTrend} loading={!orders} />
        </Panel>

        <Panel
          eyebrow="BEST SELLERS"
          title="Top products"
          action={<span className="count-pill">By units sold</span>}
          className="executive-top-products"
        >
          {report?.top_products.length
            ? <RankedBars entries={report.top_products.map((item) => ({ label: item.product, value: item.quantity }))} />
            : <EmptyRetail title="No sales yet" detail="Product rankings appear as orders come in." />}
        </Panel>

        <Panel
          eyebrow="INVENTORY HEALTH"
          title="Low stock products"
          action={
            <span className={`stock-alert-count${lowStockProducts.length || outOfStockCount ? " has-alerts" : ""}`}>
              {lowStockProducts.length + outOfStockCount} alerts
            </span>
          }
          className="executive-low-stock"
        >
          {products === null ? (
            <div className="executive-loading" role="status">Loading inventory…</div>
          ) : lowStockProducts.length || outOfStockCount ? (
            <div className="low-stock-list">
              {products.filter((product) => product.stock === 0).slice(0, 3).map((product) => (
                <div className="low-stock-row is-out" key={product.id}>
                  <span className="low-stock-indicator" />
                  <span className="low-stock-name"><strong>{product.name}</strong><small>Out of stock</small></span>
                  <span className="low-stock-quantity">0 {product.unit}</span>
                </div>
              ))}
              {lowStockProducts.slice(0, displayedLowStock).map((product) => (
                <div className="low-stock-row" key={product.id}>
                  <span className="low-stock-indicator" />
                  <span className="low-stock-name"><strong>{product.name}</strong><small>Reorder soon</small></span>
                  <span className="low-stock-quantity">{product.stock} {product.unit}</span>
                </div>
              ))}
              {additionalStockAlerts > 0 && (
                <span className="low-stock-more">
                  +{additionalStockAlerts} more products need attention
                </span>
              )}
            </div>
          ) : (
            <EmptyRetail title="Stock levels look good" detail="No products are currently low or out of stock." />
          )}
        </Panel>

        <Panel eyebrow="CUSTOMER PREFERENCES" title="Most ordered categories" className="executive-categories">
          {report?.top_categories.length
            ? <RankedBars entries={report.top_categories.map((item) => ({ label: item.category, value: item.quantity }))} />
            : <EmptyRetail title="No category data yet" detail="Category insights appear as orders come in." />}
        </Panel>
      </div>
    </>
  );
}

function ExecutiveMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: string;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`executive-metric tone-${tone}`}>
      <span className="executive-metric-icon" aria-hidden="true">{icon}</span>
      <span className="executive-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function WeeklyTrends({
  points,
  loading,
}: {
  points: ReturnType<typeof buildWeeklyTrend>;
  loading: boolean;
}) {
  if (loading) return <div className="executive-loading" role="status">Loading weekly trends…</div>;
  if (points.every((point) => point.orders === 0)) {
    return <EmptyRetail title="Your weekly trend starts here" detail="Daily orders and revenue will appear as you complete sales." />;
  }

  const maxRevenue = Math.max(...points.map((point) => point.revenuePaise), 1);
  return (
    <div className="weekly-trend-chart" aria-label="Revenue and order count for the last seven days">
      <div className="weekly-chart-legend">
        <span><i className="legend-revenue" /> Revenue</span>
        <span><i className="legend-orders" /> Order count below</span>
      </div>
      <div className="weekly-chart">
        <div className="weekly-chart-guides" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="weekly-chart-bars">
          {points.map((point) => (
            <div className="weekly-chart-column" key={point.date}>
              <span className="weekly-bar-value">{point.revenuePaise ? formatMoney(point.revenuePaise) : "—"}</span>
              <div
                aria-label={`${point.label}: ${formatMoney(point.revenuePaise)}, ${point.orders} orders`}
                className="weekly-bar-track"
                role="img"
              >
                <span style={{ height: `${point.revenuePaise ? Math.max(5, point.revenuePaise / maxRevenue * 100) : 0}%` }} />
              </div>
              <strong>{point.label}</strong>
              <small>{point.orders} {point.orders === 1 ? "order" : "orders"}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminPage({
  evaluation,
  onNavigate,
}: {
  evaluation: EvaluationReport | null;
  onNavigate: (page: "inventory" | "orders" | "analytics" | "evaluation") => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getProducts(), getOrders(), getBusinessAnalytics()])
      .then(([businessProducts, orderReport, analyticsReport]) => {
        setProducts(businessProducts);
        setOrderCount(orderReport.total);
        setAnalytics(analyticsReport);
      })
      .catch((loadError: unknown) => setError(messageOf(loadError)));
  }, []);

  const sections = [
    { title: "Inventory", description: `${products?.length ?? "—"} products · ${products?.filter((product) => product.stock > 0 && product.stock <= 5).length ?? "—"} low stock`, page: "inventory" as const, label: "Manage stock" },
    { title: "Orders", description: `${orderCount ?? "—"} saved customer orders`, page: "orders" as const, label: "View orders" },
    { title: "Analytics", description: `${analytics?.revenue ?? "—"} revenue today`, page: "analytics" as const, label: "Open analytics" },
    { title: "Benchmark", description: evaluation ? `${evaluation.passed}/${evaluation.total_samples} passed · ${evaluation.accuracy}%` : "Run the speech benchmark to review accuracy.", page: "evaluation" as const, label: evaluation ? "Review results" : "Run benchmark" },
  ];

  return (
    <>
      <PageTitle page="admin" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="retail-stat-grid">
        <MetricCard label="Catalog products" value={products?.length ?? "—"} tone="green" />
        <MetricCard label="Orders stored" value={orderCount ?? "—"} tone="blue" />
        <MetricCard label="Low stock alerts" value={products?.filter((product) => product.stock > 0 && product.stock <= 5).length ?? "—"} tone="amber" />
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
