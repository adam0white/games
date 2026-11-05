export type GuideState = "route" | "move" | "lantern" | "consequence" | "done";
export type GuideAction = "route" | "move" | "lantern" | "continue";

export function advanceGuide(
  state: GuideState,
  action: GuideAction,
): GuideState {
  if (state === "route" && action === "route") return "move";
  if (state === "move" && action === "move") return "lantern";
  if (state === "lantern" && action === "lantern") return "consequence";
  if (state === "consequence" && action === "continue") return "done";
  return state;
}
