import { describe, expect, it } from "vitest";
import { BASE_FOV, NARROWEST_FRAMED_ASPECT, fovForAspect } from "./fov";

const halfWidth = (fov: number, aspect: number) => Math.tan(((fov / 2) * Math.PI) / 180) * aspect;

describe("fovForAspect", () => {
  it("keeps the base field of view on landscape and square screens", () => {
    expect(fovForAspect(16 / 9)).toBe(BASE_FOV);
    expect(fovForAspect(1)).toBe(BASE_FOV);
    expect(fovForAspect(NARROWEST_FRAMED_ASPECT)).toBe(BASE_FOV);
  });

  it("holds the horizontal view on a phone held upright", () => {
    const phone = 375 / 812;
    const fov = fovForAspect(phone);
    expect(fov).toBeGreaterThan(BASE_FOV);
    expect(halfWidth(fov, phone)).toBeCloseTo(halfWidth(BASE_FOV, NARROWEST_FRAMED_ASPECT), 10);
  });

  it("is continuous at the threshold and never degenerate", () => {
    expect(fovForAspect(NARROWEST_FRAMED_ASPECT - 1e-9)).toBeCloseTo(BASE_FOV, 5);
    expect(fovForAspect(0)).toBe(BASE_FOV);
    expect(fovForAspect(0.2)).toBeLessThan(180);
  });
});
