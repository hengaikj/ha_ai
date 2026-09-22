<script setup lang="ts">
import { computed } from "vue";
import {
  Aim,
  Avatar,
  Briefcase,
  Calendar,
  Clock,
  Coin,
  Collection,
  Connection,
  Cpu,
  DataAnalysis,
  DataBoard,
  Document,
  DocumentAdd,
  DocumentChecked,
  DocumentCopy,
  Download,
  Edit,
  Files,
  Folder,
  Grid,
  Histogram,
  HomeFilled,
  House,
  Key,
  List,
  Lock,
  Management,
  Menu,
  Memo,
  Monitor,
  Notebook,
  OfficeBuilding,
  Operation,
  PieChart,
  Reading,
  Refresh,
  Setting,
  Stopwatch,
  Suitcase,
  Tickets,
  Tools,
  TrendCharts,
  Unlock,
  Upload,
  User,
  UserFilled,
  Van,
  View,
  Wallet,
  Warning,
} from "@element-plus/icons-vue";
import type { MenuNode } from "@/types/auth";

const props = withDefaults(
  defineProps<{
    item: MenuNode;
    level?: number;
  }>(),
  {
    level: 0,
  },
);

const hasChildren = computed(() => Boolean(props.item.children?.length));
const menuIndex = computed(() => props.item.path || props.item.code);
const menuClasses = computed(() => [
  "sidebar-menu-item",
  `is-level-${props.level}`,
]);

const normalizeIconKey = (value?: string) =>
  value
    ?.trim()
    .replace(/^el-icon-/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/_/g, "-") ?? "";

const iconAliases = {
  add: DocumentAdd,
  aim: Aim,
  avatar: Avatar,
  board: DataBoard,
  budget: Wallet,
  calendar: Calendar,
  chart: Histogram,
  check: DocumentChecked,
  "circle-check": DocumentChecked,
  clipboard: DocumentChecked,
  code: Cpu,
  component: Grid,
  components: Grid,
  connection: Connection,
  cost: Briefcase,
  costmanagement: Briefcase,
  costmanagementnew: Briefcase,
  "cost-management": Briefcase,
  "cost-management-new": Briefcase,
  "data-board": DataBoard,
  "data-analysis": DataAnalysis,
  dashboard: DataBoard,
  date: Calendar,
  dict: Notebook,
  document: Document,
  download: Download,
  edit: Edit,
  education: Reading,
  email: Memo,
  example: Grid,
  files: Files,
  folder: Folder,
  form: DocumentChecked,
  guide: Reading,
  home: House,
  "home-filled": HomeFilled,
  income: Coin,
  international: Monitor,
  information: Files,
  job: Suitcase,
  key: Key,
  list: List,
  lock: Lock,
  log: Memo,
  meeting: Calendar,
  meet: Calendar,
  menu: Menu,
  message: Memo,
  monitor: Monitor,
  nested: OfficeBuilding,
  online: Monitor,
  password: Lock,
  people: Avatar,
  peoples: UserFilled,
  "pre-meeting": Stopwatch,
  product: Management,
  profile: User,
  project: Management,
  question: Memo,
  refresh: Refresh,
  report: Histogram,
  revenue: Coin,
  search: View,
  setting: Setting,
  showcase: DataAnalysis,
  shouyi: Coin,
  statement: PieChart,
  system: Setting,
  table: Histogram,
  task: Operation,
  "task-center": Operation,
  template: Document,
  "template-center": DocumentCopy,
  time: Clock,
  "time-range": Clock,
  tool: Tools,
  tree: OfficeBuilding,
  unlock: Unlock,
  upload: Upload,
  user: User,
  validcode: Key,
  view: View,
  warning: Warning,
  xitong: Setting,
  xiangmu: Management,
  yusuan: Wallet,
} as const;

const nameIconRules = [
  { keywords: ["看板", "首页"], icon: DataBoard },
  { keywords: ["预算"], icon: Wallet },
  { keywords: ["收益", "收入"], icon: Coin },
  { keywords: ["成本", "价格", "报价"], icon: Briefcase },
  { keywords: ["车型"], icon: Van },
  { keywords: ["项目"], icon: Management },
  { keywords: ["预备会"], icon: Stopwatch },
  { keywords: ["会议", "上会"], icon: Calendar },
  { keywords: ["委员会"], icon: OfficeBuilding },
  { keywords: ["报表", "统计"], icon: Histogram },
  { keywords: ["分析"], icon: DataAnalysis },
  { keywords: ["系统", "设置", "配置", "参数"], icon: Setting },
  { keywords: ["监控"], icon: Monitor },
  { keywords: ["工具"], icon: Tools },
  { keywords: ["信息"], icon: Files },
  { keywords: ["字典"], icon: Notebook },
  { keywords: ["模板"], icon: Document },
  { keywords: ["任务"], icon: Operation },
  { keywords: ["日志"], icon: Memo },
  { keywords: ["菜单"], icon: Grid },
  { keywords: ["角色"], icon: UserFilled },
  { keywords: ["用户"], icon: User },
  { keywords: ["部门"], icon: OfficeBuilding },
  { keywords: ["岗位"], icon: Suitcase },
  { keywords: ["导入"], icon: Collection },
  { keywords: ["导出"], icon: Tickets },
  { keywords: ["文档"], icon: Reading },
  { keywords: ["文件"], icon: Folder },
  { keywords: ["趋势"], icon: TrendCharts },
] as const;

const resolveAliasIcon = (value?: string) => {
  const key = normalizeIconKey(value);
  if (!key) {
    return undefined;
  }
  return iconAliases[key as keyof typeof iconAliases];
};

const rootIcon = computed(() => {
  const codeSegments = props.item.code.split(":");
  const pathSegments = props.item.path.split("/").filter(Boolean);
  const candidates = [
    props.item.icon,
    props.item.code,
    codeSegments[0],
    codeSegments[codeSegments.length - 1],
    pathSegments[0],
    pathSegments[pathSegments.length - 1],
  ];

  for (const candidate of candidates) {
    const matchedIcon = resolveAliasIcon(candidate);
    if (matchedIcon) {
      return matchedIcon;
    }
  }

  const title = props.item.title ?? "";
  const nameRule = nameIconRules.find((rule) =>
    rule.keywords.some((keyword) => title.includes(keyword)),
  );
  return nameRule?.icon ?? Menu;
});
</script>

<template>
  <el-sub-menu v-if="hasChildren" :index="menuIndex" :class="menuClasses">
    <template #title>
      <el-icon v-if="level === 0" class="sidebar-menu-item__icon">
        <component :is="rootIcon" />
      </el-icon>
      <span v-else class="sidebar-menu-item__dot" aria-hidden="true" />
      <span :title="item.title">{{ item.title }}</span>
    </template>
    <SidebarMenuItem
      v-for="child in item.children"
      :key="child.code"
      :item="child"
      :level="level + 1"
    />
  </el-sub-menu>

  <el-menu-item
    v-else
    :index="menuIndex"
    :title="item.title"
    :class="menuClasses"
  >
    <el-icon v-if="level === 0" class="sidebar-menu-item__icon">
      <component :is="rootIcon" />
    </el-icon>
    <span v-else class="sidebar-menu-item__dot" aria-hidden="true" />
    <span :title="item.title">{{ item.title }}</span>
  </el-menu-item>
</template>
