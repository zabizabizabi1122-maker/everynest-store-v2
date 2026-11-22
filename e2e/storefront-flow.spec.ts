import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end flow after the guest-checkout change:
 *   browse → select a variant → add to cart → place a COD order without an
 *   account → admin sees and verifies the order in /admin/orders
 *
 * Environment:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD  staff/admin account
 *
 * Run against a DISPOSABLE test Supabase project only. The test places a real
 * order and reduces stock; clean up the fixtures afterwards.
 */

async function signInAdmin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign in to admin/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
}

test("guest places a COD order that admin can verify", async ({ page, browser }) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;

  // 1. Browse the catalogue as a guest — no sign-in or sign-up step exists.
  await page.goto("/products");
  const firstProduct = page.locator('a[href^="/products/"]').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page).toHaveURL(/\/products\/[a-z0-9-]+/);

  // 2. Select every variant attribute, then add to cart. The product page is
  // streamed, so wait for the interactive panel before counting the groups.
  const addButton = page.getByRole("button", { name: /add to cart/i });
  await expect(addButton).toBeVisible();
  const groups = page.getByRole("radiogroup");
  const groupCount = await groups.count();
  for (let i = 0; i < groupCount; i += 1) {
    await groups.nth(i).getByRole("radio", { disabled: false }).first().click();
  }
  await expect(addButton).toBeEnabled();
  await addButton.click();

  // 3. Continue to checkout. Adding an item opens the drawer automatically;
  // click the header button only when it is not already open.
  const cartDialog = page.getByRole("dialog");
  if ((await cartDialog.count()) === 0) {
    await page.getByRole("button", { name: /open cart/i }).click();
  }
  await cartDialog.getByRole("link", { name: /checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByText(/no account needed/i)).toBeVisible();

  // 4. Fill the guest delivery and verification details, then submit.
  await page.getByLabel(/full name/i).fill("E2E Shopper");
  await page.getByLabel(/mobile number/i).fill("03001234567");
  await page.getByLabel(/email address/i).fill("e2e-shopper@example.test");
  await page.getByLabel(/city/i).fill("Lahore");
  await page.getByLabel(/delivery address/i).fill("12 E2E Test Street, Garden Town");
  await page.getByLabel(/product specifications/i).fill("E2E required size: M");
  await page.getByLabel(/order notes/i).fill("Leave with the guard.");
  await page.getByRole("button", { name: /submit order/i }).click();

  // 5. Confirmation: exact admin-verification message and a pending order id.
  await expect(
    page.getByRole("heading", { name: /order received/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(
      "Your order has been received successfully. Our Admin team will contact you through your provided phone number or email to verify your order.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/pending admin verification/i)).toBeVisible();
  const orderNumber = (await page.locator("dl dd").first().textContent())?.trim();
  expect(orderNumber).toBeTruthy();

  // 6. No customer order-tracking page exists — only admin can verify.
  const customerOrders = await page.request.get("/orders");
  expect([404, 307, 308]).toContain(customerOrders.status());

  // 7. Verify admin visibility and contact shortcuts in a separate session.
  if (!adminEmail || !adminPassword) {
    test.skip(
      true,
      "Set E2E_ADMIN_EMAIL/PASSWORD to verify staff order visibility.",
    );
    return;
  }
  const adminPage = await browser.newPage();
  try {
    await signInAdmin(adminPage, adminEmail, adminPassword);
    await adminPage.goto("/admin/orders");
    await adminPage.getByRole("searchbox", { name: /search orders/i }).fill(orderNumber!);
    await adminPage.getByRole("button", { name: /search/i }).click();
    await expect(
      adminPage.getByText(orderNumber!, { exact: false }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const orderRow = adminPage.getByRole("row").filter({ hasText: orderNumber! });
    await orderRow.getByRole("link", { name: /manage/i }).click();
    await expect(adminPage.getByText(/contact customer/i)).toBeVisible();
    await expect(adminPage.getByText("e2e-shopper@example.test")).toBeVisible();
    await expect(adminPage.getByText("E2E required size: M")).toBeVisible();
  } finally {
    await adminPage.close();
  }
});
