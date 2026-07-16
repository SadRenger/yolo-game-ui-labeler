// API 请求封装 + Tauri IPC 适配
const API = {
    // Tauri 环境: 通过 IPC invoke('api_request') 代理到 Django
    // 浏览器开发: Django 直接 serve 页面 → 同源 fetch
    _isTauri: false,  // 运行时检测

    _getInvoke() {
        // Tauri 2.x: invoke 在 window.__TAURI__ (withGlobalTauri: true)
        // __TAURI_INTERNALS__ 存在但没有 invoke 方法
        if (typeof window.__TAURI__ !== 'undefined'
            && typeof window.__TAURI__.invoke === 'function') {
            this._isTauri = true;
            return window.__TAURI__.invoke.bind(window.__TAURI__);
        }
        if (typeof window.__TAURI_INTERNALS__ !== 'undefined'
            && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
            this._isTauri = true;
            return window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        }
        return null;
    },

    async request(method, url, body = null) {
        const invoke = this._getInvoke();
        if (invoke) {
            // Tauri 模式: IPC 代理 → Rust → Django（绕过跨域）
            try {
                const bodyStr = body ? JSON.stringify(body) : null;
                const data = await invoke('api_request', { method, path: url, body: bodyStr });
                if (data && data.error) throw new Error(data.error);
                return data;
            } catch (e) {
                throw new Error('API 请求失败: ' + (e.message || e));
            }
        }
        // 浏览器模式: 同源 fetch
        const opts = { method, headers: {} };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const response = await fetch(url, opts);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    },

    // 项目管理
    listProjects()     { return this.request('GET', '/api/projects/'); },
    createProject(data){ return this.request('POST', '/api/projects/', data); },
    getProject(id)     { return this.request('GET', `/api/projects/${id}/`); },
    deleteProject(id)  { return this.request('DELETE', `/api/projects/${id}/`); },

    // 图片
    getImages(projectId, params = '') {
        return this.request('GET', `/api/projects/${projectId}/images/?${params}`);
    },
    getImageDetail(projectId, name) {
        return this.request('GET', `/api/projects/${projectId}/images/${encodeURIComponent(name)}/`);
    },
    _getBase() {
        // Detect Tauri by checking for __TAURI__ (injected by withGlobalTauri)
        return (typeof window.__TAURI__ !== 'undefined')
            ? 'http://127.0.0.1:8000' : '';
    },
    getImageDataUrl(projectId, name) {
        return `${this._getBase()}/api/projects/${projectId}/images/${encodeURIComponent(name)}/data/`;
    },
    getThumbnailUrl(projectId, name) {
        return `${this._getBase()}/api/projects/${projectId}/images/${encodeURIComponent(name)}/thumbnail/`;
    },

    // 标注
    saveAnnotations(projectId, name, annotations) {
        return this.request('PUT',
            `/api/projects/${projectId}/images/${encodeURIComponent(name)}/annotations/`,
            { annotations });
    },

    // 审核状态
    toggleReviewed(projectId, name, reviewed) {
        return this.request('PUT',
            `/api/projects/${projectId}/images/${encodeURIComponent(name)}/reviewed/`,
            { reviewed });
    },
};

// Tauri 原生对话框桥接
const TauriBridge = {
    /**
     * 获取 Tauri IPC invoke 函数
     * Tauri 2.x 始终注入 __TAURI_INTERNALS__，withGlobalTauri 额外提供 __TAURI__
     */
    _getInvoke() {
        if (typeof window.__TAURI_INTERNALS__ !== 'undefined'
            && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
            return window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
        }
        if (typeof window.__TAURI__ !== 'undefined'
            && typeof window.__TAURI__.invoke === 'function') {
            return window.__TAURI__.invoke.bind(window.__TAURI__);
        }
        return null;
    },

    isAvailable() {
        return this._getInvoke() !== null;
    },

    async pickDirectory() {
        const invoke = this._getInvoke();
        if (invoke) {
            try {
                const result = await invoke('pick_image_directory');
                return result || '';
            } catch (e) {
                console.error('Tauri dialog error:', e);
            }
        }
        return prompt('请输入图片目录的绝对路径:') || '';
    },

    async pickJsonFile() {
        const invoke = this._getInvoke();
        if (invoke) {
            try {
                const result = await invoke('pick_json_file');
                return result || '';
            } catch (e) {
                console.error('Tauri dialog error:', e);
            }
        }
        return prompt('请输入类别配置 JSON 文件的绝对路径:') || '';
    },
};
