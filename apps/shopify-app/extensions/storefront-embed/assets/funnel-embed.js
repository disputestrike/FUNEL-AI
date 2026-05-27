/**
 * Storefront-side renderer for GoFunnelAI funnels.
 *
 * Reads the data-* attributes off `.funnel-ai-embed`, fetches the
 * server-rendered funnel HTML from the app proxy, swaps it in, and wires
 * the embedded `<form>`s to POST back through the same proxy so submissions
 * hit /v1/webhooks/form-submit on the GoFunnelAI API.
 *
 * Zero external dependencies â€” vanilla JS keeps the storefront fast.
 */

(function () {
  const embeds = document.querySelectorAll(".funnel-ai-embed")
  if (!embeds.length) return

  embeds.forEach(async (root) => {
    const funnelId = root.getAttribute("data-funnel-id")
    const proxy = root.getAttribute("data-proxy")
    if (!funnelId || !proxy) return

    try {
      const res = await fetch(`${proxy}/embed?funnelId=${encodeURIComponent(funnelId)}`, {
        headers: { Accept: "text/html" },
      })
      if (!res.ok) throw new Error("embed fetch failed")
      const html = await res.text()
      root.innerHTML = html
      wireForms(root, funnelId, proxy)
    } catch (err) {
      console.warn("[gofunnelai.com] embed failed", err)
      root.innerHTML = ""
    }
  })

  function wireForms(root, funnelId, proxy) {
    const forms = root.querySelectorAll("form")
    forms.forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault()
        const fields = {}
        for (const el of form.elements) {
          if (!el.name || el.type === "submit" || el.type === "password") continue
          fields[el.name] = el.value
        }
        const submitBtn = form.querySelector('[type="submit"]')
        if (submitBtn) submitBtn.disabled = true
        try {
          await fetch(`${proxy}/form-submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              funnelId,
              fields,
              pageUrl: window.location.href,
            }),
          })
          form.dispatchEvent(new CustomEvent("funnel:submitted", { bubbles: true, detail: { fields } }))
          const successEl = root.querySelector("[data-funnel-success]")
          if (successEl) successEl.removeAttribute("hidden")
          form.reset()
        } finally {
          if (submitBtn) submitBtn.disabled = false
        }
      })
    })
  }
})()
