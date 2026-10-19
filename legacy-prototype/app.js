const WHATSAPP_NUMBER = "573124193753";
const STORAGE_KEY = "cafe-dona-tere-cart-v1";

const products = [
  {
    id: "lena",
    category: "wood",
    title: "Tostado a la leña",
    subtitle: "Tradición · tostión media-alta",
    description: "Chocolate oscuro, cacao, frutos secos y un toque cítrico suave, con final ahumado. Cuerpo medio-alto.",
    badge: "El favorito de casa",
    image: "classic-500-ground.jpg",
    photo: "beans.jpg",
    process: "Tostión a la leña",
    altitude: "1.450–1.650 m s. n. m.",
    notes: ["Cacao", "Frutos secos", "Final ahumado"],
    sizes: [
      { id: "250", label: "250 g", price: null, image: "classic-250.jpg", grinds: ["Molido"] },
      { id: "500", label: "500 g · Libra", price: 40000, image: "classic-500-ground.jpg", grinds: ["Molido", "En grano"] },
    ],
  },
  {
    id: "precision",
    category: "precision",
    title: "Tostión de precisión",
    subtitle: "Tostión media · taza cítrica",
    description: "Notas cítricas de naranja y mandarina, panela suave, almendra y chocolate con leche.",
    badge: "Perfil de taza",
    image: "precision-500.jpg",
    photo: "roasting.jpg",
    process: "Tostión media",
    altitude: "Finca La Libertad",
    notes: ["Naranja", "Panela", "Almendra"],
    sizes: [
      { id: "500", label: "500 g", price: null, image: "precision-500.jpg", grinds: ["Molido"] },
    ],
  },
  {
    id: "honey",
    category: "honey",
    title: "Microlote Honey",
    subtitle: "Edición especial · microlote",
    description: "Café excelso Honey de Finca La Libertad, con cuerpo medio-alto y acidez media. Un lote pequeño para descubrir otro perfil.",
    badge: "Edición limitada",
    image: "beans-closeup.jpg",
    photo: "beans-closeup.jpg",
    process: "Honey · microlote",
    altitude: "Finca La Libertad",
    notes: ["Cuerpo medio-alto", "Acidez media", "Lote pequeño"],
    sizes: [
      { id: "340", label: "340 g · referencia", price: 35000, image: "beans-closeup.jpg", grinds: ["Molido"] },
    ],
  },
];

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const choiceByProduct = new Map();
let activeFilter = "all";
let checkoutOpen = false;
let returnFocus = null;
let toastTimeout;

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.key === "string" && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

let cart = readCart();

function persistCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // The cart remains usable for the current visit when browser storage is unavailable.
  }
}

function getProduct(id) {
  return products.find((product) => product.id === id);
}

function getSize(product, sizeId) {
  return product?.sizes.find((size) => size.id === sizeId);
}

function getChoice(product) {
  const remembered = choiceByProduct.get(product.id);
  const size = getSize(product, remembered?.sizeId) || product.sizes[0];
  const grind = size.grinds.includes(remembered?.grind) ? remembered.grind : size.grinds[0];
  const choice = { sizeId: size.id, grind };
  choiceByProduct.set(product.id, choice);
  return { ...choice, size };
}

function priceText(price) {
  return price == null ? "Precio por confirmar" : money.format(price);
}

function productImage(product, size, grind) {
  if (product.id === "lena" && size.id === "500" && grind === "En grano") return "classic-500-beans.jpg";
  return size.image || product.image;
}

