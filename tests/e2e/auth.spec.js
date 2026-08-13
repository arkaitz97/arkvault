import { test, expect } from './coverage-fixture.js';
import { execSync } from 'child_process';

test.describe('Authentication Flow', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test.beforeEach(() => {
        try {
            execSync('node scripts/reset-auth.js', { stdio: 'ignore' });
        } catch (e) {
            console.error('Failed to reset auth:', e);
        }
    });

    test('should redirect to login and force password change on first login', async ({ page }) => {
        // 1. Visit the app, should redirect to login
        await page.goto('/');
        await expect(page).toHaveURL(/.*\/login/);
        await expect(page.locator('h1')).toContainText('ArkVault');

        // 2. Login with default username/password
        await page.fill('input#username', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');

        // 3. Should redirect to change password
        await expect(page).toHaveURL(/.*\/change-password/);
        await expect(page.locator('h1')).toContainText('Security Update');

        // 4. Try to access dashboard directly, should be forced back to change-password
        await page.goto('/');
        await expect(page).toHaveURL(/.*\/change-password/);

        // 5. Change password
        await page.fill('input#newPassword', 'securePassword123');
        await page.fill('input#confirmPassword', 'securePassword123');
        await page.click('button[type="submit"]');

        // 6. Should redirect to dashboard
        await expect(page).toHaveURL(/.*\/$/);
        await expect(page.locator('.sidebar')).toBeVisible();

        // 7. Logout
        await page.click('.logout-link');
        await expect(page).toHaveURL(/.*\/login/);
    });

    test('should fail with invalid password', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input#username', 'admin');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        await expect(page.locator('.auth-error')).toBeVisible();
        await expect(page.locator('.auth-error')).toContainText('Invalid password');
    });

    test('should fail if passwords do not match during change', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.fill('input#username', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/change-password/);

        await page.fill('input#newPassword', 'password123');
        await page.fill('input#confirmPassword', 'different123');
        await page.click('button[type="submit"]');

        await expect(page.locator('.auth-error')).toBeVisible();
        await expect(page.locator('.auth-error')).toContainText('Passwords do not match');
    });
});
