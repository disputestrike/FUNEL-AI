<?php
/**
 * Top-level WP admin pages: Settings + Funnel Browser.
 *
 * Settings page exposes:
 *   - Connect / Disconnect via OAuth.
 *   - Default funnel for orphan form captures.
 *   - Toggle each form provider (Gravity, WPForms, CF7, Woo) on/off.
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class Admin {
    public function __construct() {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    public function register_menu() {
        add_menu_page(
            __('GoFunnelAI', 'funnel-ai'),
            __('GoFunnelAI', 'funnel-ai'),
            'manage_options',
            'funnel-ai',
            [$this, 'render_settings_page'],
            'dashicons-chart-line',
            58
        );
    }

    public function register_settings() {
        register_setting('funnel_ai_settings_group', 'funnel_ai_settings', [
            'sanitize_callback' => [$this, 'sanitize_settings'],
        ]);
    }

    public function sanitize_settings($input) {
        $current = get_option('funnel_ai_settings', []);
        $current['default_funnel']  = sanitize_text_field($input['default_funnel']  ?? '');
        $current['forward_gravity'] = !empty($input['forward_gravity']);
        $current['forward_wpforms'] = !empty($input['forward_wpforms']);
        $current['forward_cf7']     = !empty($input['forward_cf7']);
        $current['forward_woo']     = !empty($input['forward_woo']);
        return $current;
    }

    public function enqueue($hook) {
        if (strpos($hook, 'funnel-ai') === false) {
            return;
        }
        wp_enqueue_style(
            'funnel-ai-admin',
            FUNNEL_AI_PLUGIN_URL . 'admin/admin.css',
            [],
            FUNNEL_AI_VERSION
        );
        wp_enqueue_script(
            'funnel-ai-admin',
            FUNNEL_AI_PLUGIN_URL . 'admin/admin.js',
            ['wp-element', 'wp-components', 'wp-api-fetch'],
            FUNNEL_AI_VERSION,
            true
        );
        wp_localize_script('funnel-ai-admin', 'FunnelAIAdmin', [
            'restNonce'  => wp_create_nonce('wp_rest'),
            'restUrl'    => rest_url('funnelai/v1/'),
            'adminUrl'   => admin_url('admin.php?page=funnel-ai'),
        ]);
    }

    public function render_settings_page() {
        $settings = get_option('funnel_ai_settings', []);
        $connected = !empty($settings['connected']);
        $connect_url = wp_nonce_url(
            admin_url('admin-post.php?action=funnel_ai_oauth_start'),
            'funnel_ai_oauth_start'
        );
        ?>
        <div class="wrap funnel-ai-wrap">
            <h1><?php esc_html_e('GoFunnelAI', 'funnel-ai'); ?></h1>

            <?php if (!empty($_GET['connected'])): ?>
                <div class="notice notice-success"><p><?php esc_html_e('Connected to GoFunnelAI.', 'funnel-ai'); ?></p></div>
            <?php endif; ?>

            <div class="funnel-ai-card">
                <h2><?php esc_html_e('Account', 'funnel-ai'); ?></h2>
                <?php if ($connected): ?>
                    <p>
                        <?php
                        echo esc_html(sprintf(
                            /* translators: %s: workspace name */
                            __('Connected to workspace: %s', 'funnel-ai'),
                            $settings['workspace_name'] ?? 'â€”'
                        ));
                        ?>
                    </p>
                <?php else: ?>
                    <p><?php esc_html_e('Connect this site to your GoFunnelAI workspace to embed funnels and forward form submissions.', 'funnel-ai'); ?></p>
                    <a class="button button-primary" href="<?php echo esc_url($connect_url); ?>">
                        <?php esc_html_e('Connect to GoFunnelAI', 'funnel-ai'); ?>
                    </a>
                <?php endif; ?>
            </div>

            <?php if ($connected): ?>
            <form method="post" action="options.php" class="funnel-ai-card">
                <?php settings_fields('funnel_ai_settings_group'); ?>
                <h2><?php esc_html_e('Form forwarding', 'funnel-ai'); ?></h2>
                <p><?php esc_html_e('Forward submissions from these form plugins to your GoFunnelAI CRM and trigger the speed-to-lead pipeline.', 'funnel-ai'); ?></p>
                <table class="form-table">
                    <tr>
                        <th><?php esc_html_e('Gravity Forms', 'funnel-ai'); ?></th>
                        <td><label><input type="checkbox" name="funnel_ai_settings[forward_gravity]" <?php checked(!empty($settings['forward_gravity'])); ?>/> <?php esc_html_e('Forward all submissions', 'funnel-ai'); ?></label></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('WPForms', 'funnel-ai'); ?></th>
                        <td><label><input type="checkbox" name="funnel_ai_settings[forward_wpforms]" <?php checked(!empty($settings['forward_wpforms'])); ?>/> <?php esc_html_e('Forward all submissions', 'funnel-ai'); ?></label></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Contact Form 7', 'funnel-ai'); ?></th>
                        <td><label><input type="checkbox" name="funnel_ai_settings[forward_cf7]" <?php checked(!empty($settings['forward_cf7'])); ?>/> <?php esc_html_e('Forward all submissions', 'funnel-ai'); ?></label></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('WooCommerce', 'funnel-ai'); ?></th>
                        <td><label><input type="checkbox" name="funnel_ai_settings[forward_woo]" <?php checked(!empty($settings['forward_woo'])); ?>/> <?php esc_html_e('Forward checkouts as leads', 'funnel-ai'); ?></label></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Default funnel for orphan submissions', 'funnel-ai'); ?></th>
                        <td>
                            <input type="text" class="regular-text" name="funnel_ai_settings[default_funnel]" value="<?php echo esc_attr($settings['default_funnel'] ?? ''); ?>" placeholder="<?php esc_attr_e('Funnel ID', 'funnel-ai'); ?>"/>
                            <p class="description"><?php esc_html_e('When the submitted form is not tagged with a funnel ID, route the lead here.', 'funnel-ai'); ?></p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            <?php endif; ?>
        </div>
        <?php
    }
}
