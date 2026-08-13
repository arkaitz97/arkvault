import { test, expect } from './coverage-fixture.js';
import { execSync } from 'child_process';

test.describe('Login Redirection', () => {
    test.beforeAll(() => {
        try {
            // Reset auth to default state
            execSync('node scripts/reset-auth.js', { stdio: 'ignore' });
        } catch (e) {
            console.error('Failed to reset auth:', e);
        }
    });

    test('should redirect to dashboard after successful login for existing user', async ({ page }) => {
        // 1. Initial Setup: Login and change password to be "established"
        await page.goto('/login');
        await page.fill('input#username', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');

        // Should be at change password
        await expect(page).toHaveURL(/.*\/change-password/);

        // Change password
        await page.fill('input#newPassword', 'securePassword123');
        await page.fill('input#confirmPassword', 'securePassword123');
        await page.click('button[type="submit"]');

        // Should be at dashboard now
        await expect(page).toHaveURL(/.*\/$/);

        // 2. Logout
        await page.click('.logout-link'); // Assuming there is a logout link with this class from previous tests
        await expect(page).toHaveURL(/.*\/login/);

        // 3. Login again - THIS IS THE CASE TO FIX
        await page.fill('input#username', 'admin');
        await page.fill('input[type="password"]', 'securePassword123');
        await page.click('button[type="submit"]');

        // 4. Expect redirection to Dashboard
        await expect(page).toHaveURL(/.*\/$/, { timeout: 3000 });
        // Use a more robust check - Sidebar should be visible on dashboard, but not on login
        await expect(page.locator('.sidebar')).toBeVisible();
    });
});
