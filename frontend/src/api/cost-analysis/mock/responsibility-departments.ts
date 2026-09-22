import type {
  CostAnalysisCategoryNode,
  CostAnalysisDimensionType,
} from "@/types/cost-analysis";

const DIMENSION_TYPE: CostAnalysisDimensionType = "RESPONSIBILITY_DEPARTMENT";

type ResponsibilityGroupDefinition = readonly [
  key: string,
  code: string,
  name: string,
  departments: readonly ResponsibilityDepartmentDefinition[],
];

type ResponsibilityDepartmentDefinition = readonly [
  key: string,
  code: string,
  name: string,
  systems: readonly ResponsibilitySystemDefinition[],
];

type ResponsibilitySystemDefinition = readonly [
  key: string,
  code: string,
  name: string,
];

const RESPONSIBILITY_GROUPS: readonly ResponsibilityGroupDefinition[] = [
  [
    "power",
    "POWER_GROUP",
    "动力群组",
    [
      [
        "electric-integration",
        "ELECTRIC_INTEGRATION",
        "电动集成部",
        [
          ["power-accessories", "POWER_ACCESSORIES", "动力附件"],
          ["powertrain", "POWERTRAIN", "动力总成"],
        ],
      ],
      [
        "battery-engineering",
        "BATTERY_ENGINEERING",
        "电池工程部",
        [
          ["power-battery", "POWER_BATTERY", "动力电池"],
          ["high-voltage-harness", "HIGH_VOLTAGE_HARNESS", "高压线束"],
        ],
      ],
      [
        "electric-drive",
        "ELECTRIC_DRIVE",
        "电驱系统部",
        [["electric-drive", "ELECTRIC_DRIVE", "电驱"]],
      ],
      [
        "thermal-management",
        "THERMAL_MANAGEMENT",
        "热管理系统部",
        [
          ["hvac-box", "HVAC_BOX", "空调箱"],
          ["thermal-management", "THERMAL_MANAGEMENT", "热管理"],
        ],
      ],
    ],
  ],
  [
    "intelligent-network",
    "INTELLIGENT_NETWORK_GROUP",
    "智能网联群组",
    [
      [
        "intelligent-cockpit",
        "INTELLIGENT_COCKPIT",
        "智能座舱部",
        [
          ["cloud-platform", "CLOUD_PLATFORM", "云平台"],
          ["cockpit-entertainment", "COCKPIT_ENTERTAINMENT", "座舱娱乐"],
        ],
      ],
      [
        "intelligent-driving",
        "INTELLIGENT_DRIVING",
        "智能驾驶部",
        [["intelligent-driving", "INTELLIGENT_DRIVING", "智能驾驶"]],
      ],
      [
        "intelligent-integration",
        "INTELLIGENT_INTEGRATION",
        "智能集成部",
        [["vehicle-control", "VEHICLE_CONTROL", "车辆控制"]],
      ],
      [
        "digital-cloud",
        "DIGITAL_CLOUD_PLATFORM",
        "数字化云平台部",
        [["cloud-platform", "CLOUD_PLATFORM", "云平台"]],
      ],
      [
        "electrical-electronic",
        "ELECTRICAL_ELECTRONIC",
        "电子电器部",
        [
          ["vehicle-control", "VEHICLE_CONTROL", "车辆控制"],
          ["low-voltage-power", "LOW_VOLTAGE_POWER", "低压供电"],
          ["lighting", "LIGHTING", "整车灯具"],
          ["cockpit-entertainment", "COCKPIT_ENTERTAINMENT", "座舱娱乐"],
        ],
      ],
    ],
  ],
  [
    "vehicle-architecture",
    "VEHICLE_ARCHITECTURE_GROUP",
    "整车架构群组",
    [
      [
        "exterior",
        "EXTERIOR",
        "外装部",
        [
          ["body-accessories", "BODY_ACCESSORIES", "车身附件系统"],
          ["sealing", "SEALING", "密封系统"],
          ["wiper-washer", "WIPER_WASHER", "雨刮洗涤"],
          ["bumper", "BUMPER", "保险杠系统"],
          ["upper-exterior-trim", "UPPER_EXTERIOR_TRIM", "上车体外饰系统"],
          ["plastic-electrical", "PLASTIC_ELECTRICAL", "塑电系统"],
          ["lower-exterior-trim", "LOWER_EXTERIOR_TRIM", "下车体外饰系统"],
        ],
      ],
      [
        "interior",
        "INTERIOR",
        "内装部",
        [
          ["passive-safety", "PASSIVE_SAFETY", "被动安全系统"],
          ["front-seat", "FRONT_SEAT", "前排座椅系统"],
          ["rear-seat", "REAR_SEAT", "后排座椅系统"],
          ["soft-trim", "SOFT_TRIM", "软内饰系统"],
          ["steering-wheel", "STEERING_WHEEL", "方向盘系统"],
          ["plastic-electrical", "PLASTIC_ELECTRICAL", "塑电系统"],
          ["instrument-panel", "INSTRUMENT_PANEL", "仪表板系统"],
          ["hard-trim", "HARD_TRIM", "硬内饰系统"],
        ],
      ],
      [
        "chassis",
        "CHASSIS",
        "底盘部",
        [
          ["wheel", "WHEEL", "车轮系统"],
          ["transmission", "TRANSMISSION", "传动系统"],
          ["tools", "TOOLS", "随车工具"],
          ["front-suspension", "FRONT_SUSPENSION", "前悬系统"],
          ["rear-suspension", "REAR_SUSPENSION", "后悬系统"],
          ["brake", "BRAKE", "制动系统"],
          ["steering", "STEERING", "转向系统"],
        ],
      ],
      [
        "body",
        "BODY",
        "车身部",
        [
          ["opening", "OPENING", "开闭件系统"],
          ["upper", "UPPER", "上车体系统"],
          ["lower", "LOWER", "下车体系统"],
          ["body-accessories", "BODY_ACCESSORIES", "车身附件系统"],
          ["sealing", "SEALING", "密封系统"],
        ],
      ],
      [
        "material-process",
        "MATERIAL_PROCESS",
        "材料及工艺部",
        [
          ["fasteners", "FASTENERS", "紧固件"],
          ["fluids", "FLUIDS", "油辅料"],
        ],
      ],
    ],
  ],
] as const;

