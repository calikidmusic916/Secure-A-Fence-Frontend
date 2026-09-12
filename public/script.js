// API Configuration
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.'))
  ? 'http://' + window.location.hostname + ':3000'
  : 'https://secure-a-fence-backend.onrender.com';

console.log('Using API_BASE:', API_BASE);

// Global State Variables
let productsData = [];
let cart = []; // Array of { productId, quantity }
let currentUser = null;
let authToken = localStorage.getItem('saf_token') || null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Set default dates for date pickers
  const today = new Date().toISOString().split('T')[0];
  const startDateInput = document.getElementById('checkoutStartDate');
  const pickupDateInput = document.getElementById('pickupDate');
  if (startDateInput) startDateInput.value = today;
  if (pickupDateInput) pickupDateInput.value = today;

  fetchProducts();
  checkAuthUser();
  runCalculator();
});

// View Switching Navigation
function toggleMobileMenu() {
  const navLinks = document.getElementById('navLinksList');
  if (navLinks) navLinks.classList.toggle('open');
}

function switchView(viewId) {
  // Close mobile menu when switching views
  const navLinks = document.getElementById('navLinksList');
  if (navLinks) navLinks.classList.remove('open');

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  // Update active nav button
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const navBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => 
    b.getAttribute('onclick') && b.getAttribute('onclick').includes(viewId)
  );
  if (navBtn) navBtn.classList.add('active');

  // Trigger view specific loads
  if (viewId === 'portal-view') {
    loadCustomerPortal();
  } else if (viewId === 'admin-view') {
    loadAdminDashboard();
  }
}

// Fetch Product Catalog from REST API
async function fetchProducts() {
  const container = document.getElementById('productGridContainer');
  if (container) container.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">⌛ Loading products...</p>`;

  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (res.ok) {
      productsData = await res.json();
      renderProductGrid(productsData);
    } else {
      console.error('Failed to fetch products:', res.statusText);
      if (container) container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--warning);">❌ Error loading products: ${res.statusText}</p>`;
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    if (container) container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--warning);">❌ Network Error: Could not connect to backend.</p>`;
  }
}

