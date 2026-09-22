<template>
  <div>
    {{ scope.row[cell] }}
    <el-tooltip
      v-if="tip[cell] && tip[cell][scope.$index]"
      placement="top"
      popper-class="custom-tooltip"
    >
      <template #content>
        <div v-for="(item, index) in tip[cell][scope.$index]" :key="index">
          <div :class="index == 0 ? 'dingyi' : 'dingyi1'">{{ item.title }}</div>
          <div v-html="item.content"></div>
        </div>
      </template>
      <WarningFilled style="color: #1890ff" />
    </el-tooltip>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { WarningFilled } from "@element-plus/icons-vue";

interface ToolTipItem {
  title: string;
  content: string;
}

const _props = defineProps<{
  scope: {
    row: Record<string, unknown>;
    $index: number;
    [key: string]: unknown;
  };
  cell: string;
}>();

const tip = ref<Record<string, Record<number, ToolTipItem[]>>>({
  a: {
    2: [
      {
        title: "定义",
        content:
          "即MSRP，指汽车的建议零售价，或是国际业务在合同中与经销商明确规定的交易价格",
      },
    ],
    6: [
      {
        title: "定义",
        content: "消费者的成交价格",
      },
      {
        title: "公式",
        content: "TP价=市场指导价-促销",
      },
    ],
    7: [
      {
        title: "定义",
        content: "厂家支付给经销商的销售佣金",
      },
      {
        title: "公式",
        content:
          "包括销售基础佣金、销售达成激励、运营质量考核等，不含建店补贴",
      },
    ],
    8: [
      {
        title: "定义",
        content: "按促销和商务政策得出的经销商应付价格",
      },
      {
        title: "公式",
        content: "经销商底价=市场指导价-促销-商务政策",
      },
    ],
    9: [
      {
        title: "公式",
        content: "销项税额=经销商底价*增值税率",
      },
    ],
    10: [
      {
        title: "定义",
        content: "通过产品销售获得的收入",
      },
      {
        title: "公式",
        content: "销售收入=市场指导价-促销-商务政策-销项税",
      },
    ],
    11: [
      {
        title: "定义",
        content:
          "燃油及混动车型应按照气缸容量计算，纯电车型不涉及 车辆购置税+城市税+教育附加费",
      },
    ],
    28: [
      {
        title: "定义",
        content:
          "销售收入减去消费税金及附加、材料成本、变动制造费用和变动销售费用后的余额。",
      },
      {
        title: "公式",
        content:
          "边际贡献=销售收入-消费税金及附加-材料成本-变动制造费用-变动销售费用",
      },
    ],
    29: [
      {
        title: "公式",
        content: "边际贡献率=边际贡献/销售收入",
      },
    ],
    30: [
      {
        title: "定义",
        content: `固定费用:在一定时期及一定业务量范围内，<br/>
其总额不直接受业务量变动的影响而保持固定不变的那部分费用，<br/>
主要指研发部门、管理部门、销售部门为生产经营及研发活动发生的各种费用`,
      },
      {
        title: "公式",
        content:
          "如人工成本、燃动费、场租费、办公、差旅、广宣费用、渠道建设费用、市场费用等;",
      },
    ],
    36: [
      {
        title: "公式",
        content: "营业利润=边际贡献-固定费用",
      },
    ],
    37: [
      {
        title: "公式",
        content: "营业利润率=营业利润÷销售收入*100%",
      },
    ],
  },
  b: {
    4: [
      {
        title: "定义",
        content: `通过经销商给予终端客户的优惠政策`,
      },
      {
        title: "公式",
        content: `包括现金折扣、金融政策、置换政策、增购政策等。`,
      },
    ],
    5: [
      {
        title: "定义",
        content: `为产品发生的含在价格内专属的促销政策`,
      },
      {
        title: "公式",
        content: `包括二手车置换、二网直补、试乘试驾、特殊车折扣、员工购车等个性化优惠政策`,
      },
    ],
    12: [
      {
        title: "定义",
        content: `股份内部转移价=销售收入*80%或75% 新能源内部转移价=材料成本+变动制造费用+固定制造费用<br/>
1、气缸容量≤1.0升的消费税税率为1%;<br/>
2、1.0升<气缸容量≤1.5升(含）的消费税税率为3%;<br/>
3、1.5升<气缸容量≤2.0升的消费税税率为5%;<br/>
4、2.0升<气缸容量≤2.5升的消费税税率为9%;<br/>
5、2.5升<气缸容量≤3.0升的消费税税率为12%;<br/>
6、3.0升<气缸容量≤4.0升的消费税税率为25%`,
      },
      {
        title: "公式",
        content: `车辆消费税=内部转移价*对应税率`,
      },
    ],
    13: [
      {
        title: "定义",
        content: `城市维护建设税根据纳税人实际缴纳的增值税和消费税税额为依据征收，<br/>
税率按照所在地的不同而有所不同。市区的税率为7%，县城、镇的税率为5%，<br/>
不在市区、县城或镇的税率为1%。教育费附加税率为3%，地方教育附加税率为2%`,
      },
      {
        title: "公式",
        content: `附加税=｛销项税-材料成本*13%+消费税税额｝*适应税率`,
      },
    ],
    15: [
      {
        title: "定义",
        content: `是指根据各车型配置及BOM信息计算的材料成本，包含BOM辅料及摊销`,
      },
    ],
    16: [
      {
        title: "公式",
        content: `BOM材料成本 = 各版型当前成本统计(不含摊销)`,
      },
    ],
    18: [
      {
        title: "公式",
        content: `摊销 = 各版型当前成本统计(含摊销)- 各版型当前成本统计(不含摊销)`,
      },
    ],
    19: [
      {
        title: "定义",
        content: `指在特定的业务量范围内，总额随产量变动而成正比例变动的那部分费用`,
      },
      {
        title: "公式",
        content: `包含但不限于人工、工艺性外包、燃动费、BOM外辅料、维修费、物流费(配送、排序)、保安保洁费等`,
      },
    ],
    23: [
      {
        title: "定义",
        content: `指在特定的业务量范围内，总额随销量变动而成正比例变动的那部分费用`,
      },
      {
        title: "公式",
        content: `包含质保费用、PDI费用、充电桩、流量费、整车物流、其他`,
      },
    ],
  },
});
</script>
<style scoped>
.dingyi {
  font-size: 12px;
  font-weight: bold;
}
.dingyi1 {
  margin-top: 10px;
  font-size: 12px;
  font-weight: bold;
}
</style>
