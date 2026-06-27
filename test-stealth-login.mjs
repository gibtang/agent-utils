import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin to avoid detection
chromium.use(StealthPlugin());

const EMAIL = 'gibtang@gmail.com';
const PASSWORD = 'nfu@wmt5upk3rgq3FUF';

(async () => {
  console.log('🚀 Launching stealth browser...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-web-security',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  });
  
  // Remove webdriver flag
  const page = await context.newPage();
  
  try {
    console.log('📱 Navigating to Google login...');
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/stealth-01-login.png', fullPage: true });

    // Enter email
    console.log(`📧 Entering email: ${EMAIL}`);
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(EMAIL);
    
    await page.locator('#identifierNext').click();
    console.log('   ⏳ Waiting for password page...');
    
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const visibleText = await page.evaluate(() => document.body.innerText);
    console.log('   📍 URL:', currentUrl);
    console.log('   📝 Page text (first 200 chars):', visibleText.substring(0, 200));
    
    await page.screenshot({ path: 'screenshots/stealth-02-after-email.png', fullPage: true });

    if (currentUrl.includes('rejected')) {
      console.log('\n❌ Google still detecting automation. Trying with existing Chrome profile...');
      await browser.close();
      
      // Try with real Chrome user profile
      console.log('\n🔄 Retrying with real Chrome profile...');
      const browser2 = await chromium.launchPersistentContext(
        '/tmp/chrome-debug-profile',
        {
          headless: false,
          channel: 'chrome',
          slowMo: 300,
          args: ['--disable-blink-features=AutomationControlled'],
        }
      );
      
      const page2 = browser2.pages()[0] || await browser2.newPage();
      
      await page2.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle' });
      await page2.waitForTimeout(3000);
      
      const emailInput2 = page2.locator('input[type="email"]');
      await emailInput2.waitFor({ state: 'visible' });
      await emailInput2.fill(EMAIL);
      await page2.locator('#identifierNext').click();
      await page2.waitForTimeout(5000);
      
      const url2 = page2.url();
      const text2 = await page2.evaluate(() => document.body.innerText);
      console.log('   📍 URL:', url2);
      console.log('   📝 Text (first 300):', text2.substring(0, 300));
      await page2.screenshot({ path: 'screenshots/stealth-03-profile-attempt.png', fullPage: true });
      
      if (!url2.includes('rejected')) {
        const pwdInput = page2.locator('input[type="password"]:visible');
        await pwdInput.waitFor({ state: 'visible', timeout: 10000 });
        await pwdInput.fill(PASSWORD);
        await page2.locator('#passwordNext').click();
        await page2.waitForTimeout(5000);
        
        const finalUrl = page2.url();
        await page2.screenshot({ path: 'screenshots/stealth-04-result.png', fullPage: true });
        console.log('\n📍 Final URL:', finalUrl);
        
        if (finalUrl.includes('myaccount') || finalUrl.includes('gds.google')) {
          console.log('✅ LOGIN SUCCESSFUL!');
        } else {
          console.log('⚠️  Check screenshots for result');
        }
      } else {
        console.log('\n❌ Google still rejecting. Manual login may be required.');
      }
      
      await browser2.close();
      return;
    }

    // If not rejected, continue with password
    const passwordInput = page.locator('input[type="password"]:visible');
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    
    console.log('🔑 Entering password...');
    await passwordInput.fill(PASSWORD);
    await page.screenshot({ path: 'screenshots/stealth-03-pwd.png', fullPage: true });
    
    await page.locator('#passwordNext').click();
    await page.waitForTimeout(5000);
    
    const finalUrl = page.url();
    await page.screenshot({ path: 'screenshots/stealth-04-result.png', fullPage: true });
    console.log('📍 Final URL:', finalUrl);
    
    if (finalUrl.includes('myaccount') || finalUrl.includes('gds.google')) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
    } else {
      console.log('\n⚠️  Check screenshots for result');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'screenshots/stealth-error.png', fullPage: true });
  } finally {
    // Keep open briefly
    console.log('\n👀 Closing in 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    try { await browser.close(); } catch {}
    console.log('🏁 Done.');
  }
})();