// Render Product Grid
function renderProductGrid(products) {
  const container = document.getElementById('productGridContainer');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No products found.</p>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img-wrapper">
        <span class="stock-tag">In Yard: ${p.inStock} units</span>
        <img src="${p.image}" alt="${p.name}" class="product-img">
      </div>
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <div class="product-specs">${p.specs}</div>

        <div class="qty-selector-catalog">
          <label for="qty-${p.id}">Quantity:</label>
          <input type="number" id="qty-${p.id}" value="1" min="1" max="${p.inStock}" class="form-input qty-input-small">
        </div>

        <div class="product-prices">
          <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">OUTRIGHT PURCHASE</span>
            <span class="sale-price">$${p.salePrice.toFixed(2)}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">RENTAL MONTHLY</span>
            <span class="rental-price" style="font-weight:700; color:#38bdf8;">$${p.rentalPriceMonthly.toFixed(2)} / mo</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-accent" onclick="handleAddToCartFromCatalog('${p.id}', 'sale')">Buy Now</button>
          <button class="btn btn-primary" onclick="handleAddToCartFromCatalog('${p.id}', 'rental')">Rent Now</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Add to Cart from Catalog with Quantity
function handleAddToCartFromCatalog(productId, orderType) {
  const qtyInput = document.getElementById(`qty-${productId}`);
  const qty = parseInt(qtyInput.value) || 1;

  if (qty <= 0) {
    alert('Please enter a valid quantity.');
    return;
  }

  addToCart(productId, qty, orderType);
  openCartModal();
}

// Filter Catalog Categories
function filterCatalog(category) {
  document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  if (category === 'all') {
    renderProductGrid(productsData);
  } else {
    const filtered = productsData.filter(p => p.type === category);
    renderProductGrid(filtered);
  }
}

// Interactive Fence Calculator
function runCalculator() {
  const linearFeet = parseFloat(document.getElementById('calcLinearFeet').value) || 0;
  const panelWidth = parseFloat(document.getElementById('calcPanelWidth').value) || 10;
  const includeStands = document.getElementById('calcIncludeStands').checked;
  const includeClips = document.getElementById('calcIncludeClips').checked;

  if (linearFeet <= 0) return;

  const panelsNeeded = Math.ceil(linearFeet / panelWidth);
  const standsNeeded = includeStands ? panelsNeeded + 1 : 0;
  const clipsNeeded = includeClips ? panelsNeeded : 0;

  // Exact Prices requested: $65 panel, $10 stand, $5 clip
  const buyTotal = (panelsNeeded * 65.00) + (standsNeeded * 10.00) + (clipsNeeded * 5.00);
  const rentTotal = (panelsNeeded * 15.00) + (standsNeeded * 3.00) + (clipsNeeded * 1.00);

  document.getElementById('resPanels').innerText = `${panelsNeeded} Panels (${panelWidth}' x 6')`;
  document.getElementById('resStands').innerText = `${standsNeeded} Heavy Base Stands`;
  document.getElementById('resClips').innerText = `${clipsNeeded} Safety Connector Clips`;
  document.getElementById('resBuyTotal').innerText = `$${buyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('resRentTotal').innerText = `$${rentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} / mo`;
}

// Add Package from Calculator to Cart
function addPackageToCart(orderType) {
  const linearFeet = parseFloat(document.getElementById('calcLinearFeet').value) || 200;
  const panelWidth = parseFloat(document.getElementById('calcPanelWidth').value) || 10;
  const includeStands = document.getElementById('calcIncludeStands').checked;
  const includeClips = document.getElementById('calcIncludeClips').checked;

  const panelsNeeded = Math.ceil(linearFeet / panelWidth);
  const standsNeeded = includeStands ? panelsNeeded + 1 : 0;
  const clipsNeeded = includeClips ? panelsNeeded : 0;

  const panelProd = productsData.find(p => p.type === 'panel') || { id: 'prod-panel-sale' };
  const standProd = productsData.find(p => p.type === 'stand') || { id: 'prod-stand-sale' };
  const clipProd = productsData.find(p => p.type === 'clip') || { id: 'prod-clip-sale' };

  addToCart(panelProd.id, panelsNeeded, orderType);
  if (standsNeeded > 0) addToCart(standProd.id, standsNeeded, orderType);
  if (clipsNeeded > 0) addToCart(clipProd.id, clipsNeeded, orderType);

  openCartModal();
}

// Cart Logic
function addToCart(productId, qty = 1, preferredOrderType = 'sale') {
  const cartOrderTypeSelect = document.getElementById('cartOrderType');
  if (cartOrderTypeSelect) cartOrderTypeSelect.value = preferredOrderType;

  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ productId, quantity: qty });
  }

  updateCartBadge();
}

function updateCartBadge() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cartBadgeCount');
  if (badge) badge.innerText = totalItems;
}

function openCartModal() {
  renderCartModal();
  document.getElementById('cartModal').classList.add('active');
}

function closeCartModal() {
  document.getElementById('cartModal').classList.remove('active');
}

function renderCartModal() {
  const container = document.getElementById('cartItemsList');
  const orderType = document.getElementById('cartOrderType').value;

  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Your shopping cart is currently empty.</p>`;
    document.getElementById('cartSubtotalVal').innerText = '$0.00';
    document.getElementById('cartDeliveryFeeVal').innerText = '$0.00';
    document.getElementById('cartTaxVal').innerText = '$0.00';
    document.getElementById('cartTotalVal').innerText = '$0.00';
    return;
  }

  let subtotal = 0;

  container.innerHTML = cart.map(item => {
    const prod = productsData.find(p => p.id === item.productId);
    if (!prod) return '';

    const unitPrice = orderType === 'rental' ? prod.rentalPriceMonthly : prod.salePrice;
    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;

    return `
      <div class="cart-item">
        <img src="${prod.image}" style="width: 45px; height: 45px; object-fit: contain;">
        <div class="cart-item-title">
          <div>${prod.name}</div>
          <small style="color: var(--text-muted);">$${unitPrice.toFixed(2)} ${orderType === 'rental' ? '/ month' : 'each'}</small>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', -1)">-</button>
          <span style="font-weight: bold; width: 30px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', 1)">+</button>
        </div>
        <div style="font-weight: bold; margin-left: 0.5rem; color: var(--accent); min-width: 70px; text-align: right;">
          $${itemTotal.toFixed(2)}
        </div>
      </div>
    `;
  }).join('');

  const distance = parseFloat(document.getElementById('checkoutDistance').value) || 0;
  const deliveryFee = distance <= 20 ? 0 : (distance - 20) * 2 * 1.00;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + deliveryFee + tax;

  document.getElementById('cartSubtotalVal').innerText = `$${subtotal.toFixed(2)}`;
  document.getElementById('cartDeliveryFeeVal').innerText = `$${deliveryFee.toFixed(2)}`;
  document.getElementById('cartTaxVal').innerText = `$${tax.toFixed(2)}`;
  document.getElementById('cartTotalVal').innerText = `$${total.toFixed(2)}`;
}

