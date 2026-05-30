<?php
/**
 * REST API surface exposed under /wp-json/funnelai/v1/.
 *
 * Endpoints:
 *   GET  /funnels                  â€” proxy to GoFunnelAI list
 *   GET  /funnels/:id              â€” proxy to GoFunnelAI detail
 *   GET  /embed/:funnelId          â€” fetch + cache + return raw HTML
 *   GET  /track                    â€” 1px pixel that records embed views
 *   POST /webhook/external-submit  â€” accept arbitrary form-tag submissions
 *
 * Auth on /funnels and /embed is `edit_pages` â€” these are editor-only.
 * /track is public (it's a tracking pixel). /webhook/external-submit
 * accepts a shared secret in `X-Funnel-Site-Token` so external forms (e.g.
 * Elementor) can post to it without WP login.
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class REST_API {
    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes() {
        register_rest_route('funnelai/v1', '/funnels', [
            'methods'             => 'GET',
            'callback'            => [$this, 'list_funnels'],
            'permission_callback' => function () { return current_user_can('edit_pages'); },
        ]);
        register_rest_route('funnelai/v1', '/funnels/(?P<id>[A-Za-z0-9_-]+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_funnel'],
            'permission_callback' => function () { return current_user_can('edit_pages'); },
        ]);
        register_rest_route('funnelai/v1', '/embed/(?P<id>[A-Za-z0-9_-]+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'embed'],
            'permission_callback' => function () { return current_user_can('edit_pages'); },
        ]);
        register_rest_route('funnelai/v1', '/track', [
            'methods'             => 'GET',
            'callback'            => [$this, 'track'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route('funnelai/v1', '/webhook/external-submit', [
            'methods'             => 'POST',
            'callback'            => [$this, 'external_submit'],
            'permission_callback' => [$this, 'check_site_token'],
        ]);
    }

    public function check_site_token(\WP_REST_Request $req): bool {
        $expected = get_option('funnel_ai_site_token', '');
        if (empty($expected)) return false;
        return hash_equals($expected, (string) $req->get_header('x-funnel-site-token'));
    }

    public function list_funnels(\WP_REST_Request $req) {
        $args = [];
        if ($q = $req->get_param('q'))     { $args['q'] = sanitize_text_field($q); }
        if ($lim = $req->get_param('limit')) { $args['limit'] = (int) $lim; }
        $r = SDK::list_funnels($args);
        return is_wp_error($r) ? $r : rest_ensure_response($r);
    }

    public function get_funnel(\WP_REST_Request $req) {
        $r = SDK::get_funnel($req['id']);
        return is_wp_error($r) ? $r : rest_ensure_response($r);
    }

    public function embed(\WP_REST_Request $req) {
        $id      = $req['id'];
        $mode    = $req->get_param('mode') === 'section' ? 'section' : 'full';
        $section = sanitize_text_field((string) $req->get_param('section'));
        $cache_key = 'funnel_ai_html_' . md5($id . '|' . $mode . '|' . $section);
        $cached    = get_transient($cache_key);
        if ($cached === false) {
            $f = SDK::get_funnel($id);
            if (is_wp_error($f)) return $f;
            $cached = $mode === 'section' ? ($f['sections'][$section]['html'] ?? '') : ($f['html'] ?? '');
            set_transient($cache_key, $cached, HOUR_IN_SECONDS);
        }
        return rest_ensure_response(['html' => $cached, 'cachedAt' => current_time('mysql')]);
    }

    public function track(\WP_REST_Request $req) {
        $funnel_id = sanitize_text_field((string) $req->get_param('funnelId'));
        if ($funnel_id) {
            SDK::form_submit([
                'event'      => 'embed.view',
                'surface'    => 'wordpress-plugin',
                'funnelId'   => $funnel_id,
                'postId'     => (int) $req->get_param('post'),
                'capturedAt' => current_time('c'),
                'pageUrl'    => wp_get_referer() ?: home_url(),
            ]);
        }
        // 1Ã—1 transparent GIF.
        $gif = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        return new \WP_REST_Response(null, 200, [
            'Content-Type'   => 'image/gif',
            'Content-Length' => strlen($gif),
            'Cache-Control'  => 'no-store',
        ]);
    }

    public function external_submit(\WP_REST_Request $req) {
        $payload = $req->get_json_params();
        $settings = get_option('funnel_ai_settings', []);
        $payload['surface']    = 'wordpress-plugin';
        $payload['source']     = sanitize_text_field($payload['source'] ?? 'external');
        $payload['funnelId']   = sanitize_text_field($payload['funnelId'] ?? $settings['default_funnel'] ?? '');
        $payload['capturedAt'] = current_time('c');
        $r = SDK::form_submit($payload);
        return is_wp_error($r) ? $r : rest_ensure_response(['ok' => true]);
    }
}
