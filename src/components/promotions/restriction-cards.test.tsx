import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RedemptionCapsCard } from "./restriction-cards";

describe("RedemptionCapsCard Visibility", () => {
  const defaultProps = {
    maxStayCount: "",
    maxRewardCount: "",
    maxRedemptionValue: "",
    maxTotalBonusPoints: "",
    onMaxStayCountChange: vi.fn(),
    onMaxRewardCountChange: vi.fn(),
    onMaxRedemptionValueChange: vi.fn(),
    onMaxTotalBonusPointsChange: vi.fn(),
    onRemove: vi.fn(),
  };

  it("renders all fields at promotion level", () => {
    render(<RedemptionCapsCard {...defaultProps} level="promotion" />);

    expect(screen.getByLabelText(/Maximum Stays for Promotion/i)).toBeDefined();
    expect(screen.getByLabelText(/Max Total Value/i)).toBeDefined();
    expect(screen.getByLabelText(/Max Total Points/i)).toBeDefined();
  });

  it("hides points cap when rewardType is cashback", () => {
    render(<RedemptionCapsCard {...defaultProps} level="benefit" rewardType="cashback" />);

    expect(screen.getByLabelText(/Maximum Times to Earn Reward/i)).toBeDefined();
    expect(screen.getByLabelText(/Max Value for this Reward/i)).toBeDefined();
    expect(screen.queryByLabelText(/Max Points for this Reward/i)).toBeNull();
  });

  it("hides value cap when rewardType is points", () => {
    render(<RedemptionCapsCard {...defaultProps} level="benefit" rewardType="points" />);

    expect(screen.getByLabelText(/Maximum Times to Earn Reward/i)).toBeDefined();
    expect(screen.getByLabelText(/Max Points for this Reward/i)).toBeDefined();
    expect(screen.queryByLabelText(/Max Value for this Reward/i)).toBeNull();
  });

  it("hides both value and points caps for certificates", () => {
    render(<RedemptionCapsCard {...defaultProps} level="benefit" rewardType="certificate" />);

    expect(screen.getByLabelText(/Maximum Times to Earn Reward/i)).toBeDefined();
    expect(screen.queryByLabelText(/Max Value for this Reward/i)).toBeNull();
    expect(screen.queryByLabelText(/Max Points for this Reward/i)).toBeNull();
  });

  it("hides both value and points caps for EQNs", () => {
    render(<RedemptionCapsCard {...defaultProps} level="benefit" rewardType="eqn" />);

    expect(screen.getByLabelText(/Maximum Times to Earn Reward/i)).toBeDefined();
    expect(screen.queryByLabelText(/Max Value for this Reward/i)).toBeNull();
    expect(screen.queryByLabelText(/Max Points for this Reward/i)).toBeNull();
  });
});
