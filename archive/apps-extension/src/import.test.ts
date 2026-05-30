import { describe, expect, it } from "vitest"
import { detectCompetitorPage, extractSkeleton } from "./import"

describe("detectCompetitorPage", () => {
  it("returns null on a vanilla page", () => {
    expect(detectCompetitorPage("https://example.com", "<html><body>hi</body></html>")).toBeNull()
  })

  it("flags a ClickFunnels host", () => {
    const d = detectCompetitorPage(
      "https://offer.myclickfunnels.com/optin",
      '<div data-cf-page="x"><script>ClickFunnels.PageData = {}</script></div>',
    )
    expect(d?.platform).toBe("clickfunnels")
    expect(d?.confidence).toBeGreaterThan(0)
  })

  it("flags Unbounce by host plus marker", () => {
    const d = detectCompetitorPage(
      "https://my.unbouncepages.com/foo",
      '<div class="ub-page"></div>',
    )
    expect(d?.platform).toBe("unbounce")
  })
})

describe("extractSkeleton", () => {
  it("counts headings, forms, ctas, videos, images", () => {
    const html = `
      <html><head><title>Test page</title></head>
      <body>
        <h1>Hero</h1><h2>Sub</h2><h3>Smaller</h3>
        <form><input name="email"/><button type="submit">Go</button></form>
        <a class="btn-cta" href="/checkout">Buy</a>
        <video></video>
        <img src="a.png"/><img src="b.png"/>
      </body></html>`
    const dom = new DOMParser().parseFromString(html, "text/html")
    const s = extractSkeleton(dom)
    expect(s.title).toBe("Test page")
    expect(s.headings).toHaveLength(3)
    expect(s.formCount).toBe(1)
    expect(s.ctaCount).toBeGreaterThanOrEqual(2)
    expect(s.videoCount).toBe(1)
    expect(s.imageCount).toBe(2)
  })
})
