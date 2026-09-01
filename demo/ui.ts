import { crop, resize, rotate, flip, filter } from 'imgkit';
import type { ImageDataLike, CropOptions, ResizeOptions, FilterOptions, FlipAxis, FitMode, ResizeAlgorithm } from 'imgkit';
import { Position } from 'imgkit';

interface SourceItem {
  file: File;
  url: string;
  image: ImageDataLike;
}

interface ResultItem {
  url: string;
  meta: string;
}

interface State {
  source: SourceItem | null;
  result: ResultItem | null;
  busy: boolean;
  loadingText: string;
  activeTab: 'crop' | 'resize' | 'rotate' | 'filter';
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
}

function labelOf(t: string): string {
  const map: Record<string, string> = {
    crop: '裁剪',
    resize: '缩放',
    rotate: '旋转/翻转',
    filter: '滤镜',
  };
  return map[t] ?? t;
}

export function createApp(root: HTMLElement) {
  const state: State = {
    source: null,
    result: null,
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
  };

  function render() {
    const hasSource = state.source !== null;
    const srcUrl = state.source?.url ?? '';
    const resUrl = state.result?.url ?? '';
    const resMeta = state.result?.meta ?? '';
    const fileName = state.source?.file?.name ?? '';

    const sourcePreviewHtml = hasSource
      ? `<div class="preview-thumb"><img src="${srcUrl}" alt="source" /></div>
         <div class="meta">文件名：${fileName} · ${state.source!.image.width}×${state.source!.image.height}</div>`
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
          <p>纯前端图片处理工具库 · 裁剪 / 缩放 / 旋转翻转 / 滤镜</p>
        </header>
        <div class="layout">
          <section class="panel">
            <h2>1. 选择图片</h2>
            <div class="drop-zone" id="drop">
              <p>点击或拖拽图片到此处</p>
              <input type="file" id="file" accept="image/*" hidden />
            </div>
            ${sourcePreviewHtml}
          </section>
          <section class="panel">
            <h2>2. 处理选项</h2>
            <div class="tabs">
              ${(['crop', 'resize', 'rotate', 'filter'] as const)
                .map((t) => `<div class="tab ${state.activeTab === t ? 'active' : ''}" data-tab="${t}">${labelOf(t)}</div>`)
                .join('')}
            </div>
            <div id="tabContent"></div>
            <button class="btn" id="run" ${hasSource ? '' : 'disabled'} style="margin-top:var(--space-lg)">执行处理</button>
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
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) handleFile(fileInput.files[0]);
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

    // 翻转按钮
    document.getElementById('btnFlipH')?.addEventListener('click', () => {
      state.flipAxis = state.flipAxis === 'horizontal' ? '' : 'horizontal';
      render();
    });
    document.getElementById('btnFlipV')?.addEventListener('click', () => {
      state.flipAxis = state.flipAxis === 'vertical' ? '' : 'vertical';
      render();
    });

    // 控件值变更
    root.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      const key = target.dataset.k;
      if (!key) return;
      const val = (target as HTMLInputElement).type === 'range' || (target as HTMLInputElement).type === 'number'
        ? parseFloat((target as HTMLInputElement).value) || 0
        : (target as HTMLInputElement).value;
      (state as any)[key] = val;
      // 同步更新旋转角度显示
      if (key === 'rotateDegrees') {
        render();
      } else {
        renderTabContent();
      }
    });
    root.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      const key = target.dataset.k;
      if (!key || (target as HTMLInputElement).type === 'range') return;
      const val = (target as HTMLInputElement).type === 'number'
        ? parseFloat((target as HTMLInputElement).value) || 0
        : (target as HTMLInputElement).value;
      (state as any)[key] = val;
      renderTabContent();
    });
  }

  async function handleFile(file: File): Promise<void> {
    state.busy = true;
    state.loadingText = '正在加载图片…';
    render();
    try {
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
      // 释放之前的 blob URL
      if (state.source) URL.revokeObjectURL(state.source.url);
      if (state.result) URL.revokeObjectURL(state.result.url);
      state.source = {
        file,
        url,
        image: { data: imageData.data, width: img.width, height: img.height },
      };
      state.result = null;
      // 重置裁剪参数
      state.cropW = 0; state.cropH = 0;
    } catch (err) {
      console.error('图片加载失败', err);
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

  function getCropOpts(): CropOptions | null {
    const src = state.source;
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

  function run() {
    if (!state.source) return;
    const src = state.source;
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

    if (state.result) URL.revokeObjectURL(state.result.url);
    state.result = {
      url,
      meta: `处理步骤：${steps.join(' → ')} · 结果尺寸：${w}×${h}`,
    };
    render();
  }

  function revokeBlobUrl(url: string): void {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  return { render };
}