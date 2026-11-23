import { expect, test, type Page } from '@playwright/test';

const SEED = 2026;

async function startFreshGame(page: Page): Promise<void> {
  await page.goto(`/?seed=${SEED}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?seed=${SEED}`);
  await expect(page.locator('#planet-label')).toHaveText(`Planet ${SEED}`);
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await page.waitForTimeout(1500);
}

/** Drags a selection box over the whole battlefield viewport (between the HUD bars). */
async function selectAllOnScreen(page: Page): Promise<void> {
  await page.mouse.move(20, 60);
  await page.mouse.down();
  await page.mouse.move(1420, 680, { steps: 6 });
  await page.mouse.up();
}

test.describe('planetary RTS smoke', () => {
  test('selects units and derives shared commands from capabilities', async ({ page }) => {
    await startFreshGame(page);
    await expect(page.locator('#resources')).toContainText('400');
    await selectAllOnScreen(page);
    await expect(page.locator('#selection-panel h3')).toHaveText(/\d+ units selected/);
    const panel = page.locator('#command-panel');
    await expect(panel).toContainText('Move');
    await expect(panel).toContainText('Stop');
    await expect(panel).not.toContainText('Attack');
    await page.getByRole('button', { name: /Harvester ×/ }).click();
    await expect(panel).toContainText('Harvest');
    await expect(panel).not.toContainText('Attack');
  });

  test('issues a movement order with a right click', async ({ page }) => {
    await startFreshGame(page);
    await selectAllOnScreen(page);
    await page.getByRole('button', { name: /Scout ×/ }).click();
    await expect(page.locator('#selection-panel h3')).toHaveText('Scout');
    await page.mouse.click(720, 600, { button: 'right' });
    await expect(page.locator('#selection-panel')).toContainText('Moving');
  });

  test('restores the planet and forces after a reload', async ({ page }) => {
    await startFreshGame(page);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    await page.reload();
    await expect(page.locator('#planet-label')).toHaveText(`Planet ${SEED}`);
    await page.waitForTimeout(1000);
    await selectAllOnScreen(page);
    await expect(page.locator('#selection-panel h3')).toHaveText(/\d+ units selected/);
  });

  test('opens the controls reference', async ({ page }) => {
    await startFreshGame(page);
    await page.keyboard.press('F1');
    await expect(page.locator('#help')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#help')).toBeHidden();
  });
});
