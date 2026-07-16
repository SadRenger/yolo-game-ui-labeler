// ── Canvas 渲染引擎 ────────────────────────────────────────

const Canvas = {
    canvas: null,
    ctx: null,

    scale: 1.0,
    offsetX: 0,
    offsetY: 0,

    currentTool: 'rect',
    isDrawing: false,
    drawStartX: 0,
    drawStartY: 0,
    drawCurrentX: 0,
    drawCurrentY: 0,

    isMoving: false,
    moveStartX: 0,
    moveStartY: 0,
    moveOrigX1: 0,
    moveOrigY1: 0,
    moveOrigX2: 0,
    moveOrigY2: 0,

    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0,

    init() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this._bindEvents();
        this._fitToContainer();
        window.addEventListener('resize', () => this._fitToContainer());
    },

    _fitToContainer() {
        const area = document.getElementById('canvasArea');
        this.canvas.width = area.clientWidth;
        this.canvas.height = area.clientHeight;
        this.render();
    },

    screenToImage(sx, sy) {
        return {
            x: (sx - this.offsetX) / this.scale,
            y: (sy - this.offsetY) / this.scale,
        };
    },

    imageToScreen(ix, iy) {
        return {
            x: ix * this.scale + this.offsetX,
            y: iy * this.scale + this.offsetY,
        };
    },

    zoom(factor, centerX, centerY) {
        const newScale = Math.max(0.1, Math.min(5.0, this.scale * factor));
        const imgPt = this.screenToImage(centerX, centerY);
        this.scale = newScale;
        const newScreen = this.imageToScreen(imgPt.x, imgPt.y);
        this.offsetX += centerX - newScreen.x;
        this.offsetY += centerY - newScreen.y;
        this.render();
        this._updateZoomDisplay();
    },

    zoomToFit() {
        if (!AppState.currentImage) return;
        const area = document.getElementById('canvasArea');
        const imgW = AppState.currentImage.width;
        const imgH = AppState.currentImage.height;
        const padX = area.clientWidth * 0.1;
        const padY = area.clientHeight * 0.1;
        const fitW = area.clientWidth - padX * 2;
        const fitH = area.clientHeight - padY * 2;
        this.scale = Math.min(fitW / imgW, fitH / imgH);
        this.offsetX = (area.clientWidth - imgW * this.scale) / 2;
        this.offsetY = (area.clientHeight - imgH * this.scale) / 2;
        this.render();
        this._updateZoomDisplay();
    },

    zoomTo100() {
        if (!AppState.currentImage) return;
        const area = document.getElementById('canvasArea');
        this.scale = 1.0;
        const imgW = AppState.currentImage.width;
        const imgH = AppState.currentImage.height;
        this.offsetX = (area.clientWidth - imgW) / 2;
        this.offsetY = (area.clientHeight - imgH) / 2;
        this.render();
        this._updateZoomDisplay();
    },

    _updateZoomDisplay() {
        const pct = Math.round(this.scale * 100);
        document.getElementById('zoomIndicator').textContent = pct + '%';
        document.getElementById('statusZoom').textContent = pct + '%';
    },

    render(effectiveTool) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, w, h);

        if (!AppState.currentImage) {
            document.getElementById('watermark').style.display = 'block';
            return;
        }
        document.getElementById('watermark').style.display = 'none';

        const img = AppState.currentImage;
        const screenPt = this.imageToScreen(0, 0);
        ctx.drawImage(img, screenPt.x, screenPt.y,
            img.width * this.scale, img.height * this.scale);

        for (const ann of AppState.currentAnnotations) {
            this._renderAnnotation(ann, ann.id === AppState.selectedAnnotationId);
        }

        if (this.isDrawing) {
            this._renderDrawingPreview(effectiveTool || this.currentTool);
        }

        if (Crosshair.visible) {
            Crosshair.render(this);
        }

        const s0 = this.imageToScreen(0, 0);
        const s1 = this.imageToScreen(img.width, img.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
    },

    _renderAnnotation(ann, isSelected) {
        const ctx = this.ctx;
        const cls = AppState.classes.find(c => c.id === ann.class_id);
        const color = cls ? cls.color : '#ffffff';
        const lineWidth = isSelected ? 4 : 2;

        const p1 = this.imageToScreen(ann.x1, ann.y1);
        const p2 = this.imageToScreen(ann.x2, ann.y2);
        const sx = Math.min(p1.x, p2.x);
        const sy = Math.min(p1.y, p2.y);
        const sw = Math.abs(p2.x - p1.x);
        const sh = Math.abs(p2.y - p1.y);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        switch (ann.shape) {
            case 'rect':
            case 'square':
                ctx.strokeRect(sx, sy, sw, sh);
                break;
            case 'ellipse':
            case 'circle':
                ctx.beginPath();
                ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }

        if (cls) {
            ctx.fillStyle = color;
            ctx.font = '12px sans-serif';
            ctx.fillText(cls.name, sx, sy - 4);
        }
        ctx.restore();
    },

    _renderDrawingPreview(tool) {
        if (!this.isDrawing) return;
        const p1 = this.imageToScreen(this.drawStartX, this.drawStartY);
        const p2 = this.imageToScreen(this.drawCurrentX, this.drawCurrentY);
        const sx = Math.min(p1.x, p2.x);
        const sy = Math.min(p1.y, p2.y);
        const sw = Math.abs(p2.x - p1.x);
        const sh = Math.abs(p2.y - p1.y);

        const ctx = this.ctx;
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        switch (tool) {
            case 'rect':
                ctx.strokeRect(sx, sy, sw, sh);
                break;
            case 'square': {
                const side = Math.max(sw, sh);
                ctx.strokeRect(sx, sy, side, side);
                break;
            }
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'circle': {
                const dia = Math.max(sw, sh);
                ctx.beginPath();
                ctx.arc(sx + dia / 2, sy + dia / 2, dia / 2, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
        }
        ctx.restore();
    },

    _getEffectiveTool(e) {
        if (!e.shiftKey) return this.currentTool;
        const map = { rect: 'square', square: 'rect', ellipse: 'circle', circle: 'ellipse' };
        return map[this.currentTool] || this.currentTool;
    },

    _bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        window.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('dblclick', (e) => {
            if (!this._isOnAnnotation(e)) {
                this.zoomToFit();
            }
        });
    },

    _onMouseDown(e) {
        if (e.button === 2) {
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartOffsetX = this.offsetX;
            this.panStartOffsetY = this.offsetY;
            return;
        }
        if (e.button !== 0) return;

        const imgPt = this.screenToImage(e.offsetX, e.offsetY);

        if (this.currentTool === 'select') {
            const hit = this._hitTest(imgPt.x, imgPt.y);
            if (hit) {
                AppState.selectedAnnotationId = hit.id;
                document.dispatchEvent(new CustomEvent('annotation:selected'));
                this.isMoving = true;
                this.moveStartX = imgPt.x;
                this.moveStartY = imgPt.y;
                this.moveOrigX1 = hit.x1;
                this.moveOrigY1 = hit.y1;
                this.moveOrigX2 = hit.x2;
                this.moveOrigY2 = hit.y2;
                this.render();
            } else {
                AppState.selectedAnnotationId = null;
                document.dispatchEvent(new CustomEvent('annotation:deselected'));
                this.render();
            }
        } else {
            this.isDrawing = true;
            this.drawStartX = imgPt.x;
            this.drawStartY = imgPt.y;
            this.drawCurrentX = imgPt.x;
            this.drawCurrentY = imgPt.y;
        }
    },

    _onMouseMove(e) {
        if (this.isPanning) {
            this.offsetX = this.panStartOffsetX + (e.clientX - this.panStartX);
            this.offsetY = this.panStartOffsetY + (e.clientY - this.panStartY);
            this.render();
            return;
        }

        const imgPt = this.screenToImage(e.offsetX, e.offsetY);

        if (this.isDrawing) {
            this.drawCurrentX = imgPt.x;
            this.drawCurrentY = imgPt.y;
            this.render(this._getEffectiveTool(e));
        } else if (this.isMoving) {
            const dx = imgPt.x - this.moveStartX;
            const dy = imgPt.y - this.moveStartY;
            const ann = AppState.currentAnnotation;
            if (ann) {
                ann.x1 = this.moveOrigX1 + dx;
                ann.y1 = this.moveOrigY1 + dy;
                ann.x2 = this.moveOrigX2 + dx;
                ann.y2 = this.moveOrigY2 + dy;
                this.render();
            }
        }
    },

    _onMouseUp(e) {
        if (e.button === 2) {
            this.isPanning = false;
            return;
        }
        if (e.button !== 0) return;

        if (this.isDrawing) {
            this.isDrawing = false;
            const effectiveTool = this._getEffectiveTool(e);
            const dx = Math.abs(this.drawCurrentX - this.drawStartX);
            const dy = Math.abs(this.drawCurrentY - this.drawStartY);

            if (dx >= 3 && dy >= 3) {
                const classSelector = document.getElementById('classSelector');
                const classId = parseInt(classSelector.value);
                if (isNaN(classId)) {
                    alert('请先选择类别');
                    this.render();
                    return;
                }

                const ann = {
                    id: generateId(),
                    class_id: classId,
                    shape: effectiveTool,
                    x1: this.drawStartX,
                    y1: this.drawStartY,
                    x2: this.drawCurrentX,
                    y2: this.drawCurrentY,
                };
                AppState.currentAnnotations.push(ann);
                AppState.selectedAnnotationId = ann.id;

                saveCurrentAnnotations();
                UndoStack.push({ type: 'create', annotation: ann });
                document.dispatchEvent(new CustomEvent('annotation:selected'));
                updateStatusBar();
            }
            this.render();
        }

        if (this.isMoving) {
            this.isMoving = false;
            const ann = AppState.currentAnnotation;
            if (ann) {
                const dx = ann.x1 - this.moveOrigX1;
                const dy = ann.y1 - this.moveOrigY1;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    UndoStack.push({
                        type: 'move',
                        annotationId: ann.id,
                        from: { x1: this.moveOrigX1, y1: this.moveOrigY1,
                                x2: this.moveOrigX2, y2: this.moveOrigY2 },
                        to: { x1: ann.x1, y1: ann.y1, x2: ann.x2, y2: ann.y2 },
                    });
                    saveCurrentAnnotations();
                }
            }
        }
    },

    _onWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoom(factor, e.offsetX, e.offsetY);
        }
    },

    _hitTest(ix, iy) {
        for (let i = AppState.currentAnnotations.length - 1; i >= 0; i--) {
            const a = AppState.currentAnnotations[i];
            const xMin = Math.min(a.x1, a.x2);
            const xMax = Math.max(a.x1, a.x2);
            const yMin = Math.min(a.y1, a.y2);
            const yMax = Math.max(a.y1, a.y2);

            if (ix < xMin || ix > xMax || iy < yMin || iy > yMax) continue;

            if (a.shape === 'rect' || a.shape === 'square') {
                return a;
            }

            if (a.shape === 'ellipse' || a.shape === 'circle') {
                const cx = (a.x1 + a.x2) / 2;
                const cy = (a.y1 + a.y2) / 2;
                const rx = Math.abs(a.x2 - a.x1) / 2;
                const ry = Math.abs(a.y2 - a.y1) / 2;
                if (rx > 0 && ry > 0) {
                    const dx = (ix - cx) / rx;
                    const dy = (iy - cy) / ry;
                    if (dx * dx + dy * dy <= 1) return a;
                }
            }
        }
        return null;
    },

    _isOnAnnotation(e) {
        const imgPt = this.screenToImage(e.offsetX, e.offsetY);
        return this._hitTest(imgPt.x, imgPt.y) !== null;
    },
};

// ── 十字准星模块 ──────────────────────────────────────────

const Crosshair = {
    visible: true,

    render(canvas) {
        if (!AppState.currentImage) return;
        const img = AppState.currentImage;
        const cx = img.width / 2;
        const cy = img.height / 2;

        const sc = canvas.imageToScreen(cx, 0);
        const sc2 = canvas.imageToScreen(cx, img.height);
        const sc3 = canvas.imageToScreen(0, cy);
        const sc4 = canvas.imageToScreen(img.width, cy);

        const ctx = canvas.ctx;
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y);
        ctx.lineTo(sc2.x, sc2.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sc3.x, sc3.y);
        ctx.lineTo(sc4.x, sc4.y);
        ctx.stroke();

        ctx.restore();
    },
};
