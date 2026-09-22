import { request } from "@/api/http";
import type { MicroserviceHealthSnapshot } from "@/types/microservice-monitor";

export function fetchMicroserviceHealth(): Promise<MicroserviceHealthSnapshot[]> {
  return request<MicroserviceHealthSnapshot[]>({
    url: "/monitor/service/list",
    method: "get",
  });
}
