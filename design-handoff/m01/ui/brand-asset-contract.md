# 智行官品牌资产契约

状态：APPROVED INPUT / FILE MATERIALIZATION PENDING

## 唯一正式主品牌
用户提供：`V1独立图形-彩色(5).svg`。

前端规范目标路径：
`frontend/src/assets/brand/zhixingguan-logo.svg`

## 完整性规则
源文件与Git目标文件必须逐字节一致；以SHA-256证明。不得重新导出、优化SVG、改viewBox、改path、改渐变、转PNG后替代。

## 使用范围
- AppLayout品牌区；
- HA AI正式Shell；
- 移动端Header；
- 登录/品牌页如后续Design Baseline要求。

## 设计稿规则
生成式高保真图中的Logo仅为布局示意。正式设计资源和Vue实现必须引用原始SVG，因此效果图中的近似Logo不构成品牌资产。

## Gate
在Issue #15完成前：
`BRAND_ASSET_MATERIALIZED = FALSE`
`DESIGN_HANDOFF_READY = FALSE`
