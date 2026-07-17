from django.urls import path
from django.shortcuts import render
from . import views

def index(request, project_id=None):
    return render(request, 'index.html')

def projects_page(request):
    return render(request, 'projects.html')

urlpatterns = [
    # 页面路由
    path('', projects_page, name='projects'),
    path('annotate/<str:project_id>/', index, name='annotate'),

    # API 路由
    path('api/projects/', views.project_list, name='api_project_list'),
    path('api/projects/<str:project_id>/', views.project_detail, name='api_project_detail'),
    path('api/projects/<str:project_id>/images/', views.image_list, name='api_image_list'),
    # 子路径用 <str:> 精确匹配，避免 path 贪婪匹配吃掉后缀路径
    path('api/projects/<str:project_id>/images/<str:image_name>/data/', views.image_data, name='api_image_data'),
    path('api/projects/<str:project_id>/images/<str:image_name>/thumbnail/', views.image_thumbnail, name='api_image_thumbnail'),
    path('api/projects/<str:project_id>/images/<str:image_name>/annotations/', views.save_annotations, name='api_save_annotations'),
    path('api/projects/<str:project_id>/images/<str:image_name>/reviewed/', views.toggle_reviewed, name='api_toggle_reviewed'),
    path('api/projects/<str:project_id>/images/<path:image_name>/', views.image_detail, name='api_image_detail'),
    path('api/projects/<str:project_id>/classes/', views.project_classes, name='api_project_classes'),
]
