// 标签页切换功能
document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有标签的active状态
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加当前标签的active状态
            this.classList.add('active');

            // 显示对应的标签内容
            const tabId = this.getAttribute('data-tab');
            if (tabId) {
                document.getElementById(tabId).classList.add('active');
            }
        });
    });

    // 为每个标签添加data-tab属性
    tabs.forEach((tab, index) => {
        const tabIds = ['tab-basic', 'tab-advanced', 'tab-watermark', 'tab-border', 'tab-crop', 'tab-filter'];
        if (tabIds[index]) {
            tab.setAttribute('data-tab', tabIds[index]);
        }
    });

    // 滑块值显示更新
    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
        slider.addEventListener('input', function() {
            const valueDisplay = this.parentElement.querySelector('.control-value');
            if (valueDisplay) {
                let value = this.value;
                // 根据上下文添加单位
                if (this.closest('.control-item')?.querySelector('.control-name')?.textContent?.includes('宽度') ||
                    this.closest('.control-item')?.querySelector('.control-name')?.textContent?.includes('高度')) {
                    value += ' px';
                } else if (this.closest('.control-item')?.querySelector('.control-name')?.textContent?.includes('质量') ||
                          this.closest('.control-item')?.querySelector('.control-name')?.textContent?.includes('透明度')) {
                    value += ' %';
                }
                valueDisplay.textContent = value;
            }
        });
    });

    // 上传区域点击效果
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('click', function() {
            // 仅UI反馈，不实现实际上传功能
            this.style.borderColor = '#4f46e5';
            this.style.background = '#f9fafb';
            setTimeout(() => {
                this.style.borderColor = '';
                this.style.background = '';
            }, 200);
        });
    }

    // 按钮点击效果
    const buttons = document.querySelectorAll('.btn-primary');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            // 仅UI反馈
            this.textContent = '已应用';
            this.style.background = '#10b981';
            setTimeout(() => {
                this.textContent = '应用设置';
                this.style.background = '';
            }, 1500);
        });
    });

    console.log('imgkit UI 已加载 - 仅包含界面展示，未实现具体功能');
});
