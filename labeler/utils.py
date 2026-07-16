import os
import json
import re
from pathlib import Path
from django.conf import settings
from PIL import Image

PROJECTS_ROOT = settings.PROJECTS_ROOT
REGISTRY_FILE = PROJECTS_ROOT / '.projects.json'
VALID_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
VALID_PROJECT_NAME = re.compile(r'^[\w一-鿿\-]+$')
THUMBNAIL_SIZE = (160, 90)


def load_project_registry():
    """加载项目注册表，不存在则返回空 dict。"""
    if REGISTRY_FILE.exists():
        with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_project_registry(registry):
    """保存项目注册表。"""
    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)


def ensure_project_dir(project_id):
    """确保项目目录结构存在，返回项目根 Path。"""
    project_dir = PROJECTS_ROOT / project_id
    for sub in ['images', 'labels', '.meta', '.thumbnails']:
        (project_dir / sub).mkdir(parents=True, exist_ok=True)
    return project_dir


def scan_images(directory):
    """扫描目录下所有支持的图片文件，返回按文件名排序的列表。"""
    directory = Path(directory)
    images = []
    if not directory.exists():
        return images
    for f in directory.iterdir():
        if f.is_file() and f.suffix.lower() in VALID_IMAGE_EXTENSIONS:
            images.append(f.name)
    # 自然排序
    images.sort(key=lambda n: [int(c) if c.isdigit() else c.lower()
                                for c in re.split(r'(\d+)', n)])
    return images


def generate_thumbnail(image_path, thumb_path, size=THUMBNAIL_SIZE):
    """生成缩略图并保存到 thumb_path。"""
    with Image.open(image_path) as img:
        img.thumbnail(size, Image.LANCZOS)
        img.save(thumb_path, format='JPEG', quality=75)


def pixel_to_yolo(x1, y1, x2, y2, img_w, img_h):
    """像素坐标 (对角点, 任意方向) → YOLO 归一化 (cx, cy, w, h)

    Returns: (cx, cy, w, h) 均为 0~1 浮点数
    """
    x_min, x_max = min(x1, x2), max(x1, x2)
    y_min, y_max = min(y1, y2), max(y1, y2)
    w = x_max - x_min
    h = y_max - y_min
    cx = x_min + w / 2
    cy = y_min + h / 2
    return (
        round(cx / img_w, 6),
        round(cy / img_h, 6),
        round(w / img_w, 6),
        round(h / img_h, 6),
    )


def yolo_to_pixel(cx, cy, w, h, img_w, img_h):
    """YOLO 归一化 → 像素坐标 (x1, y1, x2, y2)"""
    x_center = cx * img_w
    y_center = cy * img_h
    width = w * img_w
    height = h * img_h
    return (
        round(x_center - width / 2),
        round(y_center - height / 2),
        round(x_center + width / 2),
        round(y_center + height / 2),
    )


def read_txt_annotations(txt_path):
    """读取 YOLO 格式 TXT 文件，返回标注列表。

    每行格式: class_id x_center y_center width height
    Returns: [{'class_id': int, 'cx': float, 'cy': float, 'w': float, 'h': float}, ...]
    """
    annotations = []
    if not txt_path.exists():
        return annotations
    with open(txt_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 5:
                annotations.append({
                    'class_id': int(parts[0]),
                    'cx': float(parts[1]),
                    'cy': float(parts[2]),
                    'w': float(parts[3]),
                    'h': float(parts[4]),
                })
    return annotations


def write_txt_annotations(txt_path, annotations):
    """写入 YOLO 格式 TXT 文件。

    Args:
        txt_path: Path 对象
        annotations: [{'class_id': int, 'cx': float, 'cy': float, 'w': float, 'h': float}, ...]
    """
    if not annotations:
        # 如果标注列表为空，删除文件（清空标注）
        if txt_path.exists():
            txt_path.unlink()
        return
    with open(txt_path, 'w') as f:
        for ann in annotations:
            f.write(f"{ann['class_id']} {ann['cx']:.6f} {ann['cy']:.6f} "
                    f"{ann['w']:.6f} {ann['h']:.6f}\n")


def get_image_size(image_path):
    """获取图片尺寸 (width, height)。"""
    with Image.open(image_path) as img:
        return img.size


def _write_json(path, data):
    """写入 JSON 文件。"""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def atomic_write(path, write_func):
    """原子写入：先写同目录临时文件，成功后 os.replace 原子替换。

    避免写入过程中进程崩溃或磁盘满导致文件损坏。
    """
    tmp_path = path.parent / f".tmp_{path.name}"
    write_func(tmp_path)
    os.replace(tmp_path, path)  # 原子替换，跨平台支持


def verify_project_integrity(project_dir, labels_dir=None):
    """扫描 labels/ 与 .meta/ 的一致性，返回警告列表。

    Returns: [{'file': str, 'issue': str, 'severity': 'warning'|'error'}, ...]
    """
    warnings = []
    if labels_dir is None:
        labels_dir = project_dir / 'labels'
    meta_dir = project_dir / '.meta'

    if not labels_dir.exists():
        return warnings

    for txt_file in labels_dir.glob('*.txt'):
        stem = txt_file.stem
        meta_file = meta_dir / f"{stem}.meta.json"
        reviewed_file = meta_dir / f"{stem}.reviewed.json"

        # TXT 存在但 .meta.json 不存在
        if txt_file.stat().st_size > 0 and not meta_file.exists():
            warnings.append({
                'file': stem, 'severity': 'warning',
                'issue': 'TXT 标注存在但形状元数据缺失，标注将以矩形+虚线显示',
            })

        # .meta.json 存在但 TXT 不存在或为空
        if meta_file.exists():
            txt_empty = not txt_file.exists() or txt_file.stat().st_size == 0
            if txt_empty:
                warnings.append({
                    'file': stem, 'severity': 'warning',
                    'issue': '形状元数据存在但无对应标注，将自动清理',
                })
                meta_file.unlink()  # 清理孤立文件

        # 行数不一致
        if txt_file.stat().st_size > 0 and meta_file.exists():
            txt_count = len(read_txt_annotations(txt_file))
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    meta_count = len(json.load(f))
                if txt_count != meta_count:
                    warnings.append({
                        'file': stem, 'severity': 'error',
                        'issue': f'TXT 有 {txt_count} 行但 .meta 有 {meta_count} 条，标注形状将回退为矩形',
                    })
            except (json.JSONDecodeError, IOError):
                warnings.append({
                    'file': stem, 'severity': 'error',
                    'issue': '.meta 文件损坏，标注形状将回退为矩形',
                })

        # 审核标记孤立检查
        if reviewed_file.exists():
            if not txt_file.exists() or txt_file.stat().st_size == 0:
                warnings.append({
                    'file': stem, 'severity': 'warning',
                    'issue': '审核标记存在但无标注，将自动清理',
                })
                reviewed_file.unlink()

    return warnings