function changeCartQty(productId, delta) {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.productId !== productId);
  }

  updateCartBadge();
  renderCartModal();
}

// Checkout Submit
async function submitCheckout() {
  if (cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  if (!authToken) {
    alert('Please sign in or create a customer account to complete your order.');
    closeCartModal();
    switchView('portal-view');
    return;
  }

  const orderType = document.getElementById('cartOrderType').value;
  const deliveryAddress = document.getElementById('checkoutAddress').value;
  const deliveryDistance = document.getElementById('checkoutDistance').value;
  const jobsiteContact = document.getElementById('checkoutContact').value;
  const startDate = document.getElementById('checkoutStartDate').value;

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        orderType,
        items: cart,
        deliveryAddress,
        deliveryDistance,
        jobsiteContact,
        startDate
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert(`🎉 Order ${data.order.id} submitted successfully! Your invoice and delivery dispatch have been created.`);
      cart = [];
      updateCartBadge();
      closeCartModal();
      fetchProducts(); // Refresh stock
      switchView('portal-view');
    } else {
      alert(data.error || 'Failed to place order.');
    }
  } catch (err) {
    alert('Network or server error submitting checkout.');
  }
}

// --- AUTHENTICATION & CUSTOMER PORTAL ---

async function checkAuthUser() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      currentUser = await res.json();
      updateAuthUI();
    } else {
      logoutUser();
    }
  } catch (e) {
    logoutUser();
  }
}

function updateAuthUI() {
  const authStatus = document.getElementById('authStatusText');
  if (currentUser) {
    authStatus.innerText = `Logged in as ${currentUser.name} (${currentUser.role.toUpperCase()})`;
    authStatus.style.color = 'var(--success)';
  } else {
    authStatus.innerText = 'Not Signed In';
    authStatus.style.color = 'var(--accent)';
  }
}

function toggleAuthTab(tab) {
  const nameGrp = document.getElementById('nameGroup');
  const companyGrp = document.getElementById('companyGroup');
  const submitBtn = document.getElementById('authSubmitBtn');
  const loginBtn = document.getElementById('loginTabBtn');
  const regBtn = document.getElementById('registerTabBtn');

  if (tab === 'register') {
    nameGrp.style.display = 'block';
    companyGrp.style.display = 'block';
    submitBtn.innerText = 'Create Account';
    loginBtn.classList.remove('active');
    regBtn.classList.add('active');
  } else {
    nameGrp.style.display = 'none';
    companyGrp.style.display = 'none';
    submitBtn.innerText = 'Sign In to Account';
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  console.log('Auth submit triggered');
  const isRegister = document.getElementById('registerTabBtn').classList.contains('active');
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;

  const endpoint = isRegister ? `${API_BASE}/api/auth/register` : `${API_BASE}/api/auth/login`;
  console.log('Calling endpoint:', endpoint);

  const bodyData = isRegister ? {
    name: document.getElementById('authName').value,
    company: document.getElementById('authCompany').value,
    email,
    password
  } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    const data = await res.json();
    if (res.ok) {
      console.log('Auth success:', data);
      authToken = data.token;
      localStorage.setItem('saf_token', authToken);
      currentUser = data.user;
      updateAuthUI();
      loadCustomerPortal();
    } else {
      console.error('Auth failed:', data.error);
      alert(data.error || 'Authentication failed');
    }
  } catch (err) {
    console.error('Network error during auth:', err);
    alert('Server error during auth.');
  }
}

function logoutUser() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('saf_token');
  updateAuthUI();
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('customerDashboard').style.display = 'none';
}