function renderProductCard(product) {
  const choice = getChoice(product);
  const currentImage = productImage(product, choice.size, choice.grind);
  const sizeButtons = product.sizes.length > 1
    ? `<fieldset class="variant-control"><legend>Presentación</legend><div class="variant-buttons">${product.sizes.map((size) => `<button class="variant-button ${size.id === choice.sizeId ? "is-selected" : ""}" type="button" data-size-choice="${size.id}" data-product-choice="${product.id}" aria-pressed="${size.id === choice.sizeId}">${size.label}</button>`).join("")}</div></fieldset>`
    : `<div class="variant-single"><span>Presentación</span><strong>${choice.size.label}</strong></div>`;
  const grindControl = choice.size.grinds.length > 1
    ? `<label class="grind-control"><span>Molienda</span><select data-grind-choice="${product.id}" aria-label="Selecciona la molienda para ${product.title}">${choice.size.grinds.map((grind) => `<option ${grind === choice.grind ? "selected" : ""}>${grind}</option>`).join("")}</select></label>`
    : `<div class="grind-control grind-control--fixed"><span>Preparación</span><strong>${choice.grind}</strong></div>`;
  const displayImage = currentImage || product.image;
  const packMarkup = product.id === "honey"
    ? `<div class="product-card__pack product-card__pack--concept" aria-hidden="true"><span>CAFÉ DOÑA TERE</span><b>HONEY</b><small>MICROLOTE · CACHIPAY</small><i>✳</i></div>`
    : `<div class="product-card__pack" aria-hidden="true"><img src="assets/${displayImage}" alt="" loading="lazy" /></div>`;

  return `<article class="product-card product-card--${product.id}" data-category="${product.category}" data-product-id="${product.id}">
    <div class="product-card__visual">
      <img class="product-card__photo" src="assets/${product.photo}" alt="${product.title}, café de Finca La Libertad" loading="lazy" />
      <span class="product-card__badge"><i aria-hidden="true">✳</i> ${product.badge}</span>
      ${packMarkup}
      <span class="product-card__visual-index">${product.process}</span>
    </div>
    <div class="product-card__body">
      <div class="product-card__title-row"><div><p class="product-card__subtitle">${product.subtitle}</p><h3>${product.title}</h3></div><span class="product-card__asterisk" aria-hidden="true">✳</span></div>
      <p class="product-card__description">${product.description}</p>
      <div class="product-card__notes" aria-label="Perfil del café">${product.notes.map((note) => `<span>${note}</span>`).join("")}</div>
      <dl class="product-card__specs"><div><dt>Proceso / tueste</dt><dd>${product.process}</dd></div><div><dt>Origen</dt><dd>${product.altitude}</dd></div></dl>
      <div class="product-card__controls">${sizeButtons}${grindControl}</div>
      <div class="product-card__purchase"><div class="product-card__price"><strong>${priceText(choice.size.price)}</strong><small>${choice.size.price == null ? "Precio y envío por confirmar" : "COP · referencia; envío aparte"}</small></div><button class="add-button" type="button" data-add-to-cart="${product.id}" aria-label="Agregar ${product.title} ${choice.size.label} ${choice.grind}"><span>Agregar a la bolsa</span><b aria-hidden="true">+</b></button></div>
    </div>
  </article>`;
}

function renderProducts() {
  const grid = document.querySelector("[data-product-grid]");
  const shown = activeFilter === "all" ? products : products.filter((product) => product.category === activeFilter);
  grid.innerHTML = shown.map(renderProductCard).join("");
}

function cartEntries() {
  return cart.map((item) => {
    const product = getProduct(item.productId);
    const size = getSize(product, item.sizeId);
    if (!product || !size) return null;
    return { ...item, product, size, lineTotal: size.price == null ? null : size.price * item.quantity };
  }).filter(Boolean);
}

