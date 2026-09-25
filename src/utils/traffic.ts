import type { BillingInfo } from "../types";

/** 一组方向明细：上行与下行字节数。 */
export interface TrafficSplit {
  up: number;
  down: number;
}

/**
 * 读取方向明细，缺失时返回 null。
 *
 * 用「字段是否存在」而不是「是否非零」判断：单向为 0 是完全合法的状态
 * （只下载不上传的机器）。「两者皆无」说明服务端版本过旧或数据不存在，
 * 返回 null 让调用方显示 "--"，而不是渲染一对 0 或按比例编一份假明细。
 */
function readSplit(up?: number, down?: number): TrafficSplit | null {
  if (typeof up !== "number" || typeof down !== "number") return null;
  if (!isFinite(up) || !isFinite(down) || up < 0 || down < 0) return null;
  return { up, down };
}

/**
 * 已用流量的方向明细。服务端保证 up + down 恒等于 `bandwidth_used`，明细与
 * 配额所依据的总量不会互相矛盾；前端不自行推算，以免两条口径分叉。
 */
export function usedTrafficSplit(billing?: Partial<BillingInfo>): TrafficSplit | null {
  return readSplit(billing?.bandwidth_used_up, billing?.bandwidth_used_down);
}
