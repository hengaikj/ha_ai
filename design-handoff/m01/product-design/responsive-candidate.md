# M01 响应式 Candidate

状态：DRAFT。

优先沿用既有Vue工程的Breakpoint与AppLayout行为，不新建第二套响应式系统。

设计验证至少覆盖：
- Desktop：现有主工作尺寸；
- Narrow：常见笔记本窄内容区；
- Mobile：现有工程支持范围内的375/390宽度验证。

表格、操作区、Dialog等具体移动策略必须在读取现有组件行为后确认；本Candidate不预设“表格必转卡片”等新规则。
