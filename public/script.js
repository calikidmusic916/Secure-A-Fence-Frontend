// API Configuration - Always connect to live online backend server
const API_BASE = 'https://secure-a-fence-backend.onrender.com';

console.log('--- Secure-A-Fence Frontend Initialized ---');
console.log('Connecting to Backend at:', API_BASE);

// Global State Variables
let productsData = [];
let cart = []; // Array of { productId, quantity }
let isQuoteMode = false;
let quoteData = null;
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
  if (viewId === 'store-view' || viewId === 'purchases-view') {
    fetchProducts();
  } else if (viewId === 'portal-view') {
    loadCustomerPortal();
  } else if (viewId === 'admin-view') {
    loadAdminDashboard();
  }
}

// Fetch Product Catalog from REST API
async function fetchProducts() {
  const rentalContainer = document.getElementById('productGridContainer');
  const purchaseContainer = document.getElementById('purchaseGridContainer');
  if (rentalContainer) rentalContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">⌛ Loading products...</p>`;
  if (purchaseContainer) purchaseContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">⌛ Loading products...</p>`;

  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (res.ok) {
      productsData = await res.json();
      renderProductGrid(productsData);
      renderPurchaseGrid(productsData);
    } else {
      console.error('Failed to fetch products:', res.statusText);
      const errMsg = `<p style="grid-column: 1/-1; text-align: center; color: var(--warning);">❌ Error loading products: ${res.statusText}</p>`;
      if (rentalContainer) rentalContainer.innerHTML = errMsg;
      if (purchaseContainer) purchaseContainer.innerHTML = errMsg;
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    const netErr = `<p style="grid-column: 1/-1; text-align: center; color: var(--warning);">❌ Network Error: Could not connect to backend.</p>`;
    if (rentalContainer) rentalContainer.innerHTML = netErr;
    if (purchaseContainer) purchaseContainer.innerHTML = netErr;
  }
}

// Helper to resolve product image URLs
function resolveProductImgUrl(img) {
  if (!img) return 'assets/panel.svg';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  if (img.startsWith('/assets/')) return img.substring(1);
  if (img.startsWith('assets/')) return img;
  return API_BASE + (img.startsWith('/') ? img : '/' + img);
}

