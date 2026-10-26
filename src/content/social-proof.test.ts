import { describe, expect, it } from "vitest";
import {
  hasSocialProof,
  visibleStats,
  visibleTestimonials,
  type PublicStat,
  type Testimonial,
} from "@/content/social-proof";

const blankQuote: Testimonial = { quote: "", name: "", detail: "" };
const realQuote: Testimonial = {
  quote: "We stopped texting scores.",
  name: "Casey",
  detail: "",
};
const nameless: Testimonial = { quote: "Great app", name: "  ", detail: "Austin" };

const blankStat: PublicStat = { value: "", label: "" };
const realStat: PublicStat = { value: "40", label: "rounds scored" };

describe("social proof placeholders", () => {
  it("hides quotes that are missing words or a name", () => {
    expect(visibleTestimonials([blankQuote, nameless, realQuote])).toEqual([realQuote]);
  });

  it("hides stats that are missing a figure or a label", () => {
    expect(visibleStats([blankStat, { value: "12", label: "" }, realStat])).toEqual([realStat]);
  });

  it("treats the shipped placeholders as nothing to render", () => {
    expect(hasSocialProof([blankQuote], [blankStat])).toBe(false);
    expect(hasSocialProof([realQuote], [blankStat])).toBe(true);
  });
});
