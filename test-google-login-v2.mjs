import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Launching Chrome with persistent context...');
  const context = await chromium.launchPersistentContext(
    '/tmp/agent-utils-test-profile',
    {
      headless: false,
      channel: 'chrome',
      slowMo: 200,
      args: ['--disable-blink-features=AutomationControlled'],
    }
  );

  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to login page
    console.log('📱 Navigating to agent-utils.com/login...');
    await page.goto('https://agent-utils.com/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/test-01-login-page.png', fullPage: true });
    console.log('   ✅ Screenshot: test-01-login-page.png');

    // Click "Sign in with Google"
    console.log('🔵 Clicking "Sign in with Google"...');
    const googleBtn = page.locator('button:has-text("Google")');
    await googleBtn.click();

    // Wait for Google popup
    console.log('   ⏳ Waiting for Google popup...');
    
    // Handle popup
    const popup = await context.waitForEvent('page', { timeout: 15000 });
    console.log('   ✅ Google popup opened:', popup.url());
    await popup.waitForLoadState('networkidle');
    await popup.screenshot({ path: 'screenshots/test-02-google-popup.png', fullPage: true });
    console.log('   ✅ Screenshot: test-02-google-popup.png');

    // Check if we got the account chooser or email input
    const emailInput = popup.locator('input[type="email"]');
    const accountItem = popup.locator('[data-identifier]').first();
    
    if (await accountItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('📋 Account chooser detected — clicking account...');
      await accountItem.click();
    } else if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('📧 Email input detected — entering email...');
      await emailInput.fill('gibtang@gmail.com');
      await popup.locator('#identifierNext').click();
    }

    await popup.waitForTimeout(3000);
    await popup.screenshot({ path: 'screenshots/test-03-after-email.png', fullPage: true });
    console.log('   ✅ Screenshot: test-03-after-email.png');

    // Check for password page
    const pwdInput = popup.locator('input[type="password"]:visible');
    if (await pwdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🔑 Password page — entering password...');
      await pwdInput.fill('nfu@wmt5upk3rgq3FUF');
      await popup.locator('#passwordNext').click();
    } else {
      const popupText = await popup.evaluate(() => document.body.innerText);
      console.log('   📝 Popup text:', popupText.substring(0, 200));
    }

    await popup.waitForTimeout(3000);
    await popup.screenshot({ path: 'screenshots/test-04-after-password.png', fullPage: true });
    console.log('   ✅ Screenshot: test-04-after-password.png');

    // Wait for redirect back to agent-utils
    console.log('   ⏳ Waiting for redirect back...');
    await page.waitForTimeout(5000);
    
    const finalUrl = page.url();
    await page.screenshot({ path: 'screenshots/test-05-result.png', fullPage: true });
    console.log('   ✅ Screenshot: test-05-result.png');
    console.log('   📍 Final URL:', finalUrl);

    if (finalUrl.includes('/profile')) {
      console.log('\n✅ SUCCESS — redirected to /profile!');
    } else if (finalUrl.includes('/login')) {
      console.log('\n⚠️  Still on /login — redirect not working');
    } else {
      console.log('\n📍 Landed on:', finalUrl);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'screenshots/test-error.png', fullPage: true });
  }

  console.log('\n👀 Keeping browser open for 10 seconds...');
  await page.waitForTimeout(10000);
  await context.close();
  console.log('🏁 Done.');
})();