// Render Fence Rentals Grid (only products enabled for rental catalog)
function renderProductGrid(products) {
  const container = document.getElementById('productGridContainer');
  if (!container) return;

  const rentalProducts = products.filter(p => p.isRental !== false);

  if (rentalProducts.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No rental products found.</p>`;
    return;
  }

  container.innerHTML = rentalProducts.map(p => {
    const hasPrice = p.rentalPriceMonthly && parseFloat(p.rentalPriceMonthly) > 0;

    return `
      <div class="product-card ${hasPrice ? '' : 'unavailable'}">
        <div class="product-img-wrapper">
          ${hasPrice ? '' : '<div class="unavailable-overlay-badge">✖ Not For Rent</div>'}
          <img src="${resolveProductImgUrl(p.image)}" alt="${p.name}" class="product-img">
        </div>
        <div class="product-body">
          <h3 class="product-name">${p.name}</h3>
          ${p.description ? `<p class="product-description">${p.description}</p>` : ''}
          <div class="product-specs">${p.specs}</div>

          <div class="product-prices" style="border-top: none; padding-top: 0; margin-bottom: 0.5rem;">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">SERVICE</span>
              <span class="sale-price" style="font-size: 1rem; color: #fff;">Jobsite Rental</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">MONTHLY RATE</span>
              ${hasPrice ? `<span class="rental-price" style="font-weight:700; color:#38bdf8;">$${parseFloat(p.rentalPriceMonthly).toFixed(2)} ${p.type === 'gate' ? '/ gate / mo' : '/ LF / mo'}</span>` : '<span style="color: #f87171; font-weight: 700; font-size: 0.9rem;">Unpriced</span>'}
            </div>
          </div>

          ${hasPrice ? `
            <div class="card-actions" style="margin-top: auto;">
              <button class="btn btn-primary" style="grid-column: 1 / -1; width: 100%;" onclick="switchView('calc-view')">Fence Rental Quote</button>
            </div>
          ` : `
            <div class="unavailable-banner">❌ Unavailable for Rental</div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Render Fence Panel Purchases Grid (only products enabled for purchase catalog)
function renderPurchaseGrid(products) {
  const container = document.getElementById('purchaseGridContainer');
  if (!container) return;

  const purchaseProducts = products.filter(p => p.isPurchase !== false);

  if (purchaseProducts.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No purchase products found.</p>`;
    return;
  }

  container.innerHTML = purchaseProducts.map(p => {
    const hasPrice = p.salePrice && parseFloat(p.salePrice) > 0;

    return `
      <div class="product-card ${hasPrice ? '' : 'unavailable'}">
        <div class="product-img-wrapper">
          ${hasPrice ? '' : '<div class="unavailable-overlay-badge">✖ Not For Sale</div>'}
          <img src="${resolveProductImgUrl(p.image)}" alt="${p.name}" class="product-img">
        </div>
        <div class="product-body">
          <h3 class="product-name">${p.name}</h3>
          ${p.description ? `<p class="product-description">${p.description}</p>` : ''}
          <div class="product-specs">${p.specs}</div>

          <div class="product-prices" style="border-top: none; padding-top: 0; margin-bottom: 0.5rem;">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">PRICING</span>
              <span style="font-size: 0.9rem; color: #fff; font-weight: 600;">Per Unit Purchase</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">UNIT PRICE</span>
              ${hasPrice ? `<span class="sale-price" style="font-weight:800; color:var(--accent); font-size:1.2rem;">$${parseFloat(p.salePrice).toFixed(2)} / unit</span>` : '<span style="color: #f87171; font-weight: 700; font-size: 0.9rem;">Unpriced</span>'}
            </div>
          </div>

          ${hasPrice ? `
            <div class="qty-selector-catalog" style="margin-top: auto;">
              <span>Qty:</span>
              <input type="number" id="qty-p-${p.id}" class="form-input qty-input-small" value="1" min="1">
            </div>

            <div class="card-actions" style="margin-top: 0.5rem;">
              <button class="btn btn-primary" style="grid-column: 1 / -1;" onclick="handleAddToCartFromCatalog('${p.id}', 'sale', 'qty-p-${p.id}')">🛒 Add Purchase to Cart</button>
            </div>
          ` : `
            <div class="unavailable-banner">❌ Unavailable for Purchase</div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Add to Cart from Catalog with Quantity
function handleAddToCartFromCatalog(productId, orderType, inputId = null) {
  const elementId = inputId || `qty-${productId}`;
  const qtyInput = document.getElementById(elementId);
  const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;

  if (qty <= 0) {
    alert('Please enter a valid quantity.');
    return;
  }

  addToCart(productId, qty, orderType);
  openCartModal();
}

// Filter Rentals Catalog Categories
function filterCatalog(category) {
  const section = document.getElementById('store-view');
  if (section) {
    section.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
  }
  if (event && event.target) event.target.classList.add('active');

  const rentalProducts = productsData.filter(p => p.isRental !== false);

  if (category === 'all') {
    renderProductGrid(rentalProducts);
  } else {
    const filtered = rentalProducts.filter(p => p.type === category);
    renderProductGrid(filtered);
  }
}

// Filter Purchases Catalog Categories
function filterPurchaseCatalog(category) {
  const section = document.getElementById('store-view');
  if (section) {
    section.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
  }
  if (event && event.target) event.target.classList.add('active');

  const purchaseProducts = productsData.filter(p => p.isPurchase !== false);

  if (category === 'all') {
    renderPurchaseGrid(purchaseProducts);
  } else {
    const filtered = purchaseProducts.filter(p => p.type === category);
    renderPurchaseGrid(filtered);
  }
}

// Interactive Fence Calculator
function runCalculator() {
  const L = parseFloat(document.getElementById('calcLinearFeet').value) || 0;
  const W = parseFloat(document.getElementById('calcPanelWidth').value) || 12;
  const M = parseInt(document.getElementById('calcMonths').value) || 1;
  const P = document.getElementById('calcPrivacy').checked ? 1 : 0;
  const G = parseInt(document.getElementById('calcGates').value) || 0;
  const D = parseFloat(document.getElementById('calcDeliveryZone').value) || 125;

  if (L <= 0) {
    document.getElementById('resSetupTotal').innerText = '$0.00';
    document.getElementById('resMonthlyTotal').innerText = '$0.00 / month';
    document.getElementById('resGrandTotal').innerText = '$0.00';
    return;
  }

  // Recurring Monthly Variables
  const monthlyFence = L * 1.35;
  const monthlyPrivacy = L * 0.33 * P;
  const monthlyGate = G * 25.00;
  const totalMonthly = monthlyFence + monthlyPrivacy + monthlyGate;

  // One-Time Variables
  const installLabor = L * 0.17;
  const removalLabor = L * 0.17;
  const totalLabor = installLabor + removalLabor;
  const setupTotal = totalLabor + D;

  // Grand Total Formula
  let rawTotal = (totalMonthly * M) + setupTotal;

  // Minimum Order Logic
  const finalTotal = rawTotal < 300 ? 300 : rawTotal;

  // Equipment Breakdown based on user-entered panel width in Ft (W)
  const panelWidth = W > 0 ? W : 12;
  const panelsCount = Math.ceil(L / panelWidth);
  const standsCount = panelsCount > 0 ? panelsCount + 1 : 0;
  const clipsCount = panelsCount;

  const quoteProductImg = document.getElementById('quoteProductImg');
  if (quoteProductImg) {
    const mainPanel = productsData.find(p => p.type === 'panel');
    let imgSrc = mainPanel && mainPanel.image ? (mainPanel.image.startsWith('/') ? API_BASE + mainPanel.image : mainPanel.image) : 'assets/panel.svg';
    if (P) {
      imgSrc = 'assets/privacy_screen.svg';
    }
    quoteProductImg.src = imgSrc;
  }

  if (document.getElementById('resPanelsCount')) {
    document.getElementById('resPanelsCount').innerText = `${panelsCount} Panels`;
    document.getElementById('resStandsCount').innerText = `${standsCount} Stands`;
    document.getElementById('resClipsCount').innerText = `${clipsCount} Clips`;
  }

  document.getElementById('resSetupTotal').innerText = `$${setupTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('resMonthlyTotal').innerText = `$${totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month`;
  document.getElementById('resMonthsSpan').innerText = M;
  document.getElementById('resGrandTotal').innerText = `$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  quoteData = {
    linearFeet: L,
    months: M,
    privacy: P,
    gates: G,
    delivery: D,
    totalMonthly,
    setupTotal,
    finalTotal
  };
}

// Request Contract / Quote
function submitRentalQuote() {
  if (!quoteData) return;
  isQuoteMode = true;
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
  isQuoteMode = false;
  document.getElementById('cartModal').classList.remove('active');
}

function renderCartModal() {
  const container = document.getElementById('cartItemsList');
  const orderType = document.getElementById('cartOrderType').value;

  if (isQuoteMode && quoteData) {
    document.getElementById('cartOrderType').value = 'rental';
    document.getElementById('cartOrderType').disabled = true;

    container.innerHTML = `
      <div class="cart-item" style="display: block;">
        <div style="font-weight: bold; color: var(--accent); margin-bottom: 0.5rem;">Custom Jobsite Rental Quote</div>
        <ul style="color: var(--text-muted); font-size: 0.9rem; padding-left: 1.5rem; margin-bottom: 1rem;">
          <li>${quoteData.linearFeet} Linear Feet of Fence</li>
          <li>${quoteData.months} Month Estimated Duration</li>
          <li>${quoteData.gates} Pedestrian Gate(s)</li>
          <li>Privacy Screen: ${quoteData.privacy ? 'Yes' : 'No'}</li>
        </ul>
      </div>
    `;

    if (document.getElementById('cartEquipmentBreakdown')) {
      const panelsCount = Math.ceil(quoteData.linearFeet / 12);
      const standsCount = panelsCount > 0 ? panelsCount + 1 : 0;
      const clipsCount = panelsCount;
      document.getElementById('cartEquipmentBreakdown').innerText = `${panelsCount} Panels | ${standsCount} Stands | ${clipsCount} Clips`;
    }

    if (document.getElementById('cartRentalBreakdown')) document.getElementById('cartRentalBreakdown').style.display = 'block';
    if (document.getElementById('cartSaleBreakdown')) document.getElementById('cartSaleBreakdown').style.display = 'none';
    if (document.getElementById('rentalMonthsGroup')) document.getElementById('rentalMonthsGroup').style.display = 'none';

    if (document.getElementById('cartSetupVal')) document.getElementById('cartSetupVal').innerText = `$${quoteData.setupTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (document.getElementById('cartMonthlyVal')) document.getElementById('cartMonthlyVal').innerText = `$${quoteData.totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo`;
    document.getElementById('cartTotalVal').innerText = `$${quoteData.finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const minWarn = document.getElementById('cartMinWarning');
    if (minWarn) minWarn.style.display = (quoteData.finalTotal === 300 && ((quoteData.totalMonthly * quoteData.months) + quoteData.setupTotal < 300)) ? 'block' : 'none';
    return;
  }

  document.getElementById('cartOrderType').disabled = false;

  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Your shopping cart is currently empty.</p>`;
    if (document.getElementById('cartSaleBreakdown')) document.getElementById('cartSaleBreakdown').style.display = 'block';
    if (document.getElementById('cartRentalBreakdown')) document.getElementById('cartRentalBreakdown').style.display = 'none';
    if (document.getElementById('rentalMonthsGroup')) document.getElementById('rentalMonthsGroup').style.display = 'none';
    document.getElementById('cartSubtotalVal').innerText = '$0.00';
    document.getElementById('cartDeliveryFeeVal').innerText = '$0.00';
    document.getElementById('cartTaxVal').innerText = '$0.00';
    document.getElementById('cartTotalVal').innerText = '$0.00';
    return;
  }

  container.innerHTML = cart.map(item => {
    const prod = productsData.find(p => p.id === item.productId);
    if (!prod) return '';

    const isRentalMode = orderType === 'rental';
    const unitPrice = isRentalMode ? prod.rentalPriceMonthly : prod.salePrice;
    const itemTotal = unitPrice * item.quantity;

    const rateText = isRentalMode
      ? (prod.type === 'gate' ? `$${unitPrice.toFixed(2)} / gate / month` : `$${unitPrice.toFixed(2)} / LF / month`)
      : `$${unitPrice.toFixed(2)} / unit`;

    const qtyDisplay = isRentalMode
      ? (prod.type === 'gate' ? `${item.quantity} Gate(s)` : `${item.quantity * 12} LF`)
      : `${item.quantity}`;

    const imgUrl = resolveProductImgUrl(prod.image);

    return `
      <div class="cart-item">
        <img src="${imgUrl}" style="width: 45px; height: 45px; object-fit: contain;">
        <div class="cart-item-title">
          <div>${prod.name}</div>
          <small style="color: var(--text-muted);">${rateText}</small>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', -1)">-</button>
          <span style="font-weight: bold; padding: 0 0.25rem; text-align: center; font-size: 0.85rem;">${qtyDisplay}</span>
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', 1)">+</button>
        </div>
        <div style="font-weight: bold; margin-left: 0.5rem; color: var(--accent); min-width: 70px; text-align: right;">
          $${itemTotal.toFixed(2)}
        </div>
      </div>
    `;
  }).join('');

  // 2. Set Rates from Pricing Formula
  const rateFence = 1.35; // per LF
  const ratePrivacy = 0.33; // per LF
  const rateGate = 25.00; // per gate
  const rateInstall = 0.17; // per LF setup
  const rateRemoval = 0.17; // per LF setup

  const distance = parseFloat(document.getElementById('checkoutDistance').value) || 0;
  const delivery = distance <= 20 ? 0 : (distance - 20) * 2 * 1.00;

  if (orderType === 'rental') {
    if (document.getElementById('cartSaleBreakdown')) document.getElementById('cartSaleBreakdown').style.display = 'none';
    if (document.getElementById('cartRentalBreakdown')) document.getElementById('cartRentalBreakdown').style.display = 'block';
    if (document.getElementById('rentalMonthsGroup')) document.getElementById('rentalMonthsGroup').style.display = 'block';

    const months = parseInt(document.getElementById('checkoutMonths').value) || 1;

    // Calculate total Linear Feet (LF) based on panels/items in cart
    let totalLf = 0;
    let totalGates = 0;
    let hasPrivacy = false;

    cart.forEach(item => {
      const prod = productsData.find(p => p.id === item.productId);
      if (prod) {
        if (prod.type === 'panel') {
          totalLf += item.quantity * 12; // 12ft wide panels
        } else if (prod.type === 'gate') {
          totalGates += item.quantity;
        } else if (prod.id.includes('privacy') || prod.type === 'accessory') {
          hasPrivacy = true;
        }
      }
    });

    if (totalLf === 0 && cart.length > 0) {
      const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
      totalLf = totalQty * 12;
    }

    // 3. Calculate Monthly Recurring
    const monthlyFence = totalLf * rateFence;
    const monthlyPrivacy = hasPrivacy ? (totalLf * ratePrivacy) : 0;
    const monthlyGate = totalGates * rateGate;
    const totalMonthly = monthlyFence + monthlyPrivacy + monthlyGate;

    // 4. Calculate One-Time Setup
    const laborInstall = totalLf * rateInstall;
    const laborRemoval = totalLf * rateRemoval;
    const totalSetup = laborInstall + laborRemoval + delivery;

    // 5. Calculate Grand Total
    let grandTotal = (totalMonthly * months) + totalSetup;
    let appliedMinimum = false;

    // 6. Minimum Order Logic ($300)
    if (grandTotal > 0 && grandTotal < 300) {
      grandTotal = 300;
      appliedMinimum = true;
    }

    // Equipment breakdown for rental order delivery
    const panelsCount = Math.ceil(totalLf / 12);
    const standsCount = panelsCount > 0 ? panelsCount + 1 : 0;
    const clipsCount = panelsCount;

    if (document.getElementById('cartEquipmentBreakdown')) {
      document.getElementById('cartEquipmentBreakdown').innerText = `${panelsCount} Panels | ${standsCount} Stands | ${clipsCount} Clips`;
    }

    if (document.getElementById('cartSetupVal')) document.getElementById('cartSetupVal').innerText = `$${totalSetup.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (document.getElementById('cartMonthlyVal')) document.getElementById('cartMonthlyVal').innerText = `$${totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo`;
    document.getElementById('cartTotalVal').innerText = `$${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const minWarn = document.getElementById('cartMinWarning');
    if (minWarn) minWarn.style.display = appliedMinimum ? 'block' : 'none';
  } else {
    // Outright Purchase ('sale')
    if (document.getElementById('cartSaleBreakdown')) document.getElementById('cartSaleBreakdown').style.display = 'block';
    if (document.getElementById('cartRentalBreakdown')) document.getElementById('cartRentalBreakdown').style.display = 'none';
    if (document.getElementById('rentalMonthsGroup')) document.getElementById('rentalMonthsGroup').style.display = 'none';

    let subtotal = 0;
    cart.forEach(item => {
      const prod = productsData.find(p => p.id === item.productId);
      if (prod) subtotal += prod.salePrice * item.quantity;
    });

    const isTaxable = currentUser && currentUser.isTaxable !== undefined ? currentUser.isTaxable !== false : true;
    const tax = isTaxable ? Math.round(subtotal * 0.08 * 100) / 100 : 0;
    const total = subtotal + delivery + tax;

    document.getElementById('cartSubtotalVal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartDeliveryFeeVal').innerText = `$${delivery.toFixed(2)}`;
    document.getElementById('cartTaxVal').innerText = `$${tax.toFixed(2)}${isTaxable ? '' : ' (Tax Exempt)'}`;
    document.getElementById('cartTotalVal').innerText = `$${total.toFixed(2)}`;
  }

  // Populate saved jobsites dropdown if customer is logged in
  const savedGroup = document.getElementById('savedJobsitesGroup');
  const jobsiteSelect = document.getElementById('checkoutJobsiteSelect');

  if (currentUser && currentUser.jobsites && currentUser.jobsites.length > 0 && savedGroup && jobsiteSelect) {
    savedGroup.style.display = 'block';
    if (jobsiteSelect.children.length <= 1) {
      jobsiteSelect.innerHTML = `<option value="">➕ Enter / Create New Jobsite...</option>` +
        currentUser.jobsites.map(j => `<option value="${j.id}">${j.name} (${j.address})</option>`).join('');
    }
  } else if (savedGroup) {
    savedGroup.style.display = 'none';
  }
}

function onJobsiteSelectChange() {
  const select = document.getElementById('checkoutJobsiteSelect');
  if (!select || !currentUser || !currentUser.jobsites) return;

  const siteId = select.value;
  if (!siteId) return;

  const site = currentUser.jobsites.find(j => j.id === siteId);
  if (site) {
    if (document.getElementById('checkoutJobsiteName')) document.getElementById('checkoutJobsiteName').value = site.name || '';
    if (document.getElementById('checkoutAddress')) document.getElementById('checkoutAddress').value = site.address || '';
    if (document.getElementById('checkoutDistance')) document.getElementById('checkoutDistance').value = site.deliveryDistanceMiles || 15;
    if (document.getElementById('checkoutContact')) document.getElementById('checkoutContact').value = site.contactName ? `${site.contactName} (${site.contactPhone || ''})` : '';
    if (document.getElementById('checkoutInstructions')) document.getElementById('checkoutInstructions').value = site.specialInstructions || '';
    renderCartModal();
  }
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
  if (cart.length === 0 && !isQuoteMode) {
    alert('Your cart is empty.');
    return;
  }

  const agreeCheckbox = document.getElementById('checkoutAgreeTerms');
  if (agreeCheckbox && !agreeCheckbox.checked) {
    alert('You must read and agree to the Rental Agreement & Terms before placing your order.');
    return;
  }

  if (!authToken) {
    alert('Please sign in or create a customer account to complete your order.');
    closeCartModal();
    switchView('portal-view');
    return;
  }

  const orderType = document.getElementById('cartOrderType').value;
  const jobsiteName = document.getElementById('checkoutJobsiteName')?.value || '';
  const deliveryAddress = document.getElementById('checkoutAddress').value;
  const deliveryDistance = document.getElementById('checkoutDistance').value;
  const jobsiteContact = document.getElementById('checkoutContact').value;
  const specialInstructions = document.getElementById('checkoutInstructions')?.value || '';
  const startDate = document.getElementById('checkoutStartDate').value;

  const payload = {
    orderType,
    jobsiteName,
    deliveryAddress,
    deliveryDistance,
    jobsiteContact,
    specialInstructions,
    startDate
  };

  if (isQuoteMode && quoteData) {
    payload.isCustomQuote = true;
    payload.quoteData = quoteData;
    payload.items = []; // Backend will populate this based on quoteData
  } else {
    payload.items = cart;
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert(`🎉 Order ${data.order.id} submitted successfully! Your invoice and delivery dispatch have been created.`);
      cart = [];
      isQuoteMode = false;
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
  const adminNav = document.getElementById('adminNavLi');

  if (currentUser) {
    authStatus.innerText = `Logged in as ${currentUser.name} (${currentUser.role.toUpperCase()})`;
    authStatus.style.color = 'var(--success)';

    // Show admin navigation if user is admin
    if (currentUser.role === 'admin') {
      if (adminNav) adminNav.style.display = 'block';
    } else {
      if (adminNav) adminNav.style.display = 'none';
    }
  } else {
    authStatus.innerText = 'Not Signed In';
    authStatus.style.color = 'var(--accent)';
    if (adminNav) adminNav.style.display = 'none';
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
  if (!authToken || !currentUser || currentUser.role !== 'admin') {
    alert('Admin authentication required.');
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

    // Load All Admin Tables
    loadAdminRentalsTable();
    loadAdminSalesTable();
    loadAdminShipmentsTable();
    loadAdminProductsTable();
    loadAdminInvoicesTable();
    loadAdminCustomersTable();

  } catch (e) {
    console.error('Error loading admin dashboard', e);
  }
}

function switchAdminSubTab(subTab) {
  document.getElementById('adminSubTabRentals').style.display = subTab === 'rentals' ? 'block' : 'none';
  document.getElementById('adminSubTabSales').style.display = subTab === 'sales' ? 'block' : 'none';
  document.getElementById('adminSubTabShipments').style.display = subTab === 'shipments' ? 'block' : 'none';
  document.getElementById('adminSubTabProducts').style.display = subTab === 'products' ? 'block' : 'none';
  document.getElementById('adminSubTabInvoices').style.display = subTab === 'invoices' ? 'block' : 'none';
  document.getElementById('adminSubTabCustomers').style.display = subTab === 'customers' ? 'block' : 'none';

  document.getElementById('adminTab1').classList.toggle('active', subTab === 'rentals');
  document.getElementById('adminTab2').classList.toggle('active', subTab === 'sales');
  document.getElementById('adminTab3').classList.toggle('active', subTab === 'shipments');
  document.getElementById('adminTab4').classList.toggle('active', subTab === 'products');
  document.getElementById('adminTab5').classList.toggle('active', subTab === 'invoices');
  document.getElementById('adminTab6').classList.toggle('active', subTab === 'customers');
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

let adminShipmentsData = [];

async function loadAdminShipmentsTable() {
  const res = await fetch(`${API_BASE}/api/admin/shipments`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (res.ok) {
    adminShipmentsData = await res.json();
    const tbody = document.getElementById('adminShipmentsTableBody');
    if (!tbody) return;

    tbody.innerHTML = adminShipmentsData.map(s => `
      <tr>
        <td><input type="checkbox" class="shipment-check" value="${s.id}"></td>
        <td><strong>${s.id}</strong></td>
        <td><span style="color:var(--accent); font-weight:bold;">${s.type}</span></td>
        <td>${s.orderId}</td>
        <td>${s.driverName || 'Unassigned'}</td>
        <td>${s.dispatchDate}</td>
        <td>
          ${s.destination}<br>
          <a href="javascript:void(0)" onclick="openShipmentMapModal('${encodeURIComponent(s.destination)}', '${s.id}')" style="color: var(--accent); font-size: 0.8rem; font-weight: bold; text-decoration: none;">📍 View Google Map</a>
        </td>
        <td><span class="status-badge status-${s.status.toLowerCase().replace(/\s+/g, '')}">${s.status}</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="openShipmentMapModal('${encodeURIComponent(s.destination)}', '${s.id}')">🗺️ Map</button>
            <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="updateShipmentPrompt('${s.id}')">✏️ Edit</button>
            <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: var(--warning); color: #fff;" onclick="deleteShipmentRecord('${s.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

function openShipmentMapModal(encodedDestination, shipmentId = '') {
  const destination = decodeURIComponent(encodedDestination);
  const modal = document.getElementById('shipmentMapModal');
  const addressText = document.getElementById('shipmentMapAddressText');
  const iframe = document.getElementById('shipmentMapIframe');
  const externalLink = document.getElementById('googleMapsExternalLink');

  if (addressText) {
    addressText.innerHTML = `📍 Delivery Destination ${shipmentId ? '(' + shipmentId + ')' : ''}: <span style="color: #fff;">${destination}</span>`;
  }

  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&output=embed`;
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;

  if (iframe) iframe.src = mapUrl;
  if (externalLink) externalLink.href = externalUrl;

  modal.classList.add('active');
}

function closeShipmentMapModal() {
  const modal = document.getElementById('shipmentMapModal');
  const iframe = document.getElementById('shipmentMapIframe');
  if (iframe) iframe.src = '';
  modal.classList.remove('active');
}

async function updateShipmentPrompt(shipmentId) {
  const s = adminShipmentsData.find(item => item.id === shipmentId);
  if (!s) return;

  const driver = prompt('Assign Driver / Fleet Truck:', s.driverName || 'Truck 1 - Mike');
  if (driver === null) return;

  const status = prompt('Update Dispatch Status (Scheduled, In Route, Delivered, Returned):', s.status || 'Scheduled');
  if (status === null) return;

  const notes = prompt('Update Delivery / Access Notes:', s.notes || '');

  try {
    const res = await fetch(`${API_BASE}/api/admin/shipments/${shipmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ driverName: driver, status, notes })
    });

    if (res.ok) {
      alert('Shipment record updated!');
      loadAdminShipmentsTable();
    } else {
      alert('Failed to update shipment.');
    }
  } catch (e) {
    alert('Error updating shipment.');
  }
}

async function deleteShipmentRecord(shipmentId) {
  if (!confirm('Are you sure you want to PERMANENTLY delete this shipment record?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/shipments/${shipmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      alert('Shipment record deleted.');
      loadAdminShipmentsTable();
    } else {
      alert('Failed to delete shipment.');
    }
  } catch (e) {
    alert('Error deleting shipment record.');
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
      <img src="${gateProd.image.startsWith('/') ? API_BASE + gateProd.image : gateProd.image}" style="height: 120px; opacity: 0.8;">
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

// --- ADMIN PRODUCT MANAGEMENT FUNCTIONS ---

async function loadAdminProductsTable() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      const products = await res.json();
      const tbody = document.getElementById('adminProductsTableBody');
      if (!tbody) return;

      tbody.innerHTML = products.map(p => `
        <tr>
          <td><img src="${p.image.startsWith('/') ? API_BASE + p.image : p.image}" style="width: 40px; height: 40px; object-fit: contain;"></td>
          <td>
            <strong>${p.name}</strong><br>
            <small style="color: var(--text-muted);">${p.id}</small>
          </td>
          <td>${p.type.toUpperCase()}</td>
          <td>${p.inStock} units</td>
          <td>
            Buy: $${p.salePrice.toFixed(2)}<br>
            Rent: $${p.rentalPriceMonthly.toFixed(2)}
          </td>
          <td>
            <span class="status-badge ${p.suspended ? 'status-returned' : 'status-active'}">
              ${p.suspended ? 'SUSPENDED' : 'ACTIVE'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="openProductModal('${p.id}')">Edit</button>
              <button class="btn ${p.suspended ? 'btn-primary' : 'btn-outline'}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="toggleProductSuspension('${p.id}', ${p.suspended})">
                ${p.suspended ? 'Activate' : 'Suspend'}
              </button>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: var(--warning); color: #fff;" onclick="deleteProduct('${p.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error('Error loading admin products', e);
  }
}

function openProductModal(productId = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');
  const idInput = document.getElementById('editProductId');

  // Clear fields
  document.getElementById('prodName').value = '';
  document.getElementById('prodType').value = 'panel';
  document.getElementById('prodStock').value = '0';
  document.getElementById('prodSalePrice').value = '0';
  document.getElementById('prodRentalPrice').value = '0';
  document.getElementById('prodDesc').value = '';
  document.getElementById('prodImageUrl').value = '/assets/panel.png';
  document.getElementById('prodImagePreview').innerHTML = `<img src="/assets/panel.png" style="max-width: 100%; max-height: 100%;">`;

  if (productId) {
    title.innerText = 'Edit Product';
    idInput.value = productId;
    const p = productsData.find(item => item.id === productId);
    if (p) {
      document.getElementById('prodName').value = p.name;
      document.getElementById('prodType').value = p.type;
      document.getElementById('prodStock').value = p.inStock;
      document.getElementById('prodSalePrice').value = p.salePrice;
      document.getElementById('prodRentalPrice').value = p.rentalPriceMonthly;
      document.getElementById('prodDesc').value = p.description;
      document.getElementById('prodImageUrl').value = p.image;
      const fullImgUrl = p.image.startsWith('/') ? API_BASE + p.image : p.image;
      document.getElementById('prodImagePreview').innerHTML = `<img src="${fullImgUrl}" style="max-width: 100%; max-height: 100%;">`;
    }
  } else {
    title.innerText = 'Add New Product';
    idInput.value = '';
  }

  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
}

async function previewProductImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('prodImagePreview').innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%;">`;
  };
  reader.readAsDataURL(file);
}

async function saveProduct() {
  const productId = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value;
  const type = document.getElementById('prodType').value;
  const inStock = parseInt(document.getElementById('prodStock').value) || 0;
  const salePrice = parseFloat(document.getElementById('prodSalePrice').value) || 0;
  const rentalPriceMonthly = parseFloat(document.getElementById('prodRentalPrice').value) || 0;
  const description = document.getElementById('prodDesc').value;
  let image = document.getElementById('prodImageUrl').value;

  if (!name) {
    alert('Please enter a product name.');
    return;
  }

  try {
    // Handle Image Upload if a file was selected
    const fileInput = document.getElementById('prodImageFile');
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);

      const uploadRes = await fetch(`${API_BASE}/api/admin/products/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        image = uploadData.imageUrl;
      } else {
        alert('Image upload failed, but saving product with default image.');
      }
    }

    const productData = {
      name, type, inStock, salePrice, rentalPriceMonthly, description, image,
      category: 'sales'
    };

    const method = productId ? 'PUT' : 'POST';
    const url = productId ? `${API_BASE}/api/admin/products/${productId}` : `${API_BASE}/api/admin/products`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(productData)
    });

    if (res.ok) {
      alert('Product saved successfully!');
      closeProductModal();
      loadAdminProductsTable();
      fetchProducts(); // Refresh public list too
    } else {
      const data = await res.json();
      alert('Error saving product: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Save product error:', err);
    alert('Network error saving product.');
  }
}

async function toggleProductSuspension(productId, currentStatus) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ suspended: !currentStatus })
    });

    if (res.ok) {
      loadAdminProductsTable();
      fetchProducts();
    }
  } catch (e) {
    console.error('Error toggling suspension', e);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to PERMANENTLY delete this product? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      alert('Product deleted.');
      loadAdminProductsTable();
      fetchProducts();
    }
  } catch (e) {
    console.error('Error deleting product', e);
  }
}

// --- ADMIN INVOICE MANAGEMENT ---

let adminInvoicesData = [];

async function loadAdminInvoicesTable() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/invoices`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      adminInvoicesData = await res.json();
      const tbody = document.getElementById('adminInvoicesTableBody');
      if (!tbody) return;

      tbody.innerHTML = adminInvoicesData.map(inv => `
        <tr>
          <td><strong>${inv.id}</strong></td>
          <td>${inv.orderId || 'N/A'}</td>
          <td>${inv.customerName}</td>
          <td><strong>$${(inv.amount || 0).toFixed(2)}</strong></td>
          <td>${inv.createdAt || 'N/A'}</td>
          <td>
            <span class="status-badge ${inv.status === 'Paid' ? 'status-active' : 'status-pending'}">${inv.status || 'Unpaid'}</span>
            ${inv.paymentMethod ? `<small style="display:block; color:var(--text-muted);">${inv.paymentMethod}</small>` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="viewInvoiceDetailModal('${inv.id}')">👁️ View / Print</button>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="updateInvoicePaymentPrompt('${inv.id}')">💵 Mark Paid</button>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: var(--warning); color: #fff;" onclick="deleteInvoice('${inv.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error('Error loading invoices', e);
  }
}

function viewInvoiceDetailModal(invoiceId) {
  const inv = adminInvoicesData.find(i => i.id === invoiceId);
  if (!inv) return;

  const area = document.getElementById('invoicePrintableArea');
  if (!area) return;

  area.innerHTML = `
    <div style="font-family: sans-serif; color: #0f172a; line-height: 1.5;">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h2 style="margin: 0; color: #1e3a8a; font-size: 1.5rem;">SECURE-A-FENCE INC.</h2>
          <div style="font-size: 0.85rem; color: #475569;">123 Perimeter Way, Sacramento, CA 95814</div>
          <div style="font-size: 0.85rem; color: #475569;">📞 Phone: 916-573-9543 | 📧 Email: sales@secureafence.com</div>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; color: #2563eb;">INVOICE</h3>
          <div style="font-size: 1.1rem; font-weight: bold; margin-top: 0.25rem;">${inv.id}</div>
          <div style="font-size: 0.85rem; color: #475569;">Date: ${inv.createdAt || 'N/A'}</div>
          <div style="font-size: 0.85rem; color: #475569;">Order Ref: ${inv.orderId || 'N/A'}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: bold;">BILL TO</div>
          <div style="font-size: 1rem; font-weight: bold; color: #0f172a;">${inv.customerName}</div>
          <div style="font-size: 0.85rem; color: #334155;">${inv.customerCompany || 'Direct Client'}</div>
          <div style="font-size: 0.85rem; color: #334155;">${inv.businessAddress || 'No HQ Address Provided'}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: bold;">PAYMENT STATUS</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: ${inv.status === 'Paid' ? '#16a34a' : '#d97706'};">${(inv.status || 'UNPAID').toUpperCase()}</div>
          <div style="font-size: 0.85rem; color: #334155;">Method: ${inv.paymentMethod || 'None / Pending'}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem;">
        <thead>
          <tr style="background: #e2e8f0; text-align: left; font-weight: bold; color: #334155;">
            <th style="padding: 0.6rem; border: 1px solid #cbd5e1;">Description</th>
            <th style="padding: 0.6rem; border: 1px solid #cbd5e1; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 0.6rem; border: 1px solid #cbd5e1;">Invoice Billing for Order #${inv.orderId || 'Direct'}</td>
            <td style="padding: 0.6rem; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">$${(inv.amount || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 1.5rem;">
        <div style="width: 250px; font-size: 0.9rem;">
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 2px solid #0f172a; font-weight: bold; font-size: 1.1rem;">
            <span>Total Amount:</span>
            <span>$${(inv.amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style="text-align: center; font-size: 0.8rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
        Thank you for choosing Secure-A-Fence Inc. | For billing inquiries call 916-573-9543
      </div>
    </div>
  `;

  document.getElementById('invoiceDetailModal').classList.add('active');
}

function closeInvoiceDetailModal() {
  document.getElementById('invoiceDetailModal').classList.remove('active');
}

function printInvoiceDocument() {
  const content = document.getElementById('invoicePrintableArea').innerHTML;
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Invoice - Secure-A-Fence</title>
        <style>body { font-family: sans-serif; padding: 2rem; }</style>
      </head>
      <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

async function updateInvoicePaymentPrompt(invoiceId) {
  const method = prompt('Enter payment method (e.g. Credit Card, ACH Wire, Cash, Check, Net 30):', 'Credit Card');
  if (!method) return;

  const status = prompt('Enter payment status (Paid, Unpaid, Partial):', 'Paid');
  if (!status) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/invoices/${invoiceId}/payment`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status, paymentMethod: method })
    });

    if (res.ok) {
      alert('Invoice payment status updated successfully!');
      loadAdminInvoicesTable();
    } else {
      alert('Failed to update invoice payment.');
    }
  } catch (e) {
    alert('Error updating invoice payment.');
  }
}

async function deleteInvoice(invoiceId) {
  if (!confirm('Are you sure you want to PERMANENTLY delete this invoice? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      alert('Invoice deleted.');
      loadAdminInvoicesTable();
    } else {
      alert('Failed to delete invoice.');
    }
  } catch (e) {
    alert('Error deleting invoice.');
  }
}

function openInvoiceModal() {
  document.getElementById('invOrderId').value = '';
  document.getElementById('invCustName').value = '';
  document.getElementById('invAmount').value = '';
  document.getElementById('invStatus').value = 'Unpaid';
  document.getElementById('invoiceModal').classList.add('active');
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.remove('active');
}

async function saveInvoice() {
  const orderId = document.getElementById('invOrderId').value;
  const customerName = document.getElementById('invCustName').value;
  const amount = parseFloat(document.getElementById('invAmount').value);
  const status = document.getElementById('invStatus').value;

  if (!orderId || !customerName || isNaN(amount)) {
    alert('Please fill in all required fields.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ orderId, customerName, amount, status })
    });

    if (res.ok) {
      alert('Invoice generated successfully!');
      closeInvoiceModal();
      loadAdminInvoicesTable();
    }
  } catch (e) {
    alert('Error saving invoice.');
  }
}

// --- ADMIN CUSTOMER MANAGEMENT ---

let adminCustomersData = [];

async function loadAdminCustomersTable() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/customers`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      adminCustomersData = await res.json();
      const tbody = document.getElementById('adminCustomersTableBody');
      if (!tbody) return;

      tbody.innerHTML = adminCustomersData.map(c => {
        const jobsCount = c.jobsites ? c.jobsites.length : 0;
        const taxStatus = c.isTaxable !== false ? '<span style="color:#34d399;">Taxable (8%)</span>' : '<span style="color:#fbbf24;">Tax Exempt</span>';

        return `
          <tr>
            <td>
              <strong>${c.name}</strong><br>
              <small style="color: var(--text-muted);">${c.businessAddress || 'No HQ Address'}</small>
            </td>
            <td>${c.email}</td>
            <td>${c.company || 'N/A'}</td>
            <td>${c.phone || 'N/A'}</td>
            <td>
              <span class="status-badge status-delivered">${c.role ? c.role.toUpperCase() : 'CUSTOMER'}</span><br>
              <small>${taxStatus}</small>
            </td>
            <td>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="openJobsitesManageModal('${c.id}')">🏗️ Jobsites (${jobsCount})</button>
                <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="openCustomerModal('${c.id}')">Edit</button>
                <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: var(--warning); color: #fff;" onclick="deleteCustomer('${c.id}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    console.error('Error loading customers', e);
  }
}

function openCustomerModal(customerId = null) {
  const modal = document.getElementById('customerModal');
  const title = document.getElementById('customerModalTitle');
  const idInput = document.getElementById('editCustomerId');

  document.getElementById('newCustName').value = '';
  document.getElementById('newCustEmail').value = '';
  document.getElementById('newCustCompany').value = '';
  document.getElementById('newCustPhone').value = '';
  document.getElementById('newCustBusinessAddress').value = '';
  document.getElementById('newCustIsTaxable').checked = true;
  document.getElementById('newCustRole').value = 'customer';

  if (customerId) {
    if (title) title.innerText = 'Edit Customer';
    if (idInput) idInput.value = customerId;
    const c = adminCustomersData.find(item => item.id === customerId);
    if (c) {
      document.getElementById('newCustName').value = c.name || '';
      document.getElementById('newCustEmail').value = c.email || '';
      document.getElementById('newCustCompany').value = c.company || '';
      document.getElementById('newCustPhone').value = c.phone || '';
      document.getElementById('newCustBusinessAddress').value = c.businessAddress || '';
      document.getElementById('newCustIsTaxable').checked = c.isTaxable !== false;
      document.getElementById('newCustRole').value = c.role || 'customer';
    }
  } else {
    if (title) title.innerText = 'Add New Customer';
    if (idInput) idInput.value = '';
  }

  modal.classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('active');
}

async function saveCustomer() {
  const customerId = document.getElementById('editCustomerId')?.value;
  const name = document.getElementById('newCustName').value;
  const email = document.getElementById('newCustEmail').value;
  const company = document.getElementById('newCustCompany').value;
  const phone = document.getElementById('newCustPhone').value;
  const businessAddress = document.getElementById('newCustBusinessAddress').value;
  const isTaxable = document.getElementById('newCustIsTaxable').checked;
  const role = document.getElementById('newCustRole').value;

  if (!name || !email) {
    alert('Name and Email are required.');
    return;
  }

  try {
    const method = customerId ? 'PUT' : 'POST';
    const url = customerId ? `${API_BASE}/api/admin/customers/${customerId}` : `${API_BASE}/api/admin/customers`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ name, email, company, phone, businessAddress, isTaxable, role })
    });

    if (res.ok) {
      alert(`Customer record ${customerId ? 'updated' : 'created'} successfully!`);
      closeCustomerModal();
      loadAdminCustomersTable();
    } else {
      const data = await res.json();
      alert('Error: ' + (data.error || 'Operation failed'));
    }
  } catch (e) {
    alert('Error saving customer record.');
  }
}

