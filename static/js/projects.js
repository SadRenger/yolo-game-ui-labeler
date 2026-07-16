document.addEventListener('DOMContentLoaded', () => {
    loadProjects();

    document.getElementById('btnNewProject').addEventListener('click', openNewProjectDialog);
    document.getElementById('btnCancel').addEventListener('click', closeDialog);
    document.getElementById('btnCreate').addEventListener('click', createProject);

    // 浏览按钮：调用 Tauri 原生对话框
    document.getElementById('btnBrowseImage').addEventListener('click', async () => {
        const dir = await TauriBridge.pickDirectory();
        if (dir) document.getElementById('imageDirectory').value = dir;
    });
    document.getElementById('btnBrowseClass').addEventListener('click', async () => {
        const file = await TauriBridge.pickJsonFile();
        if (file) document.getElementById('classConfig').value = file;
    });
});

async function loadProjects() {
    const container = document.getElementById('projectsList');
    try {
        const data = await API.listProjects();
        const projects = data.projects || [];

        if (projects.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无项目<br>点击下方按钮创建第一个项目</div>';
            return;
        }

        container.innerHTML = projects.map(p => {
            const pct = p.image_count > 0
                ? Math.round(p.annotated_count / p.image_count * 100) : 0;
            return `
                <div class="project-card" data-id="${p.id}">
                    <div class="project-card-main" onclick="openProject('${p.id}')">
                        <span class="project-icon">📁</span>
                        <div class="project-info">
                            <div class="project-name">${escapeHtml(p.name)}</div>
                            <div class="project-meta">
                                ${p.image_count} 张图片 · 已标注 ${pct}%
                            </div>
                            <div class="project-date">最后修改: ${p.last_opened?.slice(0, 10) || '-'}</div>
                        </div>
                    </div>
                    <button class="btn-delete-project" onclick="deleteProject(event, '${p.id}')"
                            title="删除项目">🗑</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="error-state">加载失败: ${escapeHtml(err.message)}</div>`;
    }
}

function openProject(id) {
    window.location.href = `annotate.html#${id}`;
}

async function deleteProject(e, id) {
    e.stopPropagation();
    if (!confirm('确定要删除此项目？所有标注数据将被永久删除。')) return;
    try {
        await API.deleteProject(id);
        loadProjects();
    } catch (err) {
        alert('删除失败: ' + err.message);
    }
}

function openNewProjectDialog() {
    document.getElementById('modalOverlay').style.display = 'flex';
    document.getElementById('formError').style.display = 'none';
    document.getElementById('projectName').value = '';
    document.getElementById('imageDirectory').value = '';
    document.getElementById('classConfig').value = '';
}

function closeDialog() {
    document.getElementById('modalOverlay').style.display = 'none';
}

async function createProject() {
    const name = document.getElementById('projectName').value.trim();
    const image_directory = document.getElementById('imageDirectory').value.trim();
    const class_config = document.getElementById('classConfig').value.trim();
    const errorEl = document.getElementById('formError');

    if (!name || !image_directory) {
        errorEl.textContent = '请填写项目名称和图片目录';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const result = await API.createProject({ name, image_directory, class_config });
        window.location.href = `annotate.html#${result.id}`;
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
