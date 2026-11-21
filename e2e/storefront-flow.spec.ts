import { expect, test, type Page } from "@playwright/test";

/**
 * Level 12 end-to-end flow:
 *   sign in/sign up → browse → select a variant → add to cart
 *   → place a COD order → staff sees the order in /admin/orders
 *
 * Environment:
 *   E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD  pre-confirmed customer account
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD        staff/admin account
 *   (when customer credentials are absent the test signs up a fresh account;
 *   email confirmation or rate limits may require pre-created credentials)
 *
 * Run against a DISPOSABLE test Supabase project only. The test places a real
 * order and reduces stock; clean up the fixtures afterwards.
 */

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function signUpCustomer(page: Page): Promise<void> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e-${suffix}@example.test`;
  const password = `E2eTest${suffix.slice(-6)}a1`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number (optional)").fill("03001234567");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  const confirmationPrompt = page.getByText(
    /check your email|confirmation link|verify your email/i,
  );
  const accountLink = page.getByRole("link", { name: /my orders/i });
  await expect(confirmationPrompt.or(accountLink)).toBeVisible({
    timeout: 20_000,
  });
  if (await confirmationPrompt.isVisible()) {
    test.skip(
      true,
      "Email confirmation is enabled; set E2E_CUSTOMER_EMAIL/PASSWORD to a pre-confirmed test account.",
    );
  }
}

test("customer places a COD order that staff can see", async ({
  page,
  browser,
}) => {
  const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;

  // 1. Authenticate as a customer (or create a fresh one).
  if (customerEmail && customerPassword) {
    await signIn(page, customerEmail, customerPassword);
  } else {
    await signUpCustomer(page);
  }
  await expect(page).toHaveURL(/\/account|\/$/);

  // 2. Browse the catalogue and open the first product.
  await page.goto("/products");
  const firstProduct = page.locator('a[href^="/products/"]').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page).toHaveURL(/\/products\/[a-z0-9-]+/);

  // 3. Select every variant attribute, then add to cart. The product page is
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

  // 4. Continue to checkout. Adding an item opens the drawer automatically;
  // click the header button only when it is not already open.
  const cartDialog = page.getByRole("dialog");
  if ((await cartDialog.count()) === 0) {
    await page.getByRole("button", { name: /open cart/i }).click();
  }
  await cartDialog.getByRole("link", { name: /checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // 5. Fill delivery details and place the COD order.
  await page.getByLabel(/full name/i).fill("E2E Shopper");
  await page.getByLabel(/mobile number/i).fill("03001234567");
  await page.getByLabel(/city/i).fill("Lahore");
  await page.getByLabel(/address/i).fill("12 E2E Test Street, Garden Town");
  await page.getByRole("button", { name: /place order/i }).click();

  // 6. Capture the order number from the confirmation panel.
  await expect(
    page.getByRole("heading", { name: /order confirmed/i }),
  ).toBeVisible({ timeout: 30_000 });
  const orderNumber = (
    await page.locator("dl dd").first().textContent()
  )?.trim();
  expect(orderNumber).toBeTruthy();

  // 7. Verify staff visibility in a separate session.
  if (!adminEmail || !adminPassword) {
    test.skip(
      true,
      "Set E2E_ADMIN_EMAIL/PASSWORD to verify staff order visibility.",
    );
    // test.skip throws at runtime; this keeps TypeScript's control-flow narrow.
    return;
  }
  const adminPage = await browser.newPage();
  try {
    await signIn(adminPage, adminEmail, adminPassword);
    await adminPage.goto("/admin/orders");
    await expect(
      adminPage.getByText(orderNumber!, { exact: false }).first(),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await adminPage.close();
  }
});
