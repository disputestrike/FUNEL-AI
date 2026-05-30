<?php
/**
 * Funnel browser â€” submenu under GoFunnelAI that lists the workspace's
 * funnels and lets the editor pick one to embed in a WP page.
 *
 * Clicking "Embed" deep-links into a new page with a pre-filled GoFunnelAI
 * Gutenberg block.
 *
 * @package FunnelAI
 */

namespace FunnelAI;

if (!defined('ABSPATH')) {
    exit;
}

class Funnel_Browser {
    public function __construct() {
        add_action('admin_menu', [$this, 'register'], 20);
    }

    public function register() {
        add_submenu_page(
            'funnel-ai',
            __('Funnel browser', 'funnel-ai'),
            __('Funnel browser', 'funnel-ai'),
            'edit_pages',
            'funnel-ai-browser',
            [$this, 'render']
        );
    }

    public function render() {
        $settings = get_option('funnel_ai_settings', []);
        if (empty($settings['connected'])) {
            echo '<div class="wrap"><h1>' . esc_html__('Funnel browser', 'funnel-ai') . '</h1><p>' . esc_html__('Connect GoFunnelAI first.', 'funnel-ai') . '</p></div>';
            return;
        }
        $funnels = SDK::list_funnels(['limit' => 100]);
        if (is_wp_error($funnels)) {
            echo '<div class="wrap"><p>' . esc_html($funnels->get_error_message()) . '</p></div>';
            return;
        }
        ?>
        <div class="wrap funnel-ai-wrap">
            <h1><?php esc_html_e('Your GoFunnelAI funnels', 'funnel-ai'); ?></h1>
            <table class="wp-list-table widefat fixed striped">
                <thead><tr>
                    <th><?php esc_html_e('Name', 'funnel-ai'); ?></th>
                    <th><?php esc_html_e('Status', 'funnel-ai'); ?></th>
                    <th><?php esc_html_e('Conversion', 'funnel-ai'); ?></th>
                    <th><?php esc_html_e('Action', 'funnel-ai'); ?></th>
                </tr></thead>
                <tbody>
                    <?php foreach (($funnels['data'] ?? []) as $f): ?>
                        <tr>
                            <td><strong><?php echo esc_html($f['name']); ?></strong></td>
                            <td><?php echo esc_html($f['status']); ?></td>
                            <td><?php echo esc_html(($f['conversionRate'] ?? 0) . '%'); ?></td>
                            <td>
                                <a class="button button-primary" href="<?php echo esc_url(admin_url('post-new.php?post_type=page&funnelai_embed=' . $f['id'])); ?>">
                                    <?php esc_html_e('Embed in new page', 'funnel-ai'); ?>
                                </a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
}
