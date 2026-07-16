import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-yolo-game-ui-labeler-local-dev-key'
DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'rest_framework',
]

MIDDLEWARE = [
    'labeler.cors.CorsMiddleware',  # CORS 必须在最前面处理 OPTIONS 预检
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'labeler.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': False,
        'OPTIONS': {'context_processors': []},
    },
]

WSGI_APPLICATION = None  # 不使用 WSGI，仅开发服务器

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']

# 项目数据存储根目录
PROJECTS_ROOT = BASE_DIR / 'projects'

# 确保项目根目录存在
os.makedirs(PROJECTS_ROOT, exist_ok=True)
