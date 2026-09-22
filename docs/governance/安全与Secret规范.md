# 安全与 Secret 规范

禁止提交或传播：企业完整 API Key、Provider Credential、支付宝/微信支付密钥和私钥、生产数据库/Redis密码、生产Token。

API Key完整Secret只在创建时展示一次；持久化使用不可逆摘要。Provider Credential必须受控读取，普通管理查询不得返回明文。日志、测试报告、截图、PR必须脱敏。真实凭证通过环境变量或Secret管理机制注入。
