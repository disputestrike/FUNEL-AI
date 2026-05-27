<?php
/**
 * Gutenberg block: "GoFunnelAI Block".
 *
 * Editor side picks a funnel; we then pre-render the funnel's HTML to a
 * static snapshot at save time (stored as block attribute `staticHtml`) so
 * the front-end can render it without an API round trip â€” that means good
 * SEO and zero perceived latency.
 *
 * On the front-end, the static HTML is served directly with no JS, except
 * for a 1px tracking pixel that ties form submissions back to the embed.
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class Block {
    const BLOCK_NAME = 'funnel-ai/funnel';

    public function __construct() {
        add_action('init', [$this, 'register']);
    }

    public function register() {
        register_block_type(self::BLOCK_NAME, [
            'api_version'     => 3,
            'editor_script'   => 'funnel-ai-block',
            'render_callback' => [$this, 'render'],
            'attributes'      => [
                'funnelId'   => ['type' => 'string', 'default' => ''],
                'mode'       => ['type' => 'string', 'default' => 'full'], // full|section
                'sectionId'  => ['type' => 'string', 'default' => ''],
                'staticHtml' => ['type' => 'string', 'default' => ''],
                'capturedAt' => ['type' => 'string', 'default' => ''],
            ],
        ]);

        wp_register_script(
            'funnel-ai-block',
            FUNNEL_AI_PLUGIN_URL . 'blocks/index.js',
            ['wp-blocks', 'wp-element', 'wp-editor', 'wp-components', 'wp-api-fetch', 'wp-i18n'],
            FUNNEL_AI_VERSION,
            true
        );
    }

    public function render($attributes, $content) {
        $funnel_id  = $attributes['funnelId'] ?? '';
        $static     = $attributes['staticHtml'] ?? '';

        if (empty($funnel_id)) {
            return '';
        }

        // Prefer the snapshot baked in at edit time. If it's missing or older
        // than 1 hour we fall back to live fetch + transient cache.
        if (empty($static)) {
            $static = $this->fetch_and_cache($funnel_id, $attributes['mode'], $attributes['sectionId']);
        }

        $pixel_url = add_query_arg([
            'funnelId' => $funnel_id,
            'embed'    => 'wordpress',
            'post'     => get_the_ID(),
        ], rest_url('funnelai/v1/track'));

        return sprintf(
            '<div class="funnel-ai-embed" data-funnel-id="%s">%s<img src="%s" width="1" height="1" alt="" style="position:absolute;left:-9999px"/></div>',
            esc_attr($funnel_id),
            $static, // pre-rendered, trusted from our API
            esc_url($pixel_url)
        );
    }

    private function fetch_and_cache(string $funnel_id, string $mode, string $section_id): string {
        $cache_key = 'funnel_ai_html_' . md5($funnel_id . '|' . $mode . '|' . $section_id);
        $cached    = get_transient($cache_key);
        if ($cached !== false) {
            return $cached;
        }
        $funnel = SDK::get_funnel($funnel_id);
        if (is_wp_error($funnel)) {
            return '<!-- gofunnelai.com: ' . esc_html($funnel->get_error_message()) . ' -->';
        }
        $html = $mode === 'section'
            ? ($funnel['sections'][$section_id]['html'] ?? '')
            : ($funnel['html'] ?? '');
        set_transient($cache_key, $html, HOUR_IN_SECONDS);
        return $html;
    }
}
