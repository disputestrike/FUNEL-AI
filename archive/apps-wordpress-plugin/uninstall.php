<?php
/**
 * Uninstall — strip every option / transient / site meta we created.
 * Only runs when the plugin is deleted from the WP UI (not on simple deactivate).
 *
 * @package FunnelAI
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('funnel_ai_settings');
delete_option('funnel_ai_site_token');

global $wpdb;
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_funnel_ai_%' OR option_name LIKE '_transient_timeout_funnel_ai_%'");