function cartTotals(entries) {
  const subtotal = entries.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const hasPricePending = entries.some((item) => item.lineTotal == null);
  return { subtotal, hasPricePending };
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function cartItemMarkup(item) {
  const itemName = `${item.product.title} · ${item.size.label}`;
  const amount = item.lineTotal == null ? "Precio por confirmar" : money.format(item.lineTotal);
  return `<article class="cart-item">
    <div class="cart-item__image"><img src="assets/${productImage(item.product, item.size, item.grind)}" alt="" /></div>
    <div class="cart-item__details"><div class="cart-item__top"><div><h3>${escapeText(itemName)}</h3><p>${escapeText(item.grind)}</p></div><strong>${amount}</strong></div>
      <div class="quantity-control" aria-label="Cantidad de ${escapeText(itemName)}"><button type="button" data-quantity="-1" data-item-key="${escapeText(item.key)}" aria-label="Quitar una unidad">−</button><span>${item.quantity}</span><button type="button" data-quantity="1" data-item-key="${escapeText(item.key)}" aria-label="Agregar una unidad">+</button><button class="remove-item" type="button" data-remove-item="${escapeText(item.key)}">Quitar</button></div>
    </div>
  </article>`;
}

function checkoutFormMarkup() {
  return `<form class="checkout-form" data-checkout-form>
    <div class="checkout-form__heading"><p class="eyebrow"><span class="eyebrow__line"></span> Un último pasito</p><h3>¿A dónde llevamos tu café?</h3><p>Confirmaremos envío y cualquier precio pendiente contigo antes de cobrar.</p></div>
    <div class="form-grid">
      <label class="form-field form-field--full"><span>Nombre completo</span><input name="name" autocomplete="name" required placeholder="Tu nombre" /></label>
      <label class="form-field"><span>Celular</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required pattern="[0-9 +()-]{7,20}" placeholder="300 000 0000" /></label>
      <label class="form-field"><span>Ciudad o municipio</span><input name="city" autocomplete="address-level2" required placeholder="Ej. Bogotá" /></label>
      <label class="form-field form-field--full"><span>Dirección de entrega</span><input name="address" autocomplete="street-address" required placeholder="Calle, carrera y número" /></label>
      <label class="form-field form-field--full"><span>Indicaciones <small>(opcional)</small></span><textarea name="notes" rows="2" placeholder="Apartamento, barrio o referencia"></textarea></label>
    </div>
    <fieldset class="payment-options"><legend>¿Cómo prefieres pagar?</legend>
      <label class="payment-option"><input type="radio" name="payment" value="wompi" checked /><span class="payment-option__copy"><strong>Enlace Wompi</strong><small>Tarjetas, PSE, Nequi o Bancolombia · según medios habilitados</small></span><span class="payment-option__mark" aria-hidden="true">↗</span></label>
      <label class="payment-option"><input type="radio" name="payment" value="transfer" /><span class="payment-option__copy"><strong>Transferencia directa</strong><small>Nequi o transferencia · te compartimos los datos por WhatsApp</small></span><span class="payment-option__mark" aria-hidden="true">↗</span></label>
    </fieldset>
    <label class="consent-field"><input type="checkbox" name="consent" required /><span>Acepto enviar mis datos de entrega por WhatsApp para gestionar este pedido.</span></label>
    <p class="checkout-privacy">No pedimos claves ni datos de tarjeta en este sitio. Tus datos se envían únicamente en el mensaje para coordinar el pedido.</p>
    <button class="button button--dark checkout-submit" type="submit">Continuar por WhatsApp <span aria-hidden="true">↗</span></button>
  </form>`;
}

function renderCart() {
  const entries = cartEntries();
  const count = entries.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = count; });
  document.querySelector("[data-drawer-count]").textContent = `(${count})`;

  const content = document.querySelector("[data-cart-content]");
  const bottom = document.querySelector("[data-cart-bottom]");
  if (!entries.length) {
    content.innerHTML = document.querySelector("#cart-empty-template").innerHTML;
    bottom.innerHTML = "";
    return;
  }

  const { subtotal, hasPricePending } = cartTotals(entries);
  content.innerHTML = `<div class="cart-items">${entries.map(cartItemMarkup).join("")}</div>${checkoutOpen ? checkoutFormMarkup() : ""}`;
  bottom.innerHTML = `<div class="cart-summary"><div><span>${hasPricePending ? "Subtotal confirmado" : "Subtotal"}</span><strong>${subtotal ? money.format(subtotal) : "Por confirmar"}</strong></div>${hasPricePending ? `<p>Más el valor de las presentaciones pendientes.</p>` : ""}<div><span>Domicilio</span><strong>Por cotizar</strong></div></div>${checkoutOpen ? "" : `<button class="button button--dark cart-checkout" type="button" data-checkout>Continuar pedido <span aria-hidden="true">↗</span></button><p class="cart-bottom__note">El envío se confirma antes del pago.</p>`}`;
}