// --- CUSTOMER JOBSITE MANAGEMENT FUNCTIONS ---

function openJobsitesManageModal(customerId) {
  const modal = document.getElementById('jobsitesManageModal');
  document.getElementById('targetJobsitesCustomerId').value = customerId;

  const c = adminCustomersData.find(item => item.id === customerId);
  if (c && document.getElementById('jobsitesManageTitle')) {
    document.getElementById('jobsitesManageTitle').innerText = `${c.name}'s Jobsites (${c.company || 'Direct Client'})`;
  }

  renderJobsitesList(customerId);
  modal.classList.add('active');
}

function closeJobsitesManageModal() {
  document.getElementById('jobsitesManageModal').classList.remove('active');
}

function renderJobsitesList(customerId) {
  const container = document.getElementById('jobsitesListContainer');
  if (!container) return;

  const c = adminCustomersData.find(item => item.id === customerId);
  if (!c || !c.jobsites || c.jobsites.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No jobsites added for this customer yet. Click "Add Jobsite" to create one.</p>`;
    return;
  }

  container.innerHTML = c.jobsites.map(j => {
    const activeRentals = j.activeRentals || [];
    const activeRentalsHtml = activeRentals.length > 0
      ? activeRentals.map(r => `<li style="margin-bottom: 0.25rem;"><strong>Rental #${r.id}</strong>: ${r.items.map(i => `${i.quantity}x ${i.name}`).join(', ')} (${r.startDate} to ${r.endDate})</li>`).join('')
      : '<li style="color: var(--text-muted);">No active rentals currently deployed at this site.</li>';

    return `
      <div style="background: var(--bg-dark); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <h4 style="color: #fff; margin: 0;">${j.name}</h4>
            <div style="color: var(--primary); font-size: 0.9rem; font-weight: 600;">📍 ${j.address}</div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openJobsiteEditModal('${j.id}')">Edit</button>
            <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--warning); color: #fff;" onclick="deleteJobsite('${j.id}')">Delete</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          <div>👤 Contact: <strong style="color: #fff;">${j.contactName || 'N/A'}</strong> (${j.contactPhone || 'N/A'})</div>
          <div>🚚 Distance: <strong style="color: #fff;">${j.deliveryDistanceMiles || 0} Miles</strong> from yard</div>
        </div>

        ${j.specialInstructions ? `
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--accent); padding: 0.5rem 0.75rem; border-radius: 0.4rem; font-size: 0.85rem; color: #fff; margin-bottom: 0.75rem;">
            <strong>📝 Delivery Instructions:</strong> ${j.specialInstructions}
          </div>
        ` : ''}

        <div style="background: var(--bg-card); border: 1px dashed var(--border); padding: 0.75rem; border-radius: 0.5rem;">
          <div style="font-weight: bold; font-size: 0.85rem; color: var(--accent); margin-bottom: 0.25rem;">📦 Deployed Active Rentals (${activeRentals.length}):</div>
          <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.85rem;">
            ${activeRentalsHtml}
          </ul>
        </div>
      </div>
    `;
  }).join('');
}

