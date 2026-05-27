<?php
/**
 * Legacy [funnelai id="xxx"] shortcode for classic editor users.
 *
 * Honors the same transient cache as the Gutenberg block.
 *
 * Usage:
 *   [funnelai id="fn_abc123"]
 *   [funnelai id="fn_abc123" section="hero"]
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class Shortcode {
    public function __construct() {
        add_shortcode('funnelai', [$this, 'handle']);
    }

    public function handle($atts) {
        $atts = shortcode_atts([
            'id'      => '',
            'section' => '',
            'mode'    => 'full',
        ], $atts, 'funnelai');

        if (empty($atts['id'])) {
            return '';
        }

        $cache_key = 'funnel_ai_html_' . md5($atts['id'] . '|' . $atts['mode'] . '|' . $atts['section']);
        $cached    = get_transient($cache_key);
        if ($cached !== false) {
            return $cached;
        }

        $funnel = SDK::get_funnel($atts['id']);
        if (is_wp_error($funnel)) {
            return '<!-- gofunnelai.com: ' . esc_html($funnel->get_error_message()) . ' -->';
        }
        $html = $atts['section']
            ? ($funnel['sections'][$atts['section']]['html'] ?? '')
            : ($funnel['html'] ?? '');
        set_transient($cache_key, $html, HOUR_IN_SECONDS);
        return $html;
    }
}