function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2500);
}

function openCart() {
  returnFocus = document.activeElement;
  const drawer = document.querySelector("[data-cart-drawer]");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  document.querySelector("[data-cart-overlay]").hidden = false;
  document.body.classList.add("cart-is-open");
  document.querySelector("[data-close-cart]")?.focus();
}

function closeCart() {
  const drawer = document.querySelector("[data-cart-drawer]");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  document.querySelector("[data-cart-overlay]").hidden = true;
  document.body.classList.remove("cart-is-open");
  checkoutOpen = false;
  if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
}

function addToCart(product) {
  const choice = getChoice(product);
  const key = `${product.id}|${choice.size.id}|${choice.grind}`;
  const existing = cart.find((item) => item.key === key);
  if (existing) existing.quantity += 1;
  else cart.push({ key, productId: product.id, sizeId: choice.size.id, grind: choice.grind, quantity: 1 });
  persistCart();
  renderCart();
  showToast(`${product.title} agregado a tu bolsa`);
}

function updateQuantity(key, delta) {
  const entry = cart.find((item) => item.key === key);
  if (!entry) return;
  entry.quantity += delta;
  if (entry.quantity < 1) cart = cart.filter((item) => item.key !== key);
  persistCart();
  renderCart();
}

function orderMessage(formData, entries) {
  const { subtotal, hasPricePending } = cartTotals(entries);
  const selectedPayment = formData.get("payment") === "transfer"
    ? "Transferencia directa (solicito instrucciones por WhatsApp)"
    : "Enlace Wompi (solicito los medios habilitados para el comercio)";
  const lines = [
    "Hola, quiero confirmar este pedido de Café Doña Tere:",
    "",
    ...entries.map((item) => `• ${item.product.title} · ${item.size.label} · ${item.grind} · ${item.quantity} ud. — ${item.lineTotal == null ? "precio por confirmar" : money.format(item.lineTotal)}`),
    "",
    `Subtotal confirmado: ${subtotal ? money.format(subtotal) : "por confirmar"}${hasPricePending ? " + presentaciones por cotizar" : ""}`,
    "Domicilio: por cotizar según la ciudad.",
    `Medio de pago preferido: ${selectedPayment}`,
    "",
    `Nombre: ${formData.get("name")}`,
    `Celular: ${formData.get("phone")}`,
    `Ciudad: ${formData.get("city")}`,
    `Dirección: ${formData.get("address")}`,
    formData.get("notes") ? `Indicaciones: ${formData.get("notes")}` : "",
    "",
    "Por favor confirmen el total y el envío antes de compartir las instrucciones de pago. ¡Gracias!",
  ];
  return lines.filter((line, index) => line || (lines[index - 1] && lines[index - 1] !== "")).join("\n");
}

