import { test, expect, Page } from '@playwright/test';

test.describe('1Password Integration E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
  });

  test('should load the home page', async () => {
    await expect(page).toHaveTitle(/1Password/);
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('should navigate to login page', async () => {
    await page.click('text=Login');
    await expect(page).toHaveURL(/.*login/);
    
    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should handle form submission', async () => {
    await page.goto('/login');
    
    await page.fill('input[name="username"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type="submit"]')
    ]);
    
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display error for invalid credentials', async () => {
    await page.goto('/login');
    
    await page.fill('input[name="username"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/Invalid credentials/);
  });

  test('should handle responsive design', async ({ viewport }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      
      const navigation = page.locator('nav');
      await expect(navigation).toBeVisible();
      
      if (vp.name === 'Mobile') {
        const hamburgerMenu = page.locator('.hamburger-menu');
        await expect(hamburgerMenu).toBeVisible();
      }
    }
  });

  test('should test API endpoints', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  });

  test('should handle keyboard navigation', async () => {
    await page.goto('/');
    
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL(/.*about/);
  });

  test('should validate form fields', async () => {
    await page.goto('/contact');
    
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    
    const validationMessage = page.locator('.validation-error');
    await expect(validationMessage).toBeVisible();
    await expect(validationMessage).toContainText(/valid email/);
  });

  test('should test dark mode toggle', async () => {
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    await darkModeToggle.click();
    
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark-mode/);
    
    await darkModeToggle.click();
    await expect(body).not.toHaveClass(/dark-mode/);
  });

  test('should measure page performance', async () => {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });

    expect(metrics.domContentLoaded).toBeLessThan(3000);
    expect(metrics.loadComplete).toBeLessThan(5000);
  });
});

test.describe('Accessibility Tests', () => {
  test('should pass accessibility audits', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityReport = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const missingAlt = images.filter(img => !img.alt);
      
      const buttons = Array.from(document.querySelectorAll('button'));
      const missingAriaLabel = buttons.filter(btn => 
        !btn.textContent?.trim() && !btn.getAttribute('aria-label')
      );
      
      return {
        imagesWithoutAlt: missingAlt.length,
        buttonsWithoutLabel: missingAriaLabel.length,
      };
    });

    expect(accessibilityReport.imagesWithoutAlt).toBe(0);
    expect(accessibilityReport.buttonsWithoutLabel).toBe(0);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    const headings = await page.evaluate(() => {
      const h1Count = document.querySelectorAll('h1').length;
      const headingLevels = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => parseInt(h.tagName[1]));
      
      return { h1Count, headingLevels };
    });

    expect(headings.h1Count).toBe(1);
    
    for (let i = 1; i < headings.headingLevels.length; i++) {
      const diff = headings.headingLevels[i] - headings.headingLevels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });
});