import { crop, resize, rotate, flip, filter, watermark, metadata, compress, convert, parseExif } from 'imgkit';
import type { ImageDataLike, CropOptions, ResizeOptions, FilterOptions, FlipAxis, FitMode, ResizeAlgorithm, WatermarkOptions, ExifInfo, ImageMimeType } from 'imgkit';
import { Position } from 'imgkit';

declare var JSZip: any;

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

interface Step {
  name: string;
  fn: (img: ImageDataLike) => ImageDataLike;
}

class Pipeline {
  steps: Step[] = [];
  private undoStack: Step[][] = [];
  private redoStack: Step[][] = [];

  add(s: Step) {
    this.undoStack.push([...this.steps]);
    this.redoStack = [];
    this.steps.push(s);
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push([...this.steps]);
    this.steps = this.undoStack.pop()!;
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push([...this.steps]);
    this.steps = this.redoStack.pop()!;
    return true;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  names() { return this.steps.map(s => s.name); }
  isEmpty() { return this.steps.length === 0; }

  apply(img: ImageDataLike): ImageDataLike {
    let cur = img;
    for (const s of this.steps) cur = s.fn(cur);
    return cur;
  }
}

interface State {
  sources: (SourceItem | null)[];
  results: ResultItem[];
  currentIndex: number;
  sourceMeta: string;
  busy: boolean;
  loadingText: string;
  activeTab: 'crop' | 'resize' | 'rotate' | 'filter' | 'watermark' | 'output';
  enabledOps: Set<string>;
  previewMode: 'single' | 'compare';
  comparePos: number;
  runError: string;
  pipeline: Pipeline | null;
  // crop — 每张图片独立选区
  cropRegions: { x: number; y: number; w: number; h: number }[];
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
  watermarkFontFamily: string;
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
    enabledOps: new Set(),
    previewMode: 'single',
    comparePos: 50,
    runError: '',
    pipeline: null,
    cropRegions: [],
    cropRatio: '', cropAlign: Position.Center,
    resizeW: 0, resizeH: 0, resizeFit: 'contain', resizeAlgorithm: 'bilinear',
    rotateDegrees: 0, flipAxis: '',
    filterGrayscale: 0, filterSepia: 0, filterBrightness: 0,
    filterContrast: 0, filterSaturate: 0, filterHueRotate: 0,
    filterBlur: 0, filterInvert: 0, filterOpacity: 0,
    watermarkText: '', watermarkTile: false, watermarkPos: Position.BottomRight,
    watermarkOpacity: 0.5, watermarkFontSize: 32, watermarkFontFamily: 'sans-serif', watermarkColor: '#ffffff',
    watermarkRotate: 0, watermarkTileGap: 40,
    outputFormat: 'image/jpeg', outputQuality: 0.8, outputMaxSize: 0,
    compressionMode: 'quality',
    exifData: null,
  };

  let _cropCleanup: (() => void) | null = null;

  function getSource(): SourceItem | null {
    return state.sources[state.currentIndex] ?? null;
  }
  function getResult(): ResultItem | null {
    return state.results[state.currentIndex] ?? null;
  }

  function cr(i?: number) {
    const idx = i ?? state.currentIndex;
    if (!state.cropRegions[idx]) state.cropRegions[idx] = { x: 0, y: 0, w: 0, h: 0 };
    return state.cropRegions[idx];
  }