document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    activeFilter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      const selected = button === filterButton;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
    document.querySelector(`[data-filter="${activeFilter}"]`)?.focus({ preventScroll: true });
  }

  const recommendationButton = event.target.closest("[data-show-product]");
  if (recommendationButton) {
    const recommended = getProduct(recommendationButton.dataset.showProduct);
    if (recommended) {
      activeFilter = recommended.category;
      document.querySelectorAll("[data-filter]").forEach((button) => {
        const selected = button.dataset.filter === activeFilter;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      renderProducts();
      window.setTimeout(() => {
        const card = document.querySelector(`[data-product-id="${recommended.id}"]`);
        card?.scrollIntoView({ behavior: "smooth", block: "center" });
        card?.querySelector("[data-add-to-cart]")?.focus({ preventScroll: true });
      }, 30);
    }
  }

  const sizeButton = event.target.closest("[data-size-choice]");
  if (sizeButton) {
    const product = getProduct(sizeButton.dataset.productChoice);
    const previous = getChoice(product);
    const size = getSize(product, sizeButton.dataset.sizeChoice);
    choiceByProduct.set(product.id, { sizeId: size.id, grind: size.grinds.includes(previous.grind) ? previous.grind : size.grinds[0] });
    renderProducts();
    document.querySelector(`[data-size-choice="${size.id}"][data-product-choice="${product.id}"]`)?.focus({ preventScroll: true });
  }

  const addButton = event.target.closest("[data-add-to-cart]");
  if (addButton) {
    const product = getProduct(addButton.dataset.addToCart);
    if (product) addToCart(product);
  }

  const openButton = event.target.closest("[data-open-cart]");
  if (openButton) openCart();

  if (event.target.closest("[data-close-cart]") || event.target.matches("[data-cart-overlay]")) closeCart();

  const checkoutButton = event.target.closest("[data-checkout]");
  if (checkoutButton) {
    checkoutOpen = true;
    renderCart();
    document.querySelector("[data-cart-content]").scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("[data-checkout-form] input[name=name]")?.focus({ preventScroll: true });
  }

  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) updateQuantity(quantityButton.dataset.itemKey, Number(quantityButton.dataset.quantity));

  const removeButton = event.target.closest("[data-remove-item]");
  if (removeButton) {
    cart = cart.filter((item) => item.key !== removeButton.dataset.removeItem);
    persistCart();
    renderCart();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-grind-choice]")) {
    const product = getProduct(event.target.dataset.grindChoice);
    const choice = getChoice(product);
    choiceByProduct.set(product.id, { ...choice, grind: event.target.value });
    renderProducts();
    document.querySelector(`[data-grind-choice="${product.id}"]`)?.focus({ preventScroll: true });
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.matches("[data-taste-quiz]")) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const flavor = formData.get("flavor");
    const method = formData.get("method");
    const recommendation = flavor === "chocolate" ? getProduct("lena") : flavor === "citrus" ? getProduct("precision") : getProduct("honey");
    const result = document.querySelector("[data-quiz-result]");
    result.hidden = false;
    result.innerHTML = `<span class="quiz-result__label">TU PRIMERA RECOMENDACIÓN</span><strong>${recommendation.title}</strong><p>${recommendation.description} Para preparar en ${escapeText(method.toLowerCase())}; consulta la molienda disponible en esta presentación.</p><a class="text-link" href="#catalogo" data-show-product="${recommendation.id}">Ver este café <span aria-hidden="true">↗</span></a>`;
    return;
  }

  if (!event.target.matches("[data-checkout-form]")) return;
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  const entries = cartEntries();
  if (!entries.length) return;
  const message = orderMessage(new FormData(event.target), entries);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  showToast("Tu pedido está listo para enviar por WhatsApp");
});

document.addEventListener("keydown", (event) => {
  const drawer = document.querySelector("[data-cart-drawer]");
  if (!drawer.classList.contains("is-open")) return;
  if (event.key === "Escape") {
    closeCart();
    return;
  }
  if (event.key === "Tab") {
    const focusable = [...drawer.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});

const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  menuToggle.setAttribute("aria-label", expanded ? "Abrir menú" : "Cerrar menú");
  document.querySelector(".main-nav").classList.toggle("is-open", !expanded);
});

document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menú");
  document.querySelector(".main-nav").classList.remove("is-open");
}));

document.querySelector("[data-year]").textContent = new Date().getFullYear();
renderProducts();
renderCart();
