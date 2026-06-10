import { chromium } from 'playwright';

const EMAIL = process.env.GOOGLE_EMAIL || '';
const PASSWORD = process.env.GOOGLE_PASSWORD || '';

if (!EMAIL || !PASSWORD) {
  console.error('❌ Set GOOGLE_EMAIL and GOOGLE_PASSWORD environment variables');
  process.exit(1);
}

(async () => {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    channel: 'chrome',
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to Google login
    console.log('📱 Navigating to Google login...');
    await page.goto('https://accounts.google.com/signin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/01-login-page.png', fullPage: true });
    console.log('   ✅ Screenshot: 01-login-page.png');

    // Step 2: Enter email
    console.log(`📧 Entering email: ${EMAIL}`);
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(EMAIL);
    await page.screenshot({ path: 'screenshots/02-email-entered.png', fullPage: true });

    // Click Next
    console.log('   👆 Clicking Next...');
    await page.locator('#identifierNext').click();

    // Wait for password field to become visible
    console.log('   ⏳ Waiting for password page...');
    // Google has a hidden password field initially; wait for the visible one
    const passwordInput = page.locator('input[type="password"]:visible');
    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/03-password-page.png', fullPage: true });
    console.log('   ✅ Screenshot: 03-password-page.png');

    // Step 3: Enter password
    console.log('🔑 Entering password...');
    await passwordInput.fill(PASSWORD);
    await page.screenshot({ path: 'screenshots/04-password-entered.png', fullPage: true });

    // Click Next
    console.log('   👆 Clicking Next...');
    await page.locator('#passwordNext').click();
    console.log('   ⏳ Waiting for login to complete...');
    await page.waitForTimeout(5000);

    // Step 4: Check result
    const currentUrl = page.url();
    await page.screenshot({ path: 'screenshots/05-result.png', fullPage: true });
    console.log('   ✅ Screenshot: 05-result.png');
    console.log('   📍 Current URL:', currentUrl);

    if (currentUrl.includes('myaccount.google.com') || currentUrl.includes('gds.google.com')) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
    } else if (currentUrl.includes('challenge')) {
      console.log('\n🔐 2FA/Challenge detected - check browser window');
    } else if (currentUrl.includes('accounts.google.com')) {
      console.log('\n⚠️  Still on accounts page. Possible: wrong password, CAPTCHA, or account issue');
    } else {
      console.log('\n📋 Redirected to:', currentUrl);
    }

    // Keep browser open for inspection
    console.log('\n👀 Browser staying open for 15 seconds for inspection...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'screenshots/error.png', fullPage: true });
    console.log('   📸 Error screenshot: error.png');
  } finally {
    await browser.close();
    console.log('🏁 Done.');
  }
})();