function createResponsibilityTree(): CostAnalysisCategoryNode[] {
  return RESPONSIBILITY_GROUPS.map(
    ([groupKey, groupCode, groupName, departments], groupIndex) => {
      const groupId = `responsibility-group-${groupKey}`;
      return {
        id: groupId,
        parentId: null,
        level: 1,
        code: groupCode,
        name: groupName,
        path: groupName,
        sortNo: groupIndex + 1,
        dimensionType: DIMENSION_TYPE,
        children: departments.map(
          (
            [departmentKey, departmentCode, departmentName, systems],
            departmentIndex,
          ) => {
            const departmentId = `responsibility-department-${departmentKey}`;
            const departmentPath = `${groupName}/${departmentName}`;

            return {
              id: departmentId,
              parentId: groupId,
              level: 2,
              code: departmentCode,
              name: departmentName,
              path: departmentPath,
              sortNo: departmentIndex + 1,
              dimensionType: DIMENSION_TYPE,
              children: systems.map(
                ([systemKey, systemCode, systemName], systemIndex) => ({
                  id: `responsibility-system-${departmentKey}-${systemKey}`,
                  parentId: departmentId,
                  level: 3,
                  code: `${departmentCode}_${systemCode}`,
                  name: systemName,
                  path: `${departmentPath}/${systemName}`,
                  sortNo: systemIndex + 1,
                  dimensionType: DIMENSION_TYPE,
                  children: [],
                }),
              ),
            };
          },
        ),
      };
    },
  );
}

export const COST_ANALYSIS_RESPONSIBILITY_DEPARTMENT_TREE =
  createResponsibilityTree();

export function flattenResponsibilityDepartments(
  nodes: CostAnalysisCategoryNode[],
): CostAnalysisCategoryNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenResponsibilityDepartments(node.children ?? []),
  ]);
}

export function cloneResponsibilityDepartmentTree(): CostAnalysisCategoryNode[] {
  const clone = (node: CostAnalysisCategoryNode): CostAnalysisCategoryNode => ({
    ...node,
    children: node.children?.map(clone) ?? [],
  });
  return COST_ANALYSIS_RESPONSIBILITY_DEPARTMENT_TREE.map(clone);
}
