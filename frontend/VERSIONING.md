# 版本管理规范

## 分支职责

- `development`：保存全部模块的最新完整开发状态，所有日常任务分支从这里创建并通过合并请求返回。
- `develop`：完整代码的稳定提测分支，也是测试环境唯一部署来源；只按审批通过的提测批次推进。
- `release/<version>`：从验收通过的 `develop` 创建，只接受对应版本的发布阻断问题修复。
- `main`：正式稳定分支，只有正式验收通过后才允许合入并创建不可移动的版本标签。
- `archive/full-development-20260711`：版本整理前完整代码归档，禁止删除、强推和日常开发。

## 开发与测试流转

1. 全模块开发从 `development` 创建 `<type>/<module>-<issue>-<topic>` 任务分支。
2. 到达提测窗口后，将选定的 `development` 提交作为完整批次合入 `develop`，三仓提交必须成组记录。
3. 测试缺陷从当前 `develop` 创建修复分支，先合入 `develop`，随后正常合并 `develop -> development`。
4. `develop` 验收通过后创建 `release/<version>`，候选版本使用 `<version>-rc.N`，不创建正式标签。
5. `release/<version>` 上的修复必须同步回 `develop` 和 `development`。

## 强制要求

- `develop` 初始化完成后必须保留连续历史，禁止再次清空、强推或 orphan 重建。
- `development`、`develop` 和 `release/*` 禁止直接提交，必须通过短期分支和合并请求保留评审记录。
- 提交标题、提交正文、代码注释、标签说明和发布说明必须使用中文；技术标识和 Conventional Commits 类型可以保留英文。
- 测试环境只部署固定提交、固定版本和镜像摘要，禁止使用 `latest`。

## 分支同步治理

- `develop` 是 `development` 的祖先；维护时必须保持两条分支有共同基线，禁止再次 orphan 重建或制造 unrelated histories。
- `development -> develop` 只在提测窗口按选定提交批次执行；测试期间禁止继续整体同步后续开发提交。
- 测试缺陷先进入 `develop`，再通过 `develop -> development` 同步回完整开发线。
- 外部依赖未具备的页面通过环境开关、菜单准入和权限控制，不再通过从 `develop` 删除页面控制测试范围。
- `develop-next` / `development-next` 仅作为历史接管临时分支；接管完成并确认别名一致后应删除，不作为长期开发入口。
