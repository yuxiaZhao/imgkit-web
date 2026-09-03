import { crop, resize, rotate, flip, filter, watermark, metadata, compress, convert, parseExif } from 'imgkit';
import type { ImageDataLike, CropOptions, ResizeOptions, FilterOptions, FlipAxis, FitMode, ResizeAlgorithm, WatermarkOptions, ExifInfo, ImageMimeType } from 'imgkit';
import { Position } from 'imgkit';

interface SourceItem {
  file: File;
  url: string;
  image: ImageDataLike;
  fileSize: string;
  camera: string;
}

interface ResultItem {
  url: string;
  meta: string;
}

interface State {
  sources: SourceItem[];
  results: ResultItem[];
  currentIndex: number;
  sourceMeta: string;
  busy: boolean;
  loadingText: string;
  activeTab: 'crop' | 'resize' | 'rotate' | 'filter' | 'watermark' | 'output';
  previewMode: 'single' | 'compare';
  comparePos: number;
  // crop
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  cropRatio: string;
  cropAlign: Position;
  // resize
  resizeW: number;
  resizeH: number;
  resizeFit: FitMode;
  resizeAlgorithm: ResizeAlgorithm;
  // rotate / flip
  rotateDegrees: number;
  flipAxis: '' | FlipAxis;
  // filter
  filterGrayscale: number;
  filterSepia: number;
  filterBrightness: number;
  filterContrast: number;
  filterSaturate: number;
  filterHueRotate: number;
  filterBlur: number;
  filterInvert: number;
  filterOpacity: number;
  // watermark
  watermarkText: string;
  watermarkTile: boolean;
  watermarkPos: Position;
  watermarkOpacity: number;
  watermarkFontSize: number;
  watermarkColor: string;
  watermarkRotate: number;
  watermarkTileGap: number;
  // output
  outputFormat: ImageMimeType;
  outputQuality: number;
  outputMaxSize: number;
  compressionMode: 'quality' | 'size';
  exifData: ExifInfo | null;
}

function labelOf(t: string): string {
  const map: Record<string, string> = {
    crop: '裁剪',
    resize: '缩放',
    rotate: '旋转/翻转',
    filter: '滤镜',
    watermark: '水印',
    output: '输出',
  };
  return map[t] ?? t;
}

