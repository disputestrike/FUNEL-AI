/* global FunnelAIAdmin, wp */

/**
 * Admin-side JS — currently just wires the Funnel Browser typeahead so the
 * editor can search across funnels by name. The bulk of the React UI lives
 * inside the Gutenberg block (blocks/index.js).
 */
(function () {
  if (typeof wp === "undefined" || !wp.apiFetch) return

  wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(FunnelAIAdmin.restNonce))

  document.addEventListener("DOMContentLoaded", function () {
    const search = document.querySelector("#funnel-ai-browser-search")
    if (!search) return
    let timer = null
    search.addEventListener("input", function () {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        const q = search.value.trim()
        if (q.length < 2) return
        const results = await wp.apiFetch({ path: `funnelai/v1/funnels?q=${encodeURIComponent(q)}` })
        const list = document.querySelector("#funnel-ai-browser-results")
        if (!list) return
        list.innerHTML = ""
        for (const f of results.data || []) {
          const li = document.createElement("li")
          li.textContent = `${f.name} — ${f.status}`
          list.appendChild(li)
        }
      }, 250)
    })
  })
})()
