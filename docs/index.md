---
layout: home

hero:
  name: "imgpilot"
  text: "纯前端图片处理工具库"
  tagline: 浏览器端零原生依赖 · 链式 API + 函数式 API · 10 大功能模块
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quickstart
    - theme: alt
      text: API 参考
      link: /api/

features:
  - title: 纯前端零依赖
    details: 核心算法基于 ImageData 实现，不依赖任何第三方图像库（sharp/jimp），浏览器端零原生依赖。
  - title: 双调用风格
    details: 链式 API（imgpilot(src).resize().watermark().toBlob()）与函数式 API（crop/resize/filter 等独立函数），按场景选择。
  - title: 10 大功能模块
    details: 压缩、水印、裁剪、缩放、旋转翻转、格式转换、滤镜、元信息、EXIF 解析、ZIP 打包。
  - title: TypeScript 严格模式
    details: 完整类型定义（.d.ts），所有接口严格类型化，编辑器智能提示全覆盖。
  - title: 撤销/重做内置
    details: Pipeline 内置快照历史，支持链式操作的撤销与重做。
  - title: Demo 可视化
    details: 提供完整 Vite Demo 站点，上传 → 设置参数 → 预览 → 下载，一站式体验。
---