/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { applyRootUiFont } from "./apply-root-font.web";

const STYLE_ID = "paseo-ui-font";

afterEach(() => {
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.style.removeProperty("--paseo-ui-font");
  document.documentElement.style.removeProperty("--paseo-content-font");
});

describe("applyRootUiFont", () => {
  it("sets both the UI and content font CSS variables", () => {
    applyRootUiFont("Menlo, sans-serif", "Georgia, serif");

    expect(document.documentElement.style.getPropertyValue("--paseo-ui-font")).toBe(
      "Menlo, sans-serif",
    );
    expect(document.documentElement.style.getPropertyValue("--paseo-content-font")).toBe(
      "Georgia, serif",
    );
  });

  it("injects a rule that routes data-pcontent surfaces to the content font, not the UI font", () => {
    applyRootUiFont("Menlo, sans-serif", "Georgia, serif");

    const rule = document.getElementById(STYLE_ID)?.textContent ?? "";
    expect(rule).toContain("[data-pcontent]");
    expect(rule).toContain("var(--paseo-content-font)");
    expect(rule).toContain("var(--paseo-ui-font)");
  });

  it("excludes data-pmono surfaces from the content rule so inline code keeps its own font", () => {
    applyRootUiFont("Menlo, sans-serif", "Georgia, serif");

    const rule = document.getElementById(STYLE_ID)?.textContent ?? "";
    const contentRule = rule.split("--paseo-content-font")[0] ?? "";
    expect(contentRule).toContain(":not([data-pmono])");
  });

  it("only injects the style element once across repeated calls", () => {
    applyRootUiFont("Menlo, sans-serif", "Georgia, serif");
    applyRootUiFont("Courier, monospace", "Times, serif");

    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
    expect(document.documentElement.style.getPropertyValue("--paseo-ui-font")).toBe(
      "Courier, monospace",
    );
    expect(document.documentElement.style.getPropertyValue("--paseo-content-font")).toBe(
      "Times, serif",
    );
  });

  it("strips characters that could break out of the CSS custom property value", () => {
    applyRootUiFont("Evil<>{}();\nFont", "Also<>{}();\nSerif");

    expect(document.documentElement.style.getPropertyValue("--paseo-ui-font")).toBe("Evil Font");
    expect(document.documentElement.style.getPropertyValue("--paseo-content-font")).toBe(
      "Also Serif",
    );
  });
});
