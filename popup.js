document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 ---
    const tabsContainer = document.querySelector('.tabs');
    const resourceList = document.getElementById('resource-list');
    const sourceViewer = document.getElementById('source-viewer');
    const aboutPanel = document.getElementById('about-panel');
    const sourceCodeEl = document.getElementById('source-code');
    const headerTitle = document.querySelector('.header h1');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const activationPanel = document.getElementById('activation-panel');
    const activationCodeInput = document.getElementById('activation-code');
    const activateBtn = document.getElementById('activate-btn');

    // --- 状态变量 ---
    let allResources = {};
    let currentTab = 'image';
    let sourceCodeFetched = false;
    const correctCode = '547266';

    // --- 核心功能函数 ---

    function hideAllPanels() {
        resourceList.style.display = 'none';
        sourceViewer.style.display = 'none';
        aboutPanel.style.display = 'none';
        activationPanel.style.display = 'none';
    }

    // 显示激活面板
    function showActivationPanel() {
        hideAllPanels();
        activationPanel.style.display = 'flex';
    }

    // 显示主内容（当已激活时调用）
    function showMainContent() {
        hideAllPanels();
        // 根据当前选中的 tab 决定显示哪个面板
        switch(currentTab) {
            case 'image':
            case 'video':
            case 'audio':
            case 'other':
                resourceList.style.display = 'block';
                renderList(currentTab);
                break;
            case 'source':
                sourceViewer.style.display = 'block';
                renderSourcePanel();
                break;
            case 'about':
                aboutPanel.style.display = 'block';
                renderAboutPanel();
                break;
        }
        // 激活后，立即请求资源
        chrome.runtime.sendMessage({ action: 'getResources' }, (response) => {
            if (response) {
                allResources = response;
                updateTabCounts();
                updateTotalTitle();
                // 重新渲染当前列表，确保数据显示
                if (['image', 'video', 'audio', 'other'].includes(currentTab)) {
                    renderList(currentTab);
                }
            }
        });
    }

    // 监听来自 background 的实时更新
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'resourceUpdated') {
            const { type, url } = request.data;
            if (!allResources[type]) {
                allResources[type] = [];
            }
            if (!allResources[type].includes(url)) {
                allResources[type].push(url);
                updateTotalTitle();
                updateTabCounts();
                if (currentTab === type && resourceList.style.display === 'block') {
                    if (resourceList.querySelector('p')) {
                        resourceList.innerHTML = '';
                    }
                    const item = createResourceItem(type, url);
                    resourceList.appendChild(item);
                }
            }
        }
    });

    function createResourceItem(type, url) {
        const item = document.createElement('div');
        item.className = 'resource-item';
        let thumbnailHtml = type === 'image' ? `<img src="${url}" class="image-thumbnail" alt="preview">` : '';
        item.innerHTML = `
            ${thumbnailHtml}
            <a href="${url}" title="${url}" target="_blank" class="resource-url">${url}</a>
            <div class="resource-actions">
                <button data-url="${url}" class="copy-btn">复制</button>
                <button data-url="${url}" class="preview-btn">预览</button>
            </div>
        `;
        return item;
    }

    function renderList(type) {
        const resources = allResources[type] || [];
        if (resources.length === 0) {
            resourceList.innerHTML = '<p style="text-align:center; color:#888; padding:40px 0;">暂无资源</p>';
            return;
        }
        resourceList.innerHTML = '';
        resources.forEach(url => {
            const item = createResourceItem(type, url);
            resourceList.appendChild(item);
        });
    }

    function fetchAndShowSourceCode() {
        if (sourceCodeFetched) return;
        sourceCodeEl.textContent = '正在加载源代码...';
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: () => document.documentElement.outerHTML
            }, (results) => {
                if (results && results[0] && results[0].result) {
                    sourceCodeEl.textContent = results[0].result;
                    sourceCodeFetched = true;
                } else {
                    sourceCodeEl.textContent = '无法加载源代码。';
                }
            });
        });
    }

    function renderSourcePanel() {
        fetchAndShowSourceCode();
    }

    function renderAboutPanel() {
        // '关于'面板的逻辑保持不变
    }

    function updateTabCounts() {
        const tabButtons = tabsContainer.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            const tabType = btn.dataset.tab;
            if (allResources[tabType]) {
                const count = allResources[tabType].length;
                const baseText = btn.textContent.replace(/\s\(\d+\)$/, '');
                btn.textContent = count > 0 ? `${baseText} (${count})` : baseText;
            }
        });
    }

    function updateTotalTitle() {
        const total = Object.values(allResources).reduce((sum, set) => sum + (set ? set.length : 0), 0);
        headerTitle.textContent = `幻隐嗅探 (共 ${total} 项)`;
    }

    // --- 事件监听器 ---

    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            document.querySelector('.tab-button.active').classList.remove('active');
            e.target.classList.add('active');
            currentTab = e.target.dataset.tab;
            
            // 检查激活状态，决定显示什么
            chrome.storage.local.get(['isActivated'], (result) => {
                if (result.isActivated) {
                    showMainContent();
                } else {
                    showActivationPanel();
                }
            });
        }
    });

    resourceList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('copy-btn')) {
            navigator.clipboard.writeText(target.dataset.url).then(() => {
                target.textContent = '已复制!';
                setTimeout(() => target.textContent = '复制', 1000);
            });
        }
        if (target.classList.contains('preview-btn')) {
            window.open(target.dataset.url, '_blank');
        }
    });

    resourceList.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('image-thumbnail')) {
            const imageUrl = e.target.src;
            imagePreviewContainer.innerHTML = `<img src="${imageUrl}" alt="Preview">`;
            imagePreviewContainer.classList.add('visible');
        }
    });

    resourceList.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('image-thumbnail')) {
            imagePreviewContainer.classList.remove('visible');
            imagePreviewContainer.innerHTML = '';
        }
    });

    resourceList.addEventListener('mousemove', (e) => {
        if (e.target.classList.contains('image-thumbnail')) {
            const x = e.clientX + 20, y = e.clientY + 20;
            const previewRect = imagePreviewContainer.getBoundingClientRect();
            const bodyRect = document.body.getBoundingClientRect();
            let newX = x, newY = y;
            if (x + previewRect.width > bodyRect.width) newX = e.clientX - previewRect.width - 20;
            if (y + previewRect.height > bodyRect.height) newY = e.clientY - previewRect.height - 20;
            imagePreviewContainer.style.left = `${newX}px`;
            imagePreviewContainer.style.top = `${newY}px`;
        }
    });

    document.getElementById('copy-source-btn').addEventListener('click', () => {
        if (sourceCodeEl.textContent && sourceCodeEl.textContent !== '正在加载源代码...') {
            navigator.clipboard.writeText(sourceCodeEl.textContent).then(() => alert('源代码已复制到剪贴板！'));
        } else {
            alert('源代码尚未加载完成！');
        }
    });

    document.getElementById('edit-mode-btn').addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: () => {
                    if (document.designMode === 'on') {
                        document.designMode = 'off';
                        alert('已关闭可视化编辑模式。');
                    } else {
                        document.designMode = 'on';
                        alert('已开启可视化编辑模式，您现在可以直接编辑网页内容了！');
                    }
                }
            });
        });
    });

    // 激活按钮逻辑
    activateBtn.addEventListener('click', () => {
        const enteredCode = activationCodeInput.value.trim();
        if (enteredCode === correctCode) {
            chrome.storage.local.set({ isActivated: true }, () => {
                alert('激活成功！');
                showMainContent();
            });
        } else {
            alert('激活码错误，请重试！');
            activationCodeInput.value = '';
        }
    });

    // --- 初始化 ---
    function initialize() {
        chrome.storage.local.get(['isActivated'], (result) => {
            if (result.isActivated) {
                showMainContent();
            } else {
                showActivationPanel();
            }
        });
    }

    initialize();
});