function openJobsiteEditModal(jobsiteId = null) {
  const modal = document.getElementById('jobsiteEditModal');
  const title = document.getElementById('jobsiteEditTitle');
  const idInput = document.getElementById('editJobsiteId');
  const customerId = document.getElementById('targetJobsitesCustomerId').value;

  document.getElementById('siteName').value = '';
  document.getElementById('siteAddress').value = '';
  document.getElementById('siteContactName').value = '';
  document.getElementById('siteContactPhone').value = '';
  document.getElementById('siteInstructions').value = '';
  document.getElementById('siteDistance').value = '15';

  if (jobsiteId) {
    if (title) title.innerText = 'Edit Jobsite';
    if (idInput) idInput.value = jobsiteId;

    const c = adminCustomersData.find(item => item.id === customerId);
    if (c && c.jobsites) {
      const j = c.jobsites.find(site => site.id === jobsiteId);
      if (j) {
        document.getElementById('siteName').value = j.name || '';
        document.getElementById('siteAddress').value = j.address || '';
        document.getElementById('siteContactName').value = j.contactName || '';
        document.getElementById('siteContactPhone').value = j.contactPhone || '';
        document.getElementById('siteInstructions').value = j.specialInstructions || '';
        document.getElementById('siteDistance').value = j.deliveryDistanceMiles || '15';
      }
    }
  } else {
    if (title) title.innerText = 'Add New Jobsite';
    if (idInput) idInput.value = '';
  }

  modal.classList.add('active');
}

