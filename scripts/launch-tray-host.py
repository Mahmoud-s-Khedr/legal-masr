"""Private session-bus StatusNotifier fixture; never claims real shell coverage.

Run only under dbus-run-session. The app uses its actual platform host detection
and appindicator registration, window close handler and native lock service.
"""
import os
import json
from pathlib import Path
import subprocess
import sys
import threading

import gi
from gi.repository import Gio, GLib

bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
xml = '''<node><interface name="org.kde.StatusNotifierWatcher">
<method name="RegisterStatusNotifierItem"><arg type="s" direction="in"/></method>
<property name="IsStatusNotifierHostRegistered" type="b" access="read"/>
<property name="RegisteredStatusNotifierItems" type="as" access="read"/>
<property name="ProtocolVersion" type="i" access="read"/>
<signal name="StatusNotifierItemRegistered"><arg type="s"/></signal>
</interface></node>'''
items = []

def method(connection, sender, path, interface, name, parameters, invocation):
    item = parameters.unpack()[0]
    items.append(sender + item if item.startswith('/') else item)
    invocation.return_value(None)
    connection.emit_signal(None, path, interface, 'StatusNotifierItemRegistered',
                           GLib.Variant('(s)', (items[-1],)))

def prop(connection, sender, path, interface, name):
    return {'IsStatusNotifierHostRegistered': GLib.Variant('b', True),
            'RegisteredStatusNotifierItems': GLib.Variant('as', items),
            'ProtocolVersion': GLib.Variant('i', 0)}[name]

# Drive the app's exported native Show menu, rather than mapping an X11 window
# behind GTK's visibility state. The fixture never renders a desktop shell menu.
fixture_xml = '<node><interface name="org.legalmaster.LaunchTrayFixture"><method name="Show"/></interface></node>'
show_labels = {json.loads(Path(f'src/i18n/{lang}/common.json').read_text())['tray']['show']
               for lang in ('ar', 'en')}

def show_app(connection, sender, path, interface, name, parameters, invocation):
    for item in reversed(items):
        try:
            service, separator, suffix = item.partition('/')
            item_path = '/' + suffix if separator else '/StatusNotifierItem'
            reply = bus.call_sync(service, item_path, 'org.freedesktop.DBus.Properties',
                                  'Get', GLib.Variant('(ss)', ('org.kde.StatusNotifierItem', 'Menu')),
                                  None, Gio.DBusCallFlags.NO_AUTO_START, 3000, None)
            menu_path = reply.unpack()[0]
            layout = bus.call_sync(service, menu_path, 'com.canonical.dbusmenu', 'GetLayout',
                                   GLib.Variant('(iias)', (0, -1, ['label'])), None,
                                   Gio.DBusCallFlags.NO_AUTO_START, 3000, None).unpack()[1]
            def find_show(node):
                number, props, children = node
                if props.get('label', '').replace('_', '') in show_labels:
                    return number
                for child in children:
                    found = find_show(child)
                    if found is not None:
                        return found
                return None
            number = find_show(layout)
            if number is None:
                continue
            bus.call_sync(service, menu_path, 'com.canonical.dbusmenu', 'Event',
                          GLib.Variant('(isvu)', (number, 'clicked', GLib.Variant('i', 0), 0)),
                          None, Gio.DBusCallFlags.NO_AUTO_START, 3000, None)
            invocation.return_value(None)
            return
        except GLib.Error:
            continue
    invocation.return_dbus_error('org.legalmaster.LaunchTrayFixture.ShowFailed', 'TRAY_SHOW_FAILED')

bus.register_object('/LaunchTrayFixture', Gio.DBusNodeInfo.new_for_xml(fixture_xml).interfaces[0],
                    show_app, None, None)
bus.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus',
              'org.freedesktop.DBus', 'RequestName',
              GLib.Variant('(su)', ('org.legalmaster.LaunchTrayFixture', 4)),
              None, Gio.DBusCallFlags.NONE, 5000, None)

bus.register_object('/StatusNotifierWatcher', Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0], method, prop, None)
bus.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus',
              'org.freedesktop.DBus', 'RequestName',
              GLib.Variant('(su)', ('org.kde.StatusNotifierWatcher', 4)),
              None, Gio.DBusCallFlags.NONE, 5000, None)
loop = GLib.MainLoop()
thread = threading.Thread(target=loop.run, daemon=True)
thread.start()
try:
    result = subprocess.run(['node', 'scripts/launch-tray-e2e.mjs'],
                            env={**os.environ, 'LAUNCH_TRAY_HOST': 'present'})
    if result.returncode == 0 and not items:
        print('TRAY_REGISTRATION_NOT_OBSERVED')
        sys.exit(1)
    sys.exit(result.returncode)
finally:
    loop.quit()
