export const helloFrame = {
  width: 15,
  height: 18,
  phase: "evening",
  night: 1,
  tick: 0,
  tiles: Array.from({ length: 270 }, (_, i) => ({
    x: i % 15,
    y: Math.floor(i / 15),
    wall: i % 15 === 0 || i % 15 === 14 || i < 15 || i >= 255,
    lit: i % 15 > 8 && Math.floor(i / 15) < 7,
  })),
  player: { x: 7, y: 15, lantern: true },
  people: [],
  landmarks: [
    { name: "Home", x: 7, y: 15, kind: "home" },
    { name: "Well", x: 4, y: 7, kind: "well" },
    { name: "Idris’s house", x: 11, y: 3, kind: "door" },
  ],
};
