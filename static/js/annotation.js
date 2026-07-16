// ── Undo/Redo 栈 ──────────────────────────────────────────

const UndoStack = {
    undoStack: [],
    redoStack: [],
    maxSize: 50,

    push(action) {
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    },

    undo() {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        this._applyUndo(action);
        saveCurrentAnnotations();
        Canvas.render();
        updateStatusBar();
    },

    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        this._applyRedo(action);
        saveCurrentAnnotations();
        Canvas.render();
        updateStatusBar();
    },

    _applyUndo(action) {
        switch (action.type) {
            case 'create':
                const idx = AppState.currentAnnotations.findIndex(
                    a => a.id === action.annotation.id);
                if (idx !== -1) AppState.currentAnnotations.splice(idx, 1);
                if (AppState.selectedAnnotationId === action.annotation.id) {
                    AppState.selectedAnnotationId = null;
                    document.dispatchEvent(new CustomEvent('annotation:deselected'));
                }
                break;

            case 'delete':
                AppState.currentAnnotations.splice(
                    action.index, 0, action.annotation);
                AppState.selectedAnnotationId = action.annotation.id;
                document.dispatchEvent(new CustomEvent('annotation:selected'));
                break;

            case 'move':
                const ann = AppState.currentAnnotations.find(
                    a => a.id === action.annotationId);
                if (ann) {
                    ann.x1 = action.from.x1;
                    ann.y1 = action.from.y1;
                    ann.x2 = action.from.x2;
                    ann.y2 = action.from.y2;
                }
                break;

            case 'changeClass':
                const a = AppState.currentAnnotations.find(
                    an => an.id === action.annotationId);
                if (a) {
                    a.class_id = action.from_class_id;
                    document.dispatchEvent(new CustomEvent('annotation:selected'));
                }
                break;
        }
    },

    _applyRedo(action) {
        switch (action.type) {
            case 'create':
                AppState.currentAnnotations.push(action.annotation);
                AppState.selectedAnnotationId = action.annotation.id;
                document.dispatchEvent(new CustomEvent('annotation:selected'));
                break;

            case 'delete':
                const idx = AppState.currentAnnotations.findIndex(
                    a => a.id === action.annotation.id);
                if (idx !== -1) AppState.currentAnnotations.splice(idx, 1);
                AppState.selectedAnnotationId = null;
                document.dispatchEvent(new CustomEvent('annotation:deselected'));
                break;

            case 'move':
                const ann = AppState.currentAnnotations.find(
                    a => a.id === action.annotationId);
                if (ann) {
                    ann.x1 = action.to.x1;
                    ann.y1 = action.to.y1;
                    ann.x2 = action.to.x2;
                    ann.y2 = action.to.y2;
                }
                break;

            case 'changeClass':
                const a = AppState.currentAnnotations.find(
                    an => an.id === action.annotationId);
                if (a) {
                    a.class_id = action.to_class_id;
                    document.dispatchEvent(new CustomEvent('annotation:selected'));
                }
                break;
        }
    },

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    },
};
