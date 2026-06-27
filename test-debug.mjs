import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
    channel: 'chrome',
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://accounts.google.com/signin');
  await page.waitForLoadState('networkidle');

  // Enter email
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill('gibtang@gmail.com');
  
  // Click Next
  await page.locator('#identifierNext').click();
  
  // Wait and capture everything
  await page.waitForTimeout(5000);
  
  // Get all text visible on page
  const textContent = await page.evaluate(() => document.body.innerText);
  console.log('=== VISIBLE TEXT ===');
  console.log(textContent);
  
  // Get current URL
  console.log('\n=== CURRENT URL ===');
  console.log(page.url());

  // Get all input fields
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      name: i.name,
      id: i.id,
      visible: !i.hidden && i.offsetParent !== null,
      ariaHidden: i.getAttribute('aria-hidden'),
      className: i.className,
    }));
  });
  console.log('\n=== ALL INPUTS ===');
  console.log(JSON.stringify(inputs, null, 2));

  await page.screenshot({ path: 'screenshots/debug-after-next.png', fullPage: true });
  console.log('\n📸 Debug screenshot saved');

  await browser.close();
})();
