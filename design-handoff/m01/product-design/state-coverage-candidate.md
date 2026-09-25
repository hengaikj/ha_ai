# M01 页面状态覆盖 Candidate

所有列表型页面至少设计：NORMAL、LOADING、EMPTY、ERROR、FORBIDDEN（仅在权限模型适用时）。

API Key页面额外覆盖已批准业务语义能够支持的状态，例如 ENABLED / DISABLED / REVOKED / EXPIRED；不得由UI自行新增Key生命周期状态。

模型权限页面必须区分已授权与未授权展示，但后端权限仍为最终权威。

具体业务状态如在正式Requirement/Contract中没有依据，标记 DESIGN_CLARIFICATION_REQUIRED。
