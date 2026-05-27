<?php
/**
 * Lead capture â€” listens to every supported form plugin's "submission saved"
 * hook and forwards the entry to /v1/webhooks/form-submit on the GoFunnelAI
 * API. The server-side speed-to-lead pipeline (Resend email + SignalWire SMS
 * via @funnel/sdk) takes over from there.
 *
 * Supported sources:
 *   - Gravity Forms       â€” gform_after_submission
 *   - WPForms             â€” wpforms_process_complete
 *   - Contact Form 7      â€” wpcf7_mail_sent
 *   - WooCommerce         â€” woocommerce_thankyou
 *
 * Each handler maps the source-specific payload onto a uniform shape:
 *   { surface, source, sourceFormId, funnelId?, fields, capturedAt, pageUrl }
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class Lead_Capture {
    public static function register() {
        $s = get_option('funnel_ai_settings', []);

        if (!empty($s['forward_gravity']) && class_exists('GFForms')) {
            add_action('gform_after_submission', [__CLASS__, 'on_gravity'], 10, 2);
        }
        if (!empty($s['forward_wpforms'])) {
            add_action('wpforms_process_complete', [__CLASS__, 'on_wpforms'], 10, 4);
        }
        if (!empty($s['forward_cf7'])) {
            add_action('wpcf7_mail_sent', [__CLASS__, 'on_cf7']);
        }
        if (!empty($s['forward_woo'])) {
            add_action('woocommerce_thankyou', [__CLASS__, 'on_woocommerce']);
        }
    }

    public static function on_gravity($entry, $form) {
        $fields = [];
        foreach ($form['fields'] as $field) {
            $key = sanitize_key($field->label ?: ('field_' . $field->id));
            $fields[$key] = rgar($entry, (string) $field->id);
        }
        self::dispatch([
            'source'       => 'gravity-forms',
            'sourceFormId' => (string) $form['id'],
            'sourceFormName' => $form['title'] ?? '',
            'fields'       => $fields,
        ]);
    }

    public static function on_wpforms($fields, $entry, $form_data) {
        $clean = [];
        foreach ($fields as $f) {
            $clean[sanitize_key($f['name'] ?? ('field_' . $f['id']))] = $f['value'] ?? '';
        }
        self::dispatch([
            'source'       => 'wpforms',
            'sourceFormId' => (string) ($form_data['id'] ?? ''),
            'sourceFormName' => $form_data['settings']['form_title'] ?? '',
            'fields'       => $clean,
        ]);
    }

    public static function on_cf7($contact_form) {
        $submission = \WPCF7_Submission::get_instance();
        if (!$submission) return;
        $posted = $submission->get_posted_data();
        $clean = [];
        foreach ($posted as $k => $v) {
            if (is_array($v)) $v = implode(', ', $v);
            $clean[sanitize_key($k)] = is_scalar($v) ? (string) $v : '';
        }
        self::dispatch([
            'source'       => 'contact-form-7',
            'sourceFormId' => (string) $contact_form->id(),
            'sourceFormName' => $contact_form->title(),
            'fields'       => $clean,
        ]);
    }

    public static function on_woocommerce($order_id) {
        if (!function_exists('wc_get_order')) return;
        $order = wc_get_order($order_id);
        if (!$order) return;
        self::dispatch([
            'source'       => 'woocommerce',
            'sourceFormId' => 'woo-checkout',
            'fields'       => [
                'first_name' => $order->get_billing_first_name(),
                'last_name'  => $order->get_billing_last_name(),
                'email'      => $order->get_billing_email(),
                'phone'      => $order->get_billing_phone(),
                'total'      => $order->get_total(),
                'currency'   => $order->get_currency(),
                'order_id'   => (string) $order_id,
            ],
        ]);
    }

    private static function dispatch(array $payload) {
        $settings = get_option('funnel_ai_settings', []);
        $payload['surface']    = 'wordpress-plugin';
        $payload['funnelId']   = $payload['funnelId'] ?? ($settings['default_funnel'] ?? '');
        $payload['pageUrl']    = wp_get_referer() ?: home_url($_SERVER['REQUEST_URI'] ?? '/');
        $payload['capturedAt'] = current_time('c');

        // Cap field values at 2KB each â€” we never want a runaway textarea to
        // bloat the webhook payload.
        foreach ($payload['fields'] as $k => $v) {
            $payload['fields'][$k] = mb_substr((string) $v, 0, 2048);
        }

        $r = SDK::form_submit($payload);
        if (is_wp_error($r)) {
            error_log('[funnel-ai] form-submit failed: ' . $r->get_error_message());
        }
    }
}