  function render() {
    const hasSource = state.sources.some((s) => s !== null);
    const src = getSource();
    const srcUrl = src?.url ?? '';
    const res = getResult();
    const resUrl = res?.url ?? '';
    const resMeta = res?.meta ?? '';
    const fileName = src?.file?.name ?? '';

    const sourcePreviewHtml = hasSource
      ? `<div class="thumb-strip">
           ${state.sources.map((s, i) => {
             if (!s) return '';
             const sel = i === state.currentIndex ? ' selected' : '';
             return `<div class="thumb-item${sel}" data-idx="${i}">
               <img src="${s.url}" alt="${s.file.name}" />
               <button class="thumb-del" data-del="${i}" title="删除">×</button>
               <span class="thumb-name">${s.file.name}</span>
               <span class="thumb-meta">${s.fileSize} · ${s.image.width}×${s.image.height}px</span>
             </div>`;
           }).join('')}
         </div>
         <div class="preview-thumb"><img src="${srcUrl}" alt="source" /></div>
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
            ${state.results.filter(r => r).length > 1 ? `<button class="btn" id="btnDownloadAll">下载全部 (ZIP)</button>` : ''}
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
        resMeta ? `<div class="result-info">
          <span class="result-meta-text">${resMeta}</span>
          ${state.pipeline && (state.pipeline.canUndo() || state.pipeline.canRedo()) ? `
          <span class="result-actions">
            <button class="btn-undo-redo" id="btnUndo" ${state.pipeline.canUndo() ? '' : 'disabled'}>↩ 撤销</button>
            <button class="btn-undo-redo" id="btnRedo" ${state.pipeline.canRedo() ? '' : 'disabled'}>↪ 重做</button>
          </span>` : ''}
        </div>` : ''
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
                .map((t) => `<div class="tab ${state.activeTab === t ? 'active' : ''}" data-tab="${t}">${t !== 'output' && state.enabledOps.has(t) ? '<span class="tab-dot"></span>' : ''}${labelOf(t)}</div>`)
                .join('')}
            </div>
            <div id="tabContent"></div>
            ${state.runError ? `<div class="run-error">${state.runError}</div>` : ''}
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
    if (state.activeTab === 'crop') initCropPreview();
    bind();
  }

  function renderTabContent() {
    const el = document.getElementById('tabContent');
    if (!el) return;
    const t = state.activeTab;
    if (t === 'crop') {
      const src = getSource();
      const srcUrl = src?.url ?? '';
      const c = cr();
      const hasSel = c.w > 0 && c.h > 0;
      el.innerHTML = `
        <div class="crop-grid">
          <div class="control full"><label class="enable-step"><input type="checkbox" data-op="crop" ${state.enabledOps.has('crop') ? 'checked' : ''} /> 启用此步骤</label></div>
          <div class="crop-grid-inner${state.enabledOps.has('crop') ? '' : ' disabled'}" data-op-group="crop">
          <div class="control"><label>X 偏移 (px)</label><input type="number" value="${c.x}" data-k="cropX" min="0" /></div>
          <div class="control"><label>Y 偏移 (px)</label><input type="number" value="${c.y}" data-k="cropY" min="0" /></div>
          <div class="control"><label>宽度 (px，0=自动)</label><input type="number" value="${c.w}" data-k="cropW" min="0" /></div>
          <div class="control"><label>高度 (px，0=自动)</label><input type="number" value="${c.h}" data-k="cropH" min="0" /></div>
          <div class="control full"><label>宽高比（如 16:9 填 16/9，留空则按坐标裁剪）</label><input type="text" value="${state.cropRatio}" data-k="cropRatio" placeholder="例: 16/9" /></div>
          <div class="control full"><label>对齐方式（宽高比裁剪时生效）</label>
            <select data-k="cropAlign">
              ${Object.values(Position).map((p) => `<option value="${p}" ${state.cropAlign === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div></div>
        ${srcUrl ? `
        <div class="crop-visual">
          <div class="crop-preview" id="cropPreview">
            <img src="${srcUrl}" alt="crop preview" id="cropImg" draggable="false" />
            <div class="crop-rect" id="cropRect"${hasSel ? '' : ' style="display:none"'}</div>
            <button class="crop-expand-btn" id="btnCropExpand" title="全屏框选">⛶</button>
          </div>
          <div class="crop-info-bar">
            <span class="crop-info" id="cropInfoText">${hasSel ? `选区: ${c.w}×${c.h} (${c.x}, ${c.y})` : '在图片上拖拽框选裁剪区域'}</span>
            <span class="crop-warning" id="cropWarning" style="display:none"></span>
            ${hasSel ? '<button class="btn-clear-crop" id="btnClearCrop">清除选区</button>' : ''}
            <button class="btn-crop-expand-text" id="btnCropExpand2">全屏框选</button>
          </div>
        </div>` : ''}`;
    } else if (t === 'resize') {
      el.innerHTML = `
        <div class="controls">
          <div class="control full"><label class="enable-step"><input type="checkbox" data-op="resize" ${state.enabledOps.has('resize') ? 'checked' : ''} /> 启用此步骤</label></div>
          <div${state.enabledOps.has('resize') ? '' : ' class="disabled"'} data-op-group="resize">
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
        </div></div>`;
    } else if (t === 'rotate') {
      el.innerHTML = `
        <div class="controls">
          <div class="control full"><label class="enable-step"><input type="checkbox" data-op="rotate" ${state.enabledOps.has('rotate') ? 'checked' : ''} /> 启用此步骤</label></div>
          <div${state.enabledOps.has('rotate') ? '' : ' class="disabled"'} data-op-group="rotate">
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
        </div></div></div>`;
    } else if (t === 'filter') {
      el.innerHTML = `
        <div class="controls">
          <div class="control full"><label class="enable-step"><input type="checkbox" data-op="filter" ${state.enabledOps.has('filter') ? 'checked' : ''} /> 启用此步骤</label></div>
          <div${state.enabledOps.has('filter') ? '' : ' class="disabled"'} data-op-group="filter">
          <div class="control"><label>灰度 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterGrayscale}" data-k="filterGrayscale" /></div>
          <div class="control"><label>棕褐 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterSepia}" data-k="filterSepia" /></div>
          <div class="control"><label>亮度 (-1~1)</label><input type="range" min="-1" max="1" step="0.05" value="${state.filterBrightness}" data-k="filterBrightness" /></div>
          <div class="control"><label>对比度 (-1~1)</label><input type="range" min="-1" max="1" step="0.05" value="${state.filterContrast}" data-k="filterContrast" /></div>
          <div class="control"><label>饱和度 (-1~1)</label><input type="range" min="-1" max="1" step="0.05" value="${state.filterSaturate}" data-k="filterSaturate" /></div>
          <div class="control"><label>色相旋转 (deg)</label><input type="range" min="0" max="360" step="1" value="${state.filterHueRotate}" data-k="filterHueRotate" /></div>
          <div class="control"><label>高斯模糊 (px)</label><input type="range" min="0" max="10" step="0.5" value="${state.filterBlur}" data-k="filterBlur" /></div>
          <div class="control"><label>反相 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterInvert}" data-k="filterInvert" /></div>
          <div class="control"><label>透明度 (0-1)</label><input type="range" min="0" max="1" step="0.05" value="${state.filterOpacity}" data-k="filterOpacity" /></div>
        </div></div>`;
    } else if (t === 'watermark') {
      el.innerHTML = `
        <div class="controls">
          <div class="control full"><label class="enable-step"><input type="checkbox" data-op="watermark" ${state.enabledOps.has('watermark') ? 'checked' : ''} /> 启用此步骤</label></div>
          <div${state.enabledOps.has('watermark') ? '' : ' class="disabled"'} data-op-group="watermark">
          <div class="control"><label>水印文字</label><input type="text" value="${state.watermarkText}" data-k="watermarkText" placeholder="例如: © imgkit" /></div>
          <div class="control"><label>平铺模式</label><input type="checkbox" data-k="watermarkTile" ${state.watermarkTile ? 'checked' : ''} /></div>
          <div class="control"><label>位置</label>
            <select data-k="watermarkPos">
              ${Object.values(Position).map((p) => `<option value="${p}" ${state.watermarkPos === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="control"><label>透明度</label><input type="range" min="0.05" max="1" step="0.05" value="${state.watermarkOpacity}" data-k="watermarkOpacity" /></div>
          <div class="control"><label>字体大小</label><input type="number" min="8" max="200" value="${state.watermarkFontSize}" data-k="watermarkFontSize" /></div>
          <div class="control"><label>字体族</label>
            <select data-k="watermarkFontFamily">
              <option value="sans-serif" ${state.watermarkFontFamily === 'sans-serif' ? 'selected' : ''}>sans-serif</option>
              <option value="serif" ${state.watermarkFontFamily === 'serif' ? 'selected' : ''}>serif</option>
              <option value="monospace" ${state.watermarkFontFamily === 'monospace' ? 'selected' : ''}>monospace</option>
              <option value="cursive" ${state.watermarkFontFamily === 'cursive' ? 'selected' : ''}>cursive</option>
              <option value="fantasy" ${state.watermarkFontFamily === 'fantasy' ? 'selected' : ''}>fantasy</option>
              <option value="Arial" ${state.watermarkFontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
              <option value="Georgia" ${state.watermarkFontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
              <option value="Impact" ${state.watermarkFontFamily === 'Impact' ? 'selected' : ''}>Impact</option>
            </select>
          </div>
          <div class="control"><label>颜色</label><input type="color" value="${state.watermarkColor}" data-k="watermarkColor" /></div>
          <div class="control"><label>旋转角度</label><input type="number" min="-180" max="180" value="${state.watermarkRotate}" data-k="watermarkRotate" /></div>
          ${state.watermarkTile ? `<div class="control"><label>平铺间距</label><input type="number" min="0" max="500" value="${state.watermarkTileGap}" data-k="watermarkTileGap" /></div>` : ''}
        </div></div>`;
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

  function initCropPreview() {
    const preview = document.getElementById('cropPreview');
    const img = document.getElementById('cropImg') as HTMLImageElement | null;
    const rect = document.getElementById('cropRect');
    if (!preview || !img || !rect) return;

    // 清理上次的 window 监听
    if (_cropCleanup) { _cropCleanup(); _cropCleanup = null; }

    function setupExistingRect() {
      const c = cr();
      if (c.w > 0 && c.h > 0) {
        drawCropRect(rect, img!);
        checkCropSize();
      }
    }
    if (img.complete && img.naturalWidth > 0) {
      setupExistingRect();
    } else {
      img.addEventListener('load', setupExistingRect, { once: true });
    }

    let drawing = false;
    let sx = 0, sy = 0;

    function imgDisplayRect() {
      const r = img!.getBoundingClientRect();
      const natW = img!.naturalWidth, natH = img!.naturalHeight;
      const cW = r.width, cH = r.height;
      const natRatio = natW / natH;
      const cRatio = cW / cH;
      let dw: number, dh: number, ox: number, oy: number;
      if (natRatio > cRatio) {
        dw = cW; dh = cW / natRatio; ox = 0; oy = (cH - dh) / 2;
      } else {
        dh = cH; dw = cH * natRatio; ox = (cW - dw) / 2; oy = 0;
      }
      return { left: r.left + ox, top: r.top + oy, width: dw, height: dh, scaleX: natW / dw, scaleY: natH / dh };
    }

    function onDown(e: MouseEvent) {
      drawing = true;
      const d = imgDisplayRect();
      sx = Math.max(0, Math.min(d.width, e.clientX - d.left));
      sy = Math.max(0, Math.min(d.height, e.clientY - d.top));
      rect.style.display = 'block';
      rect.style.left = sx + 'px';
      rect.style.top = sy + 'px';
      rect.style.width = '0px';
      rect.style.height = '0px';
      e.preventDefault();
    }

    function onMove(e: MouseEvent) {
      if (!drawing) return;
      const d = imgDisplayRect();
      const cx = Math.max(0, Math.min(d.width, e.clientX - d.left));
      const cy = Math.max(0, Math.min(d.height, e.clientY - d.top));
      const rx = Math.min(sx, cx), ry = Math.min(sy, cy);
      const rw = Math.abs(cx - sx), rh = Math.abs(cy - sy);
      rect.style.left = rx + 'px';
      rect.style.top = ry + 'px';
      rect.style.width = rw + 'px';
      rect.style.height = rh + 'px';
    }

    function onUp(_e: MouseEvent) {
      if (!drawing) return;
      drawing = false;
      const d = imgDisplayRect();
      const rLeft = parseFloat(rect.style.left) || 0;
      const rTop = parseFloat(rect.style.top) || 0;
      const rW = parseFloat(rect.style.width) || 0;
      const rH = parseFloat(rect.style.height) || 0;
      if (rW < 5 || rH < 5) {
        rect.style.display = 'none';
        return;
      }
      const c = cr();
      c.x = Math.round(rLeft * d.scaleX);
      c.y = Math.round(rTop * d.scaleY);
      c.w = Math.round(rW * d.scaleX);
      c.h = Math.round(rH * d.scaleY);
      state.runError = '';
      syncCropInputs();
      updateCropInfo();
      checkCropSize();
      showClearBtn();
    }

    preview.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    _cropCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }

  function drawCropRect(rect: HTMLElement, img: HTMLImageElement) {
    const r = img.getBoundingClientRect();
    const natW = img.naturalWidth, natH = img.naturalHeight;
    const cW = r.width, cH = r.height;
    const natRatio = natW / natH;
    const cRatio = cW / cH;
    let dw: number, dh: number, ox: number, oy: number;
    if (natRatio > cRatio) {
      dw = cW; dh = cW / natRatio; ox = 0; oy = (cH - dh) / 2;
    } else {
      dh = cH; dw = cH * natRatio; ox = (cW - dw) / 2; oy = 0;
    }
    const scaleX = dw / natW, scaleY = dh / natH;
    const c = cr();
    rect.style.display = 'block';
    rect.style.left = (c.x * scaleX) + 'px';
    rect.style.top = (c.y * scaleY) + 'px';
    rect.style.width = (c.w * scaleX) + 'px';
    rect.style.height = (c.h * scaleY) + 'px';
  }

  function refreshCropOverlay() {
    const img = document.getElementById('cropImg') as HTMLImageElement | null;
    const rect = document.getElementById('cropRect');
    if (!img || !rect) return;
    const c = cr();
    if (c.w > 0 && c.h > 0) {
      drawCropRect(rect, img);
    } else {
      rect.style.display = 'none';
    }
    updateCropInfo();
    checkCropSize();
    showClearBtn();
    syncCropInputs();
  }

  function syncCropInputs() {
    const c = cr();
    const map: Record<string, number> = { cropX: c.x, cropY: c.y, cropW: c.w, cropH: c.h };
    for (const [k, v] of Object.entries(map)) {
      const el = document.querySelector(`[data-k="${k}"]`) as HTMLInputElement | null;
      if (el) el.value = String(v);
    }
  }

  function updateCropInfo() {
    const info = document.getElementById('cropInfoText');
    if (!info) return;
    const c = cr();
    if (c.w > 0 && c.h > 0) {
      info.textContent = `选区: ${c.w}×${c.h} (${c.x}, ${c.y})`;
    } else {
      info.textContent = '在图片上拖拽框选裁剪区域';
    }
  }

  function checkCropSize() {
    const warn = document.getElementById('cropWarning');
    if (!warn) return;
    const src = getSource();
    const c = cr();
    if (!src || c.w <= 0 || c.h <= 0) {
      warn.style.display = 'none';
      return;
    }
    const area = c.w * c.h;
    const total = src.image.width * src.image.height;
    if (area < total * 0.01) {
      warn.style.display = '';
      warn.textContent = '选区面积小于图片的 1%，可能影响裁剪效果';
    } else {
      warn.style.display = 'none';
    }
  }

  function showClearBtn() {
    const bar = document.querySelector('.crop-info-bar');
    if (!bar) return;
    const existing = document.getElementById('btnClearCrop');
    const c = cr();
    if (c.w > 0 && c.h > 0) {
      if (!existing) {
        const btn = document.createElement('button');
        btn.className = 'btn-clear-crop';
        btn.id = 'btnClearCrop';
        btn.textContent = '清除选区';
        bar.appendChild(btn);
      }
    } else {
      if (existing) existing.remove();
    }
  }

  function clearCropSelection() {
    const c = cr();
    c.x = 0; c.y = 0; c.w = 0; c.h = 0;
    state.runError = '';
    const rect = document.getElementById('cropRect');
    if (rect) rect.style.display = 'none';
    updateCropInfo();
    checkCropSize();
    showClearBtn();
    syncCropInputs();
  }

  async function downloadAllAsZip() {
    const results = state.results.filter(r => r);
    if (results.length === 0) return;

    const btn = document.getElementById('btnDownloadAll');
    if (btn) btn.textContent = '打包中...';

    const zip = new (JSZip as any)();
    const fetches = results.map(async (res, i) => {
      const src = state.sources[i];
      const name = src ? src.file.name.replace(/\.[^.]+$/, '') : `img${i + 1}`;
      const resp = await fetch(res.url);
      const blob = await resp.blob();
      zip.file(`${name}.png`, blob);
    });
    await Promise.all(fetches);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imgkit-results-${state.results.length}p.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (btn) btn.textContent = '下载全部 (ZIP)';
  }

  function openImageViewer(startIdx: number) {
    const total = state.sources.length;
    if (total === 0) return;

    let idx = startIdx;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;

    const ov = document.createElement('div');
    ov.className = 'img-viewer';
    ov.innerHTML = `
      <div class="iv-backdrop"></div>
      <button class="iv-close" title="关闭 (ESC)">&times;</button>
      <div class="iv-toolbar">
        <button class="iv-zoom-btn" data-zoom="out" title="缩小">&minus;</button>
        <span class="iv-zoom-pct">100%</span>
        <button class="iv-zoom-btn" data-zoom="in" title="放大">+</button>
        <button class="iv-zoom-btn" data-zoom="reset" title="重置">1:1</button>
      </div>
      <div class="iv-stage">
        <img class="iv-img" src="" alt="" draggable="false" />
      </div>
      ${total > 1 ? `
      <div class="iv-nav">
        <button class="iv-nav-btn iv-prev" title="上一张 (←)">◀</button>
        <span class="iv-counter">${idx + 1} / ${total}</span>
        <button class="iv-nav-btn iv-next" title="下一张 (→)">▶</button>
      </div>` : ''}
    `;
    document.body.appendChild(ov);

    const img = ov.querySelector('.iv-img') as HTMLImageElement;
    const pctEl = ov.querySelector('.iv-zoom-pct') as HTMLElement;
    const counterEl = ov.querySelector('.iv-counter') as HTMLElement;

    function loadImage() {
      const src = state.sources[idx];
      if (!src) return;
      const res = state.results[idx];
      img.src = res ? res.url : src.url;
      img.alt = src.file.name;
      // 重置缩放和平移
      zoom = 1;
      panX = 0;
      panY = 0;
      applyTransform();
      if (counterEl) counterEl.textContent = `${idx + 1} / ${total}`;
    }

    function applyTransform() {
      img.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
      pctEl.textContent = `${Math.round(zoom * 100)}%`;
    }

    function zoomIn() { zoom = Math.min(zoom * 1.2, 8); applyTransform(); }
    function zoomOut() { zoom = Math.max(zoom / 1.2, 0.2); applyTransform(); }
    function zoomReset() { zoom = 1; panX = 0; panY = 0; applyTransform(); }

    // 缩放按钮
    ov.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-zoom]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.zoom;
      if (action === 'in') zoomIn();
      else if (action === 'out') zoomOut();
      else if (action === 'reset') zoomReset();
    });

    // 滚轮缩放
    ov.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }, { passive: false });

    // 拖拽平移
    img.addEventListener('mousedown', (e) => {
      if (zoom <= 1) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = panX;
      panStartY = panY;
      img.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      img.style.cursor = zoom > 1 ? 'grab' : 'default';
    });

    // 导航按钮
    if (total > 1) {
      ov.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.iv-prev, .iv-next') as HTMLElement | null;
        if (!btn) return;
        if (btn.classList.contains('iv-prev')) idx = (idx - 1 + total) % total;
        else idx = (idx + 1) % total;
        loadImage();
      });
    }

    // 键盘
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); return; }
      if (total > 1) {
        if (e.key === 'ArrowLeft') { idx = (idx - 1 + total) % total; loadImage(); }
        if (e.key === 'ArrowRight') { idx = (idx + 1) % total; loadImage(); }
      }
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') zoomReset();
    }
    window.addEventListener('keydown', onKey);

    // 关闭
    function close() {
      window.removeEventListener('keydown', onKey);
      ov.remove();
    }
    ov.querySelector('.iv-close')!.addEventListener('click', close);
    ov.querySelector('.iv-backdrop')!.addEventListener('click', close);

    loadImage();
  }

  function openCropLightbox() {
    const src = getSource();
    if (!src) return;

    const existing = document.getElementById('cropLightbox');
    if (existing) existing.remove();

    const c = cr();
    const hasSel = c.w > 0 && c.h > 0;

    const lb = document.createElement('div');
    lb.className = 'crop-lightbox';
    lb.id = 'cropLightbox';
    lb.innerHTML = `
      <div class="crop-lb-mask"></div>
      <div class="crop-lb-panel">
        <div class="crop-lb-toolbar">
          <span class="crop-lb-info" id="cropLbInfo">${hasSel ? `选区: ${c.w}×${c.h} (${c.x}, ${c.y})` : '在图片上拖拽框选裁剪区域'}</span>
          <button class="crop-lb-clear" id="cropLbClear">清除</button>
          <button class="crop-lb-close" id="cropLbClose">&times;</button>
        </div>
        <div class="crop-lb-stage" id="cropLbStage">
          <img src="${src.url}" id="cropLbImg" draggable="false" />
          <div class="crop-lb-rect" id="cropLbRect"${hasSel ? '' : ' style="display:none"'}</div>
        </div>
      </div>`;
    document.body.appendChild(lb);

    const img = document.getElementById('cropLbImg') as HTMLImageElement;
    const rect = document.getElementById('cropLbRect') as HTMLElement;
    const stage = document.getElementById('cropLbStage') as HTMLElement;
    const info = document.getElementById('cropLbInfo') as HTMLElement;
    const mask = lb.querySelector('.crop-lb-mask') as HTMLElement;

    // 转发 cr() 引用，灯箱关闭前不污染 state（用临时变量，关闭时一次性写入）
    let tmpX = c.x, tmpY = c.y, tmpW = c.w, tmpH = c.h;

    function stageImgRect() {
      const r = img.getBoundingClientRect();
      const natW = img.naturalWidth, natH = img.naturalHeight;
      const cW = r.width, cH = r.height;
      const natRatio = natW / natH;
      const cRatio = cW / cH;
      let dw: number, dh: number, ox: number, oy: number;
      if (natRatio > cRatio) {
        dw = cW; dh = cW / natRatio; ox = 0; oy = (cH - dh) / 2;
      } else {
        dh = cH; dw = cH * natRatio; ox = (cW - dw) / 2; oy = 0;
      }
      return { left: r.left + ox, top: r.top + oy, width: dw, height: dh, scaleX: natW / dw, scaleY: natH / dh };
    }

    function drawLbRect() {
      if (tmpW <= 0 || tmpH <= 0) { rect.style.display = 'none'; return; }
      const r = img.getBoundingClientRect();
      const natW = img.naturalWidth, natH = img.naturalHeight;
      const cW = r.width, cH = r.height;
      const natRatio = natW / natH;
      const cRatio = cW / cH;
      let dw: number, dh: number, ox: number, oy: number;
      if (natRatio > cRatio) {
        dw = cW; dh = cW / natRatio; ox = 0; oy = (cH - dh) / 2;
      } else {
        dh = cH; dw = cH * natRatio; ox = (cW - dw) / 2; oy = 0;
      }
      const sx = dw / natW, sy = dh / natH;
      rect.style.display = 'block';
      rect.style.left = (tmpX * sx) + 'px';
      rect.style.top = (tmpY * sy) + 'px';
      rect.style.width = (tmpW * sx) + 'px';
      rect.style.height = (tmpH * sy) + 'px';
    }

    function updateLbInfo() {
      if (tmpW > 0 && tmpH > 0) {
        info.textContent = `选区: ${tmpW}×${tmpH} (${tmpX}, ${tmpY})`;
      } else {
        info.textContent = '在图片上拖拽框选裁剪区域';
      }
    }

    function commitAndClose() {
      c.x = tmpX; c.y = tmpY; c.w = tmpW; c.h = tmpH;
      state.runError = '';
      lb.remove();
      syncCropInputs();
      updateCropInfo();
      checkCropSize();
      showClearBtn();
      // 刷新内嵌预览的矩形
      const inlineRect = document.getElementById('cropRect');
      const inlineImg = document.getElementById('cropImg') as HTMLImageElement | null;
      if (inlineRect && inlineImg && tmpW > 0 && tmpH > 0) drawCropRect(inlineRect, inlineImg);
      else if (inlineRect) inlineRect.style.display = 'none';
    }

    // 已有选区时先画出来
    if (img.complete && img.naturalWidth > 0) {
      drawLbRect();
    } else {
      img.addEventListener('load', drawLbRect, { once: true });
    }

    let drawing = false;
    let sx = 0, sy = 0;

    stage.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.crop-lb-toolbar')) return;
      drawing = true;
      const d = stageImgRect();
      sx = Math.max(0, Math.min(d.width, e.clientX - d.left));
      sy = Math.max(0, Math.min(d.height, e.clientY - d.top));
      rect.style.display = 'block';
      rect.style.left = sx + 'px';
      rect.style.top = sy + 'px';
      rect.style.width = '0px';
      rect.style.height = '0px';
      e.preventDefault();
    });

    function onLbMove(e: MouseEvent) {
      if (!drawing) return;
      const d = stageImgRect();
      const cx = Math.max(0, Math.min(d.width, e.clientX - d.left));
      const cy = Math.max(0, Math.min(d.height, e.clientY - d.top));
      const rx = Math.min(sx, cx), ry = Math.min(sy, cy);
      const rw = Math.abs(cx - sx), rh = Math.abs(cy - sy);
      rect.style.left = rx + 'px';
      rect.style.top = ry + 'px';
      rect.style.width = rw + 'px';
      rect.style.height = rh + 'px';
    }

    function onLbUp(_e: MouseEvent) {
      if (!drawing) return;
      drawing = false;
      const d = stageImgRect();
      const rLeft = parseFloat(rect.style.left) || 0;
      const rTop = parseFloat(rect.style.top) || 0;
      const rW = parseFloat(rect.style.width) || 0;
      const rH = parseFloat(rect.style.height) || 0;
      if (rW < 5 || rH < 5) {
        rect.style.display = 'none';
        return;
      }
      tmpX = Math.round(rLeft * d.scaleX);
      tmpY = Math.round(rTop * d.scaleY);
      tmpW = Math.round(rW * d.scaleX);
      tmpH = Math.round(rH * d.scaleY);
      updateLbInfo();
    }

    window.addEventListener('mousemove', onLbMove);
    window.addEventListener('mouseup', onLbUp);

    function cleanup() {
      window.removeEventListener('mousemove', onLbMove);
      window.removeEventListener('mouseup', onLbUp);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { cleanup(); commitAndClose(); }
    }
    document.addEventListener('keydown', onKey);

    mask.addEventListener('click', () => { cleanup(); commitAndClose(); });
    document.getElementById('cropLbClose')?.addEventListener('click', () => { cleanup(); commitAndClose(); });
    document.getElementById('cropLbClear')?.addEventListener('click', () => {
      tmpX = 0; tmpY = 0; tmpW = 0; tmpH = 0;
      rect.style.display = 'none';
      updateLbInfo();
    });
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

    // 输出按钮 + 翻转按钮 + 缩略图 + 启用步骤（事件委托）
    root.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      // 点击预览图片 → 打开全屏灯箱
      if (target.tagName === 'IMG' && (target.closest('.preview-thumb') || target.closest('.compare-img'))) {
        openImageViewer(state.currentIndex);
        return;
      }
      // 全屏框选灯箱
      if (target.id === 'btnCropExpand' || target.id === 'btnCropExpand2' || target.closest('#btnCropExpand')) {
        openCropLightbox();
        return;
      }
      // 下载全部 ZIP
      if (target.id === 'btnDownloadAll' || target.closest('#btnDownloadAll')) {
        downloadAllAsZip();
        return;
      }
      // 撤销 / 重做
      if (target.id === 'btnUndo' || target.closest('#btnUndo')) {
        if (state.pipeline?.undo()) reapplyPipeline();
        return;
      }
      if (target.id === 'btnRedo' || target.closest('#btnRedo')) {
        if (state.pipeline?.redo()) reapplyPipeline();
        return;
      }
      // 清除裁剪选区
      if (target.id === 'btnClearCrop' || target.closest('#btnClearCrop')) {
        clearCropSelection();
        return;
      }
      // 启用步骤复选框
      if (target instanceof HTMLInputElement && target.type === 'checkbox' && target.dataset.op) {
        const op = target.dataset.op;
        if (target.checked) state.enabledOps.add(op);
        else state.enabledOps.delete(op);
        state.runError = '';
        renderTabContent();
        if (state.activeTab === 'crop') initCropPreview();
        return;
      }
      // 缩略图删除
      const delBtn = target.closest('.thumb-del');
      if (delBtn) {
        e.stopPropagation();
        const idx = parseInt((delBtn as HTMLElement).dataset.del!, 10);
        removeImage(idx);
        return;
      }
      // 缩略图切换
      const thumbItem = target.closest('.thumb-item');
      if (thumbItem) {
        const idx = parseInt((thumbItem as HTMLElement).dataset.idx!, 10);
        if (idx !== state.currentIndex) {
          state.currentIndex = idx;
          render();
        }
        return;
      }
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
      // crop 字段写入 cr()
      if (key === 'cropX') cr().x = val;
      else if (key === 'cropY') cr().y = val;
      else if (key === 'cropW') cr().w = val;
      else if (key === 'cropH') cr().h = val;
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
      if (key === 'cropX') cr().x = val;
      else if (key === 'cropY') cr().y = val;
      else if (key === 'cropW') cr().w = val;
      else if (key === 'cropH') cr().h = val;
      if (key.startsWith('crop')) {
        refreshCropOverlay();
      } else {
        renderTabContent();
      }
    });
  }

  async function handleFiles(files: FileList): Promise<void> {
    state.busy = true;
    let fileArray = Array.from(files);
    // 文件数量校验：10张上限
    const MAX_FILES = 10;
    if (fileArray.length > MAX_FILES) {
      alert(`最多支持 ${MAX_FILES} 张图片，已自动截取前 ${MAX_FILES} 张`);
      fileArray = fileArray.slice(0, MAX_FILES);
    }
    const count = fileArray.length;
    state.loadingText = `正在加载 ${count} 张图片…`;
    render();
    // 释放旧的 blob URL
    for (const s of state.sources) { if (s) URL.revokeObjectURL(s.url); }
    for (const r of state.results) { if (r) URL.revokeObjectURL(r.url); }
    // 预分配数组，失败时保持索引对齐
    state.sources = new Array(count).fill(null);
    state.results = new Array(count).fill(null as any);
    state.currentIndex = 0;
    state.exifData = null;

    // 批量并行加载
    const results = await Promise.allSettled(
      fileArray.map((file) => loadOneFile(file))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        state.sources[i] = r.value;
      } else {
        console.warn(`图片加载失败 (${fileArray[i]?.name})`, r.reason);
      }
    }
    // 取第一张成功加载的图片提取 EXIF
    const firstSource = state.sources.find((s) => s !== null);
    if (firstSource) {
      try {
        const bytes = new Uint8Array(await firstSource.file.arrayBuffer());
        state.exifData = parseExif(bytes.buffer);
      } catch { state.exifData = null; }
    }
    // 重置裁剪参数
    state.cropRegions = [];
    // 提取第一张的元信息
    if (firstSource) {
      const { image } = firstSource;
      const meta = metadata({ data: image.data, width: image.width, height: image.height });
      state.sourceMeta = `平均亮度: ${meta.averageBrightness.toFixed(1)}${meta.hasAlpha ? ' · 含透明通道' : ''}`;
    }
    state.busy = false;
    render();
  }

  async function loadOneFile(file: File): Promise<SourceItem> {
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
    return {
      file,
      url,
      image: { data: imageData.data, width: img.width, height: img.height },
      fileSize,
      camera,
    };
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

  function getCropOpts(i?: number): CropOptions | null {
    const src = getSource();
    if (!src) return null;
    const { cropRatio } = state;
    if (cropRatio) {
      const parts = cropRatio.split('/').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        return { aspectRatio: parts[0] / parts[1], align: state.cropAlign };
      }
    }
    const c = cr(i);
    if (c.w > 0 && c.h > 0) {
      return { x: c.x, y: c.y, width: c.w, height: c.h };
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
      const prevMeta = state.results[state.currentIndex]?.meta || '';
      const stepPrefix = state.pipeline && !state.pipeline.isEmpty()
        ? `处理步骤：${state.pipeline.names().join(' → ')} · ` : '';
      const outMeta = [`${state.outputFormat}`, `${(result.size / 1024).toFixed(1)}KB`];
      if (state.compressionMode === 'quality') {
        outMeta.push(`quality=${result.quality.toFixed(2)}`);
      }
      if (state.results[state.currentIndex]) URL.revokeObjectURL(state.results[state.currentIndex].url);
      state.results[state.currentIndex] = { url, meta: stepPrefix + outMeta.join(' · ') };
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

  function removeImage(idx: number): void {
    const src = state.sources[idx];
    if (src) URL.revokeObjectURL(src.url);
    const res = state.results[idx];
    if (res) URL.revokeObjectURL(res.url);
    state.sources.splice(idx, 1);
    state.results.splice(idx, 1);
    state.cropRegions.splice(idx, 1);
    if (state.currentIndex >= state.sources.length) {
      state.currentIndex = Math.max(0, state.sources.length - 1);
    }
    if (state.sources.length === 0) {
      state.exifData = null;
      state.sourceMeta = '';
    }
    // 如果第一张被删了，重新提取第一张的 EXIF 和元信息
    if (idx === 0 && state.sources.length > 0) {
      const first = state.sources.find((s) => s !== null);
      if (first) {
        first.file.arrayBuffer().then((buf) => {
          try { state.exifData = parseExif(buf); } catch { state.exifData = null; }
        });
        const meta = metadata({ data: first.image.data, width: first.image.width, height: first.image.height });
        state.sourceMeta = `平均亮度: ${meta.averageBrightness.toFixed(1)}${meta.hasAlpha ? ' · 含透明通道' : ''}`;
      }
    }
    render();
  }

  function run() {
    if (state.sources.length === 0) return;

    // ── 前置校验 ──
    if (state.enabledOps.size === 0) {
      state.runError = '请至少启用一个处理步骤（勾选 Tab 页中的「启用此步骤」）';
      render();
      return;
    }

    if (state.enabledOps.has('crop')) {
      const anyCropped = state.cropRegions.some((r) => r && r.w > 0 && r.h > 0);
      if (!anyCropped) {
        state.runError = '裁剪已启用，但未框选裁剪区域。请在裁剪 Tab 中拖拽框选或输入坐标';
        render();
        return;
      }
    }

    state.runError = '';

    // ── 构建 Pipeline ──
    const pipe = new Pipeline();

    // 裁剪（按图索引）
    if (state.enabledOps.has('crop')) {
      pipe.add({
        name: '裁剪',
        fn: (img) => {
          const idx = state.sources.findIndex(s => s?.image === img);
          const realIdx = idx >= 0 ? idx : state.currentIndex;
          const opts = getCropOpts(realIdx);
          if (!opts) return img;
          try { return crop(img, opts); } catch { return img; }
        },
      });
    }

    if (state.enabledOps.has('resize')) {
      const rOpts = getResizeOpts();
      if (rOpts) pipe.add({ name: '缩放', fn: (img) => resize(img, rOpts) });
    }

    if (state.enabledOps.has('rotate') && state.rotateDegrees !== 0) {
      const deg = state.rotateDegrees;
      pipe.add({ name: '旋转', fn: (img) => rotate(img, deg) });
    }

    if (state.enabledOps.has('rotate') && state.flipAxis) {
      const axis = state.flipAxis as FlipAxis;
      pipe.add({ name: '翻转', fn: (img) => flip(img, axis) });
    }

    if (state.enabledOps.has('filter') && hasFilterOpts()) {
      const fOpts = getFilterOpts();
      pipe.add({ name: '滤镜', fn: (img) => filter(img, fOpts) });
    }

    if (state.enabledOps.has('watermark') && state.watermarkText) {
      const wmOpts: WatermarkOptions = {
        text: state.watermarkText,
        position: state.watermarkPos,
        opacity: state.watermarkOpacity,
        font: `${state.watermarkFontSize}px ${state.watermarkFontFamily}`,
        color: state.watermarkColor,
        rotate: state.watermarkRotate,
        tile: state.watermarkTile,
        tileGap: state.watermarkTileGap,
      };
      const textRenderer = createTextRenderer();
      pipe.add({ name: '水印', fn: (img) => watermark(img, wmOpts, textRenderer) });
    }

    if (pipe.isEmpty()) {
      state.runError = '处理参数不完整，请检查各步骤的设置';
      render();
      return;
    }

    state.pipeline = pipe;

    // ── 批量处理所有图片 ──
    for (let idx = 0; idx < state.sources.length; idx++) {
      const src = state.sources[idx];
      if (!src) continue;
      state.currentIndex = idx; // 让 crop 闭包能找到正确的索引
      const result = pipe.apply(src.image);
      const steps = pipe.names();
      const w = result.width;
      const h = result.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(result.data, w, h), 0, 0);
      const url = canvas.toDataURL('image/png');

      if (state.results[idx]) URL.revokeObjectURL(state.results[idx].url);
      const meta = metadata(result);
      const kb = (atob(url.split(',')[1]).length / 1024).toFixed(1);
      state.results[idx] = {
        url,
        meta: `处理步骤：${steps.join(' → ')} · 结果尺寸：${w}×${h}px · ${kb}KB · 平均亮度：${meta.averageBrightness.toFixed(1)}${meta.hasAlpha ? ' · 含透明通道' : ''}`,
      };
    }
    render();
  }

  function reapplyPipeline() {
    const pipe = state.pipeline;
    if (!pipe || pipe.isEmpty()) return;

    for (let idx = 0; idx < state.sources.length; idx++) {
      const src = state.sources[idx];
      if (!src) continue;
      state.currentIndex = idx;
      const result = pipe.apply(src.image);
      const w = result.width;
      const h = result.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(result.data, w, h), 0, 0);
      const url = canvas.toDataURL('image/png');

      if (state.results[idx]) URL.revokeObjectURL(state.results[idx].url);
      const meta = metadata(result);
      const kb = (atob(url.split(',')[1]).length / 1024).toFixed(1);
      state.results[idx] = {
        url,
        meta: `处理步骤：${pipe.names().join(' → ')} · 结果尺寸：${w}×${h}px · ${kb}KB · 平均亮度：${meta.averageBrightness.toFixed(1)}${meta.hasAlpha ? ' · 含透明通道' : ''}`,
      };
    }
    render();
  }

  function revokeBlobUrl(url: string): void {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  return { render };
}