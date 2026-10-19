import { expect, test, type Locator, type Page } from "@playwright/test";

// Recorrido del sitio estático (modo WhatsApp) tal como queda publicado en
// GitHub Pages. Corre en escritorio y móvil (ver playwright.config.ts).

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.hostname === "127.0.0.1" && response.status() >= 400) errors.push(`${response.status()} ${url.pathname}`);
  });
  return errors;
}

/** Primera ficha con botón para agregar (un café no agotado). */
async function firstAddableCard(page: Page) {
  const card = page.locator(".product-card").filter({ has: page.locator(".add-button:is(button)") }).first();
  await card.scrollIntoViewIfNeeded();
  return card;
}

async function chooseGrind(card: Locator, value?: string) {
  const select = card.locator(".grind-picker select");
  const option = value ?? (await select.locator("option:not([disabled])").first().getAttribute("value"))!;
  await select.selectOption(option);
  return option;
}

test("la portada carga completa, sin errores y sin rutas de servidor", async ({ page }) => {
  const errors = watchErrors(page);
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Café Doña Tere/);
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".hero-actions a").first()).toHaveAttribute("href", "#cafes");

  // La CSP va antes de cualquier script.
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self' 'sha256-");
  expect(csp).not.toContain("unsafe-eval");

  // Todas las imágenes cargan (se fuerza la carga diferida) y tienen alt.
  await page.evaluate(() => document.querySelectorAll("img").forEach((img) => (img.loading = "eager")));
  await page.waitForLoadState("networkidle");
  const broken = await page.locator("img").evaluateAll((images) =>
    images.filter((img) => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0).map((img) => (img as HTMLImageElement).src),
  );
  expect(broken).toEqual([]);
  expect(await page.locator("img:not([alt])").count()).toBe(0);

  // Cada enlace interno del menú apunta a una sección que existe.
  const anchors = await page.locator("#main-nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  for (const href of anchors) expect(await page.locator(href).count(), href).toBe(1);

  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.filter((href) => /\/(api|admin|seguimiento)(\/|$)/.test(href))).toEqual([]);
  expect(hrefs.some((href) => href.startsWith("https://wa.me/"))).toBe(true);
  expect(errors).toEqual([]);
});

test("el modo WhatsApp no promete pagos, seguimiento ni pedidos en línea", async ({ page }) => {
  await page.goto("./");
  const steps = page.getByRole("list", { name: "Cómo pedir" });
  await expect(steps).toBeVisible();
  await expect(steps).toContainText("Esta página no cobra");
  const text = await page.locator("body").innerText();
  for (const promise of [/enlace privado/i, /seguimiento/i, /wompi/i, /contra entrega/i, /paga en línea/i, /pago seguro/i]) {
    expect(text, String(promise)).not.toMatch(promise);
  }
  expect(await page.locator("form[action*='wompi'], form[action*='/api/']").count()).toBe(0);
});

test("solo se muestran precios confirmados (los mismos de los datos estructurados)", async ({ page }) => {
  await page.goto("./");
  // Sin NEXT_PUBLIC_SITE_URL no hay datos estructurados: entonces no puede haber precios visibles.
  const ld = page.locator('script[type="application/ld+json"]');
  const json = (await ld.count()) ? await ld.first().textContent() : null;
  const graph = (JSON.parse(json ?? "{}")["@graph"] ?? []) as { "@type": string; offers?: { sku: string; price: number }[] }[];
  const offers = new Map(graph.flatMap((item) => item.offers ?? []).map((offer) => [offer.sku, offer.price]));

  for (const card of await page.locator(".product-card").all()) {
    const price = (await card.locator(".price-row strong").innerText()).trim();
    const checked = card.locator(".size-option input:checked");
    const sku = (await checked.count()) ? await checked.getAttribute("value") : null;
    if (/\$/.test(price)) {
      // Un precio visible siempre corresponde a una oferta confirmada.
      expect(sku && offers.has(sku), `${price} sin oferta confirmada`).toBeTruthy();
      expect(price.replace(/\D/g, "")).toBe(String(offers.get(sku!)));
    } else {
      expect(price).toBe("Precio por confirmar");
    }
  }
});

test("cada presentación muestra su bolsa con el peso y la molienda correctos", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  for (const card of await page.locator(".product-card").all()) {
    await card.scrollIntoViewIfNeeded();
    const sizes = card.locator(".size-option input");
    const count = Math.max(await sizes.count(), 1);
    for (let i = 0; i < count; i++) {
      if (await sizes.count()) await sizes.nth(i).check({ force: true });
      const label = (await sizes.count())
        ? ((await card.locator(".size-option").nth(i).textContent()) ?? "").trim()
        : ((await card.locator(".size-single b").textContent()) ?? "").trim();
      const weight = label.match(/\d+/)![0];
      const pack = card.locator(".visual-pack.is-shot img");
      await chooseGrind(card);
      await expect(pack).toHaveAttribute("alt", new RegExp(`, ${label}$`));
      expect(await pack.getAttribute("src")).toMatch(new RegExp(`pack-[a-z-]+-${weight}(-ground)?[-.\\d]`));
      if (await card.locator('.grind-picker option[value="En grano"]').count()) {
        await chooseGrind(card, "En grano");
        expect(await pack.getAttribute("src")).toMatch(new RegExp(`pack-[a-z-]+-${weight}-beans`));
      }
    }
  }
  expect(errors).toEqual([]);
});

