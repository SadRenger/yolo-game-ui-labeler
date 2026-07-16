// ── 工具栏 & 快捷键 ────────────────────────────────────────

const Toolbar = {
    init() {
        this._bindToolButtons();
        this._bindKeyboard();
        this._bindTopButtons();
        this._activateTool('rect');
    },

    _bindToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._activateTool(btn.dataset.tool);
            });
        });
    },

    _activateTool(tool) {
        Canvas.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (btn) btn.classList.add('active');

        const area = document.getElementById('canvasArea');
        area.classList.toggle('select-mode', tool === 'select');
    },

    _bindTopButtons() {
        document.getElementById('btnSave').addEventListener('click', async () => {
            await saveCurrentAnnotations();
            showStatusTemporary('已保存');
        });
    },

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const ctrl = e.ctrlKey || e.metaKey;

            if (ctrl) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        UndoStack.undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        UndoStack.redo();
                        break;
                    case 's':
                        e.preventDefault();
                        saveCurrentAnnotations();
                        showStatusTemporary('已保存');
                        break;
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case '1': this._activateTool('rect'); break;
                case '2': this._activateTool('square'); break;
                case '3': this._activateTool('ellipse'); break;
                case '4': this._activateTool('circle'); break;
                case 's': this._activateTool('select'); break;
                case '5': case '6': case '7': case '8': case '9':
                    const classIdx = parseInt(e.key) - 5;
                    if (classIdx < AppState.classes.length) {
                        document.getElementById('classSelector').value = AppState.classes[classIdx].id;
                    }
                    break;
                case 'a':
                case 'arrowleft':
                    e.preventDefault();
                    this._navigateImage(-1);
                    break;
                case 'd':
                case 'arrowright':
                    e.preventDefault();
                    this._navigateImage(1);
                    break;
                case 'delete':
                    e.preventDefault();
                    this._deleteSelected();
                    break;
                case '0':
                    Canvas.zoomTo100();
                    break;
                case 'h':
                    Crosshair.visible = !Crosshair.visible;
                    document.getElementById('statusCrosshair').textContent =
                        '准星: ' + (Crosshair.visible ? '开' : '关');
                    Canvas.render();
                    break;
                case 'r':
                    ReviewManager.toggleCurrentImage();
                    break;
            }
        });
    },

    async _navigateImage(dir) {
        const newIdx = AppState.currentIndex + dir;
        if (newIdx >= 0 && newIdx < AppState.images.length) {
            await loadImage(newIdx);
        }
    },

    _deleteSelected() {
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
    },
};

function showStatusTemporary(msg) {
    const el = document.getElementById('statusAnnotationCount');
    const orig = el.textContent;
    el.textContent = msg;
    setTimeout(() => { el.textContent = orig; }, 1500);
}

Toolbar.init();

// ── 审核状态管理 ──────────────────────────────────────────

const ReviewManager = {
    toggleCurrentImage() {
        if (!AppState.currentFileName) return;
        const fileName = AppState.currentFileName;
        const current = AppState.images[AppState.currentIndex];
        const newStatus = current.status === 'reviewed' ? 'annotated' : 'reviewed';

        API.toggleReviewed(AppState.projectId, fileName, newStatus === 'reviewed')
            .then(() => {
                current.status = newStatus;
                document.dispatchEvent(new CustomEvent('imagelist:updated'));
                updateStatusBar();
            })
            .catch(err => showStatusError('审核状态更新失败: ' + err.message));
    },
};
