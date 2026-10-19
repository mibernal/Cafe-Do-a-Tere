import { expect, test, type Page } from "@playwright/test";

// Recorrido del sitio estático tal como queda publicado en GitHub Pages.

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

test("la portada carga completa, sin errores y sin rutas de servidor", async ({ page }) => {
  const errors = watchErrors(page);
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Café Doña Tere/);
  await expect(page.locator(".product-card").first()).toBeVisible();

  // La CSP va antes de cualquier script.
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self' 'sha256-");
  expect(csp).not.toContain("unsafe-eval");

  // Todas las imágenes de la página cargan (se fuerza la carga diferida).
  await page.evaluate(() => document.querySelectorAll("img").forEach((img) => (img.loading = "eager")));
  await page.waitForLoadState("networkidle");
  const broken = await page.locator("img").evaluateAll((images) =>
    images.filter((img) => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0).map((img) => (img as HTMLImageElement).src),
  );
  expect(broken).toEqual([]);

  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.filter((href) => /\/(api|admin|seguimiento)(\/|$)/.test(href))).toEqual([]);
  expect(hrefs.some((href) => href.startsWith("https://wa.me/"))).toBe(true);
  expect(errors).toEqual([]);
});

test("la bolsa termina en un pedido por WhatsApp", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  const add = page.getByRole("button", { name: "Agregar a la bolsa" }).first();
  if ((await add.count()) === 0) {
    // Catálogo sin precios confirmados: cada café se consulta por WhatsApp.
    const inquiry = page.getByRole("link", { name: /Consultar por WhatsApp|avísame por WhatsApp/ }).first();
    await expect(inquiry).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
    return;
  }
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await page.locator(".bag-button").click();
  const send = page.getByRole("link", { name: "Enviar pedido por WhatsApp" });
  await expect(send).toBeVisible();
  const href = (await send.getAttribute("href")) ?? "";
  expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  // El mensaje lleva el detalle de la bolsa: cantidad, café, presentación y molienda.
  expect(new URL(href).searchParams.get("text")).toMatch(/Quiero hacer este pedido:\n• 1 × .+, \d+ (g|kg), /);
  expect(errors).toEqual([]);
});

test("el asistente sugiere un café", async ({ page }) => {
  await page.goto("./#elegir");
  const finder = page.locator("#elegir");
  test.skip((await finder.count()) === 0, "Con un solo café publicado no hay asistente.");
  await finder.getByRole("radio", { name: /Chocolate y cacao/ }).check();
  await expect(finder.getByText("Te sugerimos", { exact: true })).toBeVisible();
  await expect(finder.locator(".suggestion-body h3")).toContainText("Tostado a la leña");
});

test("las páginas legales y el 404 funcionan bajo el subdirectorio", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Términos de compra" }).last().click();
  await expect(page).toHaveURL(/\/terminos\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Términos de compra");
  await expect(page.getByText("Wompi")).toHaveCount(0);

  const missing = await page.goto("no-existe/");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
  await page.getByRole("link", { name: "Volver a la tienda" }).click();
  await expect(page.locator(".product-card").first()).toBeVisible();
});