async function loadCustomerPortal() {
  if (!currentUser) {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('customerDashboard').style.display = 'none';
    return;
  }

  document.getElementById('authSection').style.display = 'none';
  document.getElementById('customerDashboard').style.display = 'block';

  document.getElementById('custNameVal').innerText = currentUser.name;
  document.getElementById('custCompanyVal').innerText = currentUser.company || 'Direct Buyer';

  try {
    const res = await fetch(`${API_BASE}/api/orders/my-orders`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      document.getElementById('custOrdersCount').innerText = data.orders.length;
      document.getElementById('custRentalsCount').innerText = data.rentals.filter(r => r.status === 'Active' || r.status === 'Pickup Scheduled').length;

      // Render Active Rentals Table
      const rentalsBody = document.getElementById('custRentalsTableBody');
      rentalsBody.innerHTML = data.rentals.length === 0 ? `<tr><td colspan="7" style="text-align:center;">No active rentals found.</td></tr>` :
        data.rentals.map(r => `
          <tr>
            <td><strong>${r.id}</strong></td>
            <td>${r.jobsiteAddress}</td>
            <td>${r.startDate}</td>
            <td>${r.endDate}</td>
            <td>$${r.monthlyRateTotal.toFixed(2)}/mo</td>
            <td><span class="status-badge status-${r.status.toLowerCase().replace(/\s+/g, '')}">${r.status}</span></td>
            <td>
              <button class="btn btn-outline" style="font-size:0.8rem; padding:0.3rem 0.6rem;" onclick="openRentalModal('${r.id}', 'extend')">Extend</button>
              <button class="btn btn-primary" style="font-size:0.8rem; padding:0.3rem 0.6rem;" onclick="openRentalModal('${r.id}', 'pickup')">Request Pickup</button>
            </td>
          </tr>
        `).join('');

      // Render Sales Orders Table
      const ordersBody = document.getElementById('custOrdersTableBody');
      ordersBody.innerHTML = data.orders.length === 0 ? `<tr><td colspan="6" style="text-align:center;">No sales orders placed yet.</td></tr>` :
        data.orders.map(o => `
          <tr>
            <td><strong>${o.id}</strong></td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td>${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</td>
            <td>$${o.totalAmount.toFixed(2)}</td>
            <td>${o.deliveryAddress}</td>
            <td><span class="status-badge status-${o.status.toLowerCase().replace(/\s+/g, '')}">${o.status}</span></td>
          </tr>
        `).join('');
    }
  } catch (e) {
    console.error('Error loading customer orders', e);
  }
}

// Rental Extend / Pickup Modal
function openRentalModal(rentalId, actionType) {
  document.getElementById('targetRentalId').value = rentalId;
  document.getElementById('targetActionType').value = actionType;

  if (actionType === 'extend') {
    document.getElementById('rentalActionTitle').innerText = `Extend Rental (${rentalId})`;
    document.getElementById('extendRentalFields').style.display = 'block';
    document.getElementById('pickupRentalFields').style.display = 'none';
  } else {
    document.getElementById('rentalActionTitle').innerText = `Schedule Jobsite Pickup (${rentalId})`;
    document.getElementById('extendRentalFields').style.display = 'none';
    document.getElementById('pickupRentalFields').style.display = 'block';
  }

  document.getElementById('rentalActionModal').classList.add('active');
}

function closeRentalActionModal() {
  document.getElementById('rentalActionModal').classList.remove('active');
}

async function submitRentalAction() {
  const rentalId = document.getElementById('targetRentalId').value;
  const actionType = document.getElementById('targetActionType').value;

  const endpoint = actionType === 'extend' ? `${API_BASE}/api/rentals/extend` : `${API_BASE}/api/rentals/request-pickup`;
  const bodyData = actionType === 'extend' ? {
    rentalId,
    additionalDays: document.getElementById('extendDays').value
  } : {
    rentalId,
    pickupDate: document.getElementById('pickupDate').value,
    notes: document.getElementById('pickupNotes').value
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(bodyData)
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      closeRentalActionModal();
      loadCustomerPortal();
    } else {
      alert(data.error || 'Action failed');
    }
  } catch (e) {
    alert('Server error processing rental action.');
  }
}

// --- ADMIN OPERATIONS & MANAGEMENT DASHBOARD ---

