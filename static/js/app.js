// 全局应用状态
const AppState = {
    projectId: null,
    projectName: '',
    images: [],
    currentIndex: 0,
    currentImage: null,
    currentAnnotations: [],
    classes: [],
    selectedAnnotationId: null,

    get currentFileName() {
        return this.images[this.currentIndex]?.file || '';
    },
    get currentAnnotation() {
        return this.currentAnnotations.find(a => a.id === this.selectedAnnotationId) || null;
    },
};

// 从 URL 提取项目 ID
// Tauri 模式: annotate.html#<project_id>
// Django 模式: /annotate/<project_id>/
const hashMatch = window.location.hash.match(/#(.+)/);
const pathMatch = window.location.pathname.match(/\/annotate\/([^/]+)\//);
AppState.projectId = hashMatch ? hashMatch[1] : (pathMatch ? pathMatch[1] : null);

if (!AppState.projectId) {
    window.location.href = 'index.html';
}

function _dlog(msg) {
    if (window._debugLog) window._debugLog(msg);
    console.log(msg);
}

document.addEventListener('DOMContentLoaded', async () => {
    let dbg = [];
    try {
        dbg.push('projectId=' + AppState.projectId);
        dbg.push('TAURI=' + (typeof window.__TAURI__) + ' invoke=' + (typeof (window.__TAURI__||{}).invoke));
        await loadProject();
        dbg.push('项目OK: ' + AppState.projectName + ' 类别数=' + AppState.classes.length);
        await loadImageList();
        dbg.push('图片列表OK: ' + AppState.images.length + ' 张');
        if (AppState.images.length > 0) {
            const fileName = AppState.images[0].file;
            dbg.push('准备加载: ' + fileName);
            const detail = await API.getImageDetail(AppState.projectId, fileName);
            dbg.push('详情OK: ' + detail.width + 'x' + detail.height);
            const imgUrl = await API.getImageDataUrl(AppState.projectId, fileName);
            dbg.push('图片URL前缀: ' + (imgUrl ? imgUrl.substring(0, 60) : '空'));
            const img = new Image();
            img.src = imgUrl;
            await new Promise((resolve, reject) => {
                img.onload = () => { dbg.push('图片解码OK'); resolve(); };
                img.onerror = () => { reject(new Error('解码失败')); };
            });
            AppState.currentImage = img;
        }
        Canvas.init();
        if (AppState.currentImage) Canvas.zoomToFit();
    } catch (err) {
        let msg = err ? (err.message || String(err)) : '未知错误';
        alert('失败: ' + msg + '\n\n调试:\n' + dbg.join('\n'));
    }

    // 属性面板事件
    document.addEventListener('annotation:selected', () => {
        const ann = AppState.currentAnnotation;
        const panel = document.getElementById('propertyPanel');
        if (ann) {
            panel.style.display = 'block';
            document.getElementById('propClass').value = ann.class_id;
            document.getElementById('propShape').textContent = {
                rect: '矩形', square: '正方形', ellipse: '椭圆', circle: '圆形'
            }[ann.shape] || ann.shape;
            const cx = Math.round((ann.x1 + ann.x2) / 2);
            const cy = Math.round((ann.y1 + ann.y2) / 2);
            const w = Math.abs(ann.x2 - ann.x1);
            const h = Math.abs(ann.y2 - ann.y1);
            document.getElementById('propCenter').textContent = `(${cx}, ${cy})`;
            document.getElementById('propSize').textContent = `${w} × ${h}`;
        } else {
            panel.style.display = 'none';
        }
    });

    document.addEventListener('annotation:deselected', () => {
        document.getElementById('propertyPanel').style.display = 'none';
    });

    document.getElementById('propClass').addEventListener('change', (e) => {
        const ann = AppState.currentAnnotation;
        if (!ann) return;
        const newClassId = parseInt(e.target.value);
        const oldClassId = ann.class_id;
        if (newClassId === oldClassId) return;
        ann.class_id = newClassId;
        UndoStack.push({
            type: 'changeClass',
            annotationId: ann.id,
            from_class_id: oldClassId,
            to_class_id: newClassId,
        });
        saveCurrentAnnotations();
        Canvas.render();
        document.getElementById('classSelector').value = newClassId;
    });

    document.getElementById('btnDeleteAnnotation').addEventListener('click', () => {
        const idx = AppState.currentAnnotations.findIndex(
            a => a.id === AppState.selectedAnnotationId);
        if (idx === -1) return;
        const ann = AppState.currentAnnotations[idx];
        UndoStack.push({ type: 'delete', annotation: ann, index: idx });
        AppState.currentAnnotations.splice(idx, 1);
        AppState.selectedAnnotationId = null;
        saveCurrentAnnotations();
        document.dispatchEvent(new CustomEvent('annotation:deselected'));
        Canvas.render();
        updateStatusBar();
    });
});

async function loadProject() {
    const data = await API.getProject(AppState.projectId);
    AppState.projectName = data.name;
    AppState.classes = data.classes || [];
    document.getElementById('projectNameDisplay').textContent = data.name;

    if (data.integrity_warnings && data.integrity_warnings.length > 0) {
        const msgs = data.integrity_warnings.map(w =>
            `[${w.file}] ${w.issue}`
        ).join('\n');
        console.warn('项目完整性警告:\n' + msgs);
        showIntegrityWarning(
            `检测到 ${data.integrity_warnings.length} 个数据一致性问题，详见控制台。` +
            '标注形状可能显示不正确。'
        );
    }

    populateClassSelectors();
}

function populateClassSelectors() {
    const topSelector = document.getElementById('classSelector');
    const propSelector = document.getElementById('propClass');
    const optionsHtml = AppState.classes.map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('');
    topSelector.innerHTML = '<option value="">-- 选择类别 --</option>' + optionsHtml;
    if (propSelector) {
        propSelector.innerHTML = optionsHtml;
    }
}

async function loadImageList(statusFilter = 'all') {
    const data = await API.getImages(AppState.projectId, `status=${statusFilter}`);
    AppState.images = data.images || [];
    document.dispatchEvent(new CustomEvent('imagelist:updated'));
}

async function loadImage(index) {
    if (index < 0 || index >= AppState.images.length) return;

    if (AppState.currentImage && AppState.currentAnnotations.length >= 0) {
        await saveCurrentAnnotations();
    }

    AppState.currentIndex = index;
    AppState.selectedAnnotationId = null;
    UndoStack.clear();

    const fileName = AppState.currentFileName;
    const detail = await API.getImageDetail(AppState.projectId, fileName);

    const img = new Image();
    const imgUrl = await API.getImageDataUrl(AppState.projectId, fileName);
    if (!imgUrl) throw new Error('图片数据为空: ' + fileName);
    img.src = imgUrl;
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => {
            const preview = imgUrl.length > 80 ? imgUrl.substring(0, 80) + '...' : imgUrl;
            reject(new Error('图片解码失败: ' + fileName + '\nURL: ' + preview));
        };
    });
    AppState.currentImage = img;

    AppState.currentAnnotations = (detail.annotations || []).map((ann, i) => ({
        ...ann,
        id: ann.id || generateId(),
    }));

    if (detail.meta_mismatch) {
        showIntegrityWarning(
            '⚠ 元数据不一致：标注形状信息可能丢失，已回退为矩形。请在属性面板中修正形状。'
        );
    }

    Canvas.zoomToFit();
    Canvas.render();
    updateStatusBar();
    document.dispatchEvent(new CustomEvent('image:loaded'));
}

