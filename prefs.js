import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    configureDnscrypt,
    resolverIdAt,
    resolverIndex,
    RESOLVERS,
    restartProtection,
    setStartupEnabled
} from './utils.js';

export default class CryptShieldPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_title(_('CryptShield Preferences'));
        window.set_default_size(500, 620);

        const page = new Adw.PreferencesPage({
            title: _('CryptShield'),
            icon_name: 'security-high-symbolic'
        });

        page.add(this._resolverGroup(settings, window));
        page.add(this._advancedGroup(settings, window));
        page.add(this._polkitGroup());

        window.add(page);
    }

    _resolverGroup(settings, window) {
        const group = new Adw.PreferencesGroup({
            title: _('Resolver')
        });

        const stringList = new Gtk.StringList();
        for (const resolver of RESOLVERS)
            stringList.append(resolver.label);

        const resolverRow = new Adw.ComboRow({
            title: _('Primary Server'),
            subtitle: _('Select the upstream DNS provider'),
            model: stringList,
            selected: resolverIndex(settings.get_string('resolver'))
        });

        resolverRow.connect('notify::selected', row => {
            const resolver = resolverIdAt(row.selected);
            settings.set_string('resolver', resolver);
            this._applyDnscryptConfig(settings, window, true);
        });

        group.add(resolverRow);
        return group;
    }

    _advancedGroup(settings, window) {
        const group = new Adw.PreferencesGroup({
            title: _('Advanced Options')
        });

        group.add(this._switchRow(
            settings,
            'run-on-startup',
            _('Run on Startup'),
            _('Enable service automatically on boot'),
            async active => setStartupEnabled(active),
            window
        ));

        group.add(this._switchRow(
            settings,
            'local-caching',
            _('Local Caching'),
            _('Speed up repeated queries'),
            async () => this._applyDnscryptConfig(settings, window, true),
            window
        ));

        group.add(this._switchRow(
            settings,
            'require-dnssec',
            _('Require DNSSEC'),
            _('Strictly validate DNS signatures'),
            async () => this._applyDnscryptConfig(settings, window, true),
            window
        ));

        group.add(this._switchRow(
            settings,
            'force-tcp',
            _('Force TCP'),
            _('Always use TCP instead of UDP'),
            async () => this._applyDnscryptConfig(settings, window, true),
            window
        ));

        return group;
    }

    _switchRow(settings, key, title, subtitle, apply, window) {
        const row = new Adw.SwitchRow({
            title,
            subtitle,
            active: settings.get_boolean(key)
        });

        row.connect('notify::active', async source => {
            settings.set_boolean(key, source.active);

            try {
                await apply(source.active);
            } catch (error) {
                this._showError(window, error);
            }
        });

        return row;
    }

    _polkitGroup() {
        const group = new Adw.PreferencesGroup();
        const row = new Adw.ActionRow({
            title: _('Requires Polkit authorization'),
            subtitle: _('System changes may ask for your administrator password')
        });

        row.add_prefix(new Gtk.Image({
            icon_name: 'dialog-password-symbolic',
            valign: Gtk.Align.CENTER
        }));

        group.add(row);
        return group;
    }

    async _applyDnscryptConfig(settings, window, restartAfterWrite) {
        try {
            if (restartAfterWrite)
                await restartProtection(settings);
            else
                await configureDnscrypt(settings);
        } catch (error) {
            this._showError(window, error);
        }
    }

    _showError(window, error) {
        const dialog = new Adw.MessageDialog({
            transient_for: window,
            modal: true,
            heading: _('CryptShield could not apply the change'),
            body: error.message
        });

        dialog.add_response('close', _('Close'));
        dialog.present();
    }
}