function closeJobsiteEditModal() {
  document.getElementById('jobsiteEditModal').classList.remove('active');
}

async function saveJobsite() {
  const customerId = document.getElementById('targetJobsitesCustomerId').value;
  const jobsiteId = document.getElementById('editJobsiteId')?.value;

  const name = document.getElementById('siteName').value;
  const address = document.getElementById('siteAddress').value;
  const contactName = document.getElementById('siteContactName').value;
  const contactPhone = document.getElementById('siteContactPhone').value;
  const specialInstructions = document.getElementById('siteInstructions').value;
  const deliveryDistanceMiles = parseFloat(document.getElementById('siteDistance').value) || 0;

  if (!name || !address) {
    alert('Jobsite Name and Address are required.');
    return;
  }

  try {
    const method = jobsiteId ? 'PUT' : 'POST';
    const url = jobsiteId ? `${API_BASE}/api/admin/customers/${customerId}/jobsites/${jobsiteId}` : `${API_BASE}/api/admin/customers/${customerId}/jobsites`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ name, address, contactName, contactPhone, specialInstructions, deliveryDistanceMiles })
    });

    if (res.ok) {
      alert(`Jobsite ${jobsiteId ? 'updated' : 'added'} successfully!`);
      closeJobsiteEditModal();
      await loadAdminCustomersTable();
      renderJobsitesList(customerId);
    } else {
      const data = await res.json();
      alert('Error saving jobsite: ' + (data.error || 'Operation failed'));
    }
  } catch (e) {
    alert('Error saving jobsite record.');
  }
}

async function deleteJobsite(jobsiteId) {
  const customerId = document.getElementById('targetJobsitesCustomerId').value;
  if (!confirm('Are you sure you want to remove this jobsite?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/customers/${customerId}/jobsites/${jobsiteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      alert('Jobsite removed.');
      await loadAdminCustomersTable();
      renderJobsitesList(customerId);
    } else {
      const data = await res.json();
      alert('Error: ' + (data.error || 'Failed'));
    }
  } catch (e) {
    alert('Error removing jobsite.');
  }
}

async function deleteCustomer(customerId) {
  if (!confirm('Are you sure you want to PERMANENTLY delete this customer? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/customers/${customerId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      alert('Customer deleted successfully.');
      loadAdminCustomersTable();
    } else {
      const data = await res.json();
      alert('Error deleting customer: ' + (data.error || 'Failed'));
    }
  } catch (e) {
    alert('Error deleting customer.');
  }
}
