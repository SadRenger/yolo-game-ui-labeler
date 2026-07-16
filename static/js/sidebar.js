// ── 图片列表侧边栏 ────────────────────────────────────────

const Sidebar = {
    currentFilter: 'all',

    init() {
        this._bindFilterButtons();
        document.addEventListener('imagelist:updated', () => this.render());
        document.addEventListener('image:loaded', () => this._highlightCurrent());
    },

    _bindFilterButtons() {
        const btns = document.querySelectorAll('.filter-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', async () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                await loadImageList(this.currentFilter);
                if (AppState.images.length > 0) {
                    await loadImage(0);
                }
            });
        });
    },

    render() {
        const container = document.getElementById('imageList');
        const images = AppState.images;

        if (images.length === 0) {
            container.innerHTML = '<div class="loading">暂无图片</div>';
            return;
        }

        container.innerHTML = images.map((img, idx) => {
            const statusLabels = { reviewed: '已审核', annotated: '已标注', unannotated: '未标注' };
            return `
            <div class="image-item ${idx === AppState.currentIndex ? 'active' : ''}"
                 data-index="${idx}" onclick="Sidebar.selectImage(${idx})">
                <img class="thumb"
                     src="${API.getThumbnailUrl(AppState.projectId, img.file)}"
                     alt="${img.file}"
                     loading="lazy"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2245%22><rect fill=%22%23333%22 width=%2280%22 height=%2245%22/></svg>'">
                <div class="file-info">
                    <div class="file-name" title="${img.file}">${img.file}</div>
                    <div class="file-status">
                        <span class="status-dot ${img.status}"></span>
                        ${statusLabels[img.status] || img.status}
                    </div>
                </div>
            </div>
        `}).join('');
    },

    async selectImage(index) {
        await loadImage(index);
    },

    _highlightCurrent() {
        const items = document.querySelectorAll('.image-item');
        items.forEach(item => {
            item.classList.toggle('active',
                parseInt(item.dataset.index) === AppState.currentIndex);
        });
        const active = document.querySelector('.image-item.active');
        if (active) {
            active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },
};

Sidebar.init();