async function saveCurrentAnnotations() {
    if (!AppState.currentFileName) return;
    const anns = AppState.currentAnnotations.map(a => ({
        class_id: a.class_id,
        shape: a.shape,
        x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
    }));
    try {
        await API.saveAnnotations(AppState.projectId, AppState.currentFileName, anns);
    } catch (err) {
        showStatusError('保存失败: ' + err.message);
    }
}

function generateId() {
    return 'ann_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function showStatusError(msg) {
    const el = document.getElementById('statusAnnotationCount');
    el.textContent = msg;
    el.style.color = 'var(--danger)';
    setTimeout(() => {
        el.style.color = '';
        updateStatusBar();
    }, 3000);
}

function showIntegrityWarning(msg) {
    let banner = document.getElementById('integrityBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'integrityBanner';
        banner.style.cssText = `
            position: absolute; top: 0; left: 0; right: 0;
            background: rgba(255, 193, 7, 0.15);
            color: #ffc107; padding: 8px 16px;
            font-size: 13px; text-align: center;
            z-index: 10; cursor: pointer;
        `;
        banner.onclick = () => { banner.style.display = 'none'; };
        document.getElementById('canvasArea').appendChild(banner);
    }
    banner.textContent = msg + ' (点击关闭)';
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 8000);
}

function updateStatusBar() {
    document.getElementById('statusImageIndex').textContent =
        `${AppState.currentIndex + 1}/${AppState.images.length}`;
    document.getElementById('statusAnnotationCount').textContent =
        `标注: ${AppState.currentAnnotations.length}`;
}
