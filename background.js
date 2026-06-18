// 存储每个标签页的资源
const tabResources = {};

// 监听导航事件，在页面跳转前清理资源
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    // 仅处理主框架的导航事件
    if (details.frameId === 0) {
        const tabId = details.tabId;
        if (tabResources[tabId]) {
            delete tabResources[tabId];
            // （可选）可以向 popup 发送消息，告知其清理界面
            chrome.runtime.sendMessage({ action: 'clearUI' });
        }
    }
});

// 统一的消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = sender.tab ? sender.tab.id : null;

    // 来自 content script 的消息
    if (request.action === 'foundResource' && tabId) {
        if (!tabResources[tabId]) {
            tabResources[tabId] = {
                video: new Set(),
                audio: new Set(),
                image: new Set(),
                other: new Set()
            };
        }
        const { type, url } = request.data;
        if (url && !tabResources[tabId][type].has(url)) {
            tabResources[tabId][type].add(url);
            // 资源更新后，立即通知 popup
            chrome.runtime.sendMessage({
                action: 'resourceUpdated',
                data: { type, url }
            });
        }
        return; // 同步操作，不需要返回 true
    }

    // 来自 popup 的消息
    if (request.action === 'getResources') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const currentTabId = tabs[0].id;
                const resources = tabResources[currentTabId] || {};
                // 将 Set 转换为数组以便发送
                const serializableResources = {
                    video: Array.from(resources.video || []),
                    audio: Array.from(resources.audio || []),
                    image: Array.from(resources.image || []),
                    other: Array.from(resources.other || [])
                };
                sendResponse(serializableResources);
            } else {
                sendResponse({}); // 没有活动标签页，返回空对象
            }
        });
        return true; // 异步操作，必须返回 true 保持通道开放
    }
});

// 标签页关闭时清理数据
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabResources[tabId]) {
        delete tabResources[tabId];
    }
});