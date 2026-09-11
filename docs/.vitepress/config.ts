import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'imgpilot',
  description: '纯前端图片处理工具库',
  lang: 'zh-CN',
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '介绍', link: '/guide/' },
            { text: '快速开始', link: '/guide/quickstart' },
            { text: '架构设计', link: '/guide/architecture' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: '链式 API', link: '/api/' },
            { text: '函数式 API', link: '/api/functions' },
            { text: '类型定义', link: '/api/types' },
          ],
        },
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/yuxiaZhao/imgpilot' }],
    footer: {
      message: '基于 MIT 协议发布',
      copyright: 'Copyright © 2026 imgpilot contributors',
    },
    search: { provider: 'local' },
  },
});