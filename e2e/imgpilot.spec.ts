/**
 * imgpilot E2E 测试
 * 覆盖：正向主流程（旋转处理、滤镜处理）+ 异常分支（未启用步骤、裁剪未选区）
 */
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_IMAGE = join(__dirname, 'fixtures', 'test-image.png');

// 辅助函数：等待 loading 消失
async function waitForIdle(page: import('@playwright/test').Page) {
  // 等待 loading overlay 消失（如果存在）
  const overlay = page.locator('.loading-overlay');
  try {
    await overlay.waitFor({ state: 'hidden', timeout: 15000 });
  } catch {
    // 没有 loading overlay 也没关系
  }
  // 额外等待渲染完成
  await page.waitForTimeout(300);
}

// 辅助函数：上传图片文件
async function uploadImage(page: import('@playwright/test').Page) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('点击或拖拽图片到此处').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(TEST_IMAGE);
  // 等待图片加载完成
  await page.waitForSelector('.thumb-item', { timeout: 10000 });
  await waitForIdle(page);
}

// 辅助函数：切换到指定 Tab
async function switchTab(page: import('@playwright/test').Page, tabLabel: string) {
  await page.locator('.tab').filter({ hasText: tabLabel }).click();
  await page.waitForTimeout(200);
}

// 辅助函数：启用当前步骤的 checkbox
async function enableStep(page: import('@playwright/test').Page) {
  // 找到「启用此步骤」的 checkbox（在当前可见的 tabContent 中）
  const checkbox = page.locator('#tabContent input[type="checkbox"][data-op]');
  if (!(await checkbox.isChecked())) {
    await checkbox.check();
    // 等待 UI 解除 disabled 状态
    await page.waitForTimeout(200);
  }
}

test.describe('imgpilot E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待页面核心元素渲染完成
    await expect(page.getByRole('heading', { name: 'imgpilot' })).toBeVisible();
  });

  // ─── 正向流程 1：上传图片 → 旋转 90° → 执行处理 → 验证结果 ───
  test('正向流程：旋转 90 度并执行处理', async ({ page }) => {
    // 1. 上传测试图片
    await uploadImage(page);

    // 验证：缩略图已显示，包含文件名和像素信息
    await expect(page.locator('.thumb-item').first()).toBeVisible();
    await expect(page.locator('.thumb-name').first()).toContainText('test-image.png');
    await expect(page.locator('.thumb-meta').first()).toContainText('100×60px');

    // 2. 切换到旋转/翻转 Tab
    await switchTab(page, '旋转/翻转');

    // 3. 先点击 90° 快捷按钮（必须在 enableStep 之前，因为 enableStep 会 re-render 导致直接事件监听丢失）
    await page.locator('button[data-rotate="90"]').click();
    // 验证：range 滑块值变为 90
    const rangeInput = page.locator('input[data-k="rotateDegrees"]');
    await expect(rangeInput).toHaveValue('90');

    // 4. 启用旋转步骤
    await enableStep(page);

    // 5. 点击「执行处理」
    await page.getByRole('button', { name: '执行处理' }).click();
    // 等待处理完成
    await waitForIdle(page);

    // 6. 验证：处理结果区域显示结果图片
    const resultImg = page.locator('.preview-thumb img[alt="result"]');
    await expect(resultImg).toBeVisible({ timeout: 10000 });

    // 7. 验证：结果元信息包含 "旋转" 和像素尺寸
    await expect(page.locator('.result-meta-text')).toContainText('旋转');
    await expect(page.locator('.result-meta-text')).toContainText('px');

    // 8. 验证：下载结果按钮可见
    await expect(page.getByRole('link', { name: '下载结果' })).toBeVisible();
  });

  // ─── 正向流程 2：上传图片 → 滤镜（灰度+亮度）→ 执行处理 → 验证 ───
  test('正向流程：应用灰度滤镜并执行处理', async ({ page }) => {
    // 1. 上传测试图片
    await uploadImage(page);

    // 2. 切换到滤镜 Tab
    await switchTab(page, '滤镜');

    // 3. 启用滤镜步骤
    await enableStep(page);

    // 4. 调节灰度滑块到 0.5（需要操作 range input）
    const grayscaleSlider = page.locator('input[data-k="filterGrayscale"]');
    await grayscaleSlider.fill('0.5');
    // 触发 input 事件
    await grayscaleSlider.dispatchEvent('input');
    await page.waitForTimeout(200);

    // 5. 调节亮度滑块到 0.3
    const brightnessSlider = page.locator('input[data-k="filterBrightness"]');
    await brightnessSlider.fill('0.3');
    await brightnessSlider.dispatchEvent('input');
    await page.waitForTimeout(200);

    // 6. 点击「执行处理」
    await page.getByRole('button', { name: '执行处理' }).click();
    await waitForIdle(page);

    // 7. 验证：结果出现
    const resultImg = page.locator('.preview-thumb img[alt="result"]');
    await expect(resultImg).toBeVisible({ timeout: 10000 });

    // 8. 验证：结果元信息包含 "滤镜"
    await expect(page.locator('.result-meta-text')).toContainText('滤镜');

    // 9. 验证：对比预览模式可切换
    await page.locator('button[data-mode="compare"]').click();
    // 对比视图出现
    await expect(page.locator('#compare')).toBeVisible();
    // 切换回单图模式
    await page.locator('button[data-mode="single"]').click();
    await expect(page.locator('#compare')).not.toBeVisible();
  });

  // ─── 异常分支 1：未启用任何步骤时直接点击执行 → 显示错误提示 ───
  test('异常分支：未启用步骤时触发校验错误', async ({ page }) => {
    // 1. 上传图片（但不启用任何步骤）
    await uploadImage(page);

    // 2. 直接点击「执行处理」
    await page.getByRole('button', { name: '执行处理' }).click();
    await page.waitForTimeout(500);

    // 3. 验证：显示错误提示
    const errorEl = page.locator('.run-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('请至少启用一个处理步骤');
  });

  // ─── 异常分支 2：启用裁剪但未选定区域时 → 显示校验错误 ───
  test('异常分支：裁剪已启用但未设置裁剪区域', async ({ page }) => {
    // 1. 上传图片
    await uploadImage(page);

    // 2. 切换到裁剪 Tab
    await switchTab(page, '裁剪');

    // 3. 启用裁剪步骤（但不拖拽选区）
    await enableStep(page);

    // 4. 直接点击「执行处理」
    await page.getByRole('button', { name: '执行处理' }).click();
    await page.waitForTimeout(500);

    // 5. 验证：显示裁剪校验错误
    const errorEl = page.locator('.run-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('裁剪');
    await expect(errorEl).toContainText('裁剪区域');
  });
});