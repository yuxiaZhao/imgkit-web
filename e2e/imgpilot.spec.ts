/**
 * imgkit-web E2E 测试
 * 覆盖：正向主流程（旋转处理、滤镜处理）+ 异常分支（未启用步骤、裁剪未选区）
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_IMAGE = join(__dirname, 'fixtures', 'test-image.png');

