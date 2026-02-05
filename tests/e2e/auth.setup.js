import { test as setup, expect } from '@playwright/test';
import { execSync } from 'child_process';

const authFile = 'tests/e2e/playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    console.log('Starting authentication setup...');

    // Reset database to initial state
    try {
        execSync('node scripts/reset-auth.js', { stdio: 'inherit' });
    } catch (e) {
        console.error('Failed to reset auth:', e);
    }

    // 1. Visit the app
    await page.goto('/');

    // 2. Login with default password
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 3. Handle force password change
    await expect(page).toHaveURL(/.*\/change-password/);
    await page.fill('input#newPassword', 'securePassword123');
    await page.fill('input#confirmPassword', 'securePassword123');
    await page.click('button[type="submit"]');

    // 4. Wait for dashboard
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.locator('.sidebar')).toBeVisible();

    // 5. Save storage state
    await page.context().storageState({ path: authFile });
    console.log('Authentication setup complete. State saved to:', authFile);
});