test("la molienda se elige de forma explícita y se conserva hasta WhatsApp", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  const card = await firstAddableCard(page);
  const select = card.locator(".grind-picker select");
  await expect(select).toHaveValue("");

  // Sin molienda no se agrega nada.
  await card.locator(".add-button").click();
  await expect(card.locator(".grind-hint")).toHaveText("Elige la molienda antes de agregar el café.");
  await expect(select).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".bag-count")).toHaveText("0");

  // Elegir la molienda y cambiar de presentación la conserva si existe en la nueva.
  const hasBeans = await select.locator('option[value="En grano"]').count();
  const grind = await chooseGrind(card, hasBeans ? "En grano" : undefined);
  const sizes = card.locator(".size-option input");
  if ((await sizes.count()) > 1) {
    await sizes.nth(1).check({ force: true });
    const stillValid = await select.locator(`option[value="${grind}"]`).count();
    await expect(select).toHaveValue(stillValid ? grind : "");
    if (!stillValid) await chooseGrind(card);
  }
  const finalGrind = await select.inputValue();
  await card.locator(".add-button").click();
  await expect(page.locator(".bag-count")).toHaveText("1");

  // La bolsa y el mensaje de WhatsApp llevan la molienda elegida.
  await page.locator(".bag-button").click();
  const line = page.locator(".cart-line").first();
  const grindText = finalGrind === "En grano" ? "en grano" : "molienda";
  await expect(line).toContainText(grindText);
  await expect(page.getByRole("button", { name: "Continuar con la entrega" })).toHaveCount(0);
  const send = page.getByRole("link", { name: "Enviar pedido por WhatsApp" });
  const href = (await send.getAttribute("href")) ?? "";
  expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  const message = new URL(href).searchParams.get("text") ?? "";
  expect(message).toMatch(/Quiero hacer este pedido:\n• 1 × .+, \d+ (g|kg), .+: (precio por confirmar|\$\s?[\d.]+)/);
  expect(message).toContain(grindText);
  expect(errors).toEqual([]);
});

test("la finca y cada café muestran variedades, clasificación y altura", async ({ page }) => {
  await page.goto("./");
  const facts = page.locator(".origin-facts");
  await expect(facts).toContainText("Castillo 60% · Caturra 40%");
  await expect(facts).toContainText("Excelso");
  await expect(facts).toContainText("1.450–1.650 m s. n. m.");

  const cards = page.locator(".product-card");
  const total = await cards.count();
  for (let index = 0; index < total; index++) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    await card.locator("h3 button").click();
    const dialog = page.locator(".product-dialog-body");
    await expect(dialog).toContainText("Castillo 60% · Caturra 40%");
    await expect(dialog).toContainText("1.450–1.650 m s. n. m.");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }

  await page.getByText("¿Qué variedades cultivan?").click();
  await expect(page.locator(".faq-answer").filter({ hasText: "Cenicafé" })).toContainText("60% Castillo y 40% Caturra");
});

test("la bolsa vacía orienta y se puede cerrar con teclado", async ({ page }) => {
  await page.goto("./");
  await page.locator(".bag-button").click();
  await expect(page.getByRole("heading", { name: "Tu bolsa está vacía" })).toBeVisible();
  await expect(page.locator(".drawer-empty")).toContainText("WhatsApp");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cart-drawer")).not.toBeVisible();
});

test("el asistente sugiere un café sin elegir la molienda por el comprador", async ({ page }) => {
  await page.goto("./#elegir");
  const finder = page.locator("#elegir");
  test.skip((await finder.count()) === 0, "Con un solo café publicado no hay asistente.");
  await finder.getByRole("radio", { name: /Chocolate y cacao/ }).check();
  await expect(finder.getByText("Te sugerimos", { exact: true })).toBeVisible();
  await expect(finder.locator(".suggestion-body h3")).toContainText("Tostado a la leña");
  await expect(finder.locator(".grind-picker select")).toHaveValue("");
  // Si dice cómo lo prepara, esa molienda queda elegida.
  await finder.getByRole("radio", { name: "Lo muelo en casa" }).check();
  await expect(finder.locator(".grind-picker select")).toHaveValue("En grano");
});

test("las páginas legales se publican como borrador visible y sin indexar", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Términos de compra" }).last().click();
  await expect(page).toHaveURL(/\/terminos\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Términos de compra");
  await expect(page.getByText("Wompi")).toHaveCount(0);
  const pending = await page.locator(".legal-pending").count();
  if (pending > 0) {
    await expect(page.locator(".policy-draft")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  expect(await page.locator("body").innerText()).not.toMatch(/\[[^\]]+\]/);

  const missing = await page.goto("no-existe/");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
  await page.getByRole("link", { name: "Volver a la tienda" }).click();
  await expect(page.locator(".product-card").first()).toBeVisible();
});

for (const width of [390, 320]) {
  test(`sin desbordes horizontales a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("./");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Los botones principales de la ficha tienen al menos 44 px de alto.
    const card = await firstAddableCard(page);
    const box = await card.locator(".add-button").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
}
