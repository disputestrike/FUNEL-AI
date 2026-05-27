<?php
/**
 * Plugin Name:       GoFunnelAI
 * Plugin URI:        https://gofunnelai.com/integrations/wordpress
 * Description:       Embed GoFunnelAI funnels into any WordPress page, sync form submissions (Gravity Forms, WPForms, Contact Form 7, WooCommerce) to the GoFunnelAI CRM, and fire the speed-to-lead pipeline within seconds of capture.
 * Version:           0.1.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            GoFunnelAI
 * Author URI:        https://gofunnelai.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       funnel-ai
 * Domain Path:       /languages
 *
 * @package FunnelAI
 */

if (!defined('ABSPATH')) {
    exit;
}

define('FUNNEL_AI_VERSION', '0.1.0');
define('FUNNEL_AI_PLUGIN_FILE', __FILE__);
define('FUNNEL_AI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FUNNEL_AI_PLUGIN_URL', plugin_dir_url(__FILE__));
define('FUNNEL_AI_API_BASE', defined('FUNNEL_AI_API_BASE_OVERRIDE') ? FUNNEL_AI_API_BASE_OVERRIDE : 'https://api.gofunnelai.com');
define('FUNNEL_AI_AUTH_BASE', defined('FUNNEL_AI_AUTH_BASE_OVERRIDE') ? FUNNEL_AI_AUTH_BASE_OVERRIDE : 'https://login.gofunnelai.com');

require_once FUNNEL_AI_PLUGIN_DIR . 'includes/class-sdk.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'includes/class-oauth.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'admin/class-admin.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'admin/class-funnel-browser.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'blocks/class-funnel-block.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'shortcode/class-funnel-shortcode.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'api/class-rest-api.php';
require_once FUNNEL_AI_PLUGIN_DIR . 'lead-capture.php';

/**
 * Bootstraps every subsystem. Each class hooks into WordPress on `init` /
 * `admin_init` / `rest_api_init` as appropriate â€” see their constructors.
 */
function funnel_ai_bootstrap() {
    new \FunnelAI\Admin();
    new \FunnelAI\Funnel_Browser();
    new \FunnelAI\Block();
    new \FunnelAI\Shortcode();
    new \FunnelAI\REST_API();
    \FunnelAI\Lead_Capture::register();
}
add_action('plugins_loaded', 'funnel_ai_bootstrap');

register_activation_hook(__FILE__, function () {
    add_option('funnel_ai_settings', [
        'connected'        => false,
        'workspace_id'     => '',
        'access_token'     => '',
        'refresh_token'    => '',
        'expires_at'       => 0,
        'default_funnel'   => '',
        'forward_gravity'  => true,
        'forward_wpforms'  => true,
        'forward_cf7'      => true,
        'forward_woo'      => true,
    ]);
});
