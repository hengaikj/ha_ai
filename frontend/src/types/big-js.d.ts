declare module "big.js" {
  /**
   * Big.js 的最小类型声明。
   * 项目当前使用构造函数及基础算术、比较和格式化方法。
   */
  class Big {
    constructor(value: string | number | Big);

    plus(value: string | number | Big): Big;
    minus(value: string | number | Big): Big;
    times(value: string | number | Big): Big;
    div(value: string | number | Big): Big;
    abs(): Big;
    pow(value: number): Big;
    round(dp?: number, rm?: number): Big;
    eq(value: string | number | Big): boolean;
    gt(value: string | number | Big): boolean;
    gte(value: string | number | Big): boolean;
    lt(value: string | number | Big): boolean;
    lte(value: string | number | Big): boolean;
    toFixed(dp?: number, rm?: number): string;
    toString(): string;
  }

  export default Big;
}
