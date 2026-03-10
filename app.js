// Kimoel Trading - Admin Dashboard

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let invoices = [];
let currentFilter = "all";

const invoiceTableBody = document.getElementById("invoiceTableBody");
const invoiceTable = document.getElementById("invoiceTable");
const emptyState = document.getElementById("emptyState");
const modalOverlay = document.getElementById("modalOverlay");
const modalBody = document.getElementById("modalBody");
const modalFooter = document.getElementById("modalFooter");
const modalClose = document.getElementById("modalClose");
const filterBtns = document.querySelectorAll(".filter-btn");

document.addEventListener("DOMContentLoaded", () => {
  fetchInvoices();
  setupListeners();
  subscribeToInvoices();
});

function setupListeners() {
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderInvoices();
    });
  });

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Are you sure you want to logout?")) {
      alert("Logged out successfully.");
    }
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    fetchInvoices();
  });
}

// ── Supabase: Fetch all invoices ──
async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoice_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invoices:", error.message);
    return;
  }

  console.log('Raw data from Supabase:', data);
  
  invoices = data.map(row => {
    console.log('Processing row:', row);
    const mapped = {
      id: row.id,
      reference: row.reference_number || row.reference || row.ref || "N/A",
      user: row.customer_name || row.user_name || row.name || row.full_name || row.user || "Unknown",
      email: row.customer_email || row.user_email || row.email || row.email_address || "No email",
      phone: row.customer_phone || row.user_phone || row.phone || "",
      city: row.customer_city || row.user_city || row.city || "",
      description: row.notes || row.description || row.details || "",
      // Product information
      product_id: row.product_id || row.productid || row.productId || row.product || "N/A",
      product_name: row.product_name || row.productname || row.productName || row.product || "Unknown Product",
      date: row.created_at,
      status: row.status
    };
    console.log('Mapped invoice:', mapped);
    return mapped;
  });
  
  console.log('Final invoices array:', invoices);

  updateCounts();
  renderInvoices();
}

// ── Supabase: Listen for new invoices in real time ──
function subscribeToInvoices() {
  supabase
    .channel("invoice_requests-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "invoice_requests" }, () => {
      fetchInvoices();
    })
    .subscribe();
}

// ── Supabase: Update invoice status ──
async function updateStatus(id, newStatus) {
  const { error } = await supabase
    .from("invoice_requests")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    console.error("Error updating status:", error.message);
    return;
  }

  // Update local data immediately
  const inv = invoices.find(i => i.id === id);
  if (inv) inv.status = newStatus;
  updateCounts();
  renderInvoices();
}

// ── UI: Update counts ──
function updateCounts() {
  document.getElementById("totalCount").textContent = invoices.length;
  document.getElementById("pendingCount").textContent = invoices.filter(i => i.status === "pending").length;
  document.getElementById("approvedCount").textContent = invoices.filter(i => i.status === "approved").length;
  document.getElementById("rejectedCount").textContent = invoices.filter(i => i.status === "rejected").length;
}

// ── UI: Render invoice table ──
function renderInvoices() {
  const filtered = currentFilter === "all"
    ? invoices
    : invoices.filter(i => i.status === currentFilter);

  if (filtered.length === 0) {
    invoiceTable.classList.remove("visible");
    emptyState.classList.remove("hidden");
    return;
  }

  invoiceTable.classList.add("visible");
  emptyState.classList.add("hidden");

  invoiceTableBody.innerHTML = filtered.map(inv => `
    <tr>
      <td><strong>${inv.reference}</strong></td>
      <td>${inv.user}</td>
      <td>
        <div class="product-info">
          <div class="product-name">${inv.product_name}</div>
          <div class="product-id">ID: ${inv.product_id}</div>
        </div>
      </td>
      <td>${formatDate(inv.date)}</td>
      <td><span class="status-badge ${inv.status}">${capitalize(inv.status)}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn btn-view" onclick="viewInvoice('${inv.id}')">View</button>
          ${inv.status === "pending" ? `
            <button class="action-btn btn-approve" onclick="updateStatus('${inv.id}', 'approved')">Approve</button>
            <button class="action-btn btn-reject" onclick="updateStatus('${inv.id}', 'rejected')">Reject</button>
          ` : ""}
        </div>
      </td>
    </tr>
  `).join("");
}

// ── UI: View invoice modal ──
function viewInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;

  modalBody.innerHTML = `
    <div class="modal-detail-row">
      <span class="modal-detail-label">Reference Number</span>
      <span class="modal-detail-value">${inv.reference}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">User</span>
      <span class="modal-detail-value">${inv.user}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Email</span>
      <span class="modal-detail-value">${inv.email}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Phone</span>
      <span class="modal-detail-value">${inv.phone}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">City</span>
      <span class="modal-detail-value">${inv.city}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Product ID</span>
      <span class="modal-detail-value">${inv.product_id}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Product Name</span>
      <span class="modal-detail-value">${inv.product_name}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Description</span>
      <span class="modal-detail-value">${inv.description}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Date</span>
      <span class="modal-detail-value">${formatDate(inv.date)}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Status</span>
      <span class="modal-detail-value"><span class="status-badge ${inv.status}">${capitalize(inv.status)}</span></span>
    </div>
  `;

  if (inv.status === "pending") {
    modalFooter.innerHTML = `
      <button class="modal-btn modal-btn-reject" onclick="updateStatus('${inv.id}', 'rejected'); closeModal();">Reject</button>
      <button class="modal-btn modal-btn-approve" onclick="updateStatus('${inv.id}', 'approved'); closeModal();">Approve</button>
    `;
  } else {
    modalFooter.innerHTML = `
      <button class="modal-btn modal-btn-close" onclick="closeModal()">Close</button>
    `;
  }

  modalOverlay.classList.add("active");
}

function closeModal() {
  modalOverlay.classList.remove("active");
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
