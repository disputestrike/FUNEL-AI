<?php
/**
 * OAuth (PKCE + authorization code) flow that connects a WordPress site to
 * a GoFunnelAI workspace.
 *
 * Flow:
 *   1. Admin clicks "Connect to GoFunnelAI" on the settings page.
 *   2. We generate a PKCE pair, store the verifier in a 10-minute transient.
 *   3. Redirect the admin to login.gofunnelai.com/oauth/authorize.
 *   4. GoFunnelAI redirects back to /wp-admin/admin-post.php?action=funnel_ai_oauth_callback.
 *   5. We exchange the code for tokens, persist into funnel_ai_settings.
 *
 * Refresh is on-demand via SDK::headers() â†’ ensure_fresh_token().
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class OAuth {
    const STATE_TRANSIENT_PREFIX = 'funnel_ai_oauth_';

    public static function register() {
        add_action('admin_post_funnel_ai_oauth_start', [__CLASS__, 'start']);
        add_action('admin_post_funnel_ai_oauth_callback', [__CLASS__, 'callback']);
    }

    public static function start() {
        if (!current_user_can('manage_options')) {
            wp_die('Forbidden', 403);
        }
        check_admin_referer('funnel_ai_oauth_start');

        $verifier   = self::base64url(random_bytes(64));
        $challenge  = self::base64url(hash('sha256', $verifier, true));
        $state      = wp_generate_password(32, false);

        set_transient(self::STATE_TRANSIENT_PREFIX . $state, [
            'verifier'  => $verifier,
            'user_id'   => get_current_user_id(),
            'site_url'  => home_url(),
        ], 10 * MINUTE_IN_SECONDS);

        $params = [
            'client_id'             => 'wp_' . wp_parse_url(home_url(), PHP_URL_HOST),
            'redirect_uri'          => admin_url('admin-post.php?action=funnel_ai_oauth_callback'),
            'response_type'         => 'code',
            'scope'                 => 'funnels:read funnels:write leads:write workspaces:read',
            'code_challenge'        => $challenge,
            'code_challenge_method' => 'S256',
            'state'                 => $state,
        ];
        wp_safe_redirect(FUNNEL_AI_AUTH_BASE . '/oauth/authorize?' . http_build_query($params));
        exit;
    }

    public static function callback() {
        if (!current_user_can('manage_options')) {
            wp_die('Forbidden', 403);
        }
        $code  = sanitize_text_field($_GET['code'] ?? '');
        $state = sanitize_text_field($_GET['state'] ?? '');
        $stash = get_transient(self::STATE_TRANSIENT_PREFIX . $state);
        if (!$code || !$stash || !is_array($stash)) {
            wp_die('Invalid OAuth callback');
        }
        delete_transient(self::STATE_TRANSIENT_PREFIX . $state);

        $res = wp_remote_post(FUNNEL_AI_AUTH_BASE . '/oauth/token', [
            'timeout' => 15,
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode([
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'client_id'     => 'wp_' . wp_parse_url(home_url(), PHP_URL_HOST),
                'code_verifier' => $stash['verifier'],
                'redirect_uri'  => admin_url('admin-post.php?action=funnel_ai_oauth_callback'),
            ]),
        ]);
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
            wp_die('Token exchange failed');
        }
        $body = json_decode(wp_remote_retrieve_body($res), true);
        $settings = get_option('funnel_ai_settings', []);
        $settings['connected']     = true;
        $settings['access_token']  = $body['access_token'];
        $settings['refresh_token'] = $body['refresh_token'];
        $settings['expires_at']    = time() + (int) $body['expires_in'];
        $settings['workspace_id']  = $body['workspace']['id'] ?? '';
        $settings['workspace_name'] = $body['workspace']['name'] ?? '';
        update_option('funnel_ai_settings', $settings);

        wp_safe_redirect(admin_url('admin.php?page=funnel-ai&connected=1'));
        exit;
    }

    public static function ensure_fresh_token(): string {
        $settings = get_option('funnel_ai_settings', []);
        if (empty($settings['access_token'])) {
            throw new \RuntimeException('GoFunnelAI is not connected to this site');
        }
        if (!empty($settings['expires_at']) && $settings['expires_at'] - time() > 60) {
            return $settings['access_token'];
        }
        return self::refresh($settings);
    }

    private static function refresh(array $settings): string {
        $res = wp_remote_post(FUNNEL_AI_AUTH_BASE . '/oauth/token', [
            'timeout' => 15,
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode([
                'grant_type'    => 'refresh_token',
                'refresh_token' => $settings['refresh_token'],
                'client_id'     => 'wp_' . wp_parse_url(home_url(), PHP_URL_HOST),
            ]),
        ]);
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
            throw new \RuntimeException('Refresh failed â€” please reconnect GoFunnelAI');
        }
        $body = json_decode(wp_remote_retrieve_body($res), true);
        $settings['access_token']  = $body['access_token'];
        $settings['refresh_token'] = $body['refresh_token'];
        $settings['expires_at']    = time() + (int) $body['expires_in'];
        update_option('funnel_ai_settings', $settings);
        return $settings['access_token'];
    }

    private static function base64url(string $bytes): string {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}

OAuth::register();