async function loadAdminDashboard() {
  if (!authToken) {
    alert('Admin authentication required. Please sign in as admin@secureafence.com.');
    switchView('portal-view');
    return;
  }

  try {
    // Overview Metrics
    const resOverview = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (resOverview.ok) {
      const { metrics } = await resOverview.json();
      document.getElementById('adminMetricSalesRev').innerText = `$${metrics.totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      document.getElementById('adminMetricRentalRev').innerText = `$${metrics.monthlyRentalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} / mo`;
      document.getElementById('adminMetricPanelsRented').innerText = `${metrics.totalPanelsRentedOut} Panels`;
      document.getElementById('adminMetricWarehouseStock').innerText = `${metrics.panelsInWarehouse} Panels`;
    }

    // Load Admin Rentals Fleet Table
    loadAdminRentalsTable();
    loadAdminSalesTable();
    loadAdminShipmentsTable();

  } catch (e) {
    console.error('Error loading admin dashboard', e);
  }
}

function switchAdminSubTab(subTab) {
  document.getElementById('adminSubTabRentals').style.display = subTab === 'rentals' ? 'block' : 'none';
  document.getElementById('adminSubTabSales').style.display = subTab === 'sales' ? 'block' : 'none';
  document.getElementById('adminSubTabShipments').style.display = subTab === 'shipments' ? 'block' : 'none';

  document.getElementById('adminTab1').classList.toggle('active', subTab === 'rentals');
  document.getElementById('adminTab2').classList.toggle('active', subTab === 'sales');
  document.getElementById('adminTab3').classList.toggle('active', subTab === 'shipments');
}

async function loadAdminRentalsTable() {
  const res = await fetch(`${API_BASE}/api/admin/rentals`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (res.ok) {
    const rentals = await res.json();
    const tbody = document.getElementById('adminRentalsTableBody');

    tbody.innerHTML = rentals.map(r => `
      <tr>
        <td><strong>${r.id}</strong></td>
        <td>
          <div>${r.customerName}</div>
          <small style="color:var(--text-muted);">${r.customerCompany}</small>
        </td>
        <td>${r.jobsiteAddress}</td>
        <td>${r.items.map(i => `<strong>${i.quantity}x</strong> ${i.name}`).join('<br>')}</td>
        <td>${r.startDate} to ${r.endDate}</td>
        <td><span class="status-badge status-${r.status.toLowerCase().replace(/\s+/g, '')}">${r.status}</span></td>
        <td>
          ${r.status !== 'Returned' ? 
            `<button class="btn btn-accent" style="font-size:0.8rem; padding:0.3rem 0.6rem;" onclick="checkinRental('${r.id}')">📥 Check-In Return</button>` : 
            `<span style="color:var(--text-muted); font-size:0.8rem;">Returned to Yard</span>`}
        </td>
      </tr>
    `).join('');
  }
}

async function checkinRental(rentalId) {
  if (!confirm(`Are you sure you want to check in rental ${rentalId}? This will mark it as returned and restore panel counts back to warehouse stock.`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/rentals/${rentalId}/checkin`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      loadAdminDashboard();
      fetchProducts();
    } else {
      alert(data.error);
    }
  } catch (e) {
    alert('Error processing check-in.');
  }
}

