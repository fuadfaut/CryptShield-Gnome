import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    configureDnscrypt,
    getServiceStatus,
    readQueryStats,
    resolverLabel,
    restartService,
    setServiceActive
} from './utils.js';

const PANEL_ICON_ACTIVE = 'security-high-symbolic';
const PANEL_ICON_INACTIVE = 'security-medium-symbolic';
const POLL_SECONDS = 5;

const CryptShieldIndicator = GObject.registerClass(
class CryptShieldIndicator extends PanelMenu.Button {
    _init(extension, settings) {
        super._init(0.0, _('CryptShield'));

        this._extension = extension;
        this._settings = settings;
        this._isActive = false;
        this._busy = false;
        this._pollId = 0;
        this._settingsSignals = [];

        this._buildPanel();
        this._buildMenu();
        this._bindSettings();

        this._refreshStatus();
        this._refreshStats();
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
            this._refreshStatus();

            if (this.menu.isOpen)
                this._refreshStats();

            return GLib.SOURCE_CONTINUE;
        });
    }

    _buildPanel() {
        const panelBox = new St.BoxLayout({
            style_class: 'cryptshield-panel',
            y_align: Clutter.ActorAlign.CENTER
        });

        this._panelIcon = new St.Icon({
            icon_name: PANEL_ICON_INACTIVE,
            style_class: 'system-status-icon cryptshield-panel-icon'
        });

        this._panelLabel = new St.Label({
            text: resolverLabel(this._settings.get_string('resolver')),
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'cryptshield-panel-label'
        });

        panelBox.add_child(this._panelIcon);
        panelBox.add_child(this._panelLabel);
        this.add_child(panelBox);
    }

    _buildMenu() {
        this._statusItem = new PopupMenu.PopupSwitchMenuItem(_('DNSCrypt Active'), false);
        this._statusItem.connect('activate', () => this._toggleProtection());
        this.menu.addMenuItem(this._statusItem);

        this._subtitleItem = new PopupMenu.PopupMenuItem('', {
            reactive: false,
            can_focus: false
        });
        this._subtitleItem.label.add_style_class_name('cryptshield-subtitle');
        this.menu.addMenuItem(this._subtitleItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const statsItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        const statsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'cryptshield-stats'
        });

        this._totalLabel = this._createStatRow(statsBox, _('Total Queries'), '0');
        this._blockedLabel = this._createStatRow(statsBox, _('Blocked Ads'), '0', 'cryptshield-stat-blocked');
        statsItem.add_child(statsBox);
        this.menu.addMenuItem(statsItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem(_('Extension Settings'));
        settingsItem.insert_child_at_index(new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'popup-menu-icon'
        }), 1);
        settingsItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(settingsItem);

        const restartItem = new PopupMenu.PopupMenuItem(_('Restart Service'));
        restartItem.insert_child_at_index(new St.Icon({
            icon_name: 'view-refresh-symbolic',
            style_class: 'popup-menu-icon'
        }), 1);
        restartItem.connect('activate', () => this._restart());
        this.menu.addMenuItem(restartItem);

        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._refreshStatus();
                this._refreshStats();
            }
        });
    }

    _createStatRow(parent, label, value, valueClass = '') {
        const row = new St.BoxLayout({
            x_expand: true,
            style_class: 'cryptshield-stat-row'
        });

        row.add_child(new St.Label({
            text: label,
            x_expand: true
        }));

        const valueLabel = new St.Label({
            text: value,
            style_class: `cryptshield-stat-value ${valueClass}`.trim()
        });

        row.add_child(valueLabel);
        parent.add_child(row);
        return valueLabel;
    }

    _bindSettings() {
        const updateResolver = () => this._updateUi();

        this._settingsSignals.push(
            this._settings.connect('changed::resolver', updateResolver)
        );
    }

    async _toggleProtection() {
        if (this._busy)
            return;

        this._busy = true;
        this._setBusy(true);

        try {
            if (!this._isActive)
                await configureDnscrypt(this._settings);

            await setServiceActive(!this._isActive);
            await this._refreshStatus();
        } catch (error) {
            Main.notifyError(_('CryptShield'), error.message);
            this._updateUi();
        } finally {
            this._busy = false;
            this._setBusy(false);
        }
    }

    async _restart() {
        if (this._busy)
            return;

        this._busy = true;
        this._setBusy(true, _('Restarting...'));

        try {
            await configureDnscrypt(this._settings);
            await restartService();
            await this._refreshStatus();
        } catch (error) {
            Main.notifyError(_('CryptShield'), error.message);
            this._updateUi();
        } finally {
            this._busy = false;
            this._setBusy(false);
        }
    }

    async _refreshStatus() {
        try {
            const status = await getServiceStatus();
            this._isActive = status === 'active';
            this._updateUi();
        } catch (error) {
            logError(error, 'CryptShield status refresh failed');
        }
    }

    async _refreshStats() {
        try {
            const stats = await readQueryStats();
            this._totalLabel.text = stats.total.toLocaleString();
            this._blockedLabel.text = stats.blocked.toLocaleString();
        } catch (error) {
            logError(error, 'CryptShield stats refresh failed');
        }
    }

    _setBusy(isBusy, label = _('Applying...')) {
        this.reactive = !isBusy;

        if (isBusy) {
            this._statusItem.label.text = label;
            return;
        }

        this._updateUi();
    }

    _updateUi() {
        const resolver = resolverLabel(this._settings.get_string('resolver'));

        this._panelLabel.text = resolver;
        this._panelLabel.visible = this._isActive;
        this._panelIcon.icon_name = this._isActive ? PANEL_ICON_ACTIVE : PANEL_ICON_INACTIVE;
        this._panelIcon.remove_style_class_name('cryptshield-panel-icon-active');
        this._panelIcon.remove_style_class_name('cryptshield-panel-icon-inactive');
        this._panelIcon.add_style_class_name(this._isActive
            ? 'cryptshield-panel-icon-active'
            : 'cryptshield-panel-icon-inactive');

        this._statusItem.setToggleState(this._isActive);
        this._statusItem.label.text = this._isActive ? _('DNSCrypt Active') : _('Service Stopped');
        this._subtitleItem.label.text = this._isActive
            ? `Protected via ${resolver}`
            : _('System using default DNS');
    }

    destroy() {
        if (this._pollId) {
            GLib.Source.remove(this._pollId);
            this._pollId = 0;
        }

        for (const signalId of this._settingsSignals)
            this._settings.disconnect(signalId);

        this._settingsSignals = [];
        super.destroy();
    }
});

export default class CryptShieldExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new CryptShieldIndicator(this, this._settings);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
