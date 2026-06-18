(function () {
    'use strict';

    const resourceTypes = {
        video: new Set(['.mp4', '.flv', '.m3u8', '.avi', '.wmv', '.mov']),
        audio: new Set(['.mp3', '.wav', '.ogg', '.m4a']),
        image: new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'])
    };

    function categorizeUrl(url) {
        if (!url || typeof url !== 'string') return;

        try {
            const urlObj = new URL(url);
            const extension = urlObj.pathname.substring(urlObj.pathname.lastIndexOf('.')).toLowerCase();
            
            let type = 'other';
            if (resourceTypes.video.has(extension)) {
                type = 'video';
            } else if (resourceTypes.audio.has(extension)) {
                type = 'audio';
            } else if (resourceTypes.image.has(extension)) {
                type = 'image';
            }

            chrome.runtime.sendMessage({
                action: 'foundResource',
                data: { type, url }
            });

        } catch (e) {
            // 无效的URL，忽略
        }
    }

    function scanDOM() {
        ['video', 'audio', 'img', 'image'].forEach(tag => {
            document.querySelectorAll(tag).forEach(el => {
                if (el.src) categorizeUrl(el.src);
                if (el.srcset) {
                    el.srcset.split(',').forEach(s => {
                        const url = s.trim().split(' ')[0];
                        categorizeUrl(url);
                    });
                }
            });
        });
    }

    // 使用 PerformanceObserver 监听网络请求
    try {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                categorizeUrl(entry.name);
            });
        });
        observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
        console.error('PerformanceObserver not supported.');
    }

    // DOM加载完毕后执行扫描
    function startDomObserver() {
        if (!document.body) {
            // 在某些极端情况下，body可能仍然不存在，延迟重试
            setTimeout(startDomObserver, 100);
            return;
        }
        // 扫描初始DOM
        scanDOM();

        // 监听DOM变化
        const domObserver = new MutationObserver(scanDOM);
        domObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomObserver);
    } else {
        startDomObserver();
    }

})();