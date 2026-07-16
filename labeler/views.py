import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime

from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from . import utils


def _json_response(data, status=200):
    """返回 JSON 响应。"""
    return JsonResponse(data, status=status, json_dumps_params={'ensure_ascii': False})


def _parse_body(request):
    """解析 JSON 请求体。"""
    try:
        return json.loads(request.body)
    except (json.JSONDecodeError, AttributeError):
        return {}


def _create_default_classes(project_dir):
    """创建默认空类别配置。"""
    default = {'classes': []}
    with open(project_dir / 'classes.json', 'w', encoding='utf-8') as f:
        json.dump(default, f, indent=2, ensure_ascii=False)


# ── 项目管理 API ────────────────────────────────────────────

@csrf_exempt
def project_list(request):
    """GET: 列出所有项目 / POST: 创建新项目"""
    registry = utils.load_project_registry()

    if request.method == 'GET':
        projects = []
        for pid, info in registry.items():
            project_dir = utils.PROJECTS_ROOT / pid
            projects.append({
                'id': pid,
                'name': info.get('name', pid),
                'image_count': info.get('image_count', 0),
                'annotated_count': info.get('annotated_count', 0),
                'last_opened': info.get('last_opened', ''),
                'exists': project_dir.exists(),
            })
        projects.sort(key=lambda p: p.get('last_opened', ''), reverse=True)
        return _json_response({'projects': projects})

    elif request.method == 'POST':
        body = _parse_body(request)
        name = body.get('name', '').strip()
        image_directory = body.get('image_directory', '').strip()
        class_config = body.get('class_config', '').strip()

        # 校验项目名称
        if not name or not utils.VALID_PROJECT_NAME.match(name):
            return _json_response(
                {'error': '项目名称仅允许字母、数字、下划线、中文'}, status=400)

        # 校验图片目录
        img_dir = Path(image_directory)
        if not img_dir.exists():
            return _json_response(
                {'error': f'图片目录不存在: {image_directory}'}, status=400)

        images = utils.scan_images(img_dir)
        if not images:
            return _json_response(
                {'error': f'图片目录中无支持的图片文件: {image_directory}'}, status=400)

        # 生成项目 ID
        project_id = str(uuid.uuid4())[:8]

        # 创建项目目录结构
        project_dir = utils.ensure_project_dir(project_id)

        # 处理类别配置
        if class_config:
            class_config_path = Path(class_config)
            if class_config_path.exists():
                shutil.copy(class_config_path, project_dir / 'classes.json')
            else:
                _create_default_classes(project_dir)
        else:
            _create_default_classes(project_dir)

        # 复制图片到项目目录 + 生成缩略图
        images_dir = project_dir / 'images'
        thumb_dir = project_dir / '.thumbnails'
        for img_name in images:
            src = img_dir / img_name
            dst = images_dir / img_name
            try:
                shutil.copy2(str(src), str(dst))
            except Exception:
                pass  # 单张复制失败不影响项目创建
            thumb = thumb_dir / f"{img_name}.thumb.jpg"
            try:
                utils.generate_thumbnail(str(src), str(thumb))
            except Exception:
                pass

        # 重新扫描项目目录（以实际复制成功的图片为准）
        actual_images = utils.scan_images(images_dir)

        # 记录到注册表
        registry[project_id] = {
            'name': name,
            'image_directory': str(images_dir.absolute()),
            'image_count': len(actual_images),
            'annotated_count': 0,
            'created_at': datetime.now().isoformat(),
            'last_opened': datetime.now().isoformat(),
            'class_config_path': str(project_dir / 'classes.json'),
        }
        utils.save_project_registry(registry)

        return _json_response({
            'id': project_id,
            'name': name,
            'image_count': len(actual_images),
            'created_at': registry[project_id]['created_at'],
        }, status=201)

    return _json_response({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def project_detail(request, project_id):
    """GET: 项目详情 / DELETE: 删除项目"""
    registry = utils.load_project_registry()

    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    if request.method == 'GET':
        info = registry[project_id]
        project_dir = utils.PROJECTS_ROOT / project_id

        # 启动时完整性检查
        integrity_warnings = utils.verify_project_integrity(project_dir)

        # 更新标注统计
        labels_dir = project_dir / 'labels'
        annotated_count = 0
        if labels_dir.exists():
            for f in labels_dir.iterdir():
                if f.suffix == '.txt' and f.stat().st_size > 0:
                    annotated_count += 1
        info['annotated_count'] = annotated_count
        info['image_count'] = len(utils.scan_images(project_dir / 'images'))

        # 更新最后打开时间
        info['last_opened'] = datetime.now().isoformat()
        utils.save_project_registry(registry)

        # 加载类别配置
        classes = []
        classes_path = project_dir / 'classes.json'
        if classes_path.exists():
            with open(classes_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                classes = data.get('classes', [])

        return _json_response({
            'id': project_id,
            'name': info['name'],
            'image_count': info['image_count'],
            'annotated_count': annotated_count,
            'classes': classes,
            'last_opened': info.get('last_opened', ''),
            'integrity_warnings': integrity_warnings,
        })

    elif request.method == 'DELETE':
        project_dir = utils.PROJECTS_ROOT / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)
        del registry[project_id]
        utils.save_project_registry(registry)
        return _json_response({'success': True})

    return _json_response({'error': 'Method not allowed'}, status=405)


# ── 图片 API ────────────────────────────────────────────────

@csrf_exempt
def image_list(request, project_id):
    """GET: 获取项目所有图片列表及状态"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    images_dir = project_dir / 'images'
    labels_dir = project_dir / 'labels'

    status_filter = request.GET.get('status', 'all')
    page = int(request.GET.get('page', 1))
    per_page = int(request.GET.get('per_page', 100))

    all_images = utils.scan_images(images_dir)

    # 构建图片状态列表
    meta_dir = project_dir / '.meta'
    image_list_data = []
    for img_name in all_images:
        stem = Path(img_name).stem
        txt_path = labels_dir / f"{stem}.txt"
        reviewed_path = meta_dir / f"{stem}.reviewed.json"
        annotation_count = 0
        if txt_path.exists():
            anns = utils.read_txt_annotations(txt_path)
            annotation_count = len(anns)
        # 三态：已审核 > 已标注 > 未标注
        if reviewed_path.exists():
            status = 'reviewed'
        elif annotation_count > 0:
            status = 'annotated'
        else:
            status = 'unannotated'
        image_list_data.append({
            'file': img_name,
            'status': status,
            'annotation_count': annotation_count,
        })

    # 筛选
    if status_filter in ('reviewed', 'annotated', 'unannotated'):
        image_list_data = [i for i in image_list_data if i['status'] == status_filter]

    total = len(image_list_data)
    start = (page - 1) * per_page
    end = start + per_page
    page_data = image_list_data[start:end]

    return _json_response({
        'total': total,
        'page': page,
        'per_page': per_page,
        'images': page_data,
    })


def image_detail(request, project_id, image_name):
    """GET: 获取单张图片详情（尺寸 + 已有标注）"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    image_path = project_dir / 'images' / image_name

    if not image_path.exists():
        return _json_response({'error': '图片不存在'}, status=404)

    img_w, img_h = utils.get_image_size(str(image_path))

    # 读取已有标注
    txt_path = project_dir / 'labels' / f"{Path(image_name).stem}.txt"
    raw_annotations = utils.read_txt_annotations(txt_path)

    # 从 .meta/ 读取形状信息
    meta_path = project_dir / '.meta' / f"{Path(image_name).stem}.meta.json"
    meta_list = []
    meta_mismatch = False
    if meta_path.exists():
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta_list = json.load(f)
        except (json.JSONDecodeError, IOError):
            meta_list = []
        if len(meta_list) != len(raw_annotations):
            meta_mismatch = True

    annotations = []
    for i, ann in enumerate(raw_annotations):
        x1, y1, x2, y2 = utils.yolo_to_pixel(
            ann['cx'], ann['cy'], ann['w'], ann['h'], img_w, img_h)
        # 数量匹配时从 .meta 读取形状，不匹配时回退为 rect
        shape = 'rect'
        if i < len(meta_list) and not meta_mismatch:
            shape = meta_list[i].get('shape', 'rect')
        annotations.append({
            'id': '',  # 前端会分配
            'class_id': ann['class_id'],
            'shape': shape,
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
        })

    # 检查审核状态
    reviewed_path = project_dir / '.meta' / f"{Path(image_name).stem}.reviewed.json"
    if reviewed_path.exists():
        status = 'reviewed'
    elif annotations:
        status = 'annotated'
    else:
        status = 'unannotated'

    return _json_response({
        'file': image_name,
        'width': img_w,
        'height': img_h,
        'status': status,
        'annotations': annotations,
        'meta_mismatch': meta_mismatch,
    })


def image_data(request, project_id, image_name):
    """GET: 返回原图文件"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    image_path = utils.PROJECTS_ROOT / project_id / 'images' / image_name
    if not image_path.exists():
        return _json_response({'error': '图片不存在'}, status=404)

    return FileResponse(open(str(image_path), 'rb'), content_type='image/png')


def image_thumbnail(request, project_id, image_name):
    """GET: 返回缩略图"""
    thumb_path = utils.PROJECTS_ROOT / project_id / '.thumbnails' / f"{image_name}.thumb.jpg"
    if not thumb_path.exists():
        return _json_response({'error': '缩略图不存在'}, status=404)

    return FileResponse(open(str(thumb_path), 'rb'), content_type='image/jpeg')


@csrf_exempt
def save_annotations(request, project_id, image_name):
    """PUT: 保存该图片的标注数据（全量替换）"""
    if request.method != 'PUT':
        return _json_response({'error': 'Method not allowed'}, status=405)

    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    image_path = project_dir / 'images' / image_name
    if not image_path.exists():
        return _json_response({'error': '图片不存在'}, status=404)

    body = _parse_body(request)
    annotations_raw = body.get('annotations', [])
    img_w, img_h = utils.get_image_size(str(image_path))

    # 转换为 YOLO 归一化格式并写入 TXT
    yolo_annotations = []
    for ann in annotations_raw:
        cx, cy, w, h = utils.pixel_to_yolo(
            ann['x1'], ann['y1'], ann['x2'], ann['y2'], img_w, img_h)
        yolo_annotations.append({
            'class_id': ann['class_id'],
            'cx': cx, 'cy': cy, 'w': w, 'h': h,
        })

    txt_path = project_dir / 'labels' / f"{Path(image_name).stem}.txt"
    # 原子写入 TXT
    utils.atomic_write(txt_path, lambda p: utils.write_txt_annotations(p, yolo_annotations))

    # 保存形状元数据到 .meta/
    meta_dir = project_dir / '.meta'
    meta_path = meta_dir / f"{Path(image_name).stem}.meta.json"
    meta_data = []
    for ann in annotations_raw:
        meta_data.append({
            'class_id': ann['class_id'],
            'shape': ann.get('shape', 'rect'),
        })
    utils.atomic_write(meta_path, lambda p: utils._write_json(p, meta_data))

    # 更新项目注册表中的统计
    labels_dir = project_dir / 'labels'
    annotated_count = 0
    if labels_dir.exists():
        for f in labels_dir.iterdir():
            if f.suffix == '.txt' and f.stat().st_size > 0:
                annotated_count += 1
    registry[project_id]['annotated_count'] = annotated_count
    utils.save_project_registry(registry)

    # 如果标注列表为空，清理对应的 TXT 和 meta 文件
    if not annotations_raw:
        if txt_path.exists():
            txt_path.unlink()
        if meta_path.exists():
            meta_path.unlink()

    return _json_response({'success': True, 'saved_count': len(yolo_annotations)})


@csrf_exempt
def toggle_reviewed(request, project_id, image_name):
    """PUT: 切换图片的审核状态"""
    if request.method != 'PUT':
        return _json_response({'error': 'Method not allowed'}, status=405)

    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    body = _parse_body(request)
    reviewed = body.get('reviewed', False)

    meta_dir = utils.PROJECTS_ROOT / project_id / '.meta'
    stem = Path(image_name).stem
    reviewed_path = meta_dir / f"{stem}.reviewed.json"

    if reviewed:
        with open(reviewed_path, 'w', encoding='utf-8') as f:
            json.dump({'reviewed': True, 'timestamp': datetime.now().isoformat()}, f)
    else:
        if reviewed_path.exists():
            reviewed_path.unlink()

    return _json_response({'success': True, 'reviewed': reviewed})


@csrf_exempt
def project_classes(request, project_id):
    """GET: 获取类别配置 / PUT: 更新类别配置"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    classes_path = project_dir / 'classes.json'

    if request.method == 'GET':
        if classes_path.exists():
            with open(classes_path, 'r', encoding='utf-8') as f:
                return _json_response(json.load(f))
        return _json_response({'classes': []})

    elif request.method == 'PUT':
        body = _parse_body(request)
        with open(classes_path, 'w', encoding='utf-8') as f:
            json.dump(body, f, indent=2, ensure_ascii=False)
        return _json_response({'success': True})

    return _json_response({'error': 'Method not allowed'}, status=405)
