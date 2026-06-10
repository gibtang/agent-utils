import { chromium } from 'playwright';

const EMAIL = 'gibtang@gmail.com';
const PASSWORD = 'nfu@wmt5upk3rgq3FUF';

(async () => {
  // Launch Chrome with a persistent profile to look more "real"
  console.log('🚀 Launching Chrome with persistent context...');
  
  const context = await chromium.launchPersistentContext(
    '/tmp/google-login-test-profile',
    {
      headless: false,
      channel: 'chrome',
      slowMo: 200,
      args: [
        '--disable-blink-features=AutomationControlled',
      ],
    }
  );

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log('📱 Navigating to Google login...');
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/p-01-login.png', fullPage: true });

    // Enter email
    console.log(`📧 Entering email: ${EMAIL}`);
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(EMAIL);
    await page.screenshot({ path: 'screenshots/p-02-email.png', fullPage: true });

    // Click Next
    console.log('   👆 Clicking Next...');
    await page.locator('#identifierNext').click();
    await page.waitForTimeout(5000);

    const url = page.url();
    const text = await page.evaluate(() => document.body.innerText);
    console.log('   📍 URL:', url);
    console.log('   📝 First 200 chars:', text.substring(0, 200));
    await page.screenshot({ path: 'screenshots/p-03-after-email.png', fullPage: true });

    if (url.includes('rejected')) {
      console.log('\n❌ BLOCKED: "This browser or app may not be secure"');
      console.log('Google detects automated browsers and blocks login.');
      console.log('\n💡 Options:');
      console.log('   1. Use Google OAuth popup (for apps) instead of direct login');
      console.log('   2. Use App Password if 2FA is enabled');
      console.log('   3. Use a real Chrome profile with cookies');
      await context.close();
      return;
    }

    // Enter password
    console.log('🔑 Entering password...');
    const passwordInput = page.locator('input[type="password"]:visible');
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(PASSWORD);
    await page.screenshot({ path: 'screenshots/p-04-pwd.png', fullPage: true });

    await page.locator('#passwordNext').click();
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    await page.screenshot({ path: 'screenshots/p-05-result.png', fullPage: true });
    console.log('📍 Final URL:', finalUrl);

    if (finalUrl.includes('myaccount') || finalUrl.includes('gds.google')) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
    } else if (finalUrl.includes('challenge')) {
      console.log('\n🔐 2FA required — check browser window');
    } else {
      console.log('\n⚠️  Result unclear — check screenshots/');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'screenshots/p-error.png', fullPage: true });
  }

  console.log('\n👀 Closing browser in 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));
  await context.close();
  console.log('🏁 Done.');
})();
