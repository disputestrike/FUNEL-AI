/* global wp */

/**
 * Gutenberg block editor â€” GoFunnelAI Block.
 *
 * UI:
 *   - SelectControl for funnel (loaded from /funnelai/v1/funnels).
 *   - RadioControl for embed mode (full page vs single section).
 *   - On save, we hit /funnelai/v1/embed/:id?mode=... and bake the returned
 *     HTML into the `staticHtml` attribute so the front-end render skips
 *     the network entirely.
 */
(function (blocks, element, components, editor, apiFetch, i18n) {
  const { registerBlockType } = blocks
  const { useState, useEffect } = element
  const { SelectControl, RadioControl, Spinner, PanelBody, Button } = components
  const { InspectorControls } = editor
  const { __ } = i18n
  const el = element.createElement

  registerBlockType("funnel-ai/funnel", {
    title: __("GoFunnelAI Block", "funnel-ai"),
    icon: "chart-line",
    category: "widgets",
    attributes: {
      funnelId: { type: "string", default: "" },
      mode: { type: "string", default: "full" },
      sectionId: { type: "string", default: "" },
      staticHtml: { type: "string", default: "" },
      capturedAt: { type: "string", default: "" },
    },

    edit: function (props) {
      const [funnels, setFunnels] = useState([])
      const [sections, setSections] = useState([])
      const [loading, setLoading] = useState(false)

      useEffect(function () {
        apiFetch({ path: "funnelai/v1/funnels?limit=100" }).then(function (r) {
          setFunnels(r.data || [])
        })
      }, [])

      useEffect(function () {
        if (!props.attributes.funnelId) return
        apiFetch({ path: "funnelai/v1/funnels/" + props.attributes.funnelId }).then(function (r) {
          setSections(Object.values(r.sections || {}))
        })
      }, [props.attributes.funnelId])

      function rebake() {
        setLoading(true)
        apiFetch({
          path:
            "funnelai/v1/embed/" +
            props.attributes.funnelId +
            "?mode=" +
            props.attributes.mode +
            (props.attributes.sectionId ? "&section=" + props.attributes.sectionId : ""),
        }).then(function (r) {
          props.setAttributes({ staticHtml: r.html, capturedAt: new Date().toISOString() })
          setLoading(false)
        })
      }

      return el(
        "div",
        { className: props.className + " funnel-ai-block-editor" },
        el(
          InspectorControls,
          {},
          el(
            PanelBody,
            { title: __("Funnel", "funnel-ai") },
            el(SelectControl, {
              label: __("Pick a funnel", "funnel-ai"),
              value: props.attributes.funnelId,
              options: [{ label: "â€”", value: "" }].concat(
                funnels.map(function (f) {
                  return { label: f.name, value: f.id }
                }),
              ),
              onChange: function (v) {
                props.setAttributes({ funnelId: v, staticHtml: "" })
              },
            }),
            el(RadioControl, {
              label: __("Embed mode", "funnel-ai"),
              selected: props.attributes.mode,
              options: [
                { label: __("Full funnel page", "funnel-ai"), value: "full" },
                { label: __("Single section", "funnel-ai"), value: "section" },
              ],
              onChange: function (v) {
                props.setAttributes({ mode: v })
              },
            }),
            props.attributes.mode === "section" &&
              el(SelectControl, {
                label: __("Section", "funnel-ai"),
                value: props.attributes.sectionId,
                options: [{ label: "â€”", value: "" }].concat(
                  sections.map(function (s) {
                    return { label: s.name, value: s.id }
                  }),
                ),
                onChange: function (v) {
                  props.setAttributes({ sectionId: v })
                },
              }),
            el(
              Button,
              {
                isPrimary: true,
                disabled: !props.attributes.funnelId || loading,
                onClick: rebake,
              },
              loading ? el(Spinner) : __("Bake static HTML for SEO", "funnel-ai"),
            ),
          ),
        ),
        props.attributes.staticHtml
          ? el("div", {
              className: "funnel-ai-preview",
              dangerouslySetInnerHTML: { __html: props.attributes.staticHtml },
            })
          : el(
              "div",
              { className: "funnel-ai-block-placeholder" },
              el("p", null, __("Pick a GoFunnelAI funnel on the right.", "funnel-ai")),
            ),
      )
    },

    save: function () {
      // Server-side rendered via render_callback so saved post_content stays
      // small and the HTML is always in sync with what's cached on disk.
      return null
    },
  })
})(wp.blocks, wp.element, wp.components, wp.blockEditor, wp.apiFetch, wp.i18n)