async function loadAdminSalesTable() {
  const res = await fetch(`${API_BASE}/api/admin/sales`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (res.ok) {
    const orders = await res.json();
    const tbody = document.getElementById('adminSalesTableBody');

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>${o.id}</strong></td>
        <td>${o.customerName} (${o.customerCompany})</td>
        <td>${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</td>
        <td>$${o.totalAmount.toFixed(2)}</td>
        <td>${o.deliveryAddress}</td>
        <td><span class="status-badge status-${o.status.toLowerCase().replace(/\s+/g, '')}">${o.status}</span></td>
        <td>
          <select onchange="updateOrderStatus('${o.id}', this.value)" style="background:var(--bg-dark); color:#fff; border:1px solid var(--border); padding:0.2rem; border-radius:0.3rem; font-size:0.8rem;">
            <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
      </tr>
    `).join('');
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/sales/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      loadAdminSalesTable();
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadAdminShipmentsTable() {
  const res = await fetch(`${API_BASE}/api/admin/shipments`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (res.ok) {
    const shipments = await res.json();
    const tbody = document.getElementById('adminShipmentsTableBody');

    tbody.innerHTML = shipments.map(s => `
      <tr>
        <td><strong>${s.id}</strong></td>
        <td><span style="color:var(--accent); font-weight:bold;">${s.type}</span></td>
        <td>${s.orderId}</td>
        <td>${s.driverName}</td>
        <td>${s.dispatchDate}</td>
        <td>${s.destination}</td>
        <td><span class="status-badge status-${s.status.toLowerCase().replace(/\s+/g, '')}">${s.status}</span></td>
      </tr>
    `).join('');
  }
}

// Custom Gate & Door Designer Logic
function updateGateDesigner() {
  const style = document.getElementById('gateStyle').value;
  const hardwareGroup = document.getElementById('gateHardwareGroup');
  const qtyGroup = document.getElementById('gateQtyGroup');
  const orderTypeGroup = document.getElementById('gateOrderTypeGroup');
  const resultsBox = document.getElementById('gateResultsBox');
  const preview = document.getElementById('gateVisualPreview');

  if (style === 'none') {
    if (hardwareGroup) hardwareGroup.style.display = 'none';
    if (qtyGroup) qtyGroup.style.display = 'none';
    if (orderTypeGroup) orderTypeGroup.style.display = 'none';
    if (resultsBox) resultsBox.style.display = 'none';
    if (preview) preview.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Select a gate style to view preview</span>';
    return;
  }

  if (hardwareGroup) hardwareGroup.style.display = 'block';
  if (qtyGroup) qtyGroup.style.display = 'block';
  if (orderTypeGroup) orderTypeGroup.style.display = 'block';
  if (resultsBox) resultsBox.style.display = 'block';

  const orderType = document.getElementById('gateOrderType').value;
  const qty = parseInt(document.getElementById('gateQuantity').value) || 1;
  const usePadlock = document.getElementById('gatePadlockLatch').checked;
  const useDropRod = document.getElementById('gateDropRod').checked;
  const useWheel = document.getElementById('gateWheel').checked;

  const gateProdId = style === 'pedestrian' ? 'prod-gate-pedestrian' : (style === 'single-swing' ? 'prod-gate-single' : 'prod-gate-double');
  const gateProd = productsData.find(p => p.id === gateProdId);
  const latchProd = productsData.find(p => p.id === 'prod-gate-latch');
  const rodProd = productsData.find(p => p.id === 'prod-gate-rod');
  const wheelProd = productsData.find(p => p.id === 'prod-gate-wheel');

  if (!gateProd) return;

  const getPrice = (prod) => (orderType === 'rental' ? prod.rentalPriceMonthly : prod.salePrice);

  let unitTotal = getPrice(gateProd);
  let summary = gateProd.name;

  if (usePadlock && latchProd) {
    unitTotal += getPrice(latchProd);
    summary += ' + Padlock Latch';
  }
  if (useDropRod && rodProd) {
    unitTotal += getPrice(rodProd);
    summary += ' + Drop-Rod';
  }
  if (useWheel && wheelProd) {
    unitTotal += getPrice(wheelProd);
    summary += ' + Support Wheel';
  }

  const finalTotal = unitTotal * qty;

  document.getElementById('resGateSummary').innerText = `${qty}x ${summary}`;
  document.getElementById('resGateTotal').innerText = `$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  let previewHtml = `
    <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
      <img src="${gateProd.image}" style="height: 120px; opacity: 0.8;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 2px dashed var(--accent); width: ${style === 'pedestrian' ? '40px' : '100px'}; height: 80px; background: rgba(56, 189, 248, 0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: var(--accent); font-weight: bold; text-transform: uppercase;">
        ${style.replace('-', ' ')}
      </div>
  `;

  if (useWheel) {
    previewHtml += `<div style="position: absolute; bottom: 15px; left: calc(50% + ${style === 'pedestrian' ? '15px' : '45px'}); width: 12px; height: 12px; background: #475569; border-radius: 50%; border: 2px solid #fff;"></div>`;
  }
  if (usePadlock) {
    previewHtml += `<div style="position: absolute; top: 45%; left: calc(50% + ${style === 'pedestrian' ? '22px' : '52px'}); width: 8px; height: 10px; background: #f59e0b; border-radius: 2px;"></div>`;
  }

  previewHtml += '</div>';
  if (preview) preview.innerHTML = previewHtml;
}

function addCustomGateToCart() {
  const style = document.getElementById('gateStyle').value;
  const orderType = document.getElementById('gateOrderType').value;
  const qty = parseInt(document.getElementById('gateQuantity').value) || 1;
  const usePadlock = document.getElementById('gatePadlockLatch').checked;
  const useDropRod = document.getElementById('gateDropRod').checked;
  const useWheel = document.getElementById('gateWheel').checked;

  const gateProdId = style === 'pedestrian' ? 'prod-gate-pedestrian' : (style === 'single-swing' ? 'prod-gate-single' : 'prod-gate-double');
  
  addToCart(gateProdId, qty, orderType);
  if (usePadlock) addToCart('prod-gate-latch', qty, orderType);
  if (useDropRod) addToCart('prod-gate-rod', qty, orderType);
  if (useWheel) addToCart('prod-gate-wheel', qty, orderType);

  openCartModal();
  alert(`${qty}x Custom Gate Package added to your cart!`);
}
