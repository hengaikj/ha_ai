# 平台端 AI 页面

## PAGE-LOGICAL-MODELS
接口：GET/POST /api/platform/models。

## PAGE-PROVIDERS
接口：GET/POST /api/platform/providers。Provider Credential不得通过普通查询返回明文。

## PAGE-CHANNELS
接口：GET/POST /api/platform/channels。

三页均复用AppLayout + BasePageHeader + BaseDataTable + PermissionButton。权限基线：Model/Channel Operator。

具体列表字段与创建表单字段在完整components schema核对完成前保持UNKNOWN，不为了高保真效果补造。
