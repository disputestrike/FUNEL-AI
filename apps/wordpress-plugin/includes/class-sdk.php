<?php
/**
 * Tiny PHP wrapper around the GoFunnelAI REST API.
 *
 * This file intentionally re-implements a slice of @funnel/sdk semantics in
 * PHP â€” WordPress sites can't pull a Node package, so we mirror the SDK's
 * surface area: `auth header`, `funnels.get`, `funnels.list`, `webhooks.formSubmit`.
 *
 * All calls go through WordPress's wp_remote_* HTTP layer so we get the
 * platform's TLS handling and timeouts for free.
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class SDK {
    /**
     * Returns headers including a fresh bearer token. Refreshes via OAuth if
     * the cached token is within 60s of expiry.
     */
    public static function headers(): array {
        $settings = get_option('funnel_ai_settings', []);
        $token    = OAuth::ensure_fresh_token();
        return [
            'Authorization'   => 'Bearer ' . $token,
            'Content-Type'    => 'application/json',
            'X-Funnel-Surface' => 'wordpress-plugin',
            'X-Funnel-Workspace' => $settings['workspace_id'] ?? '',
        ];
    }

    public static function get_funnel(string $funnel_id) {
        $res = wp_remote_get(
            FUNNEL_AI_API_BASE . '/v1/funnels/' . rawurlencode($funnel_id),
            ['headers' => self::headers(), 'timeout' => 12]
        );
        return self::unwrap($res);
    }

    public static function list_funnels(array $args = []) {
        $url = add_query_arg($args, FUNNEL_AI_API_BASE . '/v1/funnels');
        $res = wp_remote_get($url, ['headers' => self::headers(), 'timeout' => 12]);
        return self::unwrap($res);
    }

    /**
     * Forward a captured form submission to the speed-to-lead pipeline.
     * The API takes it from here â€” dispatches Resend email + SignalWire SMS
     * via the same path used by every other GoFunnelAI surface.
     */
    public static function form_submit(array $payload) {
        $res = wp_remote_post(FUNNEL_AI_API_BASE . '/v1/webhooks/form-submit', [
            'headers' => self::headers(),
            'timeout' => 8,
            'body'    => wp_json_encode($payload),
        ]);
        return self::unwrap($res);
    }

    private static function unwrap($res) {
        if (is_wp_error($res)) {
            return new \WP_Error('funnel_ai_http', $res->get_error_message());
        }
        $code = wp_remote_retrieve_response_code($res);
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if ($code >= 200 && $code < 300) {
            return $body;
        }
        return new \WP_Error('funnel_ai_status_' . $code, $body['error'] ?? 'Request failed', $body);
    }
}