export function createApp(root: HTMLElement) {
  const state: State = {
    sources: [],
    results: [],
    currentIndex: 0,
    sourceMeta: '',
    busy: false,
    loadingText: '',
    activeTab: 'crop',
    previewMode: 'single',
    comparePos: 50,
    cropX: 0, cropY: 0, cropW: 0, cropH: 0,
    cropRatio: '', cropAlign: Position.Center,
    resizeW: 0, resizeH: 0, resizeFit: 'contain', resizeAlgorithm: 'bilinear',
    rotateDegrees: 0, flipAxis: '',
    filterGrayscale: 0, filterSepia: 0, filterBrightness: 0,
    filterContrast: 0, filterSaturate: 0, filterHueRotate: 0,
    filterBlur: 0, filterInvert: 0, filterOpacity: 0,
    watermarkText: '', watermarkTile: false, watermarkPos: Position.BottomRight,
    watermarkOpacity: 0.5, watermarkFontSize: 32, watermarkColor: '#ffffff',
    watermarkRotate: 0, watermarkTileGap: 40,
    outputFormat: 'image/jpeg', outputQuality: 0.8, outputMaxSize: 0,
    compressionMode: 'quality',
    exifData: null,
  };

  function getSource(): SourceItem | null {
    return state.sources[state.currentIndex] ?? null;
  }
  function getResult(): ResultItem | null {
    return state.results[state.currentIndex] ?? null;
  }

  function render() {
    const hasSource = state.sources.length > 0;
    const src = getSource();
    const srcUrl = src?.url ?? '';
    const res = getResult();
    const resUrl = res?.url ?? '';
    const resMeta = res?.meta ?? '';
    const fileName = src?.file?.name ?? '';

    const sourcePreviewHtml = hasSource
      ? `<div class="preview-thumb"><img src="${srcUrl}" alt="source" /></div>
         <div class="meta">${fileName}${src!.camera ? ' · ' + src!.camera : ''} · ${src!.fileSize} · ${src!.image.width}×${src!.image.height}px${state.sourceMeta ? ' · ' + state.sourceMeta : ''}</div>`
      : '';

    let resultSectionHtml: string;
    if (!hasSource) {
      resultSectionHtml = '<p style="color:#95a5a6">请先上传图片后再执行处理。</p>';
    } else {
      const toolbarHtml = `<div class="preview-toolbar">
          <div class="preview-modes">
            <button class="btn-mini ${state.previewMode === 'single' ? 'active' : ''}" data-mode="single">单图预览</button>
            <button class="btn-mini ${state.previewMode === 'compare' ? 'active' : ''}" data-mode="compare">对比预览</button>
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            ${resUrl ? `<a class="btn" href="${resUrl}" download="imgkit-result.png">下载结果</a>` : ''}
          </div>
        </div>`;
      const previewHtml = resUrl
        ? state.previewMode === 'single'
          ? `<div class="preview-thumb"><img src="${resUrl}" alt="result" /></div>`
          : `<div class="compare" id="compare">
               <img class="compare-img" src="${srcUrl}" alt="source" />
               <div class="compare-overlay" id="compareOverlay" style="width:${state.comparePos}%">
                 <img class="compare-img" src="${resUrl}" alt="result" />
               </div>
               <div class="compare-divider" id="compareDivider" style="left:${state.comparePos}%"></div>
               <div class="compare-label-left">原图</div>
               <div class="compare-label-right">处理后</div>
             </div>`
        : '<p style="color:#95a5a6;margin-top:12px;">暂无结果，请执行处理。</p>';
      resultSectionHtml = `${toolbarHtml}${previewHtml}${
        resMeta ? `<div class="result-info">${resMeta}</div>` : ''
      }`;
    }

    root.innerHTML = `
      ${state.busy ? `<div class="loading-overlay"><div class="loading-spinner"></div><p class="loading-text">${state.loadingText || '处理中…'}</p></div>` : ''}
      <div class="container">
        <header>
          <h1>imgkit</h1>
          <p>纯前端图片处理工具库 · 裁剪 / 缩放 / 旋转翻转 / 滤镜 / 水印 / 输出</p>
        </header>
        <div class="layout">
          <section class="panel">
            <h2>1. 选择图片</h2>
            <div class="drop-zone" id="drop">
              <p>点击或拖拽图片到此处</p>
              <input type="file" id="file" accept="image/*" multiple hidden />
            </div>
            ${sourcePreviewHtml}
          </section>
          <section class="panel">
            <h2>2. 处理选项</h2>
            <div class="tabs">
              ${(['crop', 'resize', 'rotate', 'filter', 'watermark', 'output'] as const)
                .map((t) => `<div class="tab ${state.activeTab === t ? 'active' : ''}" data-tab="${t}">${labelOf(t)}</div>`)
                .join('')}
            </div>
            <div id="tabContent"></div>
            <button class="btn" id="run" ${hasSource && state.activeTab !== 'output' ? '' : 'disabled'} style="margin-top:var(--space-lg);${state.activeTab === 'output' ? 'display:none' : ''}">执行处理</button>
          </section>
        </div>
        <section class="panel" style="margin-top:24px">
          <h2>3. 处理结果</h2>
          ${resultSectionHtml}
        </section>
      </div>
    `;
    renderTabContent();
    bind();
  }

  function renderTabContent() {
    const el = document.getElementById('tabContent');
    if (!el) return;
    const t = state.activeTab;
    if (t === 'crop') {
      el.innerHTML = `
        <div class="crop-grid">
          <div class="control"><label>X 偏移 (px)</label><input type="number" value="${state.cropX}" data-k="cropX" min="0" /></div>
          <div class="control"><label>Y 偏移 (px)</label><input type="number" value="${state.cropY}" data-k="cropY" min="0" /></div>
          <div class="control"><label>宽度 (px，0=自动)</label><input type="number" value="${state.cropW}" data-k="cropW" min="0" /></div>
          <div class="control"><label>高度 (px，0=自动)</label><input type="number" value="${state.cropH}" data-k="cropH" min="0" /></div>
          <div class="control full"><label>宽高比（如 16:9 填 16/9，留空则按坐标裁剪）</label><input type="text" value="${state.cropRatio}" data-k="cropRatio" placeholder="例: 16/9" /></div>
          <div class="control full"><label>对齐方式（宽高比裁剪时生效）</label>
            <select data-k="cropAlign">
              ${Object.values(Position).map((p) => `<option value="${p}" ${state.cropAlign === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>`;
    } else if (t === 'resize') {
      el.innerHTML = `
        <div class="controls">
          <div class="control"><label>目标宽度 (px，0=等比)</label><input type="number" value="${state.resizeW}" data-k="resizeW" min="0" /></div>
          <div class="control"><label>目标高度 (px，0=等比)</label><input type="number" value="${state.resizeH}" data-k="resizeH" min="0" /></div>
          <div class="control"><label>适配模式</label>
            <select data-k="resizeFit">
              <option value="contain" ${state.resizeFit === 'contain' ? 'selected' : ''}>contain (等比缩放，完整显示)</option>
              <option value="cover" ${state.resizeFit === 'cover' ? 'selected' : ''}>cover (等比缩放，填满裁剪)</option>
              <option value="exact" ${state.resizeFit === 'exact' ? 'selected' : ''}>exact (精确尺寸，可能变形)</option>
              <option value="fill" ${state.resizeFit === 'fill' ? 'selected' : ''}>fill (拉伸填满)</option>
            </select>
          </div>
          <div class="control"><label>插值算法</label>
            <select data-k="resizeAlgorithm">
              <option value="bilinear" ${state.resizeAlgorithm === 'bilinear' ? 'selected' : ''}>双线性插值</option>
              <option value="nearest" ${state.resizeAlgorithm === 'nearest' ? 'selected' : ''}>最近邻</option>
            </select>
          </div>
        </div>`;
    } else if (t === 'rotate') {
      el.innerHTML = `
        <div class="controls">
          <div class="control"><label>旋转角度</label><input type="range" min="-180" max="180" value="${state.rotateDegrees}" data-k="rotateDegrees" /><span style="font-size:12px;color:var(--color-text-secondary)">${state.rotateDegrees}°</span></div>
        </div>
        <div class="rotate-actions">
          <button class="btn-mini" data-rotate="90">90°</button>
          <button class="btn-mini" data-rotate="180">180°</button>
          <button class="btn-mini" data-rotate="270">270°</button>
          <button class="btn-mini" data-rotate="0">还原</button>
        </div>
        <div class="flip-actions">
          <button class="btn-mini${state.flipAxis === 'horizontal' ? ' active' : ''}" id="btnFlipH">水平翻转</button>
          <button class="btn-mini${state.flipAxis === 'vertical' ? ' active' : ''}" id="btnFlipV">垂直翻转</button>
        </div>`;
    } else if (t === 'filter') {
      el.innerHTML = `
        <div class="controls">
          <div class="control"><label>灰度 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterGrayscale}" data-k="filterGrayscale" /></div>
          <div class="control"><label>棕褐 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterSepia}" data-k="filterSepia" /></div>
          <div class="control"><label>亮度 (-1~1)</label><input type="range" min="-1" max="1" step="0.05" value="${state.filterBrightness}" data-k="filterBrightness" /></div>
          <div class="control"><label>对比度 (-1~1)</label><input type="range" min="-1" max="1" step="0.05" value="${state.filterContrast}" data-k="filterContrast" /></div>
          <div class="control"><label>饱和度 (-1~1)</label><input type="range" min="-1" max="1" step="0.05" value="${state.filterSaturate}" data-k="filterSaturate" /></div>
          <div class="control"><label>色相旋转 (deg)</label><input type="range" min="0" max="360" step="1" value="${state.filterHueRotate}" data-k="filterHueRotate" /></div>
          <div class="control"><label>高斯模糊 (px)</label><input type="range" min="0" max="10" step="0.5" value="${state.filterBlur}" data-k="filterBlur" /></div>
          <div class="control"><label>反相 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterInvert}" data-k="filterInvert" /></div>
          <div class="control"><label>透明度 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterOpacity}" data-k="filterOpacity" /></div>
        </div>`;
    } else if (t === 'watermark') {
      el.innerHTML = `
        <div class="controls">
          <div class="control"><label>水印文字</label><input type="text" value="${state.watermarkText}" data-k="watermarkText" placeholder="例如: © imgkit" /></div>
          <div class="control"><label>平铺模式</label><input type="checkbox" data-k="watermarkTile" ${state.watermarkTile ? 'checked' : ''} /></div>
          <div class="control"><label>位置</label>
            <select data-k="watermarkPos">
              ${Object.values(Position).map((p) => `<option value="${p}" ${state.watermarkPos === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="control"><label>透明度</label><input type="range" min="0.05" max="1" step="0.05" value="${state.watermarkOpacity}" data-k="watermarkOpacity" /></div>
          <div class="control"><label>字体大小</label><input type="number" min="8" max="200" value="${state.watermarkFontSize}" data-k="watermarkFontSize" /></div>
          <div class="control"><label>颜色 </label><input type="color" value="${state.watermarkColor}" data-k="watermarkColor" style="padding:0 4px;" /></div>
          <div class="control"><label>旋转角度</label><input type="number" min="-180" max="180" value="${state.watermarkRotate}" data-k="watermarkRotate" /></div>
          ${state.watermarkTile ? `<div class="control"><label>平铺间距</label><input type="number" min="0" max="500" value="${state.watermarkTileGap}" data-k="watermarkTileGap" /></div>` : ''}
        </div>`;
    } else if (t === 'output') {
      const exif = state.exifData;
      el.innerHTML = `
        <div class="controls">
          ${exif ? `<div class="exif-card">
            <h4>EXIF 信息</h4>
            ${exif.make ? `<div class="exif-row"><span>设备厂商</span><span>${exif.make}</span></div>` : ''}
            ${exif.model ? `<div class="exif-row"><span>设备型号</span><span>${exif.model}</span></div>` : ''}
            ${exif.dateTime ? `<div class="exif-row"><span>拍摄时间</span><span>${exif.dateTime}</span></div>` : ''}
            ${exif.orientation ? `<div class="exif-row"><span>方向</span><span>${exif.orientation}</span></div>` : ''}
            ${exif.gps ? `<div class="exif-row"><span>GPS</span><span>${exif.gps.latitude.toFixed(4)}, ${exif.gps.longitude.toFixed(4)}</span></div>` : ''}
          </div>` : '<p style="color:#95a5a6;font-size:13px;">上传 JPEG 图片后可解析 EXIF 信息</p>'}
          <div class="control"><label>输出格式</label>
            <select data-k="outputFormat">
              <option value="image/jpeg" ${state.outputFormat === 'image/jpeg' ? 'selected' : ''}>JPEG</option>
              <option value="image/png" ${state.outputFormat === 'image/png' ? 'selected' : ''}>PNG</option>
              <option value="image/webp" ${state.outputFormat === 'image/webp' ? 'selected' : ''}>WebP</option>
            </select>
          </div>
          <div class="control"><label>压缩模式</label>
            <div class="radio-group">
              <label class="radio-label ${state.compressionMode === 'quality' ? 'active' : ''}"><input type="radio" name="compMode" value="quality" data-k="compressionMode" ${state.compressionMode === 'quality' ? 'checked' : ''} />质量优先</label>
              <label class="radio-label ${state.compressionMode === 'size' ? 'active' : ''}"><input type="radio" name="compMode" value="size" data-k="compressionMode" ${state.compressionMode === 'size' ? 'checked' : ''} />体积优先</label>
            </div>
          </div>
          ${state.compressionMode === 'quality'
            ? `<div class="control"><label>质量 ${state.outputQuality.toFixed(2)}</label><input type="range" min="0.1" max="1" step="0.05" value="${state.outputQuality}" data-k="outputQuality" /></div>`
            : `<div class="control"><label>目标体积 (KB)</label><input type="number" min="1" value="${state.outputMaxSize || 50}" data-k="outputMaxSize" /></div>`
          }
          <div class="output-actions">
            <button class="btn" id="btnOutputRun">执行处理</button>
          </div>
        </div>`;
    }
  }

  function bind() {
    const drop = document.getElementById('drop') as HTMLElement;
    const fileInput = document.getElementById('file') as HTMLInputElement;
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) handleFiles(fileInput.files);
      fileInput.value = '';
    });

    document.querySelectorAll('.tab').forEach((t) => {
      t.addEventListener('click', () => {
        state.activeTab = (t as HTMLElement).dataset.tab! as State['activeTab'];
        render();
      });
    });

    document.getElementById('run')?.addEventListener('click', run);

    // 预览模式切换
    document.querySelectorAll('.btn-mini[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.previewMode = (btn as HTMLElement).dataset.mode as 'single' | 'compare';
        render();
      });
    });

    // 对比预览滑块
    const compareEl = document.getElementById('compare');
    if (compareEl) {
      let dragging = false;
      const updatePos = (clientX: number) => {
        const rect = compareEl.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        state.comparePos = pct;
        const overlay = document.getElementById('compareOverlay');
        const divider = document.getElementById('compareDivider');
        if (overlay) overlay.style.width = `${pct}%`;
        if (divider) divider.style.left = `${pct}%`;
      };
      compareEl.addEventListener('mousedown', (e) => { dragging = true; updatePos(e.clientX); });
      window.addEventListener('mousemove', (e) => { if (dragging) updatePos(e.clientX); });
      window.addEventListener('mouseup', () => { dragging = false; });
      compareEl.addEventListener('touchstart', (e) => { dragging = true; if (e.touches[0]) updatePos(e.touches[0].clientX); });
      window.addEventListener('touchmove', (e) => { if (dragging && e.touches[0]) updatePos(e.touches[0].clientX); });
      window.addEventListener('touchend', () => { dragging = false; });
    }

    // 快捷旋转按钮
    document.querySelectorAll('.btn-mini[data-rotate]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.rotateDegrees = parseInt((btn as HTMLElement).dataset.rotate!, 10);
        render();
      });
    });

    // 输出按钮 + 翻转按钮（事件委托，因为按钮在 tabContent 里会被重新渲染）
    root.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const id = target.id || target.closest('button')?.id;
      if (id === 'btnOutputRun') await doOutput();
      else if (id === 'btnFlipH') { state.flipAxis = state.flipAxis === 'horizontal' ? '' : 'horizontal'; render(); }
      else if (id === 'btnFlipV') { state.flipAxis = state.flipAxis === 'vertical' ? '' : 'vertical'; render(); }
    });

    // 控件值变更
    root.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      const key = target.dataset.k;
      if (!key) return;
      let val: any;
      if ((target as HTMLInputElement).type === 'checkbox') {
        val = (target as HTMLInputElement).checked;
      } else if ((target as HTMLInputElement).type === 'range' || (target as HTMLInputElement).type === 'number') {
        val = parseFloat((target as HTMLInputElement).value) || 0;
      } else {
        val = (target as HTMLInputElement).value;
      }
      (state as any)[key] = val;
      if (key === 'rotateDegrees') {
        render();
      } else if (key === 'watermarkTile') {
        renderTabContent();
      } else if ((target as HTMLInputElement).type === 'range') {
        renderTabContent();
      }
    });
    root.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      const key = target.dataset.k;
      if (!key || (target as HTMLInputElement).type === 'range') return;
      let val: any;
      if ((target as HTMLInputElement).type === 'checkbox') {
        val = (target as HTMLInputElement).checked;
      } else if ((target as HTMLInputElement).type === 'number') {
        val = parseFloat((target as HTMLInputElement).value) || 0;
      } else {
        val = (target as HTMLInputElement).value;
      }
      (state as any)[key] = val;
      renderTabContent();
    });
  }

  async function handleFiles(files: FileList): Promise<void> {
    state.busy = true;
    const count = files.length;
    state.loadingText = `正在加载 ${count} 张图片…`;
    render();
    // 释放旧的 blob URL
    for (const s of state.sources) URL.revokeObjectURL(s.url);
    for (const r of state.results) { if (r) URL.revokeObjectURL(r.url); }
    state.sources = [];
    state.results = [];
    state.currentIndex = 0;
    state.exifData = null;

    for (let i = 0; i < count; i++) {
      try {
        const file = files[i];
        const bytes = new Uint8Array(await file.arrayBuffer());
        const blob = new Blob([bytes], { type: file.type });
        const url = URL.createObjectURL(blob);
        const img = await loadImage(blob);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const camera = extractExif(bytes);
        const fileSize = formatFileSize(file.size);
        state.sources.push({
          file,
          url,
          image: { data: imageData.data, width: img.width, height: img.height },
          fileSize,
          camera,
        });
        state.results.push(null as any);
        // 取第一张的 EXIF
        if (i === 0) {
          try { state.exifData = parseExif(bytes.buffer); } catch { state.exifData = null; }
        }
      } catch (err) {
        console.warn(`图片加载失败 (${files[i]})`, err);
      }
    }
    // 重置裁剪参数
    state.cropW = 0; state.cropH = 0;
    // 提取第一张的元信息
    if (state.sources.length > 0) {
      const { image } = state.sources[0];
      const meta = metadata({ data: image.data, width: image.width, height: image.height });
      state.sourceMeta = `平均亮度: ${meta.averageBrightness.toFixed(1)}${meta.hasAlpha ? ' · 含透明通道' : ''}`;
    }
    state.busy = false;
    render();
  }

  function loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
  function extractExif(bytes: Uint8Array): string {
    // JPEG EXIF: parse TIFF header for Make/Model
    if (bytes.length < 10 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return '';
    let pos = 2;
    while (pos < bytes.length - 4) {
      if (bytes[pos] === 0xFF && bytes[pos + 1] === 0xE1) {
        const len = (bytes[pos + 2] << 8) | bytes[pos + 3];
        const exifStart = pos + 4;
        const exifEnd = exifStart + len - 2;
        if (exifEnd > bytes.length) break;
        if (exifEnd - exifStart < 14) break;
        const exifId = String.fromCharCode(bytes[exifStart], bytes[exifStart + 1], bytes[exifStart + 2], bytes[exifStart + 3]);
        if (exifId !== 'Exif') break;
        const tiffStart = exifStart + 6;
        const bigEndian = bytes[tiffStart] === 0x4D;
        const read16 = (p: number) => bigEndian ? (bytes[p] << 8) | bytes[p + 1] : bytes[p] | (bytes[p + 1] << 8);
        const read32 = (p: number) => bigEndian
          ? (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]
          : bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
        let ifd0 = read32(tiffStart + 4);
        if (ifd0 + tiffStart + 2 > exifEnd) break;
        ifd0 += tiffStart;
        const entryCount = read16(ifd0);
        let make = '', model = '';
        for (let i = 0; i < entryCount && ifd0 + 2 + i * 12 + 12 <= exifEnd; i++) {
          const p = ifd0 + 2 + i * 12;
          const tag = read16(p);
          const type = read16(p + 2);
          const count = read32(p + 4);
          const valueOffset = read32(p + 8);
          if (tag === 0x010F) make = readStr(bytes, tiffStart, exifEnd, bigEndian, type, count, valueOffset);
          if (tag === 0x0110) model = readStr(bytes, tiffStart, exifEnd, bigEndian, type, count, valueOffset);
        }
        if (make && model) return `${make} ${model}`;
        if (model) return model;
        if (make) return make;
        return '';
      }
      pos++;
    }
    return '';
  }

  function readStr(bytes: Uint8Array, tiffStart: number, exifEnd: number, bigEndian: boolean, type: number, count: number, offset: number): string {
    if (type !== 2) return '';
    if (count <= 4) {
      let s = '';
      for (let i = 0; i < count - 1; i++) {
        const c = ((offset >> (i * 8)) & 0xFF);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    }
    const strStart = tiffStart + offset;
    const strEnd = Math.min(strStart + count - 1, exifEnd);
    let s = '';
    for (let i = strStart; i < strEnd; i++) {
      if (bytes[i] === 0) break;
      s += String.fromCharCode(bytes[i]);
    }
    return s;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function getCropOpts(): CropOptions | null {
    const src = getSource();
    if (!src) return null;
    const { cropX, cropY, cropW, cropH, cropRatio } = state;
    if (cropRatio) {
      const parts = cropRatio.split('/').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        return { aspectRatio: parts[0] / parts[1], align: state.cropAlign };
      }
    }
    if (cropW > 0 && cropH > 0) {
      return { x: cropX, y: cropY, width: cropW, height: cropH };
    }
    return null;
  }

  function getResizeOpts(): ResizeOptions | null {
    if (state.resizeW <= 0 && state.resizeH <= 0) return null;
    return {
      width: state.resizeW > 0 ? state.resizeW : undefined,
      height: state.resizeH > 0 ? state.resizeH : undefined,
      fit: state.resizeFit,
      algorithm: state.resizeAlgorithm,
    };
  }

  function getFilterOpts(): FilterOptions {
    return {
      grayscale: state.filterGrayscale,
      sepia: state.filterSepia,
      brightness: state.filterBrightness,
      contrast: state.filterContrast,
      saturate: state.filterSaturate,
      hueRotate: state.filterHueRotate,
      blur: state.filterBlur,
      invert: state.filterInvert,
      opacity: state.filterOpacity,
    };
  }

  function hasFilterOpts(): boolean {
    const f = getFilterOpts();
    return !!(f.grayscale || f.sepia || f.brightness || f.contrast || f.saturate || f.hueRotate || f.blur || f.invert || f.opacity);
  }

  function createTextRenderer() {
    return {
      renderText(text: string, options: { font: string; color: string; rotate?: number }): ImageDataLike {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const fontSize = parseInt(options.font, 10) || 24;
        const rotate = options.rotate ?? 0;
        const rad = (rotate * Math.PI) / 180;

        ctx.font = options.font;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize * 1.2;

        // 计算旋转后的包围盒
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        const bw = textWidth * cos + textHeight * sin;
        const bh = textWidth * sin + textHeight * cos;

        canvas.width = Math.ceil(bw) + 4;
        canvas.height = Math.ceil(bh) + 4;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.font = options.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = options.color;
        ctx.fillText(text, 0, 0);

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      },
    };
  }

  async function getProcessedImageData(): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
    const res = getResult();
    if (!res) {
      // 没有处理结果，用原图
      const src = getSource();
      if (!src) return null;
      return { data: src.image.data, width: src.image.width, height: src.image.height };
    }
    // 从 result URL 重新加载
    const img = await loadImage(new Blob([await (await fetch(res.url)).arrayBuffer()]));
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    return { data: imgData.data, width: img.width, height: img.height };
  }

  async function doOutput() {
    const imgData = await getProcessedImageData();
    if (!imgData) return;
    state.busy = true;
    state.loadingText = '处理中…';
    render();
    try {
      // 先格式转换
      const converted = await convert(imgData, state.outputFormat, state.outputQuality);
      // 再压缩
      const convertedData = await loadImageData(converted);
      const opts: any = { mimeType: state.outputFormat };
      if (state.compressionMode === 'quality') {
        opts.quality = state.outputQuality;
      } else {
        opts.maxSize = (state.outputMaxSize || 50) * 1024;
      }
      const result = await compress(convertedData, opts);
      const url = URL.createObjectURL(result.blob);
      const metaParts = [`${state.outputFormat}`, `${(result.size / 1024).toFixed(1)}KB`];
      if (state.compressionMode === 'quality') {
        metaParts.push(`quality=${result.quality.toFixed(2)}`);
      }
      if (state.results[state.currentIndex]) URL.revokeObjectURL(state.results[state.currentIndex].url);
      state.results[state.currentIndex] = { url, meta: metaParts.join(' · ') };
    } catch (e) {
      console.error('处理失败', e);
      alert('处理失败');
    }
    state.busy = false;
    render();
  }

  async function loadImageData(blob: Blob): Promise<ImageDataLike> {
    const img = await loadImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
  }

  function run() {
    if (state.sources.length === 0) return;
    // 批量处理所有图片
    for (let idx = 0; idx < state.sources.length; idx++) {
      const src = state.sources[idx];
      let data = src.image.data;
      let w = src.image.width;
      let h = src.image.height;
      const steps: string[] = [];

      // 裁剪
      const cropOpts = getCropOpts();
      if (cropOpts) {
        try {
          const r = crop({ data, width: w, height: h }, cropOpts);
          data = r.data; w = r.width; h = r.height;
          steps.push('裁剪');
        } catch (e) {
          steps.push('裁剪(跳过)');
        }
      }

      // 缩放
      const rOpts = getResizeOpts();
      if (rOpts) {
        const r = resize({ data, width: w, height: h }, rOpts);
        data = r.data; w = r.width; h = r.height;
        steps.push('缩放');
      }

      // 旋转
      if (state.rotateDegrees !== 0) {
        const r = rotate({ data, width: w, height: h }, state.rotateDegrees);
        data = r.data; w = r.width; h = r.height;
        steps.push('旋转');
      }

      // 翻转
      if (state.flipAxis) {
        const r = flip({ data, width: w, height: h }, state.flipAxis as FlipAxis);
        data = r.data; w = r.width; h = r.height;
        steps.push('翻转');
      }

      // 滤镜
      if (hasFilterOpts()) {
        const r = filter({ data, width: w, height: h }, getFilterOpts());
        data = r.data; w = r.width; h = r.height;
        steps.push('滤镜');
      }

      // 水印
      if (state.watermarkText) {
        const wmOpts: WatermarkOptions = {
          text: state.watermarkText,
          position: state.watermarkPos,
          opacity: state.watermarkOpacity,
          font: `${state.watermarkFontSize}px sans-serif`,
          color: state.watermarkColor,
          rotate: state.watermarkRotate,
          tile: state.watermarkTile,
          tileGap: state.watermarkTileGap,
        };
        const textRenderer = createTextRenderer();
        const r = watermark({ data, width: w, height: h }, wmOpts, textRenderer);
        data = r.data; w = r.width; h = r.height;
        steps.push('水印');
      }

      if (steps.length === 0) {
        alert('请至少设置一项处理参数');
        return;
      }

      // 生成结果预览
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(data, w, h), 0, 0);
      const url = canvas.toDataURL('image/png');

      if (state.results[idx]) URL.revokeObjectURL(state.results[idx].url);
      const meta = metadata({ data, width: w, height: h });
      state.results[idx] = {
        url,
        meta: `处理步骤：${steps.join(' → ')} · 结果尺寸：${w}×${h}px · 平均亮度：${meta.averageBrightness.toFixed(1)}${meta.hasAlpha ? ' · 含透明通道' : ''}`,
      };
    }
    render();
  }

  function revokeBlobUrl(url: string): void {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  return { render };
}