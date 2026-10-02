import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // click run code
  await page.click('text="Run Code"');
  await page.waitForTimeout(1000);
  
  // check if terminal is visible by looking at the panel size
  const html = await page.content();
  console.log('HTML AFTER RUN CODE:', html.includes('TERMINAL') ? 'TERMINAL FOUND' : 'NOT FOUND');
  // Check the actual height of the terminal panel container
  const size = await page.evaluate(() => {
    const term = document.evaluate('//span[text()="TERMINAL"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (!term) return 'NO TERM';
    const panel = term.closest('[data-panel-id]');
    return panel ? panel.style.flexGrow : 'NO PANEL';
  });
  console.log('FLEX GROW:', size);
  await browser.close();
})();
