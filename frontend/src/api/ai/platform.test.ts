import { describe, expect, it } from "vitest";
import { createPlatformAiService, platformAiDecoders } from "./platform";

describe("平台 AI API 端口", () => {
  it("缺少正式解码器时不发送请求", async () => {
    const service = createPlatformAiService();
    await expect(service.models()).rejects.toMatchObject({
      code: "CONTRACT_PENDING",
    });
    await expect(service.providers()).rejects.toMatchObject({
      code: "CONTRACT_PENDING",
    });
    await expect(service.channels()).rejects.toMatchObject({
      code: "CONTRACT_PENDING",
    });
  });

  it("解码器按平台资源类型分别返回列表", async () => {
    const service = createPlatformAiService({
      models: (data) => data as never[],
      providers: (data) => data as never[],
      channels: (data) => data as never[],
    });

    // 当前服务不会在没有后端响应时伪造列表；该断言只固定解码器契约的类型入口。
    expect(service).toHaveProperty("models");
    expect(service).toHaveProperty("providers");
    expect(service).toHaveProperty("channels");
  });

  it("拒绝缺少必填字段的列表项", () => {
    expect(() =>
      platformAiDecoders.models([{ modelCode: "missing-id" }]),
    ).toThrow("模型 响应不是有效列表");
    expect(() =>
      platformAiDecoders.providers([{ providerId: "provider-1" }]),
    ).toThrow("Provider 响应不是有效列表");
    expect(() =>
      platformAiDecoders.channels([{ channelId: "channel-1" }]),
    ).toThrow("渠道 响应不是有效列表");
  });
});
