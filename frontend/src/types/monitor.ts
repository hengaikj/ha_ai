export interface OnlineUser {
  tokenId: string;
  userName: string;
  deptName?: string;
  ipaddr?: string;
  loginLocation?: string;
  browser?: string;
  os?: string;
  loginTime?: string | number | null;
}

export interface OnlineUserQuery {
  ipaddr?: string;
  userName?: string;
}

export interface OnlineUserPage {
  records: OnlineUser[];
  total: number;
}

export interface ServerCpu {
  cpuNum?: number;
  used?: number;
  sys?: number;
  free?: number;
}

export interface ServerMemory {
  total?: number;
  used?: number;
  free?: number;
  usage?: number;
}

export interface ServerJvm extends ServerMemory {
  name?: string;
  version?: string;
  home?: string;
  startTime?: string;
  runTime?: string;
  inputArgs?: string;
}

export interface ServerSystem {
  computerName?: string;
  computerIp?: string;
  userDir?: string;
  osName?: string;
  osArch?: string;
}

export interface ServerFileSystem {
  dirName?: string;
  sysTypeName?: string;
  typeName?: string;
  total?: string;
  free?: string;
  used?: string;
  usage?: number;
}

export interface ServerMonitorSnapshot {
  cpu?: ServerCpu;
  mem?: ServerMemory;
  jvm?: ServerJvm;
  sys?: ServerSystem;
  sysFiles?: ServerFileSystem[];
}

export interface CacheCommandStat {
  name: string;
  value: number;
}

export interface CacheInfo {
  redis_version?: string;
  redis_mode?: string;
  tcp_port?: string | number;
  connected_clients?: string | number;
  uptime_in_days?: string | number;
  used_memory_human?: string;
  used_memory?: string | number;
  used_cpu_user_children?: string | number;
  maxmemory_human?: string;
  maxmemory?: string | number;
  aof_enabled?: string | number;
  rdb_last_bgsave_status?: string;
  instantaneous_input_kbps?: string | number;
  instantaneous_output_kbps?: string | number;
}

export interface CacheMonitorSnapshot {
  info?: CacheInfo;
  dbSize?: number;
  commandStats?: CacheCommandStat[];
}

export interface CacheNameItem {
  cacheName: string;
  remark?: string;
}

export interface CacheValueDetail {
  cacheName?: string;
  cacheKey?: string;
  cacheValue?: unknown;
}
